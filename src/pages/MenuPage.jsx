import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { drinkSpeciali, immagineVoce, segnapostoDrink, conParametri, PERCORSO_SPECIALI } from '../lib/speciali.js'
import { useFondoChiaro } from '../lib/useFondoChiaro.js'
import { useIncollata } from '../lib/useIncollata.js'
import { ingredientiInCarta } from '../lib/ingredientiCarta.js'
import CaroselloSpeciali from '../components/CaroselloSpeciali.jsx'
import DettaglioDrink from '../components/DettaglioDrink.jsx'
import SpecialScorrevoli from '../components/SpecialScorrevoli.jsx'
import { stileMenu, stileInVista, nomeStile, disegniDelLocale, vesteDelloStile, ricettaDelloStile } from '../lib/stileMenu.js'
import { testoStile } from '../lib/testiStile.js'
import { temaInProva, stileDelTema } from '../lib/marketplaceTemi.js'
import { strutturaDi } from '../components/stiliStrutturati.js'
import { sezioniPerLoStile } from '../lib/contrattoStile.js'
import { venueDi, pressoIlLocale } from '../lib/venue.js'
import { ordinazioneClientiAttiva } from '../lib/licenza.js'
import { rigaMarchio } from '../lib/limiti.js'
import {
  subscribeServiceStats,
  subscribeSettings,
  subscribeOrder,
  subscribeReadyOrders,
  subscribeOpenGroups,
  subscribeRecentGroups,
  createOrder,
  DEFAULT_SETTINGS,
} from '../lib/api.js'
import { useCart, rememberOrderId, getMyOrderIds, chiaveRiga, rigaDelCarrello, nomeLetto } from '../lib/cart.js'
import { perIlCliente, sezioniDelMenu, strutturaPersonalizzata, perCategoria, pagineDelMenu } from '../lib/strutturaMenu.js'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_EMOJI,
  formatPrice,
  placedByName,
} from '../lib/orderStatus.js'
import { etaForMode } from '../lib/eta.js'
import { checkGeofence, geofenceConfigured } from '../lib/geo.js'
import { ensureNotificationPermission } from '../lib/notify.js'
import { getPushToken } from '../lib/push.js'
import { isFirebaseConfigured, auth } from '../lib/firebaseClient.js'
import { useCustomer } from '../lib/customerAuth.js'
import { onAuthStateChanged } from 'firebase/auth'
import { useMenu, useStrutturaMenu } from '../lib/menuCache.js'
import { isGestore, isPersonale } from '../lib/ruoli.js'
import { idDispositivo } from '../lib/dispositivo.js'
import { printComanda, salaStampaDaSe } from '../lib/printer.js'
import OrderSummary from '../components/OrderSummary.jsx'
import StaffDrawer from '../components/StaffDrawer.jsx'
import CustomDrinkForm from '../components/CustomDrinkForm.jsx'

const NOTIF_PROMPT_KEY = 'drink_notif_prompt_v1' // chiave storica
const WELCOME_KEY = 'drink_welcome_v1'

