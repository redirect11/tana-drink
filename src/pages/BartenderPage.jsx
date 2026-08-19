import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import {
  updateOrderStatus,
  markOrderPaid,
  cancelOrder,
  subscribeActiveOrders,
  subscribeSettings,
  DEFAULT_SETTINGS,
  settingsIniziali,
  saveStaffToken,
  restoreOrder,
  advanceComanda,
  segnaComandaStampata,
} from '../lib/api.js'
import { getPushToken } from '../lib/push.js'
import { logoutStaff } from '../lib/logout.js'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_EMOJI,
  ritiratoLabel,
  formatPrice,
  nextStatus,
  statoAlBanco,
  placedByName,
  placedByLetter,
} from '../lib/orderStatus.js'
import {
  bucketByStatus,
  ordersRecap,
  ordineCorrisponde,
  primoCorrispondente,
  inseritiDa,
  restaInCoda,
  ordiniInCoda,
  contiPerScheda,
  SCHEDE_VUOTE,
  voceCassa,
  comandeDaServire,
  haLavoroDaFare,
  gruppiInCoda,
  schedeCoda,
  corsieDiStato,
  corsieComande,
  attesaPagamento,
  corsieDaMostrare,
  corsieSceglibili,
  corsieDelPronto,
  CORSIE_SPENTE_ALL_INIZIO,
  SOTTOFILTRI_CHIUSI,
} from '../lib/coda.js'
import { StoriaOrdineDialog, RipristinaOrdineDialog } from '../components/StoriaOrdine.jsx'
import { useTelefono } from '../lib/useTelefono.js'
import StatusBell from '../components/StatusBell.jsx'
import ActionSheet from '../components/ActionSheet.jsx'
import {
  isBanco,
  isGestore,
  isPersonale,
  puoGestireComande,
  puoSegnare,
} from '../lib/ruoli.js'
import { sezioneConsentita } from '../lib/sezioni.js'
import { senzaNascosti, subscribeNascosti, mostraOrdine } from '../lib/ordiniNascosti.js'
import { battutoDaQui, annullatoDaQui, idDispositivo } from '../lib/dispositivo.js'
import {
  corsieNascoste,
  ricordaCorsieNascoste,
  vistaCorsie,
  ricordaVistaCorsie,
  prontoDiviso,
  ricordaProntoDiviso,
} from '../lib/impostazioniLocali.js'
import {
  fraseAnnulloDefault,
  fraseAnnulloPossibile,
  mondoConsegna,
} from '../lib/consegna.js'
import {
  leggiAvvisi,
  subscribeAvvisi,
  avvisoAttivo,
  idAvvisoStato,
} from '../lib/preferenzeNotifiche.js'
import {
  activeComanda,
  allServed,
  comandaDivisibile,
  contoChiuso,
  nextComandaStatus,
  statiPrimaComanda,
  statoComandaNuova,
  statoDiLavoro,
} from '../lib/comande.js'
import { useComandeLocali } from '../lib/comandeLocali.js'
import { paidAmount, orderTotal } from '../lib/pagamento.js'
import { businessDayKey, businessDayLabel, businessDayShort } from '../lib/businessDay.js'
import { isAwaitingPayment } from '../lib/payments.js'
import { readerCheckout, readerTerminate } from '../lib/paymentsApi.js'
import { ensureNotificationPermission, notify } from '../lib/notify.js'
import { showToast } from '../lib/toast.js'
import { beep, installAudioUnlock } from '../lib/beep.js'
import { subscribePending, dismissPending, dismissBanner } from '../lib/pendingOrders.js'
import { syncSumUpProducts, isSumUpEnabled } from '../lib/sumupApi.js'
import { printComanda, printScontrino, loadPrinterSettings, claimReceiptPrint, releaseReceiptPrint, comandeDaStampare, claimComandaPrint, releaseComandaPrint } from '../lib/printer.js'
import MenuManager from '../components/MenuManager.jsx'
import PrinterSetup from '../components/PrinterSetup.jsx'
import InventoryManager from '../components/InventoryManager.jsx'
import SettingsTab from '../components/SettingsTab.jsx'
import PallinoStampante from '../components/PallinoStampante.jsx'
import StatsTab from '../components/StatsTab.jsx'
import BilancioTab from '../components/BilancioTab.jsx'
import StaffHoursTab from '../components/StaffHoursTab.jsx'
import UtentiTab from '../components/UtentiTab.jsx'
import VipTab from '../components/VipTab.jsx'
import ServiceQueue from '../components/ServiceQueue.jsx'
import StaffCallList from '../components/StaffCallList.jsx'
import Caricamento from '../components/Caricamento.jsx'
import CorsieStato from '../components/CorsieStato.jsx'
import CorsieComande from '../components/CorsieComande.jsx'
import OrderBy from '../components/OrderBy.jsx'
import FumettoAvvisi from '../components/FumettoAvvisi.jsx'
import CampoPassword from '../components/CampoPassword.jsx'
import ApriCassaBox from '../components/ApriCassaBox.jsx'
import ChiudiCassaBox from '../components/ChiudiCassaBox.jsx'
import GroupsPanel from '../components/GroupsPanel.jsx'
import GroupView from '../components/GroupView.jsx'
import CassaTab from '../components/CassaTab.jsx'
import InvoicesTab from '../components/InvoicesTab.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import CancelOrderDialog from '../components/CancelOrderDialog.jsx'
import DevTools from '../components/DevTools.jsx'
import StaffDrawer from '../components/StaffDrawer.jsx'
import { devToolsEnabled } from '../dev/devActions.js'
import { preloadStaff } from '../lib/staffApi.js'
import { useCashSession } from '../lib/cashSession.js'

// Badge accanto al numero d'ordine: la LETTERA del dipendente che l'ha aperto,
// oppure il segno del CLIENTE se l'ha aperto lui dall'app.
// Colore della striscia laterale della card per STATO dell'ordine (non della
// preparazione): aperto · pagato parzialmente · pagato · annullato.
const annullato = (o) =>
  o.status === ORDER_STATUSES.ANNULLATO || o.workflow_status === ORDER_STATUSES.ANNULLATO

function orderStripClass(o) {
  if (o.status === ORDER_STATUSES.ANNULLATO || o.workflow_status === ORDER_STATUSES.ANNULLATO)
    return 'pay-annullato'
  if (o.payment_status === 'pagato') return 'pay-pagato'
  if (o.payment_status === 'parziale') return 'pay-parziale'
  return 'pay-aperto'
}

export default function BartenderPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(undefined) // undefined = caricamento, null = non loggato
  const [role, setRole] = useState(null) // 'admin' | 'bartender' | 'staff' | 'cliente'
  // Tab iniziale anche da query (?tab=stats): usato dal drawer nel menu.
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState(() => params.get('tab') || 'coda')
  // La sezione segue SEMPRE l'indirizzo, in entrambi i versi. Prima si
  // aggiornava solo quando il parametro c'era: tornando a /bar (che è la
  // coda, senza parametro) la pagina restava sulla sezione di prima, e
  // "← Ordini" o il tasto indietro sembravano non fare niente — l'indirizzo
  // cambiava, la schermata no.
  const tabParam = params.get('tab')
  useEffect(() => {
    setTab(tabParam || 'coda')
  }, [tabParam])
  // Cambiando sezione dal menu si aggiorna ANCHE l'indirizzo: così indirizzo e
  // sezione restano sempre d'accordo e le scorciatoie (es. "Lista ordini" dal
  // Flusso cassa) funzionano anche se ci si era già passati.
  const goTab = (id) => {
    setTab(id)
    const next = new URLSearchParams(params)
    if (id === 'coda') next.delete('tab')
    else next.set('tab', id)
    // PUSH (non replace): ogni sezione entra nella cronologia, così il tasto
    // indietro — del browser o dell'app — torna alla sezione precedente e non
    // salta fuori dal gestionale.
    setParams(next)
  }

  // E L'INDIRIZZO SI RIMETTE IN PARI. Il titolo nella barra lo legge dalla
  // query (lib/sezioni.js) e non conosce il ruolo: senza questo, un
  // bartender su `?tab=bilancio` vedrebbe la coda con scritto «Bilancio»
  // sopra. `replace`, non push: il tasto indietro deve uscire dal
  // gestionale, non rimbalzare su un indirizzo che non si può aprire.
  useEffect(() => {
    if (!isGestore(role) || sezioneConsentita(tabParam, role)) return
    const next = new URLSearchParams(params)
    next.delete('tab')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam, role])

  // L'elenco dello staff passa da una Cloud Function: lo si scalda appena si
  // entra nel gestionale, così quando si aprono i pannelli i nomi ci sono già
  // invece di comparire dopo un "Carico lo staff…".
  useEffect(() => {
    if (isGestore(role)) preloadStaff()
  }, [role])

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null)
        setRole(null)
        return
      }
      // Ruolo dai custom claims: senza claim è un CLIENTE registrato
      // (nessun accesso al gestionale).
      //
      // IL RUOLO VIVE DENTRO IL TOKEN, E IL TOKEN DURA UN'ORA. Chi era già
      // collegato quando gli è cambiato il ruolo continua a girare con
      // quello vecchio: le regole del database guardano il token, non
      // l'anagrafica, e il risultato è una schermata che carica il menù ma
      // non la cassa, con "permessi insufficienti" sparso in giro — un
      // guaio da capire, in mezzo al servizio.
      //
      // Quindi: prima quello che c'è (istantaneo, la schermata si apre
      // subito), poi SEMPRE uno fresco in sottofondo. Se il ruolo è
      // cambiato, la pagina si allinea da sola in un secondo.
      try {
        const ruolo = (await u.getIdTokenResult()).claims.role ?? 'cliente'
        setRole(ruolo)
        u.getIdTokenResult(true)
          .then((t) => {
            const aggiornato = t.claims.role ?? 'cliente'
            if (aggiornato !== ruolo) setRole(aggiornato)
          })
          .catch(() => {
            /* offline: si tiene quello in tasca, è comunque valido */
          })
      } catch {
        setRole('cliente')
      }
      setUser(u)
    })
  }, [])

  // Il GESTIONALE usa tutta la larghezza della pagina (liste, tabelle e
  // statistiche stavano strette nei 760px pensati per il lato cliente).
  // L'header col logo resta: niente fullbleed, che lo nasconderebbe.
  const wideTab = isPersonale(role)
  useEffect(() => {
    if (!wideTab) return undefined
    document.body.classList.add('bar-wide')
    // Cinturino di sicurezza: le sezioni del gestionale NON sono mai a tutto
    // schermo. Se la classe è rimasta appiccicata da una schermata precedente
    // (coda a griglia, POS), la topbar sparirebbe e resterebbero due ☰.
    if (tab !== 'coda') document.body.classList.remove('fullbleed')
    return () => document.body.classList.remove('bar-wide')
  }, [wideTab, tab])

  if (user === undefined || (user && role === null)) {
    return <Caricamento testo="Ti sto facendo entrare…" />
  }
  if (!user) return <LoginForm />

  // Cliente registrato: nessun accesso al gestionale.
  if (role === 'cliente') {
    return (
      <div className="empty">
        🔒 Quest’area è riservata allo staff.
        <br />
        {/* Anche da qui si esce dalla porta giusta: il signOut secco
            lasciava la timbratura aperta e questo terminale nella rubrica
            degli avvisi. */}
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => logoutStaff()}>
          Esci e accedi come staff
        </button>
      </div>
    )
  }

  // LA SALA LAVORA SULLA STESSA CODA DEL BANCO. Aveva due pagine sue («Da
  // servire» e «I miei ordini») e non vedeva mai quello che vedeva il
  // bartender: ora la home è la stessa coda del gestionale, «I miei
  // ordini» è diventato il filtro «Miei» della coda (il vecchio indirizzo
  // ?tab=miei-ordini ci arriva col filtro già acceso) e «Da servire»
  // resta come sezione. Tutto il resto è roba da gestori: un tab non suo
  // riporta alla coda.
  const salaMiei = !isGestore(role) && tab === 'miei-ordini'
  // Una sezione riservata non si apre nemmeno scrivendo l'indirizzo a mano:
  // il Bilancio è dell'admin, e un bartender che arriva su `?tab=bilancio`
  // — collegamento salvato, indirizzo battuto — si ritrova sulla coda,
  // senza una schermata che si apre per dirgli «non puoi».
  const tabEffettivo = !isGestore(role)
    ? tab === 'servizio'
      ? 'servizio'
      : 'coda'
    : sezioneConsentita(tab, role)
      ? tab
      : 'coda'

  return (
    // La classe serve alla catena delle altezze: da qui in giù, quando la
    // pagina deve stare tutta nella finestra, ogni contenitore passa al
    // figlio quello che gli resta. Un div senza nome la spezzava.
    <div className="bar-page">
      <StaffDrawer role={role} active={tabEffettivo} onSelect={goTab} />

      {/* Toccando un gruppo (menu laterale) si ENTRA nella sua vista: la
          lista dei suoi ordini col conto. La coda resta com'è — lì ci
          vanno solo gli ordini, i pannelli restano dietro il loro tasto. */}
      {params.get('group') && (
        <GroupView groupId={params.get('group')} onClose={() => navigate('/bar')} />
      )}

      <div className="bar-content">
        {/* L'«indietro» sta nella barra in alto, fra il ☰ e il marchio
            (vedi App.jsx): dentro la pagina si mangiava la prima riga di
            contenuto in ogni sezione. */}
        {tabEffettivo === 'coda' && <OrderQueue mieiIniziale={salaMiei} gestore={isGestore(role)} ruolo={role} />}
        {/* «Da servire»: la sezione della sala (drink pronti da portare). */}
        {tabEffettivo === 'servizio' && <ServiceQueue />}
        {tabEffettivo === 'pagamenti' && <CassaTab />}
        {/* IL VECCHIO INDIRIZZO NON SI ROMPE. `?tab=storico` è nei
            collegamenti salvati e nei messaggi: porta alla cassa, aperta
            sulla lista ordini. */}
        {tabEffettivo === 'storico' && (
          <CassaTab sezioneIniziale="ordini" />
        )}
        {tabEffettivo === 'fatture' && <InvoicesTab />}
        {tabEffettivo === 'stats' && <StatsTab />}
        {tabEffettivo === 'bilancio' && <BilancioTab />}
        {tabEffettivo === 'menu' && <MenuTab />}
        {tabEffettivo === 'inventario' && <InventoryManager />}
        {(tabEffettivo === 'staff' || tabEffettivo === 'ore') && <StaffHoursTab />}
        {tabEffettivo === 'utenti' && <UtentiTab role={role} />}
        {/* I buoni VIP sono un pannello di "Utenti e ruoli": qui restano
            solo perché i vecchi collegamenti (?tab=vip) funzionino. */}
        {tabEffettivo === 'vip' && <VipTab />}
        {tabEffettivo === 'impostazioni' && <SettingsTab role={role} />}
        {/* La stampante sta nelle Impostazioni: qui resta solo perché i
            vecchi collegamenti (?tab=stampante) continuino a funzionare. */}
        {tabEffettivo === 'stampante' && <PrinterSetup />}
        {tabEffettivo === 'dev' && devToolsEnabled && <DevTools />}
      </div>
    </div>
  )
}

