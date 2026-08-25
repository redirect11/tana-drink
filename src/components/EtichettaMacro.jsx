// ── A QUALE MACRO APPARTIENE QUESTA CATEGORIA ────────────────────────
// ALTRO (magazzino) e BOTTIGLIE (menù) restano fuori dalle macro ed è una
// scelta: non si forzano dentro un gruppo per far tornare un elenco. Da lì
// nasce il bisogno opposto — capire in un attimo quali categorie sono
// fuori, perché una fuori APPOSTA e una dimenticata si somigliano troppo.
//
// «Senza macro» HA LO STESSO PESO del nome di una macro: non è un errore, è
// un fatto. Niente rosso, che in questa app vuol dire annullato o sbagliato
// (DESIGN.md), e niente punto esclamativo: chi ha lasciato ALTRO fuori
// apposta non deve vedersi rimproverare ogni volta che apre la lista.
export default function EtichettaMacro({ macro }) {
  return (
    <span className={`etichetta-macro${macro ? '' : ' senza'}`}>
      {macro ? macro.name : 'senza macro'}
    </span>
  )
}
