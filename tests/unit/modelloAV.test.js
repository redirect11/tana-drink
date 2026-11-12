'use strict'

// IL MODELLO A V, FATTO RISPETTARE (REQ-DEV-018).
//
// L'utente, 08/11/2026: «più qualità e meno regressioni al banco», con «una
// V per richiesta». Ogni richiesta scende dal bisogno del locale al codice
// e risale coi test di ogni livello:
//
//   bisogni (UR-*)       ── accettazione
//   specifica (REQ-*)    ── sistema
//   architettura (ARC-*) ── integrazione
//   modulo               ── unità
//
// Il metodo, scritto per le persone, è in docs/modello-a-v.md. Qui ci sono
// le regole che una persona di fretta salterebbe: i legami che puntano al
// vuoto, i test al livello sbagliato, la voce nuova che nasce senza il suo
// bisogno. Senza questo test la V resta un disegno in un documento.

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { caricaRequisiti, parseRequirementsYaml, FILE_BUGS } from '../../scripts/lib-requisiti.mjs'
import {
  caricaBisogni, caricaArchitettura, livelloDelTest, natoPrimaDellaV,
  bisogniPerRequisito, statoDellaV, fileDiTest,
} from '../../scripts/lib-modello-v.mjs'
import { costruisciSpecifica } from '../../scripts/lib-specifica.mjs'

const requisiti = caricaRequisiti()
const bug = caricaRequisiti(FILE_BUGS)
const bisogni = caricaBisogni()
const architettura = caricaArchitettura()
const perId = new Map(requisiti.map((r) => [r.id, r]))
const servePer = bisogniPerRequisito(bisogni)

// IL CRICCHETTO. I requisiti nati prima della V (08/11/2026) senza un
// bisogno che li citi. Si abbassa ogni volta che se ne collega uno, e non si
// alza mai: una voce NUOVA senza bisogno la boccia la regola qui sotto, non
// questo numero.
const MASSIMO_SENZA_BISOGNO = 241

describe('il livello di un test', () => {
  it('di regola lo dice la cartella', () => {
    expect(livelloDelTest('tests/unit/x.test.js', '')).toBe('unita')
    expect(livelloDelTest('tests/component/X.test.jsx', '')).toBe('integrazione')
    expect(livelloDelTest('tests/bdd/x.test.js', '')).toBe('integrazione')
    expect(livelloDelTest('tests/regole/x.test.js', '')).toBe('integrazione')
    expect(livelloDelTest('tests/sistema/serata.spec.js', '')).toBe('sistema')
    expect(livelloDelTest('tests/accettazione/serata.test.js', '')).toBe('accettazione')
    expect(livelloDelTest('tests/e2e/apriCassa.spec.js', '')).toBe('accettazione')
    expect(livelloDelTest('tests\\unit\\x.test.js', '')).toBe('unita')
  })

  // giroInLocale sta in tests/unit da prima della V, ma mette insieme
  // api.js con un Firestore che non risponde: è integrazione, come gli
  // altri quasi cinquanta che fanno lo stesso. Spostarli vorrebbe dire
  // riscrivere i percorsi nel registro: si riconoscono da quello che fanno.
  it('in tests/unit, chi sostituisce Firestore è un test di integrazione', () => {
    expect(livelloDelTest('tests/unit/giro.test.js', "vi.mock('firebase/firestore', () => ({}))\n")).toBe('integrazione')
    expect(livelloDelTest('tests/unit/giroInLocale.test.js')).toBe('integrazione')
    // Fuori da tests/unit la cartella dice già il vero.
    expect(livelloDelTest('tests/sistema/x.spec.js', "vi.mock('firebase/firestore')\n")).toBe('sistema')
  })

  it('e un test può dichiararlo da sé, e vince la dichiarazione', () => {
    const testo = '// @vitest-environment happy-dom\n// @livello integrazione: il codice vero\n'
    expect(livelloDelTest('tests/unit/giro.test.js', testo)).toBe('integrazione')
    // Una parola che non è un livello non cambia niente.
    expect(livelloDelTest('tests/unit/x.test.js', '// @livello importante\n')).toBe('unita')
  })

  it('ogni file di test ha un livello', () => {
    const senza = fileDiTest().filter((f) => livelloDelTest(f) === null)
    expect(senza, 'test fuori dalle cartelle dei livelli: spostarlo o dichiarare `// @livello`').toEqual([])
  })
})

