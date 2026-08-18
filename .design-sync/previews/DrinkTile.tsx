import { DrinkTile } from 'karaoke-drink'

const niente = () => {}

// Le card della cassa vivono dentro una griglia che ne fissa la larghezza e il
// font-size: tutte le misure della tile sono in em, quindi è la griglia a
// decidere quanto sono grandi. Qui la riproduco per far vedere le tile alla
// misura vera del POS.
function Griglia({ children, colonne = 3 }: { children: React.ReactNode; colonne?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${colonne}, minmax(0, 1fr))`,
        gap: 8,
        fontSize: 16,
        // Larghezza di colonna vicina a quella vera del POS. Più stretta di
        // così i nomi lunghi sbordano dalla card invece di andare a capo: le
        // misure interne sono in em e il nome non ha `min-width: 0`.
        maxWidth: 560,
      }}
    >
      {children}
    </div>
  )
}

const GIN = { id: 'gt', name: 'Gin Tonic', price: 6 }
const NEGRONI = { id: 'ng', name: 'Negroni Sbagliato', price: 8 }
const CERES = { id: 'br', name: 'Ceres', price: 4 }

// Come si presenta la griglia al banco: qualcuno nel conto, qualcuno no.
export const NellaGriglia = () => (
  <Griglia>
    <DrinkTile drink={GIN} qty={2} color="#e52e71" onAdd={niente} onSetQty={niente} />
    <DrinkTile drink={NEGRONI} qty={0} color="#f5b94a" onAdd={niente} onSetQty={niente} />
    <DrinkTile drink={CERES} qty={0} color="#2ecc71" onAdd={niente} onSetQty={niente} />
  </Griglia>
)

// A riposo e nel conto: cambiano bordo, fondo, e compaiono i tastini della
// quantità — lo spazio però era già riservato, quindi la card non si alza.
export const FuoriEDentroIlConto = () => (
  <Griglia>
    <DrinkTile drink={GIN} qty={0} color="#e52e71" onAdd={niente} onSetQty={niente} />
    <DrinkTile drink={GIN} qty={3} color="#e52e71" onAdd={niente} onSetQty={niente} />
  </Griglia>
)

// Con la stella dei preferiti (compare solo passando `onToggleFav`) e la card
// «accesa» dalla ricerca.
export const PreferitiERicerca = () => (
  <Griglia>
    <DrinkTile
      drink={NEGRONI}
      qty={1}
      color="#f5b94a"
      favorite
      onToggleFav={niente}
      onAdd={niente}
      onSetQty={niente}
    />
    <DrinkTile
      drink={CERES}
      qty={0}
      color="#2ecc71"
      favorite={false}
      onToggleFav={niente}
      acceso
      onAdd={niente}
      onSetQty={niente}
    />
  </Griglia>
)

// Senza colore di categoria: niente segnalibro, niente bordo colorato.
export const SenzaCategoria = () => (
  <Griglia>
    <DrinkTile drink={{ id: 'x', name: 'Acqua naturale', price: 1.5 }} qty={0} onAdd={niente} onSetQty={niente} />
    <DrinkTile drink={{ id: 'y', name: 'Caffè', price: 1.2 }} qty={1} onAdd={niente} onSetQty={niente} />
  </Griglia>
)
