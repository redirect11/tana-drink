import { useState } from 'react'
import { loadPrinterSettings, savePrinterSettings, ORIGINI_STAMPA } from '../lib/printer.js'
import { savePrinterConfig } from '../lib/api.js'
import {
  CHIAVE_ACCONTO_SEMPRE,
  CHIAVE_TASTO_ACCONTO,
  accontoSempre,
  tastoAcconto,
} from '../lib/scontrinoAcconto.js'
import ToggleRow from './ToggleRow.jsx'
import { comandeConsentite } from '../lib/limiti.js'
import GruppoChip from './GruppoChip.jsx'
import Icona from './Icona.jsx'
import { tr, trSegnato } from '../lib/lingua.js'

// Le provenienze di una stampa (Banco e sala, Solo dal banco…) nella lingua
// di chi guarda: le etichette nascono in lib/printer.js.
const origini = () => ORIGINI_STAMPA.map((o) => ({ ...o, label: trSegnato(o.label) }))

// ── QUANDO PARTE LA CARTA DA SÉ (REQ-UI-025) ─────────────────────────
//
// «Questo setting è in cassa e giornata mentre le altre impostazioni di
// stampa automatica sono in stampante. Perché hai scelto di metterla lì?
// Le impostazioni di stampa automatica riguardano la cassa, quindi anche
// le impostazioni di stampa automatiche spostale in cassa» (l'utente,
// 22/08/2026).
//
// Il criterio è suo e vale in generale: le impostazioni si raggruppano per
// MOMENTO D'USO, non per pezzo tecnico. «Stampante» è la macchina —
// indirizzo, prova di stampa, i dati che finiscono sulla carta; QUANDO la
// carta esce da sé è una faccenda dell'incasso, e chi la cerca apre la
// cassa. È lo stesso principio di REQ-UI-024 («tutto ciò che riguarda
// l'aspetto sta sotto Aspetto») applicato a un'altra famiglia.
//
// LE DUE FAMIGLIE SI DICONO A SCHERMO. Gli interruttori qui dentro non
// hanno tutti la stessa portata: due vivono nelle impostazioni della
// STAMPANTE di questo terminale (REQ-STAMPA-010: l'indirizzo dipende da
// dove sei, e la stampa automatica la vuole accesa chi sta al banco, non
// chi passa a battere due conti), gli altri stanno sulle impostazioni del
// BAR e valgono per tutti. Lasciarlo indovinare vorrebbe dire accendere
// una cosa al banco e stupirsi che in sala non sia cambiato niente.
export default function StampaAutomatica({ settings, save }) {
  const [prn, setPrn] = useState(() => loadPrinterSettings())
  // Nel piano senza comande (REQ-LIC-005) resta solo lo scontrino.
  const comandeOn = comandeConsentite(settings)

  // LOCAL-FIRST, come ogni altra cosa qui: si scrive subito nella memoria
  // del terminale (che è chi legge queste impostazioni al momento di
  // stampare) e si manda la copia al server in sottofondo, senza aspettare
  // — il mirror su Firestore esiste perché Safari, dopo giorni di
  // inattività, svuota il localStorage della PWA e l'interruttore si
  // perderebbe.
  const cambia = (patch) => {
    setPrn(savePrinterSettings(patch))
    savePrinterConfig(patch)
  }

  return (
    <div className="card settings-section">
      <h3>{tr('Stampa automatica')}</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
        {tr(
          'Le stampe che escono da sole, senza premere un tasto. Indirizzo della stampante, prova di stampa e dati sulla carta stanno in Impostazioni → Stampante.'
        )}
      </p>

      {/* ── Quello che decide questo tablet ── */}
      <h4 style={{ margin: '18px 0 2px' }}>{tr('Su questo terminale')}</h4>
      <p className="muted" style={{ margin: '0 0 8px', fontSize: '0.8rem' }}>
        {tr('Valgono per questo dispositivo e per chi ci è collegato.')}
      </p>

      {comandeOn && (
        <>
          <ToggleRow
            label={tr('Stampa la comanda all’arrivo dell’ordine')}
            desc={tr("La comanda si stampa appena l'ordine entra in coda, senza premere «Comanda».")}
            checked={prn.autoPrintComanda === true}
            onChange={(v) => cambia({ autoPrintComanda: v })}
          />
          {/* DA DOVE (REQ-STAMPA-021): sotto l'interruttore che riguarda, e solo
              se è acceso — una scelta su una stampa spenta non decide niente. */}
          {prn.autoPrintComanda === true && (
            <div className="stampa-da">
              <span className="muted small">{tr('Comande prese')}</span>
              <GruppoChip
                etichetta={tr('Comande prese')}
                opzioni={origini()}
                valore={prn.autoPrintComandaDa || 'tutti'}
                scegli={(v) => cambia({ autoPrintComandaDa: v })}
              />
            </div>
          )}
        </>
      )}

      {/* Diceva «quando l'ordine è pronto», ma la stampa da tempo parte alla
          CHIUSURA: l'etichetta descriveva il comportamento di due versioni fa. */}
      <ToggleRow
        label={tr('Stampa lo scontrino alla riscossione del conto')}
        desc={tr('Lo scontrino si stampa quando il conto è incassato e chiuso.')}
        checked={prn.autoPrintScontrino === true}
        onChange={(v) => cambia({ autoPrintScontrino: v })}
      />
      {prn.autoPrintScontrino === true && (
        <div className="stampa-da">
          <span className="muted small">{tr('Riscossioni fatte')}</span>
          <GruppoChip
            etichetta={tr('Riscossioni fatte')}
            opzioni={origini()}
            valore={prn.autoPrintScontrinoDa || 'tutti'}
            scegli={(v) => cambia({ autoPrintScontrinoDa: v })}
          />
        </div>
      )}
      <p className="muted" style={{ margin: '0 0 8px', fontSize: '0.8rem' }}>
        {tr('Banco: admin e bartender. Sala: il personale di sala e gli ordini dal menù dei clienti.')}
      </p>

      {/* CHI STAMPA LE COMANDE PRESE IN SALA sta qui e non fra le cose della
          macchina: è la stessa domanda degli interruttori qui sopra — la
          comanda esce da sé, e da dove — e l'avviso qui sotto guarda proprio
          l'interruttore della comanda. Separarli vorrebbe dire un avviso che
          parla di un interruttore che non è in pagina. */}
      {comandeOn && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tr('Comande prese in sala')}</div>
          {/* La sala l'IP ce l'ha (la configurazione arriva a tutti i dispositivi
              dal server): quello che si decide qui è se i telefoni parlino con la
              stampante o se la comanda esca al banco. */}
          <div className="mode-choice" style={{ marginTop: 6 }}>
            <button
              type="button"
              className={`mode-option${prn.stampaSala !== 'rimbalzo' ? ' active' : ''}`}
              onClick={() => cambia({ stampaSala: 'ip' })}
            >
              <Icona nome="telefono" gruppo="tasti" /> {tr('La stampa il telefono')}
            </button>
            <button
              type="button"
              className={`mode-option${prn.stampaSala === 'rimbalzo' ? ' active' : ''}`}
              onClick={() => cambia({ stampaSala: 'rimbalzo' })}
            >
              <Icona nome="stampante" gruppo="tasti" /> {tr('La stampa il banco')}
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.8rem', margin: '8px 0 0' }}>
            {prn.stampaSala === 'rimbalzo'
              ? tr(
                  'La comanda esce al banco appena arriva l’ordine. Serve che al banco un terminale tenga aperta la coda ordini con la stampa automatica accesa.'
                )
              : tr(
                  'Chi prende l’ordine al tavolo stampa la comanda dal suo telefono. La prima volta, su ogni telefono, va accettato l’avviso di sicurezza della stampante: il pallino nella coda ordini dice se funziona.'
                )}
          </p>

          {/* Scegliere "la stampa il banco" e lasciare spenta la stampa
              automatica vuol dire: non stampa nessuno. È successo. */}
          {prn.stampaSala === 'rimbalzo' && !prn.autoPrintComanda && (
            <div className="banner" style={{ marginTop: 8 }}>
              <Icona nome="avviso" gruppo="segnali" />{' '}
              {tr(
                'La stampa automatica della comanda è spenta: così le comande della sala non le stampa nessuno. Si accende qui sopra.'
              )}
            </div>
          )}
          {/* Lo stesso buco per un'altra strada: la stampa è accesa, ma solo
              per le comande del banco (REQ-STAMPA-021). */}
          {prn.stampaSala === 'rimbalzo' && prn.autoPrintComanda && prn.autoPrintComandaDa === 'banco' && (
            <div className="banner" style={{ marginTop: 8 }}>
              <Icona nome="avviso" gruppo="segnali" />{' '}
              {tr('La comanda automatica è impostata solo dal banco: così le comande della sala non le stampa nessuno.')}
            </div>
          )}
        </div>
      )}

      {/* ── Quello che vale per tutti ── */}
      <h4 style={{ margin: '22px 0 2px' }}>{tr('Per tutto il locale')}</h4>
      <p className="muted" style={{ margin: '0 0 8px', fontSize: '0.8rem' }}>
        {tr('Valgono su ogni terminale del locale.')}
      </p>

      {/* ── LO SCONTRINO D'ACCONTO (REQ-STAMPA-015) ──────────────────────
          Arriva da «Pagamenti», e ci arriva per la regola di questa scheda:
          «esce da sola a ogni riscossione» è stampa automatica, punto. Il
          suo gemello col tasto lo segue perché uno SPEGNE l'altro, e due
          interruttori legati così si guardano insieme o non si capiscono. */}
      <ToggleRow
        label={tr('Lo scontrino d’acconto a ogni riscossione')}
        desc={tr(
          'A ogni incasso che non chiude il conto si stampa la ricevuta d’acconto. Segue la stampa automatica dello scontrino di questo terminale, qui sopra.'
        )}
        checked={accontoSempre(settings)}
        onChange={(v) => save({ [CHIAVE_ACCONTO_SEMPRE]: v })}
      />

      {/* L'INTERRUTTORE DISABILITATO RESTA IN PAGINA, spento e col suo
          perché. «Quando la riscossione dello scontrino di acconto è attiva,
          disabilita l'opzione del terzo bottone» (l'utente, 21/08/2026):
          farlo SPARIRE sembrerebbe un guasto — «l'avevo acceso, dov'è
          finito?» — e chi torna qui per spegnere l'automatico non capirebbe
          cosa ha perso. */}
      <ToggleRow
        label={tr('Un tasto per l’acconto con lo scontrino')}
        desc={
          accontoSempre(settings)
            ? tr(
                'Non disponibile: la ricevuta d’acconto si stampa già a ogni riscossione, qui sopra. Spenta quella, il tasto torna disponibile.'
              )
            : tr(
                'Aggiunge alla schermata di pagamento «Acconto con scontrino», che incassa una parte del conto e ne stampa la ricevuta.'
              )
        }
        checked={tastoAcconto(settings)}
        disabled={accontoSempre(settings)}
        onChange={(v) => save({ [CHIAVE_TASTO_ACCONTO]: v })}
      />
    </div>
  )
}
