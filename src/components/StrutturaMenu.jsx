import { useId, useMemo, useState } from 'react'
import {
  creaSezioneCarta,
  aggiornaSezioneCarta,
  eliminaSezioneCarta,
  riordinaSezioniCarta,
  prepopolaStruttura,
  eliminaStruttura,
  creaVoceCarta,
  aggiornaVoceCarta,
  eliminaVoceCarta,
  riordinaVociCarta,
} from '../lib/api.js'
import {
  VISTE_SEZIONE,
  testo,
  ordina,
  riordino,
  perCategoria,
  nomeVoce,
  nomeSezione,
  nomeGruppo,
  gruppiScritti,
  perIlCliente,
  prepopolazione,
  vociPerSezione,
  inFondo,
  fuoriDalMenu,
  strutturaPersonalizzata,
  PERCORSO_ANTEPRIMA,
} from '../lib/strutturaMenu.js'
import { perNome } from '../lib/macros.js'
import { formatPrice } from '../lib/orderStatus.js'
import { immagineVoce, segnapostoDrink } from '../lib/speciali.js'
import { useFondoChiaro } from '../lib/useFondoChiaro.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import Icona from './Icona.jsx'

// LA STRUTTURA DEL MENÙ DEI CLIENTI, DAL GESTIONALE (REQ-MENU-025): il
// menù del tavolo com'è, sezione per sezione, coi testi modificabili dove
// stanno. Finché nessuno lo personalizza è quello di sempre, per categorie;
// si parte da una copia delle voci della cassa, e da lì è tutto libero
// (strutturaMenu.js). Flavio, 04/11/2026: «un pannello dove creiamo tutte
// le voci che vanno all'interno del menù vista cliente». Una voce si
// aggiunge qui o dalla scheda del prodotto (MenuManager, InStruttura): è lo
// stesso dato visto dai due lati.
//
// HA LA FORMA DEL MENÙ, non di un modulo. L'utente, 05/11/2026, davanti a
// una fila di caselle per voce: «come associamo le voci di menu agli item di
// menu della cassa? La casella con il nome in grigio cos'è? … possiamo
// renderlo simile a un WYSIWYG». Ogni campo mostra il testo che legge il
// cliente e sopra dice da dove viene, e il prodotto della cassa ha la sua
// riga col 🔗.
//
// Le scritture partono in sottofondo (api.js) e la sottoscrizione le
// mostra subito: niente «Salva», un campo si registra uscendone.

// UN TESTO DEL MENÙ, MODIFICABILE DOV'È. Mostra quello che legge il
// cliente: il testo `proprio`, se c'è, se no quello che eredita (`base`,
// dalla scheda prodotto). Lasciato uguale a quello ereditato, o svuotato,
// non scrive un doppione: torna a ereditare, così una correzione fatta alla
// fonte arriva anche qui. L'etichetta sopra dice da dove viene il testo,
// che era proprio la cosa che non si capiva.
//
// Rinasce (key) quando il testo cambia da fuori — un altro terminale, o il
// proprio salvataggio tornato dalla cache —, così non resta a mostrare
// quello di prima.
function Testo({ etichetta, origine, ripristina, proprio, base = '', salva, area = false, obbligatorio = false, className = '', ...props }) {
  const id = useId()
  const Tag = area ? 'textarea' : 'input'
  const mostrato = testo(proprio) || testo(base)
  return (
    <div className={`wys-campo ${className}`}>
      <div className="wys-etichetta">
        <label htmlFor={id}>{etichetta}</label>
        {/* L'accento solo su quello che vale per la sola sezione: è la
            cosa che si perde di vista, e che una correzione sulla scheda
            non raggiunge. */}
        {origine && <span className={`wys-origine${testo(proprio) ? ' proprio' : ''}`}>{origine}</span>}
        {ripristina}
      </div>
      <Tag
        key={mostrato}
        id={id}
        className="wys"
        defaultValue={mostrato}
        rows={area ? 2 : undefined}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (v === mostrato) return
          // Un nome che non si può lasciare vuoto torna com'era.
          if (!v && obbligatorio) {
            e.target.value = mostrato
            return
          }
          if (!v) e.target.value = testo(base)
          salva(v === testo(base) ? '' : v)
        }}
        onKeyDown={area ? undefined : (e) => e.key === 'Enter' && e.currentTarget.blur()}
        {...props}
      />
    </div>
  )
}

