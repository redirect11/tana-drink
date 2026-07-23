import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  advanceComanda,
  addComanda,
  bartenderUpdateComanda,
  updateOrderInfo,
  cancelOrder,
  closePaidOrder,
  createOrder,
  subscribeOpenGroups,
  fetchRecentDrinkIds,
  subscribeOrder,
  subscribeSettings,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { submitPosOrder } from '../lib/pendingOrders.js'
import { useDraft, loadLayout, saveLayout } from '../lib/useDraft.js'
import { useResizable } from '../lib/useResizable.js'
import { auth } from '../lib/firebaseClient.js'
import { onAuthStateChanged } from 'firebase/auth'
import { useMenu } from '../lib/menuCache.js'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_EMOJI,
  ritiratoLabel,
  formatPrice,
  placedByName,
} from '../lib/orderStatus.js'
import {
  nextComandaStatus,
  activeComanda,
  orderIsClosed,
  comandaEditable,
  ORDER_OPEN,
} from '../lib/comande.js'
import { paidAmount } from '../lib/pagamento.js'
import {
  makeLineId,
  mergeLines,
  splitLine,
  hasMergeable,
  lineSignature,
  moveLine,
  reconcileLayout,
  qtyByDrink as draftQtyByDrink,
} from '../lib/orderLines.js'
import { toastSync, toastSuccess, toastError } from '../lib/toast.js'
import { printComanda, printScontrino } from '../lib/printer.js'
import PosProductPicker from './PosProductPicker.jsx'
import CustomDrinkForm from './CustomDrinkForm.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import PaymentScreen from './PaymentScreen.jsx'

// ── Schermata UNICA POS creazione/modifica ordine (stile SumUp) ───────────
// UN SOLO componente: con `order` è la MODIFICA di un ordine esistente,
// senza `order` (null) è la CREAZIONE. Layout e gesti identici.
//
// A destra c'è UNA SOLA lista di item: quelli già confermati (dalle
// comande) e quelli non ancora confermati (BOZZA), senza separazione
// visiva. Tutti gli item sono spostabili col drag (tieni premuto). La
// BOZZA è persistita in localStorage per contesto ('new' in creazione,
// id ordine in modifica): non si perde uscendo, si riprende dov'era —
// finché l'ordine non è confermato/pagato.
//
// Rimozione: gli item NON confermati e quelli confermati ma ancora IN
// PREPARAZIONE si possono togliere; pronti/serviti/pagati no.
//
// Conferma (nel footer, vicino a Pagamento): le aggiunte confluiscono
// nella comanda in preparazione (se c'è) — una NUOVA comanda si crea solo
// se l'ordine è già pronto/servito. Poi si torna alla coda.

