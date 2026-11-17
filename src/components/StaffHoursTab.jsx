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
import { payrollReport, rateAt, upsertRate, removeRate, sortRates, tariffePer } from '../lib/paghe.js'
import { formatPrice } from '../lib/orderStatus.js'
import { listStaff } from '../lib/staffApi.js'
import {
  normalizeEntries,
  computeHours,
  byDay,
  monthGrid,
  weekDays,
  shiftDay,
  effVsPlanned,
  peopleOfDay,
} from '../lib/ore.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import StaffBadgePanel from './StaffBadgePanel.jsx'
import { Sottosezioni } from '../lib/sottosezioni.js'
import Icona from './Icona.jsx'
import { tr, daTradurre, trSegnato, formatoAttivo, useLingua } from '../lib/lingua.js'

// RAPP ORE + BADGE VIRTUALE: registro ore dello staff con vista calendario
// giornaliera, settimanale e mensile. Distingue le ore EFFETTIVE (badge:
// timbrature entrata/uscita al login/logout, o correzioni manuali) dalle
// ore PROGRAMMATE (turni pianificati), e mostra il confronto.

const oggi = () => new Date().toISOString().slice(0, 10)
// I giorni in testa al calendario: segnati qui, tradotti dove si mostrano
// (un `tr` al caricamento del modulo fisserebbe la lingua). Il contesto
// serve perché «Mar» e «Dom» da sole sono anche altre parole.
const DOW = [
  daTradurre('giorno|Lun'),
  daTradurre('giorno|Mar'),
  daTradurre('giorno|Mer'),
  daTradurre('giorno|Gio'),
  daTradurre('giorno|Ven'),
  daTradurre('giorno|Sab'),
  daTradurre('giorno|Dom'),
]