function MenuTab() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await syncSumUpProducts()
      if (res.skipped) {
        setSyncResult({ ok: false, msg: res.message || 'SumUp non abilitato.' })
      } else {
        setSyncResult({ ok: true, msg: `Sincronizzati ${res.synced} prodotti da SumUp POS Pro.` })
      }
    } catch (e) {
      setSyncResult({ ok: false, msg: `Errore: ${e.message}` })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      {/* Box sync visibile solo con l'integrazione SumUp abilitata. */}
      {isSumUpEnabled && (
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="row between" style={{ alignItems: 'center' }}>
          <div>
            <strong>SumUp POS Pro</strong>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              Importa il catalogo drink direttamente da SumUp POS Pro.
            </div>
          </div>
          <button
            className="btn small"
            disabled={syncing}
            onClick={handleSync}
            style={{ marginLeft: 12, flexShrink: 0 }}
          >
            {syncing ? 'Sync…' : '↻ Sync catalogo'}
          </button>
        </div>
        {syncResult && (
          <div
            className={syncResult.ok ? '' : 'banner'}
            style={syncResult.ok ? { marginTop: 8, color: 'var(--green, #4caf50)', fontSize: '0.9rem' } : { marginTop: 8 }}
          >
            {syncResult.msg}
          </div>
        )}
      </div>
      )}
      <MenuManager />
    </div>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setErr(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      setErr(loginError(e.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginTop: 0 }}>Accesso staff</h2>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setErr(null) }}
        placeholder="bartender@example.com"
        required
      />
      <label htmlFor="password" style={{ marginTop: 10 }}>Password</label>
      <CampoPassword
        id="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setErr(null) }}
        placeholder="••••••••"
        required
      />
      {err && <div className="banner" style={{ marginTop: 10 }}>{err}</div>}
      <button className="btn block" style={{ marginTop: 14 }} type="submit" disabled={loading}>
        {loading ? 'Accesso…' : 'Entra'}
      </button>
    </form>
  )
}

function loginError(code) {
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email o password non corretti.'
  }
  if (code === 'auth/too-many-requests') return 'Troppi tentativi. Riprova tra qualche minuto.'
  if (code === 'auth/network-request-failed') return 'Errore di rete. Controlla la connessione.'
  return 'Errore di accesso. Riprova.'
}

const STATUS_TABS = [
  ORDER_STATUSES.RICEVUTO,
  ORDER_STATUSES.IN_PREPARAZIONE,
  ORDER_STATUSES.PRONTO,
  ORDER_STATUSES.RITIRATO,
  ORDER_STATUSES.PAGATO,
]

// Minuti (1 decimale) tra due timestamp ISO, o null se mancanti.
function minutesBetween(fromIso, toIso) {
  const t1 = Date.parse(fromIso || '')
  const t2 = Date.parse(toIso || '')
  if (!Number.isFinite(t1) || !Number.isFinite(t2) || t2 < t1) return null
  return Math.round((t2 - t1) / 6000) / 10
}

