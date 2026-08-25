// ── LE IMPOSTAZIONI DELL'ULTIMA VOLTA ────────────────────────────────
//
// Le impostazioni del locale arrivano da Firestore, e per un istante non ci
// sono: la schermata si disegna coi valori di partenza e poi si corregge.
// Di solito non si nota — ma quando l'impostazione decide un COLORE si
// vede: aprendo un conto le strisce comparivano colorate e sparivano un
// attimo dopo, in un locale che le aveva spente.
//
// Qui si tiene l'ultima risposta del server in memoria locale, e la si usa
// come punto di partenza al disegno successivo. È l'ultima verità nota:
// se nel frattempo qualcuno ha cambiato qualcosa, la correzione arriva
// comunque un istante dopo — ma senza il lampo.
//
// Non è una cache dei dati: sono preferenze, poche righe, e non si sta
// decidendo niente di importante su questa copia (gli ordini leggono
// sempre il documento vero).

// ── LEGGERE E SCRIVERE, SENZA RIPETERE IL TRY/CATCH ──────────────────
//
// `localStorage` sa dire di no: memoria piena, oppure negata dal browser in
// navigazione privata. La risposta è sempre la stessa — in lettura si
// riparte dal default, in scrittura la scelta vale solo per questa sessione
// — e scriverla preferenza per preferenza faceva cinque try/catch identici.
// Il PERCHÉ di ognuna (perché è del DISPOSITIVO e non del locale) resta
// scritto sopra la sua coppia: è quella la parte che vale.

// `interpreta` riceve il testo grezzo; se non c'è niente scritto, o se la
// memoria non risponde, torna `seNonSiSa` — quale sia lo decide la
// preferenza, non questo aiuto.
function leggi(chiave, interpreta, seNonSiSa) {
  try {
    const grezzo = localStorage.getItem(chiave)
    return grezzo == null ? seNonSiSa : interpreta(grezzo)
  } catch {
    /* roba illeggibile o memoria negata: decide il default */
    return seNonSiSa
  }
}

// `null` cancella la preferenza. Quello che non è testo si serializza qui
// dentro, dove un JSON impossibile finisce nello stesso catch.
function scrivi(chiave, valore) {
  try {
    if (valore == null) localStorage.removeItem(chiave)
    else localStorage.setItem(chiave, typeof valore === 'string' ? valore : JSON.stringify(valore))
  } catch {
    /* niente memoria: la scelta vale per questa sessione */
  }
}

// ── UNA PREFERENZA SÌ/NO DI QUESTO TERMINALE ─────────────────────────
//
// Le preferenze booleane qui sotto erano tre copie dello stesso paio di
// funzioni: leggi '1', scrivi '1' o cancella. Una copia è un caso, tre sono
// una tabella scritta a mano — e infatti una delle tre aveva già preso una
// strada sua senza che dal nome si vedesse.
//
// `scriviIlFalso` è l'unica differenza vera fra loro: di suo il falso
// CANCELLA la chiave (default e «non ho mai scelto» sono la stessa cosa, e
// una chiave in meno è memoria in meno). Dove invece il falso è una SCELTA
// — «unite» non è «non ho deciso» — si scrive lo '0', o il terminale che ha
// scelto il default sarebbe indistinguibile da quello nuovo.
//
// Il PERCHÉ di ogni preferenza (perché è del DISPOSITIVO e non del locale)
// resta scritto sopra la sua coppia: è quella la parte che vale.
function flagLocale(chiave, { seNonSiSa = false, scriviIlFalso = false } = {}) {
  return [
    () => leggi(chiave, (v) => v === '1', seNonSiSa),
    (acceso) => scrivi(chiave, acceso ? '1' : scriviIlFalso ? '0' : null),
  ]
}

const CHIAVE = 'tana:impostazioni'

export function ricordaImpostazioni(data) {
  if (!data || typeof data !== 'object') return
  scrivi(CHIAVE, data)
}

// I valori con cui disegnare la PRIMA volta: i default con sopra l'ultima
// risposta del server, se la si ricorda.
export function impostazioniRicordate(defaults = {}) {
  const salvate = leggi(CHIAVE, JSON.parse, null)
  if (salvate && typeof salvate === 'object') return { ...defaults, ...salvate }
  return { ...defaults }
}

// ── LE CORSIE SPENTE SU QUESTO TERMINALE ─────────────────────────────
//
// Quali colonne della coda a corsie chi sta a questo schermo non vuole
// vedere. È una preferenza del DISPOSITIVO, non del locale: il tablet del
// banco guarda «Da fare» e «Al banco», quello della cassa «Da incassare»,
// e sono due persone diverse davanti a due schermi diversi. Metterla sulle
// impostazioni del bar vorrebbe dire che accendendo una colonna al banco
// si spegne alla cassa.

