// ── L'ABBONAMENTO CON STRIPE, LOGICA PURA (REQ-FLOTTA-007) ─────────────
//
// Dalla scelta del titolare (piano, moduli, terminali) alle righe della
// sessione di Checkout; dagli eventi del webhook al documento del cliente.
// Niente Stripe qui: index.js chiama l'SDK, questo decide, e si prova
// senza chiavi.

const listino = require('../../piani.json')

const SCELTA_VALIDA = /^(base|completo)$/

// La scelta pulita: piano noto, moduli noti e non già inclusi, terminali
// da 1 in su.
function sceltaPulita({ piano = 'base', moduli = [], terminali = 1 } = {}) {
  const p = SCELTA_VALIDA.test(piano) ? listino.piani[piano] : listino.piani.base
  const inclusi = new Set(p.include)
  const extra = [...new Set((moduli || []).filter((id) => listino.moduli.some((m) => m.id === id) && !inclusi.has(id)))]
  const t = Math.max(1, Math.floor(Number(terminali) || 1))
  return { piano: p.id, moduli: extra, terminali: t }
}

// Le righe della sessione di Checkout (modalità abbonamento, mensile):
// il piano, ogni modulo in più, i terminali oltre quelli inclusi. Importi
// in centesimi, come li vuole Stripe. L'attivazione una tantum sta a
// parte, come prima riga non ricorrente.
function righeCheckout(scelta) {
  const s = sceltaPulita(scelta)
  const p = listino.piani[s.piano]
  const riga = (nome, euro, ricorrente = true) => ({
    quantity: 1,
    price_data: {
      currency: 'eur',
      unit_amount: Math.round(euro * 100),
      product_data: { name: nome },
      ...(ricorrente ? { recurring: { interval: 'month' } } : {}),
    },
  })
  const righe = [riga(`Piano ${p.nome}`, p.prezzo)]
  for (const id of s.moduli) {
    const m = listino.moduli.find((x) => x.id === id)
    righe.push(riga(m.nome, m.prezzo))
  }
  const extraTerminali = Math.max(0, s.terminali - (p.terminali || 1))
  if (extraTerminali > 0) righe.push({ ...riga('Terminale in più', listino.terminale_in_piu), quantity: extraTerminali })
  return righe
}

// I metadati che viaggiano con la sessione e tornano col webhook: è così
// che il webhook sa a chi appartiene il pagamento.
function metadatiDi(uid, scelta) {
  const s = sceltaPulita(scelta)
  return { uid, piano: s.piano, moduli: s.moduli.join(','), terminali: String(s.terminali) }
}

// L'aggiornamento di clienti/{uid} per un evento di Stripe, o null se
// l'evento non ci riguarda. Lo stato segue l'abbonamento, non il singolo
// pagamento: il POS non dipende mai da Stripe per funzionare, cambia solo
// cosa dice la dashboard.
function aggiornamentoDaEvento(tipo, oggetto, adesso = new Date()) {
  const ora = adesso.toISOString()
  const md = oggetto?.metadata || {}
  if (tipo === 'checkout.session.completed') {
    if (!md.uid) return null
    return {
      uid: md.uid,
      patch: {
        piano: md.piano || 'base',
        moduli: md.moduli ? md.moduli.split(',').filter(Boolean) : [],
        terminali: Number(md.terminali) || 1,
        abbonamento: {
          stato: 'attivo',
          origine: 'stripe',
          stripe_customer: oggetto.customer || null,
          stripe_subscription: oggetto.subscription || null,
          dal: ora,
        },
      },
    }
  }
  if (tipo === 'invoice.paid') {
    const sub = oggetto?.subscription
    if (!sub) return null
    return { stripe_subscription: sub, patch: { 'abbonamento.stato': 'attivo', 'abbonamento.ultimo_pagamento': ora } }
  }
  if (tipo === 'invoice.payment_failed') {
    const sub = oggetto?.subscription
    if (!sub) return null
    return { stripe_subscription: sub, patch: { 'abbonamento.stato': 'in sospeso', 'abbonamento.aggiornato_il': ora } }
  }
  if (tipo === 'customer.subscription.deleted') {
    if (!oggetto?.id) return null
    return { stripe_subscription: oggetto.id, patch: { 'abbonamento.stato': 'disdetto', 'abbonamento.aggiornato_il': ora } }
  }
  return null
}

module.exports = { sceltaPulita, righeCheckout, metadatiDi, aggiornamentoDaEvento }
