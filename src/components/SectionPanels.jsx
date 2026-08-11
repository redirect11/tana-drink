import { useState } from 'react'

// SOTTOSEZIONI DI UNA PAGINA — una convenzione sola per tutto il gestionale.
//
// Ogni sezione ha delle cose che si fanno ogni tanto (le paghe orarie, un
// turno nuovo, le categorie): finivano in fondo alla pagina come tasti
// "mostra/nascondi" tutti diversi, e per trovarle bisognava scorrere fino
// in basso sperando di riconoscerle.
//
// Qui stanno SEMPRE nello stesso posto — subito sotto il titolo — con lo
// stesso aspetto: una fila di tasti; quello premuto apre il suo pannello lì
// sotto, e si richiude premendolo di nuovo o con la ✕. Uno alla volta:
// aprirne un altro chiude il precedente, così la pagina non cresce a
// fisarmonica.
//
// Uso:
//   <SectionPanels panels={[
//     { id: 'paghe', label: '💶 Paghe orarie', render: () => <PagheManager … /> },
//     { id: 'turno', label: '➕ Nuovo turno', desc: '…', render: () => <ShiftForm … /> },
//   ]} />
export default function SectionPanels({ panels = [], attivo = null, onChange = null }) {
  const [interno, setInterno] = useState(null)
  // Controllabile dal genitore (per aprire un pannello da fuori), ma con
  // uno stato suo quando non serve.
  const aperto = onChange ? attivo : interno
  const apri = (id) => {
    const next = aperto === id ? null : id
    if (onChange) onChange(next)
    else setInterno(next)
  }

  const utili = panels.filter(Boolean)
  if (!utili.length) return null
  const corrente = utili.find((p) => p.id === aperto)

  return (
    <>
      <div className="section-panels">
        {utili.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`section-tab${aperto === p.id ? ' active' : ''}`}
            aria-expanded={aperto === p.id}
            onClick={() => apri(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {corrente && (
        <div className="card section-panel">
          <div className="row between" style={{ alignItems: 'center' }}>
            <strong>{corrente.title ?? corrente.label}</strong>
            <button
              className="btn ghost small"
              onClick={() => apri(corrente.id)}
              aria-label="Chiudi"
              title="Chiudi"
            >
              ✕
            </button>
          </div>
          {corrente.desc && (
            <p className="muted small" style={{ margin: '4px 0 8px' }}>
              {corrente.desc}
            </p>
          )}
          {corrente.render()}
        </div>
      )}
    </>
  )
}
