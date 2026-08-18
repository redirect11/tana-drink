// Lettura di requirements/requirements.yaml.
//
// Sta in un modulo suo perché lo usano in due: lo script che apre le issue
// su GitHub e il test che tiene insieme requisiti e prove — senza quel
// test l'elenco dei requisiti si stacca dalla realtà in una settimana.
//
// Legge solo il sottoinsieme di YAML che usiamo davvero: niente
// dipendenze, e il formato del file resta semplice apposta.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Minimal YAML parser ───────────────────────────────────────────────────────
// Parses only the subset of YAML used in requirements.yaml.
// For a production system, replace with `js-yaml` (npm install js-yaml).

export function parseRequirementsYaml(text) {
  const lines = text.split('\n')
  const requirements = []
  let current = null
  let inDescription = false
  let descriptionLines = []
  let inTestCases = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trimEnd()

    // Skip comments and empty lines outside of description blocks
    if (!inDescription && (line.startsWith('#') || line.trim() === '')) continue

    // Start of a new requirement entry
    if (line.match(/^  - id:/)) {
      if (current) {
        if (inDescription) {
          current.description = descriptionLines.join(' ').trim()
          inDescription = false
          descriptionLines = []
        }
        requirements.push(current)
      }
      inTestCases = false
      current = { id: '', title: '', area: '', description: '', status: 'todo', generate_issue: false, labels: [], test_cases: [], in_produzione: null, severity: null, priority: null }
      current.id = line.replace(/^  - id:\s*/, '').trim()
      continue
    }

    if (!current) continue

    // Finish multi-line description if we hit a non-indented field
    if (inDescription) {
      // Le righe di continuazione del blocco '>' sono indentate più in profondità
      // della chiave (almeno 6 spazi). Qualsiasi altra cosa chiude la descrizione.
      if (line.match(/^\s{6,}\S/)) {
        descriptionLines.push(line.trim())
        continue
      } else {
        if (descriptionLines.length > 0) {
          current.description = descriptionLines.join(' ').trim()
        }
        inDescription = false
        descriptionLines = []
      }
    }

    // ELENCO DEI TEST SU PIÙ RIGHE. In YAML una lista si scrive anche
    // così, e con quattro file citati è l'unico modo leggibile:
    //   test_cases:
    //     - tests/unit/x.test.js
    // Prima si leggeva solo la forma [a, b]: le righe col trattino non
    // davano errore, sparivano — e il requisito risultava senza prove
    // pur avendole scritte lì sotto.
    if (inTestCases) {
      const voce = line.match(/^\s+- (.+)/)
      if (voce) {
        current.test_cases.push(voce[1].trim())
        continue
      }
      inTestCases = false
    }

    const fieldMatch = line.match(/^    ([a-z_]+):[ ]?(.*)/)
    if (!fieldMatch) continue
    const [, key, value] = fieldMatch

    switch (key) {
      case 'title':
        current.title = value.replace(/^["']|["']$/g, '')
        break
      case 'area':
        current.area = value.replace(/^["']|["']$/g, '')
        break
      case 'description':
        if (value.trim() === '>') {
          inDescription = true
          descriptionLines = []
        } else {
          current.description = value.replace(/^["']|["']$/g, '')
        }
        break
      case 'status':
        current.status = value.trim()
        break
      case 'generate_issue':
        current.generate_issue = value.trim() === 'true'
        break
      // Solo per i bug: dice se succede sull'installazione che sta
      // lavorando. Assente = non si sa, e l'issue non dichiara niente
      // invece di dare per scontato che sia roba di test.
      // QUANTO FA MALE, e QUANDO lo sistemiamo. Due cose diverse: la
      // severity e' una proprieta' del guaio (la misura chi lo vede al
      // banco), la priority e' una decisione nostra. Un difetto grave puo'
      // stare in P2, e uno lieve in P0 se lo vedono tutti i clienti.
      case 'severity':
        current.severity = value.trim() || null
        break
      case 'priority':
        current.priority = value.trim() || null
        break
      case 'in_produzione':
        current.in_produzione = value.trim() === 'true'
        break
      case 'labels': {
        const labelsMatch = value.match(/\[([^\]]*)\]/)
        if (labelsMatch) {
          current.labels = labelsMatch[1].split(',').map((l) => l.trim()).filter(Boolean)
        }
        break
      }
      case 'test_cases': {
        const tcMatch = value.match(/\[([^\]]*)\]/)
        if (tcMatch) {
          current.test_cases = tcMatch[1].split(',').map((t) => t.trim()).filter(Boolean)
        } else if (value.trim() === '') {
          current.test_cases = []
          inTestCases = true
        }
        break
      }
    }
  }

  if (current) {
    if (inDescription) current.description = descriptionLines.join(' ').trim()
    requirements.push(current)
  }

  return requirements
}


// Percorso del file dei requisiti (dalla radice del progetto).
export const FILE_REQUISITI = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'requirements',
  'requirements.yaml'
)

export function caricaRequisiti(file = FILE_REQUISITI) {
  return parseRequirementsYaml(readFileSync(file, 'utf8'))
}

// DAL REGISTRO ALLE ETICHETTE. severity e priority stanno nei loro campi —
// il registro e' la fonte — e da li' scendono sull'issue come etichette, che
// e' l'unico posto dove GitHub sa filtrarle. Scriverle anche a mano in
// `labels` vorrebbe dire tenerle allineate in due posti, cioe' non tenerle
// allineate.
export function etichetteClassificazione(req) {
  const e = []
  if (req.priority) e.push(req.priority)
  if (req.severity) e.push(`severity-${req.severity}`)
  return e
}
