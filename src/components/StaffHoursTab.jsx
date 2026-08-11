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
  peopleOfDay,
} from '../lib/ore.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import SectionPanels from './SectionPanels.jsx'

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

export default function StaffHoursTab({ embedded = false }) {
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

  const entries = useMemo(() => normalizeEntries(hoursRows, shiftRows), [hoursRows, shiftRows])
  const days = useMemo(() => byDay(entries), [entries])
  const totals = useMemo(() => effVsPlanned(entries), [entries])
  const perPerson = useMemo(() => peopleTotals(entries), [entries])
  // I turni e le paghe si legano ai MEMBRI DELLO STAFF registrati: un nome
  // scritto a mano si sbaglia, cambia, e non si riaggancia a nulla.
  const membri = useMemo(
    () =>
      [...staff]
        .map((u) => ({ uid: u.uid, label: u.name || u.email, role: u.role }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label))),
    [staff]
  )
  // Tariffe della persona di un turno: per uid, con ricaduta sul nome per
  // i turni registrati prima che ci fosse l'uid.
  const ratesFor = useMemo(() => {
    const byUid = new Map(rates.map((r) => [r.id, r.rates || []]))
    const byName = new Map(rates.map((r) => [r.name, r.rates || []]))
    return (e) => (e.staff_uid && byUid.get(e.staff_uid)) || byName.get(e.staff_name) || []
  }, [rates])

  // Costo del personale nel periodo: solo ore EFFETTIVE, ciascuna alla
  // tariffa in vigore nel giorno in cui è stata lavorata.
  const payroll = useMemo(() => payrollReport(entries, ratesFor), [entries, ratesFor])


  // Aggiunge un turno (dal form generale o dalla modale di un giorno).
  const addTurno = (payload) => addStaffHours(payload).catch((err) => setError(err.message))

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
      {!embedded && (
        <>
          <h2>👥 Staff</h2>
          <p className="muted small" style={{ margin: '-6px 0 10px' }}>
            Turni, ore lavorate e paghe. Account e ruoli stanno in “Utenti e ruoli”.
          </p>
        </>
      )}
      {error && <div className="banner">Errore: {error}</div>}

      {/* Quello che si fa ogni tanto — le paghe, un turno a mano — sta qui
          sotto al titolo, non in fondo alla pagina dopo il calendario. */}
      <SectionPanels
        panels={[
          {
            id: 'turno',
            label: '➕ Nuovo turno',
            desc: 'Per un giorno preciso conviene cliccarlo nel calendario: si assegna lì, con gli orari.',
            render: () => <ShiftForm membri={membri} onAdd={addTurno} />,
          },
          {
            id: 'paghe',
            label: '💶 Paghe orarie',
            desc: 'Tariffa oraria per persona. Resta storicizzata: i turni già registrati mantengono quella in vigore quel giorno.',
            render: () => (
              <PagheManager
                membri={membri}
                rates={rates}
                onSave={(membro, list) =>
                  saveStaffRates(membro, list).catch((e) => setError(e.message))
                }
              />
            ),
          },
        ]}
      />

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
        <WeekView dates={weekDays(cursor)} days={days} onPick={setDayDetail} {...rowActions} />
      )}
      {mode === 'giorno' && (
        <>
          <DayPeople entries={days.get(cursor)?.entries} />
          <DayView date={cursor} data={days.get(cursor)} {...rowActions} />
          {membri.length > 0 && (
            <div className="card" style={{ marginTop: 8 }}>
              <strong className="small">➕ Assegna a questo giorno</strong>
              <ShiftForm membri={membri} fixedDate={cursor} onAdd={addTurno} />
            </div>
          )}
        </>
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



      {/* Dettaglio giorno (dal calendario mensile o settimanale): chi è di
          turno con orari programmati/effettivi + assegnazione staff. */}
      {dayDetail && (
        <div className="overlay confirm-overlay" onClick={() => setDayDetail(null)}>
          <div className="confirm-box" style={{ width: 'min(460px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{giornoLabel(dayDetail)}</h3>
              <button className="btn ghost small" onClick={() => setDayDetail(null)}>✕</button>
            </div>
            <DayPeople entries={days.get(dayDetail)?.entries} />
            <DayView date={dayDetail} data={days.get(dayDetail)} {...rowActions} />
            <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <strong className="small">➕ Assegna a questo giorno</strong>
              {membri.length === 0 ? (
                <p className="muted small" style={{ margin: '4px 0 0' }}>Nessun membro dello staff: aggiungilo nella scheda “Membri”.</p>
              ) : (
                <ShiftForm membri={membri} fixedDate={dayDetail} onAdd={addTurno} />
              )}
            </div>
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

// Solo il nome di battesimo, per stare stretti nelle celle del calendario.
const firstName = (name) => String(name || '').trim().split(/\s+/)[0]

// ── Calendario mensile: griglia 7×6. Ogni giorno mostra CHI è di turno con
// gli orari programmati (e, per i giorni passati, anche gli effettivi). Tutte
// le celle sono cliccabili: si apre il dettaglio del giorno per assegnare. ──
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
        const gente = info ? peopleOfDay(info.entries) : []
        const past = cell.date < today
        return (
          <button
            key={cell.date}
            className={`ore-cal-cell${cell.inMonth ? '' : ' out'}${cell.date === today ? ' today' : ''}${gente.length ? ' has' : ''}`}
            onClick={() => onPick(cell.date)}
          >
            <span className="ore-cal-day">{Number(cell.date.slice(8))}</span>
            {gente.slice(0, 3).map((p) => {
              // Orario da mostrare: programmato di norma; sui giorni passati
              // l'effettivo se c'è (così si legge "da–a" reale, non solo il monte).
              const prog = p.programmato.ranges[0]
              const eff = p.effettivo.ranges[0]
              const orario = past ? eff || prog : prog || eff
              return (
                <span key={p.key} className="ore-cal-who">
                  <b>{firstName(p.name)}</b>
                  {orario && <span className="ore-cal-when">{orario}</span>}
                </span>
              )
            })}
            {gente.length > 3 && <span className="ore-cal-more">+{gente.length - 3}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Riepilogo "chi è di turno" per una modale/giorno: per persona, orari
// PROGRAMMATI vs EFFETTIVI affiancati.
function DayPeople({ entries }) {
  const gente = peopleOfDay(entries)
  if (gente.length === 0) return null
  return (
    <div className="day-people">
      {gente.map((p) => (
        <div key={p.key} className="day-person">
          <strong>{p.name}</strong>
          <span className="day-person-cols">
            <span title="Programmato">
              📅 {p.programmato.ranges.join(', ') || (p.programmato.hours ? `${p.programmato.hours} h` : '—')}
            </span>
            <span title="Effettivo" className={p.effettivo.hours ? '' : 'muted'}>
              ✅ {p.effettivo.ranges.join(', ') || (p.effettivo.hours ? `${p.effettivo.hours} h` : '—')}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Vista settimana: 7 giorni con i turni sotto. L'intestazione del giorno
// è cliccabile e apre il dettaglio per assegnare/modificare i turni. ──
function WeekView({ dates, days, onPick, onDelete, onEditShift }) {
  return (
    <div className="ore-week">
      {dates.map((d) => {
        const info = days.get(d)
        const t = info ? effVsPlanned(info.entries) : null
        return (
          <div key={d} className="card" style={{ padding: 10 }}>
            <button className="week-day-head row between" onClick={() => onPick(d)}>
              <strong style={{ textTransform: 'capitalize' }}>
                {new Date(`${d}T00:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}
              </strong>
              {t ? (
                <strong>
                  {t.effettivo} h
                  {t.programmato > 0 && <span className="muted small"> / {t.programmato}</span>}
                </strong>
              ) : (
                <span className="muted small">＋ assegna</span>
              )}
            </button>
            {(info?.entries || []).map((e) => (
              <ShiftRow key={e.id} e={e} onDelete={onDelete} onEditShift={onEditShift} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Form turno riusabile: nel riquadro generale (data scegliibile) e nella
// modale di un giorno (data fissa). Effettivo o programmato. ──
function ShiftForm({ membri, fixedDate = null, onAdd }) {
  const [kind, setKind] = useState(fixedDate ? 'programmato' : 'effettivo')
  const [personUid, setPersonUid] = useState('')
  const [date, setDate] = useState(fixedDate || oggi())
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [breakMin, setBreakMin] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => {
    if (fixedDate) setDate(fixedDate)
  }, [fixedDate])

  const hours = computeHours(start, end, Number(breakMin) || 0)
  const membro = membri.find((m) => m.uid === personUid)

  function submit(e) {
    e.preventDefault()
    if (!membro || hours == null) return
    onAdd({
      staff_uid: membro.uid,
      staff_name: membro.label,
      date,
      start,
      end,
      break_minutes: Number(breakMin) || 0,
      hours,
      note: note.trim() || null,
      kind,
    })
    setStart('')
    setEnd('')
    setBreakMin('')
    setNote('')
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 8 }}>
      <div className="chips-row" style={{ margin: '0 0 2px' }}>
        {[
          ['programmato', '📅 Programmato'],
          ['effettivo', '✅ Effettivo'],
        ].map(([k, label]) => (
          <button type="button" key={k} className={`chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>
      <p className="muted small" style={{ margin: '0 0 6px' }}>
        {kind === 'effettivo'
          ? 'Ore realmente lavorate (es. correzione se dimenticano di timbrare).'
          : 'Turno pianificato, da confrontare con le ore effettive.'}
      </p>
      <div className={fixedDate ? '' : 'grid-2'}>
        <div>
          <label htmlFor={`sf-nome-${fixedDate || 'gen'}`}>Chi *</label>
          <select id={`sf-nome-${fixedDate || 'gen'}`} value={personUid} onChange={(e) => setPersonUid(e.target.value)} required>
            <option value="">— Scegli —</option>
            {membri.map((m) => (
              <option key={m.uid} value={m.uid}>{m.label}</option>
            ))}
          </select>
        </div>
        {!fixedDate && (
          <div>
            <label htmlFor="sf-data-gen">Giorno</label>
            <input id="sf-data-gen" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 6 }}>
        <div className="grow">
          <label htmlFor={`sf-in-${fixedDate || 'gen'}`}>Entrata *</label>
          <input id={`sf-in-${fixedDate || 'gen'}`} type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div className="grow">
          <label htmlFor={`sf-out-${fixedDate || 'gen'}`}>Uscita *</label>
          <input id={`sf-out-${fixedDate || 'gen'}`} type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
        <div style={{ width: 90 }}>
          <label htmlFor={`sf-pausa-${fixedDate || 'gen'}`}>Pausa (min)</label>
          <input id={`sf-pausa-${fixedDate || 'gen'}`} type="number" min="0" step="5" value={breakMin} onChange={(e) => setBreakMin(e.target.value)} />
        </div>
      </div>
      <label htmlFor={`sf-note-${fixedDate || 'gen'}`} style={{ marginTop: 6, display: 'block' }}>Note</label>
      <input id={`sf-note-${fixedDate || 'gen'}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. serata evento" />
      <button className="btn block" type="submit" style={{ marginTop: 10 }} disabled={!personUid || hours == null}>
        Aggiungi{hours != null ? ` · ${hours} h` : ''}
        {start && end && end < start ? ' (oltre mezzanotte)' : ''}
      </button>
    </form>
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
function PagheManager({ membri, rates, onSave }) {
  const [uid, setUid] = useState('')
  const [from, setFrom] = useState(oggi)
  const [rate, setRate] = useState('')

  const listaDi = (id) => sortRates(rates.find((r) => r.id === id)?.rates || [])
  // Si mostrano i MEMBRI dello staff: chi non ha ancora una tariffa
  // compare comunque, così si vede subito chi manca all'appello.
  const righe = membri.map((m) => ({ ...m, rates: listaDi(m.uid) }))
  // Tariffe rimaste da account cancellati: non si perdono in silenzio.
  const orfane = rates.filter((r) => !membri.some((m) => m.uid === r.id))

  function aggiungi(e) {
    e.preventDefault()
    const m = membri.find((x) => x.uid === uid)
    const v = Number(String(rate).replace(',', '.'))
    if (!m || !(v >= 0) || !from) return
    onSave({ uid: m.uid, name: m.label }, upsertRate(listaDi(m.uid), { from, rate: v }))
    setRate('')
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <strong>💶 Paghe orarie</strong>
      <p className="muted small" style={{ margin: '4px 0 8px' }}>
        La tariffa vale <strong>dalla data indicata in poi</strong>. Un aumento
        non cambia i turni già lavorati: restano pagati alla tariffa di allora.
      </p>

      {membri.length === 0 ? (
        <p className="muted small">
          Nessun membro dello staff: aggiungili nella scheda “Staff”, poi qui
          imposti la loro paga.
        </p>
      ) : (
        <form onSubmit={aggiungi}>
          <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
            <div className="grow">
              <label htmlFor="pg-chi">Chi</label>
              <select id="pg-chi" value={uid} onChange={(e) => setUid(e.target.value)}>
                <option value="">— Scegli —</option>
                {membri.map((m) => (
                  <option key={m.uid} value={m.uid}>{m.label}</option>
                ))}
              </select>
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
                step="any"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>
          <button className="btn block" type="submit" style={{ marginTop: 8 }} disabled={!uid || rate === ''}>
            Salva tariffa
          </button>
        </form>
      )}

      {righe.map((m) => (
        <div key={m.uid} style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
          <div className="row between">
            <strong style={{ fontSize: '0.92rem' }}>{m.label}</strong>
            <span className="muted small">
              oggi{' '}
              {rateAt(m.rates, oggi()) != null
                ? `${formatPrice(rateAt(m.rates, oggi()))}/h`
                : '— nessuna tariffa'}
            </span>
          </div>
          {m.rates.map((r) => (
            <div className="row between" key={r.from} style={{ alignItems: 'center', marginTop: 4 }}>
              <span className="muted small">dal {r.from}</span>
              <span className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span>{formatPrice(r.rate)}/h</span>
                <button
                  className="btn ghost small"
                  aria-label={`Rimuovi tariffa ${m.label} dal ${r.from}`}
                  onClick={() => onSave({ uid: m.uid, name: m.label }, removeRate(m.rates, r.from))}
                >
                  🗑
                </button>
              </span>
            </div>
          ))}
        </div>
      ))}

      {orfane.length > 0 && (
        <p className="muted small" style={{ marginTop: 10 }}>
          ⚠️ Tariffe di account non più presenti: {orfane.map((r) => r.name || r.id).join(', ')}.
        </p>
      )}
    </div>
  )
}
