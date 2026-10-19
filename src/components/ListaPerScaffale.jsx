import CategoryRail from './CategoryRail.jsx'

// LE RIGHE DI UN INVENTARIO PER SCAFFALE: la barra delle categorie e, sotto,
// i gruppi di `perScaffale` (lib/scaffali.js) col nome della categoria in
// testa quando si guardano tutte. Era scritto tre volte uguale —
// inventario in corso, storico, controllo di prova — e la riga da disegnare
// è l'unica cosa che cambia: la dà chi chiama (`riga(id)`).
export default function ListaPerScaffale({ voci, gruppi, categoria, onSelect, chiave, riga }) {
  const visibili = categoria === 'all' ? gruppi : gruppi.filter((g) => g.key === categoria)
  return (
    <CategoryRail items={voci} selected={categoria} onSelect={onSelect} chiave={chiave}>
      <div className="inv-list">
        {visibili.map((g) => (
          <div key={g.key}>
            {categoria === 'all' && (
              <div className="muted small" style={{ padding: '10px 4px 4px', fontWeight: 600 }}>
                {g.nome}
              </div>
            )}
            {g.ids.map(riga)}
          </div>
        ))}
      </div>
    </CategoryRail>
  )
}
