import { NOME_PRODOTTO } from '../lib/prodotto.js'

// LE PAGINE LEGALI (REQ-FLOTTA-003). Sono la STRUTTURA dei termini e
// dell'informativa, con quello che il servizio fa davvero: vanno riviste
// con un consulente prima di vendere, e il titolare del trattamento va
// scritto con i dati della società che vende il prodotto.

const TITOLARE = {
  nome: '[Ragione sociale del fornitore]',
  indirizzo: '[Sede legale]',
  email: '[email di contatto]',
}

export function Termini() {
  return (
    <main className="pagina legale">
      <h1>Termini di servizio</h1>
      <p className="muted small">Ultimo aggiornamento: 22 ottobre 2026</p>
      <h2>1. Il servizio</h2>
      <p>
        {NOME_PRODOTTO} è un software per la gestione di cassa, comande, magazzino e statistiche di un locale, fornito da{' '}
        {TITOLARE.nome} ({TITOLARE.indirizzo}) in abbonamento. Per ogni locale viene attivata un’installazione separata, con un
        proprio archivio dati, raggiungibile da un indirizzo web dedicato.
      </p>
      <h2>2. Registrazione e account</h2>
      <p>
        Il servizio è riservato a imprese e professionisti. Chi si registra dichiara di agire per conto del locale indicato e di
        avere il potere di impegnarlo. L’account è personale: le credenziali non vanno condivise, e il titolare risponde dell’uso
        che ne viene fatto.
      </p>
      <h2>3. Abbonamento, prezzi e pagamenti</h2>
      <p>
        I prezzi sono quelli pubblicati nella pagina dei piani al momento della sottoscrizione, al mese, IVA esclusa, oltre al
        costo di attivazione una tantum. Il pagamento avviene tramite il fornitore di pagamenti indicato. La fattura viene
        emessa ai dati di fatturazione forniti in registrazione. Il mancato pagamento sospende il servizio dopo il termine
        indicato nell’avviso.
      </p>
      <h2>4. Cosa il servizio non fa</h2>
      <p>
        Lo scontrino stampato dall’app non è uno scontrino fiscale: gli adempimenti fiscali restano a carico del locale, con il
        proprio registratore telematico. Il servizio non sostituisce la contabilità del locale.
      </p>
      <h2>5. Disponibilità e assistenza</h2>
      <p>
        Il servizio è fornito con cura ma senza garanzia di continuità assoluta. Gli aggiornamenti vengono pubblicati senza
        preavviso e senza interruzioni programmate. L’assistenza è disponibile via email a {TITOLARE.email}, nei tempi indicati
        nel piano.
      </p>
      <h2>6. Dati del locale</h2>
      <p>
        I dati inseriti nell’app (ordini, magazzino, incassi, personale) sono del locale, che ne è titolare. Il fornitore li
        tratta solo per erogare il servizio. Alla cessazione, il locale può chiedere l’esportazione dei dati; l’installazione
        viene chiusa dopo 30 giorni.
      </p>
      <h2>7. Recesso e disdetta</h2>
      <p>
        L’abbonamento si disdice in qualunque momento dalla propria pagina; il servizio resta attivo fino alla fine del periodo
        già pagato. Il fornitore può interrompere il servizio in caso di uso contrario a questi termini, con preavviso scritto.
      </p>
      <h2>8. Legge e foro</h2>
      <p>Questi termini sono regolati dalla legge italiana. Per ogni controversia è competente il foro della sede del fornitore.</p>
    </main>
  )
}

export function Privacy() {
  return (
    <main className="pagina legale">
      <h1>Informativa sulla privacy</h1>
      <p className="muted small">Ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679. Ultimo aggiornamento: 22 ottobre 2026</p>
      <h2>Titolare del trattamento</h2>
      <p>
        {TITOLARE.nome}, {TITOLARE.indirizzo}, {TITOLARE.email}.
      </p>
      <h2>Quali dati e perché</h2>
      <p>
        Dati dell’account (email, password cifrata), del locale (nome, indirizzo, telefono), di fatturazione (ragione sociale,
        partita IVA, codice fiscale, PEC o codice destinatario, sede legale) e del referente (nome, cognome, ruolo, telefono).
        Servono a erogare il servizio, emettere fattura e dare assistenza: la base è il contratto. Con il consenso, facoltativo
        e revocabile, inviamo le novità del prodotto.
      </p>
      <h2>Dove stanno e per quanto</h2>
      <p>
        I dati sono conservati su infrastruttura Google Cloud nella regione europea, per la durata del contratto e per i
        termini di legge sulla fatturazione (dieci anni per i documenti fiscali). I dati operativi del locale stanno in
        un’installazione separata di cui il locale è titolare, e il fornitore agisce da responsabile del trattamento.
      </p>
      <h2>A chi vengono comunicati</h2>
      <p>
        Al fornitore dei pagamenti per la gestione dell’abbonamento e a Google Cloud per l’hosting, in qualità di responsabili.
        Non vengono venduti né ceduti ad altri.
      </p>
      <h2>I tuoi diritti</h2>
      <p>
        Accesso, rettifica, cancellazione, limitazione, portabilità e opposizione, scrivendo a {TITOLARE.email}. È possibile
        proporre reclamo al Garante per la protezione dei dati personali.
      </p>
    </main>
  )
}