// Porta sotto gli occhi il conto acceso dalla ricerca.
//
// È un componente a sé, e non un `useEffect` dentro OrderQueue, perché lì
// sopra c'è un return anticipato (la coda che sta ancora caricando): un
// hook messo dopo quel punto verrebbe eseguito in certi render e in altri
// no, e React conta sull'ordine sempre uguale. Il lint lo boccia, ed è
// stato lui a prendermi con le mani nel sacco.
function PortaInVista({ id }) {
  useEffect(() => {
    if (!id) return
    // `block: 'center'` e non 'nearest': se il conto è appena fuori
    // schermo, "nearest" lo incolla al bordo e sembra tagliato.
    document
      .getElementById(`ordine-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [id])
  return null
}

function OrderQueue({ mieiIniziale = false, gestore = false, ruolo = null }) {
  const [ordersReady, setOrdersReady] = useState(false) // primo snapshot arrivato
  const [ordersRaw, setOrders] = useState([])
  // CONTI APPENA CHIUSI QUI: fuori dalla lista all'istante. La scrittura
  // parte in sottofondo e per un attimo la coda ha ancora la versione di
  // prima: si tornava dalla schermata del conto e lo si vedeva lì, per poi
  // guardarlo sparire — abbastanza per chiedersi se l'operazione fosse
  // andata a buon fine.
  const [chiusiQui, setChiusiQui] = useState([])
  useEffect(() => subscribeNascosti(setChiusiQui), [])
  const [boardFilter, setBoardFilter] = useState('attivi') // 'attivi' | 'chiusi' | 'tutti'
  // DENTRO I CHIUSI: tutti, quelli usciti per intero, quelli con ancora
  // qualcosa da portare. Un conto chiuso è un conto incassato — si paga in
  // anticipo tutte le sere — e «quali dei chiusi hanno ancora roba da
  // consegnare» è una domanda vera, che prima si rispondeva tenendo quei
  // conti in mezzo a quelli aperti.
  const [sottoChiusi, setSottoChiusi] = useState('tutti')
  // NASCONDERE VALE SOLO PER I CONTI IN CORSO. Un conto chiuso da qui
  // sparisce subito da «In corso» — è il suo mestiere — ma restava nascosto
  // anche sotto «Chiusi» e in «Tutti»: si chiudeva un conto e nello storico
  // non c'era, fino a ricaricare la pagina. E riaprendolo non tornava fra
  // quelli in corso, perché era ancora nell'elenco dei nascosti.
  // ...E UN CONTO INCASSATO CON DEI DRINK ANCORA DA FARE NON SI NASCONDE
  // AFFATTO. Nascondere serve a togliere di mezzo un conto su cui non c'è
  // più niente da fare; ma si paga in anticipo tutte le sere, e sparendo
  // si portava dietro le sue comande — al banco i drink appena pagati si
  // volatilizzavano, e tornavano solo ricaricando la pagina (BUG-023).
  const orders = useMemo(
    () => (boardFilter === 'attivi' ? senzaNascosti(ordersRaw, haLavoroDaFare) : ordersRaw),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordersRaw, chiusiQui, boardFilter]
  )
  const [error, setError] = useState(null)
  const [statusTab, setStatusTab] = useState(ORDER_STATUSES.RICEVUTO)
  // La scheda attiva quando gli stati di servizio sono SPENTI: in corso,
  // chiusi o annullati — le stesse voci della griglia.
  const [tabSemplice, setTabSemplice] = useState('attivi')
  // Quale card delle corsie ha le azioni aperte: una alla volta, se no la
  // colonna diventa un muro di tasti.
  const [corsiaAperta, setCorsiaAperta] = useState(null)
  // Quale card mostra tutte le righe (i conti lunghi si aprono a richiesta).
  const [corsiaEspansa, setCorsiaEspansa] = useState(null)
  // Le comande come le vede chi sta qui adesso: il gesto è sulla singola
  // comanda e deve vedersi nell'istante in cui si tocca. La copia locale e
  // la sua pulizia stanno in lib/comandeLocali.js, uguali per la coda, il
  // conto e il dettaglio della comanda.
  const comandeLocali = useComandeLocali(orders)
  // Quali colonne chi sta a QUESTO terminale ha spento, e se guarda i conti
  // o le comande: preferenze del dispositivo, non del locale — al banco e
  // alla cassa non si guardano le stesse cose.
  const [nascoste, setNascoste] = useState(() => corsieNascoste() ?? CORSIE_SPENTE_ALL_INIZIO)
  const [vista, setVista] = useState(vistaCorsie)
  const [scegliCorsie, setScegliCorsie] = useState(false) // il pannellino è aperto?
  // La colonna del pronto: una sola col badge, o due (da servire / da
  // ritirare). Scelta di QUESTO terminale — il tablet della sala e quello
  // del banco non guardano lo stesso lavoro.
  const [prontoSeparato, setProntoSeparato] = useState(prontoDiviso)
  // Barra stretta o larga: da questo dipende se le azioni della testata
  // stanno dietro il ⋯ o a vista come icone.
  const telefono = useTelefono()
  const [soloOggi, setSoloOggi] = useState(false) // nasconde i conti dei giorni scorsi
  // «Miei»: solo i conti inseriti da chi è collegato. Ha preso il posto
  // della pagina «I miei ordini» della sala: stessa coda per tutti, e chi
  // vuole ritrovare i propri accende il filtro.
  const [soloMiei, setSoloMiei] = useState(mieiIniziale)

  const [slowLoad, setSlowLoad] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { title, message, danger, run }
  const [cancelTarget, setCancelTarget] = useState(null) // { order, kind }
  // Storia del conto e ripristino: due pannelli, un conto alla volta.
  // Quali avvisi vuole CHI GUARDA QUESTO SCHERMO (per dispositivo e per
  // persona). In un ref perché la sottoscrizione agli ordini nasce una volta
  // sola: leggendoli dallo stato resterebbero quelli di quando è nata.
  const avvisi = useRef(leggiAvvisi(auth.currentUser?.uid))
  useEffect(
    () => subscribeAvvisi(auth.currentUser?.uid, (p) => { avvisi.current = p }),
    []
  )
  // Gli avanzamenti fatti DA QUI non si annunciano: l'ho appena premuto io.
  const avanzatiDaMe = useRef(new Set())
  const statoPrec = useRef(new Map())
  const [storiaTarget, setStoriaTarget] = useState(null)
  const [ripristinoTarget, setRipristinoTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [showPanels, setShowPanels] = useState(false) // pannelli (chiamate/gruppi) nella griglia
  const [menuBoard, setMenuBoard] = useState(false) // menu ⋯ della lavagna
  const [apriCassa, setApriCassa] = useState(false) // box «apri la cassa»
  const [chiudiCassa, setChiudiCassa] = useState(false) // box «chiudi la cassa»
  // Verso della lista: dal più vecchio (come nasce la serata) o dal più
  // recente (utile quando i conti sono tanti e l'ultimo è quello che
  // serve). Si ricorda, perché è una preferenza di chi lavora.
  const [ordineDesc, setOrdineDesc] = useState(() => {
    try {
      return localStorage.getItem('tana:coda:desc') === '1'
    } catch {
      return false
    }
  })
  const cambiaOrdine = () =>
    setOrdineDesc((v) => {
      try {
        localStorage.setItem('tana:coda:desc', v ? '0' : '1')
      } catch {
        /* niente memoria: vale per questa sessione */
      }
      return !v
    })
  const [openCards, setOpenCards] = useState(() => new Set()) // card-griglia coi tasti aperti
  const [pend, setPend] = useState({ pending: [], banners: [] }) // ordini POS in invio
  const [settings, setSettings] = useState(settingsIniziali)
  const knownIds = useRef(new Set())
  const knownComande = useRef(new Map()) // id ordine -> n. comande (per il toast aggiunte)
  const navigate = useNavigate()

  useEffect(() => subscribeSettings((s) => setSettings(s)), [])
  useEffect(() => subscribePending(setPend), [])
  // Senza cassa aperta non si battono ordini: il «+» è spento e in cima
  // compare l'avviso con la scorciatoia per aprirla.
  // ATTENZIONE ALLA FORMA: `open` è un BOOLEANO, la cassa vera sta in
  // `session`. Leggendo `cassaAperta?.id` da un booleano viene `undefined`,
  // e allora ogni conto chiuso o annullato spariva dalla coda — sembrava un
  // problema di filtri e invece era questa riga.
  const { session: cassaAperta, loading: cassaLoading } = useCashSession()

  // Gestione preparazione: se spenta spariscono stati e avanzamenti.
  const workflowOn = settings.workflow_enabled !== false
  // In che passo nasce il lavoro in questo locale: lo dice comande.js, in
  // un posto solo. Serve a sapere fin dove si può tornare indietro — sotto
  // quel passo non c'è niente da guardare — e quali colonne ha senso
  // accendere.
  const passoDiNascita = statoComandaNuova(settings)

  // GLI STATI DEL SERVIZIO ACCENDONO LA VISTA DEL BANCO. Chi sta allo
  // shaker non guarda i conti, guarda il lavoro: le comande, nei passi in
  // cui stanno. Quei passi sono esattamente ciò che dà senso a questa
  // vista — spenti gli stati del servizio non esiste proprio, e al banco
  // si vede la coda come la vedono tutti gli altri.
  //
  // COME disegnarla lo dice `settings.bartender_view`, un'impostazione del
  // LOCALE sorella di `queue_view`: per ora l'unica voce è «corsie di
  // stato», ma è scritta come una lista di viste possibili proprio perché
  // è il posto dove le prossime andranno ad aggiungersi.
  const vistaBanco = workflowOn && isBanco(ruolo)
  // LA SALA SERVE, NON PREPARA (REQ-STAFF-014). Vede a che punto sono le
  // comande — le serve per sapere cosa portare — ma i passi del banco non
  // li tocca: qui si spengono i tasti che li segnano, la strada per tornare
  // indietro, la divisione e l'annullo. Il metro sta in `ruoli.js`, in un
  // posto solo.
  const comandaIlLavoro = puoGestireComande(ruolo)
  const bancoCorsie = vistaBanco && (settings.bartender_view || 'corsie') === 'corsie'

  // Le viste a LAVAGNA — la griglia, le corsie di stato, la vista del banco
  // — stanno a tutto schermo: aggiungono `fullbleed` al body così la pagina
  // esce dal contenitore centrato (.app, max 760px) e riempie larghezza e
  // altezza. Rimosso quando si lascia la lavagna o si smonta la coda.
  // CHI NON È AL BANCO PUÒ ANDARE A GUARDARE IL LAVORO, da qualunque vista
  // della coda: è una pastiglia sopra le corsie (vedi puoScegliere), e la
  // scelta è di questo terminale. Tornando indietro la coda si ritrova
  // com'era — griglia compresa — perché quella resta l'impostazione del
  // locale e nessuno l'ha toccata.
  const guardaComande = workflowOn && !vistaBanco && vista === 'comande'
  const gridView = !vistaBanco && !guardaComande && settings.queue_view === 'griglia'
  // LA CODA DELL'ADMIN NON CAMBIA: con «corsie di stato» continua a vedere
  // i CONTI — in corso, chiusi, annullati — come ha sempre fatto.
  const corsieView =
    bancoCorsie || guardaComande || (!vistaBanco && settings.queue_view === 'corsie')
  const lavagna = gridView || corsieView
  useEffect(() => {
    if (!lavagna) return undefined
    document.body.classList.add('fullbleed')
    return () => document.body.classList.remove('fullbleed')
  }, [lavagna])

  // Se dopo 8s gli ordini non sono arrivati, probabilmente il database non è
  // raggiungibile (l'SDK ritenta in silenzio): mostra un suggerimento.
  useEffect(() => {
    const t = setTimeout(() => setSlowLoad(true), 8000)
    return () => clearTimeout(t)
  }, [])

  // Registrazione push del dispositivo (indipendente dagli ordini).
  useEffect(() => {
    installAudioUnlock() // sblocca il bip al primo tocco (richiesto da iOS)
    // Registra il token push del dispositivo del bartender: senza questo la
    // push "nuovo ordine" non arriverebbe a chi sta solo sul gestionale.
    const uid = auth.currentUser?.uid
    ensureNotificationPermission().then(async (ok) => {
      if (!ok || !uid) return
      const token = await getPushToken()
      if (token) saveStaffToken(uid, token, idDispositivo()).catch(() => {})
    })
  }, [])

  // Osserva la CODA: conti aperti (sempre, per sempre) + chiusi di oggi.
  const cutoffHour = settings.business_day_cutoff_hour
  useEffect(() => {
    let primed = false
    const awaiting = new Set() // ordini in attesa di pagamento obbligatorio
    const unsub = subscribeActiveOrders(
      (data) => {
        // Notifica i nuovi ordini "ricevuti" comparsi dopo il primo
        // caricamento. Quelli con pagamento obbligatorio vengono
        // notificati solo QUANDO risultano pagati (prima non si preparano).
        if (primed) {
          const printerSettings = loadPrinterSettings()
          for (const o of data) {
            const isNew = !knownIds.current.has(o.id)
            // C'È QUALCOSA DA FARE? Un ordine battuto alla cassa nasce già
            // «in preparazione» — chi lo batte sta facendo il drink —
            // mentre quelli dal menù nascono «ricevuto». Guardando i soli
            // «ricevuto», un ordine preso al POS da un altro terminale non
            // faceva suonare niente qui.
            if (
              o.workflow_status !== ORDER_STATUSES.RICEVUTO &&
              o.workflow_status !== ORDER_STATUSES.IN_PREPARAZIONE
            )
              continue
            // NIENTE AVVISO SOLO A CHI L'HA MANDATO. Prima si tacevano tutti
            // gli ordini battuti da un gestore, su QUALUNQUE dispositivo:
            // col telefono in mano a un admin, al banco non suonava niente.
            // Il metro giusto non è il ruolo, è il terminale — lo stesso
            // account sta su tablet, telefono e portatile insieme.
            if (battutoDaQui(o.placed_by)) continue
            if (isAwaitingPayment(o)) {
              if (isNew) awaiting.add(o.id)
              continue
            }
            if (isNew || awaiting.has(o.id)) {
              awaiting.delete(o.id)
              if (avvisoAttivo(avvisi.current, 'nuovo_ordine')) {
                beep() // su iPad in primo piano il banner di sistema è soppresso
                // STESSO NOME della notifica che manda il server (sw.js):
                // così il sistema le fonde in una invece di mostrarne due —
                // l'app suona subito, la push arriva un istante dopo.
                notify('🆕 Nuovo ordine', `Ordine #${o.daily_number} ricevuto.`, {
                  tag: `new-order-${o.id}`,
                  renotify: true,
                })
              }
            }
          }
          // Auto-stampa scontrino alla CHIUSURA del conto (prima era al
          // "pronto": con la gestione preparazione spenta non usciva mai, e con
          // quella accesa usciva due volte — al pronto e all'incasso).
          // claimReceiptPrint garantisce una sola copia per conto, da qualunque
          // schermata sia stato chiuso.
          // AUTO-STAMPA COMANDE: fuori dal blocco degli avvisi, apposta.
          // La stampa non è un avviso: la comanda serve al banco anche per
          // l'ordine battuto da QUESTO terminale, e serve anche quando è la
          // SECONDA comanda di un conto già aperto — due casi che i filtri
          // degli avvisi (battutoDaQui, ordine nuovo) tagliavano fuori.
          // La regola di cosa stampare sta in printer.js (comandeDaStampare),
          // la pretesa per non stampare doppio pure (claimComandaPrint).
          if (printerSettings.autoPrintComanda) {
            for (const o of data) {
              for (const c of comandeDaStampare(o)) {
                if (claimComandaPrint(o.id, c.id)) {
                  printComanda(o, c)
                    // Il segno va SUL DATO solo a carta uscita: segnare
                    // prima vorrebbe dire che una stampa fallita mette a
                    // tacere tutti i terminali per sempre.
                    .then(() => segnaComandaStampata(o.id, c.id))
                    .catch((e) => {
                      console.warn('[printer] auto-comanda:', e.message)
                      // Pretesa locale libera: al prossimo snapshot si
                      // riprova — carta finita, stampante spenta, si
                      // sistema e la comanda esce da sola.
                      releaseComandaPrint(o.id, c.id)
                    })
                }
              }
            }
          }
          if (printerSettings.autoPrintScontrino) {
            for (const o of data) {
              if (o.payment_status === 'pagato' && claimReceiptPrint(o.id)) {
                printScontrino(o).catch((e) => {
                  console.warn('[printer] auto-scontrino:', e.message)
                  // Carta non uscita: la prenotazione torna libera, se no quel
                  // conto non stampa più lo scontrino nemmeno riaperto e
                  // richiuso (BUG-047).
                  releaseReceiptPrint(o.id)
                })
              }
            }
          }
          // AGGIUNTE a conti esistenti (da altro dispositivo/staff): toast
          // in app. Le proprie aggiunte non passano di qua: si fanno dal
          // dettaglio ordine, dove questa vista non è montata.
          for (const o of data) {
            const prev = knownComande.current.get(o.id)
            const n = (o.comande || []).length
            if (prev != null && n > prev && o.status === 'aperto') {
              showToast(`➕ Aggiunta all'ordine #${o.daily_number ?? '—'}${o.customer_name ? ` (${o.customer_name})` : ''}`)
            }
          }
          // AVANZAMENTI FATTI ALTROVE. Chi sta in sala deve sapere che un
          // conto è diventato «pronto» senza dover guardare la coda ogni
          // minuto; chi l'ha premuto qui non ha bisogno che glielo si
          // ripeta. Ogni stato si accende e si spegne per conto suo, dalle
          // impostazioni: in sala interessa «pronto», al banco altro.
          for (const o of data) {
            const prima = statoPrec.current.get(o.id)
            const ora = o.workflow_status
            if (!prima || prima === ora) continue
            if (avanzatiDaMe.current.has(`${o.id}:${ora}`)) {
              avanzatiDaMe.current.delete(`${o.id}:${ora}`)
              continue
            }
            // ANNULLATO DA QUESTO TERMINALE: niente avviso. Chi annulla lo
            // fa quasi sempre dal conto, non da qui, quindi «l'ho premuto
            // io» (avanzatiDaMe) non basta: quella schermata è un'altra.
            // Il metro è il terminale, come per gli ordini nuovi.
            if (ora === ORDER_STATUSES.ANNULLATO && annullatoDaQui(o)) continue
            if (!avvisoAttivo(avvisi.current, idAvvisoStato(ora))) continue
            const nome = ora === ORDER_STATUSES.RITIRATO
              ? ritiratoLabel(o.service_mode)
              : STATUS_LABELS[ora]
            if (!nome) continue
            notify(
              `${STATUS_EMOJI[ora] || '•'} ${nome}`,
              `Ordine #${o.daily_number ?? '—'}${o.customer_name ? ` · ${o.customer_name}` : ''}`
            )
          }
        }
        knownIds.current = new Set(data.map((o) => o.id))
        knownComande.current = new Map(data.map((o) => [o.id, (o.comande || []).length]))
        statoPrec.current = new Map(data.map((o) => [o.id, o.workflow_status]))
        setOrders(data)
        setOrdersReady(true)
        primed = true
      },
      (e) => {
        setError(e.message)
        setOrdersReady(true) // errore visibile in pagina, niente spinner infinito
      },
      { cutoffHour, cashSessionId: cassaAperta?.id ?? null }
    )
    return unsub
  }, [cutoffHour, cassaAperta?.id])

  // Scambio placeholder → ordine reale: appena l'ordine con il
  // client_temp_id del placeholder arriva dalla sottoscrizione, il
  // placeholder si toglie (lo scambio è sul posto: mai due card né buchi).
  useEffect(() => {
    for (const p of pend.pending) {
      if (orders.some((o) => o.client_temp_id === p.tempId)) dismissPending(p.tempId)
    }
  }, [orders, pend.pending])

  // Nessuna apertura/chiusura di serata: il servizio è perpetuo. I conti
  // restano aperti finché non li si chiude a mano; la giornata commerciale
  // serve solo a raggruppare (statistiche e progressivo #N).

  // Porta il conto a uno stato: quello dopo, se non si dice altro, oppure
  // uno preciso — anche INDIETRO, per chi ha toccato «pronto» sul conto
  // sbagliato. La strada è la stessa (override ottimistico + scrittura in
  // sottofondo): non c'è un modo per andare avanti e uno per tornare.
  function advance(order, stato = null) {
    const ns = stato || nextStatus(order.workflow_status)
    if (!ns || ns === order.workflow_status) return
    avanzatiDaMe.current.add(`${order.id}:${ns}`)
    // LA MEMORIA DI «L'HO APPENA FATTO IO» STA SULLE COMANDE, una sola per
    // tutta la schermata. Prima qui c'era `queueOverrides`, che teneva lo
    // stato del CONTO: si avanzava un conto dalla griglia e le sue comande
    // restavano quelle del server, si avanzava un ticket dal banco e lo
    // stato del conto restava quello del server. Con la pastiglia
    // «🍸 Comande / 🧾 Ordini» le due viste stanno a un tocco di distanza
    // sullo stesso terminale: si girava la pastiglia e il conto era ancora
    // dov'era, finché non arrivava lo snapshot. Offline non arriva.
    const attiva = activeComanda(comandeLocali.conComande(order))
    if (attiva) {
      const adesso = new Date().toISOString()
      comandeLocali.applica(order, (comande) =>
        comande.map((c) =>
          c.id === attiva.id
            ? { ...c, status: ns, status_times: { ...(c.status_times || {}), [ns]: adesso } }
            : c
        )
      )
    }
    // La scrittura resta quella di sempre: il server sceglie la comanda
    // attiva da sé, ed è la stessa che si è appena mossa qui.
    updateOrderStatus(order.id, ns).catch((e) => {
      setError(e.message)
      showToast(`⚠️ Avanzamento non riuscito: ${e.message}`, { kind: 'error' })
      // Non è passata: si torna a quello che dice il server, che è l'unica
      // cosa vera.
      comandeLocali.scarta(order.id)
    })
  }

  // Porta AVANTI UNA COMANDA, non tutto il conto: è il gesto delle corsie
  // del banco, dove ogni card è un ticket. Gli stati del servizio sono
  // SOTTOSTATI dell'ordine — stanno sulle comande, non sul conto — e con
  // una comanda sola le due cose coincidono; con più di una no, ed è
  // esattamente quello che questa vista serve a far vedere. La strada è
  // quella di sempre: si vede subito, si scrive in sottofondo, e cosa
  // viene dopo lo dice comande.js, come nel dettaglio del conto.
  // `stato` esplicito serve a TORNARE INDIETRO: si segna «pronto» il ticket
  // sbagliato, e senza una strada per rimetterlo dov'era l'unica sarebbe
  // annullare la comanda e rifarla, perdendo orari e storia.
  function avanzaComanda(order, comanda, stato = null) {
    if (!comanda) return
    const ns = stato || nextComandaStatus(comanda.status)
    if (!ns) return
    const adesso = new Date().toISOString()
    comandeLocali.applica(order, (comande) =>
      comande.map((c) =>
        c.id === comanda.id
          ? { ...c, status: ns, status_times: { ...(c.status_times || {}), [ns]: adesso } }
          : c
      )
    )
    advanceComanda(order.id, comanda.id, ns).catch((e) => {
      setError(e.message)
      showToast(`⚠️ Avanzamento non riuscito: ${e.message}`, { kind: 'error' })
      comandeLocali.scarta(order.id)
    })
  }

  // Annullamento bartender: apre il dialog con frase/motivazione/notifica.
  // kind: 'ordine' (ricevuto), 'preparazione' (in_preparazione),
  // 'non_ritirato' (pronto mai ritirato/servito).
  function confirmCancel({ phrase, message, notify }) {
    const { order, kind } = cancelTarget
    setCancelTarget(null)
    // In background: il dialog si chiude subito, la card sparisce con lo
    // snapshot; in errore arriva il toast.
    cancelOrder(order.id, { by: 'bartender', kind, phrase, message, notify }).catch((e) => {
      setError(e.message)
      showToast(`⚠️ Annullo non riuscito: ${e.message}`, { kind: 'error' })
    })
  }

  // Attesa del primo snapshot: si mostra SOLO se non c'è già qualcosa da
  // vedere. Un ordine appena battuto è un segnaposto locale, quindi deve
  // comparire subito — la sincronizzazione col server viene dopo, non
  // prima (era il caso del primo ordine della giornata: il contatore del
  // giorno non è ancora in cache e la scrittura passa dal server).
  if (!ordersReady && pend.pending.length === 0) {
    return (
      <div>
        {error && <div className="banner">Errore: {error}</div>}
        <div className="empty">
          Carico gli ordini…
          {slowLoad && (
            <>
              {/* Chi legge questo sta al bancone, non davanti al codice: gli
                  emulatori non gli dicono niente. La causa quasi sempre è una
                  rete che RISULTA collegata ma non passa (wifi del locale che
                  fa i capricci): lì l'app aspetta il server invece di
                  arrendersi alla cache.
                  In LOCALE però la causa è quasi sempre un'altra — il
                  database finto che si è impiantato: accetta le connessioni
                  e non risponde più. Dire «controlla il wifi» a chi sta
                  sviluppando è mandarlo a cercare dalla parte sbagliata. */}
              <p className="muted" style={{ fontSize: '0.85rem', marginTop: 12 }}>
                {import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
                  ? 'Il database locale (emulatore) non risponde: accetta le connessioni ma non manda niente. Riavvia gli emulatori — «npm run emulators».'
                  : 'Il wifi risulta collegato ma non sta passando niente. Prova a spegnere e riaccendere il wifi, oppure passa alla rete del telefono: gli ordini già presi restano al sicuro.'}
              </p>
              <button
                className="btn ghost small"
                style={{ marginTop: 8 }}
                onClick={() => window.location.reload()}
              >
                🔄 Ricarica
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // Ordini "effettivi" a schermo: quelli del server con sopra l'ultimo gesto
  // fatto da questo terminale. Le comande sono la memoria, e lo stato del
  // conto si RICAVA da quelle (statoDiLavoro): così le due viste — conti e
  // comande — raccontano sempre la stessa cosa, anche offline.
  const effOrders = orders.map((o) => {
    const conLocali = comandeLocali.conComande(o)
    if (conLocali === o) return o
    return {
      ...conLocali,
      workflow_status: statoDiLavoro(conLocali),
      active_comanda_id: activeComanda(conLocali)?.id ?? null,
    }
  })
  // ── DA CHIUDERE: conti rimasti aperti dalle giornate precedenti ──
  // Restano fuori dalla schermata principale (altrimenti si mescolano agli
  // ordini di oggi e i numeri del giorno sembrano duplicati): stanno nella
  // loro tab dedicata, con la data ben visibile sulla card.
  const oggiKey = businessDayKey(new Date(), cutoffHour)
  const dayOf = (o) => o.order_date || businessDayKey(o.created_at, cutoffHour)
  // Un conto è CHIUSO — e quindi esce dalla coda — solo quando non c'è più
  // nulla da fare. Con la preparazione attiva servono DUE cose: pagato E
  // servito. Un ordine pagato in anticipo ma non ancora consegnato è
  // lavoro ancora da fare, e sparire sarebbe il modo migliore per
  // dimenticarselo. Senza la preparazione, invece, il pagamento chiude.
  // UN CONTO CHIUSO È UN CONTO INCASSATO. Punto: i soldi sono presi, e per
  // la coda dei CONTI — griglia, lista, schede, conteggi e corsie — non
  // c'è altro da chiedersi. Prima con gli stati del servizio ne servivano
  // due, pagato E servito, e un conto appena riscosso restava fra quelli
  // «in corso» finché qualcuno non lo serviva: chi aveva appena preso i
  // soldi lo cercava fra i chiusi e non lo trovava. Il lavoro ancora da
  // fare si guarda dove è il suo posto — le corsie delle COMANDE — e,
  // dentro i chiusi, col sottofiltro «Da servire».
  // La regola con gli stati resta viva altrove: il magazzino (impegnato.js)
  // deve sapere che un conto pagato e non servito ha ancora ingredienti in
  // ballo, e lì `contoChiuso` si chiama col workflow acceso.
  const isChiuso = (o) => contoChiuso(o, { workflowOn: false })
  // PAGATO MA NON ANCORA USCITO: non cambia dove sta il conto — sta fra i
  // chiusi, coi soldi presi — ma la card lo dice lo stesso, che è il caso
  // strano e non deve sfuggire a chi ci passa sopra gli occhi.
  const pagato = (o) =>
    o.payment_status === 'pagato' || o.workflow_status === ORDER_STATUSES.PAGATO
  const servito = (o) => allServed(o) || o.workflow_status === ORDER_STATUSES.RITIRATO
  const arretrati = effOrders
    .filter((o) => !isChiuso(o) && dayOf(o) && dayOf(o) !== oggiKey)
    .sort((a, b) => String(dayOf(a)).localeCompare(String(dayOf(b))))
  const arretratiIds = new Set(arretrati.map((o) => o.id))
  // Etichetta della giornata dell'ordine: "oggi", "ieri" o la data estesa.
  const dayLabel = (o) => businessDayShort(dayOf(o), new Date(), cutoffHour)
  // Quando è stato APERTO il conto: la giornata da sola non basta — su una
  // board piena serve sapere se quel tavolo è lì da dieci minuti o da un'ora.
  const apertoLabel = (o) => {
    const g = dayLabel(o)
    const t = o.created_at
    if (!t) return g
    try {
      return `${g} ${new Date(t).toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    } catch {
      return g
    }
  }
  // Raggruppa una lista per giornata: prima oggi, poi i giorni scorsi dal
  // più recente. Serve a separare con una riga i conti ancora da chiudere.
  const groupByDay = (list) => {
    const map = new Map()
    for (const o of list) {
      const k = dayOf(o) || '—'
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(o)
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] === oggiKey ? -1 : b[0] === oggiKey ? 1 : b[0].localeCompare(a[0])))
      .map(([day, orders]) => ({ day, orders }))
  }
  const ordersOggi = effOrders.filter((o) => !arretratiIds.has(o.id))
  const ordersInVista = soloOggi ? ordersOggi : effOrders
  // RIEPILOGO DI TESTATA: conta ESATTAMENTE i conti che si vedono in coda,
  // qualunque tab sia aperta. Prima contava una lista sua — la giornata — e
  // i numeri non tornavano con quello che c'era sotto: «0 chiusi» sopra una
  // tab piena di conti chiusi. Se cambia la regola di cosa resta in coda,
  // cambia anche il riepilogo, perché è la stessa lista.
  // Si parte dagli ordini GREZZI, non da quelli che la tab sta mostrando:
  // «in corso» nasconde i conti appena chiusi qui e le altre tab no, e il
  // riepilogo cambiava numero solo perché si toccava un filtro.
  const inCoda = ordersRaw.filter((o) =>
    restaInCoda(o, {
      chiuso: isChiuso(o) || annullato(o),
      cassa: cassaAperta?.id ?? null,
      apertaDa: cassaAperta?.opened_at ?? null,
      giornata: dayOf(o),
      oggi: oggiKey,
    })
  )
  const recap = ordersRecap(inCoda, isChiuso)
  // Quanti ticket sono ancora al banco, fra i conti di questa apertura di
  // cassa. Senza gli stati del servizio non vuol dire niente: lì le comande
  // risultano servite alla riscossione, e a bloccare la chiusura basta e
  // avanza il conto ancora aperto.
  const ticketDaServire = workflowOn ? comandeDaServire(inCoda) : 0

  // Leggenda "chi ha aperto l'ordine": lettera → nome per lo staff che ha
  // battuto ordini oggi, più l'eventuale voce Cliente (ordini dall'app).
  // Calcolo semplice (non hook: qui siamo dopo eventuali early-return).
  const legenda = (() => {
    const staff = new Map()
    let hasClient = false
    for (const o of ordersOggi) {
      const L = placedByLetter(o.placed_by)
      if (L) { if (!staff.has(L)) staff.set(L, placedByName(o.placed_by)) }
      else hasClient = true
    }
    return { staff: [...staff.entries()].sort((a, b) => a[0].localeCompare(b[0])), hasClient }
  })()

  // Ricerca rapida: numero, cliente, tavolo, drink, chi ha inserito.
  const q = search.trim().toLowerCase()
  // DUE MODI, si sceglie dalle impostazioni (Coda ordini → La ricerca):
  //   filtra    — resta in pagina solo chi risponde (come è sempre stato)
  //   evidenzia — la coda non si tocca: si accende il primo conto trovato
  //               e ce lo si porta sotto gli occhi. Al banco, con la coda a
  //               memoria per posizione, veder sparire tutto il resto vuol
  //               dire perdere il colpo d'occhio proprio mentre si cerca.
  const ricercaEvidenzia = settings.queue_search === 'evidenzia'
  // Cercando esplicitamente si trovano anche i conti dei giorni scorsi
  // (altrimenti sarebbero raggiungibili solo dalla tab "Da chiudere").
  const visibleOrdersTutti =
    q && !ricercaEvidenzia
      ? ordersInVista.filter((o) => ordineCorrisponde(o, q))
      : ordersInVista
  // Col filtro «Miei» acceso restano solo i conti con la propria firma
  // (placed_by): vale per ogni vista della coda, griglia o lista.
  const emailMia = auth.currentUser?.email || ''
  const visibleOrders = soloMiei ? inseritiDa(visibleOrdersTutti, emailMia) : visibleOrdersTutti
  const listView = settings.queue_view === 'lista'
  // ── SI CALCOLA LA VISTA CHE SI GUARDA, NON TUTTE E TRE ─────────
  //
  // Qui dentro convivono quattro modi di guardare la stessa coda — griglia,
  // corsie, lista unica, schede — e se ne mostra UNO. Venivano preparati
  // tutti a ogni disegno: con 120 conti erano circa diciotto passate
  // complete sulla lista e quattro ordinamenti, buttati via tre volte su
  // quattro. E ridisegnare capita a ogni tasto premuto nella ricerca, a
  // ogni card aperta, a ogni snapshot dal server: in una serata piena sono
  // centinaia.
  //
  // Adesso ogni catena ha la sua guardia. Quella non in pagina resta vuota,
  // e chi la legge — sempre da dentro il suo ramo di JSX — non se ne
  // accorge.
  const vistaSchede = !gridView && !corsieView && !listView
  const buckets = listView || vistaSchede ? bucketByStatus(visibleOrders) : {}
  const list = buckets[statusTab] || []
  // Vista a lista unica: ordini in corso (per numero) + evasi.
  const inCorso = listView
    ? [
        ...(buckets[ORDER_STATUSES.RICEVUTO] || []),
        ...(buckets[ORDER_STATUSES.IN_PREPARAZIONE] || []),
        ...(buckets[ORDER_STATUSES.PRONTO] || []),
      ].sort((a, b) => (a.daily_number || 0) - (b.daily_number || 0))
    : []
  const evasi = listView
    ? [...(buckets[ORDER_STATUSES.RITIRATO] || []), ...(buckets[ORDER_STATUSES.PAGATO] || [])]
    : []
  // Vista a griglia: di default gli ordini in corso; col filtro si vedono
  // anche i chiusi/pagati o TUTTI gli ordini in vista.
  const isClosed = isChiuso
  // Chiusi e annullati di prima dell'ultima chiusura di cassa non sono coda:
  // stanno in Cassa. La composizione sta in coda.js, ed è quella provata dai
  // test.
  // Le tre schede della vista a schede SENZA stati di servizio: contate e
  // riempite con le stesse regole della griglia.
  const schedeSemplici = schedeCoda(workflowOn)
  // Cosa resta in coda per QUESTA apertura di cassa: le opzioni sono le
  // stesse per tutte le viste, e scriverle una volta è anche il modo di non
  // farle divergere.
  const restaInCodaOpts = {
    isChiuso: isClosed,
    cassa: cassaAperta?.id ?? null,
    apertaDa: cassaAperta?.opened_at ?? null,
    giornataDi: dayOf,
    oggi: oggiKey,
  }
  // LE SCHEDE, SMISTATE UNA VOLTA SOLA. Servono alle linguette (tre
  // conteggi), alla scheda aperta e alle corsie: erano sei giri di tre
  // filtri sulla stessa lista, adesso è uno.
  const perScheda =
    corsieView || vistaSchede ? contiPerScheda(visibleOrders, restaInCodaOpts) : SCHEDE_VUOTE
  const boardOrders = gridView
    ? ordiniInCoda(visibleOrders, {
        ...restaInCodaOpts,
        filtro: boardFilter,
        sottoChiusi,
      })
        .slice()
        .sort((a, b) => ((a.daily_number || 0) - (b.daily_number || 0)) * (ordineDesc ? -1 : 1))
    : []
  // Ordini POS in invio. Finché il placeholder è attivo l'ordine reale
  // resta nascosto: il match usa il client_temp_id scritto sull'ordine
  // (deterministico anche se lo snapshot arriva PRIMA che il placeholder
  // conosca il realId — era la causa del doppione per un attimo).
  const pendingRealIds = new Set(pend.pending.filter((p) => p.realId).map((p) => p.realId))
  const pendingTempIds = new Set(pend.pending.map((p) => p.tempId))
  const visibleBoard = boardOrders.filter(
    (o) =>
      !pendingRealIds.has(o.id) &&
      !(o.client_temp_id && pendingTempIds.has(o.client_temp_id))
  )
  const boardGroups = gridView ? groupByDay(visibleBoard) : []
  // LE CORSIE DI STATO: partono dalla stessa lista delle altre viste —
  // quello che resta in coda per questa apertura di cassa, già passato per
  // ricerca e «Miei» — e la smistano. Le regole di cosa sta dove stanno in
  // lib/coda.js, che è dove si provano.
  // ORDINATE COME LE ALTRE VISTE. Il tasto «↕» girava solo la griglia: qui
  // la lista arrivava com'era, e premerlo non faceva niente di visibile —
  // un tasto che non risponde fa dubitare dell'app, non del tasto. L'ordine
  // vale per TUTTE le corsie insieme: si guarda la coda, non una colonna.
  // Le comande sono già quelle di questo terminale: le mette effOrders, in
  // cima alla catena, e da lì scendono a tutte le viste. Prima le rimetteva
  // anche qui, e la vista dei conti — che stava su un'altra memoria — no.
  const contiInCorsia = corsieView
    ? perScheda.tutti
        .slice()
        .sort((a, b) => ((a.daily_number || 0) - (b.daily_number || 0)) * (ordineDesc ? -1 : 1))
    : []

  // CHI GUARDA DECIDE COSA VEDE. Sono due domande diverse davanti allo
  // stesso schermo, e rispondere a tutti e due con la stessa vista vuol
  // dire darla sbagliata a uno dei due:
  //
  //   AL BANCO interessa il LAVORO — le COMANDE, una per una, nel passo in
  //   cui stanno: chi sta allo shaker prepara un ticket per volta, non un
  //   conto, e un conto con tre comande in tre passi diversi disegnato come
  //   una card sola racconta una bugia comunque la si metta.
  //
  //   A CHI GUARDA LA SERATA interessa com'è messo il CONTO: in corso,
  //   chiuso, annullato. Sono le tre cose che un conto può essere, le
  //   stesse della griglia e delle schede.
  //
  // Al banco la vista è già quella: la accendono gli stati del servizio
  // (vistaBanco), e non c'è niente da scegliere — un tasto che porta
  // altrove è solo un modo per perdersi la coda a metà serata. Chi guarda
  // la serata parte dai CONTI, come ha sempre fatto, e con la pastiglia
  // può andare a vedere il lavoro: è un passaggio a mano, di questo
  // terminale (vistaCorsie), non il suo default.
  //
  // Senza gli stati del servizio i passi non esistono per nessuno — un
  // conto è solo aperto, chiuso o annullato — e restano le tre corsie.
  // LA PASTIGLIA C'È CON QUALUNQUE VISTA DELLA CODA, non solo a corsie: la
  // vista del banco è una vista a sé, non una variante delle corsie. Chi
  // tiene la cassa lavora in griglia perché è quella che gli serve per i
  // conti, ma a metà serata vuole dare un'occhiata a com'è messa la
  // preparazione: senza questo tasto doveva cambiare vista in Impostazioni,
  // guardare, e tornare a rimetterla com'era. Al banco la pastiglia non
  // c'è: lì non c'è niente da scegliere.
  const puoScegliere = workflowOn && !vistaBanco
  const corsieBanco = bancoCorsie || guardaComande
  // Il ritiro esiste solo dove il locale lo fa: col solo servizio non c'è
  // niente da separare, e la scelta non si propone nemmeno.
  const ritiroEsiste = mondoConsegna(settings) === 'entrambi'
  const divisioneP = corsieDelPronto({ divise: prontoSeparato, ritiroEsiste })
  const corsieDelBanco = corsieBanco
    ? corsieComande(contiInCorsia, { isChiuso: isClosed, prontoDiviso: divisioneP })
    : []
  // LE CORSIE DEI CONTI PARLANO DEL CONTO, non del lavoro: «In corso»,
  // «Chiusi», «Annullati» sono le tre cose che un CONTO può essere, e per
  // un conto chiuso vuol dire incassato — la stessa regola di tutta la coda
  // dei conti (isChiuso, qui sopra).
  const corsie = corsieBanco
    ? []
    : corsieDiStato(contiInCorsia, { isChiuso, sottoChiusi })
  // Le colonne spente su questo terminale si tolgono qui, DOPO che sono
  // state riempite: così i conteggi non cambiano a seconda di cosa si
  // guarda, e riaccendendone una la si trova già piena.
  const corsieMostrate = corsieBanco
    ? corsieDaMostrare(corsieDelBanco, nascoste, { passoDiNascita })
    : corsie
  const cambiaPronto = () => {
    const nuovo = !prontoSeparato
    setProntoSeparato(nuovo)
    ricordaProntoDiviso(nuovo)
  }
  const cambiaCorsia = (id) => {
    const via = nascoste.includes(id) ? nascoste.filter((x) => x !== id) : [...nascoste, id]
    setNascoste(via)
    ricordaCorsieNascoste(via)
  }
  // LE DUE DOMANDE, in una pastiglia sola. Chi guarda la serata vuole
  // sapere sia come sta andando (i CONTI) sia a che punto è la preparazione
  // (le COMANDE): l'interruttore passa dall'una all'altra e si ricorda su
  // questo terminale. Sta in tutte le viste della coda — griglia, lista,
  // schede, corsie — perché la vista del banco è una vista A SÉ, non una
  // variante delle corsie: chi tiene la cassa lavora in griglia, e per dare
  // un'occhiata al banco non deve passare dalle Impostazioni e poi tornare
  // a rimettere tutto com'era. È scritta qui una volta e appesa dove serve.
  // Al banco non c'è: lì la risposta è sempre il lavoro, e un tasto che
  // porta altrove è solo un modo per perdersi la coda a metà serata.
  const cambiaVista = () => {
    const nuova = corsieBanco ? 'conti' : 'comande'
    setVista(nuova)
    ricordaVistaCorsie(nuova)
  }
  // I SOTTOFILTRI DEI CHIUSI. Compaiono solo dentro «Chiusi»: sono una
  // domanda su quei conti, e fuori di lì non vogliono dire niente. Senza
  // gli stati del servizio nemmeno: se non si segue la preparazione, tutto
  // quello che è stato pagato è uscito per definizione.
  const righeSottoChiusi = (attivo) =>
    workflowOn && attivo ? (
      <div className="chips-row chips-sotto" style={{ margin: '-8px 0 16px' }}>
        <span className="muted small">Dei chiusi:</span>
        {SOTTOFILTRI_CHIUSI.map(([k, label]) => (
          <button
            key={k}
            className={`chip small ${sottoChiusi === k ? 'active' : ''}`}
            onClick={() => setSottoChiusi(k)}
            aria-pressed={sottoChiusi === k}
          >
            {label}
          </button>
        ))}
      </div>
    ) : null

  // IL TASTO DICE DOVE PORTA, non dove si è. Era una pastiglia «Comande»
  // che si accendeva quando le comande le stavi già guardando: un
  // interruttore che si legge solo sapendo com'è messo adesso, e per
  // saperlo bisognava guardare le colonne. Un tasto si legge da sé — c'è
  // scritto quello che succede a premerlo — e vale anche per chi arriva
  // davanti allo schermo senza sapere chi c'è stato prima.
  //
  // STA NELLA RIGA DEI FILTRI, MA A DESTRA. È stato provato sotto il «+»:
  // lì restava appeso nel vuoto, rettangolare sotto un tondo, disallineato
  // da tutto. Nella riga dei filtri ha la forma e il peso delle pastiglie
  // che ci sono già, e ci sta senza inventare geometrie. Ma non è un
  // filtro: a sinistra c'è quello che RESTRINGE la lista, a destra quello
  // che CAMBIA VISTA — stessa riga, staccati, così nessuno lo legge come
  // un filtro in più.
  const pastigliaComande = puoScegliere ? (
    <button className="chip chip-vista" onClick={cambiaVista}>
      {corsieBanco ? '🧾 Ordini' : '🍸 Comande'}
    </button>
  ) : null

  // IL CONTO ACCESO. Solo nel modo "evidenzia": è il primo che risponde
  // NELL'ORDINE IN CUI STA SULLO SCHERMO — non nell'ordine in cui arrivano
  // dal database, altrimenti si accende un conto e lo scorrimento va da
  // un'altra parte. Ogni vista ha il suo ordine, quindi si guarda la lista
  // che quella vista sta davvero disegnando.
  // La lista si appiattisce SOLO quando serve davvero: senza la guardia,
  // ogni disegno costruiva un array di tutta la coda per una ricerca che
  // il piu' delle volte non e' nemmeno accesa.
  const ordiniComeSiVedono =
    ricercaEvidenzia && q
      ? gridView
        ? boardGroups.flatMap((g) => g.orders)
        : corsieView
          ? corsieBanco
            ? corsieMostrate.flatMap((c) => c.schede.map((s) => s.ordine))
            : corsieMostrate.flatMap((c) => c.ordini)
          : listView
            ? [...inCorso, ...evasi]
            : list
      : []
  const acceso = ricercaEvidenzia ? primoCorrispondente(ordiniComeSiVedono, q) : null
  const idAcceso = acceso?.id || null
  // Toccando un conto qualsiasi la ricerca si azzera: si è trovato quello
  // che si cercava, e lasciare il testo lì vorrebbe dire ritrovarsi la
  // coda accesa a metà al giro dopo.
  const contoToccato = () => {
    if (ricercaEvidenzia && search) setSearch('')
  }
  // A schede si guarda una scheda per volta: il conto cercato può esserci
  // ed essere in un'altra. Dire solo "non c'è" manderebbe a cercarlo di
  // nuovo dove non è mai stato.
  const altroveNonInVista =
    ricercaEvidenzia && q && !idAcceso ? primoCorrispondente(ordersInVista, q) : null
  const avvisoRicerca =
    ricercaEvidenzia && q && !idAcceso
      ? altroveNonInVista
        ? `🔍 «${search.trim()}» sta in un'altra scheda.`
        : `🔍 Nessun conto per «${search.trim()}».`
      : null

  async function incassaSuLettore(o) {
    setError(null)
    try {
      const res = await readerCheckout(o.id)
      if (res.unavailable) {
        setError('Lettore non disponibile in ambiente di sviluppo: simula dai DevTools.')
      }
    } catch (e) {
      setError(e.message)
    }
  }

  async function annullaSuLettore(o) {
    setError(null)
    try {
      await readerTerminate(o.id)
    } catch (e) {
      setError(e.message)
    }
  }

  // Chi sta usando l'app in questo momento: la storia deve dire CHI ha
  // riaperto un conto, non solo che è stato riaperto.
  const chiSonoIo = () =>
    auth.currentUser?.displayName ||
    String(auth.currentUser?.email || '').split('@')[0] ||
    null

  const toggleCard = (id) =>
    setOpenCards((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  // Pulsanti azione di un ordine (avanza stato, incasso, stampe, annullo).
  // Condivisi dalla card piena (liste) e dalla card-griglia (a scomparsa).
  const orderActions = (o, { senzaAvanzamento = false } = {}) => {
    // CONTO CHIUSO O ANNULLATO: due cose sole. Non c'è più niente da
    // preparare né da incassare, e i tasti spenti in fila — «Contanti» e
    // «Carta» grigi su un conto già pagato — sono solo rumore addosso a chi
    // cerca l'unica cosa che serve: ristampare lo scontrino a chi lo chiede,
    // o riaprire il conto quando ci si accorge di un errore.
    if (isChiuso(o) || annullato(o)) {
      return (
        <div className="grid-2" style={{ marginTop: 8 }}>
          <button
            className="btn ghost small"
            onClick={() => printScontrino(o).catch((e) => setError(`Stampa: ${e.message}`))}
          >
            🧾 Scontrino
          </button>
          <button
            className="btn ghost small"
            onClick={() => setRipristinoTarget(o)}
          >
            ♻️ Riapri conto
          </button>
        </div>
      )
    }
    const ns = nextStatus(o.workflow_status)
    const awaiting = attesaPagamento(o, passoDiNascita)
    const readerReady = settings.payments_reader_enabled && settings.sumup_reader_id
    const readerPending = o.payment_method === 'lettore' && o.payment_status === 'in_attesa'
    // Senza gestione della preparazione l'ordine resta "ricevuto": legare
    // l'incasso agli stati lo renderebbe impossibile.
    const canCollect =
      o.payment_status !== 'pagato' &&
      (!workflowOn || [ORDER_STATUSES.PRONTO, ORDER_STATUSES.RITIRATO].includes(o.workflow_status))
    return (
      <>
        {/* Coi tasti che compaiono e spariscono, quello che cercavi non è più
            dove l'avevi visto un attimo prima. Ci sono sempre: spenti quando
            l'azione non è possibile, con il perché nel titolo. */}
        {/* UN PASSO INDIETRO. Si segna «pronto» il conto sbagliato, si tocca
            «consegnato» mentre il drink è ancora sul vassoio: senza questo
            l'unica strada era annullare e ribattere, perdendo orario e
            storia. Sta accanto al passo avanti, più piccolo: si sbaglia meno
            spesso di quanto si lavori. */}
        {/* Tornare indietro è di chi prepara: la sala non l'ha mai fatto —
            e un tasto che non le serve mai è meglio non averlo, non averlo
            spento (i ruoli non cambiano a metà serata). */}
        {comandaIlLavoro && workflowOn && statiPrimaComanda(o.workflow_status, passoDiNascita).length > 0 && (
          <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span className="muted small">Torna a</span>
            {statiPrimaComanda(o.workflow_status, passoDiNascita).map((st) => (
              <button
                key={st}
                className="chip"
                onClick={() => advance(o, st)}
                title={`Riporta il conto a «${statoAlBanco(st, o.service_mode)}»`}
              >
                ↩︎ {statoAlBanco(st, o.service_mode)}
              </button>
            ))}
          </div>
        )}
        {/* L'UNICO PASSO DELLA SALA È «SERVITO»: è lei a portare il drink al
            tavolo. Prendere in carico e segnare pronto sono del banco. */}
        {workflowOn && !senzaAvanzamento && puoSegnare(ruolo, ns) && (
          <button
            className="btn block"
            disabled={!ns || o.workflow_status === ORDER_STATUSES.RITIRATO || awaiting}
            title={
              awaiting
                ? 'In attesa del pagamento: non si prepara'
                : !ns || o.workflow_status === ORDER_STATUSES.RITIRATO
                  ? 'Nessuno stato successivo'
                  : undefined
            }
            onClick={() => advance(o)}
          >
            {ns && o.workflow_status !== ORDER_STATUSES.RITIRATO
              ? `Segna come “${STATUS_LABELS[ns]}”`
              : 'Servito'}
          </button>
        )}
        {readerPending ? (
          <div style={{ marginTop: 8 }}>
            <p className="muted small" style={{ margin: '0 0 6px', textAlign: 'center' }}>
              📟 In corso sul lettore… carta del cliente sul Solo.
            </p>
            <button className="btn ghost small block" onClick={() => annullaSuLettore(o)}>
              ✖️ Annulla sul lettore
            </button>
          </div>
        ) : (
          readerReady && (
            <button
              className="btn secondary block"
              style={{ marginTop: o.workflow_status === ORDER_STATUSES.PRONTO ? 8 : 0 }}
              disabled={!canCollect}
              title={canCollect ? undefined : 'Conto già chiuso o non ancora incassabile'}
              onClick={() => incassaSuLettore(o)}
            >
              📟 Incassa sul lettore
            </button>
          )
        )}
        {(
          // DUE tasti, non uno. C'era solo "Incassato (contanti)": è il tasto
          // più a portata di mano della board, e chi incassava con la carta lo
          // premeva lo stesso — il conto finiva nei contanti e a fine serata
          // la cassa non tornava. Il metodo ora si sceglie qui.
          <div className="grid-2" style={{ marginTop: 8 }}>
            <button
              className="btn"
              disabled={readerPending || !canCollect}
              title={canCollect ? undefined : 'Conto già chiuso'}
              onClick={() =>
                markOrderPaid(o.id, 'banco', { autoServe: !workflowOn }).catch((e) =>
                  setError(e.message)
                )
              }
            >
              💶 Contanti
            </button>
            <button
              className="btn"
              disabled={readerPending || !canCollect}
              title={canCollect ? undefined : 'Conto già chiuso'}
              onClick={() =>
                markOrderPaid(o.id, 'carta', { autoServe: !workflowOn }).catch((e) =>
                  setError(e.message)
                )
              }
            >
              💳 Carta
            </button>
          </div>
        )}
        <div className="grid-2" style={{ marginTop: 8 }}>
          <button
            className="btn ghost small"
            onClick={() => printComanda(o, o.comande?.find((cc) => cc.id === o.active_comanda_id) ?? null).catch((e) => setError(`Stampa: ${e.message}`))}
          >
            🖨 Comanda
          </button>
          <button
            className="btn ghost small"
            onClick={() => printScontrino(o).catch((e) => setError(`Stampa: ${e.message}`))}
          >
            🧾 Scontrino
          </button>
        </div>
        {/* Annullare è di chi versa: è il suo lavoro che si butta. */}
        {comandaIlLavoro && o.workflow_status === ORDER_STATUSES.RICEVUTO && (
          <button
            className="btn ghost small block"
            style={{ marginTop: 8 }}
            onClick={() => setCancelTarget({ order: o, kind: 'ordine' })}
          >
            ✖️ Annulla ordine
          </button>
        )}
        {/* Annullare è di chi versa: è il suo lavoro che si butta. */}
        {comandaIlLavoro && o.workflow_status === ORDER_STATUSES.IN_PREPARAZIONE && (
          <button
            className="btn ghost small block"
            style={{ marginTop: 8 }}
            onClick={() => setCancelTarget({ order: o, kind: 'preparazione' })}
          >
            ✖️ Annulla preparazione
          </button>
        )}
        {/* Annullare è di chi versa: è il suo lavoro che si butta. */}
        {comandaIlLavoro && o.workflow_status === ORDER_STATUSES.PRONTO && (
          <button
            className="btn ghost small block"
            style={{ marginTop: 8 }}
            onClick={() => setCancelTarget({ order: o, kind: 'non_ritirato' })}
          >
            🚫 {o.service_mode === 'tavolo' ? 'Non servito' : 'Non ritirato'}
          </button>
        )}
        {/* STORIA E RIPRISTINA NON STANNO QUI. Sono due cose che si fanno
            una volta ogni tanto — «com'è che questo conto è stato
            riaperto?» — e in coda occupavano una riga intera su ogni card,
            per tutta la serata, sul telefono dove lo spazio è quello che
            serve agli ordini. Si trovano dentro il conto (⋯ Azioni), che è
            dove si va quando quella domanda ce la si fa davvero. */}
      </>
    )
  }

  // Card-griglia compatta: tutte uguali, più larghe che alte. Mostra solo
  // numero, cliente/tavolo, stato, n° prodotti e subtotale. I tasti sono a
  // scomparsa: nascosti di default, compaiono toccando la card.
  const renderGridCard = (o) => {
    const awaiting = attesaPagamento(o, passoDiNascita)
    const count = (o.order_items || []).reduce((s, i) => s + i.qty, 0)
    const open = openCards.has(o.id)
    return (
      <div
        className={`card order-card grid-card ${o.workflow_status} ${orderStripClass(o)}${
          workflowOn && pagato(o) && !servito(o) ? ' pagato-da-servire' : ''
        }${o.id === idAcceso ? ' conto-acceso' : ''}`}
        key={o.id}
        id={`ordine-${o.id}`}
        onClick={contoToccato}
        style={awaiting ? { opacity: 0.55 } : undefined}
      >
        {/* Corpo: click → dettaglio ordine */}
        <div
          className="grid-card-main"
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/ordine/${o.id}`)}
        >
          <div className="row between">
            <span className="bignum">#{o.daily_number ?? '—'} <OrderBy order={o} /></span>
            {/* Il badge di preparazione compare solo se si tracciano gli stati:
                a gestione preparazione spenta l'ordine è solo ricevuto→pagato. */}
            {workflowOn && (
              <span className={`pill ${o.workflow_status}`}>
                {STATUS_EMOJI[o.workflow_status]}{' '}
                {o.workflow_status === ORDER_STATUSES.RITIRATO
                  ? ritiratoLabel(o.service_mode)
                  : STATUS_LABELS[o.workflow_status]}
              </span>
            )}
          </div>
          {/* NOME del conto in grande: è la prima cosa da riconoscere sulla
              card. Tavolo, gruppo e pagamento restano piccoli, sotto.
              La riga c'è SEMPRE, anche senza nome: altrimenti i conti senza
              nome venivano più bassi e la board risultava a scalini. */}
          <div className="grid-card-name">{o.customer_name || ' '}</div>
          <div className="grid-card-sub row between" style={{ gap: 6 }}>
            <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {o.table_label && <span className="muted">🍽 Tavolo {o.table_label}</span>}
              {o.note && <span className="muted">{o.table_label ? ' · ' : ''}{o.note}</span>}
            </span>
            {/* Pagamento allineato a DESTRA, fra il badge di stato (sopra) e
                il prezzo (sotto). Il gruppo, se c'è, gli sta accanto. */}
            <span className="row" style={{ gap: 4, flexShrink: 0 }}>
              {o.group_name_snapshot && (
                <span className="pill small">👥 {o.group_name_snapshot}</span>
              )}
              {o.payment_status === 'pagato' && o.workflow_status !== ORDER_STATUSES.PAGATO && (
                <span className="pill pagato small">💳 Pagato</span>
              )}
              {o.payment_status === 'parziale' && (
                <span className="pill ricevuto small" title={`Incassati ${formatPrice(paidAmount(o))}`}>
                  💳 Acconto
                </span>
              )}
            </span>
          </div>
          <div className="row between" style={{ alignItems: 'baseline', marginTop: 'auto' }}>
            <span className="grid-card-meta">
              {count} prodott{count === 1 ? 'o' : 'i'} · {apertoLabel(o)}
              {/* Sconto applicato: si vede, e il totale è già quello scontato. */}
              {(o.discount_amount || 0) > 0 && (
                <span className="sconto-badge"> 🎁 −{formatPrice(o.discount_amount)}</span>
              )}
            </span>
            {/* Un conto ANNULLATO non ha incassato niente: il totale si mostra
                barrato, com'è nei conti di casa. Prima si leggeva "4,00 €"
                identico a un conto vero e sembrava che contasse (non conta:
                gli annullati restano fuori da cassa e statistiche). */}
            <span
              className={`grid-card-tot${annullato(o) ? ' tot-annullato' : ''}`}
              title={annullato(o) ? 'Ordine annullato: non incassato' : undefined}
            >
              {formatPrice(orderTotal(o))}
            </span>
          </div>
        </div>
        {/* Pulsante separato: apre/chiude i tasti azione (non va al dettaglio) */}
        <button
          type="button"
          className="grid-card-toggle"
          onClick={() => toggleCard(o.id)}
          aria-expanded={open}
        >
          {open ? '▴ Chiudi' : '⋯ Azioni'}
        </button>
        {open && <div className="grid-card-actions">{orderActions(o)}</div>}
      </div>
    )
  }

  // Ordine POS in invio: a schermo è GIÀ un ordine a tutti gli effetti
  // (stessa card, stessi colori, info complete) — la sincronizzazione la
  // racconta il toast, non la card. Solo in errore si distingue.
  function renderPendingCard(p) {
    const o = p.order
    const count = (o.order_items || []).reduce((s, i) => s + i.qty, 0)
    const isError = p.state === 'error'
    return (
      <div
        className={`card order-card grid-card ${isError ? 'grid-card-pending error' : o.workflow_status}`}
        key={p.tempId}
      >
        <div className="grid-card-main" style={{ cursor: 'default' }}>
          <div className="row between">
            <span className="bignum">#{o.daily_number ?? '…'} <OrderBy order={o} /></span>
            <span className={`pill ${isError ? '' : o.workflow_status}`}>
              {isError
                ? '⚠️ Errore invio'
                : `${STATUS_EMOJI[o.workflow_status]} ${STATUS_LABELS[o.workflow_status]}`}
            </span>
          </div>
          <div className="grid-card-sub">
            {o.customer_name && <strong>{o.customer_name}</strong>}
            {o.table_label && <span className="muted"> · Tavolo {o.table_label}</span>}
          </div>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <span className="muted">{count} prodott{count === 1 ? 'o' : 'i'}</span>
            <span className="grid-card-tot">{formatPrice(o.total)}</span>
          </div>
        </div>
        {/* Footer identico alla card reale (stessa altezza prima e dopo
            la sincronizzazione); le azioni arrivano con l'ordine vero. */}
        {!isError && (
          <button type="button" className="grid-card-toggle" disabled>
            ⋯ Azioni
          </button>
        )}
        {isError && (
          <div className="grid-card-actions">
            <p className="muted small" style={{ margin: '0 0 6px' }}>{p.error}</p>
            <button className="btn ghost small block" onClick={() => dismissPending(p.tempId)}>
              Rimuovi
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderCard = (o) => {
        const awaiting = attesaPagamento(o, passoDiNascita)
        return (
          <div
            className={`card order-card ${o.workflow_status}${
              workflowOn && pagato(o) && !servito(o) ? ' pagato-da-servire' : ''
            }${o.id === idAcceso ? ' conto-acceso' : ''}`}
            key={o.id}
            id={`ordine-${o.id}`}
            onClick={contoToccato}
            style={awaiting ? { opacity: 0.55 } : undefined}
          >
            <div className="row between">
              <div>
                <span className="bignum" style={{ fontSize: '1.4rem', fontWeight: 600 }}>
                  #{o.daily_number ?? '—'} <OrderBy order={o} />
                </span>{' '}
                {o.customer_name && <strong>{o.customer_name}</strong>}{' '}
                {o.table_label && (
                  <span className="muted">· Tavolo {o.table_label}</span>
                )}{' '}
                {o.group_name_snapshot && (
                  <span className="pill small">👥 {o.group_name_snapshot}</span>
                )}{' '}
                <span className="muted small">📅 {apertoLabel(o)}</span>
                {o.service_mode === 'banco' && (
                  <span className="pill" style={{ marginLeft: 6 }}>🚶 Ritiro al banco</span>
                )}
                {o.service_mode === 'tavolo' && (
                  <span className="pill" style={{ marginLeft: 6 }}>🍸 Al tavolo</span>
                )}
                {/* Stato pagamento */}
                {o.payment_status === 'pagato' && o.workflow_status !== ORDER_STATUSES.PAGATO && (
                  <span className="pill pagato" style={{ marginLeft: 6 }}>
                    💳 Pagato{o.payment_method === 'online' ? ' online' : ''}
                  </span>
                )}
                {o.payment_status === 'parziale' && (
                  <span className="pill ricevuto" style={{ marginLeft: 6 }}>
                    💳 Parziale · incassati {formatPrice(paidAmount(o))}
                  </span>
                )}
                {awaiting && (
                  <span className="pill ricevuto" style={{ marginLeft: 6 }}>
                    ⏳ In attesa di pagamento
                  </span>
                )}
                {o.payment_status === 'fallito' && (
                  <span className="pill" style={{ marginLeft: 6, background: 'rgba(231,76,60,0.25)', color: '#ffb3a7' }}>
                    ❌ Pagamento fallito
                  </span>
                )}
                {o.payment_after_cancel && (
                  <span className="pill" style={{ marginLeft: 6, background: 'rgba(231,76,60,0.25)', color: '#ffb3a7' }}>
                    ⚠️ Pagato dopo annullo
                  </span>
                )}
              </div>
              {workflowOn && (
                <span className={`pill ${o.workflow_status}`}>
                  {STATUS_EMOJI[o.workflow_status]}{' '}
                  {o.workflow_status === ORDER_STATUSES.RITIRATO
                    ? ritiratoLabel(o.service_mode)
                    : STATUS_LABELS[o.workflow_status]}
                </span>
              )}
            </div>
            <div style={{ margin: '8px 0' }}>
              {(o.order_items || []).map((i) => (
                <div className="row between" key={i.id}>
                  <span>
                    {i.qty}× {i.name}
                    {/* La nota della RIGA — «senza ghiaccio», «per Anna» — è
                        quella che cambia come si prepara. Si vedeva solo nel
                        conto e sulla comanda stampata: chi lavora guardando
                        lo schermo invece della stampante non la leggeva mai. */}
                    {i.note && <span className="riga-nota">↳ {i.note}</span>}
                  </span>
                  <span className="muted">{formatPrice(i.qty * i.unit_price)}</span>
                </div>
              ))}
            </div>
            {o.placed_by && (
              <p className="muted small" style={{ margin: '0 0 8px' }}>
                ✍️ Ordine manuale inserito da <strong>{placedByName(o.placed_by)}</strong> ({o.placed_by.role})
              </p>
            )}
            {o.note && (
              <div className="order-note">📝 {o.note}</div>
            )}
            {/* Tempi effettivi: preparazione sui "pronti", servizio sui serviti al tavolo. */}
            {o.workflow_status === ORDER_STATUSES.PRONTO && (() => {
              const m = minutesBetween(o.status_times?.in_preparazione, o.status_times?.pronto)
              return m != null && (
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  ⏱ Preparato in {m} min
                </p>
              )
            })()}
            {o.workflow_status === ORDER_STATUSES.RITIRATO && o.service_mode === 'tavolo' && (() => {
              const m = minutesBetween(o.status_times?.pronto, o.status_times?.ritirato)
              return m != null && (
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  ⏱ Servito in {m} min
                </p>
              )
            })()}
            {awaiting && (
              <p className="muted small" style={{ margin: '0 0 8px' }}>
                ⏳ Entra in coda al pagamento: non preparare.
              </p>
            )}
            {orderActions(o)}
          </div>
        )
  }

  return (
    <div className={lavagna ? `queue-board${corsieView ? ' corsie-board' : ''}` : undefined}>
      <PortaInVista id={idAcceso} />
      {/* A tutto schermo la topbar non c'è, e con lei sparivano campanella,
          notifiche e stato della sincronizzazione: torna come tasto tondo in
          basso a destra (il CSS la mostra solo quando serve). */}
      {lavagna && <StatusBell floating />}
      {/* L'avviso a fumetto, se il locale ha scelto quello: sta SOLO qui,
          nella coda, che è il posto dove gli ordini si aspettano. Toccandolo
          si aprono gli avvisi (la campanella ascolta l'evento). */}
      <FumettoAvvisi onApri={() => window.dispatchEvent(new Event('tana:apri-avvisi'))} />
      {error && <div className="banner">Errore: {error}</div>}

      {/* Cassa chiusa: non si battono ordini finché non la si apre. */}
      {!cassaLoading && !cassaAperta && (
        <div className="banner cassa-chiusa-banner">
          🔴 <strong>Cassa chiusa</strong> —{' '}
          {gestore ? 'per battere ordini apri prima la cassa.' : 'per battere ordini la deve aprire il banco.'}{' '}
          {/* Si apre da qui: mandare al flusso di cassa per premere un tasto e
              tornare indietro sono tre passaggi per una cosa che ne vale uno.
              La sala invece legge e basta: aprirla non è cosa sua, e un tasto
              che dà «permesso negato» è peggio di nessun tasto. */}
          {gestore && (
            <button
              type="button"
              className="btn small"
              style={{ marginLeft: 8 }}
              onClick={() => setApriCassa(true)}
            >
              🟢 Apri cassa
            </button>
          )}
        </div>
      )}

      {lavagna ? (
        // Testata compatta della lavagna — griglia o corsie che sia: info
        // giornata, ricerca e, in alto a destra, il «+» per battere un nuovo
        // ordine (apre il POS cassa). È una sola per tutte e due le viste:
        // cambiare vista non deve cambiare i comandi.
        <div className="board-head">
          <div className="board-title">
            <strong>In servizio</strong>
          </div>
          <input
            type="search"
            className="menu-search board-search"
            placeholder="🔍 Cerca numero, cliente, tavolo, drink…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="board-actions">
            {/* SI STAMPERÀ? La domanda viene in mente mentre si prende
                l'ordine, non nelle impostazioni — e in sala le
                impostazioni non ci sono affatto. */}
            <PallinoStampante gestore={gestore} />
            {/* SUL TELEFONO IL ⋯, SUGLI SCHERMI LARGHI LE ICONE. In una
                barra stretta le azioni che si fanno ogni tanto stanno
                dietro un tasto solo; su tablet e computer lo spazio accanto
                alla ricerca c'è, e nasconderle dietro un menu vuol dire due
                gesti per una cosa che ne vale uno — e non vedere nemmeno se
                i pannelli sono accesi. Stesse azioni, stessi handler: qui
                cambia solo dove stanno. */}
            {telefono ? (
              <button
                className={`btn ghost small board-pannelli${showPanels ? ' active' : ''}`}
                onClick={() => setMenuBoard(true)}
                title="Altro: pannelli e ordinamento"
                aria-label="Altro"
              >
                ⋯
              </button>
            ) : (
              <>
                <button
                  className={`btn ghost small board-icona${showPanels ? ' active' : ''}`}
                  onClick={() => setShowPanels((v) => !v)}
                  title={showPanels ? 'Nascondi i pannelli' : 'Chiamate staff e gruppi'}
                  aria-label={showPanels ? 'Nascondi i pannelli' : 'Chiamate staff e gruppi'}
                  aria-pressed={showPanels}
                >
                  📟
                </button>
                <button
                  className="btn ghost small board-icona"
                  onClick={cambiaOrdine}
                  title={
                    ordineDesc
                      ? 'Adesso: prima gli ultimi — tocca per partire dai primi'
                      : 'Adesso: prima i primi della serata — tocca per partire dagli ultimi'
                  }
                  aria-label={ordineDesc ? 'Ordina dal meno recente' : 'Ordina dal più recente'}
                >
                  ↕
                </button>
                {(() => {
                  // La voce della cassa (apri/chiudi, o niente per la sala)
                  // la decide coda.js: è una regola, e le regole si provano.
                  const v = voceCassa({
                    gestore,
                    cassaAperta: !!cassaAperta,
                    contiAperti: recap.aperti,
                    daServire: ticketDaServire,
                  })
                  if (!v) return null
                  return (
                    // QUESTA NON È UN'ICONA. Le altre due — i pannelli,
                    // l'ordinamento — si capiscono e si annullano con un
                    // secondo tocco; la cassa è la cosa che chiude la serata,
                    // e un lucchetto grigio in fondo a una barra non dice a
                    // nessuno che cos'è. Si scrive per esteso.
                    //
                    // E IL MOTIVO STA ATTACCATO AL TASTO. Messo in fondo alla
                    // riga finiva accanto al «+», e si leggeva come una nota
                    // del «nuovo ordine», che non c'entra niente: la frase
                    // spiega perché QUEL tasto è grigio, e deve stare dove
                    // guarda l'occhio quando lo trova spento.
                    <span className="board-cassa-box">
                      <button
                        className="btn ghost small board-cassa"
                        disabled={v.disabled}
                        title={v.hint}
                        onClick={() => (v.id === 'apri-cassa' ? setApriCassa(true) : setChiudiCassa(true))}
                      >
                        {v.icon} {v.label}
                      </button>
                      {v.disabled && v.hint && (
                        <span className="board-cassa-perche muted small">{v.hint}</span>
                      )}
                    </span>
                  )
                })()}
              </>
            )}
            {cassaAperta || cassaLoading ? (
              <Link className="btn board-add" to="/pos" aria-label="Nuovo ordine" title="Nuovo ordine" />
            ) : (
              <button
                className="btn board-add"
                disabled
                aria-label="Nuovo ordine (apri prima la cassa)"
                title="Apri la cassa per battere ordini"
              />
            )}
          </div>
          {/* SECONDA RIGA: conteggi e legenda degli autori. Stavano dentro
              il titolo, e il titolo diventava alto due o tre righe: la
              testata li centrava tutti insieme (ricerca, ⋯, +) su
              quell'altezza variabile, e sul tablet non era allineato più
              niente. Qui sono una riga a sé, sotto e a filo a sinistra. */}
          <div className="board-sotto">
            <span className="muted board-conti">
              {recap.aperti} apert{recap.aperti === 1 ? 'o' : 'i'} · {recap.chiusi} chius
              {recap.chiusi === 1 ? 'o' : 'i'}
              {/* Gli annullati solo se ce ne sono: una serata pulita non
                  deve leggere «0 annullati». Fuori dal totale, che sono i
                  soldi veri. */}
              {recap.annullati > 0 &&
                ` · ${recap.annullati} annullat${recap.annullati === 1 ? 'o' : 'i'}`}
              {' · '}
              {formatPrice(recap.total)}
            </span>
            {/* Cercando con l'evidenziazione la coda non cambia: se non si
                trova niente, senza scritta non succede proprio nulla e si
                resta a chiedersi se abbia capito. */}
            {avvisoRicerca && <span className="muted">{avvisoRicerca}</span>}
            {(legenda.staff.length > 0 || legenda.hasClient) && (
              <div className="order-legend">
                {legenda.staff.map(([L, name]) => (
                  <span key={L}><span className="order-by staff">{L}</span> {name}</span>
                ))}
                {legenda.hasClient && (
                  <span><span className="order-by client">🌐</span> Cliente</span>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <strong>Oggi</strong>
            <div className="muted">
              {recap.aperti} apert{recap.aperti === 1 ? 'o' : 'i'} · {recap.chiusi} chius{recap.chiusi === 1 ? 'o' : 'i'}
              {recap.annullati > 0 &&
                ` · ${recap.annullati} annullat${recap.annullati === 1 ? 'o' : 'i'}`}
              {' · '}
              {formatPrice(recap.total)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <Link className="btn" to="/pos" style={{ flex: 1 }}>
              🍸 POS cassa
            </Link>
            <Link className="btn ghost" to="/menu" style={{ flex: 1 }}>
              ✍️ Vista cliente
            </Link>
          </div>
        </>
      )}

      <ActionSheet
        open={menuBoard}
        onClose={() => setMenuBoard(false)}
        titolo="Coda ordini"
        voci={[
          {
            id: 'pannelli',
            icon: '📟',
            label: showPanels ? 'Nascondi i pannelli' : 'Chiamate staff e gruppi',
            hint: 'Il cerca-persone e i gruppi aperti',
            onClick: () => setShowPanels((v) => !v),
          },
          {
            id: 'ordine',
            icon: '↕',
            label: ordineDesc ? 'Ordina dal meno recente' : 'Ordina dal più recente',
            hint: ordineDesc ? 'Adesso: prima gli ultimi' : 'Adesso: prima i primi della serata',
            onClick: cambiaOrdine,
          },
          // La voce della cassa (apri/chiudi, o niente per la sala) sta in
          // coda.js: è una regola, e le regole si provano.
          (() => {
            const v = voceCassa({
              gestore,
              cassaAperta: !!cassaAperta,
              contiAperti: recap.aperti,
              daServire: ticketDaServire,
            })
            if (!v) return null
            return {
              ...v,
              onClick: () => (v.id === 'apri-cassa' ? setApriCassa(true) : setChiudiCassa(true)),
            }
          })(),
        ].filter(Boolean)}
      />

      {chiudiCassa && (
        <ChiudiCassaBox
          by={auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email } : null}
          onClose={() => setChiudiCassa(false)}
        />
      )}

      {apriCassa && (
        <ApriCassaBox
          cutoffHour={cutoffHour}
          by={auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email } : null}
          onClose={() => setApriCassa(false)}
        />
      )}

      {/* Pannelli chiamate/gruppi: sulle lavagne compaiono solo col toggle
          «Pannelli»; nelle altre viste restano sempre visibili. */}
      {(!lavagna || showPanels) && (
        <>
          {/* Aperti APPOSTA dal menu ⋯: se non c'è niente da mostrare lo
              si dice. Prima si toccava «Chiamate staff e gruppi» e non
              succedeva niente — senza altri account lo staff è vuoto e i
              gruppi possono essere spenti — e sembrava un tasto rotto. */}
          <StaffCallList mostraSeVuoto={showPanels} />
          {/* Pannello, cartello o niente: la regola sta in lib/coda.js. */}
          {gruppiInCoda({
            accesi: settings.groups_enabled,
            inCoda: settings.groups_in_queue,
            pannelli: showPanels,
          }) === 'pannello' && <GroupsPanel orders={orders} role="bartender" />}
          {gruppiInCoda({
            accesi: settings.groups_enabled,
            inCoda: settings.groups_in_queue,
            pannelli: showPanels,
          }) === 'cartello' && (
            <div className="card" style={{ marginTop: 8 }}>
              <strong>👥 Gruppi</strong>
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                I gruppi non si mostrano in coda: si accendono in
                Impostazioni → Gruppi.
              </p>
            </div>
          )}
        </>
      )}

      {!lavagna && (
        <>
          <input
            type="search"
            className="menu-search"
            placeholder="🔍 Cerca per numero, cliente, tavolo, drink…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginTop: 8 }}
          />
          {avvisoRicerca && (
            <p className="muted small" style={{ margin: '-4px 0 8px' }}>
              {avvisoRicerca}
            </p>
          )}
          <div className="chips-row" style={{ margin: '8px 0 12px' }}>
            <button
              className={`chip ${soloMiei ? 'active' : ''}`}
              onClick={() => setSoloMiei((v) => !v)}
              title="Solo i conti inseriti da te"
            >
              ✍️ Miei
            </button>
            {pastigliaComande}
          </div>
        </>
      )}

      {gridView ? (
        <>
          {/* Avvisi (es. comanda non stampata) dagli invii in background */}
          {pend.banners.map((b) => (
            <div className="banner" key={b.id} onClick={() => dismissBanner(b.id)} style={{ cursor: 'pointer' }}>
              🖨 {b.msg} <span className="muted">(tocca per chiudere)</span>
            </div>
          ))}
          {/* Filtro: in corso (default) / chiusi / tutti / da chiudere.
              Sotto ci vuole aria: attaccati, i chip sembravano la prima riga
              delle card. */}
          <div className="chips-row" style={{ margin: '8px 0 16px' }}>
            {[
              ['attivi', 'In corso'],
              ['chiusi', '💶 Chiusi'],
              // Gli annullati hanno una tab loro: fra i chiusi facevano
              // numero senza essere incassi, e per ritrovarne uno da
              // riaprire si cercava in mezzo a quelli buoni.
              ['annullati', '✖️ Annullati'],
              ['tutti', 'Tutti'],
            ].map(([k, label]) => (
              <button
                key={k}
                className={`chip ${boardFilter === k ? 'active' : ''}`}
                onClick={() => setBoardFilter(k)}
              >
                {label}
              </button>
            ))}
            <button
              className={`chip ${soloMiei ? 'active' : ''}`}
              onClick={() => setSoloMiei((v) => !v)}
              title="Solo i conti inseriti da te"
            >
              ✍️ Miei
            </button>
            {/* C'ERA UN «NASCONDI PAGATI», E NON SERVE PIÙ. Serviva a togliere
                dagli occhi i conti già incassati ma non ancora serviti,
                perché restavano in mezzo a quelli in corso: adesso un conto
                pagato è chiuso, sta fra i chiusi, e chi vuole sapere quali
                hanno ancora roba da portare lo chiede lì dentro («Da
                servire»). Un tasto per nascondere una cosa che non c'è più
                in mezzo ai piedi è solo un tasto in più. */}
            {/* Conti dei giorni scorsi: di default sono in coda, sotto la
                loro data. Questo tasto li nasconde e lascia solo oggi. */}
            {(arretrati.length > 0 || soloOggi) && (
              <button
                className={`chip ${soloOggi ? 'active' : ''}`}
                onClick={() => setSoloOggi((v) => !v)}
                title="Nascondi i conti rimasti aperti dai giorni scorsi"
              >
                📅 Solo oggi{arretrati.length ? ` (${arretrati.length} da chiudere)` : ''}
              </button>
            )}
            {pastigliaComande}
          </div>
          {righeSottoChiusi(boardFilter === 'chiusi')}
          {/* Griglia: ordini in invio (grigi) + ordini secondo il filtro */}
          {pend.pending.length === 0 && visibleBoard.length === 0 && (
            <div className="empty">
              {`Nessun ordine${
                boardFilter === 'chiusi'
                  ? ' chiuso'
                  : boardFilter === 'annullati'
                    ? ' annullato'
                    : boardFilter === 'attivi'
                      ? ' in corso'
                      : ''
              }${soloOggi ? ' oggi' : ''}.`}
            </div>
          )}
          {/* I nuovi ordini vanno IN FONDO (numeri più alti): il placeholder
              in sync sta già lì, così alla conferma non cambia posizione. */}
          {/* Una griglia per giornata: oggi in cima, poi i conti ancora
              aperti dei giorni scorsi, ciascuno sotto la sua data. */}
          {!boardGroups.some((g) => g.day === oggiKey) && pend.pending.length > 0 && (
            <div className="order-grid">{pend.pending.map(renderPendingCard)}</div>
          )}
          {boardGroups.map(({ day, orders: gOrders }) => (
            <div key={day}>
              {day !== oggiKey && (
                <div className="day-sep">
                  ⏳ Da chiudere · {businessDayLabel(day, new Date(), cutoffHour)}
                </div>
              )}
              <div className="order-grid">
                {gOrders.map(renderGridCard)}
                {day === oggiKey && pend.pending.map(renderPendingCard)}
              </div>
            </div>
          ))}
        </>
      ) : corsieView ? (
        <>
          {/* CORSIE DI STATO: una colonna per passo del lavoro, un tasto per
              card. Le azioni sono le STESSE della griglia — «avanti di uno»
              è `advance`, l'incasso è il pagamento del conto — perché una
              vista è un modo di guardare, non un secondo modo di lavorare. */}
          <div className="chips-row" style={{ margin: '8px 0 12px' }}>
            <button
              className={`chip ${soloMiei ? 'active' : ''}`}
              onClick={() => setSoloMiei((v) => !v)}
              title="Solo i conti inseriti da te"
            >
              ✍️ Miei
            </button>
            {/* QUALI COLONNE TENERE A SCHERMO. A metà serata chi sta allo
                shaker guarda «Da fare» e «Al banco», e le altre due gli
                mangiano mezzo schermo per roba che in quel momento non lo
                riguarda. È una scelta di QUESTO terminale e si ricorda. */}
            {corsieBanco && (
              <button
                className={`chip ${nascoste.length > 0 ? 'active' : ''}`}
                onClick={() => setScegliCorsie((v) => !v)}
                aria-expanded={scegliCorsie}
                title="Scegli quali colonne tenere a schermo"
              >
                ▦ Colonne
              </button>
            )}
            {pastigliaComande}
          </div>
          {righeSottoChiusi(!corsieBanco)}
          {corsieBanco && scegliCorsie && (
            <div className="chips-row corsie-scelta" style={{ margin: '0 0 12px' }}>
              {corsieSceglibili(corsieDelBanco, { passoDiNascita }).map((c) => (
                <button
                  key={c.id}
                  className={`chip ${nascoste.includes(c.id) ? '' : 'active'}`}
                  onClick={() => cambiaCorsia(c.id)}
                  aria-pressed={!nascoste.includes(c.id)}
                >
                  {c.titolo}
                </button>
              ))}
              {/* IL PRONTO, UNITO O DIVISO. Sta qui perché è una domanda
                  sulle colonne, e qui si risponde alle altre. Solo dove il
                  ritiro esiste: col solo servizio non c'è niente da
                  separare, e un tasto che non fa niente è peggio di un
                  tasto che non c'è. */}
              {ritiroEsiste && (
                <button
                  className={`chip ${prontoSeparato ? 'active' : ''}`}
                  onClick={cambiaPronto}
                  aria-pressed={prontoSeparato}
                  title={
                    prontoSeparato
                      ? 'Adesso il pronto è in due colonne — tocca per riunirle'
                      : 'Adesso il pronto è una colonna sola, col badge — tocca per dividere servizio e ritiro'
                  }
                >
                  ✂️ Dividi il pronto
                </button>
              )}
            </div>
          )}
          {corsieBanco ? (
            <CorsieComande
              // IL ⋯ DELLA CARD. Le cose che si fanno di rado ma proprio
              // da lì: rimandare indietro una comanda toccata per sbaglio,
              // dividerla, ristamparla. Le decide qui la pagina, che sa le
              // impostazioni del locale e come si scrive sul database; la
              // card le disegna e basta.
              vociComanda={(s) => {
                const c = s?.comanda
                if (!c) return []
                const o = s.ordine
                const indietro = statiPrimaComanda(c.status, passoDiNascita)
                return [
                  // Tornare indietro e dividere sono di chi prepara: alla
                  // sala restano lo stato che vede e la ristampa.
                  ...(comandaIlLavoro ? indietro : []).map((st) => ({
                    id: `indietro-${st}`,
                    icon: '↩︎',
                    label: `Torna a «${statoAlBanco(st, o?.service_mode)}»`,
                    hint: 'Segnata per sbaglio: si rimette dov\'era',
                    onClick: () => avanzaComanda(o, c, st),
                  })),
                  comandaIlLavoro && comandaDivisibile(c) && {
                    id: 'dividi',
                    icon: '✂️',
                    label: 'Preparazione parziale',
                    hint: 'Ne preparo una parte adesso, il resto dopo',
                    onClick: () => navigate(`/ordine/${o.id}/comanda/${c.id}?dividi=1`),
                  },
                  {
                    id: 'ristampa',
                    icon: '🖨',
                    label: 'Ristampa la comanda',
                    hint: 'Se il foglio si è perso o è illeggibile',
                    onClick: () =>
                      printComanda(o, c).catch((e) => setError(`Stampa: ${e.message}`)),
                  },
                ].filter(Boolean)
              }}
              corsie={corsieMostrate}
              ruolo={ruolo}
              mostraModo={ritiroEsiste && !prontoSeparato}
              idAcceso={idAcceso}
              inArrivo={pend.pending}
              onScarta={dismissPending}
              // TOCCANDO LA CARD SI APRE LA COMANDA, non il conto: dal
              // banco la prima domanda è «cosa devo fare qui», e la
              // risposta è il ticket. Nella colonna dei soldi la card è
              // già il conto (non c'è una comanda sola da aprire) e allora
              // si va lì, come prima.
              onApri={(o, comanda) => {
                contoToccato()
                navigate(comanda ? `/ordine/${o.id}/comanda/${comanda.id}` : `/ordine/${o.id}`)
              }}
              onApriConto={(o) => {
                contoToccato()
                navigate(`/ordine/${o.id}`)
              }}
              onAvanza={avanzaComanda}
              onIncassa={(o) => navigate(`/ordine/${o.id}?pagamento=1`)}
              espansa={corsiaEspansa}
              onEspandi={setCorsiaEspansa}
              attesaPagamento={(o) =>
                attesaPagamento(o, passoDiNascita)
              }
            />
          ) : (
          <CorsieStato
            corsie={corsieMostrate}
            idAcceso={idAcceso}
            // I conti appena battuti al POS, ancora in volo: in cima alla
            // prima corsia. Sono già ordini a tutti gli effetti per chi
            // lavora — la sincronizzazione è affar nostro, non suo.
            inArrivo={pend.pending}
            onScarta={dismissPending}
            onApri={(o) => {
              contoToccato()
              navigate(`/ordine/${o.id}`)
            }}
            azioni={orderActions}
            aperta={corsiaAperta}
            onApriAzioni={setCorsiaAperta}
            espansa={corsiaEspansa}
            onEspandi={setCorsiaEspansa}
            // «Incassa» apre il pagamento del conto, quello vero: sconto,
            // conto diviso, contanti, carta e lettore stanno lì. Rifarne una
            // versione ridotta qui vorrebbe dire due casse che si comportano
            // in modo diverso.
            onIncassa={(o) => navigate(`/ordine/${o.id}?pagamento=1`)}
          />
          )}
        </>
      ) : listView ? (
        <>
          {/* Lista unica: stato indicato dal colore/etichetta della card */}
          <h3 className="cat-header">In corso ({inCorso.length})</h3>
          {inCorso.length === 0 && <div className="empty">Nessun ordine in corso.</div>}
          {groupByDay(inCorso).map(({ day, orders: gOrders }) => (
            <div key={day}>
              {day !== oggiKey && (
                <div className="day-sep">
                  ⏳ Da chiudere · {businessDayLabel(day, new Date(), cutoffHour)}
                </div>
              )}
              {gOrders.map(renderCard)}
            </div>
          ))}

          <h3 className="cat-header">Serviti/Ritirati ({evasi.length})</h3>
          {evasi.length === 0 && <div className="empty">Ancora nessun ordine servito o ritirato.</div>}
          {evasi.map(renderCard)}
        </>
      ) : (
        schedeSemplici ? (
        <>
          {/* STATI DI SERVIZIO SPENTI: i cinque passi del lavoro non
              esistono, e mostrarli lasciava quattro linguette vuote con
              tutti i conti sotto «Ordine ricevuto». Restano le tre cose che
              un conto può essere — in corso, chiuso, annullato — con le
              stesse regole della griglia (ordiniInCoda), così le due viste
              raccontano la stessa storia. Ricerca e «Miei» valgono qui
              come dappertutto: filtrano dentro la scheda in cui si sta. */}
          <div className="tabs" style={{ marginTop: 8 }}>
            {schedeSemplici.map(([k, label]) => (
              <div
                key={k}
                className={`tab ${tabSemplice === k ? 'active' : ''}`}
                onClick={() => setTabSemplice(k)}
              >
                {label} ({perScheda[k].length})
              </div>
            ))}
          </div>

          {perScheda[tabSemplice].length === 0 && (
            <div className="empty">
              {tabSemplice === 'attivi'
                ? 'Nessun conto in corso.'
                : tabSemplice === 'chiusi'
                  ? 'Nessun conto chiuso in questa cassa.'
                  : 'Nessun conto annullato in questa cassa.'}
            </div>
          )}
          {perScheda[tabSemplice].map(renderCard)}
        </>
        ) : (
        <>
          {/* Sotto-tab per stato */}
          <div className="tabs" style={{ marginTop: 8 }}>
            {STATUS_TABS.map((s) => (
              <div
                key={s}
                className={`tab ${statusTab === s ? 'active' : ''}`}
                onClick={() => setStatusTab(s)}
              >
                {STATUS_EMOJI[s]} {STATUS_LABELS[s]} ({(buckets[s] || []).length})
              </div>
            ))}
          </div>

          {list.length === 0 && <div className="empty">Nessun ordine in questo stato.</div>}
          {list.map(renderCard)}
        </>
        )
      )}

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          danger={confirmAction.danger}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const { run } = confirmAction
            setConfirmAction(null)
            run()
          }}
        />
      )}

      {cancelTarget && (
        <CancelOrderDialog
          order={cancelTarget.order}
          kind={cancelTarget.kind}
          // La frase che si applica DAVVERO: se il locale è a solo servizio,
          // quella del bancone non si propone nemmeno qui — manderebbe il
          // cliente dove nessuno lo aspetta.
          defaultPhrase={fraseAnnulloDefault(settings)}
          ritiroPossibile={fraseAnnulloPossibile('bancone', settings)}
          onCancel={() => setCancelTarget(null)}
          onConfirm={confirmCancel}
        />
      )}

      {storiaTarget && (
        <StoriaOrdineDialog order={storiaTarget} onClose={() => setStoriaTarget(null)} />
      )}

      {ripristinoTarget && (
        <RipristinaOrdineDialog
          order={ripristinoTarget}
          onClose={() => setRipristinoTarget(null)}
          onConferma={(motivo) => {
            const o = ripristinoTarget
            setRipristinoTarget(null)
            // Il conto era stato nascosto dalla coda quando l'avevamo
            // chiuso qui: riaprendolo deve tornare a vedersi subito, senza
            // aspettare il giro del server.
            mostraOrdine(o.id)
            // Un conto riaperto è un conto da richiudere, e alla chiusura lo
            // scontrino deve poter uscire di nuovo (BUG-047).
            releaseReceiptPrint(o.id)
            restoreOrder(o.id, { motivo, chi: chiSonoIo() }).catch((e) =>
              setError(`Conto non ripristinato: ${e.message}`)
            )
          }}
        />
      )}
    </div>
  )
}

function SerataReport({ report, onClose }) {
  const { finance, products, longest_prep, phase_averages, drinks_sold } = report
  const fmtMin = (m) => (m == null ? '—' : `${Math.round(m * 10) / 10} min`)
  const top = products.slice(0, 3)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="summary-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="summary-head">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
          <h2>Resoconto serata</h2>
          <p className="muted" style={{ margin: 0 }}>
            {finance.ordini} ordini · {drinks_sold} drink venduti
          </p>
        </div>

        <h3 className="cat-header">Incassi</h3>
        <div className="summary-rows" style={{ margin: '4px 0 16px' }}>
          <div className="summary-row">
            <span className="muted">Drink</span>
            <span>{formatPrice(finance.drink)}</span>
          </div>
          {finance.coperto > 0 && (
            <div className="summary-row">
              <span className="muted">Coperto</span>
              <span>{formatPrice(finance.coperto)}</span>
            </div>
          )}
          {finance.servizio > 0 && (
            <div className="summary-row">
              <span className="muted">Servizio</span>
              <span>{formatPrice(finance.servizio)}</span>
            </div>
          )}
          {finance.mance > 0 && (
            <div className="summary-row">
              <span className="muted">Mance</span>
              <span>{formatPrice(finance.mance)}</span>
            </div>
          )}
          <div className="summary-row summary-total">
            <span>INCASSO</span>
            <span>{formatPrice(finance.incasso)}</span>
          </div>
        </div>

        {products.length > 0 && (
          <>
            <h3 className="cat-header">Prodotti venduti</h3>
            <div className="summary-rows" style={{ margin: '4px 0 16px' }}>
              {products.map((p) => (
                <div className="summary-row" key={p.name}>
                  <span>
                    {p.qty} × {p.name}
                  </span>
                  <span>{formatPrice(p.revenue)}</span>
                </div>
              ))}
              <div className="summary-row summary-total">
                <span>TOTALE DRINK</span>
                <span>{formatPrice(products.reduce((s, p) => s + p.revenue, 0))}</span>
              </div>
            </div>
          </>
        )}

        <h3 className="cat-header">Statistiche</h3>
        <div className="summary-rows" style={{ margin: '4px 0 16px' }}>
          {top.length > 0 && (
            <div className="summary-row">
              <span className="muted">Più venduti</span>
              <span style={{ textAlign: 'right' }}>
                {top.map((p) => `${p.name} (${p.qty})`).join(' · ')}
              </span>
            </div>
          )}
          {longest_prep && (
            <div className="summary-row">
              <span className="muted">Preparazione più lunga</span>
              <span>
                #{longest_prep.daily_number} · {fmtMin(longest_prep.minutes)}
              </span>
            </div>
          )}
          <div className="summary-row">
            <span className="muted">Attesa media</span>
            <span>{fmtMin(phase_averages?.attesa)}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Preparazione media</span>
            <span>{fmtMin(phase_averages?.preparazione)}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Servizio al tavolo medio</span>
            <span>{fmtMin(phase_averages?.servizio)}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Ciclo completo medio</span>
            <span>{fmtMin(phase_averages?.cicloCompleto)}</span>
          </div>
        </div>

        <button className="btn block" onClick={onClose}>
          Chiudi resoconto
        </button>
      </div>
    </div>
  )
}
