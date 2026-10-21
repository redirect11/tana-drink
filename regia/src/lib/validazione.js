// ── LA VALIDAZIONE DEI DATI DI REGISTRAZIONE (REQ-FLOTTA-003) ──────────
//
// Un cliente che paga lascia i dati di un'azienda: partita IVA, codice
// fiscale, PEC o codice destinatario per la fattura elettronica, sede,
// referente. Qui le regole, pure e provate, che il modulo usa passo per
// passo e che le regole Firestore ripetono in piccolo.

export const TIPI_LOCALE = ['cocktail bar', 'bar', 'pub', 'ristorante', 'pizzeria', 'enoteca', 'altro']
export const PROVINCE = /^[A-Z]{2}$/

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const validaEmail = (v) => EMAIL.test(String(v || '').trim())

// Almeno 10 caratteri, con lettere e cifre: la password di un account che
// comanda l'app di un locale.
export function problemaPassword(p) {
  const s = String(p || '')
  if (s.length < 10) return 'Almeno 10 caratteri.'
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) return 'Servono lettere e almeno una cifra.'
  return null
}

// Partita IVA italiana: 11 cifre con la cifra di controllo (algoritmo
// ufficiale, variante di Luhn).
export function validaPartitaIva(v) {
  const s = String(v || '').replace(/\s/g, '').replace(/^IT/i, '')
  if (!/^\d{11}$/.test(s)) return false
  let somma = 0
  for (let i = 0; i < 11; i += 1) {
    const c = Number(s[i])
    if (i % 2 === 0) somma += c
    else {
      const d = c * 2
      somma += d > 9 ? d - 9 : d
    }
  }
  return somma % 10 === 0
}

// Codice fiscale: 16 caratteri per le persone (con la lettera di
// controllo) o 11 cifre per le società (è la partita IVA).
export function validaCodiceFiscale(v) {
  const s = String(v || '').replace(/\s/g, '').toUpperCase()
  if (/^\d{11}$/.test(s)) return validaPartitaIva(s)
  if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(s)) return false
  const dispari = { 0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 }
  const pari = (c) => (/\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65)
  let somma = 0
  for (let i = 0; i < 15; i += 1) somma += i % 2 === 0 ? dispari[s[i]] : pari(s[i])
  return String.fromCharCode(65 + (somma % 26)) === s[15]
}

export const validaCap = (v) => /^\d{5}$/.test(String(v || '').trim())
export const validaSdi = (v) => /^[A-Z0-9]{7}$/.test(String(v || '').trim().toUpperCase())
export const validaTelefono = (v) => /^\+?[\d\s]{6,20}$/.test(String(v || '').trim())

const vuoto = (v) => !String(v || '').trim()

// I problemi di ogni passo: { campo: messaggio }. Vuoto = passo buono.
export function problemiAccount({ email, password, conferma }) {
  const p = {}
  if (!validaEmail(email)) p.email = 'Scrivi un’email valida.'
  const pw = problemaPassword(password)
  if (pw) p.password = pw
  if (password !== conferma) p.conferma = 'Le due password non coincidono.'
  return p
}

export function problemiLocale({ nome, tipo, via, cap, citta, provincia, telefono }) {
  const p = {}
  if (vuoto(nome)) p.nome = 'Serve il nome del locale.'
  if (!TIPI_LOCALE.includes(tipo)) p.tipo = 'Scegli il tipo di locale.'
  if (vuoto(via)) p.via = 'Serve l’indirizzo.'
  if (!validaCap(cap)) p.cap = 'CAP di cinque cifre.'
  if (vuoto(citta)) p.citta = 'Serve la città.'
  if (!PROVINCE.test(String(provincia || '').toUpperCase())) p.provincia = 'Sigla della provincia, due lettere.'
  if (!validaTelefono(telefono)) p.telefono = 'Serve un telefono del locale.'
  return p
}

export function problemiFatturazione({ ragione_sociale, partita_iva, codice_fiscale, pec, sdi, stessa_sede, via, cap, citta, provincia }) {
  const p = {}
  if (vuoto(ragione_sociale)) p.ragione_sociale = 'Serve la ragione sociale.'
  if (!validaPartitaIva(partita_iva)) p.partita_iva = 'Partita IVA non valida (11 cifre).'
  if (!vuoto(codice_fiscale) && !validaCodiceFiscale(codice_fiscale)) p.codice_fiscale = 'Codice fiscale non valido.'
  const pecOk = !vuoto(pec) && validaEmail(pec)
  const sdiOk = !vuoto(sdi) && validaSdi(sdi)
  if (!pecOk && !sdiOk) p.pec = 'Per la fattura elettronica serve la PEC o il codice destinatario (7 caratteri).'
  if (!vuoto(pec) && !validaEmail(pec)) p.pec = 'PEC non valida.'
  if (!vuoto(sdi) && !validaSdi(sdi)) p.sdi = 'Codice destinatario di 7 caratteri.'
  if (!stessa_sede) {
    if (vuoto(via)) p.via = 'Serve l’indirizzo della sede legale.'
    if (!validaCap(cap)) p.cap = 'CAP di cinque cifre.'
    if (vuoto(citta)) p.citta = 'Serve la città.'
    if (!PROVINCE.test(String(provincia || '').toUpperCase())) p.provincia = 'Sigla della provincia, due lettere.'
  }
  return p
}

export function problemiReferente({ nome, cognome, telefono, termini, privacy }) {
  const p = {}
  if (vuoto(nome)) p.nome = 'Serve il nome.'
  if (vuoto(cognome)) p.cognome = 'Serve il cognome.'
  if (!vuoto(telefono) && !validaTelefono(telefono)) p.telefono = 'Telefono non valido.'
  if (!termini) p.termini = 'Per usare il servizio vanno accettati i termini.'
  if (!privacy) p.privacy = 'Serve il consenso al trattamento dei dati.'
  return p
}
