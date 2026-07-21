import { useEffect, useMemo, useState } from 'react'
import {
  addStaffHours,
  deleteStaffHours,
  subscribeStaffHoursRange,
  subscribeStaffShiftsRange,
  updateStaffShift,
  deleteStaffShift,
  subscribeStaffRates,
  saveStaffRates,
} from '../lib/api.js'
import { payrollReport, rateAt, upsertRate, removeRate, sortRates } from '../lib/paghe.js'
import { formatPrice } from '../lib/orderStatus.js'
import { listStaff } from '../lib/staffApi.js'
import {
  computeHours,
  byDay,
  monthGrid,
  weekDays,
  shiftDay,
  hhmm,
  effVsPlanned,
} from '../lib/ore.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// RAPP ORE + BADGE VIRTUALE: registro ore dello staff con vista calendario
// giornaliera, settimanale e mensile. Distingue le ore EFFETTIVE (badge:
// timbrature entrata/uscita al login/logout, o correzioni manuali) dalle
// ore PROGRAMMATE (turni pianificati), e mostra il confronto.

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

// ISO ↔ valore di <input type="datetime-local"> (ora locale).
const isoToLocalInput = (iso) => {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const localInputToIso = (s) => {
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

// Normalizza ore manuali (staff_hours) e timbrature (staff_shifts) in una
// forma unica per le viste: { source, kind, date, staff_name, hours, open,
// label, note }.
function normalizeEntries(hoursRows, shiftRows) {
  const out = []
  for (const e of hoursRows || []) {
    out.push({
      ...e,
      source: 'hours',
      kind: e.kind === 'programmato' ? 'programmato' : 'effettivo',
      open: false,
      label:
        e.start && e.end
          ? `${e.start}–${e.end}${e.break_minutes > 0 ? ` (pausa ${e.break_minutes}′)` : ''}`
          : 'ore',
      note: e.note || '',
    })
  }
  for (const s of shiftRows || []) {
    out.push({
      ...s,
      source: 'shift',
      kind: 'effettivo',
      open: !!s.open,
      hours: Number(s.hours) || 0,
      label: s.open
        ? `${hhmm(s.clock_in)} · in corso`
        : `${hhmm(s.clock_in)}–${hhmm(s.clock_out)}`,
      note: s.note || 'timbratura',
    })
  }
  return out
}

export default function StaffHoursTab() {
  const [mode, setMode] = useState('mese') // 'giorno' | 'settimana' | 'mese'
  const [cursor, setCursor] = useState(oggi) // data di riferimento
  const [hoursRows, setHoursRows] = useState([])
  const [shiftRows, setShiftRows] = useState([])
  const [staff, setStaff] = useState([])
  const [error, setError] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [dayDetail, setDayDetail] = useState(null) // giorno aperto dal calendario mensile
  const [editShift, setEditShift] = useState(null) // timbratura in correzione
  const [rates, setRates] = useState([]) // tariffe orarie per persona
  const [showPaghe, setShowPaghe] = useState(false)

  // Form nuovo turno
  const [kind, setKind] = useState('effettivo') // 'effettivo' | 'programmato'
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
    () => subscribeStaffHoursRange(range[0], range[1], setHoursRows, (e) => setError(e.message)),
    [range]
  )
  useEffect(
    () => subscribeStaffShiftsRange(range[0], range[1], setShiftRows, (e) => setError(e.message)),
    [range]
  )
  useEffect(() => subscribeStaffRates(setRates, () => setRates([])), [])
  useEffect(() => {
    listStaff()
      .then((users) => setStaff(users || []))
      .catch(() => setStaff([]))
  }, [])

  const hours = computeHours(start, end, Number(breakMin) || 0)
  const entries = useMemo(() => normalizeEntries(hoursRows, shiftRows), [hoursRows, shiftRows])
  const days = useMemo(() => byDay(entries), [entries])
  const totals = useMemo(() => effVsPlanned(entries), [entries])
  const perPerson = useMemo(() => peopleTotals(entries), [entries])
  // Costo del personale nel periodo: solo ore EFFETTIVE, ciascuna alla
  // tariffa in vigore nel giorno in cui è stata lavorata.
  const ratesByName = useMemo(
    () => Object.fromEntries(rates.map((r) => [r.name, r.rates || []])),
    [rates]
  )
  const payroll = useMemo(() => payrollReport(entries, ratesByName), [entries, ratesByName])

  const nomi = useMemo(() => {
    const set = new Set(staff.map((u) => u.name || u.email).filter(Boolean))
    for (const e of entries) set.add(e.staff_name)
    return [...set].filter(Boolean).sort()
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
      kind,
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

  const rowActions = { onDelete: setConfirmDel, onEditShift: setEditShift }

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
        <WeekView dates={weekDays(cursor)} days={days} {...rowActions} />
      )}
      {mode === 'giorno' && (
        <DayView date={cursor} data={days.get(cursor)} {...rowActions} />
      )}

      {/* Totali del periodo: effettivo vs programmato */}
      <div className="card" style={{ marginTop: 10 }}>
        <div className="row between">
          <strong>Totale periodo</strong>
          <span className="row" style={{ gap: 10 }}>
            <span title="Ore effettive (timbrature + correzioni)">
              ✅ <strong>{totals.effettivo} h</strong>
            </span>
            <span className="muted" title="Ore programmate (turni pianificati)">
              📅 {totals.programmato} h
            </span>
          </span>
        </div>
        {totals.programmato > 0 && (
          <div className="row between" style={{ marginTop: 4 }}>
            <span className="muted small">Scarto effettivo − programmato</span>
            <strong className={totals.scarto < 0 ? 'neg' : ''}>
              {totals.scarto > 0 ? '+' : ''}
              {totals.scarto} h
            </strong>
          </div>
        )}
        <div className="row between" style={{ marginTop: 6, borderTop: '1px dashed var(--line)', paddingTop: 6 }}>
          <span className="muted small">Costo del personale (ore effettive)</span>
          <strong>{formatPrice(payroll.totale)}</strong>
        </div>
        {payroll.parziale && (
          <div className="muted small">
            ⚠️ Parziale: manca la tariffa oraria di {payroll.senzaTariffa.join(', ')}.
          </div>
        )}
        {perPerson.length === 0 && (
          <p className="muted small" style={{ margin: '6px 0 0' }}>Nessun turno nel periodo.</p>
        )}
        {perPerson.map((p) => (
          <div className="row between" key={p.name} style={{ marginTop: 4 }}>
            <span>
              {p.name} <span className="muted small">· {p.turni} turni</span>
            </span>
            <span>
              <strong>{p.effettivo} h</strong>
              {p.programmato > 0 && <span className="muted small"> / {p.programmato} h prog.</span>}
              {(() => {
                const q = payroll.persone.find((x) => x.name === p.name)
                if (!q) return null
                return q.mancante ? (
                  <span className="muted small" title="Manca la tariffa oraria"> · costo ?</span>
                ) : (
                  <span className="muted small"> · {formatPrice(q.cost)}</span>
                )
              })()}
            </span>
          </div>
        ))}
      </div>

      {/* Paghe: tariffa oraria per persona, storicizzata */}
      <button
        className="btn ghost small block"
        style={{ marginTop: 10 }}
        onClick={() => setShowPaghe((v) => !v)}
      >
        {showPaghe ? 'Nascondi paghe' : '💶 Paghe orarie'}
      </button>
      {showPaghe && (
        <PagheManager
          nomi={nomi}
          rates={rates}
          onSave={(nome, list) => saveStaffRates(nome, list).catch((e) => setError(e.message))}
        />
      )}

      {/* Nuovo turno (manuale): effettivo o programmato */}
      <form className="card" onSubmit={salva} style={{ marginTop: 10 }}>
        <strong>Nuovo turno</strong>
        <div className="chips-row" style={{ margin: '8px 0 2px' }}>
          {[
            ['effettivo', '✅ Effettivo'],
            ['programmato', '📅 Programmato'],
          ].map(([k, label]) => (
            <button
              type="button"
              key={k}
              className={`chip ${kind === k ? 'active' : ''}`}
              onClick={() => setKind(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted small" style={{ margin: '0 0 6px' }}>
          {kind === 'effettivo'
            ? 'Ore realmente lavorate (es. correzione se dimenticano di timbrare).'
            : 'Turno pianificato, da confrontare con le ore effettive.'}
        </p>
        <div className="grid-2">
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
            <DayView date={dayDetail} data={days.get(dayDetail)} {...rowActions} />
          </div>
        </div>
      )}

      {editShift && (
        <ShiftEditDialog
          shift={editShift}
          onClose={() => setEditShift(null)}
          onSave={(patch) => {
            const id = editShift.id
            setEditShift(null)
            updateStaffShift(id, patch).catch((err) => setError(err.message))
          }}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          title="🗑 Eliminare la voce?"
          message={`${confirmDel.staff_name} · ${confirmDel.date} · ${confirmDel.hours} h`}
          confirmLabel="Elimina"
          danger
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            const e = confirmDel
            setConfirmDel(null)
            const p = e.source === 'shift' ? deleteStaffShift(e.id) : deleteStaffHours(e.id)
            p.catch((err) => setError(err.message))
          }}
        />
      )}
    </div>
  )
}

// Totali per persona nel periodo: effettivo, programmato e n. turni.
function peopleTotals(entries) {
  const byName = new Map()
  for (const e of entries || []) {
    const cur = byName.get(e.staff_name) || { name: e.staff_name, effettivo: 0, programmato: 0, turni: 0 }
    const h = Number(e.hours) || 0
    if (e.kind === 'programmato') cur.programmato = Math.round((cur.programmato + h) * 100) / 100
    else cur.effettivo = Math.round((cur.effettivo + h) * 100) / 100
    cur.turni += 1
    byName.set(e.staff_name, cur)
  }
  return [...byName.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

// ── Calendario mensile: griglia 7×6, effettivo/programmato per giorno ──
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
        const t = info ? effVsPlanned(info.entries) : null
        return (
          <button
            key={cell.date}
            className={`ore-cal-cell${cell.inMonth ? '' : ' out'}${cell.date === today ? ' today' : ''}${info ? ' has' : ''}`}
            onClick={() => info && onPick(cell.date)}
            disabled={!info}
          >
            <span className="ore-cal-day">{Number(cell.date.slice(8))}</span>
            {t && (
              <>
                <span className="ore-cal-h">{t.effettivo} h</span>
                {t.programmato > 0 && <span className="ore-cal-n muted">/{t.programmato}</span>}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Vista settimana: 7 giorni con i turni sotto ──
function WeekView({ dates, days, onDelete, onEditShift }) {
  return (
    <div className="ore-week">
      {dates.map((d) => {
        const info = days.get(d)
        const t = info ? effVsPlanned(info.entries) : null
        return (
          <div key={d} className="card" style={{ padding: 10 }}>
            <div className="row between">
              <strong style={{ textTransform: 'capitalize' }}>
                {new Date(`${d}T00:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}
              </strong>
              {t && (
                <strong>
                  {t.effettivo} h
                  {t.programmato > 0 && <span className="muted small"> / {t.programmato}</span>}
                </strong>
              )}
            </div>
            {!info && <span className="muted small">—</span>}
            {(info?.entries || []).map((e) => (
              <ShiftRow key={e.id} e={e} onDelete={onDelete} onEditShift={onEditShift} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Vista giorno: elenco turni ──
function DayView({ data, onDelete, onEditShift }) {
  if (!data) return <p className="muted small" style={{ marginTop: 8 }}>Nessun turno in questo giorno.</p>
  const t = effVsPlanned(data.entries)
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row between">
        <strong>{data.entries.length} voci</strong>
        <strong>
          {t.effettivo} h
          {t.programmato > 0 && <span className="muted small"> / {t.programmato} h prog.</span>}
        </strong>
      </div>
      {data.entries.map((e) => (
        <ShiftRow key={e.id} e={e} onDelete={onDelete} onEditShift={onEditShift} />
      ))}
    </div>
  )
}

function ShiftRow({ e, onDelete, onEditShift }) {
  const isShift = e.source === 'shift'
  return (
    <div className="row between" style={{ alignItems: 'center', marginTop: 6 }}>
      <span className="grow" style={{ fontSize: '0.9rem' }}>
        <strong>{e.staff_name}</strong>{' '}
        {e.kind === 'programmato' && <span className="pill small">📅 prog.</span>}
        {isShift && !e.open && <span className="pill small">🕓 badge</span>}
        {e.open && <span className="pill small live">🟢 in corso</span>}{' '}
        <span className="muted small">
          {e.label}
          {e.note && e.note !== 'timbratura' ? ` · ${e.note}` : ''}
        </span>
      </span>
      <span className="row" style={{ gap: 6, alignItems: 'center' }}>
        <strong>{e.open ? '—' : `${e.hours} h`}</strong>
        {isShift && (
          <button className="btn ghost small" aria-label={`Correggi timbratura ${e.staff_name}`} onClick={() => onEditShift(e)}>✏️</button>
        )}
        <button className="btn ghost small" aria-label={`Elimina voce ${e.staff_name}`} onClick={() => onDelete(e)}>🗑</button>
      </span>
    </div>
  )
}

// Correzione manuale di una timbratura: orari entrata/uscita. Se manca
// l'uscita (turno in corso o dimenticato), la si imposta qui per chiudere.
function ShiftEditDialog({ shift, onClose, onSave }) {
  const [inVal, setInVal] = useState(isoToLocalInput(shift.clock_in))
  const [outVal, setOutVal] = useState(shift.clock_out ? isoToLocalInput(shift.clock_out) : '')
  const inIso = localInputToIso(inVal)
  const outIso = outVal ? localInputToIso(outVal) : null
  const valid = inIso && (!outVal || (outIso && outIso >= inIso))
  return (
    <div className="overlay confirm-overlay" onClick={onClose}>
      <div className="confirm-box" style={{ width: 'min(420px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>✏️ Correggi timbratura</h3>
          <button className="btn ghost small" onClick={onClose}>✕</button>
        </div>
        <p className="muted small" style={{ marginTop: 4 }}>{shift.staff_name}</p>
        <label htmlFor="sh-in" style={{ display: 'block', marginTop: 6 }}>Entrata</label>
        <input id="sh-in" type="datetime-local" value={inVal} onChange={(e) => setInVal(e.target.value)} />
        <label htmlFor="sh-out" style={{ display: 'block', marginTop: 6 }}>Uscita</label>
        <input id="sh-out" type="datetime-local" value={outVal} onChange={(e) => setOutVal(e.target.value)} />
        {shift.open && !outVal && (
          <p className="muted small" style={{ marginTop: 6 }}>Turno ancora aperto: imposta l’uscita per chiuderlo.</p>
        )}
        <button
          className="btn block"
          style={{ marginTop: 10 }}
          disabled={!valid}
          onClick={() => onSave({ clock_in: inIso, clock_out: outIso })}
        >
          Salva
        </button>
      </div>
    </div>
  )
}

// ── Paghe orarie: una tariffa per persona, con la data da cui vale ──────
// Storicizzate di proposito: alzando la paga NON si riscrive il passato,
// i turni già lavorati restano valorizzati alla tariffa di allora.
function PagheManager({ nomi, rates, onSave }) {
  const [chi, setChi] = useState('')
  const [from, setFrom] = useState(oggi)
  const [rate, setRate] = useState('')

  const listaDi = (nome) => sortRates(rates.find((r) => r.name === nome)?.rates || [])
  const correnti = rates
    .map((r) => ({ name: r.name, rates: sortRates(r.rates || []) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  function aggiungi(e) {
    e.preventDefault()
    const n = chi.trim()
    const v = Number(String(rate).replace(',', '.'))
    if (!n || !(v >= 0) || !from) return
    onSave(n, upsertRate(listaDi(n), { from, rate: v }))
    setRate('')
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <strong>💶 Paghe orarie</strong>
      <p className="muted small" style={{ margin: '4px 0 8px' }}>
        La tariffa vale <strong>dalla data indicata in poi</strong>. Un aumento
        non cambia i turni già lavorati: restano pagati alla tariffa di allora.
      </p>

      <form onSubmit={aggiungi}>
        <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <div className="grow">
            <label htmlFor="pg-chi">Chi</label>
            <input id="pg-chi" list="pg-nomi" value={chi} onChange={(e) => setChi(e.target.value)} placeholder="Nome" />
            <datalist id="pg-nomi">
              {nomi.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="pg-da">Da</label>
            <input id="pg-da" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div style={{ width: 100 }}>
            <label htmlFor="pg-eur">€/ora</label>
            <input
              id="pg-eur"
              type="number"
              min="0"
              step="0.5"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
        </div>
        <button className="btn block" type="submit" style={{ marginTop: 8 }} disabled={!chi.trim() || rate === ''}>
          Salva tariffa
        </button>
      </form>

      {correnti.length === 0 && (
        <p className="muted small" style={{ marginTop: 8 }}>
          Nessuna tariffa impostata: le ore si contano ma non si valorizzano.
        </p>
      )}
      {correnti.map((p) => (
        <div key={p.name} style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
          <div className="row between">
            <strong style={{ fontSize: '0.92rem' }}>{p.name}</strong>
            <span className="muted small">
              oggi {rateAt(p.rates, oggi()) != null ? `${formatPrice(rateAt(p.rates, oggi()))}/h` : '—'}
            </span>
          </div>
          {p.rates.map((r) => (
            <div className="row between" key={r.from} style={{ alignItems: 'center', marginTop: 4 }}>
              <span className="muted small">dal {r.from}</span>
              <span className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span>{formatPrice(r.rate)}/h</span>
                <button
                  className="btn ghost small"
                  aria-label={`Rimuovi tariffa ${p.name} dal ${r.from}`}
                  onClick={() => onSave(p.name, removeRate(p.rates, r.from))}
                >
                  🗑
                </button>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
