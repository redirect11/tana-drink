// UNA FUNZIONE CHE IL LOCALE NON HA (REQ-LIC-002). Chi arriva a una pagina
// di un modulo non incluso — un cliente col vecchio QR del menù, un link
// salvato — trova una frase piana, non un errore: cosa manca e dove si
// aggiunge. Il piano si cambia dalla pagina del prodotto (REQ-FLOTTA-010).
// SPENTO DAL LOCALE (14/11/2026): il modulo è nel piano ma il gestore l'ha
// spento in Impostazioni (il menù dei clienti). Allora non si parla di
// piano: al cliente basta sapere che adesso non c'è.
export default function FunzioneNonInclusa({ nome, licenza, spentoDalLocale = false }) {
  if (spentoDalLocale) {
    return (
      <main className="funzione-non-inclusa">
        <div className="card">
          <h2>{nome} non è disponibile</h2>
          <p className="muted">Il locale non lo offre in questo momento.</p>
        </div>
      </main>
    )
  }
  return (
    <main className="funzione-non-inclusa">
      <div className="card">
        <h2>{nome} non è attivo</h2>
        <p className="muted">Questa funzione non fa parte del piano di questo locale.</p>
        {licenza?.regia_url && (
          <a className="btn" href={licenza.regia_url}>
            Aggiungila dalla pagina del prodotto
          </a>
        )}
      </div>
    </main>
  )
}
