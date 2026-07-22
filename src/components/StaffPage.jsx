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
      <div className="chips-row" style={{ marginBottom: 10 }}>
        {[
          ['ore', '🕒 Turni & ore'],
          ['membri', '🧑‍🤝‍🧑 Membri'],
        ].map(([k, label]) => (
          <button key={k} className={`chip ${sub === k ? 'active' : ''}`} onClick={() => setSub(k)}>
            {label}
          </button>
        ))}
      </div>
      {sub === 'ore' && <StaffHoursTab embedded />}
      {sub === 'membri' && <StaffTab />}
    </div>
  )
}
