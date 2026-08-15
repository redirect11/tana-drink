import { CategoryRail, IconTag, IconFornitore, IconGrafico, IconSoldi } from 'karaoke-drink'

const niente = () => {}

const CATEGORIE = [
  { key: 'cocktail', label: 'Cocktail', count: 24, color: '#e52e71' },
  { key: 'birre', label: 'Birre', count: 9, color: '#f5b94a' },
  { key: 'analcolici', label: 'Analcolici', count: 6, color: '#2ecc71' },
  { key: 'distillati', label: 'Distillati', count: 31, color: '#7b6cff' },
  { key: 'vini', label: 'Vini', count: 12, color: '#c0392b' },
]

function Contenuto({ titolo }: { titolo: string }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <h3 style={{ marginTop: 0 }}>{titolo}</h3>
      <p className="muted small" style={{ marginBottom: 0 }}>
        Qui sta il pannello della sezione scelta: la lista dei prodotti, il modulo,
        la tabella. La barra a sinistra resta ferma mentre questo cambia.
      </p>
    </div>
  )
}

// L'uso normale nel gestionale: categorie a sinistra col pallino del colore,
// contenuto a destra.
export const ConteggiEColori = () => (
  <CategoryRail items={CATEGORIE} selected="cocktail" onSelect={niente} chiave="anteprima">
    <Contenuto titolo="Cocktail" />
  </CategoryRail>
)

// Con le icone al posto dei pallini: è la forma delle sezioni del gestionale,
// dove le voci non sono categorie di prodotto. Icone disegnate, non emoji —
// su Windows le emoji dell'interfaccia diventano rettangolini storti.
export const ConIcone = () => (
  <CategoryRail
    items={[
      { key: 'categorie', label: 'Categorie', icon: <IconTag /> },
      { key: 'fornitori', label: 'Fornitori', icon: <IconFornitore /> },
      { key: 'statistiche', label: 'Statistiche', icon: <IconGrafico /> },
      { key: 'incassi', label: 'Incassi', icon: <IconSoldi /> },
    ]}
    selected="categorie"
    onSelect={niente}
    chiave="anteprima-icone"
  >
    <Contenuto titolo="Categorie" />
  </CategoryRail>
)
