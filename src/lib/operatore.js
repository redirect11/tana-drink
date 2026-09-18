// ── CHI STA LAVORANDO A QUESTO TERMINALE (REQ-STAFF-016) ─────────────
//
// Flavio, 11/09/2026: «l'utenza admin dovrebbe gestire dei sottoutenti
// della cassa. Flavio e Vittorio sarebbero i due sottoutenti admin. Una
// volta loggato admin, all'apertura della cassa il sistema dovrebbe
// chiedere quale sottoutente sta gestendo la cassa … in modo da non dover
// fare il login ogni volta che l'app viene aperta».
//
// NON È UN LOGIN, ed è la scelta che tiene in piedi tutto il resto. La
// sessione di Firebase resta quella dell'admin collegato: qui si sceglie
// soltanto CHI STA LAVORANDO, che è un'etichetta, non un permesso. Fare un
// login vero senza password vorrebbe dire o tenere in giro le credenziali
// degli altri, o un modo per entrare in un account altrui: due porte che
// non si aprono per comodità.
//
// E LA SCELTA È FRA ADMIN, il che rende la cosa innocua: chi si sceglie ha
// esattamente i permessi di chi ha fatto il login, quindi passare da uno
// all'altro non sposta di un millimetro quello che si può fare. Se un
// domani si volessero scegliere anche i bartender, quella diventerebbe una
// decisione di sicurezza vera e andrebbe pensata a parte — per questo qui
// il filtro è stretto e sta in un posto solo.
//
// A COSA SERVE: a dire di chi è l'aspetto (tema e colori, che Flavio e
// Vittorio vogliono diversi) e a firmare la serata. Sta sul DISPOSITIVO,
// come l'ultimo ruolo conosciuto (ruoloLocale.js): il tablet del banco
// ricorda chi ci lavora senza chiederlo a ogni riapertura, che è proprio
// quello che Flavio non vuole più fare.

import { isAdmin } from './ruoli.js'

const CHIAVE = 'tana:operatore'

// Chi disegna il nome in barra deve vederlo cambiare nell'istante in cui si
// sceglie, senza ricaricare: la scelta si fa all'apertura della cassa, e il
// nome sta in cima allo schermo, due schermate diverse.
const ascoltatori = new Set()
export function iscrivitiAllOperatore(cb) {
  ascoltatori.add(cb)
  return () => ascoltatori.delete(cb)
}
function avvisa() {
  for (const cb of ascoltatori) {
    try {
      cb()
    } catch {
      /* un ascoltatore rotto non ferma gli altri */
    }
  }
}

// Il nome con cui una persona si legge a schermo. L'email spezzata alla
// chiocciola è l'ultima spiaggia: meglio «admin» che una casella vuota.
export function nomeOperatore(u) {
  const nome = String(u?.name || '').trim()
  if (nome) return nome
  return String(u?.email || '').split('@')[0] || '?'
}

// CHI È ASSOCIATO A UN ACCOUNT, o null se non è stato deciso niente.
//
// Le associazioni stanno su settings/bar (`admin_associati`), una lista per
// ACCOUNT: «quando il login è di Vittorio, si può aprire la cassa come…».
// Daniele, 19/09/2026: «si deve decidere quali sono gli admin, anche perché
// può essere Vittorio o io a fare il login, e lì sono altre associazioni».
//
// UNA LISTA VUOTA VALE COME NESSUNA LISTA: il locale che non ha deciso
// niente vede tutti gli admin, che è il comportamento di sempre. Chi vuole
// stringere lo fa da Utenti e ruoli, e da quel momento comanda la lista.
export function associazioniDi(mappa, uidCollegato) {
  const lista = mappa && uidCollegato ? mappa[uidCollegato] : null
  return Array.isArray(lista) && lista.length > 0 ? new Set(lista) : null
}

