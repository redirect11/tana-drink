import { useEffect, useMemo, useState } from 'react'
import { addStaffHours, deleteStaffHours, subscribeStaffHoursRange } from '../lib/api.js'
import { listStaff } from '../lib/staffApi.js'
import {
  computeHours,
  monthlyTotals,
  byDay,
  sumHours,
  monthGrid,
  weekDays,
  shiftDay,
} from '../lib/ore.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// RAPP ORE: registro ore dello staff con vista calendario giornaliera,
// settimanale e mensile (replica ed evoluzione del foglio Excel storico).

const oggi = () => new Date().toISOString().slice(0, 10)
const DOW = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

const mesLabel = (dateStr) => {
  const [y, m] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}
const giornoLabel = (dateStr) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

export default function StaffHoursTab() {
  const [mode, setMode] = useState('mese') // 'giorno' | 'settimana' | 'mese'
  const [cursor, setCursor] = useState(oggi) // data di riferimento
  const [entries, setEntries] = useState([])
  const [staff, setStaff] = useState([])
  const [error, setError] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [dayDetail, setDayDetail] = useState(null) // giorno aperto dal calendario mensile

  // Form nuovo turno
  const [name, setName] = useState('')
  const [date, setDate] = useState(oggi)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [breakMin, setBreakMin] = useState('')
  const [note, setNote] = useState('')

  // Intervallo di date da caricare secondo la vista.
  const range = useMemo(() => {
    if (mode === 'giorno') return [cursor, cursor]
    if (mode === 'settimana') {
      const w = weekDays(cursor)
      return [w[0], w[6]]
    }
    const grid = monthGrid(cursor.slice(0, 7))
    return [grid[0].date, grid[41].date]
  }, [mode, cursor])

  useEffect(
    () => subscribeStaffHoursRange(range[0], range[1], setEntries, (e) => setError(e.message)),
    [range]
  )
  useEffect(() => {
    listStaff()
      .then((users) => setStaff(users || []))
      .catch(() => setStaff([]))
  }, [])

  const hours = computeHours(start, end, Number(breakMin) || 0)
  const days = useMemo(() => byDay(entries), [entries])
  const totals = useMemo(() => monthlyTotals(entries), [entries])
  const nomi = useMemo(() => {
    const set = new Set(staff.map((u) => u.name || u.email).filter(Boolean))
    for (const e of entries) set.add(e.staff_name)
    return [...set].sort()
  }, [staff, entries])

  function salva(e) {
    e.preventDefault()
    if (!name.trim() || hours == null) return
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

  // Etichetta del periodo + navigazione avanti/indietro.
  const periodo =
    mode === 'giorno'
      ? giornoLabel(cursor)
      : mode === 'settimana'
        ? `${weekDays(cursor)[0].slice(8)}–${weekDays(cursor)[6].slice(8)} ${mesLabel(cursor)}`
        : mesLabel(cursor)
  const nav = (dir) => {
    if (mode === 'giorno') setCursor((c) => shiftDay(c, dir))
    else if (mode === 'settimana') setCursor((c) => shiftDay(c, dir * 7))
    else {
      const [y, m] = cursor.split('-').map(Number)
      const d = new Date(y, m - 1 + dir, 1)
      setCursor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
    }
  }

  return (
    <div>
      <h2>🕒 Ore staff</h2>
      {error && <div className="banner">Errore: {error}</div>}

      {/* Vista: giorno / settimana / mese */}
      <div className="chips-row" style={{ marginBottom: 8 }}>
        {[
          ['giorno', 'Giorno'],
          ['settimana', 'Settimana'],
          ['mese', 'Mese'],
        ].map(([k, label]) => (
          <button key={k} className={`chip ${mode === k ? 'active' : ''}`} onClick={() => setMode(k)}>
            {label}
          </button>
        ))}
      </div>

      {/* Navigazione periodo */}
      <div className="row between" style={{ alignItems: 'center', marginBottom: 8 }}>
        <button className="btn ghost small" onClick={() => nav(-1)}>←</button>
        <strong style={{ textTransform: 'capitalize', textAlign: 'center' }}>{periodo}</strong>
        <button className="btn ghost small" onClick={() => nav(1)}>→</button>
      </div>

      {mode === 'mese' && <MonthCalendar cursor={cursor} days={days} onPick={setDayDetail} />}
      {mode === 'settimana' && (
        <WeekView dates={weekDays(cursor)} days={days} onDelete={setConfirmDel} />
      )}
      {mode === 'giorno' && (
        <DayView date={cursor} data={days.get(cursor)} onDelete={setConfirmDel} />
      )}

      {/* Totali del periodo per persona */}
      <div className="card" style={{ marginTop: 10 }}>
        <div className="row between">
          <strong>Totale periodo</strong>
          <strong>{totals.total} h</strong>
        </div>
        {totals.people.length === 0 && (
          <p className="muted small" style={{ margin: '6px 0 0' }}>Nessun turno nel periodo.</p>
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

      {/* Nuovo turno */}
      <form className="card" onSubmit={salva} style={{ marginTop: 10 }}>
        <strong>Nuovo turno</strong>
        <div className="grid-2" style={{ marginTop: 8 }}>
          <div>
            <label htmlFor="ore-nome">Chi *</label>
            <input id="ore-nome" list="ore-nomi" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required />
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
            <input id="ore-pausa" type="number" min="0" step="5" value={breakMin} onChange={(e) => setBreakMin(e.target.value)} />
          </div>
        </div>
        <label htmlFor="ore-note" style={{ marginTop: 6, display: 'block' }}>Note</label>
        <input id="ore-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. serata evento" />
        <button className="btn block" type="submit" style={{ marginTop: 10 }} disabled={!name.trim() || hours == null}>
          Aggiungi{hours != null ? ` · ${hours} h` : ''}
          {start && end && end < start ? ' (oltre mezzanotte)' : ''}
        </button>
      </form>

      {/* Dettaglio giorno (dal calendario mensile) */}
      {dayDetail && (
        <div className="overlay confirm-overlay" onClick={() => setDayDetail(null)}>
          <div className="confirm-box" style={{ width: 'min(420px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{giornoLabel(dayDetail)}</h3>
              <button className="btn ghost small" onClick={() => setDayDetail(null)}>✕</button>
            </div>
            <DayView date={dayDetail} data={days.get(dayDetail)} onDelete={setConfirmDel} />
          </div>
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          title="🗑 Eliminare il turno?"
          message={`${confirmDel.staff_name} · ${confirmDel.date} · ${confirmDel.hours} h`}
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

// ── Calendario mensile: griglia 7×6, ore totali per giorno ──
function MonthCalendar({ cursor, days, onPick }) {
  const grid = monthGrid(cursor.slice(0, 7))
  const today = oggi()
  return (
    <div className="ore-cal">
      {DOW.map((d) => (
        <div key={d} className="ore-cal-dow">{d}</div>
      ))}
      {grid.map((cell) => {
        const info = days.get(cell.date)
        return (
          <button
            key={cell.date}
            className={`ore-cal-cell${cell.inMonth ? '' : ' out'}${cell.date === today ? ' today' : ''}${info ? ' has' : ''}`}
            onClick={() => info && onPick(cell.date)}
            disabled={!info}
          >
            <span className="ore-cal-day">{Number(cell.date.slice(8))}</span>
            {info && (
              <>
                <span className="ore-cal-h">{info.total} h</span>
                <span className="ore-cal-n">{info.entries.length}👤</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Vista settimana: 7 giorni con i turni sotto ──
function WeekView({ dates, days, onDelete }) {
  return (
    <div className="ore-week">
      {dates.map((d) => {
        const info = days.get(d)
        return (
          <div key={d} className="card" style={{ padding: 10 }}>
            <div className="row between">
              <strong style={{ textTransform: 'capitalize' }}>
                {new Date(`${d}T00:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}
              </strong>
              {info && <strong>{info.total} h</strong>}
            </div>
            {!info && <span className="muted small">—</span>}
            {(info?.entries || []).map((e) => (
              <ShiftRow key={e.id} e={e} onDelete={onDelete} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Vista giorno: elenco turni ──
function DayView({ data, onDelete }) {
  if (!data) return <p className="muted small" style={{ marginTop: 8 }}>Nessun turno in questo giorno.</p>
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row between">
        <strong>{data.entries.length} turni</strong>
        <strong>{sumHours(data.entries)} h</strong>
      </div>
      {data.entries.map((e) => (
        <ShiftRow key={e.id} e={e} onDelete={onDelete} />
      ))}
    </div>
  )
}

function ShiftRow({ e, onDelete }) {
  return (
    <div className="row between" style={{ alignItems: 'center', marginTop: 6 }}>
      <span className="grow" style={{ fontSize: '0.9rem' }}>
        <strong>{e.staff_name}</strong>{' '}
        <span className="muted small">
          {e.start && e.end ? `${e.start}–${e.end}` : 'ore'}
          {e.break_minutes > 0 ? ` (pausa ${e.break_minutes}′)` : ''}
          {e.note ? ` · ${e.note}` : ''}
        </span>
      </span>
      <span className="row" style={{ gap: 6, alignItems: 'center' }}>
        <strong>{e.hours} h</strong>
        <button className="btn ghost small" aria-label={`Elimina turno ${e.staff_name}`} onClick={() => onDelete(e)}>🗑</button>
      </span>
    </div>
  )
}