// Il tasto che toglie un ritocco e torna al testo della scheda.
function Ripristina({ cosa, onClick }) {
  return (
    <button
      type="button"
      className="btn ghost small wys-ripristina"
      aria-label={`Riporta ${cosa} come la scheda`}
      onClick={onClick}
    >
      ↺ come la scheda
    </button>
  )
}

// I prodotti della cassa per la tendina, divisi come il menù per categorie
// (strutturaMenu.js, perCategoria): sono centinaia, e chi cerca «Gin Mare»
// lo cerca fra i gin. Calcolati una volta per tutto l'editor.
const gruppiCassa = (drinks, categories) =>
  perCategoria(drinks, categories, 'Senza categoria').map((g) => ({ nome: g.nome, prodotti: [...g.prodotti].sort(perNome) }))

// La scelta vuota è un invito («+ Aggiungi…», «Scegliere un prodotto»), non
// un valore: una voce senza prodotto non si può fare (REQ-MENU-025).
function TendinaCassa({ valore, gruppi, onChange, vuota, ...props }) {
  return (
    <select value={valore || ''} onChange={(e) => e.target.value && onChange(e.target.value)} {...props}>
      {(vuota || !valore) && (
        <option value="" disabled={Boolean(valore)}>
          {vuota || '— Scegliere un prodotto della cassa —'}
        </option>
      )}
      {gruppi.map((g) => (
        <optgroup key={g.nome} label={g.nome}>
          {g.prodotti.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {formatPrice(d.price)}
              {d.available ? '' : ' (fuori menù)'}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

// Una tendina di sezioni: «Aggiungi a…», «Sposta in…».
function SceltaSezione({ sezioni, invito, onScegli, ...props }) {
  return (
    <select value="" onChange={(e) => e.target.value && onScegli(e.target.value)} {...props}>
      <option value="">{invito}</option>
      {sezioni.map((s) => (
        <option key={s.id} value={s.id}>
          {nomeSezione(s)}
        </option>
      ))}
    </select>
  )
}

// «Aggiungi a una sezione…»: la voce nuova va in fondo alla sezione scelta.
function AggiungiA({ drink, carta, sezioni, ...props }) {
  return (
    <SceltaSezione
      sezioni={sezioni}
      invito="Aggiungi a una sezione…"
      onScegli={(sezione_id) => creaVoceCarta({ sezione_id, drink_id: drink.id, ordine: inFondo(carta, sezione_id) })}
      aria-label={`Aggiungi ${drink.name} a una sezione`}
      {...props}
    />
  )
}

// IL MENÙ DEI CLIENTI VISTO DALLA SCHEDA DEL PRODOTTO. Flavio, 04/11/2026:
// «quando nel menù del gestionale fai attiva sul menù, dovrebbe apparire
// una tendina con tutti gli item dove uno seleziona quello a cui si deve
// agganciare». Qui si vede in quali sezioni compare il prodotto, lo si
// aggiunge a un'altra o lo si toglie; e si vede, soprattutto, quando non
// compare da nessuna parte. Senza una struttura personalizzata non dice
// niente: il prodotto compare con la sua categoria.
export function InStruttura({ drink, carta }) {
  if (!strutturaPersonalizzata(carta)) return null
  const sezioni = ordina(carta.sezioni)
  const nomeDi = new Map(sezioni.map((s) => [s.id, nomeSezione(s)]))
  const mie = (carta.voci || []).filter((v) => v.drink_id === drink.id && nomeDi.has(v.sezione_id))
  return (
    <div style={{ margin: '6px 0' }}>
      <span className="muted small">Menù dei clienti:</span>{' '}
      {!mie.length && <span className="small struttura-avviso-in-linea">non compare</span>}
      {mie.map((v) => (
        <span className="chip" key={v.id} style={{ marginRight: 4 }}>
          {nomeDi.get(v.sezione_id)}
          <button
            type="button"
            className="btn ghost small"
            aria-label={`Togli ${drink.name} da ${nomeDi.get(v.sezione_id)}`}
            onClick={() => eliminaVoceCarta(v.id)}
          >
            ✕
          </button>
        </span>
      ))}
      <AggiungiA drink={drink} carta={carta} sezioni={sezioni} style={{ marginTop: 4 }} />
    </div>
  )
}

// LA CARD, con la forma di quella del menù (MenuPage): immagine, testi,
// prezzo. In una sezione snella solo nome e prezzo, come al tavolo. Sotto,
// il «piede» con quello che al tavolo non si vede: il prodotto della cassa e
// i tasti.
function Card({ drink, snella, attenuata, avviso, piede, children, immagini }) {
  const img = drink ? immagineVoce(drink, import.meta.env.BASE_URL, immagini) : null
  return (
    <div className={`card menu-item struttura-voce${attenuata ? ' attenuata' : ''}`}>
      <div className="row">
        {!snella && (
          <img
            className={`drink-thumb${img ? (drink.image_url ? '' : ' disegno') : ' placeholder'}`}
            src={img || segnapostoDrink({ chiaro: immagini.chiaro })}
            alt=""
            loading="lazy"
          />
        )}
        <div className="grow">{children}</div>
        <span className="price">{drink ? formatPrice(drink.price) : '—'}</span>
      </div>
      {avviso && <p className="struttura-avviso small">{avviso}</p>}
      <div className="struttura-piede">{piede}</div>
    </div>
  )
}

// UNA VOCE: i testi sono suoi se li ha, se no quelli della scheda del
// prodotto collegato; il prodotto della cassa dà prezzo, disponibilità e
// quello che arriva al banco. Si sposta in un'altra sezione senza perdere i
// suoi ritocchi.
//
// IL PRODOTTO SI LEGGE, E SI CAMBIA A RICHIESTA. Una tendina con tutto il
// listino in ogni voce faceva, su un listino vero copiato per intero,
// centinaia di tendine da centinaia di righe: decine di migliaia di
// elementi da ridisegnare a ogni campo salvato. La tendina si apre solo su
// «Cambia», e c'è da subito solo per una voce che un prodotto non ce l'ha.
function Voce({ voce, drink, snella, gruppi, sezioni, immagini, primo, ultimo, sposta, spostaIn, onApriScheda }) {
  const [cambia, setCambia] = useState(false)
  const cliente = drink ? perIlCliente(drink) : null
  const nome = nomeVoce(voce, cliente)
  const altre = sezioni.filter((s) => s.id !== voce.sezione_id)
  const campo = (chiave, etichetta, cosa, base, extra) => (
    <Testo
      etichetta={etichetta}
      origine={testo(voce[chiave]) ? 'solo in questa sezione' : drink ? 'dalla scheda prodotto' : ''}
      ripristina={
        testo(voce[chiave]) ? <Ripristina cosa={cosa} onClick={() => aggiornaVoceCarta(voce.id, { [chiave]: '' })} /> : null
      }
      proprio={voce[chiave]}
      base={base}
      salva={(v) => aggiornaVoceCarta(voce.id, { [chiave]: v })}
      aria-label={`${etichetta} nella sezione`}
      {...extra}
    />
  )
  return (
    <Card
      drink={drink}
      snella={snella}
      immagini={immagini}
      attenuata={!drink || !drink.available}
      avviso={
        !drink
          ? 'Nessun prodotto della cassa collegato: la voce non compare al tavolo.'
          : !drink.available
            ? 'Prodotto fuori menù: la voce non compare al tavolo finché non torna disponibile.'
            : null
      }
      piede={
        <>
          <div className="struttura-collegamento">
            <span className="wys-etichetta"><Icona nome="unisci" gruppo="tasti" /> Prodotto della cassa</span>
            {drink && !cambia ? (
              <div className="struttura-prodotto">
                <span className="small">
                  {drink.name} · {formatPrice(drink.price)}
                </span>
                <button className="btn ghost small" aria-label={`Cambia il prodotto della cassa di ${nome}`} onClick={() => setCambia(true)}>
                  Cambia
                </button>
              </div>
            ) : (
              <TendinaCassa
                valore={voce.drink_id}
                gruppi={gruppi}
                onChange={(id) => {
                  aggiornaVoceCarta(voce.id, { drink_id: id })
                  setCambia(false)
                }}
                onBlur={() => setCambia(false)}
                autoFocus={cambia}
                aria-label="Prodotto della cassa"
              />
            )}
          </div>
          <div className="struttura-tasti">
            {altre.length > 0 && (
              <SceltaSezione
                sezioni={altre}
                invito="Sposta in…"
                onScegli={spostaIn}
                aria-label={`Sposta ${nome} in un’altra sezione`}
              />
            )}
            {drink && (
              <button className="btn ghost small" aria-label={`Apri la scheda di ${drink.name}`} onClick={() => onApriScheda?.(drink)}>
                Scheda
              </button>
            )}
            <button className="btn ghost small" aria-label="Voce su" disabled={primo} onClick={() => sposta(-1)}>
              ↑
            </button>
            <button className="btn ghost small" aria-label="Voce giù" disabled={ultimo} onClick={() => sposta(1)}>
              ↓
            </button>
            <button className="btn ghost small" aria-label={`Togli ${nome} dalla sezione`} onClick={() => eliminaVoceCarta(voce.id)}>
              <Icona nome="elimina" gruppo="tasti" />
            </button>
          </div>
        </>
      }
    >
      {campo('nome', 'Nome', 'il nome', cliente?.name, { placeholder: 'Nome letto dal cliente', className: 'wys-nome' })}
      {!snella && (
        <>
          {campo('descrizione', 'Descrizione', 'la descrizione', drink?.description, {
            area: true,
            placeholder: 'Provenienza, carattere, servizio',
          })}
          {/* Dalla ricetta mai (strutturaMenu.js, voceInSezione): solo il
              ritocco o quelli scritti sulla scheda. */}
          {campo('ingredienti', 'Ingredienti', 'gli ingredienti', drink?.ingredienti, { placeholder: 'Separati da virgola' })}
        </>
      )}
    </Card>
  )
}

// I PRODOTTI DELLA CASSA RIMASTI FUORI (fuoriDalMenu): quelli nuovi, o tolti
// da ogni sezione. Il prezzo della libertà è che un prodotto nuovo non entra
// da solo; qui si vede, e si aggiunge con un tocco.
function FuoriDalMenu({ prodotti, carta, sezioni }) {
  if (!prodotti.length) return null
  return (
    <details className="card struttura-fuori" open={prodotti.length <= 8}>
      <summary>
        <strong>Prodotti della cassa non presenti nel menù dei clienti ({prodotti.length})</strong>
      </summary>
      <p className="muted small" style={{ margin: '6px 0' }}>
        Al tavolo non si vedono. Un prodotto aggiunto in cassa dopo la personalizzazione compare qui.
      </p>
      {prodotti.map((d) => (
        <div className="struttura-fuori-riga" key={d.id}>
          <span className="grow">
            {d.name}{' '}
            <span className="muted small">
              · {formatPrice(d.price)}
              {d.available ? '' : ' · fuori menù'}
            </span>
          </span>
          <AggiungiA drink={d} carta={carta} sezioni={sezioni} />
        </div>
      ))}
    </details>
  )
}

// Il campo della sezione nuova, con lo stato suo: dentro l'editor, ogni
// lettera battuta ridisegnava tutte le sezioni.
function NuovaSezione({ carta }) {
  const [nuova, setNuova] = useState('')
  // Una sezione nuova va in cima: di solito è la Signature, o quella dei
  // consigli dello staff, e scendere è un tocco su ↓.
  function aggiungi() {
    if (!nuova.trim()) return
    const primo = Math.min(0, ...carta.sezioni.map((s) => Number(s.ordine) || 0))
    creaSezioneCarta({ nome: nuova, ordine: primo - 1 })
    setNuova('')
  }
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="wys-etichetta">
        <label htmlFor="struttura-nuova">Nuova sezione</label>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input
          id="struttura-nuova"
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && aggiungi()}
          placeholder="Signature, Suggeriti dallo staff, Gin…"
          aria-label="Nome della nuova sezione"
        />
        <button className="btn small" onClick={aggiungi}>
          Aggiungi
        </button>
      </div>
      <p className="muted small" style={{ margin: '4px 0 0' }}>
        Si aggiunge in cima al menù.
      </p>
    </div>
  )
}

// IL GRUPPO DI UNA SEZIONE (REQ-MENU-030): la macro categoria in cui sta,
// per i menù impaginati a gruppi. Si sceglie fra quelli già scritti o se ne
// scrive uno nuovo nella stessa casella (una tendina con le proposte, non
// un elenco chiuso); vuota, la sezione non è in nessun gruppo. Si registra
// all'uscita dal campo, come i testi (e come loro riparte da quello scritto
// quando cambia altrove: `key`).
// Le proposte stanno in un elenco solo, per tutte le sezioni; l'editor è
// uno per pagina, e un id fisso basta.
const ELENCO_GRUPPI = 'struttura-gruppi'

function GruppoSezione({ sezione }) {
  const scritto = nomeGruppo(sezione) || ''
  return (
    <input
      key={scritto}
      className="struttura-gruppo"
      list={ELENCO_GRUPPI}
      defaultValue={scritto}
      onBlur={(e) => {
        const nuovo = nomeGruppo({ gruppo: e.target.value })
        if ((nuovo || '') !== scritto) aggiornaSezioneCarta(sezione.id, { gruppo: nuovo })
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      placeholder="Gruppo"
      maxLength={40}
      aria-label={`Gruppo della sezione ${nomeSezione(sezione)}`}
    />
  )
}

// La struttura arriva da MenuManager, che la tiene già per le schede dei
// prodotti: una sottoscrizione sola. `onApriScheda` apre la scheda intera
// di un prodotto, e chiusa si torna qui.
export default function StrutturaMenu({ carta, drinks, categories, disegni = false, onApriScheda }) {
  const chiaro = useFondoChiaro()
  const immagini = useMemo(() => ({ chiaro, disegni }), [chiaro, disegni])
  // Le cancellazioni grosse si confermano col dialogo dell'app: il
  // `confirm` del browser, nella PWA installata, può essere bloccato senza
  // dire niente (ConfirmDialog.jsx).
  const [conferma, setConferma] = useState(null)

  const personalizzata = strutturaPersonalizzata(carta)
  const perId = useMemo(() => new Map((drinks || []).map((d) => [d.id, d])), [drinks])
  const gruppi = useMemo(() => gruppiCassa(drinks, categories), [drinks, categories])
  const sezioni = useMemo(() => ordina(carta.sezioni), [carta.sezioni])
  const gruppiProposti = useMemo(() => gruppiScritti(carta.sezioni), [carta.sezioni])
  const vociPer = useMemo(
    () => vociPerSezione(carta.voci, (v) => nomeVoce(v, perId.get(v.drink_id) && perIlCliente(perId.get(v.drink_id)))),
    [carta.voci, perId]
  )
  const fuori = useMemo(() => fuoriDalMenu(carta, drinks), [carta, drinks])

  // LA COPIA DELLE VOCI DELLA CASSA, sempre a portata. Compariva solo
  // prima della personalizzazione, e su un menù già personalizzato (quello
  // della demo) non si trovava: l'utente, 05/11/2026, «serve un tasto per
  // prepopolare tutto come se fosse il menu cassa e poi da lì modifico».
  // Sopra una struttura che c'è già la sostituisce, e prima lo chiede: i
  // ritocchi fatti se ne vanno con lei.
  function prepopola() {
    const copia = prepopolazione(drinks, categories)
    if (!personalizzata) return prepopolaStruttura(copia)
    setConferma({
      titolo: 'Ripartire dalle voci della cassa?',
      messaggio: 'Tutte le sezioni e le voci si sostituiscono con una copia del menù della cassa. Sezioni, spostamenti e testi ritoccati andranno persi.',
      etichetta: 'Riparti',
      azione: () => prepopolaStruttura(copia, { sostituisci: carta }),
    })
  }

  function eliminaSezione(s) {
    const voci = vociPer.get(s.id) || []
    const conVoci = voci.length ? ` e le sue ${voci.length === 1 ? 'voce' : `${voci.length} voci`}` : ''
    setConferma({
      titolo: `Eliminare la sezione «${nomeSezione(s)}»${conVoci}?`,
      messaggio: 'I prodotti della cassa restano.',
      etichetta: 'Elimina',
      azione: () =>
        eliminaSezioneCarta(
          s.id,
          voci.map((v) => v.id)
        ),
    })
  }

  function tornaAlleCategorie() {
    setConferma({
      titolo: 'Tornare al menù per categorie?',
      messaggio: 'Si eliminano tutte le sezioni e le voci: il menù dei clienti torna a dividersi per le categorie della cassa.',
      etichetta: 'Elimina tutto',
      azione: () => eliminaStruttura(carta),
    })
  }

  return (
    <div className="struttura-menu">
      <div className="card">
        <h3 style={{ marginTop: 0 }}><Icona nome="ordina-dal-menu" gruppo="tasti" /> Menù dei clienti</h3>
        {personalizzata ? (
          <>
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              Il menù consultato al tavolo, nell'ordine in cui compare. Sezioni e voci si aggiungono, si spostano e si
              rinominano liberamente; i testi si modificano direttamente nelle card e la modifica si registra all'uscita
              dal campo. Il personale ordina sempre dal menù della cassa.
            </p>
            <dl className="struttura-legenda small">
              <dt><Icona nome="unisci" gruppo="tasti" /> Prodotto della cassa</dt>
              <dd>
                Ogni voce è collegata a un prodotto della cassa, da cui prende prezzo e disponibilità; l'ordine arriva al
                banco con quel prodotto, col nome letto dal cliente nella nota. Lo stesso prodotto può stare in più
                sezioni.
              </dd>
              <dt>Sopra ogni campo</dt>
              <dd>
                Da dove viene il testo: dalla scheda prodotto, valido in tutto il menù, o solo da questa sezione.
                Svuotando il campo, o con «↺», si torna al testo della scheda.
              </dd>
            </dl>
          </>
        ) : (
          <p className="muted small" style={{ margin: '0 0 8px' }}>
            Il menù dei clienti è diviso come le categorie della cassa, con tutti i prodotti disponibili. Per
            personalizzarlo si parte da una copia: una sezione per categoria, con dentro i suoi prodotti già collegati. Da
            lì sezioni e voci si aggiungono, si spostano, si rinominano e si nascondono liberamente. Un prodotto aggiunto
            in cassa in seguito non entra da solo: compare nell'elenco dei prodotti non presenti, da cui si aggiunge.
          </p>
        )}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className={`btn small${personalizzata ? ' secondary' : ''}`} onClick={prepopola}>
            {personalizzata ? 'Riparti dalle voci della cassa' : 'Prepopola con le voci della cassa'}
          </button>
          <a className="btn ghost small" href={PERCORSO_ANTEPRIMA} target="_blank" rel="noreferrer">
            <Icona nome="mostra" gruppo="tasti" /> Anteprima del menù dei clienti
          </a>
        </div>
      </div>

      {personalizzata && (
        <>
          <FuoriDalMenu prodotti={fuori} carta={carta} sezioni={sezioni} />
          <NuovaSezione carta={carta} />
          <datalist id={ELENCO_GRUPPI}>
            {gruppiProposti.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>

          {sezioni.map((s, idx) => {
            const nome = nomeSezione(s)
            const snella = s.vista === 'snella'
            const voci = vociPer.get(s.id) || []
            const visibili = voci.filter((v) => perId.get(v.drink_id)?.available).length
            return (
              <section className={`struttura-sezione${s.nascosta ? ' nascosta' : ''}`} key={s.id} aria-label={`Sezione ${nome}`}>
                <div className="struttura-barra">
                  <select
                    value={s.vista}
                    onChange={(e) => aggiornaSezioneCarta(s.id, { vista: e.target.value })}
                    aria-label="Visualizzazione della sezione"
                  >
                    {VISTE_SEZIONE.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <label className="struttura-spunta small">
                    <input
                      type="checkbox"
                      checked={s.nascosta}
                      onChange={(e) => aggiornaSezioneCarta(s.id, { nascosta: e.target.checked })}
                    />
                    Nascosta
                  </label>
                  <GruppoSezione sezione={s} />
                  <span className="grow" />
                  <button
                    className="btn ghost small"
                    aria-label="Sezione su"
                    disabled={idx === 0}
                    onClick={() => riordinaSezioniCarta(riordino(sezioni, idx, -1))}
                  >
                    ↑
                  </button>
                  <button
                    className="btn ghost small"
                    aria-label="Sezione giù"
                    disabled={idx === sezioni.length - 1}
                    onClick={() => riordinaSezioniCarta(riordino(sezioni, idx, 1))}
                  >
                    ↓
                  </button>
                  <button className="btn ghost small" aria-label={`Elimina la sezione ${nome}`} onClick={() => eliminaSezione(s)}>
                    <Icona nome="elimina" gruppo="tasti" />
                  </button>
                </div>

                <Testo
                  etichetta="Titolo della sezione"
                  proprio={s.nome}
                  obbligatorio
                  salva={(valore) => aggiornaSezioneCarta(s.id, { nome: valore })}
                  aria-label="Titolo della sezione"
                  className="wys-titolo"
                />
                <p className="muted small struttura-nota">
                  {s.nascosta
                    ? 'Nascosta: al tavolo la sezione non compare.'
                    : `${visibili} ${visibili === 1 ? 'voce visibile' : 'voci visibili'} al tavolo${
                        snella ? '; snella: nome e prezzo su una riga, senza immagine, descrizione e ingredienti' : ''
                      }.`}
                </p>

                {voci.map((v, j) => (
                  <Voce
                    key={v.id}
                    voce={v}
                    drink={perId.get(v.drink_id)}
                    snella={snella}
                    gruppi={gruppi}
                    sezioni={sezioni}
                    immagini={immagini}
                    primo={j === 0}
                    ultimo={j === voci.length - 1}
                    sposta={(dir) => riordinaVociCarta(riordino(voci, j, dir))}
                    spostaIn={(sezione_id) => aggiornaVoceCarta(v.id, { sezione_id, ordine: inFondo(carta, sezione_id) })}
                    onApriScheda={onApriScheda}
                  />
                ))}
                {/* Una voce nasce già col suo prodotto: senza, al tavolo non
                    compare, e restava lì in attesa senza dirlo. */}
                <TendinaCassa
                  valore=""
                  gruppi={gruppi}
                  vuota="+ Aggiungi un prodotto della cassa a questa sezione…"
                  onChange={(drink_id) => creaVoceCarta({ sezione_id: s.id, drink_id, ordine: voci.length })}
                  aria-label={`Aggiungi un prodotto a ${nome}`}
                  className="struttura-aggiungi"
                />
              </section>
            )
          })}

          <div className="struttura-fine">
            <button className="btn ghost small" onClick={tornaAlleCategorie}>
              Torna al menù per categorie
            </button>
          </div>
        </>
      )}

      {conferma && (
        <ConfirmDialog
          title={conferma.titolo}
          message={conferma.messaggio}
          confirmLabel={conferma.etichetta}
          danger
          onConfirm={() => {
            conferma.azione()
            setConferma(null)
          }}
          onCancel={() => setConferma(null)}
        />
      )}
    </div>
  )
}