describe('i bisogni del locale', () => {
  it('ce ne sono, e ognuno è scritto per intero', () => {
    expect(bisogni.length).toBeGreaterThan(5)
    for (const b of bisogni) {
      expect(b.id, 'id').toMatch(/^UR-\d{3}$/)
      expect(b.title.length, `titolo di ${b.id}`).toBeGreaterThan(5)
      expect(b.area.length, `chi lo vive, in ${b.id}`).toBeGreaterThan(3)
      expect(b.description.length, `descrizione di ${b.id}`).toBeGreaterThan(40)
      // Il criterio di accettazione si scrive INSIEME al bisogno: è il
      // piano del test che lo proverà, e a scriverlo dopo il codice si
      // finisce per descrivere quello che il codice fa.
      expect(b.accettazione.length, `come si accetta ${b.id}`).toBeGreaterThan(40)
      expect(b.requisiti.length, `${b.id} senza requisiti che lo realizzino`).toBeGreaterThan(0)
    }
  })

  it('i requisiti citati esistono, e non sono scartati', () => {
    const rotti = bisogni.flatMap((b) => b.requisiti
      .filter((id) => !perId.has(id) || perId.get(id).status === 'deprecated')
      .map((id) => `${b.id} → ${id}`))
    expect(rotti).toEqual([])
  })

  it('i loro test esistono, e sono di accettazione', () => {
    const sbagliati = bisogni.flatMap((b) => b.test_cases
      .filter((t) => !existsSync(t) || livelloDelTest(t) !== 'accettazione')
      .map((t) => `${b.id} → ${t}`))
    expect(sbagliati).toEqual([])
  })
})

describe("l'architettura", () => {
  it('ogni componente ha la sua promessa e le sue prove di integrazione', () => {
    expect(architettura.length).toBeGreaterThan(5)
    for (const a of architettura) {
      expect(a.id).toMatch(/^ARC-\d{3}$/)
      expect(a.area.length, `file di ${a.id}`).toBeGreaterThan(3)
      expect(a.description.length, `descrizione di ${a.id}`).toBeGreaterThan(40)
      expect(a.test_cases.length, `${a.id} senza prove`).toBeGreaterThan(0)
    }
    const sbagliati = architettura.flatMap((a) => a.test_cases
      .filter((t) => !existsSync(t) || livelloDelTest(t) !== 'integrazione')
      .map((t) => `${a.id} → ${t} (${livelloDelTest(t)})`))
    expect(sbagliati, 'un componente si prova messo insieme agli altri, non da solo').toEqual([])
  })

  it('gli identificativi non si ripetono fra i tre registri', () => {
    const tutti = [...bisogni, ...architettura, ...requisiti].map((v) => v.id)
    expect(tutti.length).toBe(new Set(tutti).size)
  })
})

describe('una V per richiesta', () => {
  // L'accettazione è del bisogno, non del requisito: un requisito che la
  // cita salta un gradino, e la V non si legge più.
  it('un requisito non cita test di accettazione', () => {
    const fuori = requisiti.flatMap((r) => r.test_cases
      .filter((t) => livelloDelTest(t) === 'accettazione')
      .map((t) => `${r.id} → ${t}`))
    expect(fuori, 'va nei `test_cases` del bisogno, in bisogni.yaml').toEqual([])
  })

  it('un requisito nato dopo la V è collegato a un bisogno', () => {
    const orfani = requisiti
      .filter((r) => r.status !== 'deprecated' && !natoPrimaDellaV(r.id) && !servePer.has(r.id))
      .map((r) => `${r.id} — ${r.title}`)
    expect(
      orfani,
      'Requisito senza bisogno: aggiungilo ai `requisiti` di un UR-* in ' +
        'requirements/bisogni.yaml, o scrivi il bisogno che lo chiede'
    ).toEqual([])
  })

  // Un difetto è un requisito tradito, e dire quale serve a capire quale
  // livello di test se l'era lasciato sfuggire.
  it('un difetto nato dopo la V dice quale requisito tradisce', () => {
    const muti = bug
      .filter((b) => !natoPrimaDellaV(b.id))
      .filter((b) => b.requisiti.length === 0 || b.requisiti.some((id) => !perId.has(id)))
      .map((b) => `${b.id}: requisiti = [${b.requisiti.join(', ')}]`)
    expect(muti).toEqual([])
  })

  it('le voci di prima si collegano a mano a mano, e il conto non sale', () => {
    const senza = requisiti.filter((r) => r.status !== 'deprecated' && !servePer.has(r.id))
    expect(senza.length, 'il cricchetto: se è sceso, abbassa MASSIMO_SENZA_BISOGNO').toBeLessThanOrEqual(MASSIMO_SENZA_BISOGNO)
  })

  it('quando una voce è nata, lo dice il suo numero', () => {
    expect(natoPrimaDellaV('REQ-MAG-053')).toBe(true)
    expect(natoPrimaDellaV('REQ-MAG-054')).toBe(false)
    expect(natoPrimaDellaV('REQ-SUMUP-SYNC-002')).toBe(true)
    // Un'area nata dopo è nuova tutta.
    expect(natoPrimaDellaV('REQ-NUOVA-001')).toBe(false)
    expect(natoPrimaDellaV('BUG-136')).toBe(true)
    expect(natoPrimaDellaV('BUG-137')).toBe(false)
  })
})

