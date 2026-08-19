'use strict'

// Logica pura per le notifiche push sugli ordini: decide se e cosa inviare
// quando un ordine cambia stato. Nessuna dipendenza Firebase: testabile.

const CANCEL_PHRASES = {
  bancone: 'Prego recarsi al bancone.',
  staff: 'Lo staff sarà subito da te.',
}

// Chi sta al banco: batte gli ordini di persona, quindi non ha bisogno che
// glieli annuncino. (Stessa coppia di src/lib/ruoli.js: qui non si possono
// importare i moduli del client.)
// Conta le comande di un ordine in un dato stato. Retrocompatibile: i doc
// legacy (senza `comande`) valgono come una sola comanda con lo stato
// dell'ordine.
function countComande(o, status) {
  if (!o) return 0
  if (Array.isArray(o.comande)) return o.comande.filter((c) => c && c.status === status).length
  return o.status === status ? 1 : 0
}

// Dati (before, after) di un documento ordine. Restituisce il messaggio da
// inviare ({ title, body }) oppure null se non va notificato nulla.
function decideOrderPush(before, after) {
  if (!after || !after.push_token) return null

  // Una comanda in più è passata a "pronto" (vale anche per le aggiunte
  // a un conto aperto: ogni comanda pronta notifica il cliente).
  // SOLO col RITIRO AL BANCO: è l'unico caso in cui il cliente deve fare
  // qualcosa (alzarsi e venire a prendere il drink). Al tavolo ci pensa il
  // servizio, quindi avvisarlo sarebbe un disturbo inutile.
  // Il push arriva comunque solo a chi ha ordinato dal menù: gli ordini
  // battuti dallo staff nascono senza push_token (vedi sopra).
  if (
    after.service_mode === 'banco' &&
    countComande(after, 'pronto') > countComande(before, 'pronto')
  ) {
    return {
      title: '🔔 Il tuo drink è pronto!',
      body: `Ordine #${after.daily_number ?? '—'} pronto al ritiro.`,
    }
  }

  if (!before || before.status === after.status) return null
  if (
    after.status === 'annullato' &&
    after.cancelled_by === 'bartender' &&
    after.cancel_notify === true
  ) {
    const phrase = CANCEL_PHRASES[after.cancel_phrase] || CANCEL_PHRASES.bancone
    const motivo = after.cancel_message ? ` Motivazione: ${after.cancel_message}` : ''
    return {
      title: '⚠️ Problema con il tuo ordine',
      body: `${phrase}${motivo}`,
    }
  }

  return null
}

// Pattern di vibrazione "cerca-persone": forte e riconoscibile.
// Lo stesso pattern è usato dal service worker e dalla pagina.
const STAFF_CALL_VIBRATION = [500, 200, 500, 200, 900]

// Documento staff_calls appena creato → messaggio push per il membro
// dello staff chiamato, o null se non c'è nulla da inviare.
function decideStaffCallPush(call) {
  if (!call || !call.to_uid) return null
  if (call.status && call.status !== 'pending') return null
  // Mai l'email del chiamante: al massimo il nome.
  const da = call.from_name || null
  return {
    title: '📟 Chiamata dal bancone',
    body: call.message
      ? da
        ? `${da}: «${call.message}»`
        : `«${call.message}»`
      : da
        ? `${da} ti sta chiamando. Rispondi sul telefono.`
        : 'Rispondi sul telefono.',
  }
}

// Una comanda e' passata a "pronto": c'e' un drink fermo sul banco che
// aspetta qualcuno.
//
// VALE ANCHE PER IL RITIRO. Prima qui si usciva subito sui conti da
// ritirare al banco, dando per scontato che ci pensasse il cliente. Ma il
// cliente lo avvisiamo solo se ha ordinato dal menu' (e' il `push_token`
// scritto sull'ordine), e un conto battuto al POS non ce l'ha: su quelli
// non partiva niente per nessuno e il drink restava li' (BUG-036).
//
// Chi ha appena premuto «pronto» non ha bisogno che glielo si dica: di
// quello si occupa destinatariPush, col dispositivo di origine.
function decideStaffServePush(before, after) {
  if (!after) return null
  if (countComande(after, 'pronto') <= countComande(before, 'pronto')) return null
  const alBanco = after.service_mode === 'banco'
  const tavolo = after.table_label ? ` · Tavolo ${after.table_label}` : ''
  const nome = after.customer_name ? ` — ${after.customer_name}` : ''
  return {
    // Due parole diverse perche' sono due gesti diversi: uno lo si porta,
    // l'altro lo si consegna a chi viene a prenderlo.
    title: alBanco ? '🚶 Drink pronti da consegnare' : '🫱 Drink pronti da servire',
    body: `Ordine #${after.daily_number ?? '—'}${tavolo}${nome}`,
  }
}

