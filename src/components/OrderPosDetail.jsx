import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  advanceComanda,
  addComanda,
  bartenderUpdateComanda,
  updateOrderInfo,
  setOrderGroup,
  cancelOrder,
  restoreOrder,
  closePaidOrder,
  createOrder,
  subscribeOpenGroups,
  fetchRecentDrinkIds,
  subscribeOrder,
  subscribeSettings,
  peekNextDailyNumber,
  DEFAULT_SETTINGS,
  settingsIniziali,
} from '../lib/api.js'
import { useDraft, loadLayout, saveLayout, saveDraft } from '../lib/useDraft.js'
import { dismissKeyboard } from '../lib/keyboard.js'
import { useResizable } from '../lib/useResizable.js'
import { useTelefono } from '../lib/useTelefono.js'
import { nascondiOrdine, mostraOrdine } from '../lib/ordiniNascosti.js'
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
  paymentMethodLabel,
} from '../lib/orderStatus.js'
import { idDispositivo } from '../lib/dispositivo.js'
import {
  nextComandaStatus,
  activeComanda,
  orderIsClosed,
  comandaEditable,
  ORDER_OPEN,
} from '../lib/comande.js'
import { paidAmount, dettaglioIncassi } from '../lib/pagamento.js'
import { isPersonale } from '../lib/ruoli.js'
import {
  makeLineId,
  mergeLines,
  splitAll,
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
import { StoriaOrdineDialog, RipristinaOrdineDialog } from './StoriaOrdine.jsx'
import { ripristinabile, ultimaRiapertura, quando } from '../lib/storiaOrdine.js'
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

// IL CONTO CHE STAVO APRENDO. In creazione l'ordine nasce SENZA cambiare
// pagina (niente navigazione, la schermata resta montata): se il browser
// ricarica — basta uno scorrimento di troppo in cima alla lista, e su
// Android parte l'aggiornamento della pagina — l'app non saprebbe più a
// quale conto stava lavorando e ne aprirebbe un altro, lasciando il primo
// aperto in coda con dentro la roba già battuta.
// Qui si tiene il suo id: al ritorno si riprende da lì. Si dimentica
// uscendo dal conto o quando il conto si chiude — e comunque scade, per
// non ritrovarsi dentro un conto di ieri.
const CHIAVE_IN_CORSO = 'tana:pos:conto-in-corso'
const ORE_IN_CORSO = 8

function contoInCorso() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_IN_CORSO) || 'null')
    if (!v?.id) return null
    if (Date.now() - v.at > ORE_IN_CORSO * 3600 * 1000) return null
    return v.id
  } catch {
    return null
  }
}