// `speciali`: la pagina del menù Special (REQ-MENU-018), con le sole voci
// segnate come speciali, nei colori del menù.
export default function MenuPage({ speciali = false }) {
  // Menù dalla cache di modulo: una sola sottoscrizione viva, niente
  // re-fetch a ogni navigazione (solo un refresh forzato ricarica).
  const { drinks: drinksDelMenu, cats, loading: menuInArrivo } = useMenu()
  const { carta, pronta: strutturaPronta } = useStrutturaMenu()
  // Le illustrazioni hanno il tratto bianco sui temi scuri, scuro sui chiari.
  const fondoChiaro = useFondoChiaro()
  const [segnapostoCategorie, categorieIncollate] = useIncollata()
  const posizione = useLocation()
  // Il drink aperto nel dettaglio (REQ-MENU-020), per id: se il menù si
  // aggiorna mentre è aperto, si legge la versione nuova.
  const [apertoId, setApertoId] = useState(null)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  // Le impostazioni partono dai valori di base e arrivano un attimo dopo
  // (dalla cache). Chi deve decidere in base allo stile del menù aspetta
  // quelle vere: vedi il dettaglio aperto dal carosello.
  const [impostazioniArrivate, setImpostazioniArrivate] = useState(false)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showCustomDrink, setShowCustomDrink] = useState(false)
  const [myOrders, setMyOrders] = useState([])
  const [readyOrders, setReadyOrders] = useState([])
  // Staff loggato (bartender/cameriera): gli ordini fatti da qui vengono
  // marcati come manuali con chi li ha inseriti.
  const [staffVero, setStaffVero] = useState(null) // { email, name, role } | null
  // Si sa già chi è? Finché no, `staffVero` null non vuol dire «cliente»:
  // il menù Special vuoto rimanda al menù solo il cliente (REQ-MENU-018).
  const [chiNoto, setChiNoto] = useState(!isFirebaseConfigured)
  // Account cliente (null per anonimi e staff): ordini legati al profilo.
  const { user: customer, profile: customerProfile } = useCustomer()

  useEffect(() => {
    if (!isFirebaseConfigured) return
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setStaffVero(null)
        setChiNoto(true)
        return
      }
      try {
        const token = await u.getIdTokenResult()
        const role = token.claims.role
        // Solo bartender/staff: i clienti registrati ordinano come clienti.
        setStaffVero(
          isPersonale(role)
            ? { email: u.email, name: u.displayName || null, role }
            : null
        )
      } catch {
        setStaffVero(null)
      }
      setChiNoto(true)
    })
  }, [])
  // Benvenuto al primo accesso: spiega come si ordina, il geofence e
  // propone le notifiche. Una sola volta per dispositivo.
  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem(WELCOME_KEY) && !localStorage.getItem(NOTIF_PROMPT_KEY)
  )

  function dismissWelcome(enableNotifications) {
    try {
      localStorage.setItem(WELCOME_KEY, '1')
    } catch { /* storage non disponibile */ }
    setShowWelcome(false)
    if (enableNotifications) ensureNotificationPermission()
  }
  const [params] = useSearchParams()
  const navigate = useNavigate()
  // ANTEPRIMA CLIENTE. Aprendo il menù, chi è collegato come personale
  // trova il suo strumento: catalogo a due colonne, ricerca, gruppi,
  // niente vetrina — serve al cameriere che prende l'ordine al tavolo.
  // "Vista cliente" invece deve mostrare il menù COM'È PER CHI ORDINA: non
  // una schermata a parte, la stessa della home, guardata senza i panni
  // del personale. Con ?vista=cliente si finge di essere un cliente.
  const anteprimaCliente = params.get('vista') === 'cliente'
  const staff = anteprimaCliente ? null : staffVero
  // IL MENÙ DEI CLIENTI (REQ-MENU-025) ha i nomi per il cliente e la sua
  // struttura, se il locale l'ha personalizzata. Chi lavora ordina dal menù
  // del gestionale, coi nomi del banco e per categorie: è quello che conosce.
  const drinks = useMemo(() => (staff ? drinksDelMenu : drinksDelMenu.map(perIlCliente)), [staff, drinksDelMenu])
  const elencoSpeciali = useMemo(() => drinkSpeciali(drinks), [drinks])
  const usaStruttura = !staff && strutturaPersonalizzata(carta)
  // Il cliente aspetta anche la struttura (menuCache.js); chi lavora no.
  const loading = menuInArrivo || (!staff && !strutturaPronta)
  const cart = useCart()

  // Il QR può contenere ?tavolo=12 per identificare il tavolo.
  const tableLabel = params.get('tavolo') || params.get('table') || ''
  const groupParam = params.get('group') || ''


  // Statistiche tempi del servizio (perpetue): alimentano la stima ETA.
  const [serviceStats, setServiceStats] = useState({})
  useEffect(() => {
    if (!isFirebaseConfigured) return
    return subscribeServiceStats(setServiceStats, () => setServiceStats({}))
  }, [])

  // Impostazioni del bar (modalità solo menù, coperto, servizio, mancia…).
  useEffect(() => {
    if (!isFirebaseConfigured) return
    return subscribeSettings((s) => {
      setSettings(s)
      setImpostazioniArrivate(true)
    })
  }, [])

  // Gruppi disponibili per l'associazione (solo staff, con gruppi attivi):
  // gruppi aperti + gruppi-cliente recenti.
  const [openGroups, setOpenGroups] = useState([])
  const [recentGroups, setRecentGroups] = useState([])
  // Il locale (REQ-VENUE-002): hero e benvenuto.
  const venue = venueDi(settings)
  const groupsActive = !!staff && settings.groups_enabled
  useEffect(() => {
    if (!groupsActive) {
      setOpenGroups([])
      return
    }
    return subscribeOpenGroups(setOpenGroups, () => {})
  }, [groupsActive])
  useEffect(() => {
    if (!groupsActive) {
      setRecentGroups([])
      return
    }
    return subscribeRecentGroups(setRecentGroups, () => {})
  }, [groupsActive])

  // Ordini attivi di questo dispositivo: mostrati come box cliccabili in
  // cima al menù, aggiornati in tempo reale.

  // Tabellone "stiamo servendo / pronti al ritiro" (se attivo in impostazioni).
  const servingBoard = settings.show_serving_board && !settings.menu_only
  useEffect(() => {
    if (!isFirebaseConfigured || !servingBoard) {
      setReadyOrders([])
      return
    }
    return subscribeReadyOrders(setReadyOrders)
  }, [servingBoard])
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setMyOrders([])
      return
    }
    const ACTIVE = [
      ORDER_STATUSES.RICEVUTO,
      ORDER_STATUSES.IN_PREPARAZIONE,
      ORDER_STATUSES.PRONTO,
    ]
    // Gli id più recenti sono in testa; bastano i primi 10.
    const ids = getMyOrderIds().slice(0, 10)
    const unsubs = ids.map((id) =>
      subscribeOrder(
        id,
        (o) => {
          setMyOrders((prev) => {
            const others = prev.filter((p) => p.id !== id)
            const isActive = o && ACTIVE.includes(o.workflow_status)
            const next = isActive ? [...others, o] : others
            next.sort((a, b) => (b.daily_number || 0) - (a.daily_number || 0))
            return next
          })
        },
        () => {}
      )
    )
    return () => {
      unsubs.forEach((u) => u())
      setMyOrders([])
    }
  }, [])

  // IL MENÙ È UNO SOLO, quello che vede il cliente. C'è stata una seconda
  // schermata per lo staff — catalogo a due colonne con la ricerca — nata per
  // gli ordini battuti a mano: quelli si battono al POS, e chi apriva il menù
  // dal gestionale si trovava una pagina diversa da quella che stava
  // mostrando al tavolo. Ordinare da qui si può lo stesso, se le impostazioni
  // lo consentono (vedi `canOrder`).
  // La ricerca dello staff riduce il menù alle voci che rispondono, per
  // nome o ingrediente; le categorie rimaste vuote spariscono da sole.
  const [ricerca, setRicerca] = useState('')
  // La pagina del menù scelta, quando il tema lo divide in pagine
  // (REQ-MENU-030); null è la prima.
  const [paginaScelta, setPaginaScelta] = useState(null)
  const categories = useMemo(() => {
    const ricercaAttiva = ricerca.trim().toLowerCase()
    // Nel menù Special si guardano solo gli special, in un gruppo solo.
    const base = speciali ? elencoSpeciali : drinks
    const visibili = ricercaAttiva
      ? base.filter(
          (d) =>
            d.name?.toLowerCase().includes(ricercaAttiva) ||
            (d.recipe_items || []).some((r) => r.name?.toLowerCase().includes(ricercaAttiva))
        )
      : base
    if (speciali) return visibili.length ? [[settings.special_titolo || 'Special', visibili]] : []
    if (usaStruttura) return sezioniDelMenu(carta, drinks)
    return perCategoria(visibili, cats).map((g) => [g.nome, g.prodotti])
  }, [drinks, cats, ricerca, speciali, elencoSpeciali, settings.special_titolo, usaStruttura, carta])
  // Le stesse sezioni nella forma del contratto degli stili strutturati
  // (REQ-MENU-028). Calcolate una volta per elenco: il giornale riosserva le
  // sue sezioni quando cambiano, e non deve farlo a ogni «Aggiungi».
  const sezioniDelloStile = useMemo(() => sezioniPerLoStile(categories), [categories])

  // Arrivando dal carosello su un drink, la pagina Special si apre su quello,
  // col suo dettaglio aperto: chi tocca una slide vuole sapere di quel drink
  // (REQ-MENU-020). Una volta sola per indirizzo: chiuso il dettaglio, non
  // si riapre quando il menù si aggiorna.
  const [hashAperto, setHashAperto] = useState(null)
  useEffect(() => {
    if (!speciali || !posizione.hash) return
    const id = decodeURIComponent(posizione.hash.slice(1))
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView?.({ block: 'start' })
    // Nello stile «Notte» la scena del drink dice già tutto: ci si porta
    // lì e basta, senza aprirgli sopra il dettaglio. Lo stile si sa solo
    // quando arrivano le impostazioni vere: prima, con quelle di base,
    // avrebbe aperto il dettaglio sopra la scena.
    if (!impostazioniArrivate) return
    if (hashAperto !== posizione.hash && id.startsWith('speciale-') && stileMenu(settings) !== 'notte') {
      setHashAperto(posizione.hash)
      setApertoId(id.slice('speciale-'.length))
    }
  }, [speciali, posizione.hash, categories.length, hashAperto, settings, impostazioniArrivate])

  // ── Geofence: verificato AL CARICAMENTO del menu (lo staff è esente).
  // Finché la posizione non risulta nel raggio, i controlli per ordinare
  // restano disattivati. null = gate non attivo.
  const [geoGate, setGeoGate] = useState(null) // null|'checking'|'ok'|'denied'|'out_of_range'
  const [geoInfo, setGeoInfo] = useState(null) // { distance, radius }
  const geoActive = !staff && geofenceConfigured(settings)

  async function runGeoCheck() {
    setGeoGate('checking')
    const geo = await checkGeofence(settings)
    setGeoInfo(geo.distance != null ? { distance: geo.distance, radius: geo.radius } : null)
    if (geo.status === 'ok') setGeoGate('ok')
    else if (geo.status === 'out_of_range') setGeoGate('out_of_range')
    else setGeoGate('denied')
  }

  useEffect(() => {
    if (!geoActive) {
      setGeoGate(null)
      return
    }
    runGeoCheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoActive, settings.venue_lat, settings.venue_lng, settings.venue_radius_m])

  const [checkingGeo, setCheckingGeo] = useState(false)

  async function handleReviewOrder() {
    if (cart.items.length === 0) return
    setError(null)

    // Ri-verifica di prossimità appena prima dell'ordine.
    if (geoActive) {
      setCheckingGeo(true)
      const geo = await checkGeofence(settings)
      setCheckingGeo(false)
      if (geo.status !== 'ok') {
        setGeoGate(geo.status === 'out_of_range' ? 'out_of_range' : 'denied')
        setGeoInfo(geo.distance != null ? { distance: geo.distance, radius: geo.radius } : null)
        return
      }
      setGeoGate('ok')
    }

    setShowSummary(true)
  }

  async function handleConfirmOrder({ pay_online, payment_required, ...extraCharges }) {
    setSending(true)
    setError(null)
    try {
      // Token push del dispositivo (se le notifiche sono attive): permette
      // alla Cloud Function di notificare anche ad app chiusa.
      // Niente token push per gli ordini manuali: le notifiche andrebbero
      // al telefono dello staff, non al cliente (che aggancia l'ordine
      // scansionando il QR dalla pagina ordine).
      const push_token = staff ? null : await getPushToken()
      const order = await createOrder({
        table_label: tableLabel,
        items: cart.items,
        push_token,
        // Con il terminale da cui e' partito: l'avviso lo salta solo chi
        // l'ha mandato, non tutti quelli con lo stesso ruolo.
        placed_by: staff ? { ...staff, device: idDispositivo() } : null,
        customer_uid: customer?.uid ?? null,
        // Pagamento online: il checkout avviene sulla pagina ordine.
        payment_method: pay_online ? 'online' : null,
        payment_status: pay_online ? 'in_attesa' : 'non_richiesto',
        payment_required: !!payment_required,
        ...extraCharges,
      })
      rememberOrderId(order.id)
      // LA COMANDA DI CHI PRENDE L'ORDINE AL TAVOLO. Prima non usciva
      // niente: si sperava che al banco qualcuno avesse la coda aperta con
      // la stampa automatica accesa. Ora la stampa il telefono che ha preso
      // l'ordine — ha l'IP, la configurazione arriva dal server — a meno che
      // il locale non abbia scelto di farla uscire al banco ('rimbalzo').
      // La stampa non si aspetta: se fallisce lo dice il pallino nella coda,
      // e l'ordine è comunque salvato.
      if (staff && salaStampaDaSe()) {
        printComanda(order, order.comande?.at(-1) ?? null).catch((e) =>
          console.warn('[printer] comanda sala:', e.message)
        )
      }
      cart.clear()
      navigate(`/ordine/${order.id}`)
    } catch (e) {
      setError(e.message)
      setShowSummary(false)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="empty">Carico il menù…</div>

  // GLI SPECIAL SENZA SPECIAL NON ESISTONO, per il cliente. L'utente,
  // 04/11/2026: senza drink speciali «il menù special deve risultare vuoto
  // e non raggiungibile al pubblico». Il QR degli Special resta stampato
  // sui menù da tavolo anche quando gli special finiscono: chi lo inquadra
  // va al menù, con lo stesso tavolo, invece che su una pagina vuota. Chi
  // lavora resta, e legge perché è vuota.
  if (speciali && elencoSpeciali.length === 0 && chiNoto && !staffVero) {
    return <Navigate to={conParametri('/menu', params)} replace />
  }

  // «Solo menù» per scelta del locale, o perché il modulo degli ordini dal
  // telefono non è nel piano (REQ-LIC-002).
  const menuOnly = settings.menu_only || !ordinazioneClientiAttiva(settings)
  // Il servizio è PERPETUO: non esiste più una serata da aprire. A decidere
  // se si può ordinare resta la modalità "solo menù" (l'interruttore del
  // servizio): a servizio chiuso spariscono i pulsanti "Aggiungi" e il
  // carrello. Lo staff loggato può inserire ordini manuali comunque.
  // Con geofence attivo si ordina solo a posizione verificata.
  // E NELLA VISTA CLIENTE NON SI ORDINA (BUG-127). L'utente, 02/11/2026: «la
  // vista cliente deve solo mostrare il menù come lo vede il cliente».
  // Con «Aggiungi» e carrello, un admin in anteprima mandava un ordine come
  // un cliente qualunque: senza `placed_by`, anonimo in coda. Per ordinare
  // c'è il menù dello staff, senza `?vista=cliente`.
  const geoOk = !geoActive || geoGate === 'ok'
  const canOrder = !anteprimaCliente && (!menuOnly || !!staff) && geoOk

  // I tasti per ordinare un drink: gli stessi nella card e nel dettaglio.
  const tastiOrdine = (d) => {
    if (!canOrder) return null
    // La riga del carrello si riconosce da quello che arriva al banco (il
    // drink, e il nome letto dal cliente): cart.js, chiaveRiga.
    const chiave = chiaveRiga(rigaDelCarrello(d))
    const inCart = cart.items.find((i) => chiaveRiga(i) === chiave)
    return inCart ? (
      <div className="qty">
        <button aria-label="Riduci" onClick={() => cart.setQty(chiave, inCart.qty - 1)}>
          −
        </button>
        <strong>{inCart.qty}</strong>
        <button aria-label="Aumenta" onClick={() => cart.setQty(chiave, inCart.qty + 1)}>
          +
        </button>
      </div>
    ) : (
      <button className="btn small" onClick={() => cart.add(d)}>
        Aggiungi
      </button>
    )
  }
  // Si apre toccando la card ovunque, tranne che sui suoi tasti.
  const apriDaCard = (d) => (e) => {
    if (e.target.closest?.('button, a, input, select, textarea, label')) return
    setApertoId(d.id)
  }
  // Il dettaglio è quello di ciò che si è toccato: nella struttura
  // personalizzata una VOCE (il suo nome, la sua descrizione), che ha un id
  // suo. Si cerca fra quello che si vede, poi fra i drink (il carosello).
  const aperto = apertoId
    ? categories.flatMap(([, list]) => list).find((x) => x.id === apertoId) ||
      drinks.find((x) => x.id === apertoId) ||
      null
    : null

  // Tempo stimato mostrato nel menù: per la modalità "entrambi" usa la stima
  // fino al "pronto" (parte comune); il riepilogo ordine poi la adatta alla
  // scelta del cliente.
  // La stima nasce dai tempi di lavorazione: senza gestione preparazione
  // non ci sono tempi da misurare, quindi non si mostra nulla.
  const etaMinutes = settings.eta_enabled && settings.workflow_enabled !== false
    ? etaForMode(settings.service_mode === 'tavolo' ? 'tavolo' : 'banco', {
        etaStats: serviceStats.eta_stats,
        prepStats: serviceStats.prep_stats,
        baseMinutes: settings.eta_base_minutes,
      })
    : null

  // LO STILE DEL MENÙ (REQ-MENU-021): la forma che il locale ha scelto per
  // i clienti. Chi lavora vede sempre il classico: per lui è uno strumento.
  // LO STILE DEL MENÙ (REQ-MENU-021, REQ-MENU-022): quello scelto dal
  // locale; o, nell'anteprima del cliente aperta da chi lavora, quello in
  // prova (`?stile=…`, da Impostazioni → Menù clienti). La prova la vede
  // solo chi l'ha aperta: i clienti vedono lo stile del locale.
  // Un tema in prova dal marketplace (REQ-MENU-023) porta il suo stile; i
  // colori li mette App.
  const temaProvato = anteprimaCliente && staffVero ? temaInProva(settings, posizione.search) : null
  const stileInProva = anteprimaCliente && staffVero ? params.get('stile') || stileDelTema(temaProvato) : null
  const stile = stileInVista(settings, { lavoro: Boolean(staff), prova: stileInProva })
  const notte = stile === 'notte'
  // «GIORNALE» (REQ-MENU-024) ha una struttura sua — testata, sommario,
  // prima pagina, sezioni — e le sue immagini, incisioni: non è una veste
  // sopra le card del classico.
  // Lo stesso per ogni stile strutturato (REQ-MENU-028): disegna lui
  // testata e corpo, col pacchetto del contratto (lib/contrattoStile.js).
  const struttura = strutturaDi(stile)
  // Il segno dei disegni, deciso una volta: lo usano il giornale e il
  // dettaglio, che devono mostrare lo stesso disegno.
  const segnoDisegni = struttura?.segno || 'tenniel'
  // I disegni sono del locale che ha «Notte» (REQ-LIC-013).
  const disegni = disegniDelLocale(settings)
  const perLoStile = struttura && {
    venue,
    sezioni: sezioniDelloStile,
    speciali: elencoSpeciali,
    soloSpeciali: speciali,
    special: { titolo: settings.special_titolo || 'Special', sottotitolo: settings.special_sottotitolo || null },
    linkMenu: conParametri('/menu', params),
    immagine: (d) => immagineVoce(d, import.meta.env.BASE_URL, { chiaro: fondoChiaro, segno: segnoDisegni, disegni }),
    apri: (d) => setApertoId(d.id),
    tastiOrdine,
    quantita: !!settings.show_ingredient_quantities,
    testo: (k, diSempre) => testoStile(stile, k, diSempre),
  }
  const specialNotte = notte && speciali

  // ── L'IMPAGINAZIONE DEL TEMA (REQ-MENU-030) ─────────────────────────
  // Uno stile a ricetta (REQ-MENU-031, e i temi su misura che ne portano
  // una) può dividere il menù in pagine: una per sezione, o una per gruppo
  // di sezioni. Le schede in alto allora cambiano pagina invece di far
  // scorrere fino alla sezione. Solo per i clienti (chi lavora ordina dal
  // menù intero) e fuori dalla pagina Special, che è già una pagina sola.
  // Gli stili strutturati disegnano il loro corpo e ricevono le sezioni
  // tutte: non sono a ricetta.
  const impaginazione = staff || speciali ? 'unica' : ricettaDelloStile(settings, stile)?.impaginazione || 'unica'
  const pagine = struttura ? null : pagineDelMenu(categories, impaginazione)
  const pagina = pagine ? pagine.find((p) => p.id === paginaScelta) || pagine[0] : null
  const sezioniInVista = pagina ? pagina.sezioni : categories
  // Cambiando pagina con le schede già agganciate in alto, si torna
  // all'inizio della pagina nuova: restando dov'era, si leggerebbe la nuova
  // pagina a metà, o il fondo vuoto sotto una pagina più corta.
  const vaiAPagina = (p) => {
    setPaginaScelta(p.id)
    if (!categorieIncollate) return
    const [primaSezione] = p.sezioni[0]
    requestAnimationFrame(() =>
      document.getElementById(`cat-${encodeURIComponent(primaSezione)}`)?.scrollIntoView?.({ block: 'start' })
    )
  }

  // La veste dello stile sul contenitore: la sua classe, o il motore delle
  // ricette coi suoi attributi.
  const veste = vesteDelloStile(settings, stile)

  return (
    <div
      className={[staff ? 'bar-content' : '', veste.className].filter(Boolean).join(' ') || undefined}
      style={veste.style}
      {...veste.attributi}
    >
      {staff && <StaffDrawer role={staff.role} active="ordine" />}
      {/* In anteprima si vede il menù del cliente, ma si è pur sempre al
          lavoro: una riga per ricordarlo e per tornare indietro. Niente
          «da qui non si ordina»: il cliente da questo menù ordina eccome,
          e la frase confondeva (l'utente, 03/11/2026: «non ha senso»). Che
          in anteprima manchi «Aggiungi» si vede da sé. */}
      {anteprimaCliente && staffVero && (
        <div className="anteprima-cliente">
          <span>
            👀 {temaProvato
              ? `Stai provando il tema «${temaProvato.nome}»: i clienti vedono ancora quello scelto.`
              : stileInProva && stile === stileInProva
                ? `Stai provando lo stile «${nomeStile(stileInProva, settings)}»: i clienti vedono ancora quello scelto.`
                : 'Stai guardando il menù come lo vede il cliente.'}
          </span>
          <Link className="btn ghost small" to="/bar">
            ← Torna al gestionale
          </Link>
        </div>
      )}
      {/* Hero d'intestazione solo per i clienti: allo staff serve spazio. */}
      {struttura && <struttura.Testata {...perLoStile} />}
      {!staff && !specialNotte && !struttura && (
        <div className="hero">
          <img
            className="hero-img"
            src="/cocktail-hero.jpg"
            alt={venue.venue_name}
            onError={(e) => (e.target.style.display = 'none')}
          />
          <div className="hero-overlay">
            <img
              className="hero-logo"
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt=""
            />
            <h1 className="hero-title">{venue.venue_name}</h1>
            <p className="hero-sub">
              {tableLabel
                ? `Tavolo ${tableLabel}`
                : menuOnly
                  ? testoStile(stile, 'menu.sola-lettura', 'Cocktail Bar · Menù')
                  : testoStile(stile, 'menu.invito', 'Scegli i tuoi drink e invia l’ordine al bancone.')}
            </p>
          </div>
        </div>
      )}

      {staff && !menuOnly && (
        <p className="muted" style={{ margin: '4px 4px 10px' }}>
          ✍️ Inserimento ordine da <strong>{placedByName(staff)}</strong>
        </p>
      )}

      {/* RICERCA, solo per lo staff: chi prende l'ordine col cliente davanti
          non può scorrere otto categorie per trovare un drink. Il cliente
          invece il menù lo sfoglia: per lui resta la vetrina com'è. */}
      {staff && (
        <input
          type="search"
          className="menu-search"
          placeholder="🔍 Cerca nel menù…"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          style={{ margin: '0 0 10px' }}
        />
      )}

      {/* Drink custom: solo il bartender compone voci fuori menù al volo. */}
      {isGestore(staff?.role) && !menuOnly && canOrder && (
        <button
          className="btn secondary block"
          style={{ marginBottom: 10 }}
          onClick={() => setShowCustomDrink(true)}
        >
          🏷 Prodotto libero (fuori menù)
        </button>
      )}
      {showCustomDrink && (
        <CustomDrinkForm
          onCancel={() => setShowCustomDrink(false)}
          onAdd={(item) => {
            cart.addCustom(item)
            setShowCustomDrink(false)
          }}
        />
      )}

      {menuOnly && !staff && (
        <div className="banner">
          📖 Solo consultazione: le ordinazioni sono momentaneamente sospese.
          Rivolgersi allo staff per ordinare.
        </div>
      )}

      {/* LA TESTATA DEL MENÙ SPECIAL (REQ-MENU-018): titolo, tema, e la
          strada per il menù completo, con lo stesso tavolo. */}
      {speciali && !specialNotte && !struttura && (
        <div className="speciali-testata">
          <h2>{settings.special_titolo || 'Special'}</h2>
          {settings.special_sottotitolo && <p className="speciali-tema">{settings.special_sottotitolo}</p>}
          <Link className="btn ghost small" to={conParametri('/menu', params)}>
            ← Tutto il menù
          </Link>
        </div>
      )}

      {/* IL CAROSELLO DEGLI SPECIAL (REQ-MENU-018), in cima al menù del
          cliente: toccando un drink si va al menù Special, su quel drink.
          Chi lavora non lo vede: per lui il menù è uno strumento. */}
      {!speciali && !staff && !struttura && elencoSpeciali.length > 0 && (
        <section className="speciali-carosello" aria-label={settings.special_titolo || 'Special'}>
          <div className="row between speciali-carosello-testa">
            <h3 className="cat-header" style={{ margin: 0 }}>
              {/* La ✨ è del classico: sul libro di «Meraviglie» e sulla
                  carta di «Notte» stona. */}
              {notte || stile === 'meraviglie' ? '' : '✨ '}
              {settings.special_titolo || 'Special'}
            </h3>
            <Link className="speciali-tutti" to={conParametri(PERCORSO_SPECIALI, params)}>
              Vedi tutti ›
            </Link>
          </div>
          {settings.special_sottotitolo && <p className="muted small" style={{ margin: '2px 0 8px' }}>{settings.special_sottotitolo}</p>}
          <CaroselloSpeciali
            voci={elencoSpeciali}
            chiaro={fondoChiaro}
            disegni={disegni}
            link={(d) => `${conParametri(PERCORSO_SPECIALI, params)}#speciale-${d.id}`}
          />
        </section>
      )}

      {/* Il cliente qui non arriva (sopra lo si rimanda al menù): chi lavora
          sì, e legge perché la pagina è vuota. */}
      {speciali && elencoSpeciali.length === 0 && (
        <p className="empty">Nessun drink speciale. Finché non ce ne sono, i clienti che aprono questa pagina vanno al menù completo.</p>
      )}

      {etaMinutes != null && !menuOnly && (
        <p className="eta-line">
          ⏱ {settings.service_mode === 'tavolo' ? 'Tempo di servizio' : 'Tempo di preparazione'}:
          {' '}~{etaMinutes} min
        </p>
      )}

      {servingBoard && readyOrders.length > 0 && (() => {
        const tavolo = readyOrders.filter((r) => r.service_mode === 'tavolo')
        const banco = readyOrders.filter((r) => r.service_mode !== 'tavolo')
        if (settings.service_mode === 'entrambi') {
          return (
            <>
              {tavolo.length > 0 && (
                <ServingBox icon="🍸" label={tavolo.length === 1 ? 'Stiamo servendo il numero' : 'Stiamo servendo i numeri'} orders={tavolo} />
              )}
              {banco.length > 0 && (
                <ServingBox icon="🔔" label={banco.length === 1 ? 'Pronto al ritiro il numero' : 'Pronti al ritiro i numeri'} orders={banco} />
              )}
            </>
          )
        }
        const label =
          settings.service_mode === 'banco'
            ? readyOrders.length === 1 ? 'Pronto al ritiro il numero' : 'Pronti al ritiro i numeri'
            : readyOrders.length === 1 ? 'Stiamo servendo il numero' : 'Stiamo servendo i numeri'
        return (
          <ServingBox
            icon={settings.service_mode === 'banco' ? '🔔' : '🍸'}
            label={label}
            orders={readyOrders}
          />
        )
      })()}

      {/* Gate geolocalizzazione: stato della verifica al caricamento */}
      {geoActive && geoGate === 'checking' && (
        <div className="banner">📍 Verifico che sei al locale…</div>
      )}
      {geoActive && geoGate === 'denied' && (
        <div className="banner row between" style={{ alignItems: 'center', gap: 10 }}>
          <span>
            📍 Per ordinare serve la tua posizione: attiva la localizzazione e
            consenti l’accesso (verifichiamo solo che sei al locale).
          </span>
          <button className="btn small" style={{ flexShrink: 0 }} onClick={runGeoCheck}>
            Riprova
          </button>
        </div>
      )}
      {geoActive && geoGate === 'out_of_range' && (
        <div className="banner row between" style={{ alignItems: 'center', gap: 10 }}>
          <span>
            📍 Devi essere al locale per ordinare
            {geoInfo ? ` (sei a ~${geoInfo.distance} m, massimo ${geoInfo.radius} m)` : ''}.
          </span>
          <button className="btn small" style={{ flexShrink: 0 }} onClick={runGeoCheck}>
            Riprova
          </button>
        </div>
      )}

      {error && <div className="banner">Errore: {error}</div>}

      {/* GLI ORDINI QUI NON CI STANNO, per chi lavora. Questa schermata, per
          il personale, serve a UNA cosa: battere un ordine dalla vista del
          menù. La coda è un'altra pagina, e vederci in mezzo i propri
          ordini attivi confondeva due mestieri — al cliente invece servono,
          perché è l'unico posto dove ritrova quello che ha ordinato. */}
      {!staff &&
        myOrders.map((o) => (
        <Link key={o.id} to={`/ordine/${o.id}`} className="card order-mini row between">
          <div>
            <div>
              <strong>Ordine #{o.daily_number ?? '—'}</strong>{' '}
              <span className="muted">
                · {(o.order_items || []).reduce((s, i) => s + i.qty, 0)} drink ·{' '}
                <span className="price">{formatPrice(o.total)}</span>
              </span>
            </div>
            <span className={`pill ${o.workflow_status}`} style={{ marginTop: 6 }}>
              {STATUS_EMOJI[o.workflow_status]} {STATUS_LABELS[o.workflow_status]}
            </span>
          </div>
          <span className="order-mini-chev">›</span>
        </Link>
        ))}

      {drinks.length === 0 && !error && (
        <div className="empty">
          Nessun drink disponibile al momento.
        </div>
      )}

      {staff && ricerca.trim() && drinks.length > 0 && categories.length === 0 && (
        <div className="empty">Niente nel menù che risponda a «{ricerca.trim()}».</div>
      )}

      {!speciali && !struttura && categories.length > 1 && <div ref={segnapostoCategorie} aria-hidden="true" />}
      {!speciali && !struttura && categories.length > 1 && (
        // Le sezioni di una struttura personalizzata sono poche e grandi, in
        // schede che restano in alto mentre si scorre (Flavio, 04/11/2026:
        // «come se fosse un tab che deve restare sempre fisso bloccato in
        // alto»).
        <nav
          className={`cat-nav${usaStruttura ? ' carta' : ''}${categorieIncollate ? ' incollata' : ''}`}
          aria-label={pagine ? 'Pagine del menù' : undefined}
        >
          {pagine
            ? pagine.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="cat-chip"
                  aria-pressed={p.id === pagina.id}
                  onClick={() => vaiAPagina(p)}
                >
                  {p.nome}
                </button>
              ))
            : categories.map(([cat]) => (
                <a key={cat} href={`#cat-${encodeURIComponent(cat)}`} className="cat-chip">
                  {cat}
                </a>
              ))}
        </nav>
      )}

      {specialNotte && (
        <SpecialScorrevoli
          voci={elencoSpeciali}
          titolo={settings.special_titolo || 'Special'}
          sottotitolo={settings.special_sottotitolo}
          linkMenu={conParametri('/menu', params)}
          chiaro={fondoChiaro}
          disegni={disegni}
          tastiOrdine={tastiOrdine}
        />
      )}

      {struttura && <struttura.Corpo {...perLoStile} />}

      {!specialNotte && !struttura && sezioniInVista.map(([cat, list, sezione]) => (
        // NEL MENÙ SPECIAL LE CARD STANNO IN GRIGLIA, due per riga sul
        // telefono e tre sugli schermi larghi: una per riga, ognuna col suo
        // disegno grande, era una colonna lunghissima (l'utente, 29/10/2026:
        // «li metterei su due colonne anziché incolonnati ad uno ad uno»).
        // UNA SEZIONE SNELLA (REQ-MENU-025) è un elenco di nomi e prezzi:
        // acqua e Coca-Cola non hanno niente da raccontare.
        <section
          key={sezione?.id ?? cat}
          className={speciali ? 'speciali-griglia' : sezione?.vista === 'snella' ? 'carta-snella' : undefined}
        >
          {!speciali && <h3 className="cat-header" id={`cat-${encodeURIComponent(cat)}`}>{cat}</h3>}
          {list.map((d) => {
            // La foto, o il disegno, o il bicchiere neutro.
            const img = immagineVoce(d, import.meta.env.BASE_URL, { chiaro: fondoChiaro, disegni })
            return (
              // TOCCANDO LA CARD SI APRE IL DETTAGLIO (REQ-MENU-020). Il
              // tocco sulla card è per il dito; per la tastiera e per chi
              // legge lo schermo c'è il nome, che è un tasto vero.
              <div
                className={`card menu-item${speciali ? ' speciale' : ''}`}
                key={d.id}
                id={speciali ? `speciale-${d.id}` : undefined}
                onClick={apriDaCard(d)}
              >
                {speciali && (
                  <img
                    className={`speciale-img${img ? '' : ' segnaposto'}`}
                    src={img || segnapostoDrink({ chiaro: fondoChiaro })}
                    alt=""
                    loading="lazy"
                  />
                )}
                <div className="row between">
                  {/* IL DISEGNO PIÙ GRANDE DELLA FOTO, e intero. Nella casella
                      da 64 px della foto i disegni dei drink si leggevano
                      appena, ritagliati per riempire il quadrato (l'utente,
                      02/11/2026: «le immagini stilizzate dei drink
                      dovrebbero essere più grandi»). */}
                  {!speciali && sezione?.vista !== 'snella' && (
                    <img
                      className={`drink-thumb${img ? (d.image_url ? '' : ' disegno') : ' placeholder'}`}
                      src={img || segnapostoDrink({ chiaro: fondoChiaro })}
                      alt={d.name}
                      loading="lazy"
                    />
                  )}
                  <div className="grow">
                    <h3>
                      <button type="button" className="menu-item-nome" onClick={() => setApertoId(d.id)}>
                        {d.name}
                      </button>
                    </h3>
                    {/* Corta, tre righe: per intero sta nel dettaglio. */}
                    {d.description && <p className="muted menu-item-descrizione">{d.description}</p>}
                    {/* IN CARTA CI VA QUELLO CHE SI BEVE (REQ-MENU-019):
                        quello scritto nella scheda, o la ricetta senza
                        manodopera, ghiaccio e formati di confezione. Le
                        regole stanno in lib/ingredientiCarta.js. */}
                    {(() => {
                      const ingredienti = ingredientiInCarta(d, { quantita: !!settings.show_ingredient_quantities })
                      if (!ingredienti) return null
                      return <p className="ingredients">{ingredienti.join(' · ')}</p>
                    })()}
                    <span className="price">{formatPrice(d.price)}</span>
                  </div>
                  {tastiOrdine(d)}
                </div>
              </div>
            )
          })}
        </section>
      ))}

      {/* LA FIRMA DEL PRODOTTO (REQ-LIC-003, `limiti.marchio`): in fondo al
          menù, solo se la licenza la chiede. */}
      {rigaMarchio(settings) && <p className="marchio-prodotto muted">{rigaMarchio(settings)}</p>}

      {canOrder && cart.count > 0 && (
        <div className="cartbar">
          <div className="inner">
            <div className="cartbar-items">
              {cart.items.map((i) => (
                <div className="row between" key={chiaveRiga(i)}>
                  <span>
                    <strong>{i.qty}×</strong> {nomeLetto(i)}
                  </span>
                  <span className="muted">{formatPrice(i.qty * Number(i.price || 0))}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="inner row between">
            <div>
              <div>
                <strong>{cart.count}</strong> drink ·{' '}
                <span className="price">{formatPrice(cart.total)}</span>
              </div>
              <button
                className="btn ghost small"
                style={{ marginTop: 6 }}
                onClick={cart.clear}
              >
                Svuota
              </button>
            </div>
            <button
              className="btn"
              disabled={sending || checkingGeo}
              onClick={handleReviewOrder}
            >
              {checkingGeo ? '📍 Verifico…' : 'Rivedi ordine'}
            </button>
          </div>
        </div>
      )}

      {showWelcome && !staff && (
        <div className="overlay confirm-overlay" onClick={() => dismissWelcome(false)}>
          <div className="confirm-box welcome-modal" onClick={(e) => e.stopPropagation()}>
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt=""
              style={{ width: 56, height: 56, borderRadius: '50%', display: 'block', margin: '0 auto 8px' }}
            />
            <h3 style={{ margin: '0 0 4px', textAlign: 'center' }}>
              Benvenuto {pressoIlLocale(venue)}
            </h3>
            <p className="muted" style={{ margin: '0 0 14px', textAlign: 'center', fontSize: '0.88rem' }}>
              Ecco come funziona l’ordinazione:
            </p>
            <div className="welcome-steps">
              <div className="welcome-step">
                <span>🍸</span>
                <span>Scegli i drink dal menù e aggiungili al carrello.</span>
              </div>
              <div className="welcome-step">
                <span>🧾</span>
                <span>Tocca «Rivedi ordine», lascia il tuo nome e conferma: l’ordine arriva dritto al bancone.</span>
              </div>
              {settings.geofence_enabled && (
                <div className="welcome-step">
                  <span>📍</span>
                  <span>
                    Per ordinare devi trovarti <strong>al locale</strong>: ti
                    chiederemo la posizione solo per verificare che sei nei
                    paraggi — non viene salvata.
                  </span>
                </div>
              )}
              <div className="welcome-step">
                <span>🔔</span>
                <span>
                  Segui lo stato in tempo reale: con le notifiche attive ti
                  avvisiamo noi quando il drink è pronto.
                </span>
              </div>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <button className="btn ghost grow" onClick={() => dismissWelcome(false)}>
                Inizia
              </button>
              {'Notification' in window && Notification.permission === 'default' && (
                <button className="btn grow" onClick={() => dismissWelcome(true)}>
                  🔔 Attiva notifiche
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <DettaglioDrink
        drink={aperto}
        chiaro={fondoChiaro}
        segno={segnoDisegni}
        disegni={disegni}
        quantita={!!settings.show_ingredient_quantities}
        azioni={aperto && tastiOrdine(aperto)}
        onClose={() => setApertoId(null)}
      />

      {showSummary && (
        <OrderSummary
          cart={cart}
          settings={settings}
          serviceStats={serviceStats}
          tableLabel={tableLabel}
          staff={staff}
          customerProfile={customerProfile}
          sending={sending}
          groupsActive={groupsActive}
          groups={[...openGroups, ...recentGroups]}
          initialGroupId={groupParam}
          onConfirm={handleConfirmOrder}
          onCancel={() => !sending && setShowSummary(false)}
        />
      )}
    </div>
  )
}

// Tabellone "stiamo servendo / pronti al ritiro" con i numeri degli ordini.
function ServingBox({ icon, label, orders }) {
  return (
    <div className="card serving-box">
      <div className="muted">{icon} {label}</div>
      <div className="serving-nums">
        {orders.map((o) => (
          <span key={o.daily_number} className="serving-num">#{o.daily_number}</span>
        ))}
      </div>
    </div>
  )
}
