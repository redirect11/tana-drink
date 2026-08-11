/* global __GIT_BRANCH__, __GIT_COMMIT__, __BUILD_ID__ */

// QUALE VERSIONE STIAMO GUARDANDO. Con più branch che finiscono a turno
// sullo stesso ambiente di test, "l'ho provato e non andava" non vuol dire
// niente se non si sa cosa era pubblicato in quel momento. Qui c'è: ramo e
// commit, quelli veri del deploy.
//
// Toccandolo copia la riga intera: quando si segnala un problema si
// incolla e basta, senza trascriverla a mano da uno schermo.
import { useState } from 'react'

const BRANCH = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : ''
const COMMIT = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : ''
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : ''

const versione = [BRANCH, COMMIT].filter(Boolean).join(' · ')

export default function VersionBadge({ className = '' }) {
  const [copiato, setCopiato] = useState(false)
  // Build senza git (container spoglio): meglio niente che una bugia.
  if (!versione) return null

  const copia = () => {
    navigator.clipboard
      ?.writeText(`${versione} (build ${BUILD})`)
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
      {copiato ? '✓ copiato' : versione}
    </button>
  )
}