// L'ordine è "ricevuto" ed entrato in coda di preparazione? È la stessa
// regola del gestionale (src/lib/payments.js → isAwaitingPayment): un ordine
// con pagamento OBBLIGATORIO non si prepara — e quindi non si notifica —
// finché non risulta pagato.
// COMANDE DA FARE: 'ricevuto' E 'in_preparazione'.
//
// Un ordine battuto al POS NASCE in preparazione — chi lo batte sta gia'
// facendo il drink — mentre quelli dal menu' nascono 'ricevuto'. Guardando
// i soli 'ricevuto', un ordine preso al POS da un altro terminale non
// risultava mai «nuovo in coda» e al banco non arrivava niente: e' il caso
// visto al banco, un admin che batte dal telefono e il tablet muto.
const DA_FARE = ['ricevuto', 'in_preparazione']

function comandeDaFare(o) {
  return DA_FARE.reduce((n, st) => n + countComande(o, st), 0)
}

// QUALI comande sono da fare, non quante. Contarle non basta: col cliente
// che ordina, «ricevuto» e «in preparazione» sono due momenti diversi —
// arriva l'ordine, poi qualcuno lo prende in mano — e un totale che non
// cambia non saprebbe distinguere «e' avanzata quella di prima» da «ne e'
// arrivata una nuova». Si guardano gli identificativi: avvisa solo quello
// che prima non c'era.
// I conti vecchi non hanno l'elenco delle comande: valgono per uno solo.
function idsDaFare(o) {
  if (!o) return []
  if (Array.isArray(o.comande)) {
    return o.comande
      .filter((c) => c && DA_FARE.includes(c.status))
      .map((c, i) => c.id || `#${i}`)
  }
  return DA_FARE.includes(o.status) ? ['#legacy'] : []
}

function isPayableReceived(o) {
  if (!o || comandeDaFare(o) === 0) return false
  if (o.payment_required && o.payment_status !== 'pagato') return false
  return true
}

// Nuovo ordine da preparare → notifica allo staff al bancone. Vale sia alla
// creazione (before assente) sia quando un ordine fermo in attesa di pagamento
// obbligatorio viene saldato (e solo allora entra in coda). Restituisce il
// messaggio { title, body } o null se non c'è nulla di nuovo da notificare.
function decideNewOrderStaffPush(before, after) {
  // NON SI TACE PER RUOLO, SI TACE PER TERMINALE. Prima qui si buttava via
  // l'avviso di ogni ordine battuto da un admin o da un bartender, dando per
  // scontato che chi ha quel ruolo stia al banco e sappia gia' tutto. Chi
  // gira ai tavoli col telefono e un account da gestore non faceva squillare
  // niente a nessuno: al banco l'ordine arrivava in silenzio.
  // A restare senza avviso e' SOLO il dispositivo che l'ha mandato — sa gia'
  // di averlo mandato — e di quello si occupa destinatariPush().
  if (!isPayableReceived(after)) return null // niente da fare, o pagamento obbligatorio non saldato
  // Se prima il conto era fermo in attesa del pagamento obbligatorio, adesso
  // che e' saldato entra in coda TUTTO INSIEME: e' nuovo per il banco anche
  // se le comande sono le stesse di prima.
  const prima = isPayableReceived(before) ? idsDaFare(before) : []
  const nuove = idsDaFare(after).filter((id) => !prima.includes(id))
  if (nuove.length === 0) return null // niente di nuovo in coda
  const tavolo = after.table_label ? ` · Tavolo ${after.table_label}` : ''
  const nome = after.customer_name ? ` — ${after.customer_name}` : ''
  // Aggiunta a un conto già esistente (seconda comanda in poi) vs primo invio.
  const isAddition = Array.isArray(after.comande) && after.comande.length > 1
  return isAddition
    ? {
        title: '➕ Aggiunta al conto',
        body: `Nuova comanda sull'ordine #${after.daily_number ?? '—'}.${tavolo}${nome}`,
      }
    : {
        title: '🆕 Nuovo ordine',
        body: `Ordine #${after.daily_number ?? '—'} ricevuto.${tavolo}${nome}`,
      }
}

