import { useEffect, useRef, useState } from 'react'
import {
  subscribeSettings,
  updateSettings,
  replaceCatalog,
  resetOpenOrdersToReceived,
} from '../lib/api.js'
import { CANCEL_PHRASES } from '../lib/orderStatus.js'
import {
  MODI_CONSEGNA,
  clienteSceglie,
  fraseAnnulloDefault,
  fraseAnnulloPossibile,
  modoAllaNascita,
  mondoConsegna,
} from '../lib/consegna.js'
import { parseCarteCsv, decodeCsvBuffer } from '../lib/carteImport.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import ThemeSettings, { TemaMenuClienti } from './ThemeSettings.jsx'
import IdentitaLocale from './IdentitaLocale.jsx'
import PrinterSetup from './PrinterSetup.jsx'
import StampaAutomatica from './StampaAutomatica.jsx'
import ToggleRow from './ToggleRow.jsx'
import {
  MOTIVO_PREMIUM,
  chiaveModulo,
  moduliPremium,
  moduloAttivo,
  moduloIncluso,
  basiMancanti,
  scadenzaProva,
  sumupDisponibile,
} from '../lib/licenza.js'
import { MESSAGGI_PIANO, profiloLeggero, stampaConsentita, servizioAttivo, comandeConsentite } from '../lib/limiti.js'
import AvvisoPiano from './AvvisoPiano.jsx'
import CampiStampa, { LogoStampe } from './CampiStampa.jsx'

import BackupPanel from './BackupPanel.jsx'
import InfoTab from './InfoTab.jsx'
import LicenzaPanel from './LicenzaPanel.jsx'
import { isAdmin } from '../lib/ruoli.js'
import { pairSumUpReader, unpairSumUpReader } from '../lib/paymentsApi.js'
import { Link } from 'react-router-dom'
import { devToolsEnabled } from '../dev/devActions.js'
import { Sottosezioni } from '../lib/sottosezioni.js'
import { MODI_STRISCIA, MODO_STRISCIA_DEFAULT } from '../lib/strisce.js'
import { usePaginaPiena } from '../lib/paginaPiena.js'
import { cambioDentroOrario } from '../lib/orario.js'
import { drinkCostDi, ricaricoDaDrinkCost } from '../lib/pricing.js'
import Icona, { ConIcona } from './Icona.jsx'
import { conEmoji, dividiIcona } from '../lib/icone.js'
import { tr, daTradurre, trSegnato, formatoAttivo } from '../lib/lingua.js'
import FormatoPrezziMenu from './FormatoPrezziMenu.jsx'
import CreditoAI from './CreditoAI.jsx'
import { aiRaggiungibile } from '../lib/aiApi.js'
import { minutiAttesa } from '../lib/attesaCliente.js'

// Impostazioni del bar (documento settings/bar). Ogni modifica viene salvata
// subito; le pagine cliente le ricevono in tempo reale via subscribeSettings.
// Le sezioni che hanno senso solo se il piano comprende la stampa
// (REQ-LIC-016) o le comande (REQ-LIC-005).
const SOLO_CON_STAMPA = new Set(['stampa-automatica', 'campi-scontrino', 'campi-comanda', 'campi-acconto', 'logo-stampe'])
const SOLO_CON_COMANDE = new Set(['tempi', 'campi-comanda'])
// I nomi dei due modi di consegna, nella lingua di chi lavora (vedi
// modiConsegna più sotto). Il contesto perché «Servizio» nel conto è anche
// il costo di servizio.
const NOME_MODO = {
  tavolo: daTradurre('consegna|Servizio'),
  banco: daTradurre('consegna|Ritiro'),
}

