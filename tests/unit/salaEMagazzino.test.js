'use strict'

// LA SALA SEGNA «SERVITO» E IL MAGAZZINO DEVE ESSERE GIÀ A POSTO (BUG-040).
//
// Il difetto, visto in produzione: lo scarico si faceva quando la comanda
// passava a «servito». Ma segnare servito è il mestiere della SALA — è lei
// che porta il drink al tavolo — e la sala su `inventory_items` non scrive:
// le regole di Firestore la fermano. La scrittura falliva, il catch la
// ingoiava in silenzio, e non se ne accorgeva nessuno: l'avanzamento si
// vedeva, il magazzino no. Una serata servita e incassata tutta dalla sala
// lasciava le giacenze ferme, e il conto non tornava tre giorni dopo.
//
// La cura non è stata allargare i permessi — sarebbe stato dare alla sala
// tutto il magazzino — ma spostare il momento: si scala a PRONTO, che è
// dove il fatto succede davvero (fra pronto e servito il gin è già nel
// bicchiere) e dove a premere è il BANCO, che sul magazzino scrive.
//
// Questi test guardano la cosa dal lato del DANNO, non della funzione: se
// un domani qualcuno rimette lo scarico su «servito», qui si accende una
// luce rossa che dice anche perché.

import { describe, it, expect } from 'vitest'
import { comandaDaScaricare } from '../../src/lib/comande.js'
import { comandeImpegnate } from '../../src/lib/impegnato.js'
import { ORDER_STATUSES } from '../../src/lib/orderStatus.js'

// I passi che tocca la SALA: da qui in poi il drink è uscito dal banco, e
// chi preme il tasto non ha i permessi per scrivere sul magazzino.
const PASSI_DELLA_SALA = [ORDER_STATUSES.RITIRATO]

describe('la sala serve, e il magazzino non la aspetta', () => {
  it('nessun passo della sala fa partire uno scarico', () => {
    for (const passo of PASSI_DELLA_SALA) {
      // Nemmeno una comanda mai scaricata: se lo scarico partisse QUI,
      // fallirebbe in silenzio per i permessi — che è esattamente BUG-040.
      expect(comandaDaScaricare({ inventory_applied: false }, passo), passo).toBe(false)
      expect(comandaDaScaricare({ inventory_applied: true }, passo), passo).toBe(false)
    }
  })

  it('a scaricare è il passo del banco, «pronto»', () => {
    expect(comandaDaScaricare({ inventory_applied: false }, ORDER_STATUSES.PRONTO)).toBe(true)
  })

  // LA SERATA INTERA, nell'ordine in cui succede. È il caso che in
  // produzione lasciava il magazzino fermo.
  it('la serata: il banco fa pronto e scala, la sala serve e non tocca niente', () => {
    const comanda = { id: 'c1', status: ORDER_STATUSES.IN_PREPARAZIONE, inventory_applied: false }

    // Il banco segna pronto: qui si scala, e la comanda se lo porta scritto.
    expect(comandaDaScaricare(comanda, ORDER_STATUSES.PRONTO)).toBe(true)
    comanda.inventory_applied = true
    comanda.status = ORDER_STATUSES.PRONTO

    // La sala porta il drink al tavolo: nessuna scrittura sul magazzino,
    // quindi nessun fallimento silenzioso.
    expect(comandaDaScaricare(comanda, ORDER_STATUSES.RITIRATO)).toBe(false)
    comanda.status = ORDER_STATUSES.RITIRATO
    expect(comanda.inventory_applied).toBe(true)
  })
})

// L'ALTRA METÀ DEL DIFETTO: gli ingredienti restavano IMPEGNATI per sempre.
// Con lo scarico fallito la comanda teneva `inventory_applied: false`, e
// quel gin risultava ancora «promesso» nella colonna di fine serata invece
// che consumato — un numero sbagliato in due posti insieme.
describe('e quello che è uscito esce anche dagli impegnati', () => {
  const conComanda = (over) => ({ comande: [{ id: 'c1', items: [{ drink_id: 'x', qty: 1 }], ...over }] })

  it('una comanda scaricata non pesa più fra i promessi', () => {
    const o = conComanda({ status: ORDER_STATUSES.PRONTO, inventory_applied: true })
    expect(comandeImpegnate(o)).toHaveLength(0)
  })

  it('finché non è scaricata invece pesa, anche se il drink è pronto', () => {
    const o = conComanda({ status: ORDER_STATUSES.PRONTO, inventory_applied: false })
    expect(comandeImpegnate(o)).toHaveLength(1)
  })

  // IL METRO È `inventory_applied`, NON LO STATO — ed è per questo che
  // spostare lo scarico da «servito» a «pronto» non ha richiesto di
  // cambiare una riga qui dentro. Se qualcuno legasse questo conto allo
  // STATO, i due numeri tornerebbero a scollarsi.
  it('anche servita, una comanda non scaricata resta fra i promessi', () => {
    const o = conComanda({ status: ORDER_STATUSES.RITIRATO, inventory_applied: false })
    expect(comandeImpegnate(o)).toHaveLength(1)
  })
})
