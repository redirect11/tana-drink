// ── SERVIZIO O RITIRO ────────────────────────────────────────────────
//
// Un conto è servito al tavolo o ritirato al banco. I DUE MODI ESISTONO
// SEMPRE, per chiunque e in qualunque schermata: non sono una funzione che
// si accende, non dipendono dalle ordinazioni dei clienti e non sono una
// faccenda della vista cliente. Un tavolo che cambia idea e viene a
// ritirare al banco succede tutte le sere, in qualunque locale.
//
// CHI DECIDE, in ordine:
//
//   il LOCALE   dice come NASCONO i conti (`settings.service_mode`), non
//               quali modi esistono. È un valore di partenza.
//   il CLIENTE  sceglie il suo, ma solo se il locale gliela lascia
//               scegliere («entrambi») e solo se ordina da sé: quella voce
//               parla di CHI sceglie, non di cosa si sceglie.
//   lo STAFF    può sempre cambiare quello che ha in mano, conto per
//               conto. Due conti battuti dallo stesso tablet possono
//               essere uno servito e uno da ritirare, ed è tutto il punto.
//
// La scelta sta sul CONTO (`order.service_mode`), non sul terminale e non
// sul locale.

export const MODI_CONSEGNA = [
  ['tavolo', '🍸 Servizio'],
  ['banco', '🚶 Ritiro'],
]

// ── I DUE MONDI ─────────────────────────────────────────
//
// Un locale sta in uno di due mondi, e non ce n'è un terzo:
//
//   'tavolo'    SOLO SERVIZIO. Si porta tutto al tavolo, il ritiro al
//               banco non esiste. Nessuna scelta da fare, da nessuna parte.
//   'entrambi'  RITIRO E SERVIZIO CONVIVONO. È il caso normale di un bar:
//               chi si siede si fa servire, chi è di fretta ritira al
//               bancone, e lo stesso locale fa tutte e due le cose nella
//               stessa serata.
//
// NON ESISTE UN MONDO «SOLO RITIRO». C'era — il valore 'banco' — ma non
// descriveva un locale: descriveva un DEFAULT. Un posto che fa solo
// asporto non ha bisogno che l'app gli vieti il servizio, ha bisogno che i
// conti nascano «ritiro». Sono due cose diverse, e tenerle insieme in un
// valore solo era il motivo per cui l'impostazione sembrava un vincolo.
//
// I VECCHI VALORI SI LEGGONO ANCORA, senza migrazioni: 'banco' era «solo
// ritiro» e diventa il mondo con tutti e due, coi conti che nascono
// ritiro; 'entrambi' voleva dire «sceglie il cliente» e resta quello, con
// la scelta accesa. Chi tocca l'impostazione riscrive i campi nuovi.
export function mondoConsegna(settings) {
  return settings?.service_mode === 'tavolo' ? 'tavolo' : 'entrambi'
}

// Il modo con cui NASCE un conto battuto dallo staff. È un valore di
// partenza, non un vincolo: da «Dati conto» si cambia sempre.
export function modoAllaNascita(settings) {
  if (mondoConsegna(settings) === 'tavolo') return 'tavolo'
  // Campo nuovo; in mancanza si legge il vecchio 'banco', che era proprio
  // questo: «qui di solito si ritira».
  if (settings?.consegna_default === 'banco' || settings?.consegna_default === 'tavolo') {
    return settings.consegna_default
  }
  return settings?.service_mode === 'banco' ? 'banco' : 'tavolo'
}

// IL CLIENTE SCEGLIE IL SUO? Solo dove i due modi convivono — con il solo
// servizio non c'è niente da scegliere — e solo se i clienti possono
// davvero ordinare: quella voce parla di CHI sceglie, e senza ordinazioni
// dei clienti non ha nessuno a cui chiederlo.
export function clienteScegliePossibile(settings) {
  return mondoConsegna(settings) === 'entrambi' && settings?.menu_only !== true
}

