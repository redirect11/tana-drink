// ── UN LOCALE IN REGOLA, PER I TEST (REQ-LIC-009) ─────────────────────
//
// Fino al 02/11/2026 l'app compilata per la Tana portava la sua licenza
// nella build, e i test che non ne scrivevano una lavoravano «da Tana»,
// con tutti i moduli. Da REQ-LIC-009 la licenza sta solo in
// `licenza/attuale`: le impostazioni di un test senza licenza sono quelle
// di un locale che non si sa ancora cosa abbia, e nessun modulo lavora.
// I test che parlano d'altro (la barra, il menù, la cassa) partono da qui:
// i moduli della Tana, tutti tranne le fatture ai clienti.
export const LICENZA_TANA = Object.freeze({
  moduli: Object.freeze({
    menu_tavoli: true,
    ordini_cliente: true,
    clienti: true,
    magazzino: true,
    statistiche: true,
    staff: true,
    sumup: true,
    conta: true,
    fatture: false,
    scadenzario: true,
  }),
})

export const CON_LICENZA = Object.freeze({ licenza: LICENZA_TANA })
