import CategoryRail from './CategoryRail.jsx'
import { useSottosezioni } from '../lib/sottosezioni.js'

// ── LE SEZIONI DI UNA PAGINA STANNO NELLA PAGINA ─────────────────────
//
// Aperte, a sinistra, come parte del contenuto: la pagina si stringe per
// far loro posto invece di finirci sotto. Un menu che copre quello che si
// sta guardando va aperto, letto e richiuso ogni volta che si cambia
// sezione — e mentre è aperto non si vede più dove si era.
//
// Erano finite tutte nel menu laterale, per non spendere una colonna tutto
// il giorno: il conto però lo pagava chi salta fra Prodotti e Conta venti
// volte di seguito. La risposta giusta è la stessa del POS: la barra resta,
// e chi ha bisogno di spazio la stringe a icone — il « in cima — e se la
// ritrova stretta la volta dopo.
//
// Le sezioni continuano a comparire anche nel menu laterale, sotto la
// pagina aperta (lib/sottosezioni.js): da lì ci si arriva mentre si è
// altrove, qui ci si gira dentro.
//
//   chiave: dove ricordare «stretta o larga». Una per pagina: nelle
//           Impostazioni serve larga (venti nomi lunghi), in Inventario di
//           solito stretta, che dentro c'è già la barra delle categorie.
export default function SezioniPagina({
  voci,
  attiva,
  scegli,
  chiave,
  pieno = true,
  scorre = true,
  children,
}) {
  // Restano dichiarate anche al menu laterale: due strade per la stessa
  // cosa, non due cose diverse.
  useSottosezioni(voci, attiva, scegli)

  return (
    <CategoryRail
      items={voci.map((v) => ({ key: v.id, label: v.label, icon: v.icona }))}
      selected={attiva}
      onSelect={scegli}
      pieno={pieno}
      chiave={chiave}
      scorre={scorre}
    >
      {children}
    </CategoryRail>
  )
}