// A CHI MANDARLO. `tokens` sono i dispositivi registrati ({ token, device });
// `dispositivoOrigine` e' il terminale da cui e' partita la cosa che si sta
// annunciando, e quello si salta.
//
// NON SI SMISTA PER RUOLO. Qui c'era un filtro `roles`, e il «pronto da
// servire» partiva solo verso le righe con `role: 'staff'`. Ma quel campo
// non diceva chi fosse la persona: diceva quale SCHERMATA aveva registrato
// il dispositivo, e la schermata dove finiscono tutti e' la coda, che ci
// scriveva 'bartender'. Nessuna riga era mai 'staff', l'elenco restava
// vuoto e non partiva niente: al banco, drink pronti e nessun avviso
// (BUG-036).
//
// Chi porta i drink non e' un ruolo, e' chi in quel momento e' in piedi. Il
// solo taglio che regge e' il TERMINALE: si salta quello che ha appena
// premuto il tasto, perche' sa gia'.
//
// Chi si e' registrato prima che il dispositivo venisse segnato non ha
// `device`: nel dubbio lo si avvisa. Un avviso in piu' si chiude, uno in
// meno e' un drink che non parte.
function destinatariPush(tokens, { dispositivoOrigine = null } = {}) {
  const righe = (tokens || []).filter((t) => t && t.token)
  // SI SALTA IL TELEFONO, NON LA RIGA. Lo stesso apparecchio puo' avere piu'
  // righe: quella nuova col dispositivo scritto e una vecchia intestata alla
  // persona, senza. Scartando solo la riga col dispositivo, la vecchia
  // restava e l'avviso tornava a chi l'ordine l'aveva appena mandato — che
  // e' esattamente quello che non deve succedere. Si guarda il TOKEN: e' il
  // nome dell'apparecchio, comunque sia intestata la riga.
  const suoi = new Set(
    dispositivoOrigine
      ? righe.filter((t) => t.device && t.device === dispositivoOrigine).map((t) => t.token)
      : []
  )
  const visti = new Set()
  return righe
    .filter((t) => !suoi.has(t.token))
    .filter((t) => !(dispositivoOrigine && t.device && t.device === dispositivoOrigine))
    // UNA VOLTA A DISPOSITIVO. Lo stesso telefono puo' comparire due volte:
    // la riga vecchia intestata alla persona e quella nuova intestata al
    // dispositivo. Due righe con lo stesso token vogliono dire due avvisi
    // identici sullo stesso schermo.
    .filter((t) => {
      if (visti.has(t.token)) return false
      visti.add(t.token)
      return true
    })
}

module.exports = {
  terminaliDi,
  countComande,
  comandeDaFare,
  idsDaFare,
  destinatariPush,
  decideOrderPush,
  decideStaffCallPush,
  decideStaffServePush,
  decideNewOrderStaffPush,
  isPayableReceived,
  CANCEL_PHRASES,
  STAFF_CALL_VIBRATION,
}

// ── I TERMINALI DI UNA PERSONA ───────────────────────────────────────
//
// La chiamata cerca-persone deve suonare su TUTTI i terminali di chi viene
// cercato: al banco si lavora con il tablet acceso e il telefono in tasca,
// e non si sa quale ha in mano.
//
// `righe` sono i documenti di `staff_tokens` come stanno scritti: uno per
// DISPOSITIVO, col campo `uid` di chi ci è collegato. Si accettano anche le
// righe vecchie intestate alla persona (id del documento = uid), rimaste in
// giro da prima. Un token può comparire due volte — la stessa riga salvata
// in tutti e due i modi — e mandarlo due volte farebbe vibrare due volte:
// si tiene una volta sola.
function terminaliDi(righe, uid) {
  if (!uid) return []
  const visti = new Set()
  const fuori = []
  for (const r of righe || []) {
    if (!r || !r.token) continue
    const suo = r.uid === uid || r.id === uid
    if (!suo || visti.has(r.token)) continue
    visti.add(r.token)
    fuori.push(r)
  }
  return fuori
}

