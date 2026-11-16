'use strict'

// ── DUE TERMINALI, LO STESSO NUMERO: CHI VINCE ───────────────────────
//
// Il numero del conto si assegna sul dispositivo, senza chiedere niente a
// nessuno: è l'unico modo perché battere un conto sia immediato e funzioni
// anche offline (vedi src/lib/progressivi.js). Il prezzo è che due
// terminali che battono nello stesso istante — il telefono della sala e il
// tablet del banco — possono prendersi lo stesso #15.
//
// La disputa la risolve il server, che è l'unico posto dove esiste un
// «prima» e un «dopo» veri: VINCE CHI È ARRIVATO PRIMA, e chi arriva dopo
// si prende il primo numero libero. Automatico, senza chiedere niente a chi
// sta lavorando: al banco non si può fermare una serata per un numero.
//
// A parità di istante (succede: due scritture nello stesso millisecondo)
// decide l'id del documento, che è un ordine arbitrario ma UGUALE per
// tutti — l'importante è che i due terminali non arrivino a due conclusioni
// diverse.
//
// Il numero cambia solo a chi ha perso, e resta scritto da dove veniva: la
// comanda può essere già uscita dalla stampante col numero vecchio, e chi
// la tiene in mano deve poterlo ritrovare.

// Chi tiene il numero, fra i conti che se lo contendono.
// `conti`: [{ id, created_at (ms o ISO), daily_number }]
function primoArrivato(conti) {
  return [...conti].sort((a, b) => {
    const ta = istante(a)
    const tb = istante(b)
    if (ta !== tb) return ta - tb
    return String(a.id).localeCompare(String(b.id))
  })[0]
}

function istante(c) {
  const v = c?.created_at
  if (v == null) return Number.MAX_SAFE_INTEGER // senza orario, ultimo
  if (typeof v === 'number') return v
  if (typeof v?.toMillis === 'function') return v.toMillis()
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t
}

// LA DECISIONE, per il conto appena arrivato.
//
//   conto:     { id, created_at, daily_number }
//   fratelli:  gli altri conti della STESSA cassa (o giornata), quelli già
//              scritti — compreso il conto stesso, che venga incluso o no
//              non cambia il risultato.
//
// Ritorna `null` se il conto tiene il suo numero (nessuno glielo contende,
// o è lui il primo arrivato), altrimenti il numero nuovo.
function numeroDaRiassegnare(conto, fratelli) {
  const numero = Number(conto?.daily_number)
  if (!(numero > 0)) return null
  const altri = (fratelli || []).filter((c) => c && c.id !== conto.id)
  const contesi = altri.filter((c) => Number(c.daily_number) === numero)
  if (contesi.length === 0) return null
  // C'è chi ha lo stesso numero: chi è arrivato prima se lo tiene.
  if (primoArrivato([conto, ...contesi]).id === conto.id) return null
  // Il primo numero libero DOPO il più alto già usato: prendere un buco in
  // mezzo vorrebbe dire rubarlo a un conto ancora per strada, e la disputa
  // ricomincerebbe da capo.
  const massimo = [conto, ...altri].reduce(
    (m, c) => Math.max(m, Number(c.daily_number) || 0),
    0
  )
  return massimo + 1
}

// QUANTO SI LEGGE PER DECIDERE (BUG-161). La decisione qui sopra vuole i
// fratelli, e fino al 16/11/2026 i fratelli erano TUTTI i conti della
// cassa, riletti a ogni conto nuovo: la spesa cresceva col quadrato dei
// conti, circa 20.000 letture in una sera da 200. Il conto quasi sempre non
// è conteso, e per saperlo bastano i conti con lo STESSO numero — di solito
// uno, lui. Tutta la cassa serve solo a chi ha perso, per dargli il primo
// libero dopo il più alto.
//
//   stessoNumero():  i conti della cassa con lo stesso numero
//   tuttaLaCassa():  tutti i conti della cassa, come prima
//
// Se la domanda stretta fallisce (un indice che manca o non è ancora
// costruito dopo un deploy), si legge tutta la cassa come prima: un numero
// doppio non risolto costa più di qualche lettura.
async function numeroDaRiassegnareInCassa(conto, { stessoNumero, tuttaLaCassa }) {
  let contesi = null
  try {
    contesi = await stessoNumero()
  } catch (e) {
    // A VOCE ALTA: se la domanda stretta fallisse sempre, ogni conto
    // rileggerebbe tutta la cassa in silenzio e BUG-161 tornerebbe senza
    // che nessuno se ne accorga.
    console.warn('[numerazione] domanda per numero fallita, si legge tutta la cassa:', e?.message || e)
  }
  // Nessuno lo contende, o il primo è lui: non serve leggere altro.
  if (contesi && numeroDaRiassegnare(conto, contesi) == null) return null
  return numeroDaRiassegnare(conto, await tuttaLaCassa())
}

module.exports = { numeroDaRiassegnare, numeroDaRiassegnareInCassa, primoArrivato }
