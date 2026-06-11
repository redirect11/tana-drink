// Verifica di prossimità al locale (geofence) per l'ordinazione.
// Logica pura + wrapper sulla Geolocation API.

// Distanza in metri tra due coordinate (formula dell'emisenoverso).
export function haversineMeters(a, b) {
  const R = 6371000
  const rad = (deg) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Il geofence è configurato e attivo?
export function geofenceConfigured(settings) {
  return (
    settings?.geofence_enabled === true &&
    settings.venue_lat != null &&
    settings.venue_lng != null &&
    Number.isFinite(Number(settings.venue_lat)) &&
    Number.isFinite(Number(settings.venue_lng))
  )
}

// Esito puro del confronto posizione/locale.
export function evaluatePosition(settings, coords) {
  const venue = { lat: Number(settings.venue_lat), lng: Number(settings.venue_lng) }
  const raw = Number(settings.venue_radius_m)
  const radius = Number.isFinite(raw) && raw > 0 ? Math.max(10, raw) : 150
  const distance = haversineMeters(venue, { lat: coords.latitude, lng: coords.longitude })
  return { ok: distance <= radius, distance: Math.round(distance), radius }
}

// Chiede la posizione e verifica la prossimità al locale.
// Risolve: { status: 'ok' | 'out_of_range' | 'denied' | 'unsupported', distance?, radius? }
export function checkGeofence(settings) {
  if (!geofenceConfigured(settings)) return Promise.resolve({ status: 'ok' })
  if (!('geolocation' in navigator)) return Promise.resolve({ status: 'unsupported' })
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const r = evaluatePosition(settings, pos.coords)
        resolve(r.ok ? { status: 'ok', ...r } : { status: 'out_of_range', ...r })
      },
      () => resolve({ status: 'denied' }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    )
  })
}
