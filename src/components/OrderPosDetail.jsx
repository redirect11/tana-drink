import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  advanceComanda,
  addComanda,
  bartenderUpdateComanda,
  updateOrderInfo,
  setOrderGroup,
  cancelOrder,
  closePaidOrder,
  createOrder,
  subscribeOpenGroups,
  fetchRecentDrinkIds,
  subscribeOrder,
  subscribeSettings,
  peekNextDailyNumber,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { useDraft, loadLayout, saveLayout, saveDraft } from '../lib/useDraft.js'
import { dismissKeyboard } from '../lib/keyboard.js'
import { useResizable } from '../lib/useResizable.js'
import { useTelefono } from '../lib/useTelefono.js'
import ZoomControl from './ZoomControl.jsx'
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
import { isPersonale } from '../lib/ruoli.js'
import {
  makeLineId,
  mergeLines,
  splitLine,
  hasMergeable,
  moveLine,
  reconcileLayout,
  qtyByDrink as draftQtyByDrink,
} from '../lib/orderLines.js'
import { toastSuccess, toastError } from '../lib/toast.js'
import { printComanda, printScontrino } from '../lib/printer.js'
import PosProductPicker from './PosProductPicker.jsx'
import { IconPrinter, IconReceipt, IconCard, IconRefresh, IconX, IconCheck, IconClose, IconGruppo, IconPersona, IconTag } from './Icons.jsx'
import CustomDrinkForm from './CustomDrinkForm.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import ActionSheet from './ActionSheet.jsx'
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
// NIENTE tasto Conferma: gli item si confermano da soli. In CREAZIONE,
// appena si aggiunge il primo item l'ordine viene CREATO (createOrder) e si
// passa alla modifica (/ordine/:id); il nome si chiede UNA sola volta
// all'uscita, se manca. In MODIFICA le aggiunte confluiscono nella comanda in
// preparazione (una NUOVA comanda solo se l'ordine è già pronto/servito).
// Dal footer si "Chiude" (torna alla coda); il pagamento resta a parte.

// Ultimo progressivo previsto, tenuto in locale: serve solo a mostrare subito
// il numero giusto invece di un segnaposto che poi cambia. Si scarta se è
// vecchio, altrimenti a inizio serata si vedrebbe il numero di ieri.
const CHIAVE_NUMERO = 'tana:prossimoNumero'
const ORE_VALIDE = 8

function numeroPrevistoInCache() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_NUMERO) || 'null')
    if (!v || !Number.isFinite(v.n)) return null
    if (Date.now() - v.at > ORE_VALIDE * 3600 * 1000) return null
    return v.n
  } catch {
    return null
  }
}

function ricordaNumeroPrevisto(n) {
  try {
    localStorage.setItem(CHIAVE_NUMERO, JSON.stringify({ n, at: Date.now() }))
  } catch {
    /* senza memoria locale si parte dal segnaposto, come prima */
  }
}

// Quando è stato aperto il conto: data breve + ora. "oggi" per la giornata in
// corso, perché scrivere la data di oggi accanto al numero è rumore.
function apertoIl(iso) {
  const t = Date.parse(iso || '')
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  const oggi = new Date()
  const stessoGiorno =
    d.getDate() === oggi.getDate() &&
    d.getMonth() === oggi.getMonth() &&
    d.getFullYear() === oggi.getFullYear()
  if (stessoGiorno) return `oggi ${ora}`
  return `${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} ${ora}`
}