describe('la V di una voce, letta', () => {
  const finti = parseRequirementsYaml(`bisogni:
  - id: UR-900
    title: "Il conto giusto"
    area: "Banco"
    description: >
      Una descrizione abbastanza lunga da passare, su più righe
      come nel registro vero.
    accettazione: >
      Si batte un conto e si guarda
      il totale.
    requisiti: [REQ-POS-900]
    test_cases:
      - tests/accettazione/conto.test.js
`)
  // I percorsi qui sotto non esistono: il livello lo dice la sola cartella.

  it('il lettore porta il criterio di accettazione e i requisiti, in tutte e due le forme', () => {
    expect(finti[0].accettazione).toBe('Si batte un conto e si guarda il totale.')
    expect(finti[0].requisiti).toEqual(['REQ-POS-900'])
    const multi = parseRequirementsYaml(`x:
  - id: BUG-900
    requisiti:
      - REQ-POS-900
      - REQ-POS-901
    status: todo
`)
    expect(multi[0].requisiti).toEqual(['REQ-POS-900', 'REQ-POS-901'])
    expect(multi[0].status).toBe('todo')
  })

  it('da un requisito si risale ai bisogni che lo citano', () => {
    expect(bisogniPerRequisito(finti).get('REQ-POS-900')).toEqual([finti[0]])
    expect(bisogniPerRequisito(finti).has('REQ-POS-901')).toBe(false)
  })

  it('il colpo d’occhio conta ogni file una volta sola, al suo livello', () => {
    const req = { id: 'REQ-POS-900', status: 'implemented', test_cases: ['tests/unit/a.test.js', 'tests/component/B.test.jsx', 'tests/sistema/c.spec.js'] }
    const altro = { id: 'REQ-POS-901', status: 'implemented', test_cases: ['tests/unit/a.test.js'] }
    const s = statoDellaV({ requisiti: [req, altro], bisogni: finti, architettura: [] })
    expect(s).toMatchObject({ bisogni: 1, bisogniAccettati: 1, requisiti: 2, requisitiConBisogno: 1 })
    expect(s.test).toEqual({ accettazione: 1, sistema: 1, integrazione: 1, unita: 1 })
  })

  it('la specifica racconta i bisogni, li collega ai requisiti, e i requisiti ai bisogni', () => {
    const req = { id: 'REQ-POS-900', title: 'Il totale si compone', area: 'src/lib/x.js', description: 'Una descrizione.', status: 'implemented', test_cases: ['tests/unit/a.test.js'], labels: [] }
    const doc = costruisciSpecifica([req], { bisogni: finti, data: new Date(2026, 10, 8) })
    expect(doc).toContain('## I bisogni del locale')
    expect(doc).toContain('#### UR-900 — Il conto giusto')
    expect(doc).toContain('**Come si accetta**: Si batte un conto e si guarda il totale.')
    expect(doc).toContain('[REQ-POS-900](#req-pos-900--il-totale-si-compone)')
    expect(doc).toContain('**Serve**: [UR-900](#ur-900--il-conto-giusto)')
    expect(doc).toContain('### Le prove, livello per livello')
    // Senza bisogni il registro non è ancora nella V: niente capitolo vuoto.
    expect(costruisciSpecifica([req])).not.toContain('I bisogni del locale')
  })
})
