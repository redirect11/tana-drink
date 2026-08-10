import { useEffect, useMemo, useState } from 'react'
import { listStaff } from '../lib/staffApi.js'
import { subscribeStaffShiftsRange, clockIn, clockOut, updateStaffShift } from '../lib/api.js'

// Pannello TIMBRATURE nella cassa: il bartender (Flavio/Vittorio) all'apertura
// e alla chiusura può timbrare entrata/uscita anche PER I DIPENDENTI e
// correggere l'orario. Le ore finiscono nel registro Ore staff.
// (Lo staff timbra comunque la propria entrata al login e l'uscita al logout.)

const fmtTime = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function StaffBadgePanel() {
  const [staff, setStaff] = useState([])
  const [shifts, setShifts] = useState([])
  const [busy, setBusy] = useState('')
  const [editUid, setEditUid] = useState(null)
  const [editTime, setEditTime] = useState('')
  const [err, setErr] = useState(null)

  // Ieri..oggi: cattura anche i turni notturni ancora aperti oltre mezzanotte.
  const today = new Date().toISOString().slice(0, 10)
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  useEffect(() => {
    listStaff().then((u) => setStaff(u || [])).catch(() => setStaff([]))
  }, [])
  useEffect(() => subscribeStaffShiftsRange(yest, today, setShifts, () => {}), [yest, today])

  const openByUid = useMemo(() => {
    const m = new Map()
    for (const s of shifts) if (s.open) m.set(s.staff_uid, s)
    return m
  }, [shifts])

  const membri = useMemo(
    () =>
      [...staff]
        .map((u) => ({ uid: u.uid, name: u.name || u.email, role: u.role }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [staff]
  )

  async function toggle(m) {
    setBusy(m.uid)
    setErr(null)
    try {
      if (openByUid.get(m.uid)) await clockOut({ uid: m.uid })
      else await clockIn({ uid: m.uid, name: m.name })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy('')
    }
  }

  async function saveTime(m) {
    const open = openByUid.get(m.uid)
    if (!open || !editTime) {
      setEditUid(null)
      return
    }
    try {
      const iso = new Date(`${open.date || today}T${editTime}:00`).toISOString()
      await updateStaffShift(open.id, { clock_in: iso })
    } catch (e) {
      setErr(e.message)
    } finally {
      setEditUid(null)
      setEditTime('')
    }
  }

  const dentro = membri.filter((m) => openByUid.has(m.uid)).length

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <strong>🕒 Timbrature staff</strong>
      <div className="muted small" style={{ margin: '2px 0 8px' }}>
        Timbra entrata/uscita anche per i dipendenti · {dentro} in servizio
      </div>
      {err && <div className="banner" style={{ marginBottom: 8 }}>⚠️ {err}</div>}
      {membri.length === 0 && <p className="muted small">Nessun membro dello staff registrato.</p>}
      {membri.map((m) => {
        const open = openByUid.get(m.uid)
        return (
          <div className="row between" key={m.uid} style={{ alignItems: 'center', marginTop: 8 }}>
            <span style={{ minWidth: 0 }}>
              <strong>{m.name}</strong>{' '}
              {open ? (
                <span className="muted small">in servizio dalle {fmtTime(open.clock_in)}</span>
              ) : (
                <span className="muted small">non in servizio</span>
              )}
            </span>
            <span className="row" style={{ gap: 6, flexShrink: 0 }}>
              {open &&
                (editUid === m.uid ? (
                  <>
                    <input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      style={{ maxWidth: 120 }}
                    />
                    <button className="btn ghost small" onClick={() => saveTime(m)}>OK</button>
                  </>
                ) : (
                  <button
                    className="btn ghost small"
                    title="Correggi l'orario di entrata"
                    onClick={() => {
                      setEditUid(m.uid)
                      setEditTime(fmtTime(open.clock_in))
                    }}
                  >
                    ✎ ora
                  </button>
                ))}
              <button
                className={`btn small${open ? ' ghost' : ''}`}
                disabled={busy === m.uid}
                onClick={() => toggle(m)}
              >
                {open ? 'Timbra uscita' : 'Timbra entrata'}
              </button>
            </span>
          </div>
        )
      })}
    </div>
  )
}
