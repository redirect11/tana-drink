// @vitest-environment happy-dom
'use strict'

// CHI STA LAVORANDO A QUESTO TERMINALE (REQ-STAFF-016).
//
// Flavio, 11/09/2026: «una volta loggato admin, all'apertura della cassa il
// sistema dovrebbe chiedere quale sottoutente sta gestendo la cassa … in
// modo da non dover fare il login ogni volta».
//
// LE DUE COSE CHE QUESTO FILE SORVEGLIA, e sono due porte:
//
// 1. SI SCEGLIE SOLO FRA ADMIN. È quello che rende la faccenda innocua:
//    chi si sceglie ha gli stessi permessi di chi ha fatto il login, quindi
//    passare dall'uno all'altro non sposta niente. Se il filtro si
//    allargasse — a un bartender, a un utente disattivato — smetterebbe di
//    essere un'etichetta e diventerebbe un modo per lavorare sotto un nome
//    che non si è guadagnato.
// 2. LA SCELTA NON SI EREDITA FRA ACCOUNT DIVERSI. Al tablet si collega un
//    altro, e la scelta di ieri sera deve sparire: se no si firma la
//    serata col nome di chi non c'è.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  associazioniDi,
  operatoriSelezionabili,
  operatoreCorrente,
  operatoreRicordato,
  ricordaOperatore,
  dimenticaOperatore,
  nomeOperatore,
  valeLaPenaChiedere,
} from '../../src/lib/operatore.js'

const FLAVIO = { uid: 'u-flavio', email: 'admin@latanadelconiglio.it', name: 'Flavio', role: 'admin' }
const VITTORIO = { uid: 'u-vittorio', email: 'adm@gmai.com', name: 'Vittorio', role: 'admin' }
const DANIELE = { uid: 'u-daniele', email: 'daniele@x.it', name: '', role: 'admin' }
const GIULIA = { uid: 'u-giulia', email: 'giulia@x.it', name: 'Giulia', role: 'bartender' }
const MARZIA = { uid: 'u-marzia', email: 'marzia@x.it', name: 'Marzia', role: 'staff' }
const STAFF = [VITTORIO, GIULIA, FLAVIO, MARZIA, DANIELE]

beforeEach(() => localStorage.clear())

describe('chi si può scegliere', () => {
  // LA PORTA STRETTA. Il bartender e la sala non entrano: la scelta è fra
  // pari, e con loro dentro non lo sarebbe più.
  it('solo gli admin, e nessun altro', () => {
    expect(operatoriSelezionabili(STAFF, 'u-flavio').map((u) => u.uid)).toEqual([
      'u-flavio',
      'u-daniele',
      'u-vittorio',
    ])
  })

  it('chi è collegato sta in cima, il resto in ordine di nome', () => {
    expect(operatoriSelezionabili(STAFF, 'u-vittorio').map((u) => u.nome)).toEqual([
      'Vittorio',
      'daniele',
      'Flavio',
    ])
  })

  // Un admin disattivato non lavora più: toglierlo dai ruoli e lasciarlo
  // scegliere sarebbe lo stesso buco, entrato da un'altra porta.
  it('un admin disattivato non si sceglie', () => {
    const fuori = [{ ...VITTORIO, disabled: true }, FLAVIO]
    expect(operatoriSelezionabili(fuori, 'u-flavio').map((u) => u.uid)).toEqual(['u-flavio'])
  })

  it('senza nome si usa l’email fino alla chiocciola', () => {
    expect(nomeOperatore(DANIELE)).toBe('daniele')
    expect(nomeOperatore({ name: '  Flavio  ' })).toBe('Flavio')
    expect(nomeOperatore({})).toBe('?')
  })

  // Con un admin solo non c'è niente da chiedere: la domanda comparirebbe
  // a ogni apertura di cassa con una risposta sola.
  it('con un admin solo non vale la pena chiedere', () => {
    expect(valeLaPenaChiedere([FLAVIO, GIULIA], 'u-flavio')).toBe(false)
    expect(valeLaPenaChiedere(STAFF, 'u-flavio')).toBe(true)
    expect(valeLaPenaChiedere([], 'u-flavio')).toBe(false)
  })
})

