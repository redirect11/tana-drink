import { useEffect, useMemo, useState } from 'react'
import { addStaffHours, deleteStaffHours, subscribeStaffHours } from '../lib/api.js'
import { listStaff } from '../lib/staffApi.js'
import { computeHours, monthlyTotals } from '../lib/ore.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// RAPP ORE: registro ore dello staff (replica del foglio Excel storico).
// Turni per persona con entrata/uscita/pausa — anche oltre la mezzanotte —
// e totali del mese per persona.

const oggi = () => new Date().toISOString().slice(0, 10)
const meseCorrente = () => oggi().slice(0, 7)

function meseLabel(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}

function shiftMese(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function StaffHoursTab() {
  const [month, setMonth] = useState(meseCorrente)
  const [entries, setEntries] = useState([])
  const [staff, setStaff] = useState([])
  const [error, setError] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  // Form nuovo turno
  const [name, setName] = useState('')
  const [date, setDate] = useState(oggi)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [breakMin, setBreakMin] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => subscribeStaffHours(month, setEntries, (e) => setError(e.message)), [month])
  useEffect(() => {
    listStaff()
      .then((users) => setStaff(users || []))
      .catch(() => setStaff([]))
  }, [])

  const hours = computeHours(start, end, Number(breakMin) || 0)
  const totals = useMemo(() => monthlyTotals(entries), [entries])
  // Nomi noti: staff registrato + chi è già a registro (per il datalist).
  const nomi = useMemo(() => {
    const set = new Set(staff.map((u) => u.name || u.email).filter(Boolean))
    for (const e of entries) set.add(e.staff_name)
    return [...set].sort()
  }, [staff, entries])

  function salva(e) {
    e.preventDefault()
    if (!name.trim() || hours == null) return
    // Ottimistico: il registro si aggiorna dallo snapshot; il form si svuota subito.
    addStaffHours({
      staff_name: name.trim(),
      date,
      start,
      end,
      break_minutes: Number(breakMin) || 0,
      hours,
      note: note.trim() || null,
    }).catch((err) => setError(err.message))
    setStart('')
    setEnd('')
    setBreakMin('')
    setNote('')
  }

  return (
    <div>
      <h2>🕒 Ore staff</h2>
      {error && <div className="banner">Errore: {error}</div>}

      {/* Selettore mese */}
      <div className="row between" style={{ alignItems: 'center', marginBottom: 8 }}>
        <button className="btn ghost small" onClick={() => setMonth((m) => shiftMese(m, -1))}>←</button>
        <strong style={{ textTransform: 'capitalize' }}>{meseLabel(month)}</strong>
        <button className="btn ghost small" onClick={() => setMonth((m) => shiftMese(m, 1))}>→</button>
      </div>

      {/* Nuovo turno */}
      <form className="card" onSubmit={salva}>
        <strong>Nuovo turno</strong>
        <div className="grid-2" style={{ marginTop: 8 }}>
          <div>
            <label htmlFor="ore-nome">Chi *</label>
            <input
              id="ore-nome"
              list="ore-nomi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
              required
            />
            <datalist id="ore-nomi">
              {nomi.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="ore-data">Giorno</label>
            <input id="ore-data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <div className="grow">
            <label htmlFor="ore-in">Entrata *</label>
            <input id="ore-in" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div className="grow">
            <label htmlFor="ore-out">Uscita *</label>
            <input id="ore-out" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
          <div style={{ width: 90 }}>
            <label htmlFor="ore-pausa">Pausa (min)</label>
            <input
              id="ore-pausa"
              type="number"
              min="0"
              step="5"
              value={breakMin}
              onChange={(e) => setBreakMin(e.target.value)}
            />
          </div>
        </div>
        <label htmlFor="ore-note" style={{ marginTop: 6, display: 'block' }}>Note</label>
        <input id="ore-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. serata evento" />
        <button className="btn block" type="submit" style={{ marginTop: 10 }} disabled={!name.trim() || hours == null}>
          Aggiungi{hours != null ? ` · ${hours} h` : ''}
          {start && end && computeHours(start, end) != null && end < start ? ' (oltre mezzanotte)' : ''}
        </button>
      </form>

      {/* Totali del mese per persona */}
      <div className="card" style={{ marginTop: 10 }}>
        <div className="row between">
          <strong>Totali {meseLabel(month)}</strong>
          <strong>{totals.total} h</strong>
        </div>
        {totals.people.length === 0 && (
          <p className="muted small" style={{ margin: '6px 0 0' }}>Nessun turno registrato questo mese.</p>
        )}
        {totals.people.map((p) => (
          <div className="row between" key={p.name} style={{ marginTop: 4 }}>
            <span>
              {p.name} <span className="muted small">· {p.turni} turni</span>
            </span>
            <strong>{p.hours} h</strong>
          </div>
        ))}
      </div>

      {/* Registro turni del mese */}
      {entries.length > 0 && (
        <div className="card" style={{ marginTop: 10 }}>
          <strong>Turni</strong>
          {entries.map((e) => (
            <div className="row between" key={e.id} style={{ alignItems: 'center', marginTop: 6 }}>
              <span className="grow" style={{ fontSize: '0.9rem' }}>
                {e.date?.slice(8, 10)}/{e.date?.slice(5, 7)} · <strong>{e.staff_name}</strong>{' '}
                <span className="muted small">
                  {e.start}–{e.end}
                  {e.break_minutes > 0 ? ` (pausa ${e.break_minutes}′)` : ''}
                  {e.note ? ` · ${e.note}` : ''}
                </span>
              </span>
              <span className="row" style={{ gap: 6, alignItems: 'center' }}>
                <strong>{e.hours} h</strong>
                <button className="btn ghost small" aria-label={`Elimina turno ${e.staff_name}`} onClick={() => setConfirmDel(e)}>🗑</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          title="🗑 Eliminare il turno?"
          message={`${confirmDel.staff_name} · ${confirmDel.date} · ${confirmDel.start}–${confirmDel.end} (${confirmDel.hours} h)`}
          confirmLabel="Elimina"
          danger
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            const e = confirmDel
            setConfirmDel(null)
            deleteStaffHours(e.id).catch((err) => setError(err.message))
          }}
        />
      )}
    </div>
  )
}
