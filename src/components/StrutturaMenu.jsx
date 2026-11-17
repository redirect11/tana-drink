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
  spostaVociCarta,
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
  spostamentoInBlocco,
  categoriaScritta,
  categoriaDellaVoce,
  sezioneDellaCategoria,
  raggruppamentoPerCategoria,
  voceTrovata,
  NON_CATEGORIZZATI,
  fuoriDalMenu,
  strutturaPersonalizzata,
  PERCORSO_ANTEPRIMA,
} from '../lib/strutturaMenu.js'
import { perNome } from '../lib/macros.js'
import { formatPrice } from '../lib/orderStatus.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import Icona from './Icona.jsx'
import AiutoCampo from './AiutoCampo.jsx'
import IngredientiVoce from './IngredientiVoce.jsx'
import { tr, trSegnato } from '../lib/lingua.js'

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
// L'etichetta arriva intera, una frase per campo: «Riporta il nome come la
// scheda» composto a pezzi non si tradurrebbe.
function Ripristina({ etichetta, onClick }) {
  return (
    <button
      type="button"
      className="btn ghost small wys-ripristina"
      aria-label={etichetta}
      onClick={onClick}
    >
      ↺ {tr('come la scheda')}
    </button>
  )
}

// I prodotti della cassa per la tendina, divisi come il menù per categorie
// (strutturaMenu.js, perCategoria): sono centinaia, e chi cerca «Gin Mare»
// lo cerca fra i gin. Calcolati una volta per tutto l'editor.
const gruppiCassa = (drinks, categories) =>
  perCategoria(drinks, categories, trSegnato(NON_CATEGORIZZATI)).map((g) => ({ nome: g.nome, prodotti: [...g.prodotti].sort(perNome) }))

