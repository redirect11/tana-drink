import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/firebaseClient.js'
import { subscribeSerataGroups, createManualGroup } from '../lib/api.js'
import { buildGroupTree, groupTotal, groupSettlement } from '../lib/groups.js'
import { formatPrice } from '../lib/orderStatus.js'
import GroupView from './GroupView.jsx'

// Pannello a scomparsa nella coda: panoramica dei gruppi della serata con
// totale e stato del conto, creazione rapida e avvio ordine per gruppo.
export default function GroupsPanel({ serataId, orders, role }) {
  const [open, setOpen] = useState(false)
  const [groups, setGroups] = useState([])
  const [newName, setNewName] = useState('')
  const [viewGroupId, setViewGroupId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!serataId) return
    return subscribeSerataGroups(serataId, setGroups, () => {})
  }, [serataId])

  const { roots } = useMemo(() => buildGroupTree(groups, orders), [groups, orders])

  async function crea() {
    const name = newName.trim()
    if (!name || !serataId) return
    const u = auth.currentUser
    const g = await createManualGroup({
      name,
      serata_id: serataId,
      created_by: u ? { uid: u.uid, email: u.email, role } : null,
    }).catch(() => null)
    setNewName('')
    if (g) navigate(`/menu?group=${g.id}`)
  }

  return (
    <div className="card groups-panel">
      <div className="row between" style={{ cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        <strong>👥 Gruppi ({roots.length})</strong>
        <span className="muted">{open ? '▾' : '▸'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          {roots.length === 0 && (
            <div className="muted small" style={{ marginBottom: 8 }}>
              Nessun gruppo in questa serata.
            </div>
          )}
          {roots.map((node) => {
            const t = groupTotal(node)
            const s = groupSettlement(node)
            return (
              <div className="group-row" key={node.group.id}>
                <div
                  style={{ minWidth: 0, cursor: 'pointer', flex: 1 }}
                  onClick={() => setViewGroupId(node.group.id)}
                >
                  <div>
                    {node.group.kind === 'customer' ? '👤 ' : '🏷 '}
                    <strong>{node.group.name}</strong>
                  </div>
                  <div className="muted small">
                    {t.orderCount} ordini · {formatPrice(t.total)}
                    {s.remaining > 0 ? ` · da pagare ${formatPrice(s.remaining)}` : ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  <span className={`pill ${s.settled ? 'chiuso' : 'aperto'}`}>
                    {s.settled ? 'Pagato' : 'Aperto'}
                  </span>
                  {!node.group.has_child_groups && (
                    <button
                      className="btn ghost small"
                      onClick={() => navigate(`/menu?group=${node.group.id}`)}
                    >
                      ✍️
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <input
              type="text"
              placeholder="+ Nuovo gruppo"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crea()}
            />
            <button className="btn small" style={{ flexShrink: 0 }} onClick={crea} disabled={!newName.trim()}>
              Crea
            </button>
          </div>
        </div>
      )}

      {viewGroupId && (
        <GroupView serataId={serataId} groupId={viewGroupId} onClose={() => setViewGroupId(null)} />
      )}
    </div>
  )
}