const CHIAVE_CORSIE = 'tana:corsie:nascoste'

// Torna null quando su questo terminale non si è ancora scelto niente:
// quali colonne convenga tenere spente all'inizio è una decisione del
// dominio, e sta in coda.js con le corsie.
export function corsieNascoste() {
  const salvate = leggi(CHIAVE_CORSIE, JSON.parse, null)
  return Array.isArray(salvate) ? salvate.filter((x) => typeof x === 'string') : null
}

export function ricordaCorsieNascoste(ids) {
  scrivi(CHIAVE_CORSIE, [...new Set(ids || [])])
}

// ── COSA GUARDA QUESTO TERMINALE: I CONTI O LE COMANDE ───────────────
//
// Chi sta al banco vede sempre le comande — è il suo lavoro — ma chi
// guarda la serata vuole tutte e due le cose: «come sta andando» (i conti:
// in corso, chiusi, annullati) e «a che punto è la preparazione» (le
// comande, nei passi del servizio). Sono due domande diverse sullo stesso
// schermo, e quale delle due si sta facendo lo sa solo chi ci sta davanti:
// per questo la scelta è del dispositivo, come le altre qui sopra.
//
// Torna null quando non si è scelto niente: decide il ruolo.

const CHIAVE_VISTA = 'tana:corsie:vista'

export function vistaCorsie() {
  const v = leggi(CHIAVE_VISTA, (grezzo) => grezzo, null)
  return v === 'conti' || v === 'comande' ? v : null
}

export function ricordaVistaCorsie(vista) {
  scrivi(CHIAVE_VISTA, vista || null)
}

// ── I TASTI DEL CONTO: aperti o ridotti ──────────────────────────────
//
// Sopra la lista delle righe stanno «Unisci», «Dati conto» e «Prodotto
// libero»: comodi a chi batte conti complicati, tre righe di schermo
// rubate alla lista a chi fa solo drink. Chi li riduce li ritrova tutti
// nel ⋯ — non spariscono, si spostano — e «Comande» resta comunque a
// vista, che è la cosa che si apre di continuo.
//
// È una scelta del dispositivo, come le altre qui sopra: il tablet del
// banco e il telefono di chi gira in sala vogliono cose diverse.

export const [azioniContoRidotte, ricordaAzioniContoRidotte] = flagLocale(
  'tana:conto:azioni-ridotte'
)

// ── IL PRONTO, UNITO O DIVISO, SU QUESTO TERMINALE ───────────────────
//
// Dove ritiro e servizio convivono, la colonna del pronto tiene due lavori
// diversi: quello da portare a un tavolo e quello che aspetta il cliente
// al bancone. Chi è in sala guarda i primi, chi sta al banco i secondi —
// due persone, due schermi, due risposte. Per questo sta qui e non su
// settings/bar: dividerla al banco non deve dividerla anche in sala.
//
// Di suo UNITE: una colonna in più costa larghezza a tutte le altre, e
// dove il ritiro è l'eccezione resterebbe quasi sempre vuota.

// Qui lo '0' si scrive davvero (`scriviIlFalso`): «unite» è una scelta, non
// un'assenza di scelta, e cancellare la chiave la renderebbe indistinguibile
// dal terminale che non ha mai deciso.
export const [prontoDiviso, ricordaProntoDiviso] = flagLocale('tana:corsie:pronto-diviso', {
  scriviIlFalso: true,
})

// ── LA FILA DEI FILTRI: APERTA O CHIUSA, SU QUESTO TERMINALE ─────────
//
// «I filtri e tutti i bottoni li voglio a scomparsa, con un tasto che non
// occupi troppo spazio, sia per ordini sia per comande» (l'utente, 20/08).
// Sulla riga dei conteggi le pastiglie erano arrivate a sette, e anche
// compattate si mangiavano tutta la larghezza: adesso stanno dietro un
// tasto solo, «▾ Filtri».
//
// CHIUSA DI SUO: la coda si guarda, non si filtra — e chi filtra lo fa una
// volta a sera. Ma la scelta si ricorda, come le altre qui sopra: chi al
// banco tiene la fila aperta tutta la serata non deve riaprirla a ogni
// ricarico, e chi non la usa non se la ritrova.

export const [filtriAperti, ricordaFiltriAperti] = flagLocale('tana:coda:filtri-aperti')