// CHI SI PUÒ SCEGLIERE: gli admin associati a chi ha fatto il login, quello
// collegato per primo.
//
// CHI È COLLEGATO C'È SEMPRE, qualunque cosa dica la lista: è il suo
// account, e un elenco che non contiene nemmeno chi lo sta guardando è un
// elenco rotto — con la lista compilata male ci si ritroverebbe a non poter
// aprire la cassa per nessuno.
//
// E STA IN CIMA perché è la risposta giusta quasi sempre: chi apre l'app col
// proprio account di solito è quello che ci lavora, e il primo della lista è
// quello che si tocca senza pensarci.
export function operatoriSelezionabili(staff, uidCollegato, associazioni = null) {
  const ammessi = associazioniDi(associazioni, uidCollegato)
  return (staff || [])
    .filter((u) => u && u.uid && !u.disabled && isAdmin(u.role))
    .filter((u) => !ammessi || u.uid === uidCollegato || ammessi.has(u.uid))
    .map((u) => ({ uid: u.uid, nome: nomeOperatore(u), email: u.email || null }))
    .sort((a, b) => {
      if (a.uid === uidCollegato) return -1
      if (b.uid === uidCollegato) return 1
      return a.nome.localeCompare(b.nome, 'it')
    })
}

// ── QUELLO CHE IL DISPOSITIVO SI RICORDA ─────────────────────────────
//
// PORTA CON SÉ CHI ERA COLLEGATO, come il ruolo (ruoloLocale.js): se al
// tablet si collega un altro account, la scelta di prima non si eredita.
// Senza, chi entra col proprio account si ritroverebbe a lavorare sotto il
// nome di chi c'era ieri sera, e non avrebbe modo di accorgersene.
export function ricordaOperatore(uidCollegato, persona) {
  try {
    if (!uidCollegato || !persona?.uid) localStorage.removeItem(CHIAVE)
    else
      localStorage.setItem(
        CHIAVE,
        JSON.stringify({ collegato: uidCollegato, uid: persona.uid, nome: persona.nome || '' })
      )
  } catch {
    /* niente memoria: si richiederà alla prossima apertura di cassa */
  }
  avvisa()
}

export function operatoreRicordato(uidCollegato) {
  if (!uidCollegato) return null
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) || 'null')
    return v && v.collegato === uidCollegato && v.uid ? { uid: v.uid, nome: v.nome || '' } : null
  } catch {
    return null
  }
}

export function dimenticaOperatore() {
  try {
    localStorage.removeItem(CHIAVE)
  } catch {
    /* non c'era niente da togliere */
  }
  avvisa()
}

// CHI RISULTA AL LAVORO ADESSO. Il ricordato, ma solo se è ANCORA uno che
// si può scegliere: un admin declassato o disattivato non deve continuare a
// firmare le serate dal tablet che se lo ricorda: si ricade su chi è
// collegato, che è sempre una risposta vera.
//
// Il nome si riprende dall'elenco e non da quello salvato: se intanto è
// stato corretto, a schermo compare quello giusto.
export function operatoreCorrente(staff, uidCollegato, associazioni = null) {
  const ammessi = operatoriSelezionabili(staff, uidCollegato, associazioni)
  const ricordato = operatoreRicordato(uidCollegato)
  const scelto = ricordato && ammessi.find((u) => u.uid === ricordato.uid)
  if (scelto) return scelto
  // L'elenco può non essere ancora arrivato (prima apertura, offline): il
  // ricordato vale comunque, perché al momento della scelta era ammesso.
  if (ricordato && ammessi.length === 0) return ricordato
  return ammessi.find((u) => u.uid === uidCollegato) || null
}

// C'È QUALCUNO FRA CUI SCEGLIERE? Con un solo admin la domanda non ha
// senso: la si salta, e chi è collegato lavora col proprio nome. È il caso
// di ogni locale finché non nomina il secondo.
export function valeLaPenaChiedere(staff, uidCollegato, associazioni = null) {
  return operatoriSelezionabili(staff, uidCollegato, associazioni).length > 1
}