// La scelta vuota è un invito («+ Aggiungi…», «Scegliere un prodotto»), non
// un valore: una voce senza prodotto non si può fare (REQ-MENU-025).
function TendinaCassa({ valore, gruppi, onChange, vuota, ...props }) {
  return (
    <select value={valore || ''} onChange={(e) => e.target.value && onChange(e.target.value)} {...props}>
      {(vuota || !valore) && (
        <option value="" disabled={Boolean(valore)}>
          {vuota || tr('— Scegliere un prodotto della cassa —')}
        </option>
      )}
      {gruppi.map((g) => (
        <optgroup key={g.nome} label={g.nome}>
          {g.prodotti.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {formatPrice(d.price)}
              {d.available ? '' : ` (${tr('fuori menù')})`}
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
      invito={tr('Aggiungi a una sezione…')}
      onScegli={(sezione_id) => creaVoceCarta({ sezione_id, drink_id: drink.id, ordine: inFondo(carta, sezione_id) })}
      aria-label={tr('Aggiungi {nome} a una sezione', { nome: drink.name })}
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
      <span className="muted small">{tr('Menù dei clienti:')}</span>{' '}
      {!mie.length && <span className="small struttura-avviso-in-linea">{tr('non compare')}</span>}
      {mie.map((v) => (
        <span className="chip" key={v.id} style={{ marginRight: 4 }}>
          {nomeDi.get(v.sezione_id)}
          <button
            type="button"
            className="btn ghost small"
            aria-label={tr('Togli {nome} da {sezione}', { nome: drink.name, sezione: nomeDi.get(v.sezione_id) })}
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

// LA CATEGORIA DI UNA VOCE (REQ-MENU-041): una della cassa, una di
// magazzino, o scritta a mano; vuota, vale quella del prodotto collegato.
// Serve a «Raggruppa per categoria».
function CategoriaVoce({ voce, drink, categorieCassa = [], categorieMagazzino = [] }) {
  const id = useId()
  const scritta = categoriaScritta(voce.categoria)
  const [libera, setLibera] = useState(scritta?.tipo === 'testo')
  const dalProdotto = categoriaDellaVoce(null, drink, categorieCassa)
  const valore = libera ? 'testo' : scritta ? `${scritta.tipo}:${scritta.id}` : ''
  const salva = (categoria) => aggiornaVoceCarta(voce.id, { categoria })
  return (
    <div className="wys-campo">
      <div className="wys-etichetta">
        <label htmlFor={id}>{tr('Categoria')}</label>
        <span className={`wys-origine${scritta ? ' proprio' : ''}`}>{scritta ? tr('solo in questa voce') : tr('dal prodotto della cassa')}</span>
      </div>
      <select
        id={id}
        value={valore}
        onChange={(e) => {
          const v = e.target.value
          if (v === 'testo') return setLibera(true)
          setLibera(false)
          if (!v) return salva(null)
          const [tipo, cid] = v.split(':')
          const lista = tipo === 'categoria_cassa' ? categorieCassa : categorieMagazzino
          const c = lista.find((x) => x.id === cid)
          if (c) salva({ tipo, id: c.id, nome: c.name })
        }}
      >
        <option value="">{dalProdotto ? tr('Dal prodotto: {categoria}', { categoria: dalProdotto }) : tr('categoria|Nessuna')}</option>
        <optgroup label={tr('Categorie della cassa')}>
          {categorieCassa.map((c) => (
            <option key={c.id} value={`categoria_cassa:${c.id}`}>
              {c.name}
            </option>
          ))}
        </optgroup>
        <optgroup label={tr('Categorie di magazzino')}>
          {categorieMagazzino.map((c) => (
            <option key={c.id} value={`categoria:${c.id}`}>
              {c.name}
            </option>
          ))}
        </optgroup>
        <option value="testo">{tr('Scritta a mano…')}</option>
      </select>
      {libera && (
        <input
          className="wys"
          defaultValue={scritta?.tipo === 'testo' ? scritta.nome : ''}
          placeholder={tr('Nome della categoria')}
          aria-label={tr('Categoria scritta a mano')}
          onBlur={(e) => {
            const nome = e.target.value.trim()
            salva(nome ? { tipo: 'testo', id: null, nome } : null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      )}
    </div>
  )
}

// UNA VOCE, IN UNA RIGA (REQ-MENU-035). L'utente, 10/11/2026, davanti a
// una copia del listino fatta di centinaia di card con immagine e tre
// caselle ciascuna: «deve essere una vista più compatta e maneggevole, così
// è un casino». La riga dice quello che serve per smistare — nome, prezzo,
// se al tavolo si vede — e porta i tasti per spostarla; i testi e il
// prodotto collegato si aprono SOTTO la riga (DESIGN.md, le liste lunghe).
//
// I testi sono suoi se li ha, se no quelli della scheda del prodotto
// collegato; il prodotto della cassa dà prezzo, disponibilità e quello che
// arriva al banco. Si sposta in un'altra sezione senza perdere i ritocchi.
//
// IL PRODOTTO SI LEGGE, E SI CAMBIA A RICHIESTA: la tendina con tutto il
// listino si apre solo su «Cambia». Una voce senza prodotto ha il
// dettaglio sempre aperto, con la tendina: al tavolo non compare, ed è la
// prima cosa da sistemare.
function RigaVoce({ voce, drink, snella, gruppi, sezioni, aperta, onApri, scelta, onScegli, primo, ultimo, sposta, spostaIn, onApriScheda, magazzino = {} }) {
  const [cambia, setCambia] = useState(false)
  const cliente = drink ? perIlCliente(drink) : null
  const nome = nomeVoce(voce, cliente)
  const altre = sezioni.filter((s) => s.id !== voce.sezione_id)
  const avviso = !drink
    ? tr('Nessun prodotto della cassa collegato: la voce non compare al tavolo.')
    : !drink.available
      ? tr('Prodotto fuori menù: la voce non compare al tavolo finché non torna disponibile.')
      : null
  const dettaglio = aperta || !drink
  // Le etichette arrivano già intere (etichetta del campo, del campo nella
  // sezione e del tasto che lo riporta come la scheda): composte a pezzi non
  // si tradurrebbero.
  const campo = (chiave, { etichetta, nellaSezione, riporta }, base, extra) => (
    <Testo
      etichetta={etichetta}
      origine={testo(voce[chiave]) ? tr('solo in questa sezione') : drink ? tr('dalla scheda prodotto') : ''}
      ripristina={
        testo(voce[chiave]) ? <Ripristina etichetta={riporta} onClick={() => aggiornaVoceCarta(voce.id, { [chiave]: '' })} /> : null
      }
      proprio={voce[chiave]}
      base={base}
      salva={(v) => aggiornaVoceCarta(voce.id, { [chiave]: v })}
      aria-label={nellaSezione}
      {...extra}
    />
  )
  return (
    <div className={`inv-row struttura-riga${dettaglio ? ' open' : ''}${avviso ? ' da-guardare' : ''}`}>
      <div className="inv-row-main statica struttura-riga-main">
        <input type="checkbox" checked={scelta} onChange={onScegli} aria-label={tr('Seleziona {nome}', { nome })} />
        <button
          type="button"
          className="struttura-riga-nome"
          aria-expanded={dettaglio}
          aria-label={dettaglio ? tr('Chiudi {nome}', { nome }) : tr('Apri {nome}', { nome })}
          onClick={onApri}
          disabled={!drink}
        >
          <span className="inv-row-name">{nome || tr('Senza nome')}</span>
          {/* Il nome della cassa, quando al tavolo se ne legge un altro: è
              quello con cui la voce si cerca e arriva al banco. */}
          {drink && nome !== drink.name && <span className="muted small inv-row-cat">{drink.name}</span>}
          {avviso && <span className="small struttura-avviso-in-linea">{drink ? tr('fuori menù') : tr('senza prodotto')}</span>}
        </button>
        <span className="inv-row-price">{drink ? formatPrice(drink.price) : '—'}</span>
        <div className="struttura-tasti">
          {altre.length > 0 && (
            <SceltaSezione
              sezioni={altre}
              invito={tr('Sposta in…')}
              onScegli={spostaIn}
              aria-label={tr('Sposta {nome} in un’altra sezione', { nome })}
            />
          )}
          <button className="btn ghost small" aria-label={tr('Voce su')} disabled={primo} onClick={() => sposta(-1)}>
            ↑
          </button>
          <button className="btn ghost small" aria-label={tr('Voce giù')} disabled={ultimo} onClick={() => sposta(1)}>
            ↓
          </button>
          <button className="btn ghost small" aria-label={tr('Togli {nome} dalla sezione', { nome })} onClick={() => eliminaVoceCarta(voce.id)}>
            <Icona nome="elimina" gruppo="tasti" />
          </button>
        </div>
      </div>
      {dettaglio && (
        <div className="inv-row-dettaglio">
          {avviso && <p className="struttura-avviso small">{avviso}</p>}
          {campo(
            'nome',
            { etichetta: tr('Nome'), nellaSezione: tr('Nome nella sezione'), riporta: tr('Riporta il nome come la scheda') },
            cliente?.name,
            { placeholder: tr('Nome letto dal cliente'), className: 'wys-nome' }
          )}
          {!snella && (
            <>
              {campo(
                'descrizione',
                {
                  etichetta: tr('Descrizione'),
                  nellaSezione: tr('Descrizione nella sezione'),
                  riporta: tr('Riporta la descrizione come la scheda'),
                },
                drink?.description,
                { area: true, placeholder: tr('Provenienza, carattere, servizio') }
              )}
              {/* A etichette (REQ-MENU-040): la ricetta propone, non decide. */}
              <IngredientiVoce voce={voce} drink={drink} {...magazzino} />
            </>
          )}
          <CategoriaVoce voce={voce} drink={drink} categorieCassa={magazzino.categorieCassa} categorieMagazzino={magazzino.categorieMagazzino} />
          <div className="struttura-collegamento">
            <span className="wys-etichetta"><Icona nome="unisci" gruppo="tasti" /> {tr('Prodotto della cassa')}</span>
            {drink && !cambia ? (
              <div className="struttura-prodotto">
                <span className="small">
                  {drink.name} · {formatPrice(drink.price)}
                </span>
                <button className="btn ghost small" aria-label={tr('Cambia il prodotto della cassa di {nome}', { nome })} onClick={() => setCambia(true)}>
                  {tr('Cambia')}
                </button>
                <button className="btn ghost small" aria-label={tr('Apri la scheda di {nome}', { nome: drink.name })} onClick={() => onApriScheda?.(drink, voce.sezione_id)}>
                  {tr('Scheda')}
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
                aria-label={tr('Prodotto della cassa')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// I PRODOTTI DELLA CASSA RIMASTI FUORI (fuoriDalMenu): quelli nuovi, o tolti
// da ogni sezione. Il prezzo della libertà è che un prodotto nuovo non entra
// da solo; qui si vede, e si aggiunge con un tocco.
function FuoriDalMenu({ prodotti, carta, sezioni, categorieCassa = [] }) {
  if (!prodotti.length) return null
  return (
    <details className="card struttura-fuori" open={prodotti.length <= 8}>
      <summary>
        <strong>{tr('Prodotti della cassa non presenti nel menù dei clienti ({n})', { n: prodotti.length })}</strong>
      </summary>
      <p className="muted small" style={{ margin: '6px 0' }}>
        {tr('Al tavolo non si vedono. Un prodotto aggiunto in cassa dopo la personalizzazione compare qui.')}
      </p>
      {prodotti.map((d) => (
        <div className="struttura-fuori-riga" key={d.id}>
          <span className="grow">
            {d.name}{' '}
            <span className="muted small">
              · {formatPrice(d.price)}
              {d.available ? '' : ` · ${tr('fuori menù')}`}
            </span>
          </span>
          {/* LA SEZIONE DELLA SUA CATEGORIA, se c'è (REQ-MENU-041): un tocco. */}
          {(() => {
            const sua = sezioneDellaCategoria(sezioni, categoriaDellaVoce(null, d, categorieCassa))
            return sua ? (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => creaVoceCarta({ sezione_id: sua.id, drink_id: d.id, ordine: inFondo(carta, sua.id) })}
              >
                {tr('In «{sezione}»', { sezione: nomeSezione(sua) })}
              </button>
            ) : null
          })()}
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
        <label htmlFor="struttura-nuova">{tr('Nuova sezione')}</label>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input
          id="struttura-nuova"
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && aggiungi()}
          placeholder={tr('Signature, Suggeriti dallo staff, Gin…')}
          aria-label={tr('Nome della nuova sezione')}
        />
        <button className="btn small" onClick={aggiungi}>
          {tr('Aggiungi')}
        </button>
      </div>
      <AiutoCampo style={{ margin: '4px 0 0' }}>{tr('Si aggiunge in cima al menù.')}</AiutoCampo>
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
      placeholder={tr('Gruppo')}
      maxLength={40}
      aria-label={tr('Gruppo della sezione {nome}', { nome: nomeSezione(sezione) })}
    />
  )
}

// Una chiave tolta se c'è, messa se non c'è: sezioni aperte e voci scelte.
function alterna(set, id) {
  const nuovo = new Set(set)
  if (nuovo.has(id)) nuovo.delete(id)
  else nuovo.add(id)
  return nuovo
}

// La struttura arriva da MenuManager, che la tiene già per le schede dei
// prodotti: una sottoscrizione sola. `onApriScheda` apre la scheda intera
// di un prodotto e `onNuovoProdotto` quella di un prodotto nuovo per una
// sezione; chiusa la scheda si torna qui, con `riapri` già aperta.
export default function StrutturaMenu({ carta, drinks, categories, inventory = [], categorieMagazzino = [], supplementoPredefinito = 0, onApriScheda, onNuovoProdotto, riapri = null }) {
  // «Raggruppa per categoria» (REQ-MENU-041): prima si dice cosa cambia,
  // poi si fa, in un pacchetto solo.
  const [raggruppa, setRaggruppa] = useState(null)
  function eseguiRaggruppamento() {
    const { nuove, spostamenti } = raggruppa
    const idDi = new Map(nuove.map((n) => [n.chiave, creaSezioneCarta({ nome: n.nome, ordine: n.ordine }).id]))
    if (spostamenti.length) {
      spostaVociCarta(spostamenti.map((x) => ({ id: x.id, sezione_id: idDi.get(x.sezione) ?? x.sezione, ordine: x.ordine })))
    }
    setRaggruppa(null)
  }
  // Le cancellazioni grosse si confermano col dialogo dell'app: il
  // `confirm` del browser, nella PWA installata, può essere bloccato senza
  // dire niente (ConfirmDialog.jsx).
  const [conferma, setConferma] = useState(null)
  // LA VISTA COMPATTA (REQ-MENU-035): le sezioni partono chiuse, una riga
  // ciascuna col numero di voci, come un indice; se ne aprono una o più per
  // lavorarci. Delle voci se ne apre una alla volta, sotto la sua riga.
  const [aperte, setAperte] = useState(() => new Set(riapri ? [riapri] : []))
  const [voceAperta, setVoceAperta] = useState(null)
  const [scelte, setScelte] = useState(() => new Set())
  const [cerca, setCerca] = useState('')

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
  // Gli id scelti che esistono ancora: una voce tolta da un altro terminale
  // non conta nella barra e non si sposta.
  const scelteValide = useMemo(() => (carta.voci || []).filter((v) => scelte.has(v.id)).map((v) => v.id), [carta.voci, scelte])
  // Cercando, ogni sezione mostra solo le voci trovate.
  const trovate = useMemo(() => {
    if (!cerca) return null
    const per = new Map()
    for (const [id, voci] of vociPer) per.set(id, voci.filter((v) => voceTrovata(v, perId.get(v.drink_id), cerca)))
    return per
  }, [cerca, vociPer, perId])

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
      titolo: tr('Ripartire dalle voci della cassa?'),
      messaggio: tr('Tutte le sezioni e le voci si sostituiscono con una copia del menù della cassa. Sezioni, spostamenti e testi ritoccati andranno persi.'),
      etichetta: tr('Riparti'),
      azione: () => prepopolaStruttura(copia, { sostituisci: carta }),
    })
  }

  function eliminaSezione(s) {
    const voci = vociPer.get(s.id) || []
    const nome = nomeSezione(s)
    setConferma({
      titolo: !voci.length
        ? tr('Eliminare la sezione «{nome}»?', { nome })
        : voci.length === 1
          ? tr('Eliminare la sezione «{nome}» e la sua voce?', { nome })
          : tr('Eliminare la sezione «{nome}» e le sue {n} voci?', { nome, n: voci.length }),
      messaggio: tr('I prodotti della cassa restano.'),
      etichetta: tr('Elimina'),
      azione: () =>
        eliminaSezioneCarta(
          s.id,
          voci.map((v) => v.id)
        ),
    })
  }

  function tornaAlleCategorie() {
    setConferma({
      titolo: tr('Tornare al menù per categorie?'),
      messaggio: tr('Si eliminano tutte le sezioni e le voci: il menù dei clienti torna a dividersi per le categorie della cassa.'),
      etichetta: tr('Elimina tutto'),
      azione: () => eliminaStruttura(carta),
    })
  }

  // Le voci scelte vanno tutte in fondo alla sezione indicata, in un
  // pacchetto solo (spostamentoInBlocco); poi la scelta si svuota e la
  // sezione d'arrivo si apre, per vedere dove sono finite.
  function spostaScelte(sezioneId) {
    spostaVociCarta(spostamentoInBlocco(carta, scelteValide, sezioneId))
    setScelte(new Set())
    setAperte((a) => new Set(a).add(sezioneId))
  }

  // «Seleziona tutte» di una sezione prende le voci che si vedono (cercando,
  // solo quelle trovate); se lo sono già tutte, le lascia.
  function scegliTutte(voci, tutteScelte) {
    setScelte((sc) => {
      const nuovo = new Set(sc)
      for (const v of voci) {
        if (tutteScelte) nuovo.delete(v.id)
        else nuovo.add(v.id)
      }
      return nuovo
    })
  }

  return (
    <div className="struttura-menu">
      <div className="card">
        <h3 style={{ marginTop: 0 }}><Icona nome="ordina-dal-menu" gruppo="tasti" /> {tr('Menù dei clienti')}</h3>
        {personalizzata ? (
          <>
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              {tr(
                "Il menù consultato al tavolo, nell'ordine in cui compare. Ogni sezione si apre sulle sue voci; ogni voce si sposta, si riordina o si toglie dalla sua riga, e si apre sui suoi testi. Più voci selezionate si spostano insieme in un'altra sezione. Il personale ordina sempre dal menù della cassa."
              )}
            </p>
            <dl className="struttura-legenda small">
              <dt><Icona nome="unisci" gruppo="tasti" /> {tr('Prodotto della cassa')}</dt>
              <dd>
                {tr(
                  "Ogni voce è collegata a un prodotto della cassa, da cui prende prezzo e disponibilità; l'ordine arriva al banco con quel prodotto, col nome letto dal cliente nella nota. Lo stesso prodotto può stare in più sezioni."
                )}
              </dd>
              <dt>{tr('Sopra ogni campo')}</dt>
              <dd>
                {tr(
                  'Da dove viene il testo: dalla scheda prodotto, valido in tutto il menù, o solo da questa sezione. Svuotando il campo, o con «↺», si torna al testo della scheda.'
                )}
              </dd>
            </dl>
          </>
        ) : (
          // IL NOME DELLA SEZIONE È UN DATO, in italiano: è quello che l'app
          // scriverà davvero e che i clienti leggeranno (NON_CATEGORIZZATI).
          // Sta in un pezzo suo, dichiarato italiano, dentro la frase tradotta.
          <p className="muted small" style={{ margin: '0 0 8px' }}>
            {(() => {
              const [prima, dopo] = tr(
                "Il menù dei clienti è diviso come le categorie della cassa, con tutti i prodotti disponibili. Per personalizzarlo si parte da una copia: una sezione per categoria, con dentro i suoi prodotti già collegati, e una sezione «{nome}» per i prodotti senza categoria. Da lì sezioni e voci si aggiungono, si spostano, si rinominano e si nascondono liberamente. Un prodotto aggiunto in cassa in seguito non entra da solo: compare nell'elenco dei prodotti non presenti, da cui si aggiunge."
              ).split('{nome}')
              return (
                <>
                  {prima}
                  <span lang="it">{NON_CATEGORIZZATI}</span>
                  {dopo}
                </>
              )
            })()}
          </p>
        )}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className={`btn small${personalizzata ? ' secondary' : ''}`} onClick={prepopola}>
            {personalizzata ? tr('Riparti dalle voci della cassa') : tr('Prepopola con le voci della cassa')}
          </button>
          {personalizzata && (
            <button className="btn ghost small" onClick={() => setRaggruppa(raggruppamentoPerCategoria(carta, drinks, categories))}>
              {tr('Raggruppa per categoria')}
            </button>
          )}
          <a className="btn ghost small" href={PERCORSO_ANTEPRIMA} target="_blank" rel="noreferrer">
            <Icona nome="mostra" gruppo="tasti" /> {tr('Anteprima del menù dei clienti')}
          </a>
        </div>
      </div>

      {raggruppa && (
        <ConfirmDialog
          title={tr('Raggruppare per categoria?')}
          message={
            raggruppa.spostamenti.length === 0
              ? tr('Ogni voce è già nella sezione della sua categoria: non c’è niente da spostare.')
              : [
                  raggruppa.nuove.length ? tr('Nuove sezioni: {nomi}.', { nomi: raggruppa.nuove.map((n) => n.nome).join(', ') }) : null,
                  tr('Voci spostate nella sezione della loro categoria: {n}.', { n: raggruppa.spostamenti.length }),
                  tr('Le voci senza categoria restano dove sono; testi e ritocchi non cambiano.'),
                ]
                  .filter(Boolean)
                  .join(' ')
          }
          confirmLabel={tr('Raggruppa')}
          cancelLabel={tr('Annulla')}
          onCancel={() => setRaggruppa(null)}
          onConfirm={raggruppa.spostamenti.length ? eseguiRaggruppamento : () => setRaggruppa(null)}
        />
      )}
      {personalizzata && (
        <>
          <FuoriDalMenu prodotti={fuori} carta={carta} sezioni={sezioni} categorieCassa={categories} />
          <NuovaSezione carta={carta} />
          <datalist id={ELENCO_GRUPPI}>
            {gruppiProposti.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>

          {/* I COMANDI DELLA LISTA, sopra la lista e in una riga sola
              (DESIGN.md): la ricerca, aprire o chiudere tutto, e, quando
              ci sono voci scelte, dove spostarle. Resta in vista mentre si
              scorre: le voci si scelgono in una sezione e si portano in
              un'altra. */}
          <div className="struttura-comandi">
            <input
              type="search"
              className="struttura-cerca"
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder={tr('Cerca una voce')}
              aria-label={tr('Cerca una voce nel menù dei clienti')}
            />
            {!cerca && (
              <>
                <button className="btn ghost small" onClick={() => setAperte(new Set(sezioni.map((s) => s.id)))}>
                  {tr('Apri tutte')}
                </button>
                <button className="btn ghost small" onClick={() => setAperte(new Set())}>
                  {tr('Chiudi tutte')}
                </button>
              </>
            )}
            {scelteValide.length > 0 && (
              <div className="struttura-scelte" role="group" aria-label={tr('Voci selezionate')}>
                <strong className="small">
                  {scelteValide.length === 1 ? tr('1 voce selezionata') : tr('{n} voci selezionate', { n: scelteValide.length })}
                </strong>
                <SceltaSezione
                  sezioni={sezioni}
                  invito={tr('Sposta in…')}
                  onScegli={spostaScelte}
                  aria-label={tr('Sposta le voci selezionate in un’altra sezione')}
                />
                <button className="btn ghost small" onClick={() => setScelte(new Set())}>
                  {tr('Deseleziona tutte')}
                </button>
              </div>
            )}
          </div>

          {sezioni.map((s, idx) => {
            const nome = nomeSezione(s)
            const snella = s.vista === 'snella'
            const tutte = vociPer.get(s.id) || []
            const voci = trovate ? trovate.get(s.id) || [] : tutte
            // Cercando, una sezione senza voci trovate non si mostra, e le
            // altre si aprono da sole.
            if (trovate && !voci.length) return null
            const aperta = Boolean(trovate) || aperte.has(s.id)
            const visibili = tutte.filter((v) => perId.get(v.drink_id)?.available).length
            const tutteScelte = voci.length > 0 && voci.every((v) => scelte.has(v.id))
            const gruppo = nomeGruppo(s)
            return (
              <section className={`struttura-sezione${s.nascosta ? ' nascosta' : ''}`} key={s.id} aria-label={tr('Sezione {nome}', { nome })}>
                <div className="struttura-testa">
                  <button
                    type="button"
                    className="struttura-apri"
                    aria-expanded={aperta}
                    aria-label={aperta ? tr('Chiudi la sezione {nome}', { nome }) : tr('Apri la sezione {nome}', { nome })}
                    onClick={() => setAperte((a) => alterna(a, s.id))}
                    disabled={Boolean(trovate)}
                  >
                    <span aria-hidden="true" className="struttura-freccia">{aperta ? '▾' : '▸'}</span>
                    <strong>{nome}</strong>
                    <span className="muted small">
                      {tutte.length === 1 ? tr('1 voce') : tr('{n} voci', { n: tutte.length })}
                      {s.nascosta ? ` · ${tr('nascosta')}` : ''}
                      {snella ? ` · ${tr('snella')}` : ''}
                      {gruppo ? ` · ${gruppo}` : ''}
                    </span>
                  </button>
                  <button
                    className="btn ghost small"
                    aria-label={tr('Sezione su')}
                    disabled={idx === 0}
                    onClick={() => riordinaSezioniCarta(riordino(sezioni, idx, -1))}
                  >
                    ↑
                  </button>
                  <button
                    className="btn ghost small"
                    aria-label={tr('Sezione giù')}
                    disabled={idx === sezioni.length - 1}
                    onClick={() => riordinaSezioniCarta(riordino(sezioni, idx, 1))}
                  >
                    ↓
                  </button>
                </div>

                {aperta && (
                  <div className="struttura-corpo">
                    <div className="struttura-barra">
                      <select
                        value={s.vista}
                        onChange={(e) => aggiornaSezioneCarta(s.id, { vista: e.target.value })}
                        aria-label={tr('Visualizzazione della sezione')}
                      >
                        {VISTE_SEZIONE.map((v) => (
                          <option key={v.id} value={v.id}>
                            {trSegnato(v.label)}
                          </option>
                        ))}
                      </select>
                      <label className="struttura-spunta small">
                        <input
                          type="checkbox"
                          checked={s.nascosta}
                          onChange={(e) => aggiornaSezioneCarta(s.id, { nascosta: e.target.checked })}
                        />
                        {tr('Nascosta')}
                      </label>
                      <GruppoSezione sezione={s} />
                      <span className="grow" />
                      {voci.length > 0 && (
                        <button className="btn ghost small" onClick={() => scegliTutte(voci, tutteScelte)}>
                          {tutteScelte ? tr('Deseleziona tutte') : tr('Seleziona tutte')}
                        </button>
                      )}
                      <button className="btn ghost small" aria-label={tr('Elimina la sezione {nome}', { nome })} onClick={() => eliminaSezione(s)}>
                        <Icona nome="elimina" gruppo="tasti" />
                      </button>
                    </div>

                    <Testo
                      etichetta={tr('Titolo della sezione')}
                      proprio={s.nome}
                      obbligatorio
                      salva={(valore) => aggiornaSezioneCarta(s.id, { nome: valore })}
                      aria-label={tr('Titolo della sezione')}
                      className="wys-titolo"
                    />
                    <p className="muted small struttura-nota">
                      {s.nascosta
                        ? tr('Nascosta: al tavolo la sezione non compare.')
                        : snella
                          ? visibili === 1
                            ? tr('1 voce visibile al tavolo; snella: nome e prezzo su una riga, senza immagine, descrizione e ingredienti.')
                            : tr('{n} voci visibili al tavolo; snella: nome e prezzo su una riga, senza immagine, descrizione e ingredienti.', { n: visibili })
                          : visibili === 1
                            ? tr('1 voce visibile al tavolo.')
                            : tr('{n} voci visibili al tavolo.', { n: visibili })}
                    </p>

                    {voci.length > 0 && (
                      <div className="inv-list">
                        {voci.map((v, j) => (
                          <RigaVoce
                            key={v.id}
                            voce={v}
                            drink={perId.get(v.drink_id)}
                            snella={snella}
                            gruppi={gruppi}
                            sezioni={sezioni}
                            aperta={voceAperta === v.id}
                            onApri={() => setVoceAperta((a) => (a === v.id ? null : v.id))}
                            scelta={scelte.has(v.id)}
                            onScegli={() => setScelte((sc) => alterna(sc, v.id))}
                            primo={j === 0}
                            ultimo={j === voci.length - 1}
                            sposta={(dir) => riordinaVociCarta(riordino(voci, j, dir))}
                            spostaIn={(sezione_id) => aggiornaVoceCarta(v.id, { sezione_id, ordine: inFondo(carta, sezione_id) })}
                            onApriScheda={onApriScheda}
                            magazzino={{ items: inventory, categorieMagazzino, categorieCassa: categories, supplementoPredefinito }}
                          />
                        ))}
                      </div>
                    )}
                    {/* Una voce nasce già col suo prodotto: senza, al tavolo non
                        compare, e restava lì in attesa senza dirlo. Se il
                        prodotto in cassa non c'è ancora, lo si crea da qui
                        (REQ-MENU-036): l'utente, 10/11/2026, «se non esiste
                        un item cassa, si può creare anche da lì». */}
                    <div className="struttura-aggiungi">
                      <TendinaCassa
                        valore=""
                        gruppi={gruppi}
                        vuota={tr('+ Aggiungi un prodotto della cassa a questa sezione…')}
                        onChange={(drink_id) => creaVoceCarta({ sezione_id: s.id, drink_id, ordine: tutte.length })}
                        aria-label={tr('Aggiungi un prodotto a {nome}', { nome })}
                      />
                      {onNuovoProdotto && (
                        <button
                          className="btn ghost small"
                          aria-label={tr('Nuovo prodotto della cassa in {nome}', { nome })}
                          onClick={() => onNuovoProdotto(s)}
                        >
                          + {tr('Nuovo prodotto della cassa')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
          {trovate && ![...trovate.values()].some((l) => l.length) && (
            <p className="muted small">{tr('Nessuna voce trovata per «{testo}».', { testo: cerca })}</p>
          )}

          <div className="struttura-fine">
            <button className="btn ghost small" onClick={tornaAlleCategorie}>
              {tr('Torna al menù per categorie')}
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