export function clienteSceglie(settings) {
  if (!clienteScegliePossibile(settings)) return false
  if (typeof settings?.cliente_sceglie_consegna === 'boolean') {
    return settings.cliente_sceglie_consegna
  }
  // Vecchio valore: 'entrambi' voleva dire esattamente questo.
  return settings?.service_mode === 'entrambi'
}

// ── I SOLDI CHE CAMBIANO COL MODO ────────────────────────────────────
//
// Il ritiro al banco azzera coperto e costo di servizio: chi viene a
// prendersi il drink al bancone non occupa un tavolo e non si fa servire.
// Cambiare modo su un conto già battuto cambia quindi il TOTALE, e questa
// è la funzione che lo dice — una sola, così il conto del cliente e quello
// dello staff non arrivano a due cifre diverse.
//
// `subtotale` sono i drink (senza supplementi): il servizio è una
// percentuale su drink + coperto.
export function supplementiPerModo({
  modo,
  persone = 0,
  subtotale = 0,
  settings = {},
} = {}) {
  const alTavolo = modo === 'tavolo'
  const coperto =
    settings.coperto_enabled && alTavolo
      ? (Number(persone) || 0) * (Number(settings.coperto_amount) || 0)
      : 0
  const servizio =
    settings.service_charge_enabled && alTavolo
      ? Math.round((subtotale + coperto) * (Number(settings.service_charge_percent) || 0)) / 100
      : 0
  return {
    coperto_persons: settings.coperto_enabled && alTavolo ? Number(persone) || 0 : 0,
    coperto_amount: coperto,
    service_charge_amount: servizio,
  }
}

// ── SI PUÒ CAMBIARE IL MODO DI QUESTO CONTO? ─────────────────────────
//
// Tre risposte, e ognuna vuol dire una cosa diversa per i soldi:
//
//   'si'        conto aperto e nessun incasso: si cambia, e i supplementi
//               si rifanno col modo nuovo.
//   'senza-soldi'  c'è già un acconto. Il modo si cambia lo stesso — «ho
//               pagato metà e poi me lo porto via» succede — ma i
//               supplementi NON si toccano: sono stati calcolati sul
//               totale su cui si è già incassato, e muovere quel totale
//               sotto un acconto è come cambiare il prezzo dopo aver preso
//               i soldi. Se serve cambiare anche l'importo si riapre il
//               conto, che è il gesto fatto apposta e lascia traccia.
//   'no'        conto chiuso o annullato: non si tocca niente. Anche qui
//               la strada è «Riapri conto».
export function cambioModoPermesso(order) {
  if (!order) return 'no'
  if (order.status === 'pagato' || order.status === 'annullato') return 'no'
  if (order.payment_status === 'pagato') return 'no'
  const incassato = (order.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  return incassato > 0 ? 'senza-soldi' : 'si'
}

// ── LA FRASE DELL'ANNULLO SEGUE IL MONDO DELLA CONSEGNA ───────────
//
// Annullando un ordine si propone al cliente una frase: «Prego recarsi al
// bancone» oppure «Lo staff sarà subito da te». La prima ha senso solo
// dove il RITIRO esiste — in un locale a solo servizio manda una persona a
// un bancone dove nessuno la aspetta, che è peggio di non dirle niente.
//
// Come per «Lo sceglie il cliente»: la voce impossibile non sparisce, si
// spegne col motivo — sparire fa dubitare di averla immaginata — e la
// frase di partenza torna a quella valida invece di restare
// un'impostazione che non si può applicare.
export function fraseAnnulloPossibile(chiave, settings) {
  if (chiave !== 'bancone') return true
  return mondoConsegna(settings) === 'entrambi'
}

export function fraseAnnulloDefault(settings) {
  const scelta = settings?.cancel_phrase_default
  if (scelta && fraseAnnulloPossibile(scelta, settings)) return scelta
  // In un locale a solo servizio l'unica che si può dire è quella dello
  // staff; altrove resta il bancone, che è come ha sempre funzionato.
  return mondoConsegna(settings) === 'entrambi' ? 'bancone' : 'staff'
}
