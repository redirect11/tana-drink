import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  subscribeOpenGroups,
  subscribeActiveOrders,
  subscribeRecentGroups,
  nestGroup,
  unnestGroup,
  renameGroup,
  closeGroups,
  deleteGroup,
  payGroupCash,
  createPendingGroupPayment,
} from '../lib/api.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import {
  createGroupCheckout,
  getGroupPaymentStatus,
  groupReaderCheckout,
} from '../lib/paymentsApi.js'
import { mountCardWidget } from '../lib/sumupWidget.js'
import { auth } from '../lib/firebaseClient.js'
import {
  buildGroupTree,
  groupTotal,
  groupSettlement,
  flattenOrders,
  unpaidOrders,
  subtreeGroupIds,
  splitAmounts,
  canNest,
} from '../lib/groups.js'
import { formatPrice, STATUS_LABELS, STATUS_EMOJI } from '../lib/orderStatus.js'

// Vista di un gruppo (modale) con drill-down ricorsivo: per un contenitore
// mostra "composto da" + ordini aggregati; cliccando un sottogruppo si
// scende mantenendo la stessa vista. Gestione annidamento (aggiungi/sgancia).
export default function GroupView({ groupId, onClose }) {
  const [groups, setGroups] = useState([])
  const [recent, setRecent] = useState([])
  const [orders, setOrders] = useState([])
  const [currentId, setCurrentId] = useState(groupId)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState(null)
  const [paying, setPaying] = useState(false)
  const [splitN, setSplitN] = useState(2)
  const [showSplit, setShowSplit] = useState(false)
  const [perOrder, setPerOrder] = useState(false)
  const [sumupMsg, setSumupMsg] = useState(null)
  const [checkoutId, setCheckoutId] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'close' | 'delete'
  const navigate = useNavigate()

  useEffect(() => {
    const u1 = subscribeOpenGroups(setGroups, () => {})
    const u2 = subscribeActiveOrders(setOrders, () => {})
    const u3 = subscribeRecentGroups(setRecent, () => {})
    return () => { u1(); u2(); u3() }
  }, [])

  // Unisce gruppi aperti + recenti (clienti) per albero e candidati.
  const allGroups = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const g of [...groups, ...recent]) {
      if (seen.has(g.id)) continue
      seen.add(g.id)
      out.push(g)
    }
    return out
  }, [groups, recent])

  const { byId } = useMemo(() => buildGroupTree(allGroups, orders), [allGroups, orders])
  const groupsById = useMemo(() => new Map(allGroups.map((g) => [g.id, g])), [allGroups])
  const node = byId.get(currentId)

  if (!node) {
    return (
      <div className="overlay confirm-overlay" onClick={onClose}>
        <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
          <p className="muted">Gruppo non trovato.</p>
          <button className="btn ghost block" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    )
  }

  const t = groupTotal(node)
  const s = groupSettlement(node)
  const isContainer = node.group.has_child_groups
  const aggregated = flattenOrders(node)

  // Candidati da annidare: gruppi (manuali aperti + clienti recenti)
  // che possono entrare in questo gruppo, escludendo discendenti/sé stesso.
  const candidates = allGroups.filter(
    (g) => g.id !== node.group.id && g.parent_group_id == null && canNest(g, node.group, groupsById).ok
  )

  async function doNest(childId) {
    setError(null)
    try {
      await nestGroup(childId, node.group.id)
      setPicking(false)
    } catch (e) {
      setError(e.message)
    }
  }
  async function doUnnest(childId) {
    setError(null)
    try {
      await unnestGroup(childId)
    } catch (e) {
      setError(e.message)
    }
  }
  async function doRename() {
    const n = prompt('Nuovo nome del gruppo:', node.group.name)
    if (n == null || !n.trim()) return
    await renameGroup(node.group.id, n.trim()).catch((e) => setError(e.message))
  }

  function payBy() {
    const u = auth.currentUser
    return u ? { uid: u.uid, email: u.email } : null
  }

  async function pay(orderIds, split = null) {
    if (!orderIds.length) return
    setPaying(true)
    setError(null)
    try {
      await payGroupCash({
        orderIds,
        by: payBy(),
        group_id: node.group.id,
        group_ids: subtreeGroupIds(node),
        split,
      })
      setShowSplit(false)
      setPerOrder(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setPaying(false)
    }
  }

  // Crea il pagamento "in attesa" del conto intero (per SumUp).
  async function createPending(method) {
    const unpaid = unpaidOrders(node)
    return createPendingGroupPayment({
      orderIds: unpaid.map((o) => o.id),
      amount: groupSettlement(node).remaining,
      method,
      group_id: node.group.id,
      group_ids: subtreeGroupIds(node),
      items: unpaid.flatMap((o) =>
        (o.order_items || []).map((it) => ({ order_id: o.id, name: it.name, qty: it.qty, unit_price: it.unit_price }))
      ),
      by: payBy(),
    })
  }

  // Online: crea il checkout e monta il widget SumUp.
  async function payOnline() {
    setPaying(true)
    setError(null)
    setSumupMsg(null)
    try {
      const pid = await createPending('online')
      const res = await createGroupCheckout(pid)
      if (res.unavailable) {
        setSumupMsg('Pagamento online non disponibile (SumUp non configurato su questo ambiente).')
        return
      }
      if (res.alreadyPaid) return
      setCheckoutId(res.checkoutId)
      requestAnimationFrame(async () => {
        const el = document.getElementById('group-sumup-card')
        if (!el) return
        await mountCardWidget({
          checkoutId: res.checkoutId,
          el,
          onResponse: async (type) => {
            if (type !== 'sent') {
              await getGroupPaymentStatus(pid).catch(() => {})
              setCheckoutId(null)
            }
          },
        }).catch((e) => setSumupMsg(e.message))
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setPaying(false)
    }
  }

  // Lettore: crea il pagamento e avvia il checkout sul Solo.
  async function payReader() {
    setPaying(true)
    setError(null)
    setSumupMsg(null)
    try {
      const pid = await createPending('lettore')
      const res = await groupReaderCheckout(pid)
      if (res.unavailable) {
        setSumupMsg('Lettore non disponibile su questo ambiente.')
        return
      }
      setSumupMsg('📟 In corso sul lettore: carta del cliente sul Solo.')
    } catch (e) {
      setError(e.message)
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="summary-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            {currentId !== groupId && (
              <button className="btn ghost small" style={{ marginBottom: 6 }} onClick={() => setCurrentId(groupId)}>
                ← Gruppo principale
              </button>
            )}
            <h2 style={{ margin: 0 }}>
              {node.group.kind === 'customer' ? '👤 ' : '🏷 '}{node.group.name}
            </h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {t.orderCount} ordini · {formatPrice(t.total)}
              {' · '}
              <span className={`pill ${s.settled ? 'chiuso' : 'aperto'}`}>
                {s.settled ? 'Pagato' : `da pagare ${formatPrice(s.remaining)}`}
              </span>
            </p>
          </div>
          <button className="btn ghost small" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner" style={{ marginTop: 10 }}>{error}</div>}

        {/* Composizione del contenitore: sottogruppi cliccabili */}
        {isContainer && (
          <div style={{ marginTop: 12 }}>
            <div className="muted small">Composto da:</div>
            <div className="chips-row" style={{ marginTop: 4 }}>
              {node.childGroups.map((c) => {
                const ct = groupTotal(c)
                const cs = groupSettlement(c)
                return (
                  <button key={c.group.id} className="chip" onClick={() => setCurrentId(c.group.id)}>
                    {c.group.kind === 'customer' ? '👤 ' : '🏷 '}{c.group.name} · {formatPrice(ct.total)}
                    {cs.settled ? ' ✓' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Ordini (aggregati per il contenitore, diretti per la foglia) */}
        <div style={{ marginTop: 12 }}>
          <div className="muted small" style={{ marginBottom: 4 }}>
            {isContainer ? 'Tutti gli ordini del gruppo' : 'Ordini'}
          </div>
          {aggregated.length === 0 && <div className="muted small">Nessun ordine.</div>}
          {aggregated.map((o) => (
            <div className="row between" key={o.id} style={{ padding: '4px 0' }}>
              <span>
                #{o.daily_number ?? '—'} {o.customer_name ? `· ${o.customer_name}` : ''}{' '}
                <span className="muted small">
                  {STATUS_EMOJI[o.workflow_status]} {STATUS_LABELS[o.workflow_status]}
                </span>
              </span>
              <span className="price">{formatPrice(o.total)}</span>
            </div>
          ))}
        </div>

        {/* Conto: azioni di pagamento in contanti */}
        {!s.settled && s.remaining > 0 && (() => {
          const unpaid = unpaidOrders(node)
          const ids = unpaid.map((o) => o.id)
          const defaultN = node.childGroups.length > 1 ? node.childGroups.length : Math.max(2, unpaid.length)
          return (
            <div className="card" style={{ marginTop: 14, background: 'rgba(245,185,74,0.06)' }}>
              <div className="row between">
                <strong>Conto: {formatPrice(s.remaining)}</strong>
                <span className="muted small">{ids.length} da pagare</span>
              </div>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <button className="btn" disabled={paying} onClick={() => pay(ids)}>
                  💶 Contanti
                </button>
                <button
                  className="btn secondary"
                  disabled={paying}
                  onClick={() => { setSplitN(defaultN); setShowSplit((v) => !v); setPerOrder(false) }}
                >
                  ➗ Dividi
                </button>
                <button className="btn secondary" disabled={paying} onClick={payOnline}>
                  💳 Online
                </button>
                <button className="btn secondary" disabled={paying} onClick={payReader}>
                  📟 Lettore
                </button>
              </div>
              {sumupMsg && (
                <p className="muted small" style={{ marginTop: 8 }}>{sumupMsg}</p>
              )}
              <div id="group-sumup-card" style={{ display: checkoutId ? 'block' : 'none', marginTop: 8 }} />
              {!isContainer && ids.length > 1 && (
                <button
                  className="btn ghost small block"
                  style={{ marginTop: 8 }}
                  disabled={paying}
                  onClick={() => { setPerOrder((v) => !v); setShowSplit(false) }}
                >
                  Paga per singolo ordine
                </button>
              )}

              {showSplit && (
                <div style={{ marginTop: 10 }}>
                  <div className="row between" style={{ alignItems: 'center' }}>
                    <span className="muted small">Dividi per</span>
                    <span className="persons-counter">
                      <button onClick={() => setSplitN((n) => Math.max(2, n - 1))}>−</button>
                      <strong>{splitN}</strong>
                      <button onClick={() => setSplitN((n) => n + 1)}>+</button>
                    </span>
                  </div>
                  <p className="muted small" style={{ margin: '6px 0' }}>
                    {splitN} quote da {formatPrice(splitAmounts(s.remaining, splitN)[0])}
                    {' '}(l’ultima {formatPrice(splitAmounts(s.remaining, splitN).at(-1))})
                  </p>
                  <button className="btn block" disabled={paying} onClick={() => pay(ids, { count: splitN })}>
                    💶 Incassa {splitN} quote
                  </button>
                </div>
              )}

              {perOrder && (
                <div style={{ marginTop: 10 }}>
                  {unpaid.map((o) => (
                    <div className="row between" key={o.id} style={{ padding: '4px 0' }}>
                      <span>#{o.daily_number} · {formatPrice(o.total)}</span>
                      <button className="btn ghost small" disabled={paying} onClick={() => pay([o.id])}>
                        Paga
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Gestione annidamento (solo gruppi manuali) */}
        {node.group.kind === 'manual' && (
          <div style={{ marginTop: 14 }}>
            {!picking ? (
              <button
                className="btn secondary small"
                disabled={aggregated.length > 0 && !isContainer}
                title={aggregated.length > 0 && !isContainer ? 'Il gruppo ha ordini diretti: non può diventare contenitore' : ''}
                onClick={() => setPicking(true)}
              >
                ➕ Aggiungi un gruppo
              </button>
            ) : (
              <div>
                <div className="muted small" style={{ marginBottom: 4 }}>Aggiungi al gruppo:</div>
                {candidates.length === 0 && <div className="muted small">Nessun gruppo disponibile.</div>}
                <div className="chips-row">
                  {candidates.map((g) => (
                    <button key={g.id} className="chip" onClick={() => doNest(g.id)}>
                      {g.kind === 'customer' ? '👤 ' : '🏷 '}{g.name}
                    </button>
                  ))}
                </div>
                <button className="btn ghost small" style={{ marginTop: 6 }} onClick={() => setPicking(false)}>
                  Annulla
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sgancia il sottogruppo corrente dal padre */}
        {node.group.parent_group_id && (
          <button className="btn ghost small block" style={{ marginTop: 10 }} onClick={() => doUnnest(node.group.id)}>
            Sgancia dal gruppo padre
          </button>
        )}

        <div className="grid-2" style={{ marginTop: 14 }}>
          <button className="btn ghost" onClick={doRename}>✏️ Rinomina</button>
          {!isContainer && (
            <button className="btn" onClick={() => navigate(`/pos?group=${node.group.id}`)}>
              ✍️ Nuovo ordine
            </button>
          )}
        </div>

        {/* Chiusura/eliminazione del gruppo */}
        <div className="grid-2" style={{ marginTop: 8 }}>
          <button className="btn ghost small" onClick={() => setConfirm('close')}>
            📁 Chiudi gruppo
          </button>
          <button className="btn ghost small" onClick={() => setConfirm('delete')}>
            🗑 Elimina gruppo
          </button>
        </div>
      </div>

      {confirm === 'close' && (
        <ConfirmDialog
          title="📁 Chiudere il gruppo?"
          message={`“${node.group.name}” verrà archiviato e sparirà dai gruppi aperti.${
            s.remaining > 0 ? ` Attenzione: restano ${formatPrice(s.remaining)} da incassare.` : ''
          } Gli ordini restano dove sono.`}
          confirmLabel="Chiudi gruppo"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            closeGroups(subtreeGroupIds(node))
            onClose()
          }}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          title="🗑 Eliminare il gruppo?"
          message={`“${node.group.name}” verrà eliminato. Gli ordini${
            aggregated.length ? ` (${aggregated.length})` : ''
          } restano ma senza etichetta di gruppo${
            node.childGroups.length ? '; i sottogruppi tornano indipendenti' : ''
          }.`}
          confirmLabel="Elimina gruppo"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            deleteGroup(node.group.id).catch((e) => setError(e.message))
            onClose()
          }}
        />
      )}
    </div>
  )
}
