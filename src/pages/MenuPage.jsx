import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchDrinks,
  fetchCategories,
  subscribeOpenSerata,
  subscribeSettings,
  subscribeOrder,
  subscribeReadyOrders,
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
import OrderSummary from '../components/OrderSummary.jsx'
import StaffDrawer from '../components/StaffDrawer.jsx'

const NOTIF_PROMPT_KEY = 'tana_notif_prompt_v1' // chiave storica
const WELCOME_KEY = 'tana_welcome_v1'

export default function MenuPage() {
  const [drinks, setDrinks] = useState([])
  const [cats, setCats] = useState([])
  const [serata, setSerata] = useState(undefined) // undefined=caricamento, null=chiuso
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [myOrders, setMyOrders] = useState([])
  const [readyOrders, setReadyOrders] = useState([])
  // Staff loggato (bartender/cameriera): gli ordini fatti da qui vengono
  // marcati come manuali con chi li ha inseriti.
  const [staff, setStaff] = useState(null) // { email, name, role } | null
  // Account cliente (null per anonimi e staff): ordini legati al profilo.
  const { user: customer, profile: customerProfile } = useCustomer()

  useEffect(() => {
    if (!isFirebaseConfigured) return
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return setStaff(null)
      try {
        const token = await u.getIdTokenResult()
        const role = token.claims.role
        // Solo bartender/staff: i clienti registrati ordinano come clienti.
        setStaff(
          role === 'bartender' || role === 'staff'
            ? { email: u.email, name: u.displayName || null, role }
            : null
        )
      } catch {
        setStaff(null)
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
  const cart = useCart()

  // Il QR può contenere ?tavolo=12 per identificare il tavolo.
  const tableLabel = params.get('tavolo') || params.get('table') || ''

  useEffect(() => {
    let active = true
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    Promise.all([
      fetchDrinks({ onlyAvailable: true }),
      fetchCategories().catch(() => []),
    ])
      .then(([d, c]) => {
        if (!active) return
        setDrinks(d)
        setCats(c)
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  // Osserva la serata aperta: senza serata gli ordini sono bloccati.
  useEffect(() => {
    if (!isFirebaseConfigured) return
    const unsub = subscribeOpenSerata(
      (s) => setSerata(s),
      () => setSerata(null)
    )
    return unsub
  }, [])

  // Impostazioni del bar (modalità solo menù, coperto, servizio, mancia…).
  useEffect(() => {
    if (!isFirebaseConfigured) return
    return subscribeSettings((s) => setSettings(s))
  }, [])

  // Ordini attivi di questo dispositivo (serata corrente): mostrati come box
  // cliccabili in cima al menù, aggiornati in tempo reale.
  const serataId = serata?.id

  // Tabellone "stiamo servendo / pronti al ritiro" (se attivo in impostazioni).
  const servingBoard = settings.show_serving_board && !settings.menu_only
  useEffect(() => {
    if (!isFirebaseConfigured || !serataId || !servingBoard) {
      setReadyOrders([])
      return
    }
    return subscribeReadyOrders(serataId, setReadyOrders)
  }, [serataId, servingBoard])
  useEffect(() => {
    if (!isFirebaseConfigured || !serataId) {
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
            const isActive =
              o && o.serata_id === serataId && ACTIVE.includes(o.status)
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
  }, [serataId])

  // Ricerca rapida (solo staff: utile sul catalogo grande per gli ordini manuali).
  const [search, setSearch] = useState('')

  const categories = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? drinks.filter(
          (d) =>
            d.name?.toLowerCase().includes(q) ||
            d.category?.toLowerCase().includes(q) ||
            d.description?.toLowerCase().includes(q) ||
            d.recipe_items?.some((r) => r.name?.toLowerCase().includes(q))
        )
      : drinks
    const byId = new Map(cats.map((c) => [c.id, c]))
    const groups = new Map() // key -> { name, sort, list }
    for (const d of filtered) {
      const cat = byId.get(d.category_id)
      const name = cat?.name || d.category || 'Altro'
      const sort = cat ? cat.sort_order : 9999
      if (!groups.has(name)) groups.set(name, { name, sort, list: [] })
      groups.get(name).list.push(d)
    }
    return [...groups.values()]
      .sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name))
      .map((g) => [g.name, g.list])
  }, [drinks, cats, search])

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
    if (!serata) {
      setError('Il servizio è chiuso: nessuna serata aperta.')
      return
    }
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

  async function handleConfirmOrder(extraCharges) {
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
        serata_id: serata.id,
        push_token,
        placed_by: staff, // null per i clienti
        customer_uid: customer?.uid ?? null,
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

  const closed = serata === null
  const menuOnly = settings.menu_only
  // Si può ordinare solo con serata aperta e modalità ordinazione attiva:
  // a serata chiusa spariscono anche i pulsanti "Aggiungi" e il carrello.
  // Lo staff loggato può inserire ordini manuali anche in modalità solo menu.
  // Con geofence attivo si ordina solo a posizione verificata.
  const geoOk = !geoActive || geoGate === 'ok'
  const canOrder = (!menuOnly || !!staff) && !closed && geoOk

  // Tempo stimato mostrato nel menù: per la modalità "entrambi" usa la stima
  // fino al "pronto" (parte comune); il riepilogo ordine poi la adatta alla
  // scelta del cliente.
  const etaMinutes =
    settings.eta_enabled && serata
      ? etaForMode(settings.service_mode === 'tavolo' ? 'tavolo' : 'banco', {
          etaStats: serata.eta_stats,
          prepStats: serata.prep_stats,
          baseMinutes: settings.eta_base_minutes,
        })
      : null

  return (
    <div className={staff ? 'bar-content menu-staff' : ''}>
      {staff && <StaffDrawer role={staff.role} active="ordine" />}
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

      {menuOnly && (
        <div className="banner">
          📖 Solo consultazione: l’ordinazione dal tavolo non è attiva, ordina al bancone.
        </div>
      )}

      {etaMinutes != null && !menuOnly && !closed && (
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

      {closed && !menuOnly && (
        <div className="banner">
          🔒 Servizio chiuso: gli ordini non sono disponibili al momento.
        </div>
      )}

      {/* Gate geolocalizzazione: stato della verifica al caricamento */}
      {geoActive && !closed && geoGate === 'checking' && (
        <div className="banner">📍 Verifico che sei al locale…</div>
      )}
      {geoActive && !closed && geoGate === 'denied' && (
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
      {geoActive && !closed && geoGate === 'out_of_range' && (
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
            <span className={`pill ${o.status}`} style={{ marginTop: 6 }}>
              {STATUS_EMOJI[o.status]} {STATUS_LABELS[o.status]}
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

      {staff && (
        <div className="menu-search-wrap">
          <input
            type="search"
            className="menu-search"
            placeholder="🔍 Cerca drink, categoria, ingrediente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {staff && search && categories.length === 0 && (
        <div className="empty">Nessun risultato per «{search}».</div>
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
              disabled={sending || closed || checkingGeo}
              onClick={handleReviewOrder}
            >
              {closed ? 'Chiuso' : checkingGeo ? '📍 Verifico…' : 'Rivedi ordine'}
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
          serata={serata}
          tableLabel={tableLabel}
          staff={staff}
          customerProfile={customerProfile}
          sending={sending}
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