const mesLabel = (dateStr) => {
  const [y, m] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(formatoAttivo(), { month: 'long', year: 'numeric' })
}
const giornoLabel = (dateStr) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString(formatoAttivo(), {
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

// CHI È IN TURNO ADESSO sta in cima alle ore: era in fondo alla cassa,
// dove ci si va per i soldi — e per timbrare l'ingresso bisognava passare
// dal flusso di cassa, che con le ore non c'entra niente.
const SEZIONI_STAFF = [
  { id: 'calendario', icona: 'calendario', label: daTradurre('Calendario') },
  // LE TIMBRATURE HANNO LA LORO VOCE. Sono la cosa che si tocca all'inizio
  // e alla fine del turno — «chi c'è adesso» — e stavano in cima al
  // calendario: per battere l'ingresso di chi arriva bisognava passare
  // dalla schermata dei turni, che con quel gesto non c'entra.
  { id: 'timbrature', icona: 'tempo', label: daTradurre('Timbrature') },
  { id: 'turno', icona: 'aggiungi', label: daTradurre('Nuovo turno') },
  { id: 'paghe', icona: 'paghe', label: daTradurre('Paghe orarie') },
]

export default function StaffHoursTab({ embedded = false, sezioneIniziale = 'calendario' }) {
  useLingua()
  // Tre sezioni come nelle altre pagine: il calendario è quella che si apre,
  // perché è il motivo per cui si viene qui.
  const [sezione, setSezione] = useState(sezioneIniziale)
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
  const ratesFor = useMemo(() => tariffePer(rates), [rates])

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
          {/* Il titolo sta nella barra in alto (vedi lib/sezioni.js). */}
          <p className="muted small" style={{ margin: '-6px 0 10px' }}>
            {tr('Turni, ore lavorate e paghe. Account e ruoli stanno in “Utenti e ruoli”.')}
          </p>
        </>
      )}
      {!embedded && <Sottosezioni voci={SEZIONI_STAFF.map((v) => ({ ...v, label: trSegnato(v.label) }))} attiva={sezione} scegli={setSezione} />}
      {error && <div className="banner">{tr('Errore: {messaggio}', { messaggio: error })}</div>}

      {/* CHI TIMBRA ADESSO, in una sezione sua. Prima stava in fondo alla
          pagina della cassa — dove ci si va per i soldi — poi in cima al
          calendario: in tutti e due i casi, per battere l'ingresso di chi
          arriva bisognava passare da una schermata che con quel gesto non
          c'entra. */}
      {sezione === 'timbrature' && <StaffBadgePanel />}

      {/* NUOVO TURNO E PAGHE SONO SEZIONI, non pannelli a scomparsa in cima
          alla pagina: aprirli spingeva giù il calendario, che è la cosa per
          cui si viene qui. Stanno nel menu laterale come nelle altre
          pagine. */}
      {sezione === 'turno' && <ShiftForm membri={membri} onAdd={addTurno} />}
      {sezione === 'paghe' && (
        <PagheManager
          membri={membri}
          rates={rates}
          onSave={(membro, list) => saveStaffRates(membro, list).catch((e) => setError(e.message))}
        />
      )}

      {sezione === 'calendario' && (
        <>
      {/* Vista: giorno / settimana / mese */}
      <div className="chips-row" style={{ marginBottom: 8 }}>
        {[
          ['giorno', tr('vista|Giorno')],
          ['settimana', tr('Settimana')],
          ['mese', tr('Mese')],
        ].map(([k, label]) => (
          <button key={k} className={`chip ${mode === k ? 'active' : ''}`} onClick={() => setMode(k)}>
            {label}
          </button>
        ))}
      </div>

      {/* Navigazione periodo */}
      <div className="row between" style={{ alignItems: 'center', marginBottom: 8 }}>
        <button className="btn ghost small" aria-label={tr('Periodo precedente')} onClick={() => nav(-1)}>←</button>
        <strong style={{ textTransform: 'capitalize', textAlign: 'center' }}>{periodo}</strong>
        <button className="btn ghost small" aria-label={tr('Periodo successivo')} onClick={() => nav(1)}>→</button>
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
              <strong className="small"><Icona nome="aggiungi" gruppo="tasti" /> {tr('Assegna a questo giorno')}</strong>
              <ShiftForm membri={membri} fixedDate={cursor} onAdd={addTurno} />
            </div>
          )}
        </>
      )}

      {/* Totali del periodo: effettivo vs programmato */}
      <div className="card" style={{ marginTop: 10 }}>
        <div className="row between">
          <strong>{tr('Totale periodo')}</strong>
          <span className="row" style={{ gap: 10 }}>
            <span title={tr('Ore effettive (timbrature + correzioni)')}>
              <Icona nome="fatto" gruppo="segnali" />{' '}<strong>{totals.effettivo} h</strong>
            </span>
            <span className="muted" title={tr('Ore programmate (turni pianificati)')}>
              <Icona nome="calendario" gruppo="tasti" />{' '}{totals.programmato} h
            </span>
          </span>
        </div>
        {totals.programmato > 0 && (
          <div className="row between" style={{ marginTop: 4 }}>
            <span className="muted small">{tr('Scarto effettivo − programmato')}</span>
            <strong className={totals.scarto < 0 ? 'neg' : ''}>
              {totals.scarto > 0 ? '+' : ''}
              {totals.scarto} h
            </strong>
          </div>
        )}
        <div className="row between" style={{ marginTop: 6, borderTop: '1px dashed var(--line)', paddingTop: 6 }}>
          <span className="muted small">{tr('Costo del personale (ore effettive)')}</span>
          <strong>{formatPrice(payroll.totale)}</strong>
        </div>
        {payroll.parziale && (
          <div className="muted small">
            <Icona nome="avviso" gruppo="segnali" />{' '}{tr('Parziale: manca la tariffa oraria di {nomi}.', { nomi: payroll.senzaTariffa.join(', ') })}
          </div>
        )}
        {perPerson.length === 0 && (
          <p className="muted small" style={{ margin: '6px 0 0' }}>{tr('Nessun turno nel periodo.')}</p>
        )}
        {perPerson.map((p) => (
          <div className="row between" key={p.name} style={{ marginTop: 4 }}>
            <span>
              {p.name}{' '}
              <span className="muted small">· {p.turni === 1 ? tr('1 turno') : tr('{n} turni', { n: p.turni })}</span>
            </span>
            <span>
              <strong>{p.effettivo} h</strong>
              {p.programmato > 0 && <span className="muted small"> / {tr('{n} h prog.', { n: p.programmato })}</span>}
              {(() => {
                const q = payroll.persone.find((x) => x.name === p.name)
                if (!q) return null
                return q.mancante ? (
                  <span className="muted small" title={tr('Manca la tariffa oraria')}> · {tr('costo ?')}</span>
                ) : (
                  <span className="muted small"> · {formatPrice(q.cost)}</span>
                )
              })()}
            </span>
          </div>
        ))}
      </div>
        </>
      )}

      {/* Dettaglio giorno (dal calendario mensile o settimanale): chi è di
          turno con orari programmati/effettivi + assegnazione staff. */}
      {dayDetail && (
        <div className="overlay confirm-overlay" onClick={() => setDayDetail(null)}>
          <div className="confirm-box" style={{ width: 'min(460px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{giornoLabel(dayDetail)}</h3>
              <button className="btn ghost small" aria-label={tr('Chiudi')} onClick={() => setDayDetail(null)}>✕</button>
            </div>
            <DayPeople entries={days.get(dayDetail)?.entries} />
            <DayView date={dayDetail} data={days.get(dayDetail)} {...rowActions} />
            <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <strong className="small"><Icona nome="aggiungi" gruppo="tasti" /> {tr('Assegna a questo giorno')}</strong>
              {membri.length === 0 ? (
                <p className="muted small" style={{ margin: '4px 0 0' }}>{tr('Nessun membro dello staff: aggiungilo nella scheda “Membri”.')}</p>
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
          icona="elimina"
          title={tr('Eliminare la voce?')}
          message={`${confirmDel.staff_name} · ${confirmDel.date} · ${confirmDel.hours} h`}
          confirmLabel={tr('Elimina')}
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
        <div key={d} className="ore-cal-dow">{trSegnato(d)}</div>
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
            <span title={tr('Programmato')}>
              <Icona nome="calendario" gruppo="tasti" />{' '}{p.programmato.ranges.join(', ') || (p.programmato.hours ? `${p.programmato.hours} h` : '—')}
            </span>
            <span title={tr('Effettivo')} className={p.effettivo.hours ? '' : 'muted'}>
              <Icona nome="fatto" gruppo="segnali" />{' '}{p.effettivo.ranges.join(', ') || (p.effettivo.hours ? `${p.effettivo.hours} h` : '—')}
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
                {new Date(`${d}T00:00:00`).toLocaleDateString(formatoAttivo(), { weekday: 'short', day: 'numeric' })}
              </strong>
              {t ? (
                <strong>
                  {t.effettivo} h
                  {t.programmato > 0 && <span className="muted small"> / {t.programmato}</span>}
                </strong>
              ) : (
                <span className="muted small">＋ {tr('assegna')}</span>
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
          ['programmato', 'calendario', tr('Programmato')],
          ['effettivo', 'fatto', tr('Effettivo')],
        ].map(([k, icona, label]) => (
          <button type="button" key={k} className={`chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
            <Icona nome={icona} gruppo="tasti" /> {label}
          </button>
        ))}
      </div>
      <p className="muted small" style={{ margin: '0 0 6px' }}>
        {kind === 'effettivo'
          ? tr('Ore realmente lavorate (es. correzione se dimenticano di timbrare).')
          : tr('Turno pianificato, da confrontare con le ore effettive.')}
      </p>
      <div className={fixedDate ? '' : 'grid-2'}>
        <div>
          <label htmlFor={`sf-nome-${fixedDate || 'gen'}`}>{tr('Chi *')}</label>
          <select id={`sf-nome-${fixedDate || 'gen'}`} value={personUid} onChange={(e) => setPersonUid(e.target.value)} required>
            <option value="">{tr('— Scegli —')}</option>
            {membri.map((m) => (
              <option key={m.uid} value={m.uid}>{m.label}</option>
            ))}
          </select>
        </div>
        {!fixedDate && (
          <div>
            <label htmlFor="sf-data-gen">{tr('Giorno')}</label>
            <input id="sf-data-gen" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 6 }}>
        <div className="grow">
          <label htmlFor={`sf-in-${fixedDate || 'gen'}`}>{tr('Entrata *')}</label>
          <input id={`sf-in-${fixedDate || 'gen'}`} type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div className="grow">
          <label htmlFor={`sf-out-${fixedDate || 'gen'}`}>{tr('Uscita *')}</label>
          <input id={`sf-out-${fixedDate || 'gen'}`} type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
        <div style={{ width: 90 }}>
          <label htmlFor={`sf-pausa-${fixedDate || 'gen'}`}>{tr('Pausa (min)')}</label>
          <input id={`sf-pausa-${fixedDate || 'gen'}`} type="number" min="0" step="5" value={breakMin} onChange={(e) => setBreakMin(e.target.value)} />
        </div>
      </div>
      <label htmlFor={`sf-note-${fixedDate || 'gen'}`} style={{ marginTop: 6, display: 'block' }}>{tr('Note')}</label>
      <input id={`sf-note-${fixedDate || 'gen'}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('Es. serata evento')} />
      <button className="btn block" type="submit" style={{ marginTop: 10 }} disabled={!personUid || hours == null}>
        {tr('Aggiungi')}
        {hours != null ? ` · ${hours} h` : ''}
        {start && end && end < start ? ` ${tr('(oltre mezzanotte)')}` : ''}
      </button>
    </form>
  )
}

// ── Vista giorno: elenco turni ──
function DayView({ data, onDelete, onEditShift }) {
  if (!data) return <p className="muted small" style={{ marginTop: 8 }}>{tr('Nessun turno in questo giorno.')}</p>
  const t = effVsPlanned(data.entries)
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row between">
        <strong>{data.entries.length === 1 ? tr('registro|1 voce') : tr('registro|{n} voci', { n: data.entries.length })}</strong>
        <strong>
          {t.effettivo} h
          {t.programmato > 0 && <span className="muted small"> / {tr('{n} h prog.', { n: t.programmato })}</span>}
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
        {e.kind === 'programmato' && <span className="pill small"><Icona nome="calendario" gruppo="tasti" /> {tr('prog.')}</span>}
        {isShift && !e.open && <span className="pill small"><Icona nome="orario" gruppo="tasti" /> badge</span>}
        {e.open && <span className="pill small live"><Icona nome="verde" gruppo="tasti" /> {tr('in corso')}</span>}{' '}
        <span className="muted small">
          {e.label}
          {e.note && e.note !== 'timbratura' ? ` · ${e.note}` : ''}
        </span>
      </span>
      <span className="row" style={{ gap: 6, alignItems: 'center' }}>
        <strong>{e.open ? '—' : `${e.hours} h`}</strong>
        {isShift && (
          <button className="btn ghost small" aria-label={tr('Correggi timbratura {nome}', { nome: e.staff_name })} onClick={() => onEditShift(e)}><Icona nome="modifica" gruppo="tasti" /></button>
        )}
        <button className="btn ghost small" aria-label={tr('Elimina voce {nome}', { nome: e.staff_name })} onClick={() => onDelete(e)}><Icona nome="elimina" gruppo="tasti" /></button>
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
          <h3 style={{ margin: 0 }}><Icona nome="modifica" gruppo="tasti" /> {tr('Correggi timbratura')}</h3>
          <button className="btn ghost small" aria-label={tr('Chiudi')} onClick={onClose}>✕</button>
        </div>
        <p className="muted small" style={{ marginTop: 4 }}>{shift.staff_name}</p>
        <label htmlFor="sh-in" style={{ display: 'block', marginTop: 6 }}>{tr('Entrata')}</label>
        <input id="sh-in" type="datetime-local" value={inVal} onChange={(e) => setInVal(e.target.value)} />
        <label htmlFor="sh-out" style={{ display: 'block', marginTop: 6 }}>{tr('Uscita')}</label>
        <input id="sh-out" type="datetime-local" value={outVal} onChange={(e) => setOutVal(e.target.value)} />
        {shift.open && !outVal && (
          <p className="muted small" style={{ marginTop: 6 }}>{tr('Turno ancora aperto: imposta l’uscita per chiuderlo.')}</p>
        )}
        <button
          className="btn block"
          style={{ marginTop: 10 }}
          disabled={!valid}
          onClick={() => onSave({ clock_in: inIso, clock_out: outIso })}
        >
          {tr('Salva')}
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
      <strong><Icona nome="contanti" gruppo="tasti" /> {tr('Paghe orarie')}</strong>
      <p className="muted small" style={{ margin: '4px 0 8px' }}>
        {tr('La tariffa vale dalla data indicata in poi. Un aumento non cambia i turni già lavorati: restano pagati alla tariffa di allora.')}
      </p>

      {membri.length === 0 ? (
        <p className="muted small">
          {tr('Nessun membro dello staff: aggiungili nella scheda “Staff”, poi qui imposti la loro paga.')}
        </p>
      ) : (
        <form onSubmit={aggiungi}>
          <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
            <div className="grow">
              <label htmlFor="pg-chi">{tr('Chi')}</label>
              <select id="pg-chi" value={uid} onChange={(e) => setUid(e.target.value)}>
                <option value="">{tr('— Scegli —')}</option>
                {membri.map((m) => (
                  <option key={m.uid} value={m.uid}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pg-da">{tr('data|Da')}</label>
              <input id="pg-da" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div style={{ width: 100 }}>
              <label htmlFor="pg-eur">{tr('€/ora')}</label>
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
            {tr('Salva tariffa')}
          </button>
        </form>
      )}

      {righe.map((m) => (
        <div key={m.uid} style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
          <div className="row between">
            <strong style={{ fontSize: '0.92rem' }}>{m.label}</strong>
            <span className="muted small">
              {rateAt(m.rates, oggi()) != null
                ? tr('oggi {importo}/h', { importo: formatPrice(rateAt(m.rates, oggi())) })
                : tr('oggi — nessuna tariffa')}
            </span>
          </div>
          {m.rates.map((r) => (
            <div className="row between" key={r.from} style={{ alignItems: 'center', marginTop: 4 }}>
              <span className="muted small">{tr('dal {data}', { data: r.from })}</span>
              <span className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span>{formatPrice(r.rate)}/h</span>
                <button
                  className="btn ghost small"
                  aria-label={tr('Rimuovi tariffa {nome} dal {data}', { nome: m.label, data: r.from })}
                  onClick={() => onSave({ uid: m.uid, name: m.label }, removeRate(m.rates, r.from))}
                >
                  <Icona nome="elimina" gruppo="tasti" />
                </button>
              </span>
            </div>
          ))}
        </div>
      ))}

      {orfane.length > 0 && (
        <p className="muted small" style={{ marginTop: 10 }}>
          <Icona nome="avviso" gruppo="segnali" />{' '}{tr('Tariffe di account non più presenti: {nomi}.', { nomi: orfane.map((r) => r.name || r.id).join(', ') })}
        </p>
      )}
    </div>
  )
}
