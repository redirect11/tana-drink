import { describe, it, expect } from 'vitest'
import { STATI_CHIUSI, STATI_FATTI, STATI_SCARTATI, deveNascere } from '../../scripts/lib-requisiti.mjs'

// UNA COSA SCARTATA NON SPARISCE, SI CHIUDE DICENDO CHE NON LA FAREMO.
// Prima gli stati che chiudevano un'issue erano solo quelli del lavoro
// finito: una voce messa `deprecated` o `wontfix` restava con la sua issue
// APERTA per sempre, a chiedere a qualcuno un lavoro che avevamo deciso di
// non fare. E chi decide di scartare spesso spegne anche `generate_issue`,
// che la faceva uscire del tutto dal giro: l'issue diventava orfana.
// La voce nel registro invece resta sempre, col suo perche' — quello e' il
// posto dove la decisione va letta fra sei mesi.
describe('le voci scartate', () => {
  it('chiudono l’issue come le fatte, ma restano una famiglia a parte', () => {
    for (const stato of ['deprecated', 'wontfix']) {
      expect(STATI_SCARTATI.has(stato), stato).toBe(true)
      expect(STATI_CHIUSI.has(stato), stato).toBe(true)
      expect(STATI_FATTI.has(stato), stato).toBe(false)
    }
  })

  it('e il lavoro finito resta nella sua', () => {
    for (const stato of ['fixed', 'implemented', 'done']) {
      expect(STATI_FATTI.has(stato), stato).toBe(true)
      expect(STATI_SCARTATI.has(stato), stato).toBe(false)
    }
  })

  it('non fanno nascere un’issue nuova: si entra nel giro solo per chiudere', () => {
    for (const status of ['deprecated', 'wontfix']) {
      expect(deveNascere({ status, generate_issue: true }, false), status).toBe(false)
    }
    // e una da fare invece nasce, se non c'e' gia'
    expect(deveNascere({ status: 'todo', generate_issue: true }, false)).toBe(true)
  })
})
