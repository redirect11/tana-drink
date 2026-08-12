import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { useCart, rememberOrderId, getMyOrderIds } from '../lib/cart.js'
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_EMOJI,
  formatPrice,
  placedByName,
} from '../lib/orderStatus.js'
import { formatQty } from '../lib/inventory.js'
import { etaForMode } from '../lib/eta.js'
import { checkGeofence, geofenceConfigured } from '../lib/geo.js'
import { ensureNotificationPermission } from '../lib/notify.js'
import { getPushToken } from '../lib/push.js'
import { isFirebaseConfigured, auth } from '../lib/firebaseClient.js'
import { useCustomer } from '../lib/customerAuth.js'
import { onAuthStateChanged } from 'firebase/auth'
import { useMenu } from '../lib/menuCache.js'
import { isGestore, isPersonale } from '../lib/ruoli.js'
import OrderSummary from '../components/OrderSummary.jsx'
import StaffDrawer from '../components/StaffDrawer.jsx'
import CustomDrinkForm from '../components/CustomDrinkForm.jsx'

const NOTIF_PROMPT_KEY = 'tana_notif_prompt_v1' // chiave storica
const WELCOME_KEY = 'tana_welcome_v1'

export default function MenuPage() {
  // Menù dalla cache di modulo: una sola sottoscrizione viva, niente
  // re-fetch a ogni navigazione (solo un refresh forzato ricarica).
  const { drinks, cats, loading } = useMenu()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showCustomDrink, setShowCustomDrink] = useState(false)
  const [myOrders, setMyOrders] = useState([])
  const [readyOrders, setReadyOrders] = useState([])
  // Staff loggato (bartender/cameriera): gli ordini fatti da qui vengono
  // marcati come manuali con chi li ha inseriti.
  const [staffVero, setStaffVero] = useState(null) // { email, name, role } | null
  // Account cliente (null per anonimi e staff): ordini legati al profilo.
  const { user: customer, profile: customerProfile } = useCustomer()

  useEffect(() => {
    if (!isFirebaseConfigured) return
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return setStaffVero(null)
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
    return subscribeSettings((s) => setSettings(s))
  }, [])

  // Gruppi disponibili per l'associazione (solo staff, con gruppi attivi):
  // gruppi aperti + gruppi-cliente recenti.
  const [openGroups, setOpenGroups] = useState([])
  const [recentGroups, setRecentGroups] = useState([])
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
  const categories = useMemo(() => {
    const byId = new Map(cats.map((c) => [c.id, c]))
    const groups = new Map() // key -> { name, sort, list }
    for (const d of drinks) {
      const cat = byId.get(d.category_id)
      const name = cat?.name || d.category || 'Altro'
      const sort = cat ? cat.sort_order : 9999
      if (!groups.has(name)) groups.set(name, { name, sort, list: [] })
      groups.get(name).list.push(d)
    }
    return [...groups.values()]
      .sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name))
      .map((g) => [g.name, g.list])
  }, [drinks, cats])

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
        placed_by: staff, // null per i clienti
        customer_uid: customer?.uid ?? null,
        // Pagamento online: il checkout avviene sulla pagina ordine.
        payment_method: pay_online ? 'online' : null,
        payment_status: pay_online ? 'in_attesa' : 'non_richiesto',
        payment_required: !!payment_required,
        ...extraCharges,
      })
      rememberOrderId(order.id)
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

  const menuOnly = settings.menu_only
  // Il servizio è PERPETUO: non esiste più una serata da aprire. A decidere
  // se si può ordinare resta la modalità "solo menù" (l'interruttore del
  // servizio): a servizio chiuso spariscono i pulsanti "Aggiungi" e il
  // carrello. Lo staff loggato può inserire ordini manuali comunque.
  // Con geofence attivo si ordina solo a posizione verificata.
  const geoOk = !geoActive || geoGate === 'ok'
  const canOrder = (!menuOnly || !!staff) && geoOk

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

  return (
    <div className={staff ? 'bar-content' : ''}>
      {staff && <StaffDrawer role={staff.role} active="ordine" />}
      {/* In anteprima si vede il menù del cliente, ma si è pur sempre al
          lavoro: una riga per ricordarlo e per tornare indietro. */}
      {anteprimaCliente && staffVero && (
        <div className="anteprima-cliente">
          <span>👀 Stai guardando il menù come lo vede il cliente.</span>
          <Link className="btn ghost small" to="/bar">
            ← Torna al gestionale
          </Link>
        </div>
      )}
      {/* Hero d'intestazione solo per i clienti: allo staff serve spazio. */}
      {!staff && (
        <div className="hero">
          <img
            className="hero-img"
            src="/cocktail-hero.jpg"
            alt="La Tana del Coniglio"
            onError={(e) => (e.target.style.display = 'none')}
          />
          <div className="hero-overlay">
            <img
              className="hero-logo"
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt=""
            />
            <h1 className="hero-title">La Tana del Coniglio</h1>
            <p className="hero-sub">
              {tableLabel
                ? `Tavolo ${tableLabel}`
                : menuOnly
                  ? 'Cocktail Bar · Menù'
                  : 'Scegli i tuoi drink e invia l’ordine al bancone.'}
            </p>
          </div>
        </div>
      )}

      {staff && !menuOnly && (
        <p className="muted" style={{ margin: '4px 4px 10px' }}>
          ✍️ Inserimento ordine da <strong>{placedByName(staff)}</strong>
        </p>
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

      {myOrders.map((o) => (
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

      {categories.length > 1 && (
        <nav className="cat-nav">
          {categories.map(([cat]) => (
            <a key={cat} href={`#cat-${encodeURIComponent(cat)}`} className="cat-chip">
              {cat}
            </a>
          ))}
        </nav>
      )}

      {categories.map(([cat, list]) => (
        <section key={cat}>
          <h3 className="cat-header" id={`cat-${encodeURIComponent(cat)}`}>{cat}</h3>
          {list.map((d) => {
            const inCart = cart.items.find((i) => i.drink_id === d.id)
            return (
              <div className="card menu-item" key={d.id}>
                <div className="row between">
                  <img
                    className={`drink-thumb${d.image_url ? '' : ' placeholder'}`}
                    src={d.image_url || `${import.meta.env.BASE_URL}logo.png`}
                    alt={d.name}
                    loading="lazy"
                  />
                  <div className="grow">
                    <h3>{d.name}</h3>
                    {d.description && (
                      <p className="muted" style={{ margin: '0 0 6px' }}>
                        {d.description}
                      </p>
                    )}
                    {/* Con un solo ingrediente la lista è ridondante (es. shot). */}
                    {d.recipe_items && d.recipe_items.length > 1 && (
                      <p className="ingredients">
                        {d.recipe_items
                          .map((r) =>
                            settings.show_ingredient_quantities
                              ? `${r.name} ${formatQty(r.qty, r.unit)}`
                              : r.name
                          )
                          .join(' · ')}
                      </p>
                    )}
                    <span className="price">{formatPrice(d.price)}</span>
                  </div>
                  {canOrder && (
                    inCart ? (
                      <div className="qty">
                        <button
                          aria-label="Riduci"
                          onClick={() => cart.setQty(d.id, inCart.qty - 1)}
                        >
                          −
                        </button>
                        <strong>{inCart.qty}</strong>
                        <button
                          aria-label="Aumenta"
                          onClick={() => cart.setQty(d.id, inCart.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button className="btn small" onClick={() => cart.add(d)}>
                        Aggiungi
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </section>
      ))}

      {canOrder && cart.count > 0 && (
        <div className="cartbar">
          <div className="inner">
            <div className="cartbar-items">
              {cart.items.map((i) => (
                <div className="row between" key={i.drink_id}>
                  <span>
                    <strong>{i.qty}×</strong> {i.name}
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
              Benvenuto alla Tana del Coniglio
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