function ricordaContoInCorso(id) {
  try {
    if (id) localStorage.setItem(CHIAVE_IN_CORSO, JSON.stringify({ id, at: Date.now() }))
    else localStorage.removeItem(CHIAVE_IN_CORSO)
  } catch {
    /* senza memoria locale si riparte da zero, come prima */
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
  const [confirmSvuota, setConfirmSvuota] = useState(false)
  // Menu delle azioni: esiste solo sul telefono, dove i tasti non ci stanno
  // tutti in pagina senza mangiarsi le righe del conto.
  const [showAzioni, setShowAzioni] = useState(false)
  // Il menu delle azioni vale SOLO sul telefono: altrove i tasti stanno in
  // pagina, e un ⋯ in più sarebbe solo un doppione da capire.
  const telefono = useTelefono()
  const [showPayment, setShowPayment] = useState(false)
  const [showStoria, setShowStoria] = useState(false)
  // Chi sta usando l'app: la storia deve dire CHI ha riaperto il conto.
  // CHI SONO IO, nella forma che la storia sa scrivere: nome e, se si sa,
  // ruolo. Prima era una stringa e basta, e nella stessa storia la stessa
  // persona compariva con tre etichette diverse.
  const chiSonoIo = () =>
    auth.currentUser
      ? {
          name: auth.currentUser.displayName || null,
          email: auth.currentUser.email || null,
          role: staffRef.current?.role || null,
        }
      : null
  // Il proprio ruolo, sempre a portata: serve a firmare le cose che si fanno
  // (vedi chiSonoIo) senza dipendere dall'ordine dei render.
  const staffRef = useRef(null)
  const [showRipristino, setShowRipristino] = useState(false)
  const [askName, setAskName] = useState(false) // modale nome (creazione)
  const [settings, setSettings] = useState(settingsIniziali)
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
  // I CALCOLI DELLE RIGHE («2 × 5,00 €») si mostrano a richiesta, dal menù
  // ⋯ del conto: in riga, accanto a ogni nome, erano rumore — il numero
  // che conta è il subtotale. La scelta si ricorda sul dispositivo.
  const [mostraCalcoli, setMostraCalcoli] = useState(() => {
    try {
      return localStorage.getItem('tana:pos:calcoli') === '1'
    } catch {
      return false
    }
  })
  const toggleCalcoli = () =>
    setMostraCalcoli((v) => {
      const next = !v
      try {
        localStorage.setItem('tana:pos:calcoli', next ? '1' : '0')
      } catch {
        /* niente memoria: vale per questa sessione */
      }
      return next
    })
  // Il dettaglio dei supplementi (coperto/servizio/mancia) sotto il
  // Subtotale: aperto dove lo spazio c'è, chiuso di suo sul telefono —
  // si apre toccando il Subtotale.
  const [mostraSupplementi, setMostraSupplementi] = useState(
    () => !window.matchMedia('(max-width: 899px)').matches
  )
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
  const [draft, setDraft, clearDraft, dimenticaBozzaSalvata] = useDraft(draftKey)
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
  // ALTEZZA DEL PANNELLO ORDINE sul telefono (in dvh): con più di tre o
  // quattro righe il conto non ci stava e bisognava scorrere dentro una
  // finestrella. Si tira su la maniglia e si guarda tutto il conto.
  const altezzaRz = useResizable('pos-comanda-h', {
    // In quarti di schermo: da un quarto (si guarda la griglia) a tre
    // quarti (si guarda il conto), partendo da metà. Oltre i tre quarti
    // della griglia non resterebbe abbastanza per battere.
    def: 50,
    min: 25,
    max: 75,
    axis: 'y',
    side: 'up',
    speed: 0.13, // pixel → dvh (uno schermo tipico è ~800px: 1dvh ≈ 8px)
  })
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
  // Il MINIMO della scala del testo delle righe è configurabile
  // (Impostazioni → Vista ordine): il pavimento fisso a 1.1 per qualcuno
  // era un manifesto — sotto la soglia scelta il testo non scende, per
  // quanto si stringa il pannello.
  const testoMin = clampScale(Number(settings.pos_testo_min) || 1.1, 0.8, 1.4)
  const comandaScale = isPhone
    ? Math.min(0.95, testoMin)
    : clampScale(comandaRz.width / 340, testoMin, 1.7)

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

  // APRENDO IL PANNELLO SI VEDE L'ULTIMA RIGA. È quella appena battuta:
  // trovarsi in cima alla lista, con l'ultimo drink fuori vista, vuol dire
  // scorrere ogni volta per controllare quello che si è appena aggiunto.
  useEffect(() => {
    if (panelCollapsed) return undefined
    // Dopo il render: la lista si popola in un secondo giro.
    const t = requestAnimationFrame(() => {
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(t)
  }, [panelCollapsed])

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
          const io = { email: u.email, name: u.displayName || u.email, role }
          staffRef.current = io
          setStaff(io)
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
      // Chiuso o annullato (magari da un altro dispositivo): non è più
      // "il conto in corso", e al prossimo giro si riparte puliti.
      if (o.status !== ORDER_OPEN) ricordaContoInCorso(null)
    }, () => {})
  }, [selfOrderId, orderProp])

  // RIPRESA DOPO UN RICARICAMENTO. Si entra in creazione ma un conto era
  // già stato aperto qui: si torna dentro quello invece di aprirne un
  // altro e lasciare il primo per strada, con dentro quello che era già
  // stato battuto. Solo se è ancora aperto: un conto chiuso non si
  // riapre.
  // LA SCHERMATA È ANCORA QUI? La creazione va avanti anche dopo che si è
  // usciti — è quello che la rende immediata — ma quello che scrive PER la
  // schermata (il conto in corso, lo stato locale) non deve più toccare
  // niente: si usciva, la creazione finiva un istante dopo e si rimetteva in
  // memoria «il conto in corso», così il «+» seguente riapriva quello — e
  // per un attimo si vedevano i suoi prodotti segnati nella griglia.
  const montatoRef = useRef(true)
  useEffect(
    () => () => {
      montatoRef.current = false
    },
    []
  )

  // USCENDO DA QUI, LA BOZZA SI CHIUDE. Da qualunque parte si esca — la
  // freccia, il menu, il tasto indietro del browser — quello che è stato
  // battuto diventa un CONTO (si crea da sé, in locale) e la copia salvata
  // sparisce.
  //
  // È la regola che mancava: la schermata del conto nuovo si deve aprire
  // PULITA, senza pulizie all'apertura. Prima la bozza restava sotto la
  // chiave 'new' e il conto dopo se la ritrovava dentro — le righe di quello
  // prima, pronte a essere battute due volte. La «bozza che non si perde»
  // continua a valere: non si perde perché diventa un conto, non perché
  // resta in un cassetto.
  const uscitaRef = useRef(null)
  uscitaRef.current = () => {
    if (orderProp) return
    ricordaContoInCorso(null)
    if (draftRef.current.length > 0) createFromDraftRef.current()
    saveDraft('new', [])
  }
  useEffect(
    () => () => {
      uscitaRef.current?.()
    },
    []
  )

  // USCENDO DAL POS SI DIMENTICA. Il «+» deve aprire un conto NUOVO: la
  // memoria del conto in corso serve solo a riprenderlo dopo un
  // RICARICAMENTO della pagina — dove questa pulizia non gira, perché il
  // programma muore e basta. Uscendo a mano invece gira, e premendo «+» non
  // ci si ritrova dentro il conto appena battuto.
  useEffect(() => {
    if (orderProp || selfOrder) return undefined
    const id = contoInCorso()
    if (!id) return undefined
    let vivo = true
    let stop = null
    stop = subscribeOrder(
      id,
      (o) => {
        if (!vivo) return
        vivo = false
        if (o && o.status === ORDER_OPEN) {
          selfOrderJsonRef.current = JSON.stringify(o)
          setSelfOrder(o)
        } else {
          ricordaContoInCorso(null)
        }
        // Basta la prima risposta: da qui in poi ci pensa l'ascolto
        // normale del conto (selfOrderId), questo era solo per ritrovarlo.
        stop?.()
      },
      () => ricordaContoInCorso(null)
    )
    return () => {
      vivo = false
      stop?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderProp])

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
  // Un conto RIAPERTO si modifica tutto, righe vecchie comprese: è il
  // motivo per cui lo si riapre. Vedi api.js/bartenderUpdateComanda.
  const riaperto = Array.isArray(order?.riaperture) && order.riaperture.length > 0
  // IL CONTO ANNULLATO NON È UN CONTO VUOTO. Annullando, tutte le sue
  // comande diventano «annullate» e qui venivano saltate: si apriva un
  // conto senza una riga e a zero euro, e non si capiva né cosa ci fosse
  // dentro né se valesse la pena riaprirlo. Dentro un conto ancora aperto
  // invece una comanda annullata resta fuori: quella roba non si fa e non
  // si paga.
  const contoAnnullato = !isNew && order?.workflow_status === ORDER_STATUSES.ANNULLATO

  const confirmedLines = useMemo(() => {
    const remainingPaid = {}
    for (const p of order?.payments || [])
      for (const it of p.items || [])
        if (it.drink_id) remainingPaid[it.drink_id] = (remainingPaid[it.drink_id] || 0) + (Number(it.qty) || 0)
    const out = []
    for (const c of effComande) {
      const comandaAnnullata = c.status === ORDER_STATUSES.ANNULLATO
      if (comandaAnnullata && !contoAnnullato) continue
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
          out.push({
            ...base,
            key: chiave,
            qty: unpaidQty,
            removable: !comandaAnnullata && (comandaEditable(c) || riaperto),
            annullata: comandaAnnullata,
          })
        if (paidHere > 0)
          out.push({ ...base, key: `${chiave}:paid`, qty: paidHere, removable: false, paid: true })
      })
    }
    return out
  }, [effComande, order?.payments, riaperto, contoAnnullato])

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
      cancelOrder(order.id, { by: 'bartender' }).catch(() => mostraOrdine(order.id))
      nascondiOrdine(order.id)
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
  // Le righe di un conto annullato si vedono ma non fanno somma: quel
  // conto non lo paga nessuno, e un totale diverso da zero lo farebbe
  // sembrare ancora da incassare.
  const confirmedTotal = confirmedLines.reduce(
    (s, l) => s + (l.annullata ? 0 : l.qty * l.unit_price),
    0
  )
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
    if (!c || !(comandaEditable(c) || riaperto)) return
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
  // Separare vuol dire anche dare a ogni riga nuova un identificativo suo:
  // vedi splitAll in lib/orderLines.js (le righe con lo stesso id sparivano).
  const explode = (items) => splitAll(items)
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
    setDraft((items) => splitAll(items))
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

  // DA QUALE TERMINALE. Serve a non avvisare chi l'ordine l'ha appena
  // mandato — e solo lui: lo stesso account sta su tablet, telefono e
  // portatile insieme, e chi e' rimasto al banco l'avviso lo vuole.
  const placedBy = () =>
    staff
      ? { email: staff.email, name: staff.name, role: staff.role, device: idDispositivo() }
      : undefined

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
  // LA CHIAVE DELLA BATTUTA. Identifica QUESTA creazione: se la richiesta
  // parte due volte — l'auto-creazione mentre si preme «Paga», un doppio
  // tocco — il conto resta uno solo (vedi createOrder). Non cambia finché
  // la schermata resta in creazione.
  const chiaveBattutaRef = useRef(null)
  const chiaveBattuta = () => {
    if (!chiaveBattutaRef.current) {
      chiaveBattutaRef.current = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    return chiaveBattutaRef.current
  }
  // Promise dell'ordine in creazione: chi arriva mentre la creazione è in volo
  // (es. il tasto Pagamento) deve ASPETTARE questo, non creare un secondo
  // ordine — altrimenti si ritrovano due conti con lo stesso nome/tavolo.
  const creatingPromiseRef = useRef(null)
  const itemsInVoloRef = useRef(null)
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
    // LA BOZZA SI SVUOTA SUBITO, non quando il server risponde. Aspettare la
    // scrittura voleva dire che, uscendo prima della sincronizzazione, il
    // conto DOPO si apriva con dentro la roba di quello prima — righe già
    // battute su un altro conto, pronte a essere battute due volte.
    // Le righe arrivate mentre l'ordine nasceva restano da parte: appena
    // c'è l'id vanno nella bozza sua.
    // Le righe restano a schermo mentre il conto nasce: quello che si vede e
    // quello che si ritrova riaprendo sono due cose diverse (vedi useDraft).
    const partite = draftRef.current.filter((r) => inviate.has(r.line_id))
    // Le righe che stanno partendo restano a portata di mano: chi preme
    // «Pagamento» in quell'istante deve vedere il conto, non una schermata
    // vuota perché la bozza è già stata svuotata.
    itemsInVoloRef.current = items
    const restanti = draftRef.current.filter((r) => !inviate.has(r.line_id))
    dimenticaBozzaSalvata()
    const run = async () => {
      try {
        const created = await createOrder({
          table_label: info.table_label || null,
          note: info.note || null,
          customer_name: info.customer_name.trim() || null,
          items,
          client_temp_id: chiaveBattuta(),
          placed_by: placedBy(),
          status: statoIniziale,
          service_mode: modoConsegna,
          group_id: group && !groupIsContainer ? group.id : null,
          group_name_snapshot: group && !groupIsContainer ? group.name : null,
        })
        // LE RIGHE BATTUTE MENTRE L'ORDINE NASCEVA NON SI BUTTANO: la bozza
        // cambia CHIAVE — da 'new' all'id dell'ordine — e vanno passate a
        // mano, altrimenti restano in un cassetto che nessuno riapre più.
        // Un istante dopo, l'auto-conferma le manda dentro l'ordine.
        const arrivateDopo = draftRef.current.filter((r) => !inviate.has(r.line_id))
        const daPortare = [...restanti, ...arrivateDopo]
        if (daPortare.length) saveDraft(created.id, daPortare)
        itemsInVoloRef.current = null
        if (montatoRef.current) {
          selfOrderJsonRef.current = JSON.stringify(created) // evita un re-render doppio dalla subscription
          ricordaContoInCorso(created.id) // se la pagina ricarica, si riprende da qui
          setSelfOrder(created) // diventa "modifica" in place, niente reload
        }
        return created
      } catch (e) {
        creatingRef.current = false
        creatingPromiseRef.current = null
        // Il conto non è nato: le righe tornano in bozza. Averle svuotate
        // subito non deve costare quello che si era battuto.
        saveDraft('new', [...partite, ...restanti])
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
    // Il conto può essere ancora in fase di nascita: il nome lo si mette
    // appena c'è, in sottofondo. Nessuno resta a guardare una schermata
    // ferma per un campo di testo.
    if (nm) {
      const dove = order?.id ? Promise.resolve(order) : creatingPromiseRef.current
      Promise.resolve(dove)
        .then((o) => (o?.id ? updateOrderInfo(o.id, { customer_name: nm }) : null))
        .catch((e) => toastError(`Nome non salvato: ${e.message}`))
    }
    setInfo({ customer_name: '', table_label: '', note: '' })
    navigate('/bar')
  }

  // "Invia" manda la COMANDA al banco (non lo scontrino del cliente): si
  // stampa quella in lavorazione, con dentro anche le aggiunte appena
  // fatte. Sta qui e non dentro il tasto perché la usano in due: il footer
  // sul tablet e il menu delle azioni sul telefono.
  function inviaComanda() {
    // ANCHE SU UN CONTO APPENA BATTUTO. Prima il tasto era spento finché
    // l'ordine non esisteva sul server: al banco vuol dire aspettare la rete
    // per mandare in stampa una comanda che si ha già davanti. Il conto si
    // crea qui (in locale, immediato) e la stampa parte appena c'è.
    if (isNew) {
      const nascita = createFromDraftRef.current()
      Promise.resolve(nascita).then((o) => {
        if (!o) return
        printComanda(o, (o.comande || []).at(-1) || null)
          .then(() => toastSuccess('Comanda inviata al banco'))
          .catch((e) => setError(`Stampa: ${e.message}`))
      })
      return
    }
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

  // C'È QUALCOSA SU CUI LAVORARE? In creazione sono le righe in bozza —
  // oppure quelle appena partite per la creazione, perché la bozza si svuota
  // subito e i tasti non devono spegnersi in quell'istante.
  const conRighe = draftCount > 0 || (itemsInVoloRef.current || []).length > 0 || !isNew

  // Quante righe si porterebbe via il «svuota»: in creazione la bozza, su un
  // conto aperto anche quelle già confermate ma ancora modificabili.
  const righeDaSvuotare = isNew
    ? draftCount
    : draftCount + confirmedLines.filter((l) => l.removable !== false).length

  function svuotaTutto() {
    clearDraft()
    if (isNew) return
    // Sul conto vero le righe si tolgono UNA PER UNA con la strada di
    // sempre (reduceComandaLine): così comande e magazzino restano in pari,
    // e non c'è una seconda logica di cancellazione che un giorno dirà una
    // cosa diversa dalla prima.
    for (const l of confirmedLines.filter((r) => r.removable)) {
      for (let i = 0; i < (Number(l.qty) || 0); i++) {
        reduceComandaLine(l.comandaId, l.itemIndex)
      }
    }
  }

  function handlePayNow() {
    // Le righe possono essere già partite per la creazione: la bozza si
    // svuota subito (vedi createFromDraft) e restano lì.
    const inVolo = itemsInVoloRef.current || []
    if ((draft.length === 0 && inVolo.length === 0) || payOrder) return
    // Se una creazione è GIÀ in volo (auto-creazione appena scattata), il
    // pagamento si aggancia a quella: creare qui un secondo ordine
    // duplicherebbe il conto.
    const giaInCreazione = creatingRef.current && creatingPromiseRef.current
    // Il pagamento diretto crea l'ordine: blocca l'auto-creazione della bozza.
    creatingRef.current = true
    setError(null)
    const items = draft.length ? draftToItems() : inVolo
    // LE RIGHE SONO ANDATE IN PAGAMENTO: la copia salvata della bozza si
    // dimentica subito. Restava lì, e il conto DOPO si apriva con dentro
    // quello che si era appena incassato — la stessa roba, pronta a essere
    // battuta due volte. A schermo restano finché la schermata è aperta:
    // vedi createFromDraft, sono due cose diverse.
    itemsInVoloRef.current = items
    dimenticaBozzaSalvata()
    const mapped = items.map((i) => ({
      drink_id: i.drink_id,
      name: i.name,
      unit_price: i.price,
      qty: i.qty,
      ...(i.custom ? { custom: true } : {}),
    }))
    // Il totale si fa sulle righe che si stanno pagando, non sulla bozza:
    // quando le righe sono già partite per la creazione la bozza è vuota, e
    // il pagamento si apriva a zero euro.
    const totaleRighe = items.reduce(
      (s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0),
      0
    )
    setPayOrder({
      id: null,
      daily_number: null,
      status: 'aperto',
      payment_status: 'non_richiesto',
      customer_name: info.customer_name.trim() || null,
      table_label: info.table_label || null,
      total: Math.round(totaleRighe * 100) / 100,
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
        client_temp_id: chiaveBattuta(),
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
    // Uscendo dal conto la ripresa non serve più: si esce apposta, non per
    // sbaglio. Restasse, il prossimo "nuovo ordine" ripartirebbe da questo.
    ricordaContoInCorso(null)
    if (!isNew) {
      // Le modifiche ottimistiche ancora in volo (aggiunte/decrementi) si
      // inviano ora, per non perderle uscendo. Se è un ordine creato in place
      // senza nome, lo si chiede una volta prima di uscire.
      flushAll()
      flushAdditions()
      if (createdInPlace && !nameAskedRef.current && needsName(order)) return askNameThenExit()
      return navigate('/bar')
    }
    // Nulla ancora creato (uscita prima dell'auto-creazione): il conto si crea
    // ORA, ma NON SI ASPETTA. Prima si aspettava che fosse nato per sapere se
    // chiedere il nome — e siccome il nome lo si sa già da qui (è quello che
    // si è scritto, o non si è scritto, in questa schermata), l'unica cosa
    // che quell'attesa produceva era il box che compariva in ritardo.
    if (draftCount === 0) return navigate('/bar')
    createFromDraftRef.current()
    const senzaNome = !info.customer_name.trim() && !info.table_label.trim()
    if (!nameAskedRef.current && senzaNome) return askNameThenExit()
    navigate('/bar')
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
  // IL TASTO DEL PAGAMENTO, SU UN CONTO CHIUSO, RIMETTE IN CORSO. Lì era
  // spento a non fare niente — e accanto ce n'era un secondo, che compariva
  // solo in quel caso. Due tasti per due stati dello stesso conto: quello
  // che serve è uno, che dice cosa si può fare adesso. È anche il posto
  // dove il dito va già: su un conto chiuso per sbaglio si preme lì.
  const daRiaprire = !isNew && ripristinabile(order)
  // QUANTO RESTA DA INCASSARE, scritto sul tasto Pagamento. Prima la cifra
  // compariva solo finché l'ordine non esisteva ancora: appena si creava da
  // sé — cioè un istante dopo il primo prodotto — spariva, e sembrava un
  // difetto. È il totale meno lo sconto e gli acconti già presi.
  // Ingranditi al massimo dalla maniglia, tre parole non stanno su una
  // riga: da lì in poi restano le sole icone. Meglio un'icona che si vede
  // di una parola tagliata. (La scala del footer va da 80 a 175.)
  const soloIcone = telefono && footRz.width > 118

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
      className="posd-root"
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
        {/* Sul telefono la sola freccia: "Ordini" scritto per esteso andava a
            capo e si mangiava la riga, dove servono numero, ora e stato. */}
        <button className="btn ghost small" aria-label="Torna agli ordini" onClick={handleExit}>
          {telefono ? '←' : '← Ordini'}
        </button>
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

      {/* PERCHÉ QUESTO CONTO È IN CORSO. Un conto riaperto, guardato mezz'ora
          dopo, è indistinguibile da uno normale — e se dentro c'è un incasso
          diventa un mistero. Il motivo sta qui, dove lo si legge senza
          cercarlo; il resto della storia è nei ⋯. */}
      {!isNew && (() => {
        const r = ultimaRiapertura(order)
        if (!r) return null
        return (
          <div className="riaperto-nota" style={{ margin: '8px 8px 0', flexShrink: 0 }}>
            ♻️ <strong>Conto riaperto</strong> il {quando(r.at)}
            {r.chi ? ` da ${r.chi}` : ''}
            {r.motivo ? <> — « {r.motivo} »</> : ''}
          </div>
        )
      })()}

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
          ricercaEvidenzia={settings.pos_search === 'evidenzia'}
          modoStriscia={settings.stripe_pos}
          scorteVerdi={!!settings.stripe_ok_verde}
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
        <div
          className={`posd-comanda${panelCollapsed ? ' collapsed' : ''}`}
          style={{ '--pos-comanda-h': `${altezzaRz.width}dvh` }}
        >
          {/* Maniglia per l'altezza (telefono): tieni premuto e trascina.
              Col dito serve una presa voluta, altrimenti sfiorandola mentre
              si scorre il pannello cambiava altezza da solo. */}
          {telefono && !panelCollapsed && (
            <div
              className={`posd-altezza-handle${altezzaRz.attivo ? ' attiva' : ''}`}
              title="Tieni premuto e trascina per cambiare l'altezza"
              {...altezzaRz.handleProps}
            />
          )}
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
              {/* La storia sta qui, in alto, come SOLA ICONA: da tasto largo
                  si prendeva una riga intera accanto a Unisci/Separa/Comande,
                  per una cosa che si guarda ogni tanto. */}
              {!isNew && (
                <button
                  className="btn ghost small posd-storia"
                  onClick={() => setShowStoria(true)}
                  aria-label="Storia del conto"
                  title="Storia del conto: aperto, chiuso, annullato, riaperto"
                >
                  🕘
                </button>
              )}
              {/* SVUOTA TUTTO, una icona sola. Togliere venti righe una per
                  una col «−» è il modo peggiore di ricominciare: capita di
                  battere il conto sbagliato e accorgersene alla fine. Chiede
                  conferma, che è irreversibile. */}
              {righeDaSvuotare > 0 && !closed && (
                <button
                  className="btn ghost small"
                  onClick={() => setConfirmSvuota(true)}
                  aria-label="Svuota il conto"
                  title="Svuota il conto: toglie tutte le righe"
                >
                  🧹
                </button>
              )}
              {/* Il ⋯ c'è a TUTTE le taglie: era solo da telefono, ma le
                  azioni che non meritano un tasto sempre visibile (i
                  calcoli delle righe, la storia) servono anche su tablet
                  e desktop. */}
              <button
                className="btn ghost small"
                onClick={() => setShowAzioni(true)}
                aria-label="Azioni del conto"
                title="Azioni del conto"
              >
                ⋯
              </button>
            </div>
            <div className="posd-azioni">
              {/* I tasti ci sono SEMPRE, spenti quando non servono. Comparire e
                  sparire sposta tutto quello che sta sotto proprio mentre ci si
                  sta per premere sopra — e il tasto che cercavi non è più lì. */}
                {/* UN TASTO SOLO per Unisci/Separa: dei due, alla volta ne
                    serve uno — il tasto mostra l'azione possibile e cambia
                    faccia da sé (se c'è da unire, unisce; altrimenti
                    separa). Quando servono entrambe vince Unisci, e Separa
                    resta comunque raggiungibile dal ⋯. */}
                <button
                  className="btn ghost small"
                  onClick={canMerge ? mergeDraft : splitAllDraft}
                  disabled={!canMerge && !canSplit}
                  title={
                    canMerge
                      ? 'Unisci le righe uguali'
                      : canSplit
                        ? 'Separa le quantità'
                        : 'Niente da unire o separare'
                  }
                >
                  {canMerge ? '🔗 Unisci' : '⑃ Separa'}
                </button>
                <button
                  className="btn secondary small"
                  onClick={() => setShowComande(true)}
                  disabled={isNew}
                  title={isNew ? 'Il conto non è ancora stato aperto' : 'Storico comande'}
                >
                  <IconReceipt /> Comande ({isNew ? 0 : comande.length})
                </button>
                {/* Questo compare e sparisce, al contrario degli altri: su un
                    conto in corso non vuol dire niente, e un tasto che
                    rimette in corso quello che è già in corso è solo un modo
                    per far dubitare di aver capito. */}
                {ripristinabile(order) && (
                  <button
                    className="btn ghost small"
                    onClick={() => setShowRipristino(true)}
                    title="Il conto torna fra quelli aperti"
                  >
                    ♻️ Rimetti in corso
                  </button>
                )}
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
                    className={`row between draft-line${l.annullata ? ' riga-annullata' : ''}`}
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
                        </span>
                        {/* IL CALCOLO A RICHIESTA (⋯ → «Mostra i calcoli»).
                            Stava in riga accanto a ogni nome ed era rumore:
                            il numero che conta è il subtotale, a destra.
                            Chi vuole vedere da dove viene lo accende, e
                            compare qui sotto come le note — se una riga ha
                            nota e calcolo, sono due righe distinte. */}
                        {mostraCalcoli && l.qty > 1 && (
                          <span
                            className="muted"
                            style={{ display: 'block', fontSize: '0.78em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            ↳ {l.qty} × {formatPrice(l.unit_price)}
                          </span>
                        )}
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
                      {/* Il SUBTOTALE c'è sempre, anche con un pezzo solo:
                          senza, le righe singole restavano senza prezzo
                          quando il calcolo è spento. */}
                      <strong
                        className="posd-riga-tot"
                        title={`${l.qty} × ${formatPrice(l.unit_price)}`}
                      >
                        {formatPrice(l.qty * l.unit_price)}
                      </strong>
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

            {/* I SUPPLEMENTI IN CHIARO. Prima una riga cumulativa diceva
                «Coperto/servizio/mancia · 5,50 €» e non si capiva né cosa
                fosse attivo né quanto pesasse ognuno. Ora: Subtotale (il
                conto nudo) in evidenza, sotto le voci attive una per riga,
                in piccolo e strette; in fondo il Totale che somma tutto.
                Sul telefono il dettaglio parte chiuso: si apre dal
                Subtotale. */}
            {extras > 0 && (
              <>
                <div
                  className="row between"
                  onClick={() => setMostraSupplementi((v) => !v)}
                  style={{ cursor: 'pointer', margin: 0, lineHeight: 1.35 }}
                  title="Il conto senza supplementi — tocca per il dettaglio"
                >
                  <strong style={{ fontSize: '0.95em' }}>
                    Subtotale{' '}
                    <span className="muted" style={{ fontWeight: 400, fontSize: '0.8em' }}>
                      {mostraSupplementi ? '▾' : '▸'}
                    </span>
                  </strong>
                  <strong style={{ fontSize: '0.95em' }}>{formatPrice(confirmedTotal + draftTotal)}</strong>
                </div>
                {mostraSupplementi &&
                  [
                    ['Coperto', Number(order?.coperto_amount || 0)],
                    ['Servizio', Number(order?.service_charge_amount || 0)],
                    ['Mancia', Number(order?.tip_amount || 0)],
                  ]
                    .filter(([, v]) => v > 0)
                    .map(([label, v]) => (
                      <div
                        className="row between muted small"
                        key={label}
                        style={{ margin: 0, lineHeight: 1.3 }}
                      >
                        <span>{label}</span>
                        <span>{formatPrice(v)}</span>
                      </div>
                    ))}
              </>
            )}
            <div className="row between" style={extras > 0 ? { marginTop: 2 } : undefined}>
              <strong>Totale</strong>
              <strong className="price">{formatPrice(confirmedTotal + draftTotal + extras)}</strong>
            </div>
            {/* CHE COSA È STATO PAGATO. C'era una riga sola — «Sconto e acconti
                già incassati −15,00 €» — e quindici euro di che non lo diceva
                nessuno: uno sconto, un acconto, con che metodo, per quali
                righe. Davanti al cliente che chiede, quella riga non
                rispondeva a niente. */}
            {!isNew &&
              (() => {
                const d = dettaglioIncassi(order)
                if (d.sconto <= 0 && d.incassi.length === 0) return null
                return (
                  <div className="posd-incassi">
                    {d.sconto > 0 && (
                      <div className="row between muted small">
                        <span>Sconto</span>
                        <span>−{formatPrice(d.sconto)}</span>
                      </div>
                    )}
                    {d.incassi.map((i, idx) => (
                      <div key={idx} className="posd-incasso">
                        <div className="row between muted small">
                          <span>
                            {/* UN IMPORTO BATTUTO A MANO NON COPRE NESSUNA
                                RIGA: sono soldi lasciati sul conto, e dire il
                                contrario sarebbe inventarselo. Le righe le
                                copre solo chi le sceglie nella schermata di
                                pagamento. */}
                            {i.cosa ? 'Pagate' : 'Acconto'}
                            {i.metodo ? ` · ${paymentMethodLabel(i.metodo)}` : ''}
                            {i.quando ? ` · ${apertoIl(i.quando)}` : ''}
                          </span>
                          <span>−{formatPrice(i.importo)}</span>
                        </div>
                        {i.cosa && (
                          <div className="muted small posd-incasso-cosa">{i.cosa.join(' · ')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}

            {/* Niente tasto Conferma: gli item si confermano da soli (si torna
                con "← Ordini"). I tasti azione sono SEMPRE presenti: quelli non
                applicabili sono disabilitati, non spariscono. */}
            <div className="posd-foot-azioni">
            <div className="grid-2">
              <button className="btn ghost small" disabled={!conRighe} onClick={inviaComanda}>
                <IconPrinter /> Invia comanda
              </button>
              {daRiaprire ? (
                <button
                  className="btn small posd-riapri"
                  onClick={() => setShowRipristino(true)}
                  title="Il conto torna fra quelli aperti"
                >
                  ♻️ Riapri conto
                </button>
              ) : (
                <button
                  className="btn small"
                  disabled={isNew ? !conRighe : !canPay}
                  onClick={isNew ? handlePayNow : () => setShowPayment(true)}
                >
                  <IconCard /> Pagamento{daIncassare > 0 ? ` · ${formatPrice(daIncassare)}` : ''}
                </button>
              )}
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
              disabled={isNew ? !conRighe : closed}
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
                <button
                  className="btn ghost"
                  disabled={!conRighe}
                  onClick={inviaComanda}
                  aria-label="Invia"
                  title="Invia la comanda al banco"
                >
                  <IconPrinter />
                  {!soloIcone && ' Invia'}
                </button>
                {daRiaprire ? (
                  <button
                    className="btn"
                    onClick={() => setShowRipristino(true)}
                    aria-label="Riapri conto"
                    title="Il conto torna fra quelli aperti"
                  >
                    ♻️{!soloIcone && ' Riapri conto'}
                  </button>
                ) : (
                  <button
                    className="btn"
                    disabled={isNew ? !conRighe : !canPay}
                    onClick={isNew ? handlePayNow : () => setShowPayment(true)}
                    aria-label="Paga"
                    title="Incassa il conto"
                  >
                    <IconCard />
                    {!soloIcone && ' Paga'}
                  </button>
                )}
                <button
                  className="btn ghost"
                  disabled={isNew || closed}
                  onClick={() => setConfirmCancel(true)}
                  aria-label="Annulla"
                  title="Annulla l'ordine"
                >
                  <IconX />
                  {!soloIcone && ' Annulla'}
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
        open={showAzioni}
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
            id: 'storia',
            icon: '🕘',
            label: 'Storia del conto',
            hint: 'Aperto, chiuso, annullato, riaperto',
            disabled: isNew,
            onClick: () => setShowStoria(true),
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
          {
            id: 'calcoli',
            icon: '🧮',
            label: mostraCalcoli ? 'Nascondi i calcoli delle righe' : 'Mostra i calcoli delle righe',
            hint: 'Sotto ogni riga, «2 × 5,00 €», come le note',
            onClick: toggleCalcoli,
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

      {/* ── Schermata Pagamento ──
          UNA SOLA, e NON appesa a `isNew`. Erano due rami, uno per la
          creazione (`isNew && payOrder`) e uno per la modifica
          (`!isNew && showPayment`). Al banco: si battono due acque di
          corsa e si preme subito Pagamento, mentre la creazione automatica
          della bozza è ancora in volo. Quando il server risponde, il conto
          esiste — `isNew` diventa falso, il primo ramo sparisce e il
          secondo non ha `showPayment` — e la schermata di pagamento si
          chiudeva DA SOLA, col cliente davanti che stava pagando. Ora
          quello che comanda è "c'è un pagamento in corso", che il conto sia
          nato un istante prima o mezz'ora prima. */}
      {(payOrder || (showPayment && order)) && (
        <PaymentScreen
          order={payOrder || order}
          settings={settings}
          onClose={() => {
            setPayOrder(null)
            setShowPayment(false)
            creatingRef.current = false // pagamento annullato: riabilita l'auto-creazione
          }}
          onPaid={() => {
            // Incassato: la bozza non serve più, né salvata né a schermo.
            clearDraft()
            // In creazione l'id arriva da una PROMESSA: va attesa, se no si
            // "nasconde" un oggetto Promise e il conto pagato resta a
            // schermo nella coda finché il server non lo conferma.
            Promise.resolve(payOrder ? payIdRef.current : order?.id)
              .then((id) => nascondiOrdine(id))
              .catch(() => {})
            navigate('/bar')
          }}
          onBeforePay={flushAll}
          onError={setError}
          resolveOrderId={payOrder ? () => payIdRef.current : undefined}
        />
      )}

      {showStoria && !isNew && (
        <StoriaOrdineDialog order={order} onClose={() => setShowStoria(false)} />
      )}

      {showRipristino && !isNew && (
        <RipristinaOrdineDialog
          order={order}
          onClose={() => setShowRipristino(false)}
          onConferma={(motivo) => {
            setShowRipristino(false)
            mostraOrdine(order.id)
            restoreOrder(order.id, { motivo, chi: chiSonoIo() }).catch((e) =>
              setError(`Conto non ripristinato: ${e.message}`)
            )
          }}
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

      {confirmSvuota && (
        <ConfirmDialog
          title="🧹 Svuotare il conto?"
          message={`Le ${righeDaSvuotare} righe battute finora vengono tolte. Il conto resta aperto, vuoto.`}
          confirmLabel="Svuota"
          cancelLabel="Indietro"
          danger
          onCancel={() => setConfirmSvuota(false)}
          onConfirm={() => {
            setConfirmSvuota(false)
            svuotaTutto()
          }}
        />
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="✖️ Annullare l'ordine?"
          message={
            isNew
              ? 'Le righe battute finora vengono buttate e si torna alla coda. Il conto non è ancora stato aperto.'
              : `L'ordine #${order?.daily_number ?? ''} verrà annullato e le scorte già scalate torneranno a magazzino.`
          }
          confirmLabel="Annulla ordine"
          cancelLabel="Indietro"
          danger
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => {
            setConfirmCancel(false)
            // Conto «nuovo»: la bozza si butta e si torna indietro. MA se
            // nel frattempo l'ordine è nato — l'auto-creazione scatta poco
            // dopo l'ultima riga, e battere quattro cose ci mette di più —
            // quello va ANNULLATO davvero, altrimenti resta aperto in coda
            // con dentro la roba che si è appena buttata. Era il conto
            // fantasma che poi ricompariva aprendo il conto dopo.
            // ANNULLARE LASCIA SEMPRE UN CONTO ANNULLATO. Anche se l'ordine
            // non era ancora nato: il numero è già stato mostrato e preso, e
            // di quello che è stato battuto deve restare traccia — un conto
            // sparito nel nulla non si può nemmeno controllare. Quindi si
            // crea (in locale, immediato) e si annulla.
            if (isNew) {
              const nato = creatingPromiseRef.current || createFromDraftRef.current()
              clearDraft()
              ricordaContoInCorso(null)
              Promise.resolve(nato)
                .then((o) => {
                  if (!o?.id) return null
                  nascondiOrdine(o.id)
                  return cancelOrder(o.id, { by: 'bartender' })
                })
                .catch((e) => toastError(`Annullo non riuscito: ${e.message}`))
              return navigate('/bar')
            }
            cancelOrder(order.id, { by: 'bartender' }).catch((e) => {
              // Non è andata: torni a vederlo in coda, com'è giusto.
              mostraOrdine(order.id)
              toastError(`Annullo non riuscito: ${e.message}`)
            })
            // Sparisce dalla coda SUBITO, senza aspettare il database:
            // altrimenti lo si ritrova lì per un istante e si dubita.
            nascondiOrdine(order.id)
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
