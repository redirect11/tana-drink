import { useState } from 'react'
import StaffHoursTab from './StaffHoursTab.jsx'
import UtentiTab from './UtentiTab.jsx'
import { isAdmin } from '../lib/ruoli.js'

// Pagina unica STAFF: raccoglie in un solo posto la gestione degli utenti
// (account/ruoli) e i turni/ore. Prima erano due voci di menu separate;
// stanno bene insieme perché turni e paghe si legano alle persone.
export default function StaffPage({ role = null }) {
  const [sub, setSub] = useState('ore') // 'ore' | 'utenti'
  return (
    <div>
      <h2>👥 Staff &amp; ore</h2>
      {/* TAB, non chip: sono due sezioni diverse, e con l'aspetto da filtro
          "Utenti" non si trovava — chi cerca dove si creano gli account
          guarda il menu, non i chip sotto un titolo. */}
      <div className="tabs">
        {[
          ['ore', '🕒 Turni & ore'],
          ['utenti', '🧑‍🤝‍🧑 Utenti e ruoli'],
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
          : isAdmin(role)
            ? 'Account, ruoli e clienti registrati: da qui si nomina chi fa cosa.'
            : 'Elenco del personale. I ruoli li assegna l’admin.'}
      </p>
      {sub === 'ore' && <StaffHoursTab embedded />}
      {sub === 'utenti' && <UtentiTab role={role} />}
    </div>
  )
}