export default function OrderPosDetail({ order: orderProp = null }) {
  const navigate = useNavigate()
  // Ordine auto-creato IN PLACE alla prima aggiunta (creazione): NON si naviga
  // altrove, così il layout non si ricarica. Da lì la schermata è identica alla
  // modifica (l'ordine effettivo è prop OPPURE quello appena creato).
  const [selfOrder, setSelfOrder] = useState(null)
  const order = orderProp || selfOrder
  const isNew = !order
  // Ordine appena creato in place e ancora senza nome: all'uscita lo si chiede
  // una volta (poi non più).
  const createdInPlace = !orderProp && !!selfOrder
  const nameAskedRef = useRef(false)
  const { drinks, cats, loading } = useMenu()
  const [error, setError] = useState(null)
  const [showCustom, setShowCustom] = useState(false)
  const [editLine, setEditLine] = useState(null) // riga bozza in modifica (editor)
  const [showComande, setShowComande] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  // Menu delle azioni: esiste solo sul telefono, dove i tasti non ci stanno
  // tutti in pagina senza mangiarsi le righe del conto.
  const [showAzioni, setShowAzioni] = useState(false)
  // Il menu delle azioni vale SOLO sul telefono: altrove i tasti stanno in
  // pagina, e un ⋯ in più sarebbe solo un doppione da capire.
  const telefono = useTelefono()
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
  const [groupId, setGroupId] = useState(groupParam || order?.group_id || '')
  const [pickGroup, setPickGroup] = useState(false)
  useEffect(() => setGroupId(groupParam), [groupParam])
  // Il conto passa da "nuovo" a "esistente" appena si aggiunge il primo drink:
  // legare i gruppi a `isNew` faceva sparire il tasto sotto le dita, proprio
  // mentre lo si stava per usare. I gruppi ci sono se sono ACCESI, punto.
  const groupsOn = settings.groups_enabled
  // Su un conto già creato il gruppo si scrive subito sull'ordine.
  const orderIdCorrente = order?.id
  useEffect(() => {
    if (isNew || !orderIdCorrente) return
    setGroupId(order?.group_id || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdCorrente, order?.group_id])
  const scegliGruppo = (id) => {
    setGroupId(id)
    if (!isNew && orderIdCorrente) {
      setOrderGroup(orderIdCorrente, id || null).catch((e) =>
        toastError(`Gruppo non aggiornato: ${e.message}`)
      )
    }
  }
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
  const draftRef = useRef(draft)
  draftRef.current = draft

  // Colonne POS ridimensionabili (larghezze ricordate per dispositivo).
  const catsRz = useResizable('pos-cats', { def: 168, min: 140, max: 340, side: 'right' })
  // Recenti per la griglia POS: gli ultimi item ordinati (best-effort).
  const [recentIds, setRecentIds] = useState([])
  useEffect(() => {
    fetchRecentDrinkIds(20).then(setRecentIds).catch(() => setRecentIds([]))
  }, [])
  const comandaRz = useResizable('pos-comanda', { def: 400, min: 260, max: 700, side: 'left' })
  // Scala del footer (totale + conferma/pagamento): la maniglia in cima lo
  // "allunga" e tasti/font crescono insieme. Valore in % (100 = normale).
  const footRz = useResizable('pos-foot-scale', { def: 100, min: 80, max: 175, axis: 'y', side: 'up', speed: 0.5 })
  // Allargando una colonna ne crescono anche i testi (e viceversa): la scala
  // del font segue la larghezza rispetto alla misura di riposo (def), con un
  // tetto per non esagerare. Guida i font via CSS (--cats-scale/--comanda-scale).
  const clampScale = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  // Smartphone (layout in colonna): testi più piccoli e pannello ordine
  // COLLASSABILE, altrimenti la griglia resta schiacciata.
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 899px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)')
    const h = (e) => setIsPhone(e.matches)
    mq.addEventListener?.('change', h)
    return () => mq.removeEventListener?.('change', h)
  }, [])
  // Base più grande su tablet/desktop (leggibile su iPad); su smartphone scala
  // fissa più contenuta (la colonna è comunque al 100%).
  const catsScale = isPhone ? 0.95 : clampScale(catsRz.width / 150, 1.1, 1.7)
  const comandaScale = isPhone ? 0.95 : clampScale(comandaRz.width / 340, 1.1, 1.7)

  // Pannello ordine in basso (solo smartphone): si RIMPICCIOLISCE quando si
  // lavora sulla griglia (scroll/ricerca/aggiunta) e si riapre toccandolo.
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const lastGridTouchRef = useRef(0)
  const collapsePanel = useCallback(() => {
    lastGridTouchRef.current = Date.now()
    if (window.matchMedia('(max-width: 899px)').matches) setPanelCollapsed(true)
  }, [])
  // La barra ignora i tocchi subito dopo un'interazione con la griglia: il tap
  // su una card vicino al bordo (o il "ghost click" dopo il collasso) non deve
  // riaprire il pannello da solo.
  const expandPanel = () => {
    if (Date.now() - lastGridTouchRef.current < 450) return
    setPanelCollapsed(false)
  }

  // Staff loggato (per l'attribuzione dell'ordine creato dal POS).
  const [staff, setStaff] = useState(null)
  useEffect(() => {
    if (!isNew) return
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return setStaff(null)
      try {
        const token = await u.getIdTokenResult()
        const role = token.claims.role
        if (isPersonale(role)) {
          setStaff({ email: u.email, name: u.displayName || u.email, role })
        }
      } catch {
        setStaff(null)
      }
    })
  }, [isNew])

  // Ordine auto-creato in place: lo si tiene aggiornato dal server (comande,
  // pagamenti…) senza rimontare la pagina. Si aggiorna lo stato SOLO se cambia
  // davvero (i "battiti" identici della sottoscrizione non causano re-render).
  const selfOrderId = selfOrder?.id
  const selfOrderJsonRef = useRef('')
  useEffect(() => {
    if (!selfOrderId || orderProp) return
    return subscribeOrder(selfOrderId, (o) => {
      if (!o) return
      const j = JSON.stringify(o)
      if (j === selfOrderJsonRef.current) return
      selfOrderJsonRef.current = j
      setSelfOrder(o)
    }, () => {})
  }, [selfOrderId, orderProp])

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
  const scrollKeyRef = useRef(null)
  const scrollToLine = useCallback((key) => {
    scrollKeyRef.current = key // lo scroll vero avviene nell'effetto su orderedLines
  }, [])

  // Invio su un campo dati conto: chiude la tastiera virtuale. Diretto
  // sull'input e con il rimedio Windows (readonly momentaneo), così funziona
  // su Windows, Android e iPhone/iPad.

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
      // L'override NON si toglie qui: la scrittura risponde PRIMA dello snapshot,
      // e toglierlo subito farebbe sparire+riapparire l'item nella lista (il
      // "ricaricamento" alla sync). Lo toglie l'effetto sotto, quando la comanda
      // dal server combacia davvero con l'override.
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

  // Stessa logica per gli item: l'override (aggiunte/decrementi ottimistici) si
  // toglie SOLO quando la comanda dal server combacia — così l'item non
  // sparisce+riappare (niente "ricaricamento" alla sincronizzazione).
  useEffect(() => {
    const sig = (arr) =>
      (arr || []).map((i) => `${i.drink_id}~${i.qty}~${i.unit_price}~${i.custom ? 1 : 0}`).join('|')
    setPendingEdits((p) => {
      if (Object.keys(p).length === 0) return p
      let next = p
      for (const c of comande) {
        if (p[c.id] && sig(p[c.id]) === sig(c.items)) {
          if (next === p) next = { ...p }
          delete next[c.id]
        }
      }
      return next
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
  // Riferimenti sempre aggiornati per l'auto-conferma e la conferma all'uscita.
  const effComandeRef = useRef(effComande)
  effComandeRef.current = effComande

  // ── LISTA UNICA: item confermati (per-riga, dalle comande) + bozza ──
  // Le quantità già pagate (acconti/split registrati) vengono scorporate in
  // righe "pagate" a sé, così si distinguono e si possono spostare in fondo.
  const confirmedLines = useMemo(() => {
    const remainingPaid = {}
    for (const p of order?.payments || [])
      for (const it of p.items || [])
        if (it.drink_id) remainingPaid[it.drink_id] = (remainingPaid[it.drink_id] || 0) + (Number(it.qty) || 0)
    const out = []
    for (const c of effComande) {
      if (c.status === ORDER_STATUSES.ANNULLATO) continue
      ;(c.items || []).forEach((it, idx) => {
        const base = {
          source: 'comanda',
          comandaId: c.id,
          itemIndex: idx,
          status: c.status,
          drink_id: it.drink_id,
          name: it.name,
          unit_price: it.unit_price,
          custom: it.custom,
          recipe_items: it.recipe_items,
          note: it.note || null,
        }
        const paidHere = it.drink_id ? Math.min(it.qty, remainingPaid[it.drink_id] || 0) : 0
        if (it.drink_id) remainingPaid[it.drink_id] -= paidHere
        const unpaidQty = it.qty - paidHere
        // Stessa chiave della bozza da cui viene: la riga resta LO STESSO
        // nodo e non riparte da capo (vedi draftToItems).
        const chiave = it.line_id ? `d:${it.line_id}` : `c:${c.id}:${idx}`
        if (unpaidQty > 0)
          out.push({ ...base, key: chiave, qty: unpaidQty, removable: comandaEditable(c) })
        if (paidHere > 0)
          out.push({ ...base, key: `${chiave}:paid`, qty: paidHere, removable: false, paid: true })
      })
    }
    return out
  }, [effComande, order?.payments])

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
    setLayout((prev) =>
      reconcileLayout(prev, naturalSig ? naturalSig.split('|') : [], settings.pos_add_top)
    )
  }, [naturalSig, settings.pos_add_top])
  useEffect(() => {
    saveLayout(draftKey, layout)
  }, [draftKey, layout])
  // Nasconde/mostra le righe già pagate (che stanno comunque in fondo).
  const [hidePaid, setHidePaid] = useState(false)
  const orderedLines = useMemo(() => {
    const arr = layout.map((k) => allByKey.get(k)).filter(Boolean)
    const unpaid = arr.filter((l) => !l.paid)
    const paid = arr.filter((l) => l.paid)
    return hidePaid ? unpaid : [...unpaid, ...paid]
  }, [layout, allByKey, hidePaid])
  const paidCount = useMemo(
    () => [...allByKey.values()].filter((l) => l.paid).reduce((s, l) => s + l.qty, 0),
    [allByKey]
  )

  // Scroll all'item appena aggiunto: si aggancia a orderedLines perché
  // l'aggiunta passa da più render (bozza → reconcile del layout) e la riga
  // nuova entra nel DOM solo quando orderedLines la include. Scrolla e azzera.
  useEffect(() => {
    const key = scrollKeyRef.current
    if (!key) return
    const el = listRef.current?.querySelector(`[data-line-key="${key}"]`)
    if (el) {
      // 'nearest': scorre SOLO se la riga non è già visibile, del minimo
      // indispensabile e senza animazione → niente slide involontari.
      el.scrollIntoView({ block: 'nearest' })
      scrollKeyRef.current = null
    }
  }, [orderedLines])

  // Auto-larghezza della colonna ordine: aggiungendo un item la colonna si
  // allarga (mai oltre il massimo) per far entrare il nome più lungo. Non si
  // restringe da sola, così un allargamento manuale resta.
  const measureRef = useRef(null)
  const namesSig = orderedLines.map((l) => `${l.custom ? '*' : ''}${l.name}`).join('')
  useEffect(() => {
    if (isNew || !orderedLines.length || typeof document === 'undefined') return
    const canvas = measureRef.current || (measureRef.current = document.createElement('canvas'))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const px = Math.round(16 * comandaScale * 0.88)
    ctx.font = `500 ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`
    let maxW = 0
    for (const l of orderedLines) {
      const w = ctx.measureText(`⠿ ${l.custom ? '✨ ' : ''}${l.name}  · ${formatPrice(l.unit_price)}`).width
      if (w > maxW) maxW = w
    }
    // overhead: padding lista + controlli quantità
    const needed = Math.ceil(maxW + 24 + 86)
    if (needed > comandaRz.width + 6) comandaRz.setWidth(Math.min(700, needed))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesSig])

  // Ordine appena aperto e rimasto SENZA prodotti (si aggiunge una voce e la si
  // toglie subito): si annulla da solo e si torna alla coda, senza chiedere
  // nulla — non era un conto, era un ripensamento. Vale solo per l'ordine
  // creato in questa sessione, mai per uno aperto dalla coda.
  useEffect(() => {
    // Vale per QUALSIASI conto aperto rimasto senza righe, non solo per quello
    // creato in questa sessione: uscendo e rientrando (per esempio quando si
    // chiude il box del nome) il conto non era più "creato qui", e togliendo
    // l'ultima riga restava aperto e vuoto in mezzo agli altri.
    if (isNew || closed || !order?.id) return
    if (orderedLines.length > 0 || draft.length > 0) return
    if ((order.payments || []).length > 0) return // qualcosa è già stato incassato
    const t = setTimeout(async () => {
      // PRIMA si scrive la rimozione, POI si annulla. La rimozione dell'ultima
      // riga passa da un salvataggio ritardato (600ms): l'annullo arrivava
      // prima, leggeva l'ordine con la riga ancora dentro e la riscriveva
      // così com'era. Risultato: un conto annullato che in coda mostrava
      // ancora "1 prodotto · 4,00 €" mentre dentro non aveva più niente.
      try {
        await flushAll()
      } catch {
        /* se la scrittura non riesce si annulla lo stesso: il conto va chiuso */
      }
      cancelOrder(order.id, { by: 'bartender' }).catch(() => {})
      navigate('/bar')
    }, 400) // respiro: evita di annullare durante una sostituzione di riga
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, closed, order?.id, orderedLines.length, draft.length])

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

  // MODIFICA: l'item entra DIRETTAMENTE nella comanda modificabile (modifica
  // ottimistica, chiave riga stabile) e si sincronizza in background — così NON
  // si vede la riga "ricaricarsi" (niente swap bozza→comanda). Se non c'è una
  // comanda modificabile (ordine già servito), si crea una nuova comanda.
  const addToEditableComanda = (item) => {
    const target = effComandeRef.current.find(comandaEditable)
    if (!target) {
      addComanda(order.id, [item]).catch((e) => toastError(`Aggiunta non inviata: ${e.message}`))
      return
    }
    // Dalla GRIGLIA ogni tocco è una riga a sé (due Spritz sono due righe, così
    // si possono personalizzare e annotare separatamente). Per aumentare la
    // quantità di una riga esistente si usa il + su quella riga.
    const cur = target.items || []
    const items = [...cur, item]
    const scrollIdx = items.length - 1
    setPendingEdits((p) => ({ ...p, [target.id]: items }))
    clearTimeout(flushTimers.current[target.id])
    flushTimers.current[target.id] = setTimeout(() => flushComanda(target.id), 500)
    scrollToLine(`c:${target.id}:${scrollIdx}`)
  }

  // + dalla griglia/catalogo o da una riga. In MODIFICA va dritto nella comanda;
  // in CREAZIONE finisce in bozza (poi createFromDraft crea l'ordine).
  const plusFromCatalog = (d) => {
    if (closed) return
    const base = {
      drink_id: d.id,
      name: d.name,
      unit_price: d.price,
      sumup_product_id: d.sumup_product_id ?? null,
      qty: 1,
    }
    if (!isNew) {
      addToEditableComanda(base)
      return
    }
    const nuova = { line_id: makeLineId(), ...base }
    setDraft((items) => [...items, nuova])
    scrollToLine(`d:${nuova.line_id}`)
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
  // + su una riga del conto: aumenta la quantità di QUELLA riga. È il gesto
  // opposto al tocco sulla griglia, che invece aggiunge una riga nuova.
  const plusRow = (l) => {
    if (closed || l.paid) return
    if (l.source === 'draft') {
      setDraftLineQty(l.line_id, l.qty + 1)
      return
    }
    const c = effComandeRef.current.find((x) => x.id === l.comandaId)
    if (!c || !comandaEditable(c)) return
    const items = (c.items || []).map((it, j) => (j === l.itemIndex ? { ...it, qty: it.qty + 1 } : it))
    setPendingEdits((p) => ({ ...p, [l.comandaId]: items }))
    clearTimeout(flushTimers.current[l.comandaId])
    flushTimers.current[l.comandaId] = setTimeout(() => flushComanda(l.comandaId), 600)
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
    dragRef.current.startX = e.clientX
    dragRef.current.startIndex = index
    dragRef.current.moved = false
    clearTimeout(dragRef.current.timer)
    dragRef.current.timer = setTimeout(() => setDragIndex(index), 300)
  }
  const moveDrag = (e) => {
    if (dragIndex == null) {
      const moved =
        Math.abs(e.clientY - dragRef.current.startY) > 8 ||
        Math.abs(e.clientX - dragRef.current.startX) > 8
      if (moved) {
        dragRef.current.moved = true
        clearTimeout(dragRef.current.timer)
      }
      return
    }
    e.preventDefault()
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const target = el?.closest('[data-line-index]')
    if (!target) return
    const to = Number(target.dataset.lineIndex)
    if (!Number.isInteger(to) || to === dragIndex) return
    // Non si scavalcano le righe pagate (stanno in fondo, bloccate).
    if (orderedLines[to]?.paid) return
    // Gli indici sono quelli VISIBILI (lista partizionata): traduco in indici
    // del layout tramite le chiavi, così il riordino resta corretto.
    const fromKey = orderedLines[dragIndex]?.key
    const toKey = orderedLines[to]?.key
    if (fromKey && toKey) {
      setLayout((lay) => moveLine(lay, lay.indexOf(fromKey), lay.indexOf(toKey)))
      setDragIndex(to)
    }
  }
  const endDrag = (e) => {
    clearTimeout(dragRef.current.timer)
    const wasDragging = dragIndex != null
    if (wasDragging) syncDraftOrder()
    setDragIndex(null)
    // TAP (nessun drag, nessun movimento) sull'item → apre l'editor per-riga.
    // Serve qui perché il pointer-capture del drag "mangia" il click sul figlio.
    if (!wasDragging && !dragRef.current.moved && e?.type === 'pointerup') {
      const l = orderedLines[dragRef.current.startIndex]
      if (l && !closed && (l.source === 'draft' || l.removable)) setEditLine(l)
    }
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

  // Separa/Unisci agiscono su TUTTE le voci visibili: la bozza + gli item
  // delle comande modificabili (confermati). Sui confermati si programma il
  // salvataggio come per le altre modifiche per-riga.
  const explode = (items) =>
    (items || []).flatMap((it) => {
      const q = Math.floor(Number(it.qty) || 0)
      return q > 1 ? Array.from({ length: q }, () => ({ ...it, qty: 1 })) : [it]
    })
  const transformEditableComande = (transform) => {
    for (const c of effComande) {
      if (!comandaEditable(c)) continue
      const cur = c.items || []
      const items = transform(cur)
      if (items.length === cur.length) continue // niente da unire/separare qui
      setPendingEdits((p) => ({ ...p, [c.id]: items }))
      clearTimeout(flushTimers.current[c.id])
      flushTimers.current[c.id] = setTimeout(() => flushComanda(c.id), 600)
    }
  }
  const mergeDraft = () => {
    setDraft((items) => mergeLines(items))
    transformEditableComande((items) => mergeLines(items))
  }
  const splitAllDraft = () => {
    setDraft((items) => items.reduce((acc, l) => acc.concat(splitLine([l], l.line_id)), []))
    transformEditableComande(explode)
  }
  const editableComande = effComande.filter(comandaEditable)
  // Unisci e Separa sono INDIPENDENTI: si può avere insieme una riga da 5 (da
  // separare) e due righe uguali (da unire), quindi entrambi i tasti compaiono
  // quando l'azione è possibile — prima "Separa" spariva finché c'era qualcosa
  // da unire.
  const canMerge =
    hasMergeable(draft) || editableComande.some((c) => hasMergeable(c.items || []))
  const canSplit =
    draft.some((l) => l.qty > 1) ||
    editableComande.some((c) => (c.items || []).some((i) => i.qty > 1))
  const applyEdit = ({ name, price, recipe_items, note }) => {
    const l = editLine
    setEditLine(null)
    if (!l) return
    // Ricetta SEMPRE un array: svuotarla a mano è una scelta, non va riletta
    // dal prodotto di catalogo al prossimo giro.
    const patch = { name, unit_price: price, custom: true, recipe_items: recipe_items || [], note: note || null }
    if (l.source === 'draft') {
      setDraft((items) => items.map((x) => (x.line_id === l.line_id ? { ...x, ...patch } : x)))
      return
    }
    // Item già CONFERMATO (comanda in preparazione): modifica ottimistica sulla
    // comanda + sync in background (come le diminuzioni per-riga).
    const c = effComandeRef.current.find((x) => x.id === l.comandaId)
    if (!c) return
    const items = (c.items || []).map((it, idx) => (idx === l.itemIndex ? { ...it, ...patch } : it))
    setPendingEdits((p) => ({ ...p, [l.comandaId]: items }))
    clearTimeout(flushTimers.current[l.comandaId])
    flushTimers.current[l.comandaId] = setTimeout(() => flushComanda(l.comandaId), 600)
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
    return {
      name: editLine.name,
      price: editLine.unit_price,
      recipe_items: recipe,
      note: editLine.note || '',
    }
  }, [editLine, drinks])

  // Righe di bozza → item per createOrder (usano `price`).
  // `line_id` viaggia con l'item fino al documento dell'ordine. Non serve ai
  // conti: serve a non far SALTARE la riga quando la bozza diventa item
  // confermato. Senza, la chiave React cambiava (d:… → c:…), il nodo veniva
  // ricreato e l'item appena aggiunto rifaceva il suo effetto di comparsa —
  // il "piccolo relayout" che si vedeva a ogni primo drink.
  const draftToItems = () =>
    draft.map((l) => ({
      drink_id: l.drink_id,
      name: l.name,
      price: l.unit_price,
      qty: l.qty,
      line_id: l.line_id,
      ...(l.custom ? { custom: true } : {}),
      ...(l.recipe_items ? { recipe_items: l.recipe_items } : {}),
      ...(l.note ? { note: l.note } : {}),
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

  // MODIFICA: manda al server le aggiunte in sospeso (senza navigare). Gli
  // item confluiscono nella comanda in preparazione; una NUOVA comanda si crea
  // solo se l'ordine è già pronto/servito. Usata dall'AUTO-CONFERMA (ogni
  // aggiunta è confermata subito) e all'uscita per non perdere nulla.
  const flushAdditions = useCallback(() => {
    if (isNew || !order?.id) return
    const additions = draftRef.current
    if (!additions || additions.length === 0) return
    const target = effComandeRef.current.find(comandaEditable)
    const oid = order.id
    if (target) {
      // OTTIMISTICO: gli item entrano SUBITO nella comanda (stesso render in cui
      // si svuota la bozza), così non spariscono un istante = niente flicker. Il
      // sync col server (e la pulizia dell'override) li fa flushComanda.
      const merged = [...(target.items || []), ...additions]
      setPendingEdits((p) => ({ ...p, [target.id]: merged }))
      clearDraft()
      clearTimeout(flushTimers.current[target.id])
      flushTimers.current[target.id] = setTimeout(() => flushComanda(target.id), 250)
    } else {
      // Nessuna comanda modificabile → nuova comanda (dal server).
      clearDraft()
      ;(async () => {
        try {
          await flushAll()
          await addComanda(oid, additions)
        } catch (e) {
          toastError(`Aggiunte non inviate: ${e.message}`)
        }
      })()
    }
  }, [isNew, order?.id, flushAll, clearDraft, flushComanda])

  // Auto-conferma in MODIFICA: poco dopo l'ultima aggiunta gli item vengono
  // confermati da soli (niente tasto Conferma, niente stato "non confermato"
  // che resta). In CREAZIONE resta la conferma manuale (serve nome/tavolo).
  // Il timer dipende SOLO da draft/isNew (flushAdditions via ref) così non si
  // resetta a ogni render.
  const flushAdditionsRef = useRef(flushAdditions)
  flushAdditionsRef.current = flushAdditions
  // Poco dopo l'ultima aggiunta: in MODIFICA gli item si confermano da soli;
  // in CREAZIONE l'ordine viene CREATO con la bozza e si passa alla modifica
  // (da lì le aggiunte successive si confermano al volo). Il timer si resetta a
  // ogni aggiunta, così parte solo quando la bozza è "ferma" (batch completo).
  useEffect(() => {
    if (draft.length === 0) return
    const t = setTimeout(() => {
      if (isNew) createFromDraftRef.current()
      else flushAdditionsRef.current()
    }, 300)
    return () => clearTimeout(t)
  }, [draft, isNew])

  // CREAZIONE: appena si aggiunge il primo item l'ordine viene CREATO IN PLACE
  // (setSelfOrder), SENZA navigare: la schermata resta montata e da lì si
  // continua come nella modifica (aggiunte confermate al volo). Il nome si
  // chiede solo all'uscita, se manca.
  const creatingRef = useRef(false)
  // Promise dell'ordine in creazione: chi arriva mentre la creazione è in volo
  // (es. il tasto Pagamento) deve ASPETTARE questo, non creare un secondo
  // ordine — altrimenti si ritrovano due conti con lo stesso nome/tavolo.
  const creatingPromiseRef = useRef(null)
  const createFromDraft = async () => {
    if (!isNew) return null
    if (creatingRef.current) return creatingPromiseRef.current
    const items = draftToItems()
    if (items.length === 0) return null
    // QUALI RIGHE STANNO PARTENDO. La creazione dura qualche decimo di
    // secondo, e in quei decimi al banco si continua a battere: le righe
    // aggiunte nel frattempo NON sono in questo ordine e non vanno buttate
    // via con le altre.
    const inviate = new Set(items.map((i) => i.line_id))
    creatingRef.current = true
    const run = async () => {
      try {
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
        // LE RIGHE BATTUTE MENTRE L'ORDINE NASCEVA NON SI BUTTANO.
        // La creazione dura qualche decimo di secondo e al banco in quei
        // decimi si continua a battere. Qui succedevano due cose: si
        // svuotava tutta la bozza (comprese le righe arrivate dopo lo
        // scatto), e soprattutto la bozza cambia CHIAVE — da 'new' all'id
        // dell'ordine — quindi anche salvandole restavano in un cassetto
        // che nessuno riapriva più. Si passano a mano alla chiave nuova:
        // un istante dopo l'auto-conferma le manda dentro l'ordine.
        const restanti = draftRef.current.filter((r) => !inviate.has(r.line_id))
        clearDraft()
        if (restanti.length) saveDraft(created.id, restanti)
        selfOrderJsonRef.current = JSON.stringify(created) // evita un re-render doppio dalla subscription
        setSelfOrder(created) // diventa "modifica" in place, niente reload
        return created
      } catch (e) {
        creatingRef.current = false
        creatingPromiseRef.current = null
        toastError(`Ordine non creato: ${e.message}`)
        return null
      }
    }
    creatingPromiseRef.current = run()
    return creatingPromiseRef.current
  }
  const createFromDraftRef = useRef(createFromDraft)
  createFromDraftRef.current = createFromDraft

  // Modale nome (uscita di un ordine appena creato senza nome): lo salva
  // sull'ordine e torna alla coda.
  const submitNew = (name) => {
    setAskName(false)
    const nm = (name || '').trim() || null
    if (order?.id && nm) {
      updateOrderInfo(order.id, { customer_name: nm }).catch((e) =>
        toastError(`Nome non salvato: ${e.message}`)
      )
    }
    setInfo({ customer_name: '', table_label: '', note: '' })
    navigate('/bar')
  }

  // "Invia" manda la COMANDA al banco (non lo scontrino del cliente): si
  // stampa quella in lavorazione, con dentro anche le aggiunte appena
  // fatte. Sta qui e non dentro il tasto perché la usano in due: il footer
  // sul tablet e il menu delle azioni sul telefono.
  function inviaComanda() {
    flushAll()
    flushAdditions()
    const daStampare =
      active ??
      effComandeRef.current.filter((c) => c.status !== ORDER_STATUSES.ANNULLATO).at(-1) ??
      null
    printComanda(order, daStampare)
      .then(() => toastSuccess('Comanda inviata al banco'))
      .catch((e) => setError(`Stampa: ${e.message}`))
  }

  function handlePayNow() {
    if (draft.length === 0 || payOrder) return
    // Se una creazione è GIÀ in volo (auto-creazione appena scattata), il
    // pagamento si aggancia a quella: creare qui un secondo ordine
    // duplicherebbe il conto.
    const giaInCreazione = creatingRef.current && creatingPromiseRef.current
    // Il pagamento diretto crea l'ordine: blocca l'auto-creazione della bozza.
    creatingRef.current = true
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
      if (giaInCreazione) {
        const gia = await creatingPromiseRef.current
        if (gia) {
          setPayOrder((cur) => (cur && cur.id === null ? gia : cur))
          return gia.id
        }
      }
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

  // ── Info conto ──
  const [info, setInfo] = useState({
    customer_name: order?.customer_name || '',
    table_label: order?.table_label || '',
    note: order?.note || '',
  })
  const [showInfo, setShowInfo] = useState(false) // popup dati conto
  // Progressivo previsto per l'ordine in creazione (non lo consuma).
  // PROGRESSIVO PREVISTO, subito. La lettura del contatore è asincrona: finché
  // non rispondeva la testata diceva "Nuovo ordine" e poi diventava "#12" —
  // una parola che si trasforma in un numero, con tutto quello che sta
  // accanto che si sposta. Si parte dall'ultimo numero visto (in memoria
  // locale) e lo si corregge quando arriva quello vero: nel caso normale è
  // già giusto e non si muove niente.
  const [nextNum, setNextNum] = useState(numeroPrevistoInCache)
  useEffect(() => {
    if (!isNew) return
    let vivo = true
    peekNextDailyNumber({ cutoffHour: settings.business_day_cutoff_hour })
      .then((n) => {
        if (!vivo) return
        setNextNum(n)
        ricordaNumeroPrevisto(n)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [isNew, settings.business_day_cutoff_hour])
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
  // CHIUSURA DEL POPUP DATI CONTO — sempre salvando.
  // Prima il salvataggio stava solo sul tasto: chiudendo con la ✕, toccando
  // fuori dal riquadro o premendo Invio (che chiude la tastiera e sembra
  // confermare) il nome appena scritto spariva senza un avviso. È il "a
  // volte non viene salvato" segnalato: dipende da COME si chiude.
  const infoDirty =
    !isNew &&
    (info.customer_name !== (order.customer_name || '') ||
      info.table_label !== (order.table_label || '') ||
      info.note !== (order.note || ''))

  // CHIUSURA DEL POPUP DATI CONTO — sempre salvando.
  // Prima il salvataggio stava solo sul tasto: chiudendo con la ✕, toccando
  // fuori dal riquadro o premendo Invio (che chiude la tastiera e sembra
  // confermare) il nome appena scritto spariva senza un avviso. È il "a
  // volte non viene salvato": dipende da COME si chiude il popup.
  // Invio nel popup: chiude la tastiera E salva. Prima chiudeva solo la
  // tastiera, e chi dava per fatto il salvataggio perdeva il nome.
  const infoOnEnter = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    dismissKeyboard(e.currentTarget)
    chiudiInfo()
  }

  const chiudiInfo = () => {
    setShowInfo(false)
    if (isNew || !order?.id || closed || !infoDirty) return
    updateOrderInfo(order.id, info).catch((e) =>
      toastError(`Dati conto non salvati: ${e.message}`)
    )
  }

  const extras =
    Number(order?.coperto_amount || 0) +
    Number(order?.service_charge_amount || 0) +
    Number(order?.tip_amount || 0)

  // Un ordine senza alcun identificativo (nome o tavolo): all'uscita di un
  // ordine APPENA creato glielo si chiede una volta sola.
  const needsName = (o) => o && !o.customer_name && !o.table_label

  // Uscita dalla schermata.
  const askNameThenExit = () => {
    nameAskedRef.current = true
    setAskName(true)
  }
  const handleExit = () => {
    if (!isNew) {
      // Le modifiche ottimistiche ancora in volo (aggiunte/decrementi) si
      // inviano ora, per non perderle uscendo. Se è un ordine creato in place
      // senza nome, lo si chiede una volta prima di uscire.
      flushAll()
      flushAdditions()
      if (createdInPlace && !nameAskedRef.current && needsName(order)) return askNameThenExit()
      return navigate('/bar')
    }
    // Nulla ancora creato (uscita prima dell'auto-creazione): con item in bozza
    // si crea ora e — se manca il nome — lo si chiede; altrimenti si esce.
    if (draftCount === 0) return navigate('/bar')
    createFromDraftRef.current().then((o) => {
      if (!o) return
      if (needsName(o)) return askNameThenExit()
      navigate('/bar')
    })
  }

  // In creazione si mostra GIÀ il progressivo che l'ordine avrà (letto dal
  // contatore della sessione di cassa), invece di un generico "Nuovo ordine":
  // il numero è il riferimento che si dice al cliente e si scrive sul bicchiere.
  const numero = isNew ? nextNum : order.daily_number
  // Mai una parola al posto del numero: se non lo si sa ancora si tiene il
  // segnaposto, che occupa lo stesso spazio.
  const headTitle = numero != null ? `#${numero}` : '#…'
  const nomeConto = isNew ? info.customer_name.trim() : order.customer_name
  const panelTitle = `${headTitle}${nomeConto ? ` · ${nomeConto}` : ''}`
  const canPay = !isNew && !closed && order.payment_status !== 'pagato'
  // QUANTO RESTA DA INCASSARE, scritto sul tasto Pagamento. Prima la cifra
  // compariva solo finché l'ordine non esisteva ancora: appena si creava da
  // sé — cioè un istante dopo il primo prodotto — spariva, e sembrava un
  // difetto. È il totale meno lo sconto e gli acconti già presi.
  const daIncassare = Math.max(
    0,
    confirmedTotal +
      draftTotal +
      extras -
      (isNew ? 0 : (order.discount_amount || 0) + paidAmount(order))
  )

  return (
    // L'altezza si divide per lo zoom: dentro un contenitore scalato 100dvh
    // varrebbe più dello schermo e la schermata sborderebbe (vedi ZoomControl).
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100dvh / var(--zoom, 1))',
        overflow: 'hidden',
      }}
    >
      {/* ── Barra in alto (sotto la barra di sistema del tablet: --safe-top) ── */}
      <div
        className="posd-topbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <button className="btn ghost small" aria-label="Torna agli ordini" onClick={handleExit}>← Ordini</button>
        <strong className="posd-num">{headTitle}</strong>
        {/* QUANDO è stato aperto il conto, accanto al numero: sapere che quel
            tavolo è lì dalle nove cambia come lo si tratta. */}
        {!isNew && order.created_at && (
          <span className="muted small posd-aperto" title="Conto aperto il">
            {apertoIl(order.created_at)}
          </span>
        )}
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
          <span className="muted small posd-autore">✍️ {placedByName(order.placed_by)}</span>
        )}
        {/* Progressivo assoluto di sistema: id interno che non riparte mai
            (il #N in grande invece riparte ogni giornata). */}
        {!isNew && order.serial != null && (
          <span
            className="muted posd-serial"
            style={{ fontSize: '0.7rem', opacity: 0.6 }}
            title="Progressivo interno dell'ordine"
          >
            id {String(order.serial).padStart(5, '0')}
          </span>
        )}
        {/* ZOOM sul telefono: qui, in fondo alla testata. Flottante
            nell'angolo finiva sopra i tasti del conto e si premeva lui. */}
        {telefono && <ZoomControl inline />}
      </div>

      {error && <div className="banner" style={{ margin: '8px 8px 0', flexShrink: 0 }}>{error}</div>}

      {/* ── Corpo a 3 colonne: categorie · griglia · ordine ── */}
      <div
        className="posd-body"
        style={{
          '--pos-cats-w': `${catsRz.width}px`,
          '--pos-comanda-w': `${comandaRz.width}px`,
          '--cats-scale': catsScale,
          '--comanda-scale': comandaScale,
        }}
      >
        <PosProductPicker
          drinks={drinks}
          cats={cats}
          loading={loading}
          qtyByDrink={qtyByDrink}
          categoryDisplay={settings.category_display}
          catsHandleProps={catsRz.handleProps}
          recentIds={recentIds}
          onAdd={(d) => {
            collapsePanel()
            plusFromCatalog(d)
          }}
          onSetQty={(d, q) => {
            collapsePanel()
            const cur = qtyByDrink[d.id] ?? 0
            if (q > cur) plusFromCatalog(d)
            else if (q < cur) minusFromCatalog(d.id)
          }}
          onInteract={collapsePanel}
          disabled={closed}
        />

        {/* Maniglia fra griglia e pannello ordine */}
        <div className="posd-resize-handle" {...comandaRz.handleProps} />

        {/* ── Pannello destro: L'ORDINE (lista unica). Su smartphone si
            comprime in una barra (totale + n. item) mentre si lavora sulla
            griglia; un tocco la riapre. ── */}
        <div className={`posd-comanda${panelCollapsed ? ' collapsed' : ''}`}>
          {panelCollapsed && (
            <button
              type="button"
              className="posd-collapsed-bar"
              onClick={expandPanel}
            >
              <span style={{ minWidth: 0 }}>
                <span className="muted">
                  🧾 {confirmedLines.reduce((s, l) => s + l.qty, 0) + draftCount} item — tocca per aprire
                </span>
                <span className="posd-collapsed-tot" style={{ display: 'block' }}>
                  {formatPrice(confirmedTotal + draftTotal + extras)}
                </span>
              </span>
              <span className="muted" style={{ marginLeft: 'auto', fontSize: '1.4rem' }}>▲</span>
            </button>
          )}
          <div style={{ padding: '8px 12px 0', flexShrink: 0 }}>
            {/* Il nome del conto si prende tutta la riga: schiacciato fra i
                tasti restava un filo di spazio e spariva nei puntini. */}
            <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
              <strong className="posd-title" style={{ display: 'block', flex: 1, minWidth: 0 }}>
                {panelTitle}
              </strong>
              {telefono && (
                <button
                  className="btn ghost small"
                  onClick={() => setShowAzioni(true)}
                  aria-label="Azioni del conto"
                  title="Azioni del conto"
                >
                  ⋯
                </button>
              )}
            </div>
            <div className="posd-azioni">
              {/* I tasti ci sono SEMPRE, spenti quando non servono. Comparire e
                  sparire sposta tutto quello che sta sotto proprio mentre ci si
                  sta per premere sopra — e il tasto che cercavi non è più lì. */}
                <button
                  className="btn ghost small"
                  onClick={mergeDraft}
                  disabled={!canMerge}
                  title={canMerge ? 'Unisci le righe uguali' : 'Niente da unire'}
                >
                  🔗 Unisci
                </button>
                <button
                  className="btn ghost small"
                  onClick={splitAllDraft}
                  disabled={!canSplit}
                  title={canSplit ? 'Separa le quantità' : 'Niente da separare'}
                >
                  ⑃ Separa
                </button>
                <button
                  className="btn secondary small"
                  onClick={() => setShowComande(true)}
                  disabled={isNew}
                  title={isNew ? 'Il conto non è ancora stato aperto' : 'Storico comande'}
                >
                  <IconReceipt /> Comande ({isNew ? 0 : comande.length})
                </button>
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
              <div className="row between posd-gruppo-row" style={{ alignItems: 'center', marginTop: 2 }}>
                {group && !groupIsContainer ? (
                  <span className="pill small">👥 {group.name}</span>
                ) : (
                  <span className="muted small">Nessun gruppo</span>
                )}
                <span className="row" style={{ gap: 6 }}>
                  {/* Solo l'icona: il nome del gruppo, quando c'è, sta già a
                      sinistra, e la scritta mangiava mezza riga. */}
                  <button
                    className="btn ghost small"
                    onClick={() => setPickGroup(true)}
                    aria-label={group ? 'Cambia gruppo' : 'Associa a gruppo'}
                    title={group ? 'Cambia gruppo' : 'Associa a gruppo'}
                  >
                    👥
                  </button>
                  {/* La ✕ toglie il conto dal gruppo: senza un gruppo non
                      vuol dire niente, quindi non c'è. */}
                  {group && (
                    <button
                      className="btn ghost small"
                      onClick={() => scegliGruppo('')}
                      aria-label="Togli dal gruppo"
                      title="Togli dal gruppo"
                    >
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

            {/* Azioni FISSE in testata, una sotto l'altra: prima Dati conto,
                poi Prodotto libero. Con la lista lunga scorrevano via insieme
                al nome del conto. */}
            <div className="posd-azioni-fisse">
              <button className="btn ghost small block" onClick={() => setShowInfo(true)}>
                👤 Dati conto
              </button>
              <button
                className="btn ghost small block"
                disabled={closed}
                onClick={() => setShowCustom(true)}
              >
                <IconTag /> Prodotto libero
              </button>
            </div>
          </div>

          <div ref={listRef} className="posd-list" style={{ flex: 1, overflowY: 'auto', padding: '6px 12px 10px' }}>
            {orderedLines.length === 0 && (
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                Tocca i prodotti per aggiungerli all'ordine.
              </p>
            )}


            {paidCount > 0 && (
              <button
                className="btn ghost small"
                style={{ marginBottom: 2 }}
                onClick={() => setHidePaid((v) => !v)}
              >
                {hidePaid ? `💳 Mostra pagati (${paidCount})` : `💳 Nascondi pagati (${paidCount})`}
              </button>
            )}

            {orderedLines.map((l, idx) => {
              const isDraft = l.source === 'draft'
              const isPaid = !!l.paid
              const canMinus = !closed && !isPaid && (isDraft || l.removable)
              const firstPaid = isPaid && !orderedLines[idx - 1]?.paid
              return (
                <div key={l.key}>
                  {firstPaid && (
                    <div className="muted small" style={{ margin: '10px 0 2px', borderTop: '1px dashed var(--line)', paddingTop: 6 }}>
                      💳 Pagati
                    </div>
                  )}
                  <div
                    className="row between draft-line"
                    data-line-index={idx}
                    data-line-key={l.key}
                    onPointerDown={(e) => !isPaid && startDrag(e, idx)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    style={{
                      alignItems: 'center',
                      marginTop: 2,
                      // pan-y: lo scroll verticale della lista resta possibile su
                      // touch (prima 'none' lo bloccava); il drag parte dal long-press.
                      touchAction: 'pan-y',
                      cursor: closed || isPaid ? 'default' : 'grab',
                      borderRadius: 8,
                      background: dragIndex === idx ? 'var(--tile-bg)' : 'transparent',
                      boxShadow: dragIndex === idx ? '0 4px 14px rgba(0,0,0,0.35)' : 'none',
                      opacity: isPaid ? 0.6 : dragIndex != null && dragIndex !== idx ? 0.85 : 1,
                    }}
                  >
                    {/* L'item è CLICCABILE per modificarlo (niente tasto matita):
                        il tap è gestito in endDrag (pointerup) perché il
                        pointer-capture del drag intercetta il click sul figlio. */}
                    <span
                      className="grow"
                      style={{ fontSize: '1.08em', display: 'flex', alignItems: 'center', minWidth: 0, cursor: !closed && (isDraft || l.removable) ? 'pointer' : 'inherit' }}
                      title={!closed && (isDraft || l.removable) ? `Modifica ${l.name}` : undefined}
                    >
                      {!closed && !isPaid && <span aria-hidden style={{ opacity: 0.35, marginRight: 4, flexShrink: 0, fontSize: '0.85em' }}>⠿</span>}
                      <span style={{ minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ display: 'flex', alignItems: 'baseline', minWidth: 0 }}>
                          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {l.custom ? '✨ ' : ''}{l.name}
                          </span>
                          <span className="muted" style={{ whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 5, fontSize: '0.85em' }}>
                            · {formatPrice(l.unit_price)}
                          </span>
                        </span>
                        {/* Nota della riga (es. "poco ghiaccio", o di chi è) */}
                        {l.note && (
                          <span
                            className="muted"
                            style={{ display: 'block', fontSize: '0.78em', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            ↳ {l.note}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="row" style={{ gap: 4, alignItems: 'center' }}>
                      <span className="qty" onPointerDown={(e) => e.stopPropagation()}>
                        {/* Etichette col nome: nella lista ci sono molte righe,
                            e i +/- della griglia hanno un altro significato. */}
                        <button aria-label={`Riduci ${l.name}`} onClick={() => minusRow(l)} disabled={!canMinus}>−</button>
                        <strong>{l.qty}</strong>
                        <button aria-label={`Aumenta ${l.name}`} onClick={() => plusRow(l)} disabled={closed || isPaid}>+</button>
                      </span>
                    </span>
                  </div>
                </div>
              )
            })}

          </div>

          {/* Footer: avanzamento comanda + totale + CONFERMA vicino a PAGAMENTO.
              Ridimensionabile dalla maniglia in cima: font e tasti scalano. */}
          <div className="posd-comanda-foot" style={{ '--foot-scale': footRz.width / 100 }}>
            <div className="posd-foot-handle" title="Trascina per ingrandire/rimpicciolire" {...footRz.handleProps} />
            {!isNew && workflowOn && active && !closed && (
              <div className="row between" style={{ alignItems: 'center' }}>
                <span className={`pill ${active.status}`}>
                  {STATUS_EMOJI[active.status]} {STATUS_LABELS[active.status]}
                </span>
                {/* Conto già pagato: si può chiudere di netto senza far avanzare
                    gli stati uno per uno (l'avanzamento vero è nel popup Servizio). */}
                {order.payment_status === 'pagato' && (
                  <button
                    className="btn small"
                    onClick={() =>
                      closePaidOrder(order.id).catch((e) => toastError(`Chiusura non riuscita: ${e.message}`))
                    }
                  >
                    <IconCheck /> Chiudi conto
                  </button>
                )}
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

            {/* Niente tasto Conferma: gli item si confermano da soli (si torna
                con "← Ordini"). I tasti azione sono SEMPRE presenti: quelli non
                applicabili sono disabilitati, non spariscono. */}
            <div className="posd-foot-azioni">
            <div className="grid-2">
              <button className="btn ghost small" disabled={isNew} onClick={inviaComanda}>
                <IconPrinter /> Invia comanda
              </button>
              <button
                className="btn small"
                disabled={isNew ? draftCount === 0 : !canPay}
                onClick={isNew ? handlePayNow : () => setShowPayment(true)}
              >
                <IconCard /> Pagamento{daIncassare > 0 ? ` · ${formatPrice(daIncassare)}` : ''}
              </button>
            </div>

            {workflowOn && (
              <button
                className="btn ghost small block"
                disabled={isNew || closed}
                onClick={() => setShowComande(true)}
              >
                <IconRefresh /> Stato servizio
              </button>
            )}

            <button
              className="btn ghost small block"
              disabled={isNew || closed}
              onClick={() => setConfirmCancel(true)}
            >
              <IconX /> Annulla ordine
            </button>
            </div>

            {/* TELEFONO: un tasto solo, tutto il resto nel menu dal basso.
                In pagina restano il totale e le righe del conto. */}
            {/* TELEFONO: i tre gesti della serata su una riga sola —
                si manda al banco, si incassa, si annulla. Tutto il resto
                sta dietro i ⋯ in alto, dove non intralcia. */}
            {telefono && (
              <div className="posd-foot-telefono">
                <button className="btn ghost" disabled={isNew} onClick={inviaComanda}>
                  <IconPrinter /> Invia
                </button>
                <button
                  className="btn"
                  disabled={isNew ? draftCount === 0 : !canPay}
                  onClick={isNew ? handlePayNow : () => setShowPayment(true)}
                >
                  <IconCard /> Paga
                </button>
                <button
                  className="btn ghost"
                  disabled={isNew || closed}
                  onClick={() => setConfirmCancel(true)}
                >
                  <IconX /> Annulla
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MENU AZIONI (solo telefono) ──────────────────────────────
          Le stesse azioni dei tasti, con gli stessi handler: qui non c'è
          una seconda logica da tenere allineata, solo un altro posto da
          cui chiamarla. */}
      <ActionSheet
        open={showAzioni && telefono}
        onClose={() => setShowAzioni(false)}
        titolo={panelTitle}
        voci={[
          {
            id: 'comande',
            icon: <IconReceipt />,
            label: `Comande (${isNew ? 0 : comande.length})`,
            hint: workflowOn ? 'Stato del servizio e ristampe' : 'Storico delle comande',
            disabled: isNew,
            onClick: () => setShowComande(true),
          },
          {
            id: 'libero',
            icon: <IconTag />,
            label: 'Prodotto libero',
            hint: 'Una voce che non è a menù',
            disabled: closed,
            onClick: () => setShowCustom(true),
          },
          {
            id: 'dati',
            icon: '👤',
            label: 'Dati conto',
            hint: 'Nome, tavolo, note',
            onClick: () => setShowInfo(true),
          },
          {
            id: 'unisci',
            icon: '🔗',
            label: 'Unisci le righe uguali',
            disabled: !canMerge,
            onClick: mergeDraft,
          },
          {
            id: 'separa',
            icon: '⑃',
            label: 'Separa le quantità',
            disabled: !canSplit,
            onClick: splitAllDraft,
          },
          groupsOn && {
            id: 'gruppo',
            icon: <IconGruppo />,
            label: group ? `Gruppo: ${group.name}` : 'Associa a un gruppo',
            hint: group ? 'Cambia o togli' : null,
            onClick: () => setPickGroup(true),
          },
        ]}
      />

      {/* ── Modale comande (modifica): stati, avanzamento, stampa ── */}
      {showComande && (
        <div className="overlay confirm-overlay" onClick={() => setShowComande(false)}>
          <div
            className="confirm-box"
            style={{ maxHeight: '85vh', overflowY: 'auto', width: 'min(440px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}><IconReceipt /> Comande</h3>
              <button className="btn ghost small" onClick={() => setShowComande(false)}><IconClose /> Chiudi</button>
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
                      <IconPrinter /> Stampa
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

            {/* Scontrino NON FISCALE del conto intero (il riepilogo per il
                cliente): sta qui con le altre stampe, mentre "Invia comanda"
                nel footer manda il ticket al banco. */}
            <button
              className="btn ghost small block"
              style={{ marginTop: 12 }}
              onClick={() =>
                printScontrino(order)
                  .then(() => toastSuccess('Scontrino stampato'))
                  .catch((e) => setError(`Stampa: ${e.message}`))
              }
            >
              <IconReceipt /> Scontrino (non fiscale)
            </button>
          </div>
        </div>
      )}

      {/* ── Popup Dati conto (nome/tavolo/note) ── */}
      {showInfo && (
        <div className="overlay confirm-overlay" onClick={chiudiInfo}>
          <div
            className="confirm-box"
            role="dialog"
            aria-label="Dati conto"
            style={{ width: 'min(400px, 94vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>👤 Dati conto</h3>
              <button className="btn ghost small" onClick={chiudiInfo}>✕</button>
            </div>
            <label htmlFor="pd-name" style={{ display: 'block', marginTop: 10 }}>Nome</label>
            <input
              id="pd-name"
              value={info.customer_name}
              disabled={closed}
              autoFocus
              onKeyDown={infoOnEnter}
              onChange={(e) => setInfo((v) => ({ ...v, customer_name: e.target.value }))}
              placeholder="Es. Marco, Tavolo 4…"
            />
            <div className="grid-2" style={{ marginTop: 8 }}>
              <div>
                <label htmlFor="pd-table">Tavolo</label>
                <input
                  id="pd-table"
                  value={info.table_label}
                  disabled={closed}
                  onKeyDown={infoOnEnter}
                  onChange={(e) => setInfo((v) => ({ ...v, table_label: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="pd-note">Note</label>
                <input
                  id="pd-note"
                  value={info.note}
                  disabled={closed}
                  onKeyDown={infoOnEnter}
                  onChange={(e) => setInfo((v) => ({ ...v, note: e.target.value }))}
                />
              </div>
            </div>
            {!closed && (
              <button
                className="btn block"
                style={{ marginTop: 12 }}
                onClick={chiudiInfo}
              >
                {isNew ? 'OK' : '💾 Salva dati conto'}
              </button>
            )}
          </div>
        </div>
      )}

      {showCustom && (
        <CustomDrinkForm
          onCancel={() => setShowCustom(false)}
          onAdd={({ name, price, recipe_items, note }) => {
            const custom = {
              drink_id: `custom-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
              custom: true,
              name,
              unit_price: price,
              qty: 1,
              sumup_product_id: null,
              recipe_items,
              ...(note ? { note } : {}),
            }
            setShowCustom(false)
            // MODIFICA: dritto nella comanda (niente flicker); CREAZIONE: bozza.
            if (!isNew) {
              addToEditableComanda(custom)
            } else {
              const nuova = { line_id: makeLineId(), ...custom }
              setDraft((items) => [...items, nuova])
              scrollToLine(`d:${nuova.line_id}`)
            }
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

      {/* ── Modale nome del conto all'uscita di un ordine appena creato ── */}
      {askName && (
        // MODALE: cliccare fuori non chiude niente. Con un tocco a vuoto che
        // chiude, un dito appoggiato di striscio sullo schermo fa sparire la
        // domanda e non si sa più se il nome è stato messo. Si esce dalla ✕ o
        // salvando — e in entrambi i casi si prosegue verso la lista ordini,
        // che è dove si stava andando.
        <div className="overlay confirm-overlay">
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
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>👤 Nome del conto</h3>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => submitNew('')}
                aria-label="Chiudi senza dare un nome"
                title="Chiudi senza dare un nome"
              >
                ✕
              </button>
            </div>
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
          onClose={() => {
            setPayOrder(null)
            creatingRef.current = false // pagamento annullato: riabilita l'auto-creazione
          }}
          onPaid={() => navigate('/bar')}
          onError={setError}
          resolveOrderId={() => payIdRef.current}
        />
      )}
      {!isNew && showPayment && (
        <PaymentScreen
          order={order}
          settings={settings}
          onClose={() => setShowPayment(false)}
          onPaid={() => navigate('/bar')}
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
                scegliGruppo('')
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
                  scegliGruppo(g.id)
                  setPickGroup(false)
                }}
              >
                {g.kind === 'customer' ? <IconPersona /> : <IconGruppo />} {g.name}
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
            // SI TORNA AGLI ORDINI. Un conto annullato non si lavora più:
            // restarci davanti serve solo a chiedersi se l'annullo è andato,
            // e a rischiare di batterci sopra. Come quando si svuota da sé.
            // La scrittura prosegue per conto suo: se fallisce lo dice il
            // toast, ma la coda è già lì.
            navigate('/bar')
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
