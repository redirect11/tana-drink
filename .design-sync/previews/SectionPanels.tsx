import { SectionPanels, IconSoldi, IconPiu, IconTag } from 'karaoke-drink'

const niente = () => {}

const PANNELLI = [
  {
    id: 'paghe',
    // Icone disegnate, non emoji: su Windows le emoji dell'interfaccia
    // vengono rese come rettangolini storti.
    label: (
      <>
        <IconSoldi /> Paghe orarie
      </>
    ),
    title: 'Paghe orarie',
    desc: 'Quanto prende ognuno all’ora. Vale da qui in avanti: i turni già chiusi restano com’erano.',
    render: () => (
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        <span className="chip">Ciro · 9,00 €/h</span>
        <span className="chip">Marta · 9,50 €/h</span>
        <span className="chip">Peppe · 8,50 €/h</span>
      </div>
    ),
  },
  {
    id: 'turno',
    label: (
      <>
        <IconPiu /> Nuovo turno
      </>
    ),
    title: 'Nuovo turno',
    render: () => <p className="muted small">Il modulo del turno.</p>,
  },
  {
    id: 'categorie',
    label: (
      <>
        <IconTag /> Categorie
      </>
    ),
    title: 'Categorie',
    render: () => <p className="muted small">Le categorie.</p>,
  },
]

// La fila dei tasti con un pannello aperto: uno alla volta, sempre subito sotto
// il titolo della pagina.
export const ConUnPannelloAperto = () => (
  <SectionPanels panels={PANNELLI} attivo="paghe" onChange={niente} />
)

// Tutti chiusi: la pagina non cresce a fisarmonica, restano solo i tasti.
export const TuttiChiusi = () => <SectionPanels panels={PANNELLI} attivo={null} onChange={niente} />
