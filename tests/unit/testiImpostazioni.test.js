// I TESTI DELLE IMPOSTAZIONI NON DANNO DEL TU (REQ-UI-037).
//
// Daniele, 17/11/2026: «puoi semplicemente spiegare che cosa fa un'opzione
// invece di scrivere cose inutili». Il ripasso ha trovato descrizioni col
// «tu» e col «voi» («lo scegli tu», «se da voi un tavolo = un conto»,
// «il prossimo lo apri tu», «copiali e allegali»), che nel gestionale non
// vanno: lo legge chi lavora, nel registro del mestiere e impersonale
// (CLAUDE.md, DESIGN.md guardrail 3). Erano entrate una alla volta, ognuna
// scritta da chi in quel momento raccontava un caso al banco.
//
// La prova legge i sorgenti dei pannelli delle impostazioni senza i
// commenti — il perché e i casi visti stanno lì, ed è giusto che parlino
// come vogliono — e cerca le forme della seconda persona.
//
// Gli IMPERATIVI («apri», «scegli», «accetta») restano fuori: sono anche
// il verbo di un tasto («Apri il marketplace») e il nome di una funzione
// (`scegli`), e qui la prova vedrebbe solo quelli. I pronomi e
// l'indicativo («tu», «ti», «hai», «puoi», «vedi») su un tasto non ci
// stanno, e nel codice non sono nomi: quelli li vede pulito. Gli
// imperativi delle descrizioni li ha tolti a mano il ripasso.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const PANNELLI = [
  'src/components/SettingsTab.jsx',
  'src/components/StampaAutomatica.jsx',
  'src/components/CampiStampa.jsx',
  'src/components/PrinterSetup.jsx',
  'src/components/BackupPanel.jsx',
  'src/components/InfoTab.jsx',
  'src/components/ThemeSettings.jsx',
  'src/components/IdentitaLocale.jsx',
  'src/components/FormatoPrezziMenu.jsx',
  'src/components/LicenzaPanel.jsx',
  'src/components/CreditoAI.jsx',
  'src/lib/campiStampa.js',
  'src/lib/strisce.js',
]

const SECONDA_PERSONA =
  /\b(tu|tuo|tua|tuoi|tue|hai|vuoi|puoi|devi|sai|voi|vostro|vostra|vostri|vostre|seguite|crei|vedi|trovi|metti|tocchi|ti|te|riaccendi|accendila|spegnila|inseriscilo|copiali|allegali|fallo|potrai|dovrai)\b/i

// Due righe che restano come sono, e il motivo:
// - `valore:` è il testo predefinito che si STAMPA sulla carta, scelto e
//   cambiabile dal locale («Il tuo menu»), non una descrizione;
// - `confirmLabel=` è un tasto, e un tasto dice il suo verbo («Spegni»).
const ESENTI = /\b(valore:|confirmLabel=)/

// Un commento comincia a inizio riga, dopo una graffa o dopo uno spazio:
// così un «/*» dentro una stringa (accept="image/*") non apre un commento
// finto che si mangerebbe tutto il codice fino al prossimo «*/», e
// «https://» non conta come commento di riga.
function senzaCommenti(sorgente) {
  return sorgente
    .replace(/(^|[{\s])\/\*[\s\S]*?\*\/\s*\}?/gm, '$1')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
}

describe('i testi delle impostazioni sono impersonali (REQ-UI-037)', () => {
  it.each(PANNELLI)('%s non dà del tu né del voi', (file) => {
    const testo = senzaCommenti(fs.readFileSync(path.resolve(file), 'utf8'))
    const trovate = testo
      .split(/\r?\n/)
      .filter((riga) => !ESENTI.test(riga))
      .map((riga) => riga.match(SECONDA_PERSONA)?.[0] && `«${riga.match(SECONDA_PERSONA)[0]}»: ${riga.trim()}`)
      .filter(Boolean)
    expect(trovate).toEqual([])
  })

  it('la prova se ne accorge davvero', () => {
    // Le frasi che c'erano prima del ripasso.
    for (const frase of [
      'Tutto il resto lo scegli tu.',
      'Se da voi un tavolo = un conto NON servono',
      'il prossimo lo apri tu quando vuoi',
      'copiali e allegali alla segnalazione',
      'Serve se al bancone seguite la lavorazione dei drink',
      'se ti serve, il link è qui',
    ]) {
      expect(frase).toMatch(SECONDA_PERSONA)
    }
  })

  it('un «/*» dentro una stringa non nasconde il codice che segue', () => {
    const sorgente = [
      '<input accept="image/*" />',
      '<p>Lo scegli tu.</p>',
      '{/* un commento vero */}',
    ].join('\n')
    expect(senzaCommenti(sorgente)).toContain('Lo scegli tu.')
    expect(senzaCommenti(sorgente)).not.toContain('un commento vero')
  })
})