// ── LE ASSOCIAZIONI, PER ACCOUNT ─────────────────────────────────────
// Daniele, 19/09/2026: «si deve decidere quali sono gli admin, anche perché
// può essere Vittorio o io a fare il login, e lì sono altre associazioni».
// L'elenco dipende da CHI ha fatto il login, non è uno solo per il locale.
describe('chi è associato a quale account', () => {
  const MAPPA = {
    'u-flavio': ['u-vittorio'],
    'u-daniele': ['u-flavio', 'u-vittorio'],
  }

  it('col login di Flavio si sceglie fra lui e chi gli è associato', () => {
    expect(operatoriSelezionabili(STAFF, 'u-flavio', MAPPA).map((u) => u.uid)).toEqual([
      'u-flavio',
      'u-vittorio',
    ])
  })

  it('e con un altro login l’elenco è un altro', () => {
    expect(operatoriSelezionabili(STAFF, 'u-daniele', MAPPA).map((u) => u.uid)).toEqual([
      'u-daniele',
      'u-flavio',
      'u-vittorio',
    ])
  })

  // L'account c'è SEMPRE: una lista che non contiene nemmeno chi la sta
  // guardando lascerebbe la cassa senza nessuno da scegliere.
  it('chi è collegato c’è anche se la lista non lo nomina', () => {
    expect(operatoriSelezionabili(STAFF, 'u-vittorio', { 'u-vittorio': ['u-flavio'] }).map((u) => u.uid)).toEqual([
      'u-vittorio',
      'u-flavio',
    ])
  })

  // Non aver deciso niente vuol dire «tutti», non «nessuno»: il locale che
  // non tocca questa schermata non deve accorgersi che esiste.
  it('senza associazioni si torna a tutti gli admin', () => {
    expect(associazioniDi(null, 'u-flavio')).toBeNull()
    expect(associazioniDi({ 'u-flavio': [] }, 'u-flavio')).toBeNull()
    expect(operatoriSelezionabili(STAFF, 'u-flavio', { 'u-flavio': [] }).map((u) => u.uid)).toEqual([
      'u-flavio',
      'u-daniele',
      'u-vittorio',
    ])
  })

  // Un associato che non è più admin non rientra dalla finestra: le due
  // regole si sommano, non si sostituiscono.
  it('e un associato declassato resta fuori lo stesso', () => {
    const declassato = STAFF.map((u) => (u.uid === 'u-vittorio' ? { ...u, role: 'bartender' } : u))
    expect(operatoriSelezionabili(declassato, 'u-flavio', MAPPA).map((u) => u.uid)).toEqual(['u-flavio'])
  })

  it('con un associato solo, non vale la pena chiedere', () => {
    expect(valeLaPenaChiedere(STAFF, 'u-flavio', { 'u-flavio': [] })).toBe(true)
    expect(valeLaPenaChiedere(STAFF, 'u-vittorio', { 'u-vittorio': [] })).toBe(true)
    // Nessun associato oltre a sé: una risposta sola, niente da chiedere.
    expect(valeLaPenaChiedere(STAFF, 'u-flavio', { 'u-flavio': ['u-flavio'] })).toBe(false)
  })
})

describe('quello che il tablet si ricorda', () => {
  it('si ricorda la scelta, e la ridà a chi è collegato', () => {
    ricordaOperatore('u-daniele', { uid: 'u-flavio', nome: 'Flavio' })
    expect(operatoreRicordato('u-daniele')).toEqual({ uid: 'u-flavio', nome: 'Flavio' })
  })

  // LA SECONDA PORTA. Al tablet si collega un altro account: la scelta di
  // prima non è sua, e non deve trovarsela addosso.
  it('ma non a un account diverso', () => {
    ricordaOperatore('u-daniele', { uid: 'u-flavio', nome: 'Flavio' })
    expect(operatoreRicordato('u-vittorio')).toBeNull()
    expect(operatoreRicordato(null)).toBeNull()
  })

  it('e si dimentica quando glielo si dice', () => {
    ricordaOperatore('u-daniele', { uid: 'u-flavio', nome: 'Flavio' })
    dimenticaOperatore()
    expect(operatoreRicordato('u-daniele')).toBeNull()
  })
})

describe('chi risulta al lavoro adesso', () => {
  it('il ricordato, col nome preso dall’elenco di adesso', () => {
    ricordaOperatore('u-daniele', { uid: 'u-flavio', nome: 'nome vecchio' })
    expect(operatoreCorrente(STAFF, 'u-daniele')).toEqual({
      uid: 'u-flavio',
      nome: 'Flavio',
      email: 'admin@latanadelconiglio.it',
    })
  })

  it('senza nessuna scelta, chi è collegato', () => {
    expect(operatoreCorrente(STAFF, 'u-vittorio').uid).toBe('u-vittorio')
  })

  // UN ADMIN DECLASSATO NON CONTINUA A FIRMARE LE SERATE dal tablet che se
  // lo ricorda: il ricordo vale finché la persona è ancora fra quelli che
  // si possono scegliere.
  it('se il ricordato non è più admin, torna chi è collegato', () => {
    ricordaOperatore('u-daniele', { uid: 'u-vittorio', nome: 'Vittorio' })
    const declassato = STAFF.map((u) => (u.uid === 'u-vittorio' ? { ...u, role: 'bartender' } : u))
    expect(operatoreCorrente(declassato, 'u-daniele').uid).toBe('u-daniele')
  })

  // L'elenco arriva da una Cloud Function: offline, o al primo disegno, non
  // c'è ancora. La scelta di ieri sera vale lo stesso — quando è stata
  // fatta era ammessa — se no il nome ballerebbe a ogni riapertura.
  it('con l’elenco non ancora arrivato, il ricordato vale comunque', () => {
    ricordaOperatore('u-daniele', { uid: 'u-flavio', nome: 'Flavio' })
    expect(operatoreCorrente([], 'u-daniele')).toEqual({ uid: 'u-flavio', nome: 'Flavio' })
  })

  it('e senza niente in mano non si inventa nessuno', () => {
    expect(operatoreCorrente([], 'u-daniele')).toBeNull()
    expect(operatoreCorrente(STAFF, null)).toBeNull()
  })
})
