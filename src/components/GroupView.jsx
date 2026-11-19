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
  subscribeSettings,
  DEFAULT_SETTINGS,
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
import { formatPrice, statoAlBanco, STATUS_ICONA } from '../lib/orderStatus.js'
import { IconGruppo, IconPersona } from './Icons.jsx'
import { sumupAttivo } from '../lib/licenza.js'
import Icona from './Icona.jsx'
import { servizioAttivo } from '../lib/limiti.js'
import { tr } from '../lib/lingua.js'

// Vista di un gruppo (modale) con drill-down ricorsivo: per un contenitore
// mostra "composto da" + ordini aggregati; cliccando un sottogruppo si
// scende mantenendo la stessa vista. Gestione annidamento (aggiungi/sgancia).
export default function GroupView({ groupId, onClose }) {
  // IL PASSO DEL SERVIZIO SI MOSTRA SOLO DOVE ESISTE: in un locale che non
  // segue la preparazione quel bollo parla di una cosa che lì non si fa.
  const [impostazioni, setImpostazioni] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setImpostazioni), [])
  const workflowOn = servizioAttivo(impostazioni)
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
          <p className="muted">{tr('Gruppo non trovato.')}</p>
          <button className="btn ghost block" onClick={onClose}>{tr('Chiudi')}</button>
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
    const n = prompt(tr('Nuovo nome del gruppo:'), node.group.name)
    if (n == null || !n.trim()) return
    await renameGroup(node.group.id, n.trim()).catch((e) => setError(e.message))
  }

  function payBy() {
    const u = auth.currentUser
    return u ? { uid: u.uid, email: u.email } : null
  }

  // `metodo` viaggia fino al conto: senza, un tavolo pagato con la carta
  // veniva registrato come contante e la cassa a fine serata non tornava.
  async function pay(orderIds, split = null, metodo = 'banco') {
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
        method: metodo,
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
        setSumupMsg(tr('Pagamento online non disponibile (SumUp non configurato su questo ambiente).'))
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
        setSumupMsg(tr('Lettore non disponibile su questo ambiente.'))
        return
      }
      setSumupMsg(tr('In corso sul lettore: carta del cliente sul Solo.'))
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
                ← {tr('Gruppo principale')}
              </button>
            )}
            <h2 style={{ margin: 0 }}>
              {node.group.kind === 'customer' ? <IconPersona /> : <IconGruppo />} {node.group.name}
            </h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {t.orderCount === 1 ? tr('1 ordine') : tr('{n} ordini', { n: t.orderCount })} ·{' '}
              {formatPrice(t.total)}
              {' · '}
              <span className={`pill ${s.settled ? 'chiuso' : 'aperto'}`}>
                {s.settled ? tr('Pagato') : tr('da pagare {importo}', { importo: formatPrice(s.remaining) })}
              </span>
            </p>
          </div>
          <button className="btn ghost small" onClick={onClose} aria-label={tr('Chiudi')}>✕</button>
        </div>

        {error && <div className="banner" style={{ marginTop: 10 }}>{error}</div>}

        {/* Composizione del contenitore: sottogruppi cliccabili */}
        {isContainer && (
          <div style={{ marginTop: 12 }}>
            <div className="muted small">{tr('Composto da:')}</div>
            <div className="chips-row" style={{ marginTop: 4 }}>
              {node.childGroups.map((c) => {
                const ct = groupTotal(c)
                const cs = groupSettlement(c)
                return (
                  <button key={c.group.id} className="chip" onClick={() => setCurrentId(c.group.id)}>
                    {c.group.kind === 'customer' ? <IconPersona /> : <IconGruppo />} {c.group.name} · {formatPrice(ct.total)}
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
            {isContainer ? tr('Tutti gli ordini del gruppo') : tr('Ordini')}
          </div>
          {aggregated.length === 0 && <div className="muted small">{tr('Nessun ordine.')}</div>}
          {aggregated.map((o) => (
            <div className="row between" key={o.id} style={{ padding: '4px 0' }}>
              <span>
                #{o.daily_number ?? '—'} {o.customer_name ? `· ${o.customer_name}` : ''}{' '}
                {workflowOn && (
                  <span className="muted small">
                    <Icona nome={STATUS_ICONA[o.workflow_status]} gruppo="tasti" /> {statoAlBanco(o.workflow_status, o.service_mode)}
                  </span>
                )}
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
            <div className="card" style={{ marginTop: 14, background: 'color-mix(in srgb, var(--btn) 6%, transparent)' }}>
              <div className="row between">
                <strong>{tr('Conto: {importo}', { importo: formatPrice(s.remaining) })}</strong>
                <span className="muted small">{tr('{n} da pagare', { n: ids.length })}</span>
              </div>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <button className="btn" disabled={paying} onClick={() => pay(ids, null, 'banco')}>
                  <Icona nome="contanti" gruppo="tasti" /> {tr('Contanti')}
                </button>
                {/* Carta col POS esterno: si registra qui, altrimenti finiva
                    nei contanti e la chiusura di cassa non tornava. */}
                <button className="btn" disabled={paying} onClick={() => pay(ids, null, 'carta')}>
                  <Icona nome="carta" gruppo="tasti" /> {tr('Carta')}
                </button>
                <button
                  className="btn secondary"
                  disabled={paying}
                  onClick={() => { setSplitN(defaultN); setShowSplit((v) => !v); setPerOrder(false) }}
                >
                  <Icona nome="dividi_in_parti" gruppo="tasti" /> {tr('Dividi')}
                </button>
                {/* SOLO CON SUMUP (BUG-133): c'erano con qualsiasi
                    licenza, e su un piano senza il modulo chiamavano le
                    Functions lo stesso. */}
                {sumupAttivo(impostazioni) && (
                  <>
                    <button className="btn secondary" disabled={paying} onClick={payOnline}>
                      <Icona nome="carta" gruppo="tasti" /> {tr('Online')}
                    </button>
                    <button className="btn secondary" disabled={paying} onClick={payReader}>
                      <Icona nome="lettore" gruppo="tasti" /> {tr('Lettore')}
                    </button>
                  </>
                )}
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
                  {tr('Paga per singolo ordine')}
                </button>
              )}

              {showSplit && (
                <div style={{ marginTop: 10 }}>
                  <div className="row between" style={{ alignItems: 'center' }}>
                    <span className="muted small">{tr('Dividi per')}</span>
                    <span className="persons-counter">
                      <button onClick={() => setSplitN((n) => Math.max(2, n - 1))}>−</button>
                      <strong>{splitN}</strong>
                      <button onClick={() => setSplitN((n) => n + 1)}>+</button>
                    </span>
                  </div>
                  <p className="muted small" style={{ margin: '6px 0' }}>
                    {tr('{n} quote da {importo} (l’ultima {ultima})', {
                      n: splitN,
                      importo: formatPrice(splitAmounts(s.remaining, splitN)[0]),
                      ultima: formatPrice(splitAmounts(s.remaining, splitN).at(-1)),
                    })}
                  </p>
                  <div className="grid-2">
                    <button
                      className="btn"
                      disabled={paying}
                      onClick={() => pay(ids, { count: splitN }, 'banco')}
                    >
                      <Icona nome="contanti" gruppo="tasti" />{' '}{tr('{n} quote', { n: splitN })}
                    </button>
                    <button
                      className="btn"
                      disabled={paying}
                      onClick={() => pay(ids, { count: splitN }, 'carta')}
                    >
                      <Icona nome="carta" gruppo="tasti" />{' '}{tr('{n} quote', { n: splitN })}
                    </button>
                  </div>
                </div>
              )}

              {perOrder && (
                <div style={{ marginTop: 10 }}>
                  {unpaid.map((o) => (
                    <div className="row between" key={o.id} style={{ padding: '4px 0' }}>
                      <span>#{o.daily_number} · {formatPrice(o.total)}</span>
                      <span className="row" style={{ gap: 6 }}>
                        <button
                          className="btn ghost small"
                          disabled={paying}
                          onClick={() => pay([o.id], null, 'banco')}
                          aria-label={tr('Incassa #{n} in contanti', { n: o.daily_number ?? '' })}
                          title={tr('Contanti')}
                        >
                          <Icona nome="contanti" gruppo="tasti" />
                        </button>
                        <button
                          className="btn ghost small"
                          disabled={paying}
                          onClick={() => pay([o.id], null, 'carta')}
                          aria-label={tr('Incassa #{n} con carta', { n: o.daily_number ?? '' })}
                          title={tr('Carta')}
                        >
                          <Icona nome="carta" gruppo="tasti" />
                        </button>
                      </span>
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
                title={aggregated.length > 0 && !isContainer ? tr('Il gruppo ha ordini diretti: non può diventare contenitore') : ''}
                onClick={() => setPicking(true)}
              >
                <Icona nome="aggiungi" gruppo="tasti" /> {tr('Aggiungi un gruppo')}
              </button>
            ) : (
              <div>
                <div className="muted small" style={{ marginBottom: 4 }}>{tr('Aggiungi al gruppo:')}</div>
                {candidates.length === 0 && <div className="muted small">{tr('Nessun gruppo disponibile.')}</div>}
                <div className="chips-row">
                  {candidates.map((g) => (
                    <button key={g.id} className="chip" onClick={() => doNest(g.id)}>
                      {g.kind === 'customer' ? <IconPersona /> : <IconGruppo />} {g.name}
                    </button>
                  ))}
                </div>
                <button className="btn ghost small" style={{ marginTop: 6 }} onClick={() => setPicking(false)}>
                  {tr('Annulla')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sgancia il sottogruppo corrente dal padre */}
        {node.group.parent_group_id && (
          <button className="btn ghost small block" style={{ marginTop: 10 }} onClick={() => doUnnest(node.group.id)}>
            {tr('Sgancia dal gruppo padre')}
          </button>
        )}

        <div className="grid-2" style={{ marginTop: 14 }}>
          <button className="btn ghost" onClick={doRename}><Icona nome="modifica" gruppo="tasti" /> {tr('Rinomina')}</button>
          {!isContainer && (
            <button className="btn" onClick={() => navigate(`/pos?group=${node.group.id}`)}>
              <Icona nome="nuovo-ordine" gruppo="tasti" /> {tr('Nuovo ordine')}
            </button>
          )}
        </div>

        {/* Chiusura/eliminazione del gruppo */}
        <div className="grid-2" style={{ marginTop: 8 }}>
          <button className="btn ghost small" onClick={() => setConfirm('close')}>
            <Icona nome="cartella" gruppo="tasti" /> {tr('Chiudi gruppo')}
          </button>
          <button className="btn ghost small" onClick={() => setConfirm('delete')}>
            <Icona nome="elimina" gruppo="tasti" /> {tr('Elimina gruppo')}
          </button>
        </div>
      </div>

      {confirm === 'close' && (
        <ConfirmDialog
          icona="cartella"
          title={tr('Chiudere il gruppo?')}
          message={[
            tr('“{nome}” verrà archiviato e sparirà dai gruppi aperti.', { nome: node.group.name }),
            s.remaining > 0
              ? tr('Attenzione: restano {importo} da incassare.', { importo: formatPrice(s.remaining) })
              : null,
            tr('Gli ordini restano dove sono.'),
          ]
            .filter(Boolean)
            .join(' ')}
          confirmLabel={tr('Chiudi gruppo')}
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
          icona="elimina"
          title={tr('Eliminare il gruppo?')}
          message={[
            tr('“{nome}” verrà eliminato.', { nome: node.group.name }),
            aggregated.length
              ? tr('Gli ordini ({n}) restano ma senza etichetta di gruppo.', { n: aggregated.length })
              : tr('Gli ordini restano ma senza etichetta di gruppo.'),
            node.childGroups.length ? tr('I sottogruppi tornano indipendenti.') : null,
          ]
            .filter(Boolean)
            .join(' ')}
          confirmLabel={tr('Elimina gruppo')}
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
