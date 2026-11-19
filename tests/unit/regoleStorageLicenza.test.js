// LO STORAGE E FIRESTORE LEGGONO LA LICENZA ALLO STESSO MODO (REQ-SIC-006).
//
// Le regole non si importano da un file all'altro: storage.rules ha una
// copia delle funzioni sulla licenza di firestore.rules (licenzaScritta,
// licenza, scaduta, alFree, licenzaValida, modulo). Il commento diceva «se
// cambia là, cambia qui»; questa prova lo fa rispettare, senza bisogno degli
// emulatori: le due copie, tolto il modo di chiamare Firestore, sono uguali.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const FUNZIONI = ['licenzaScritta', 'licenza', 'scaduta', 'alFree', 'licenzaValida', 'modulo']

// Il corpo di una funzione delle regole, senza commenti e spazi, e col modo
// di raggiungere Firestore reso uguale nei due file.
function corpo(testo, nome) {
  const pulito = testo.replace(/\/\/[^\n]*/g, '')
  const inizio = pulito.search(new RegExp(`function ${nome}\\(`))
  if (inizio < 0) return null
  let i = pulito.indexOf('{', inizio)
  let profondo = 0
  let fine = i
  for (; fine < pulito.length; fine++) {
    if (pulito[fine] === '{') profondo++
    if (pulito[fine] === '}' && --profondo === 0) break
  }
  return pulito
    .slice(i, fine + 1)
    .replace(/firestore\.(get|exists)/g, '$1')
    .replace(/\/databases\/\$\(database\)\//g, '/databases/(default)/')
    .replace(/\s+/g, '')
}

describe('le funzioni sulla licenza, nelle due regole', () => {
  const storage = readFileSync('storage.rules', 'utf8')
  const firestore = readFileSync('firestore.rules', 'utf8')

  it.each(FUNZIONI)('%s è la stessa in storage.rules e in firestore.rules', (nome) => {
    const s = corpo(storage, nome)
    expect(s, `${nome} manca in storage.rules`).not.toBeNull()
    expect(s).toBe(corpo(firestore, nome))
  })
})
