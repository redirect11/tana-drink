import { useState } from 'react'
import StaffHoursTab from './StaffHoursTab.jsx'
import StaffTab from './StaffTab.jsx'

// Pagina unica STAFF: raccoglie in un solo posto la gestione dei membri
// (account/ruoli) e i loro turni/ore. Prima erano due voci di menu separate;
// stanno bene insieme perché turni e paghe si legano ai membri.
export default function StaffPage() {
  const [sub, setSub] = useState('ore') // 'ore' | 'membri'
  return (
    <div>
      <h2>👥 Staff &amp; ore</h2>
      {/* TAB, non chip: sono due sezioni diverse, e con l'aspetto da filtro
          "Membri" non si trovava — chi cerca dove si creano gli account
          guarda il menu, non i chip sotto un titolo. */}
      <div className="tabs">
        {[
          ['ore', '🕒 Turni & ore'],
          ['membri', '🧑‍🤝‍🧑 Membri e ruoli'],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`tab${sub === k ? ' active' : ''}`}
            onClick={() => setSub(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>
        {sub === 'ore'
          ? 'Turni, ore lavorate e paghe.'
          : 'Qui si creano gli account dello staff e si cambiano i ruoli.'}
      </p>
      {sub === 'ore' && <StaffHoursTab embedded />}
      {sub === 'membri' && <StaffTab />}
    </div>
  )
}