export default function SettingsTab({ role = null }) {
  // La schermata sta tutta nella finestra: scorre la sezione aperta, non la
  // pagina con dentro la testata.
  usePaginaPiena()
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)
  const [confermaSpegni, setConfermaSpegni] = useState(false) // gestione preparazione
  const [esitoReset, setEsitoReset] = useState(null)
  // Sezione aperta: si ricorda, perché a impostazioni si torna sempre per
  // lo stesso motivo (di solito gli orari o i pagamenti).
  // …ma un collegamento può chiedere una sezione precisa (?sezione=…): ci
  // arriva la notifica «l'app è cambiata», che deve aprire le Informazioni e
  // non l'ultima sezione guardata.
  const [sezione, setSezione] = useState(() => {
    try {
      const chiesta = new URLSearchParams(window.location.search).get('sezione')
      if (chiesta) return chiesta
      return localStorage.getItem('drink:impostazioni:sezione') || 'aspetto'
    } catch {
      return 'aspetto'
    }
  })
  const scegliSezione = (id) => {
    setSezione(id)
    try {
      localStorage.setItem('drink:impostazioni:sezione', id)
    } catch {
      /* niente memoria: vale per questa volta */
    }
  }

  useEffect(() => {
    return subscribeSettings(
      (s) => setSettings(s),
      (e) => setError(e.message)
    )
  }, [])

  async function save(patch) {
    setError(null)
    // Aggiornamento ottimistico: il listener riallinea comunque dal server.
    setSettings((s) => ({ ...s, ...patch }))
    try {
      await updateSettings(patch)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!settings) return <div className="empty">{tr('Carico le impostazioni…')}</div>

  // OGNI RIQUADRO UNA SCHEDA. Erano venti riquadri uno sotto l'altro in una
  // pagina lunghissima: per cambiare l'orario di chiusura si scorreva
  // oltre pagamenti, gruppi, sconti e coperto, e quello che si cercava lo
  // si trovava a occhio. Con la barra a sinistra (la stessa di Inventario
  // e Menù) si va dritti dove serve, e la scelta resta per la volta dopo.
  // Il piano (REQ-LIC-016, REQ-LIC-005): senza stampa le sezioni della
  // carta non ci sono e al posto della stampante c'è la frase del piano;
  // senza comande lo stesso per la preparazione, e se ne vanno tempi di
  // servizio e campi della comanda.
  const stampaOn = stampaConsentita(settings)
  // I MODI DI CONSEGNA arrivano da lib/consegna.js con l'icona già davanti
  // al nome (conEmoji): un testo così non è una chiave del dizionario. Si
  // tiene l'icona e si mette il nome tradotto, come in ScegliConsegna.
  const modiConsegna = MODI_CONSEGNA.map(([id, etichetta]) => {
    const diviso = dividiIcona(etichetta)
    return [id, diviso && NOME_MODO[id] ? conEmoji(diviso.nome, trSegnato(NOME_MODO[id])) : etichetta]
  })
  const comandeOn = comandeConsentite(settings)
  const servizioOn = servizioAttivo(settings)
  const tutteLeSezioni = [
    { id: 'aspetto', icona: 'temi', label: tr('Aspetto'), nodo: <ThemeSettings settings={settings} onSave={save} /> },
    // IL MARKETPLACE DEI TEMI (REQ-MENU-023) è una pagina sua, nel menu
    // laterale: qui, accanto ai colori, solo la strada per arrivarci.
    {
      id: 'marketplace-temi',
      icona: 'marketplace',
      label: tr('Marketplace dei temi'),
      nodo: (
        <div className="card settings-section">
          <h3>{tr('Marketplace dei temi')}</h3>
          <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
            {tr('Il catalogo dei temi e degli stili del menù dei clienti: si provano sul proprio menù e si installano.')}
          </p>
          <Link className="btn small" to="/bar?tab=marketplace">
            {tr('Apri il marketplace')}
          </Link>
        </div>
      ),
    },
    // L'identità del locale (REQ-VENUE-001): vuota vale la build.
    { id: 'locale', icona: 'categorie', label: tr('Il locale'), nodo: <IdentitaLocale settings={settings} onSave={save} /> },
    {
      id: 'vista-ordine',
      icona: 'coda',
      label: tr('Vista ordine'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Vista ordine (bartender)')}</h3>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
                {tr('Un prodotto toccato nella griglia aggiunge sempre una riga nuova al conto; la quantità si aumenta col + sulla riga.')}
              </p>

              <p className="muted" style={{ margin: '12px 0 6px', fontSize: '0.85rem' }}>
                {tr('Dove finisce l’item appena aggiunto nella lista del conto.')}
              </p>
              <SceltaModo
                valore={!!settings.pos_add_top}
                opzioni={[
                  [false, conEmoji('giu', tr('In fondo (scorre)'))],
                  [true, conEmoji('su', tr('In cima'))],
                ]}
                onScegli={(v) => save({ pos_add_top: v })}
              />

              {/* LA ⓘ DELLE RICETTE. Dove il listino lo sanno tutti a memoria
                  è un segno in più su ogni card, e le card sono cento. Dove
                  invece cambia spesso, o si dà una mano il sabato, è la
                  differenza fra saper fare un drink e doverlo chiedere. */}
              <ToggleRow
                label={tr('La ⓘ con la ricetta sulle card')}
                desc={tr('Sulle card della griglia, una ⓘ che apre ingredienti, quantità e preparazione del drink.')}
                checked={settings.pos_ricetta_info !== false}
                onChange={(v) => save({ pos_ricetta_info: v })}
              />

              <p className="muted" style={{ margin: '12px 0 6px', fontSize: '0.85rem' }}>
                {tr('Dimensione minima del testo delle righe del conto; sopra questa soglia il testo segue la larghezza del pannello.')}
              </p>
              <SceltaModo
                colonne="1fr 1fr 1fr 1fr"
                valore={Number(settings.pos_testo_min) || 1.1}
                opzioni={[
                  [0.85, tr('Piccolo')],
                  [1, tr('Medio')],
                  [1.1, tr('Grande')],
                  [1.25, tr('Extra')],
                ]}
                onScegli={(v) => save({ pos_testo_min: v })}
              />

              <p className="muted" style={{ margin: '12px 0 6px', fontSize: '0.85rem' }}>
                {tr('Come compaiono le categorie nella barra laterale del POS. Icona e colore si impostano in Menù → Categorie; una categoria senza icona mostra il pallino colore.')}
              </p>
              <SceltaModo
                colonne="1fr 1fr 1fr"
                valore={settings.category_display || 'dot'}
                opzioni={[
                  ['dot', tr('● Pallino + nome')],
                  ['icon_text', conEmoji('menu', tr('Icona + nome'))],
                  ['icon', conEmoji('menu', tr('Solo icona (senza nome)'))],
                ]}
                onScegli={(v) => save({ category_display: v })}
              />

              <h4>{tr('La ricerca nella griglia dei prodotti')}</h4>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
                {tr('La ricerca filtra la griglia, lasciando le sole card trovate, oppure la lascia intera e accende la prima card trovata, cercando in tutte le categorie. Toccando una card la ricerca si azzera.')}
              </p>
              <SceltaModo
                valore={settings.pos_search || 'filtra'}
                opzioni={[
                  ['filtra', conEmoji('cerca', tr('Filtra la griglia'))],
                  ['evidenzia', conEmoji('evidenzia', tr('Evidenzia il primo prodotto trovato'))],
                ]}
                onScegli={(v) => save({ pos_search: v })}
              />

              {/* LA STRISCIA A SINISTRA DELLE CARD. È lo stesso segno in due
                  schermate e finora diceva una cosa decisa da noi: dipende
                  invece da come si lavora. */}
              {/* SOLO LA DOMANDA. Il perché — chi conosce il listino a
                  memoria vuole i colori, chi sta finendo le bottiglie
                  vuole vedere cosa non si può più fare — sta nel requisito
                  e in lib/strisce.js. E dove sta l'altra impostazione lo
                  si scopre andandoci: scriverlo qui è una nota per noi,
                  non per chi sceglie. */}
              <h4>{tr('Cosa dice la riga a sinistra di ogni scheda della griglia?')}</h4>
              <SceltaModo
                colonne="1fr 1fr"
                valore={settings.stripe_pos || MODO_STRISCIA_DEFAULT}
                opzioni={MODI_STRISCIA.map((m) => [m.id, trSegnato(m.label), trSegnato(m.desc)])}
                onScegli={(v) => save({ stripe_pos: v })}
              />

              <p className="muted small" style={{ margin: '12px 0 4px' }}>
                {tr('Quale colore per «ci sono abbastanza scorte»?')}
              </p>
              <SceltaModo
                valore={!!settings.stripe_ok_verde}
                opzioni={[
                  [false, conEmoji('spento', tr('Grigio'))],
                  [true, conEmoji('verde', tr('Verde'))],
                ]}
                onScegli={(v) => save({ stripe_ok_verde: v })}
              />
            </div>
      ),
    },
    {
      id: 'consegna',
      icona: 'campanello',
      label: tr('Consegna ordine'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Consegna ordine')}</h3>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
                {tr('Come si consegnano gli ordini nel locale. Sul singolo conto servizio o ritiro si cambiano comunque da «Dati conto».')}
              </p>
              <SceltaModo
                valore={mondoConsegna(settings)}
                opzioni={[
                  ['tavolo', conEmoji('menu', tr('Solo servizio')), tr('Si porta tutto al tavolo.')],
                  [
                    'entrambi',
                    conEmoji('in-coppia', tr('Ritiro e servizio')),
                    tr('Servizio al tavolo o ritiro al banco, conto per conto.'),
                  ],
                ]}
                onScegli={(v) => save({ service_mode: v })}
              />

              {/* DENTRO IL SECONDO MONDO, e solo lì: col solo servizio non
                  c'è niente da scegliere e niente da far scegliere. */}
              {mondoConsegna(settings) === 'entrambi' && (
                <>
                  <h4>{tr('Come nascono i conti')}</h4>
                  <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
                    {tr('Il modo di consegna con cui nasce un conto battuto al banco o in sala. Il ritiro azzera coperto e costo di servizio.')}
                  </p>
                  <SceltaModo
                    valore={modoAllaNascita(settings)}
                    opzioni={modiConsegna}
                    onScegli={(v) => save({ consegna_default: v })}
                  />

                  {/* CHI SCEGLIE, non cosa si sceglie: senza ordinazioni dei
                      clienti non c'è nessuno a cui chiederlo, e la voce si
                      spegne dicendo perché invece di restare lì a mentire. */}
                  <ToggleRow
                    label={tr('Lo sceglie il cliente')}
                    desc={
                      settings.menu_only ? (
                        <>
                          {tr('Non disponibile con «Solo menù»: i clienti non ordinano.')}{' '}
                          <button
                            type="button"
                            className="link-inline"
                            onClick={() => scegliSezione('menu-clienti')}
                          >
                            {tr('Vai a Menù clienti')}
                          </button>
                        </>
                      ) : (
                        tr('Ordinando dal telefono, il cliente sceglie fra servizio al tavolo e ritiro al banco. Spenta, decide il locale.')
                      )
                    }
                    checked={clienteSceglie(settings)}
                    disabled={settings.menu_only === true}
                    onChange={(v) => save({ cliente_sceglie_consegna: v })}
                  />
                </>
              )}
            </div>
      ),
    },
    {
      id: 'pagamenti',
      icona: 'carta',
      label: tr('Pagamenti'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Pagamenti')}</h3>
              {/* STA QUI E NON IN «GESTIONE PREPARAZIONE»: parla di come si
                  incassa, e chi lo cerca apre Pagamenti — c'era finito
                  accanto a «Riscuoti e servi» per parentela di forma, e
                  l'utente non lo trovava. */}
              {/* IL RESTO IN CONTANTI (REQ-PAG-015): sta coi tasti
                  dell'incasso, perché compare dove si incassa. */}
              <ToggleRow
                label={tr('Calcolo del resto in contanti')}
                desc={tr('Pagando in contanti, si indica quanto ha dato il cliente e compare il resto da dare.')}
                checked={settings.resto_contanti === true}
                onChange={(v) => save({ resto_contanti: v })}
              />
              {stampaOn && (
                <ToggleRow
                  label={tr('Un tasto per incassare senza stampare')}
                  desc={tr('Aggiunge alla schermata di pagamento «Riscuoti (senza stampa)», che incassa e chiude il conto senza stampare lo scontrino.')}
                  checked={settings.riscuoti_senza_stampa === true}
                  onChange={(v) => save({ riscuoti_senza_stampa: v })}
                />
              )}
              {/* E ADESSO ANCHE IL SUO GEMELLO, PER LO STESSO IDENTICO
                  MOTIVO. Stava in «Gestione preparazione» e l'utente non
                  l'ha trovato (21/08/2026) — già successo il 20/08 con
                  quello qui sopra. I due tasti compaiono nella stessa
                  schermata, uno accanto all'altro: si accendono nello
                  stesso posto.
                  LA CONDIZIONE SE L'È PORTATA DIETRO: «servire» esiste solo
                  se si seguono i passi del servizio. Col servizio spento
                  il tasto non comparirebbe comunque, e un interruttore che
                  non fa niente è peggio di uno assente. */}
              {servizioOn && (
                <ToggleRow
                  label={tr('Un tasto per incassare e servire insieme')}
                  desc={tr('Aggiunge alla schermata di pagamento «Riscuoti e servi», che incassa, segna il conto come servito e lo chiude.')}
                  checked={settings.riscuoti_e_servi === true}
                  onChange={(v) => save({ riscuoti_e_servi: v })}
                />
              )}
              {/* LO SCONTRINO D'ACCONTO NON È PIÙ QUI: «esce da sola a ogni
                  riscossione» è stampa automatica, e sta nel riquadro qui
                  sotto insieme a tutte le altre (REQ-UI-025). Resta nella
                  stessa sezione, a uno scorrimento di distanza, quindi la
                  lezione di BUG-070 — gli interruttori dei tasti
                  dell'incasso si accendono dove si incassa — regge. */}
              {/* SUMUP VUOLE LE FUNCTIONS (REQ-LIC-004): sul profilo leggero
                  del piano Free non ci sono, e gli interruttori di SumUp
                  lasciano il posto a una riga che lo dice. Su un piano a
                  pagamento senza il modulo la riga dice quello, non «Free». */}
              {!sumupDisponibile(settings) ? (
                <AvvisoPiano
                  messaggio={profiloLeggero(settings) ? MESSAGGI_PIANO.sumup : MESSAGGI_PIANO.sumup_modulo}
                  impostazioni={settings}
                  compatto
                />
              ) : (
                <>
                  <ToggleRow
                    label={tr('Pagamento online (SumUp)')}
                    desc={tr('Il cliente può pagare con carta dal suo telefono al momento dell\'ordine.')}
                    checked={settings.payments_online_enabled}
                    onChange={(v) => save({ payments_online_enabled: v })}
                  />
                  {settings.payments_online_enabled && (
                    <>
                      <ToggleRow
                        label={tr('Pagamento obbligatorio')}
                        desc={tr('L\'ordine entra in coda solo dopo il pagamento online.')}
                        checked={settings.payments_online_required}
                        onChange={(v) => save({ payments_online_required: v })}
                      />
                      {!settings.payments_online_required && (
                        <ToggleRow
                          label={tr('Senza pagamento, ritiro al banco')}
                          desc={
                            settings.service_mode === 'tavolo'
                              ? tr('Con servizio solo al tavolo non si applica: chi non paga online paga allo staff alla consegna.')
                              : tr('Chi non paga online ritira al banco, senza servizio al tavolo.')
                          }
                          checked={settings.banco_required_if_unpaid}
                          onChange={(v) => save({ banco_required_if_unpaid: v })}
                        />
                      )}
                    </>
                  )}
                  <ToggleRow
                    label={tr('Lettore SumUp Solo')}
                    desc={tr('Incasso con carta dal lettore SumUp Solo, collegato in Wi-Fi, direttamente dalla coda ordini.')}
                    checked={settings.payments_reader_enabled}
                    onChange={(v) => save({ payments_reader_enabled: v })}
                  />
                  {settings.payments_reader_enabled && <ReaderPairing settings={settings} />}
                </>
              )}
            </div>
      ),
    },
    {
      id: 'stampa-automatica',
      icona: 'stampante',
      label: tr('Stampa automatica'),
      nodo: <StampaAutomatica settings={settings} save={save} />,
    },
    {
      id: 'gruppi',
      icona: 'staff',
      label: tr('Gruppi di ordini'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Gruppi di ordini')}</h3>
              <p className="muted small" style={{ margin: '0 0 8px' }}>
                {tr('Riuniscono più conti separati che si pagano insieme, come una tavolata con un conto a testa o un evento su più tavoli. Un conto solo si divide per articoli o si incassa in acconti dalla schermata di pagamento, senza gruppi.')}
              </p>
              <ToggleRow
                label={tr('Abilita i gruppi')}
                desc={tr('Spenti, i gruppi non compaiono in nessuna schermata.')}
                checked={settings.groups_enabled}
                onChange={(v) => save({ groups_enabled: v })}
              />
              {settings.groups_enabled && (
                <>
                  <div className="muted small" style={{ margin: '8px 0' }}>
                    <strong>{tr('Come funzionano')}</strong>
                    <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      <li>{tr('Il gruppo si crea dal pannello nella coda o dal menu laterale.')}</li>
                      <li>{tr('Toccandolo si vedono gli ordini del gruppo, il totale e quanto resta da pagare.')}</li>
                      <li>
                        <ConIconaDentro
                          testo={tr('Il tasto {icona} apre il POS su un ordine che nasce già nel gruppo.')}
                          icona={<Icona nome="nuovo-ordine" gruppo="tasti" />}
                        />
                      </li>
                      <li>{tr('Si incassa tutto insieme, oppure in quote uguali.')}</li>
                    </ol>
                    <ConIconaDentro
                      testo={tr('Gli ordini di un gruppo restano visibili nella coda come tutti gli altri, con l’etichetta {icona} del gruppo.')}
                      icona={<Icona nome="staff" gruppo="tasti" />}
                    />{' '}
                    {tr('Un gruppo può contenere altri gruppi; un gruppo con sottogruppi non ha ordini propri.')}
                  </div>
                  <ToggleRow
                    label={tr('Mostra nel menu laterale')}
                    desc={tr('Nel menu laterale, un riquadro per gruppo che ne apre gli ordini.')}
                    checked={settings.groups_in_drawer}
                    onChange={(v) => save({ groups_in_drawer: v })}
                  />
                  <ToggleRow
                    label={tr('Pannello gruppi nella coda')}
                    desc={tr('Nella coda ordini, un pannello a scomparsa con i gruppi e i loro conti.')}
                    checked={settings.groups_in_queue}
                    onChange={(v) => save({ groups_in_queue: v })}
                  />
                </>
              )}
            </div>
      ),
    },
    {
      id: 'preparazione',
      icona: 'menu',
      label: tr('Gestione preparazione'),
      nodo: !comandeOn ? (
        <AvvisoPiano messaggio={MESSAGGI_PIANO.comande} impostazioni={settings} />
      ) : (
            <div className="card settings-section">
              <h3>{tr('Gestione preparazione')}</h3>
              <p className="muted small" style={{ margin: '0 0 8px' }}>
                {tr('Con la gestione accesa, ogni comanda passa per da fare → in preparazione → pronto → servito.')}
              </p>
              <ToggleRow
                label={tr('Segui la preparazione degli ordini')}
                desc={tr('Spenta, un ordine è solo ricevuto o pagato: niente passi di preparazione, tempi di servizio, stima ai clienti e avvisi di «pronto».')}
                checked={settings.workflow_enabled !== false}
                onChange={(v) => (v ? save({ workflow_enabled: true }) : setConfermaSpegni(true))}
              />
              {/* Vale per TUTTE le comande allo stesso modo — la prima di un
                  conto nuovo e le aggiunte a metà serata — perché il passo in
                  cui nasce una comanda si decide in un posto solo
                  (statoComandaNuova in lib/comande.js). */}
              {servizioOn && (
                <ToggleRow
                  label={tr('Le comande nascono già in preparazione')}
                  desc={tr('Una comanda nuova nasce già «In preparazione» invece che in «Da fare».')}
                  checked={settings.comande_in_preparazione === true}
                  onChange={(v) => save({ comande_in_preparazione: v })}
                />
              )}
              {esitoReset != null && (
                <div className="muted small" style={{ marginTop: 6 }}>
                  <Icona nome="fatto" gruppo="segnali" />{' '}{esitoReset === 0
                    ? tr('Nessun conto aperto da riportare indietro.')
                    : esitoReset === 1
                    ? tr('Un conto aperto riportato a “ricevuto”.')
                    : tr('{n} conti aperti riportati a “ricevuto”.', { n: esitoReset })}
                </div>
              )}
            </div>
      ),
    },
    {
      id: 'giornata',
      icona: 'calendario',
      label: tr('Giornata di lavoro'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Giornata di lavoro')}</h3>
              {/* DUE NUMERI DIVERSI, APPOSTA (REQ-CASSA-015). Flavio, 01/10/2026:
                  «la giornata di lavoro non è dalle 5 fino alle 4.59 del giorno
                  dopo. Devo mettere io un inizio e una fine». L'orario dice
                  quando il locale lavora; il cambio di giornata dove finisce un
                  giorno. Non coincidono perché un conto battuto dopo la chiusura
                  resta della serata. */}
              <p className="muted small" style={{ margin: '0 0 8px' }}>
                {tr('Orario di apertura e di chiusura del locale. Le fasce orarie delle statistiche partono da questo orario.')}
              </p>
              <div className="toggle-row">
                <span>{tr('Apertura')}</span>
                <OrarioInput
                  label={tr('Apertura')}
                  value={settings.orario_apertura}
                  onCommit={(v) => save({ orario_apertura: v })}
                />
              </div>
              <div className="toggle-row">
                <span>{tr('Chiusura')}</span>
                <OrarioInput
                  label={tr('Chiusura')}
                  value={settings.orario_chiusura}
                  onCommit={(v) => save({ orario_chiusura: v })}
                />
              </div>
              <p className="muted small" style={{ margin: '12px 0 8px' }}>
                {tr('Il cambio di giornata è l’ora in cui una giornata finisce e comincia la successiva: la numerazione dei conti riparte da 1, statistiche e chiusure passano al giorno nuovo. Va dopo l’orario di chiusura. I conti aperti restano aperti.')}
              </p>
              <div className="toggle-row">
                <span>{tr('Cambio di giornata (ora)')}</span>
                <AmountInput
                  value={settings.business_day_cutoff_hour}
                  min={0}
                  max={23}
                  step={1}
                  onCommit={(v) => save({ business_day_cutoff_hour: v })}
                />
              </div>
              {cambioDentroOrario(settings.business_day_cutoff_hour, settings) && (
                <p className="muted small" role="alert" style={{ margin: '8px 0 0' }}>
                  <Icona nome="avviso" gruppo="segnali" />{' '}
                  {tr('Il cambio di giornata cade dentro l’orario di apertura: una serata verrebbe divisa su due giornate.')}
                </p>
              )}
            </div>
      ),
    },
    {
      id: 'prezzo',
      icona: 'categorie',
      label: tr('Prezzo consigliato'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Prezzo consigliato')}</h3>
              <p className="muted small" style={{ margin: '0 0 8px' }}>
                {tr('Il prezzo reale di un drink è il costo al dettaglio dei suoi ingredienti, dal listino di magazzino; il prezzo consigliato è il prezzo reale per il ricarico, e resta modificabile. Il ricarico si imposta come moltiplicatore o come drink cost, l’incidenza del costo sul prezzo di vendita: ×3 corrisponde al 33,3%, ×5 al 20%.')}
              </p>
              <div className="toggle-row">
                <span>{tr('Ricarico sul costo (×)')}</span>
                <AmountInput
                  label={tr('Ricarico sul costo')}
                  value={settings.price_markup}
                  min={1}
                  max={20}
                  step={0.5}
                  onCommit={(v) => save({ price_markup: v })}
                />
              </div>
              <div className="toggle-row">
                <span>{tr('Drink cost (% sul prezzo)')}</span>
                <AmountInput
                  label="Drink cost"
                  value={drinkCostDi(settings.price_markup)}
                  min={5}
                  max={100}
                  step={0.1}
                  onCommit={(v) => save({ price_markup: ricaricoDaDrinkCost(v) })}
                />
              </div>
              <div className="toggle-row">
                <span>{tr('Arrotonda il consigliato a (€)')}</span>
                <AmountInput
                  value={settings.price_round_step}
                  min={0.05}
                  max={5}
                  step={0.05}
                  onCommit={(v) => save({ price_round_step: v })}
                />
              </div>
              <div className="toggle-row">
                <span>{tr('IVA di vendita predefinita (%)')}</span>
                <AmountInput
                  value={settings.sale_vat}
                  min={0}
                  max={22}
                  step={1}
                  onCommit={(v) => save({ sale_vat: v })}
                />
              </div>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                {tr('Aliquota con cui si scorpora il fatturato al netto (somministrazione: 10%). Ogni voce del menù può indicarne una diversa nel campo IVA vendita.')}
              </p>
              <div className="toggle-row">
                <span>{tr('IVA di acquisto predefinita (%)')}</span>
                <AmountInput
                  value={settings.purchase_vat}
                  min={0}
                  max={22}
                  step={1}
                  onCommit={(v) => save({ purchase_vat: v })}
                />
              </div>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                {tr('Aliquota predefinita dei nuovi prodotti di magazzino (ordinaria: 22%). Ogni prodotto può indicarne una diversa nel campo IVA.')}
              </p>
            </div>
      ),
    },
    {
      id: 'tempi',
      icona: 'tempo',
      label: tr('Tempi di servizio'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Tempi di servizio')}</h3>
              <ToggleRow
                label={tr('Mostra tempo stimato ai clienti')}
                desc={tr('La stima dell\'attesa mostrata ai clienti, nel menù e nella pagina dell\'ordine: parte dal tempo base e si corregge coi tempi reali del servizio. Per il ritiro al banco conta solo attesa e preparazione.')}
                checked={settings.eta_enabled}
                onChange={(v) => save({ eta_enabled: v })}
              />
              {settings.eta_enabled && (
                <div className="toggle-row">
                  <span>{tr('Tempo base (minuti)')}</span>
                  <AmountInput
                    value={settings.eta_base_minutes}
                    min={1}
                    max={120}
                    step={1}
                    onCommit={(v) => save({ eta_base_minutes: v })}
                  />
                </div>
              )}
            </div>
      ),
    },
    {
      id: 'sconto',
      icona: 'dividi',
      label: tr('Sconto e righe del conto'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Sconto e righe del conto')}</h3>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
                {tr('Cosa succede a uno sconto in euro quando il totale del conto cambia. Lo sconto in percentuale segue sempre il conto.')}
              </p>
              <div className="sconto-scelte">
                {[
                  [
                    'tetto',
                    conEmoji('licenza', tr('Tetto al totale')),
                    tr('Lo sconto resta invariato finché non supera il totale; oltre, scende fino al totale e il conto va a zero, mai in negativo.'),
                  ],
                  [
                    'proporzione',
                    conEmoji('bilancio', tr('Mantieni la proporzione')),
                    tr('Lo sconto resta la stessa quota del conto e cresce o cala col totale.'),
                  ],
                  [
                    'avviso',
                    conEmoji('avviso', tr('Avvisa e basta')),
                    tr('Lo sconto non cambia; se supera il totale viene segnalato e l’incasso resta bloccato fino alla correzione a mano.'),
                  ],
                ].map(([value, titolo, testo]) => (
                  <button
                    key={value}
                    type="button"
                    className={`sconto-scelta${(settings.discount_policy || 'tetto') === value ? ' active' : ''}`}
                    onClick={() => save({ discount_policy: value })}
                  >
                    <strong>{titolo}</strong>
                    <span className="muted small">{testo}</span>
                  </button>
                ))}
              </div>
            </div>
      ),
    },
    {
      id: 'coperto',
      icona: 'tavolo',
      label: tr('Coperto'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Coperto')}</h3>
              <ToggleRow
                label={tr('Coperto a persona')}
                desc={tr('Un importo per persona sui conti serviti al tavolo; il cliente indica quante persone sono al tavolo.')}
                checked={settings.coperto_enabled}
                onChange={(v) => save({ coperto_enabled: v })}
              />
              {settings.coperto_enabled && (
                <div className="toggle-row">
                  <span>{tr('Importo a persona (€)')}</span>
                  <AmountInput
                    value={settings.coperto_amount}
                    min={0}
                    step={0.5}
                    onCommit={(v) => save({ coperto_amount: v })}
                  />
                </div>
              )}
            </div>
      ),
    },
    {
      id: 'servizio-mancia',
      icona: 'ritiro-e-servizio',
      label: tr('Servizio e mancia'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Servizio e mancia')}</h3>
              <p className="muted" style={{ margin: '0 0 4px', fontSize: '0.85rem' }}>
                {tr('Si può attivare il costo di servizio oppure la mancia, non entrambi.')}
              </p>
              <ToggleRow
                label={tr('Costo di servizio (%)')}
                desc={tr('Una percentuale di drink e coperto, aggiunta ai conti serviti al tavolo.')}
                checked={settings.service_charge_enabled}
                onChange={(v) =>
                  save({ service_charge_enabled: v, ...(v ? { tip_enabled: false } : {}) })
                }
              />
              {settings.service_charge_enabled && (
                <div className="toggle-row">
                  <span>{tr('Percentuale (%)')}</span>
                  <AmountInput
                    value={settings.service_charge_percent}
                    min={0}
                    max={100}
                    step={1}
                    onCommit={(v) => save({ service_charge_percent: v })}
                  />
                </div>
              )}
              <ToggleRow
                label={tr('Mancia libera')}
                desc={tr('Ordinando, il cliente aggiunge una mancia dell\'importo che sceglie.')}
                checked={settings.tip_enabled}
                onChange={(v) =>
                  save({ tip_enabled: v, ...(v ? { service_charge_enabled: false } : {}) })
                }
              />
            </div>
      ),
    },
    {
      // MENÙ CLIENTI: tutto quello che riguarda la schermata di chi ordina —
      // cosa può fare, cosa vede, di che colore. Stava sparso fra «Modalità
      // menù», «Menù» e «Aspetto», e davanti a un interruttore non si
      // capiva se parlasse del menù dei clienti o della schermata con cui
      // si modifica il listino.
      id: 'menu-clienti',
      icona: 'ordina-dal-menu',
      label: tr('Menù clienti'),
      nodo: (
        <div className="card settings-section">
          <h3>{tr('Menù clienti')}</h3>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            {tr('La schermata che vedono i clienti sul telefono.')}
          </p>
          {/* IL MENÙ SI NASCONDE AI CLIENTI DA QUI (REQ-LIC-002). Daniele,
              14/11/2026: «se il menù clienti è disattivato non ci si può
              arrivare in alcun modo»; e poi: il modulo («Menù digitale e
              tavoli», Funzioni premium) «serve ad attivare il modulo, ma nel
              modulo posso decidere se visualizzare il menù o meno: non
              dovrebbe essere la stessa cosa». Quindi una scelta sua
              (`menu_clienti_visibile`), che c'è solo col modulo acceso. */}
          {moduloAttivo(settings, 'menu_tavoli') && (
            <ToggleRow
              label={tr('Menù visibile ai clienti')}
              desc={tr('Spento, il menù non compare ai clienti e gli ordini dal telefono non sono accettati; lo staff continua a usarlo.')}
              checked={settings.menu_clienti_visibile !== false}
              onChange={(v) => save({ menu_clienti_visibile: v })}
            />
          )}
          <ToggleRow
            label={tr('Solo menù (consultazione)')}
            desc={tr('I clienti vedono il menù ma non possono ordinare.')}
            checked={settings.menu_only}
            onChange={(v) => save({ menu_only: v })}
          />
          <ToggleRow
            label={tr('Mostra quantità ingredienti')}
            desc={tr('Nelle voci del menù, la quantità di ogni ingrediente: «Gin 50 ml» invece di «Gin».')}
            checked={settings.show_ingredient_quantities}
            onChange={(v) => save({ show_ingredient_quantities: v })}
          />
          <ToggleRow
            label={tr('Tabellone «stiamo servendo»')}
            desc={tr('Nel menù, i numeri degli ordini pronti per il servizio o il ritiro. Non compare con «Solo menù».')}
            checked={settings.show_serving_board}
            onChange={(v) => save({ show_serving_board: v })}
          />
          <FormatoPrezziMenu settings={settings} onSave={save} />
          <TemaMenuClienti settings={settings} onSave={save} />
        </div>
      ),
    },
    {
      id: 'scelta-ingredienti',
      icona: 'ordina-dal-menu',
      label: tr('Scelta degli ingredienti'),
      nodo: (
        <div className="card settings-section">
          <h3>{tr('Scelta degli ingredienti')}</h3>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            {tr('Sulle voci del menù dei clienti dove il cliente sceglie un ingrediente (per esempio il gin), il supplemento con cui parte ogni alternativa offerta. Sulla voce si cambia alternativa per alternativa.')}
          </p>
          <label htmlFor="supplemento-scelta">{tr('Supplemento predefinito (€)')}</label>
          <input
            id="supplemento-scelta"
            type="number"
            step="0.5"
            min="0"
            defaultValue={settings.supplemento_scelta_predefinito || ''}
            placeholder="0"
            onBlur={(e) => {
              const v = Number(String(e.target.value).replace(',', '.'))
              save({ supplemento_scelta_predefinito: Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0 })
            }}
          />
        </div>
      ),
    },
    {
      // REQ-CLI-009: lib/attesaCliente.js.
      id: 'conferma-cliente',
      icona: 'ordina-dal-menu',
      label: tr('Modifiche da confermare'),
      nodo: (
        <div className="card settings-section">
          <h3>{tr('Modifiche da confermare')}</h3>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            {tr('Quando il banco cambia prezzo o ingredienti di un ordine arrivato dal telefono, il cliente riceve le modifiche e le accetta o le rifiuta. Il rifiuto annulla l’ordine; allo scadere del tempo l’ordine si annulla. Finché il cliente non risponde, l’ordine non avanza e la comanda non si stampa.')}
          </p>
          <label htmlFor="attesa-cliente-minuti">{tr('Tempo per rispondere (minuti)')}</label>
          <input
            id="attesa-cliente-minuti"
            type="number"
            step="1"
            min="1"
            max="120"
            defaultValue={minutiAttesa(settings)}
            onBlur={(e) => save({ attesa_cliente_minuti: minutiAttesa({ attesa_cliente_minuti: e.target.value }) })}
          />
        </div>
      ),
    },
    {
      id: 'non-disponibili',
      icona: 'ordina-dal-menu',
      label: tr('Voci non disponibili'),
      nodo: (
        <div className="card settings-section">
          <h3>{tr('Voci non disponibili')}</h3>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            {tr('Per le voci che seguono le giacenze (opzione nella scheda della voce) e per quelle con un ingrediente in «Oscura automaticamente» (opzione nella scheda del prodotto di magazzino). Al cliente non si dice quale ingrediente manca; al banco la voce resta sempre.')}
          </p>
          <h4 style={{ margin: '4px 0' }}>{tr('Nel menù dei clienti')}</h4>
          <SceltaModo
            valore={settings.menu_non_disponibili === 'nascondi' ? 'nascondi' : 'mostra'}
            opzioni={[
              ['mostra', tr('Con la scritta «Non disponibile»'), tr('La voce resta al suo posto e non si può ordinare.')],
              ['nascondi', tr('Nascoste'), tr('La voce sparisce finché non torna disponibile.')],
            ]}
            onScegli={(v) => save({ menu_non_disponibili: v })}
          />
          <h4 style={{ margin: '12px 0 4px' }}>{tr('Quando')}</h4>
          <SceltaModo
            valore={settings.menu_soglia_disponibilita === 'esaurimento' ? 'esaurimento' : 'esaurito'}
            opzioni={[
              ['esaurito', tr('Ingrediente esaurito'), tr('Giacenza a zero.')],
              ['esaurimento', tr('Ingrediente in esaurimento'), tr('Sotto la soglia di avviso del prodotto di magazzino.')],
            ]}
            onScegli={(v) => save({ menu_soglia_disponibilita: v })}
          />
        </div>
      ),
    },
    {
      // GESTIONE MENÙ: la schermata con cui si lavora il listino. Le sue
      // impostazioni non c'entrano niente con quello che vede il cliente.
      id: 'gestione-menu',
      icona: 'gestione-menu',
      label: tr('Gestione menù'),
      nodo: (
        <div className="card settings-section">
          <h3>{tr('Gestione menù')}</h3>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            {tr('La schermata con cui si modifica il listino, non quella dei clienti.')}
          </p>
          <h4>{tr('Cosa dice la riga a sinistra di ogni scheda?')}</h4>
          <SceltaModo
            colonne="1fr 1fr"
            valore={settings.stripe_menu || 'scorte'}
            opzioni={MODI_STRISCIA.map((m) => [m.id, trSegnato(m.label), trSegnato(m.desc)])}
            onScegli={(v) => save({ stripe_menu: v })}
          />
          <p className="muted small" style={{ margin: '8px 0 4px' }}>
            {tr('Quale colore per «ci sono abbastanza scorte»?')}
          </p>
          <SceltaModo
            valore={!!settings.stripe_menu_ok_verde}
            opzioni={[
              [false, conEmoji('spento', tr('Grigio'))],
              [true, conEmoji('verde', tr('Verde'))],
            ]}
            onScegli={(v) => save({ stripe_menu_ok_verde: v })}
          />
        </div>
      ),
    },
    {
      id: 'coda',
      icona: 'elenco',
      label: tr('Coda ordini'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Coda ordini')}</h3>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
                {tr("Come si dispongono gli ordini: griglia a tutto schermo, corsie con una colonna per stato e un tasto che porta l'ordine al passo successivo, schede separate per stato, oppure una lista unica di ordini in corso ed evasi.")}
              </p>
              <SceltaModo
                valore={settings.queue_view}
                opzioni={[
                  ['griglia', conEmoji('griglia', tr('Griglia (schermo intero)'))],
                  ['corsie', conEmoji('corsie', tr('Corsie di stato'))],
                  ['tabs', conEmoji('raggruppa', tr('Schede per stato'))],
                  ['lista', conEmoji('elenco', tr('Lista unica'))],
                ]}
                onScegli={(v) => save({ queue_view: v })}
              />

              {/* LA VISTA DEL BANCO. Non si sceglie: la accendono gli stati
                  del servizio, e di modi per disegnarla ce n'è uno solo (le
                  corsie, `bartender_view` resta nei dati per quando ce ne
                  saranno altri). Qui c'era un selettore con una voce sola,
                  e un testo che raccontava il perché invece di dire cosa fa
                  (Daniele, 17/11/2026: «spiegare che cosa fa un'opzione»,
                  BUG-168). */}
              <h4>{tr('La vista del banco')}</h4>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
                {tr('A chi ha il ruolo bartender la coda mostra le comande, una card per ticket, divise per stato di preparazione.')}{' '}
                {servizioOn
                  ? tr('Attiva.')
                  : tr('Non attiva: richiede «Segui la preparazione degli ordini», in Gestione preparazione.')}
              </p>

              {/* IL COLORE DEL CONTO. Serve quando un conto si spezza in
                  più comande che finiscono in colonne diverse: da lontano
                  il pallino è l'unica cosa che dice che sono lo stesso
                  tavolo. Il colore a mano si dà comunque, dal ⋯ della
                  card, acceso o spento che sia questo interruttore. */}
              <h4>{tr('Il colore del conto')}</h4>
              <ToggleRow
                label={tr('Ogni conto nuovo nasce col suo colore')}
                desc={tr('Un pallino colorato accanto al numero, sulla card del conto e su quelle delle sue comande. Il colore si cambia o si toglie da «⋯ Azioni» sulla card, anche con questa opzione spenta.')}
                checked={settings.conti_colorati === true}
                onChange={(v) => save({ conti_colorati: v })}
              />

              {/* CHI HA CARICATO LA RIGA (REQ-ORD-023, REQ-ORD-024). Le due
                  cose vanno insieme: il blocco del «+» e del «−» si regge
                  sull'iniziale, e senza l'iniziale a schermo nessuno
                  capirebbe perché un tasto è spento (l'utente, 09/11/2026:
                  «le regole funzionano solo se la firma è attiva»). Chi ha
                  battuto la riga si registra comunque: riaccendendo, si vede
                  anche sulle righe di quando era spento. */}
              <h4>{tr('Chi ha caricato la riga')}</h4>
              <ToggleRow
                label={tr('Iniziale di chi ha caricato ogni riga')}
                desc={tr('Accanto a ogni riga del conto, l\'iniziale di chi l\'ha caricata. Accesa, la quantità di una riga la cambia solo chi l\'ha caricata; le righe dei clienti dal menù restano modificabili da tutti.')}
                checked={settings.firma_righe !== false}
                onChange={(v) => save({ firma_righe: v })}
              />

              <h4>{tr('La ricerca')}</h4>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
                {tr('La ricerca per numero, nome, tavolo o drink filtra la coda, lasciando i soli conti trovati, oppure la lascia intera e accende il primo conto trovato; in questo caso toccando un conto la ricerca si azzera.')}
              </p>
              <SceltaModo
                valore={settings.queue_search || 'filtra'}
                opzioni={[
                  ['filtra', conEmoji('cerca', tr('Filtra la coda'))],
                  ['evidenzia', conEmoji('evidenzia', tr('Evidenzia il primo conto trovato'))],
                ]}
                onScegli={(v) => save({ queue_search: v })}
              />
            </div>
      ),
    },
    { id: 'catalogo', icona: 'acquisti', label: tr('Catalogo prodotti'), nodo: <CatalogImport /> },
    {
      id: 'account-clienti',
      icona: 'clienti',
      label: tr('Account clienti'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Account clienti')}</h3>
              <ToggleRow
                label={tr('Login e registrazione clienti')}
                desc={tr('Spento, dalle pagine dei clienti spariscono «Accedi» e la registrazione; lo staff accede comunque da /bar.')}
                checked={settings.customer_accounts_enabled}
                onChange={(v) => save({ customer_accounts_enabled: v })}
              />
            </div>
      ),
    },
    {
      id: 'posizione',
      icona: 'posizione',
      label: tr('Posizione locale'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Posizione locale')}</h3>
              <ToggleRow
                label={tr('Posizione obbligatoria per ordinare')}
                desc={tr('Si ordina solo nei pressi del locale, con la localizzazione attiva. Non vale per lo staff.')}
                checked={settings.geofence_enabled}
                onChange={(v) => save({ geofence_enabled: v })}
              />
              {settings.geofence_enabled && (
                <>
                  <label htmlFor="venue-addr">{tr('Indirizzo del locale')}</label>
                  <input
                    id="venue-addr"
                    type="text"
                    placeholder={tr('es. Via Roma 1, Nola')}
                    defaultValue={settings.venue_address}
                    onBlur={(e) => save({ venue_address: e.target.value.trim() })}
                  />
                  <div className="grid-2" style={{ marginTop: 10 }}>
                    <div>
                      <label htmlFor="venue-lat">{tr('Latitudine')}</label>
                      <input
                        id="venue-lat"
                        type="number"
                        step="0.000001"
                        defaultValue={settings.venue_lat ?? ''}
                        onBlur={(e) => save({ venue_lat: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label htmlFor="venue-lng">{tr('Longitudine')}</label>
                      <input
                        id="venue-lng"
                        type="number"
                        step="0.000001"
                        defaultValue={settings.venue_lng ?? ''}
                        onBlur={(e) => save({ venue_lng: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="toggle-row">
                    <span>{tr('Raggio consentito (metri)')}</span>
                    <AmountInput
                      value={settings.venue_radius_m}
                      min={10}
                      max={5000}
                      step={10}
                      onCommit={(v) => save({ venue_radius_m: v })}
                    />
                  </div>
                  <button
                    className="btn secondary block"
                    type="button"
                    onClick={() => {
                      navigator.geolocation?.getCurrentPosition(
                        (pos) =>
                          save({
                            venue_lat: Number(pos.coords.latitude.toFixed(6)),
                            venue_lng: Number(pos.coords.longitude.toFixed(6)),
                          }),
                        () => setError(tr('Posizione non disponibile: inserisci le coordinate a mano.'))
                      )
                    }}
                  >
                    <Icona nome="posizione" gruppo="tasti" /> {tr('Usa la mia posizione attuale')}
                  </button>
                  {settings.venue_lat == null && (
                    <p className="muted small" style={{ margin: '8px 0 0' }}>
                      <Icona nome="avviso" gruppo="segnali" /> {tr('Senza coordinate il controllo non è attivo.')}
                    </p>
                  )}
                </>
              )}
            </div>
      ),
    },
    {
      id: 'notifiche',
      icona: 'notifiche',
      label: tr('Notifiche'),
      // CARTELLO, non una seconda casa. Gli avvisi sono scelti per persona
      // e per dispositivo, quindi stanno nel profilo — dove ci arriva
      // anche chi è in sala, che qui dentro non entra proprio. Qui resta
      // l'indicazione, perché chi li cercava li cercava qui.
      nodo: (
        <div className="card settings-section">
          <h3><Icona nome="notifiche" gruppo="tasti" /> {tr('Notifiche')}</h3>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>
            {tr('Gli avvisi si impostano per persona e per dispositivo, nel profilo, dove c’è anche lo storico di quelli ricevuti.')}
          </p>
          <Link className="btn small" to="/profilo-staff">
            <Icona nome="profilo" gruppo="tasti" /> {tr('Vai al mio profilo')}
          </Link>

        </div>
      ),
    },
    {
      id: 'stampante',
      icona: 'stampante',
      label: tr('Stampante'),
      nodo: stampaOn ? <PrinterSetup /> : <AvvisoPiano messaggio={MESSAGGI_PIANO.stampa} impostazioni={settings} />,
    },
    // I CAMPI DELLA CARTA STANNO COL RESTO DELLA STAMPANTE. Sono
    // impostazioni del LOCALE (settings/bar) e non del terminale, ma chi
    // le cerca le cerca dove sta la stampante: nella barra sono un gruppo
    // solo, e questi riquadri vengono sotto a quello della connessione.
    {
      id: 'campi-scontrino',
      icona: 'coda',
      label: tr('Campi dello scontrino'),
      nodo: <CampiStampa quale="scontrino" settings={settings} onSave={save} />,
    },
    {
      id: 'campi-comanda',
      icona: 'note',
      label: tr('Campi della comanda'),
      nodo: <CampiStampa quale="comanda" settings={settings} onSave={save} />,
    },
    {
      id: 'campi-acconto',
      icona: 'coda',
      label: tr('Campi dell’acconto'),
      nodo: <CampiStampa quale="acconto" settings={settings} onSave={save} />,
    },
    {
      id: 'logo-stampe',
      icona: 'immagine',
      label: tr('Logo sulle stampe'),
      nodo: <LogoStampe settings={settings} onSave={save} role={role} />,
    },
    { id: 'backup', icona: 'salva', label: tr('Backup e ripristino'), nodo: <BackupPanel role={role} /> },
    {
      id: 'informazioni',
      icona: 'informazioni',
      label: tr('Informazioni'),
      nodo: <InfoTab settings={settings} role={role} />,
    },
    // La licenza la legge il titolare (REQ-LIC-007): è il suo contratto,
    // e al banco non serve.
    ...(isAdmin(role)
      ? [{ id: 'licenza', icona: 'licenza', label: tr('Licenza'), nodo: <LicenzaPanel settings={settings} /> }]
      : []),
    {
      id: 'funzioni-premium',
      icona: 'licenza',
      label: tr('Funzioni premium'),
      nodo: <FunzioniPremium settings={settings} onSave={save} />,
    },
    // IL CREDITO AI (REQ-AI-003) sta con la licenza: è quello che il locale
    // ha comprato. Solo dove l'AI arriva (non nel Free, REQ-LIC-017).
    ...(aiRaggiungibile() ? [{ id: 'credito-ai', icona: 'licenza', label: tr('Credito AI'), nodo: <CreditoAI /> }] : []),
    {
      id: 'annullamenti',
      icona: 'chiudi',
      label: tr('Annullamenti'),
      nodo: (
            <div className="card settings-section">
              <h3>{tr('Annullamenti')}</h3>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
                {tr('La frase proposta quando si annulla un ordine; nella finestra di annullamento si può cambiare ogni volta.')}
              </p>
              {/* LA FRASE SEGUE IL MONDO DELLA CONSEGNA. «Prego recarsi al
                  bancone» ha senso solo dove il RITIRO esiste: in un locale a
                  solo servizio manda una persona a un bancone dove nessuno
                  la aspetta. La voce impossibile si spegne col motivo, non
                  sparisce — sparire fa dubitare di averla immaginata — e
                  quella evidenziata è quella che si applica davvero
                  (fraseAnnulloDefault), non l'impostazione impossibile
                  rimasta scritta. */}
              <SceltaModo
                valore={fraseAnnulloDefault(settings)}
                opzioni={Object.entries(CANCEL_PHRASES).map(([key, text]) => [
                  key,
                  <span key={key} lang="it">
                    {text}
                  </span>,
                  fraseAnnulloPossibile(key, settings)
                    ? undefined
                    : tr('Il locale è a solo servizio: non c’è un banco a cui mandare il cliente.'),
                  !fraseAnnulloPossibile(key, settings),
                ])}
                onScegli={(v) => save({ cancel_phrase_default: v })}
              />
              {!fraseAnnulloPossibile('bancone', settings) && (
                <p className="muted small" style={{ margin: '8px 0 0' }}>
                  {tr('«Prego recarsi al bancone» non si può usare: il locale è a solo servizio.')}{' '}
                  <button
                    type="button"
                    className="link-inline"
                    onClick={() => scegliSezione('consegna')}
                  >
                    {tr('Vai a Consegna ordine')}
                  </button>
                </p>
              )}
            </div>
      ),
    },
  ]
  const sezioni = tutteLeSezioni.filter(
    (s) => (stampaOn || !SOLO_CON_STAMPA.has(s.id)) && (comandeOn || !SOLO_CON_COMANDE.has(s.id))
  )

  // LE VOCI DEL SOTTOMENU SONO DIECI, NON VENTITRÉ. Ogni riquadro resta
  // com'è, ma appartiene a un GRUPPO — accorpati per «a cosa afferisce»
  // l'impostazione, non per la storia di come è nata: con ventitré voci
  // l'elenco era più lungo delle impostazioni.
  const GRUPPO_DI = {
    // Il riquadro c'era dalla build per cliente (REQ-VENUE-001), ma qui non
    // aveva un gruppo: un riquadro senza gruppo non compare da nessuna
    // parte, e nome, contatti e intestazione dello scontrino non si
    // potevano correggere (BUG-139). Il test dei gruppi ora lo cerca.
    locale: 'locale',
    aspetto: 'aspetto',
    'marketplace-temi': 'aspetto',
    // Tre cose diverse, tre voci: quello che vedono i clienti, la
    // schermata con cui si lavora il listino, e l'importazione del
    // catalogo. Messe insieme, davanti a un interruttore non si capiva a
    // quale delle tre appartenesse.
    'menu-clienti': 'menu-clienti',
    'non-disponibili': 'menu-clienti',
    'scelta-ingredienti': 'menu-clienti',
    'conferma-cliente': 'menu-clienti',
    'gestione-menu': 'gestione-menu',
    catalogo: 'catalogo',
    coda: 'banco',
    'vista-ordine': 'banco',
    consegna: 'servizio',
    preparazione: 'servizio',
    tempi: 'servizio',
    annullamenti: 'servizio',
    pagamenti: 'cassa',
    // QUANDO parte la carta è una faccenda dell'incasso, non della
    // macchina: sta con la cassa, non con la stampante (REQ-UI-025).
    'stampa-automatica': 'cassa',
    giornata: 'cassa',
    prezzo: 'prezzi',
    sconto: 'prezzi',
    coperto: 'prezzi',
    'servizio-mancia': 'prezzi',
    gruppi: 'gruppi',
    'account-clienti': 'clienti',
    posizione: 'clienti',
    notifiche: 'clienti',
    stampante: 'stampante',
    'campi-scontrino': 'stampante',
    'campi-comanda': 'stampante',
    'campi-acconto': 'stampante',
    'logo-stampe': 'stampante',
    backup: 'sistema',
    informazioni: 'sistema',
    licenza: 'premium',
    'funzioni-premium': 'premium',
    'credito-ai': 'premium',
  }
  const GRUPPI = [
    { id: 'aspetto', icona: 'temi', label: tr('Aspetto') },
    { id: 'locale', icona: 'categorie', label: tr('Il locale') },
    { id: 'menu-clienti', icona: 'ordina-dal-menu', label: tr('Menù clienti') },
    { id: 'gestione-menu', icona: 'gestione-menu', label: tr('Gestione menù') },
    { id: 'catalogo', icona: 'acquisti', label: tr('Catalogo prodotti') },
    { id: 'banco', icona: 'coda', label: tr('Banco: coda e ordine') },
    { id: 'servizio', icona: 'campanello', label: tr('Servizio') },
    { id: 'cassa', icona: 'cassa', label: tr('Cassa e giornata') },
    { id: 'prezzi', icona: 'categorie', label: tr('Prezzi e supplementi') },
    { id: 'gruppi', icona: 'staff', label: tr('Gruppi di ordini') },
    { id: 'clienti', icona: 'clienti', label: tr('Clienti') },
    { id: 'stampante', icona: 'stampante', label: tr('Stampante') },
    // UN GRUPPO SUO, e non una voce infilata nei gruppi delle schermate che
    // le funzioni accendono. La regola del momento d'uso (REQ-UI-025) dice
    // di raggruppare per «quando lo cerco»: qui il momento è «cosa ha questo
    // locale, e cosa potrebbe avere», che non è il momento in cui si conta
    // il magazzino né quello in cui si registra una fattura — tanto più che
    // a modulo spento quelle schermate non ci sono, e cercare l'interruttore
    // dentro la sezione che non compare sarebbe una caccia. Sono la prima
    // famiglia di questo tipo e ne arriveranno altre (Fase 3 del piano ne
    // elenca cinque pacchetti): un gruppo che cresce è meglio di cinque voci
    // sparse. E non sta in «Sistema», che parla di questa installazione
    // (backup, versione): la licenza è del locale, non della macchina.
    // «Licenza», da quando il gruppo ne mostra anche il riepilogo
    // (REQ-LIC-007): le funzioni premium sono quello che la licenza
    // comprende, e chi cerca cosa ha comprato cerca la licenza.
    { id: 'premium', icona: 'licenza', label: tr('Licenza') },
    { id: 'sistema', icona: 'salva', label: tr('Sistema') },
  ]
  // Compat coi collegamenti vecchi (?sezione=coperto): l'id di un riquadro
  // porta al gruppo che lo contiene.
  const attiva =
    GRUPPI.find((g) => g.id === sezione) ??
    GRUPPI.find((g) => g.id === GRUPPO_DI[sezione]) ??
    GRUPPI[0]
  const riquadri = sezioni.filter((s) => GRUPPO_DI[s.id] === attiva.id)

  return (
    <div className="pagina-impostazioni">
      {/* Il titolo sta nella barra in alto (vedi lib/sezioni.js), e con lui
          l'elenco delle sezioni: in pagina costava una colonna intera. */}
      <Sottosezioni
        voci={GRUPPI.map((x) => ({ id: x.id, icona: x.icona, label: x.label }))}
        attiva={attiva.id}
        scegli={scegliSezione}
      />
      {error && <div className="banner">{tr('Errore: {errore}', { errore: error })}</div>}

      {confermaSpegni && (
        <ConfirmDialog
          title={tr('Spegnere la gestione della preparazione?')}
          message={tr(
            'I conti ancora aperti tornano tutti a “ricevuto”. Le scorte già scalate restano scalate e non si scalano di nuovo quando la gestione si riaccende.'
          )}
          confirmLabel={tr('Spegni e riporta a ricevuto')}
          cancelLabel={tr('Annulla')}
          onCancel={() => setConfermaSpegni(false)}
          onConfirm={async () => {
            setConfermaSpegni(false)
            setEsitoReset(null)
            try {
              const n = await resetOpenOrdersToReceived()
              await save({ workflow_enabled: false })
              setEsitoReset(n)
            } catch (e) {
              setError(e.message)
            }
          }}
        />
      )}

      {/* Le sezioni stanno nella barra in alto (il titolo è il comando):
          a sinistra costavano una colonna tutto il giorno per una scelta che
          si fa ogni tanto. I riquadri del gruppo scelto si impilano. */}
      <div className="tab-corpo">
        {riquadri.map((s) => (
          <div key={s.id}>{s.nodo}</div>
        ))}
      </div>
    </div>
  )
}

// Import del catalogo prodotti da un export CSV di SumUp ("carte").
// Sostituisce drinks e categories dopo conferma con riepilogo.
function CatalogImport() {
  const fileRef = useRef(null)
  const [parsed, setParsed] = useState(null) // { products, categories, skipped }
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState(null)
  const [error, setError] = useState(null)

  async function onPickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permette di riselezionare lo stesso file
    if (!file) return
    setError(null)
    setLog(null)
    try {
      const text = decodeCsvBuffer(await file.arrayBuffer())
      setParsed(parseCarteCsv(text))
    } catch (err) {
      setError(err.message)
    }
  }

  async function doImport() {
    const data = parsed
    setParsed(null)
    setBusy(true)
    setError(null)
    try {
      await replaceCatalog(data, (msg) => setLog(msg))
      setLog(tr('✓ Importati {n} prodotti in {m} categorie.', { n: data.products.length, m: data.categories.length }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card settings-section">
      <h3>{tr('Catalogo prodotti')}</h3>
      <div className="toggle-row" style={{ borderBottom: 'none' }}>
        <div>
          <div>{tr('Importa da CSV SumUp')}</div>
          <div className="desc">
            {tr("Carica l'export prodotti («carte») di SumUp: sostituisce l'intero menù e le categorie. Foto e ricette esistenti vengono perse.")}
          </div>
        </div>
        <button
          className="btn small"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? tr('Importo…') : tr('Carica CSV')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={onPickFile}
        />
      </div>
      {error && <div className="banner">{tr('Errore: {errore}', { errore: error })}</div>}
      {log && <p className="muted small" style={{ margin: '6px 0 0' }}>{log}</p>}

      {parsed && (
        <ConfirmDialog
          icona="magazzino"
          title={tr('Importare il catalogo?')}
          message={
            tr('{n} prodotti in {m} categorie:', { n: parsed.products.length, m: parsed.categories.length }) +
            '\n' +
            parsed.categories.join(', ') +
            (parsed.skipped ? '\n\n' + tr('({n} righe non valide saltate)', { n: parsed.skipped }) : '') +
            '\n\n' +
            tr('Il menù attuale verrà sostituito.')
          }
          confirmLabel={tr('Importa')}
          danger
          onCancel={() => setParsed(null)}
          onConfirm={doImport}
        />
      )}
    </div>
  )
}

// Pairing del lettore SumUp Solo: il codice si genera dal lettore
// (Menu → Connessioni → API). L'associazione la fa una Cloud Function
// (la chiave API non passa mai dal client); lo stato arriva dai settings.
function ReaderPairing({ settings }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmUnpair, setConfirmUnpair] = useState(false)

  async function associa() {
    setBusy(true)
    setError(null)
    try {
      const res = await pairSumUpReader(code.trim())
      if (res.unavailable) {
        setError(tr('Non disponibile in ambiente di sviluppo (nessuna Cloud Function).'))
      } else {
        setCode('')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function dissocia() {
    setConfirmUnpair(false)
    setBusy(true)
    setError(null)
    try {
      await unpairSumUpReader()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      {error && <div className="banner">{tr('Errore: {errore}', { errore: error })}</div>}
      {settings.sumup_reader_id ? (
        <div className="toggle-row">
          <div>
            <div><Icona nome="lettore" gruppo="tasti" /> {settings.sumup_reader_name || tr('Lettore SumUp')}</div>
            <div className="desc">{tr("Lettore associato e pronto all'incasso.")}</div>
          </div>
          <button className="btn ghost small" disabled={busy} onClick={() => setConfirmUnpair(true)}>
            {tr('Dissocia')}
          </button>
        </div>
      ) : (
        <>
          <p className="muted small" style={{ margin: '0 0 8px' }}>
            {tr('Il codice di associazione si genera sul lettore, in Menu → Connessioni → API, e vale 5 minuti.')}
          </p>
          {devToolsEnabled && (
            <button
              className="btn ghost small block"
              style={{ marginBottom: 8 }}
              disabled={busy}
              onClick={() =>
                updateSettings({ sumup_reader_id: 'sim', sumup_reader_name: 'Simulato' }).catch(
                  (e) => setError(e.message)
                )
              }
            >
              <Icona nome="prova" gruppo="tasti" />{' '}
              {tr("Usa un lettore SIMULATO (solo test): l'esito arriva da solo dopo 2,5s")}
            </button>
          )}
          <div className="row" style={{ gap: 8 }}>
            <input
              type="text"
              placeholder={tr('Codice di pairing')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ textTransform: 'uppercase' }}
            />
            <button
              className="btn small"
              disabled={busy || !code.trim()}
              onClick={associa}
              style={{ flexShrink: 0 }}
            >
              {busy ? tr('Associo…') : <><Icona nome="unisci" gruppo="tasti" /> {tr('Associa')}</>}
            </button>
          </div>
        </>
      )}
      {confirmUnpair && (
        <ConfirmDialog
          title={tr('Dissociare il lettore?')}
          message={tr('Per usarlo di nuovo servirà un nuovo codice di pairing.')}
          confirmLabel={tr('Dissocia')}
          danger
          onCancel={() => setConfirmUnpair(false)}
          onConfirm={dissocia}
        />
      )}
    </div>
  )
}

// ── QUALI AVVISI VOGLIO, SU QUESTO SCHERMO ───────────────────────────
// Le notifiche non servono a tutti allo stesso modo: al banco «nuovo
// ordine» è la cosa più importante della serata, in sala serve «pronto», e
// chi tiene il portatile nel retro non vuole niente. La scelta è di chi
// guarda QUESTO schermo — non una regola del bar — quindi resta sul
// dispositivo e vale per la persona collegata: due che si passano lo stesso
// tablet nei cambi turno non si sovrascrivono a vicenda.
// LE PASTIGLIE «SCEGLI UN MODO». Una fila di scelte che si escludono a
// vicenda, quella in vigore accesa, un tocco salva: in questa schermata
// compare quattordici volte, ed era scritta quattordici volte — cambiare
// una pastiglia voleva dire cambiarla in quattordici posti.
//
// Ogni opzione e' `[valore, etichetta, spiegazione?, spenta?]`. Una voce
// impossibile resta A VISTA, spenta, con il motivo nella spiegazione:
// sparire fa dubitare di averla immaginata.
function SceltaModo({ valore, opzioni, onScegli, colonne }) {
  return (
    <div className="mode-choice" style={colonne ? { gridTemplateColumns: colonne } : undefined}>
      {opzioni.map(([id, etichetta, spiegazione, spenta]) => (
        <button
          key={String(id)}
          className={`mode-option${valore === id ? ' active' : ''}`}
          disabled={spenta}
          title={spiegazione}
          onClick={() => onScegli(id)}
        >
          <ConIcona testo={etichetta} />
        </button>
      ))}
    </div>
  )
}

// UNA FRASE CON UN'ICONA IN MEZZO. Il testo tradotto porta il segnaposto
// {icona} dove va il disegno: l'inglese mette le parole in un altro ordine
// («Il tasto ⊕ apre…» / «The ⊕ button opens…»), e spezzare la frase in due
// pezzi da tradurre a parte lo impedirebbe.
function ConIconaDentro({ testo, icona }) {
  const [prima, ...dopo] = testo.split('{icona}')
  return (
    <>
      {prima}
      {dopo.length > 0 && icona}
      {dopo.join('')}
    </>
  )
}

// «Richiede «Magazzino e fornitori».», coi nomi dei moduli nella lingua in
// uso. È fraseRichiede di lib/licenza.js, ricomposta qui: là la frase nasce
// già italiana, e un pezzo di frase non si traduce.
function fraseRichiedeTradotta(ids) {
  const nomi = ids.map((id) => `«${trSegnato(moduliPremium().find((m) => m.id === id)?.label ?? id)}»`)
  if (!nomi.length) return ''
  if (nomi.length === 1) return tr('Richiede {modulo}.', { modulo: nomi[0] })
  return tr('Richiede {moduli} e {ultimo}.', { moduli: nomi.slice(0, -1).join(', '), ultimo: nomi.at(-1) })
}

// Input numerico che salva solo al blur/invio, per non scrivere su Firestore
// ad ogni tasto premuto.
function AmountInput({ value, min, max, step, onCommit, label }) {
  const [val, setVal] = useState(String(value ?? ''))

  useEffect(() => {
    setVal(String(value ?? ''))
  }, [value])

  function commit() {
    let n = Number(val)
    if (!Number.isFinite(n)) n = value
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    setVal(String(n))
    if (n !== value) onCommit(n)
  }

  return (
    <input
      className="setting-amount"
      type="number"
      inputMode="decimal"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
    />
  )
}

// Un orario in ore e minuti. Si salva all'uscita dal campo, come gli
// importi: il selettore dell'ora manda un valore a ogni cifra, e ognuno
// sarebbe una scrittura sulle impostazioni di tutti i terminali.
function OrarioInput({ label, value, onCommit }) {
  const [val, setVal] = useState(value ?? '')
  useEffect(() => {
    setVal(value ?? '')
  }, [value])
  return (
    <input
      className="setting-amount"
      type="time"
      aria-label={label}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => val && val !== value && onCommit(val)}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
    />
  )
}

// ── LE FUNZIONI PREMIUM ───────────────────────────────────
// Cosa ha questo locale, e cosa potrebbe avere. Anche quelle che NON ha
// restano in elenco APPOSTA (decisione dell'utente, 26/08/2026): sparite
// del tutto, nessuno saprebbe che esistono, e chi le ha viste una volta si
// chiederebbe dove sono finite.
//
// DUE RIGHE DIVERSE, e lo si vede (lib/licenza.js):
// · modulo NON INCLUSO — interruttore spento e bloccato, che al tocco dice
//   perché. Cosa il locale ha comprato non si decide da qui.
// · modulo INCLUSO — interruttore NORMALE: si accende e si spegne come
//   ogni altra impostazione. Resta scritto che è una funzione premium, ma
//   «non inclusa» su una funzione che il locale ha sarebbe falso.
function FunzioniPremium({ settings, onSave }) {
  return (
    <div className="card settings-section">
      <h3>{tr('Funzioni premium')}</h3>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        {tr('Le funzioni della licenza. Quelle incluse si accendono e si spengono da qui; le altre sono elencate con la loro descrizione.')}
      </p>
      {moduliPremium().map((m) => {
        const incluso = moduloIncluso(settings, m.id)
        // IN PROVA (licenza.prove, scritta dalla regia): la data in cui la
        // prova finisce, perché alla scadenza il modulo si spegne da solo.
        const prova = incluso ? scadenzaProva(settings, m.id) : null
        // INCLUSO MA SENZA LA SUA BASE (REQ-LIC-015): l'inventario senza il
        // magazzino non lavora. L'interruttore lo dice invece di accendersi
        // per finta.
        const richiede = incluso ? fraseRichiedeTradotta(basiMancanti(settings, m.id)) : ''
        const stato = prova
          ? tr('In prova fino al {data}.', {
              data: prova.toLocaleDateString(formatoAttivo(), { day: 'numeric', month: 'long' }),
            })
          : incluso
          ? tr('Funzione premium, inclusa in questa installazione.')
          : tr('Funzione premium: non inclusa.')
        return (
          <ToggleRow
            key={m.id}
            label={trSegnato(m.label)}
            desc={[trSegnato(m.descrizione), stato, richiede].filter(Boolean).join(' ')}
            checked={moduloAttivo(settings, m.id)}
            motivo={
              !incluso
                ? trSegnato(MOTIVO_PREMIUM)
                : richiede
                ? tr('{richiede} Si attiva quando è attivo anche quello.', { richiede })
                : undefined
            }
            onChange={(v) => onSave({ [chiaveModulo(m.id)]: v })}
          />
        )
      })}
      {/* COME SI COMPORTA L'INVENTARIO, sotto il suo interruttore e solo
          quando c'è: un'impostazione di una funzione che non si vede non
          avrebbe dove portare. Il default è «riapre da sé» — il consumo si
          legge fra due chiusure — ma Flavio deve poter scegliere di aprirlo
          a mano (Daniele, 17/09/2026). */}
      {moduloAttivo(settings, 'conta') && (
        <ToggleRow
          label={tr('Chiuso un inventario, ne apre subito un altro')}
          desc={tr('Alla chiusura di un inventario il successivo si apre dalle giacenze appena rettificate, e il consumo si legge fra due chiusure. Spento, il successivo si apre a mano.')}
          checked={settings.inventario_riapre_da_solo !== false}
          onChange={(v) => onSave({ inventario_riapre_da_solo: v })}
        />
      )}
      {/* LA PAGINA DI PROVA (REQ-MAG-050) esiste solo nell'ambiente di
          test e in locale (lib/prova.js): in produzione l'interruttore non
          compare nemmeno. */}
      {devToolsEnabled && (
        <ToggleRow
          label={tr('Controllo del magazzino (prova)')}
          desc={tr('In Magazzino, una pagina di prova per il conteggio prodotto per prodotto, con rettifica immediata della giacenza e rapporto di acquisti, venduto, differenze e giorni di scorta. Solo nell’ambiente di test.')}
          checked={settings.controllo_magazzino_prova === true}
          onChange={(v) => onSave({ controllo_magazzino_prova: v })}
        />
      )}
    </div>
  )
}