export default function OrderPosDetail({ order = null }) {
  const isNew = !order
  const navigate = useNavigate()
  const { drinks, cats, loading } = useMenu()
  const [error, setError] = useState(null)
  const [showCustom, setShowCustom] = useState(false)
  const [editLine, setEditLine] = useState(null) // riga bozza in modifica (editor)
  const [showComande, setShowComande] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false) // uscita con item non confermati
  const [showPayment, setShowPayment] = useState(false)
  const [askName, setAskName] = useState(false) // modale nome (creazione)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])

  // CONTO DI GRUPPO (solo in creazione): si arriva qui da /pos?group=<id>
  // toccando un gruppo nel drawer o nella coda. L'ordine nasce già dentro
  // quel conto, così il gruppo si paga tutto insieme.
  const [params] = useSearchParams()
  const groupParam = isNew ? params.get('group') || '' : ''
  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState(groupParam)
  const [pickGroup, setPickGroup] = useState(false)
  useEffect(() => setGroupId(groupParam), [groupParam])
  const groupsOn = isNew && settings.groups_enabled
  useEffect(() => {
    if (!groupsOn) return
    return subscribeOpenGroups(setGroups, () => setGroups([]))
  }, [groupsOn])
  const group = groups.find((g) => g.id === groupId) || null
  // Un gruppo contenitore non può ricevere ordini diretti: si sceglie fra
  // i soli gruppi "foglia".
  const groupChoices = groups.filter((g) => !g.has_child_groups)
  // Un gruppo che contiene sottogruppi non può avere ordini diretti: si
  // ordina in uno dei suoi sottogruppi (lo impedisce anche createOrder).
  const groupIsContainer = !!group?.has_child_groups

  // AGGIUNTE in composizione (BOZZA persistente). In creazione la chiave
  // tiene conto del gruppo: bozze di gruppi diversi non si mescolano.
  const draftKey = order ? order.id : groupParam ? `new:${groupParam}` : 'new'
  const [draft, setDraft, clearDraft] = useDraft(draftKey)

  // Colonne POS ridimensionabili (larghezze ricordate per dispositivo).
  const catsRz = useResizable('pos-cats', { def: 150, min: 96, max: 320, side: 'right' })
  // Recenti per la griglia POS: gli ultimi item ordinati (best-effort).
  const [recentIds, setRecentIds] = useState([])
  useEffect(() => {
    fetchRecentDrinkIds(20).then(setRecentIds).catch(() => setRecentIds([]))
  }, [])
  const comandaRz = useResizable('pos-comanda', { def: 360, min: 300, max: 620, side: 'left' })

  // Staff loggato (per l'attribuzione dell'ordine creato dal POS).
  const [staff, setStaff] = useState(null)
  useEffect(() => {
    if (!isNew) return
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return setStaff(null)
      try {
        const token = await u.getIdTokenResult()
        const role = token.claims.role
        if (role === 'bartender' || role === 'staff') {
          setStaff({ email: u.email, name: u.displayName || u.email, role })
        }
      } catch {
        setStaff(null)
      }
    })
  }, [isNew])

  // PAGAMENTO DIRETTO (creazione): la schermata si apre subito su un ordine
  // locale; la creazione gira in background (resolveOrderId).
  const [payOrder, setPayOrder] = useState(null)
  const payIdRef = useRef(null)
  const payOrderId = payOrder?.id
  useEffect(() => {
    if (!payOrderId) return
    return subscribeOrder(payOrderId, (o) => o && setPayOrder(o), () => {})
  }, [payOrderId])

  // POS a tutto schermo, come la cassa.
  useEffect(() => {
    document.body.classList.add('fullbleed')
    return () => document.body.classList.remove('fullbleed')
  }, [])

  // Quando si aggiunge un item, si porta la lista sulla riga toccata e la si
  // evidenzia un attimo: con la lista lunga, altrimenti, non si vede se è
  // stato inserito davvero.
  const listRef = useRef(null)
  const infoRef = useRef(null)
  const flashTimer = useRef(null)
  const [flashKey, setFlashKey] = useState(null)
  const scrollToLine = useCallback((key) => {
    setFlashKey(key)
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector(`[data-line-key="${key}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashKey(null), 750)
  }, [])
  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const closed = isNew ? false : orderIsClosed(order)
  const comande = useMemo(() => (isNew ? [] : order.comande || []), [isNew, order])

  // ── Diminuzioni OTTIMISTICHE sulle comande modificabili (modifica) ──
  const [pendingEdits, setPendingEdits] = useState({}) // comandaId -> items
  const flushTimers = useRef({})
  const latestPending = useRef({})
  latestPending.current = pendingEdits

  const flushComanda = useCallback(async (comandaId) => {
    clearTimeout(flushTimers.current[comandaId])
    delete flushTimers.current[comandaId]
    const items = latestPending.current[comandaId]
    if (!items) return
    try {
      await bartenderUpdateComanda(order.id, comandaId, { items })
      setPendingEdits((p) => (p[comandaId] === items ? omit(p, comandaId) : p))
    } catch (e) {
      setError(e.message)
      setPendingEdits((p) => omit(p, comandaId))
    }
  }, [order?.id])

  const flushAll = useCallback(async () => {
    await Promise.all(Object.keys(latestPending.current).map((id) => flushComanda(id)))
  }, [flushComanda])

  useEffect(() => {
    const timers = flushTimers.current
    return () => Object.values(timers).forEach(clearTimeout)
  }, [])

  // ── Avanzamenti di stato OTTIMISTICI (modifica) ──
  const [statusOverrides, setStatusOverrides] = useState({})
  const advance = (comandaId, ns) => {
    setStatusOverrides((o) => ({ ...o, [comandaId]: ns }))
    ;(async () => {
      try {
        await flushAll()
        await advanceComanda(order.id, comandaId, ns)
        // L'override NON si toglie qui: la scrittura risponde prima che
        // arrivi lo snapshot, e toglierlo subito farebbe riapparire per un
        // istante lo stato precedente. Lo toglie l'effetto sotto.
      } catch (e) {
        setError(e.message)
        setStatusOverrides((o) => omit(o, comandaId))
      }
    })()
  }

  // Allineamento col server: l'override sparisce quando la comanda arriva
  // davvero con lo stato atteso.
  useEffect(() => {
    setStatusOverrides((o) => {
      if (Object.keys(o).length === 0) return o
      const next = { ...o }
      let changed = false
      for (const c of comande) {
        if (next[c.id] && c.status === next[c.id]) {
          delete next[c.id]
          changed = true
        }
      }
      return changed ? next : o
    })
  }, [comande])

  // Comande "effettive": server + override locali in volo.
  const effComande = useMemo(
    () =>
      comande.map((c) => {
        let x = pendingEdits[c.id] ? { ...c, items: pendingEdits[c.id] } : c
        if (statusOverrides[c.id]) x = { ...x, status: statusOverrides[c.id] }
        return x
      }),
    [comande, pendingEdits, statusOverrides]
  )

  // ── LISTA UNICA: item confermati (per-riga, dalle comande) + bozza ──
  const confirmedLines = useMemo(() => {
    const out = []
    for (const c of effComande) {
      if (c.status === ORDER_STATUSES.ANNULLATO) continue
      ;(c.items || []).forEach((it, idx) => {
        out.push({
          key: `c:${c.id}:${idx}`,
          source: 'comanda',
          comandaId: c.id,
          itemIndex: idx,
          status: c.status,
          removable: comandaEditable(c),
          drink_id: it.drink_id,
          name: it.name,
          unit_price: it.unit_price,
          qty: it.qty,
          custom: it.custom,
          recipe_items: it.recipe_items,
        })
      })
    }
    return out
  }, [effComande])

  const draftLines = useMemo(
    () => draft.map((l) => ({ ...l, key: `d:${l.line_id}`, source: 'draft', status: 'draft', removable: true })),
    [draft]
  )

  const allByKey = useMemo(() => {
    const m = new Map()
    for (const l of confirmedLines) m.set(l.key, l)
    for (const l of draftLines) m.set(l.key, l)
    return m
  }, [confirmedLines, draftLines])
  const naturalKeys = useMemo(
    () => [...confirmedLines.map((l) => l.key), ...draftLines.map((l) => l.key)],
    [confirmedLines, draftLines]
  )
  const naturalSig = naturalKeys.join('|')

  // Ordine di visualizzazione: riordino a mano di TUTTI gli item, persistito
  // per contesto così sopravvive sia agli update dal server sia all'uscita
  // dalla schermata.
  const [layout, setLayout] = useState(() => loadLayout(draftKey))
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  useEffect(() => {
    setLayout((prev) => reconcileLayout(prev, naturalSig ? naturalSig.split('|') : []))
  }, [naturalSig])
  useEffect(() => {
    saveLayout(draftKey, layout)
  }, [draftKey, layout])
  const orderedLines = useMemo(
    () => layout.map((k) => allByKey.get(k)).filter(Boolean),
    [layout, allByKey]
  )

  // Memoria bozza solo finché non confermato/pagato: se l'ordine è chiuso
  // (pagato/annullato) si azzera.
  useEffect(() => {
    if (closed) clearDraft()
  }, [closed, clearDraft])

  const draftCount = draft.reduce((s, i) => s + i.qty, 0)
  const draftTotal = draft.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const confirmedTotal = confirmedLines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const qtyByDrink = useMemo(() => {
    const m = {}
    for (const l of confirmedLines) if (!l.custom) m[l.drink_id] = (m[l.drink_id] || 0) + l.qty
    const d = draftQtyByDrink(draft)
    for (const k of Object.keys(d)) m[k] = (m[k] || 0) + d[k]
    return m
  }, [confirmedLines, draft])

  // + dalla griglia/catalogo o da una riga → riga di bozza (o somma se
  // default 'uniti').
  const plusFromCatalog = (d) => {
    if (closed) return
    const nuova = {
      line_id: makeLineId(),
      drink_id: d.id,
      name: d.name,
      unit_price: d.price,
      sumup_product_id: d.sumup_product_id ?? null,
      qty: 1,
    }
    // Riga che verrà toccata: quella esistente se si accorpa, altrimenti la nuova.
    let targetLineId = nuova.line_id
    if (settings.order_group_default === 'uniti') {
      const sig = lineSignature(nuova)
      const existing = draft.find((l) => lineSignature(l) === sig)
      if (existing) targetLineId = existing.line_id
    }
    setDraft((items) => {
      if (settings.order_group_default === 'uniti') {
        const sig = lineSignature(nuova)
        const idx = items.findIndex((l) => lineSignature(l) === sig)
        if (idx >= 0) return items.map((l, j) => (j === idx ? { ...l, qty: l.qty + 1 } : l))
      }
      return [...items, nuova]
    })
    scrollToLine(`d:${targetLineId}`)
  }

  // − dalla griglia: toglie dall'ultima riga di bozza; se non c'è, scala la
  // prima riga confermata modificabile (in preparazione) di quel drink.
  function minusFromCatalog(drinkId) {
    if (closed) return
    const idx = [...draft].reverse().findIndex((l) => !l.custom && l.drink_id === drinkId)
    if (idx >= 0) {
      const realIdx = draft.length - 1 - idx
      setDraft((items) =>
        items
          .map((l, j) => (j === realIdx ? { ...l, qty: l.qty - 1 } : l))
          .filter((l) => l.qty > 0)
      )
      return
    }
    if (isNew) return
    const line = confirmedLines.find((l) => l.removable && l.drink_id === drinkId && l.qty > 0)
    if (line) reduceComandaLine(line.comandaId, line.itemIndex)
  }

  const setDraftLineQty = (lineId, qty) =>
    setDraft((items) => items.map((l) => (l.line_id === lineId ? { ...l, qty } : l)).filter((l) => l.qty > 0))

  // Scala di 1 una specifica riga di una comanda modificabile (annulla un
  // item confermato ma ancora in preparazione), con sync debounced.
  function reduceComandaLine(comandaId, itemIndex) {
    if (closed) return
    const c = effComande.find((x) => x.id === comandaId)
    if (!c) return
    const items = (c.items || [])
      .map((it, j) => (j === itemIndex ? { ...it, qty: it.qty - 1 } : it))
      .filter((it) => it.qty > 0)
    setPendingEdits((p) => ({ ...p, [comandaId]: items }))
    clearTimeout(flushTimers.current[comandaId])
    flushTimers.current[comandaId] = setTimeout(() => flushComanda(comandaId), 600)
  }

  // − su una qualsiasi riga della lista, secondo lo stato.
  const minusRow = (l) => {
    if (closed) return
    if (l.source === 'draft') setDraftLineQty(l.line_id, l.qty - 1)
    else if (l.removable) reduceComandaLine(l.comandaId, l.itemIndex)
  }
  const plusRow = (l) =>
    plusFromCatalog({ id: l.drink_id, name: l.name, price: l.unit_price, sumup_product_id: l.sumup_product_id })

  async function printDraftComanda() {
    if (draft.length === 0) return
    const printableOrder = isNew
      ? {
          customer_name: info.customer_name.trim() || null,
          table_label: info.table_label || null,
          note: info.note || null,
          daily_number: null,
        }
      : order
    try {
      await printComanda(printableOrder, { items: draft.map((l) => ({ name: l.name, qty: l.qty })) })
      toastSuccess('Comanda stampata')
    } catch (e) {
      setError(`Stampa: ${e.message}`)
    }
  }

  // ── Riordino della lista per DRAG (tieni premuto e trascina) ──
  // Tutti gli item sono spostabili. Il riordino delle righe di bozza viene
  // reso persistente (allineo l'array bozza all'ordine visivo).
  const [dragIndex, setDragIndex] = useState(null)
  const dragRef = useRef({ timer: null, startY: 0 })
  const startDrag = (e, index) => {
    if (closed) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ok */ }
    dragRef.current.startY = e.clientY
    clearTimeout(dragRef.current.timer)
    dragRef.current.timer = setTimeout(() => setDragIndex(index), 300)
  }
  const moveDrag = (e) => {
    if (dragIndex == null) {
      if (Math.abs(e.clientY - dragRef.current.startY) > 8) clearTimeout(dragRef.current.timer)
      return
    }
    e.preventDefault()
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const target = el?.closest('[data-line-index]')
    if (!target) return
    const to = Number(target.dataset.lineIndex)
    if (Number.isInteger(to) && to !== dragIndex) {
      setLayout((lay) => moveLine(lay, dragIndex, to))
      setDragIndex(to)
    }
  }
  const endDrag = () => {
    clearTimeout(dragRef.current.timer)
    if (dragIndex != null) syncDraftOrder()
    setDragIndex(null)
  }
  // Allinea l'ordine della bozza (persistito) alla sequenza visiva corrente.
  const syncDraftOrder = () => {
    const draftIds = layoutRef.current.filter((k) => k.startsWith('d:')).map((k) => k.slice(2))
    setDraft((cur) => {
      const byId = new Map(cur.map((l) => [l.line_id, l]))
      const next = draftIds.map((id) => byId.get(id)).filter(Boolean)
      return next.length === cur.length ? next : cur
    })
  }

  const mergeDraft = () => setDraft((items) => mergeLines(items))
  const splitAllDraft = () =>
    setDraft((items) => items.reduce((acc, l) => acc.concat(splitLine([l], l.line_id)), []))
  const canMerge = hasMergeable(draft)
  const canSplit = !canMerge && draft.some((l) => l.qty > 1)
  const applyEdit = ({ name, price, recipe_items }) => {
    setDraft((items) =>
      items.map((l) =>
        l.line_id === editLine.line_id
          ? {
              ...l,
              name,
              unit_price: price,
              custom: true,
              // Sempre un array: una ricetta SVUOTATA a mano è una scelta,
              // non va riletta dal prodotto di catalogo al prossimo giro.
              recipe_items: recipe_items || [],
            }
          : l
      )
    )
    setEditLine(null)
  }

  // Dati di partenza dell'editor per-item: se la riga è già stata
  // personalizzata si riprende la sua ricetta, altrimenti si carica quella
  // del prodotto di catalogo — così gli ingredienti si possono sostituire
  // o togliere, non solo aggiungere.
  const editInitial = useMemo(() => {
    if (!editLine) return null
    const base = drinks.find((d) => d.id === editLine.drink_id)
    const recipe = editLine.custom
      ? editLine.recipe_items || []
      : base?.recipe_items || []
    return { name: editLine.name, price: editLine.unit_price, recipe_items: recipe }
  }, [editLine, drinks])

  // Righe di bozza → item per createOrder/submitPosOrder (usano `price`).
  const draftToItems = () =>
    draft.map((l) => ({
      drink_id: l.drink_id,
      name: l.name,
      price: l.unit_price,
      qty: l.qty,
      ...(l.custom ? { custom: true } : {}),
      ...(l.recipe_items ? { recipe_items: l.recipe_items } : {}),
    }))

  const placedBy = () =>
    staff ? { email: staff.email, name: staff.name, role: staff.role } : undefined

  // Senza gestione della preparazione non c'è nulla da far avanzare:
  // l'ordine nasce "ricevuto" e da lì si chiude col pagamento.
  const workflowOn = settings.workflow_enabled !== false
  const statoIniziale = workflowOn ? ORDER_STATUSES.IN_PREPARAZIONE : ORDER_STATUSES.RICEVUTO
  // Il POS eredita la modalità di consegna del locale (se non è "sceglie
  // il cliente"), così l'ordine sa se sarà servito o ritirato.
  const modoConsegna =
    settings.service_mode === 'tavolo' || settings.service_mode === 'banco'
      ? settings.service_mode
      : null

  // CONFERMA. Creazione: chiede il nome, poi crea l'ordine. Modifica: le
  // aggiunte confluiscono nella comanda in preparazione; una NUOVA comanda
  // si crea solo se l'ordine è già pronto/servito. Poi torna in coda.
  const confirmDraft = () => {
    if (draft.length === 0) return
    if (isNew) return setAskName(true)
    const additions = draft
    const target = effComande.find(comandaEditable) // comanda ricevuta/in prep.
    clearDraft()
    const toastId = toastSync('Sincronizzo le aggiunte…')
    ;(async () => {
      try {
        await flushAll()
        if (target) {
          await bartenderUpdateComanda(order.id, target.id, {
            items: [...(target.items || []), ...additions],
          })
        } else {
          await addComanda(order.id, additions)
        }
        toastSuccess('Aggiunte sincronizzate', { id: toastId })
      } catch (e) {
        toastError(`Aggiunte non inviate: ${e.message}`, { id: toastId })
      }
    })()
    navigate('/bar')
  }

  const submitNew = (name) => {
    setAskName(false)
    submitPosOrder({
      table_label: info.table_label || null,
      note: info.note || null,
      customer_name: (name || '').trim() || null,
      items: draftToItems(),
      placed_by: placedBy(),
      printNow: false,
      status: statoIniziale,
      service_mode: modoConsegna,
      group_id: group && !groupIsContainer ? group.id : null,
      group_name_snapshot: group && !groupIsContainer ? group.name : null,
    })
    clearDraft()
    setInfo({ customer_name: '', table_label: '', note: '' })
    navigate('/bar')
  }

  function handlePayNow() {
    if (draft.length === 0 || payOrder) return
    setError(null)
    const items = draftToItems()
    const mapped = items.map((i) => ({
      drink_id: i.drink_id,
      name: i.name,
      unit_price: i.price,
      qty: i.qty,
      ...(i.custom ? { custom: true } : {}),
    }))
    setPayOrder({
      id: null,
      daily_number: null,
      status: 'aperto',
      payment_status: 'non_richiesto',
      customer_name: info.customer_name.trim() || null,
      table_label: info.table_label || null,
      total: draftTotal,
      discount: null,
      discount_amount: 0,
      payments: [],
      lottery_code: null,
      invoice_number: null,
      comande: [{ id: 'c1', seq: 1, status: statoIniziale, items: mapped }],
      order_items: mapped,
    })
    payIdRef.current = (async () => {
      const created = await createOrder({
        table_label: info.table_label || null,
        note: info.note || null,
        customer_name: info.customer_name.trim() || null,
        items,
        placed_by: placedBy(),
        status: statoIniziale,
        service_mode: modoConsegna,
        group_id: group && !groupIsContainer ? group.id : null,
        group_name_snapshot: group && !groupIsContainer ? group.name : null,
      })
      setPayOrder((cur) => (cur && cur.id === null ? created : cur))
      clearDraft()
      setInfo({ customer_name: '', table_label: '', note: '' })
      return created.id
    })()
    payIdRef.current.catch((e) => {
      toastError(`Ordine non creato: ${e.message}`)
      setPayOrder(null) // la bozza è intatta: si riprova
      payIdRef.current = null
    })
  }

  // ── Comanda attiva: azione rapida di avanzamento (modifica) ──
  const active = activeComanda({ comande: effComande })
  const activeNext = active ? nextComandaStatus(active.status) : null

  // ── Info conto ──
  const [info, setInfo] = useState({
    customer_name: order?.customer_name || '',
    table_label: order?.table_label || '',
    note: order?.note || '',
  })
  const [showInfo, setShowInfo] = useState(false)
  // Aprendo i "dati conto" si scorre lì: con la lista lunga altrimenti il
  // pannello si apre fuori vista e non si capisce che si è aperto.
  useEffect(() => {
    if (showInfo) {
      requestAnimationFrame(() =>
        infoRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      )
    }
  }, [showInfo])
  const orderId = order?.id
  useEffect(() => {
    if (isNew) return
    setInfo({
      customer_name: order.customer_name || '',
      table_label: order.table_label || '',
      note: order.note || '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])
  const infoDirty =
    !isNew &&
    (info.customer_name !== (order.customer_name || '') ||
      info.table_label !== (order.table_label || '') ||
      info.note !== (order.note || ''))

  const extras =
    Number(order?.coperto_amount || 0) +
    Number(order?.service_charge_amount || 0) +
    Number(order?.tip_amount || 0)

  // Uscita dalla schermata con item NON confermati: si chiede cosa farne,
  // invece di deciderlo al posto del bartender (buttarli o tenerli sono
  // entrambe risposte sensate: un conto lasciato a metà si riprende, una
  // lista dimenticata si ritrova addosso al prossimo ordine).
  const handleExit = () => {
    if (draftCount > 0) return setConfirmExit(true)
    navigate('/bar')
  }
  const exitAnd = (svuota) => {
    setConfirmExit(false)
    if (svuota) clearDraft()
    navigate('/bar')
  }

  const headTitle = isNew ? 'Nuovo ordine' : `#${order.daily_number ?? '—'}`
  const panelTitle = isNew
    ? info.customer_name.trim() || 'Nuovo ordine'
    : `#${order.daily_number ?? '—'}${order.customer_name ? ` · ${order.customer_name}` : ''}`
  const canPay = !isNew && !closed && order.payment_status !== 'pagato'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* ── Barra in alto ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          flexShrink: 0,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <button className="btn ghost small" aria-label="Torna agli ordini" onClick={handleExit}>← Ordini</button>
        <strong style={{ fontFamily: 'var(--serif)' }}>{headTitle}</strong>
        {!isNew && (() => {
          // Il pill del conto porta anche lo stato del pagamento: un conto
          // aperto può essere già saldato (in attesa di servizio) o pagato
          // in parte. Meglio un solo pill parlante che due accostati.
          // Se è già saldato, il pill NON dice "aperto": dice "Pagato". Che
          // resti da servire lo mostrano lo stato di lavorazione e il footer.
          const paid = order.payment_status === 'pagato'
          const parziale = order.payment_status === 'parziale'
          const aperto = order.status === ORDER_OPEN
          const cls = aperto && paid ? 'pagato' : order.status
          const emoji = aperto && paid ? '💳' : STATUS_EMOJI[order.status]
          const label =
            aperto && paid
              ? 'Pagato'
              : aperto && parziale
                ? `Acconto ${formatPrice(paidAmount(order))}`
                : STATUS_LABELS[order.status]
          return (
            <span className={`pill ${cls}`}>
              {emoji} {label}
            </span>
          )
        })()}
        {!isNew && order.placed_by && (
          <span className="muted small">✍️ {placedByName(order.placed_by)}</span>
        )}
        {/* Progressivo assoluto di sistema: id interno che non riparte mai
            (il #N in grande invece riparte ogni giornata). */}
        {!isNew && order.serial != null && (
          <span className="muted" style={{ fontSize: '0.7rem', opacity: 0.6 }} title="Progressivo interno dell'ordine">
            id {String(order.serial).padStart(5, '0')}
          </span>
        )}
      </div>

      {error && <div className="banner" style={{ margin: '8px 8px 0', flexShrink: 0 }}>{error}</div>}

      {/* ── Corpo a 3 colonne: categorie · griglia · ordine ── */}
      <div
        className="posd-body"
        style={{ '--pos-cats-w': `${catsRz.width}px`, '--pos-comanda-w': `${comandaRz.width}px` }}
      >
        <PosProductPicker
          drinks={drinks}
          cats={cats}
          loading={loading}
          qtyByDrink={qtyByDrink}
          categoryDisplay={settings.category_display}
          catsHandleProps={catsRz.handleProps}
          recentIds={recentIds}
          onAdd={plusFromCatalog}
          onSetQty={(d, q) => {
            const cur = qtyByDrink[d.id] ?? 0
            if (q > cur) plusFromCatalog(d)
            else if (q < cur) minusFromCatalog(d.id)
          }}
          disabled={closed}
        />

        {/* Maniglia fra griglia e pannello ordine */}
        <div className="posd-resize-handle" {...comandaRz.handleProps} />

        {/* ── Pannello destro: L'ORDINE (lista unica) ── */}
        <div className="posd-comanda">
          <div style={{ padding: '8px 12px 0', flexShrink: 0 }}>
            <div className="row between" style={{ alignItems: 'center' }}>
              <strong style={{ fontFamily: 'var(--serif)' }}>{panelTitle}</strong>
              <span className="row" style={{ gap: 6 }}>
                {canMerge && (
                  <button className="btn ghost small" onClick={mergeDraft}>🔗 Unisci</button>
                )}
                {canSplit && (
                  <button className="btn ghost small" onClick={splitAllDraft}>⑃ Separa</button>
                )}
                {!isNew && (
                  <button className="btn secondary small" onClick={() => setShowComande(true)}>
                    🧾 Comande ({comande.length})
                  </button>
                )}
              </span>
            </div>
            {!isNew && order.table_label && (
              <div className="muted small">🍽 Tavolo {order.table_label}</div>
            )}
            {/* Conto di gruppo. In CREAZIONE si sceglie qui (se i gruppi
                sono attivi): si deve poter associare l'ordine anche senza
                essere arrivati dal gruppo. In MODIFICA si mostra e basta. */}
            {!isNew && order.group_name_snapshot && (
              <div className="muted small" style={{ marginTop: 2 }}>
                <span className="pill small">👥 {order.group_name_snapshot}</span>
              </div>
            )}
            {groupsOn && (
              <div className="row between" style={{ alignItems: 'center', marginTop: 2 }}>
                {group && !groupIsContainer ? (
                  <span className="pill small">👥 {group.name}</span>
                ) : (
                  <span className="muted small">Nessun gruppo</span>
                )}
                <span className="row" style={{ gap: 6 }}>
                  <button className="btn ghost small" onClick={() => setPickGroup(true)}>
                    👥 {group ? 'Cambia' : 'Associa a gruppo'}
                  </button>
                  {group && (
                    <button className="btn ghost small" onClick={() => setGroupId('')} title="Ordine senza gruppo">
                      ✕
                    </button>
                  )}
                </span>
              </div>
            )}
            {groupIsContainer && (
              <div className="banner" style={{ margin: '4px 0' }}>
                👥 “{group.name}” contiene altri gruppi: non può avere ordini
                diretti. Scegli uno dei suoi sottogruppi.
              </div>
            )}
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 12px 10px' }}>
            {orderedLines.length === 0 && (
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                Tocca i prodotti per aggiungerli all'ordine.
              </p>
            )}

            {/* Barretta aggiunte non confermate: stampa + pulisci. Non è una
                sezione a parte — gli item restano nella stessa lista sotto. */}
            {draftCount > 0 && (
              <div className="row between" style={{ alignItems: 'center', marginBottom: 2 }}>
                <span className="muted small">
                  🟡 {draftCount} non confermat{draftCount === 1 ? 'o' : 'i'} · trascina per riordinare
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <button className="btn ghost small" aria-label="Stampa comanda" onClick={printDraftComanda}>🖨</button>
                  <button className="btn ghost small" onClick={() => setConfirmDiscard(true)}>🧹 Pulisci</button>
                </span>
              </div>
            )}

            {orderedLines.map((l, idx) => {
              const isDraft = l.source === 'draft'
              const canMinus = !closed && (isDraft || l.removable)
              return (
                <div
                  className={`row between draft-line${l.key === flashKey ? ' flash-added' : ''}`}
                  key={l.key}
                  data-line-index={idx}
                  data-line-key={l.key}
                  onPointerDown={(e) => startDrag(e, idx)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  style={{
                    alignItems: 'center',
                    marginTop: 6,
                    touchAction: 'none',
                    cursor: closed ? 'default' : 'grab',
                    borderRadius: 8,
                    background: dragIndex === idx ? 'var(--tile-bg)' : 'transparent',
                    boxShadow: dragIndex === idx ? '0 4px 14px rgba(0,0,0,0.35)' : 'none',
                    opacity: dragIndex != null && dragIndex !== idx ? 0.85 : 1,
                  }}
                >
                  <span className="grow" style={{ fontSize: '0.92rem' }}>
                    {!closed && <span aria-hidden style={{ opacity: 0.4, marginRight: 4 }}>⠿</span>}
                    <span aria-hidden style={{ marginRight: 4 }} title={isDraft ? 'non confermato' : STATUS_LABELS[l.status]}>
                      {isDraft ? '🟡' : STATUS_EMOJI[l.status]}
                    </span>
                    {l.custom ? '✨ ' : ''}{l.name}
                    <span className="muted small"> · {formatPrice(l.unit_price)}</span>
                  </span>
                  <span className="row" style={{ gap: 4, alignItems: 'center' }}>
                    {isDraft && (
                      <button className="btn ghost small" aria-label={`Modifica ${l.name}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => setEditLine(l)}>✏️</button>
                    )}
                    <span className="qty" onPointerDown={(e) => e.stopPropagation()}>
                      <button aria-label="Riduci" onClick={() => minusRow(l)} disabled={!canMinus}>−</button>
                      <strong>{l.qty}</strong>
                      <button aria-label="Aumenta" onClick={() => plusRow(l)} disabled={closed}>+</button>
                    </span>
                  </span>
                </div>
              )
            })}

            {!closed && (
              <button
                className="btn ghost small block"
                style={{ marginTop: 10 }}
                onClick={() => setShowCustom(true)}
              >
                🏷 Prodotto libero
              </button>
            )}

            {/* Dati conto (nome/tavolo/note) */}
            <button className="btn ghost small block" style={{ marginTop: 10 }} onClick={() => setShowInfo((v) => !v)}>
              {showInfo ? 'Nascondi dati conto' : '👤 Dati conto (nome, tavolo, note)'}
            </button>
            {showInfo && (
              <div ref={infoRef} style={{ marginTop: 6 }}>
                <label htmlFor="pd-name">Nome</label>
                <input
                  id="pd-name"
                  value={info.customer_name}
                  disabled={closed}
                  onChange={(e) => setInfo((v) => ({ ...v, customer_name: e.target.value }))}
                />
                <div className="grid-2" style={{ marginTop: 6 }}>
                  <div>
                    <label htmlFor="pd-table">Tavolo</label>
                    <input
                      id="pd-table"
                      value={info.table_label}
                      disabled={closed}
                      onChange={(e) => setInfo((v) => ({ ...v, table_label: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="pd-note">Note</label>
                    <input
                      id="pd-note"
                      value={info.note}
                      disabled={closed}
                      onChange={(e) => setInfo((v) => ({ ...v, note: e.target.value }))}
                    />
                  </div>
                </div>
                {infoDirty && (
                  <button
                    className="btn small block"
                    style={{ marginTop: 6 }}
                    onClick={() =>
                      updateOrderInfo(order.id, info).catch((e) =>
                        toastError(`Dati conto non salvati: ${e.message}`)
                      )
                    }
                  >
                    💾 Salva dati conto
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer: avanzamento comanda + totale + CONFERMA vicino a PAGAMENTO */}
          <div
            style={{
              flexShrink: 0,
              padding: '10px 12px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {!isNew && workflowOn && active && activeNext && !closed && (
              <div className="row between" style={{ alignItems: 'center' }}>
                <span className={`pill ${active.status}`}>
                  {STATUS_EMOJI[active.status]} {STATUS_LABELS[active.status]}
                </span>
                <span className="row" style={{ gap: 6 }}>
                  {/* Conto già pagato: si può chiudere di netto senza far
                      avanzare gli stati uno per uno (si è incassato in
                      anticipo e si consegna tutto insieme). */}
                  {order.payment_status === 'pagato' && (
                    <button
                      className="btn small"
                      onClick={() =>
                        closePaidOrder(order.id).catch((e) => toastError(`Chiusura non riuscita: ${e.message}`))
                      }
                    >
                      ✅ Chiudi conto
                    </button>
                  )}
                  <button className="btn secondary small" onClick={() => advance(active.id, activeNext)}>
                    Segna “{activeNext === ORDER_STATUSES.RITIRATO ? ritiratoLabel(order.service_mode) : STATUS_LABELS[activeNext]}”
                  </button>
                </span>
              </div>
            )}

            {extras > 0 && (
              <div className="row between muted small">
                <span>Coperto/servizio/mancia</span>
                <span>{formatPrice(extras)}</span>
              </div>
            )}
            <div className="row between">
              <strong>Totale</strong>
              <strong className="price">{formatPrice(confirmedTotal + draftTotal + extras)}</strong>
            </div>
            {!isNew && ((order.discount_amount || 0) > 0 || (order.payments || []).length > 0) && (
              <div className="row between muted small">
                <span>Sconto e acconti già incassati</span>
                <span>−{formatPrice((order.discount_amount || 0) + paidAmount(order))}</span>
              </div>
            )}

            {/* Conferma le aggiunte (in fondo, vicino a Pagamento) */}
            {draftCount > 0 && (
              <button className="btn block" onClick={confirmDraft}>
                ✅ Conferma
              </button>
            )}

            {isNew ? (
              <button className="btn secondary block" disabled={draftCount === 0} onClick={handlePayNow}>
                💳 Pagamento · {formatPrice(draftTotal)}
              </button>
            ) : (
              <>
                <div className="grid-2">
                  <button
                    className="btn ghost small"
                    onClick={() => printScontrino(order).catch((e) => setError(`Stampa: ${e.message}`))}
                  >
                    🧾 Scontrino (non fiscale)
                  </button>
                  {canPay ? (
                    <button className="btn small" onClick={() => setShowPayment(true)}>
                      💳 Pagamento
                    </button>
                  ) : (
                    <span />
                  )}
                </div>

                {!closed && (
                  <button
                    className="btn ghost small block"
                    onClick={() => setConfirmCancel(true)}
                  >
                    ✖️ Annulla ordine
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Modale comande (modifica): stati, avanzamento, stampa ── */}
      {showComande && (
        <div className="overlay confirm-overlay" onClick={() => setShowComande(false)}>
          <div
            className="confirm-box"
            style={{ maxHeight: '85vh', overflowY: 'auto', width: 'min(440px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>🧾 Comande</h3>
              <button className="btn ghost small" onClick={() => setShowComande(false)}>✕ Chiudi</button>
            </div>
            {effComande.map((c) => {
              const ns = nextComandaStatus(c.status)
              return (
                <div className="card" key={c.id} style={{ margin: '10px 0 0', padding: 12 }}>
                  <div className="row between" style={{ alignItems: 'center' }}>
                    <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
                      COMANDA {c.seq}
                      {c.created_at ? ` · ${String(c.created_at).slice(11, 16)}` : ''}
                    </span>
                    <span className={`pill ${c.status}`} style={{ fontSize: '0.7rem' }}>
                      {STATUS_EMOJI[c.status]}{' '}
                      {c.status === ORDER_STATUSES.RITIRATO
                        ? ritiratoLabel(order.service_mode)
                        : STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  {(c.items || []).map((i, idx) => (
                    <div className="row between" key={idx} style={{ marginTop: 4 }}>
                      <span className="muted small">
                        {i.qty}× {i.custom ? '✨ ' : ''}{i.name}
                      </span>
                      <span className="muted small">{formatPrice(i.qty * i.unit_price)}</span>
                    </div>
                  ))}
                  <div className="grid-2" style={{ marginTop: 8, gap: 6 }}>
                    <button
                      className="btn ghost small"
                      aria-label={`Stampa comanda ${c.seq}`}
                      onClick={() => printComanda(order, c).catch((e) => setError(`Stampa: ${e.message}`))}
                    >
                      🖨 Stampa
                    </button>
                    {ns && workflowOn && !closed ? (
                      <button className="btn small" onClick={() => advance(c.id, ns)}>
                        Segna “{ns === ORDER_STATUSES.RITIRATO ? ritiratoLabel(order.service_mode) : STATUS_LABELS[ns]}”
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                </div>
              )
            })}
            {comande.length === 0 && <p className="muted small">Nessuna comanda.</p>}
          </div>
        </div>
      )}

      {showCustom && (
        <CustomDrinkForm
          onCancel={() => setShowCustom(false)}
          onAdd={({ name, price, recipe_items }) => {
            const nuova = {
              line_id: makeLineId(),
              drink_id: `custom-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
              custom: true,
              name,
              unit_price: price,
              qty: 1,
              sumup_product_id: null,
              recipe_items,
            }
            setDraft((items) => [...items, nuova])
            setShowCustom(false)
            scrollToLine(`d:${nuova.line_id}`)
          }}
        />
      )}

      {/* ── Modifica per-item di una riga di bozza ── */}
      {editLine && (
        <CustomDrinkForm
          initial={editInitial}
          warnNoRecipe={editInitial?.recipe_items.length === 0}
          onCancel={() => setEditLine(null)}
          onAdd={applyEdit}
        />
      )}

      {/* ── Modale nome del conto alla conferma (creazione) ── */}
      {askName && (
        <div className="overlay confirm-overlay" onClick={() => setAskName(false)}>
          <form
            className="confirm-box"
            role="dialog"
            aria-label="Nome del conto"
            style={{ width: 'min(360px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              submitNew(info.customer_name)
            }}
          >
            <h3 style={{ margin: 0 }}>👤 Nome del conto</h3>
            <p className="muted small" style={{ margin: '8px 0' }}>
              Vuoto = numero progressivo. Si può cambiare dopo, dai Dati conto.
            </p>
            <label htmlFor="pos-askname">Nome</label>
            <input
              id="pos-askname"
              value={info.customer_name}
              onChange={(e) => setInfo((v) => ({ ...v, customer_name: e.target.value }))}
              placeholder="Es. Marco, Tavolo 4…"
              autoFocus
            />
            <button className="btn block" type="submit" style={{ marginTop: 10 }}>
              Salva{info.customer_name.trim() ? '' : ' senza nome'}
            </button>
          </form>
        </div>
      )}

      {/* ── Schermata Pagamento ── */}
      {isNew && payOrder && (
        <PaymentScreen
          order={payOrder}
          settings={settings}
          onClose={() => setPayOrder(null)}
          onError={setError}
          resolveOrderId={() => payIdRef.current}
        />
      )}
      {!isNew && showPayment && (
        <PaymentScreen
          order={order}
          settings={settings}
          onClose={() => setShowPayment(false)}
          onBeforePay={flushAll}
          onError={setError}
        />
      )}

      {/* ── Scelta del gruppo a cui addebitare l'ordine ── */}
      {pickGroup && (
        <div className="overlay confirm-overlay" onClick={() => setPickGroup(false)}>
          <div
            className="confirm-box"
            role="dialog"
            aria-label="Scegli il gruppo"
            style={{ width: 'min(420px, 94vw)', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>👥 Conto di gruppo</h3>
              <button className="btn ghost small" onClick={() => setPickGroup(false)}>✕</button>
            </div>
            <p className="muted small" style={{ margin: '8px 0' }}>
              L’ordine entra nel conto del gruppo e si potrà pagare insieme
              agli altri.
            </p>
            <button
              className={`btn ${groupId ? 'ghost' : ''} block`}
              onClick={() => {
                setGroupId('')
                setPickGroup(false)
              }}
            >
              Nessun gruppo
            </button>
            {groupChoices.map((g) => (
              <button
                key={g.id}
                className={`btn ${groupId === g.id ? '' : 'secondary'} block`}
                style={{ marginTop: 6 }}
                onClick={() => {
                  setGroupId(g.id)
                  setPickGroup(false)
                }}
              >
                {g.kind === 'customer' ? '👤' : '🏷'} {g.name}
              </button>
            ))}
            {groupChoices.length === 0 && (
              <p className="muted small" style={{ marginTop: 8 }}>
                Nessun gruppo aperto: si creano dalla coda ordini.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Uscita con item non confermati: svuotare o tenere? ── */}
      {confirmExit && (
        <div className="overlay confirm-overlay" onClick={() => setConfirmExit(false)}>
          <div
            className="confirm-box"
            role="dialog"
            aria-label="Item non confermati"
            style={{ width: 'min(400px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0 }}>Hai {draftCount} item non confermat{draftCount === 1 ? 'o' : 'i'}</h3>
            <p className="muted small" style={{ margin: '8px 0 12px' }}>
              Non sono ancora stati {isNew ? "inviati: l'ordine non esiste" : 'aggiunti al conto'}.
              Vuoi svuotare la lista o tenerla per riprenderla dopo?
            </p>
            <button className="btn block" onClick={() => exitAnd(true)}>
              🧹 Svuota ed esci
            </button>
            <button className="btn secondary block" style={{ marginTop: 8 }} onClick={() => exitAnd(false)}>
              Tieni ed esci
            </button>
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setConfirmExit(false)}>
              Indietro
            </button>
          </div>
        </div>
      )}

      {/* ── Pulisci le aggiunte non confermate (la bozza) ── */}
      {confirmDiscard && (
        <ConfirmDialog
          title="Togliere gli item non confermati?"
          message={`${draftCount} prodott${draftCount === 1 ? 'o' : 'i'} non confermat${draftCount === 1 ? 'o' : 'i'} verranno rimossi. Gli item già confermati restano.`}
          confirmLabel="Pulisci non confermati"
          cancelLabel="Indietro"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false)
            clearDraft()
          }}
        />
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="✖️ Annullare l'ordine?"
          message={`L'ordine #${order?.daily_number ?? ''} verrà annullato e le scorte già scalate torneranno a magazzino.`}
          confirmLabel="Annulla ordine"
          cancelLabel="Indietro"
          danger
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => {
            setConfirmCancel(false)
            cancelOrder(order.id, { by: 'bartender' }).catch((e) =>
              toastError(`Annullo non riuscito: ${e.message}`)
            )
          }}
        />
      )}
    </div>
  )
}

// Copia di un oggetto senza una chiave (per rimuovere gli override flushati).
function omit(obj, key) {
  const next = { ...obj }
  delete next[key]
  return next
}
