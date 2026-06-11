'use strict'

// Unit test geofence (src/lib/geo.js).

import { describe, it, expect } from 'vitest'
import { haversineMeters, geofenceConfigured, evaluatePosition } from '../../src/lib/geo.js'

// Duomo di Nola ↔ punto a ~100m
const VENUE = { lat: 40.926, lng: 14.527 }

describe('haversineMeters', () => {
  it('distanza nulla per lo stesso punto', () => {
    expect(haversineMeters(VENUE, VENUE)).toBe(0)
  })

  it('ordine di grandezza corretto (~111km per 1° di latitudine)', () => {
    const d = haversineMeters({ lat: 40, lng: 14 }, { lat: 41, lng: 14 })
    expect(d).toBeGreaterThan(110000)
    expect(d).toBeLessThan(112000)
  })
})

describe('geofenceConfigured', () => {
  it('attivo solo con flag e coordinate valide', () => {
    expect(geofenceConfigured({ geofence_enabled: true, venue_lat: 40.9, venue_lng: 14.5 })).toBe(true)
    expect(geofenceConfigured({ geofence_enabled: false, venue_lat: 40.9, venue_lng: 14.5 })).toBe(false)
    expect(geofenceConfigured({ geofence_enabled: true, venue_lat: null, venue_lng: 14.5 })).toBe(false)
    expect(geofenceConfigured(undefined)).toBe(false)
  })
})

describe('evaluatePosition', () => {
  const settings = { venue_lat: VENUE.lat, venue_lng: VENUE.lng, venue_radius_m: 150 }

  it('dentro il raggio', () => {
    const r = evaluatePosition(settings, { latitude: VENUE.lat + 0.0005, longitude: VENUE.lng })
    expect(r.ok).toBe(true)
    expect(r.distance).toBeLessThan(150)
  })

  it('fuori dal raggio, con distanza', () => {
    const r = evaluatePosition(settings, { latitude: VENUE.lat + 0.01, longitude: VENUE.lng })
    expect(r.ok).toBe(false)
    expect(r.distance).toBeGreaterThan(1000)
    expect(r.radius).toBe(150)
  })

  it('raggio minimo 10m e default 150m', () => {
    expect(evaluatePosition({ ...settings, venue_radius_m: 5 }, { latitude: VENUE.lat, longitude: VENUE.lng }).radius).toBe(10)
    expect(evaluatePosition({ ...settings, venue_radius_m: null }, { latitude: VENUE.lat, longitude: VENUE.lng }).radius).toBe(150)
  })
})
