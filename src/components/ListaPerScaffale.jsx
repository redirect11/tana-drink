import CategoryRail from './CategoryRail.jsx'
import { tr } from '../lib/lingua.js'

// Le due voci che non sono categorie del locale, «Tutte» e «Senza
// categoria», arrivano da lib/scaffali.js in italiano: si nominano qui per
// chiave, nella lingua di chi guarda (REQ-UI-039). Le altre sono nomi dati
// dal locale, e restano come sono.
const nomeDi = (key, nome) => (key === 'all' ? tr('Tutte') : key === 'none' ? tr('Senza categoria') : nome)

// LE RIGHE DI UN INVENTARIO PER SCAFFALE: la barra delle categorie e, sotto,
// i gruppi di `perScaffale` (lib/scaffali.js) col nome della categoria in
// testa quando si guardano tutte. Era scritto tre volte uguale —
// inventario in corso, storico, controllo di prova — e la riga da disegnare
// è l'unica cosa che cambia: la dà chi chiama (`riga(id)`).
export default function ListaPerScaffale({ voci, gruppi, categoria, onSelect, chiave, riga }) {
  const visibili = categoria === 'all' ? gruppi : gruppi.filter((g) => g.key === categoria)
  return (
    <CategoryRail
      items={voci.map((v) => ({ ...v, label: nomeDi(v.key, v.label) }))}
      selected={categoria}
      onSelect={onSelect}
      chiave={chiave}
    >
      <div className="inv-list">
        {visibili.map((g) => (
          <div key={g.key}>
            {categoria === 'all' && (
              <div className="muted small" style={{ padding: '10px 4px 4px', fontWeight: 600 }}>
                {nomeDi(g.key, g.nome)}
              </div>
            )}
            {g.ids.map(riga)}
          </div>
        ))}
      </div>
    </CategoryRail>
  )
}
