/* global __GIT_BRANCH__, __GIT_COMMIT__, __BUILD_ID__, __APP_VERSION__ */

// QUALE VERSIONE STIAMO GUARDANDO. In produzione: il numero di versione,
// e basta. Fuori: versione, ramo e commit, perché sullo stesso indirizzo
// di test passano a turno develop e i branch in lavorazione, e "l'ho
// provato e non andava" non vuol dire niente senza sapere cosa c'era.
//
// Toccandolo copia la riga intera: quando si segnala un problema si
// incolla e basta, senza trascriverla a mano da uno schermo.
import { useState } from 'react'
import { etichettaVersione } from '../lib/versione.js'

const BRANCH = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : ''
const COMMIT = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : ''
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : ''
const VERSIONE = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''

const etichetta = etichettaVersione({ branch: BRANCH, commit: COMMIT, versione: VERSIONE })

export default function VersionBadge({ className = '' }) {
  const [copiato, setCopiato] = useState(false)
  // Build senza git (container spoglio): meglio niente che una bugia.
  if (!etichetta) return null

  const copia = () => {
    navigator.clipboard
      ?.writeText(`${etichetta} (build ${BUILD})`)
      .then(() => {
        setCopiato(true)
        setTimeout(() => setCopiato(false), 1500)
      })
      .catch(() => {
        /* niente appunti (contesto non sicuro): pazienza, si legge */
      })
  }

  return (
    <button
      type="button"
      className={`version-badge ${className}`.trim()}
      onClick={copia}
      title={`Versione pubblicata · build ${BUILD}\nTocca per copiare`}
    >
      {copiato ? '✓ copiato' : etichetta}
    </button>
  )
}
