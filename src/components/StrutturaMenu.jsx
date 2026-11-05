import { useId, useMemo, useState } from 'react'
import {
  creaSezioneCarta,
  aggiornaSezioneCarta,
  eliminaSezioneCarta,
  scriviStruttura,
  creaVoceCarta,
  aggiornaVoceCarta,
  eliminaVoceCarta,
} from '../lib/api.js'
import {
  VISTE_SEZIONE,
  ordina,
  nomeVoce,
  nomeSezione,
  perIlCliente,
  righeStruttura,
  PERCORSO_ANTEPRIMA,
} from '../lib/strutturaMenu.js'
import { formatPrice } from '../lib/orderStatus.js'
import { ingredientiInCarta } from '../lib/ingredientiCarta.js'
import { immagineVoce, segnapostoDrink } from '../lib/speciali.js'
import { useFondoChiaro } from '../lib/useFondoChiaro.js'

// LA STRUTTURA DEL MENÙ DEI CLIENTI, DAL GESTIONALE (REQ-MENU-025): il
// menù del tavolo com'è, sezione per sezione, coi testi modificabili dove
// stanno. Una sezione segue una categoria del gestionale o ha le voci
// scelte a mano; di suo c'è una sezione per categoria, e il menù è quello di
// sempre. Flavio, 04/11/2026: «un pannello dove creiamo tutte le voci che
// vanno all'interno del menù vista cliente». Una voce scelta a mano si
// aggiunge qui o dalla scheda del prodotto (MenuManager, InStruttura): è lo
// stesso dato visto dai due lati.
//
// LA PRIMA VERSIONE ERA UN MODULO: una fila di caselle per voce, il nome
// della sezione vuoto con quello della scheda in grigio come segnaposto,
// la tendina del prodotto senza una parola. L'utente, 05/11/2026: «non mi è
// chiaro come funziona … come associamo le voci di menu agli item di menu
// della cassa? La casella con il nome in grigio cos'è? … possiamo renderlo
// simile a un WYSIWYG». Ora le card hanno la forma di quelle del menù, ogni
// campo mostra il testo che legge il cliente e sopra dice da dove viene, e
// il prodotto della cassa ha la sua riga col 🔗.
//
// Le scritture partono in sottofondo (api.js) e la sottoscrizione le
// mostra subito: niente «Salva», un campo si registra uscendone.

const testo = (v) => (typeof v === 'string' ? v.trim() : '')

// UN TESTO DEL MENÙ, MODIFICABILE DOV'È. Mostra quello che legge il
// cliente: il testo `proprio`, se c'è, se no quello che eredita (`base`, dalla
// scheda prodotto o dalla categoria). Lasciato uguale a quello ereditato, o
// svuotato, non scrive un doppione: torna a ereditare, così una correzione
// fatta alla fonte arriva anche qui. L'etichetta sopra dice da dove viene
// il testo, che era proprio la cosa che non si capiva.
//
// Rinasce (key) quando il testo cambia da fuori — un altro terminale, o il
// proprio salvataggio tornato dalla cache —, così non resta a mostrare
// quello di prima.
function Testo({ etichetta, origine, ripristina, proprio, base = '', salva, area = false, obbligatorio = false, ritoccato = false, className = '', ...props }) {
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
        {origine && <span className={`wys-origine${ritoccato ? ' proprio' : ''}`}>{origine}</span>}
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

// Il tasto che toglie un ritocco e torna al testo ereditato.
function Ripristina({ cosa, verso, onClick }) {
  return (
    <button type="button" className="btn ghost small wys-ripristina" aria-label={`Riporta ${cosa} ${verso}`} onClick={onClick}>
      ↺ {verso}
    </button>
  )
}

// I prodotti del gestionale per la tendina di una voce, divisi per la loro
// categoria: sono centinaia, e chi cerca «Gin Mare» lo cerca fra i gin.
function opzioniGestionale(drinks, categories) {
  const nomeCat = new Map((categories || []).map((c) => [c.id, c]))
  const gruppi = new Map()
  for (const d of drinks || []) {
    const cat = nomeCat.get(d.category_id)
    const nome = cat?.name || d.category || 'Senza categoria'
    if (!gruppi.has(nome)) gruppi.set(nome, { nome, ordine: cat?.sort_order ?? 9999, voci: [] })
    gruppi.get(nome).voci.push(d)
  }
  return [...gruppi.values()]
    .sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome))
    .map((g) => ({ ...g, voci: g.voci.sort((a, b) => (a.name || '').localeCompare(b.name || '')) }))
}

export function TendinaGestionale({ valore, drinks, categories, onChange, vuota = '— Nessun prodotto —', ...props }) {
  const gruppi = useMemo(() => opzioniGestionale(drinks, categories), [drinks, categories])
  return (
    <select value={valore || ''} onChange={(e) => onChange(e.target.value || null)} {...props}>
      <option value="">{vuota}</option>
      {gruppi.map((g) => (
        <optgroup key={g.nome} label={g.nome}>
          {g.voci.map((d) => (
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

// Su e giù fra le voci di una sezione: si scambia col vicino e si rinumera
// tutta la lista, perché le voci scritte da uno script, o aggiunte in
// fretta, possono avere lo stesso numero d'ordine, e due numeri uguali non
// si scambiano. Si scrive solo chi cambia davvero.
function sposta(lista, idx, dir, aggiorna) {
  const j = idx + dir
  if (j < 0 || j >= lista.length) return
  const nuova = [...lista]
  ;[nuova[idx], nuova[j]] = [nuova[j], nuova[idx]]
  nuova.forEach((x, k) => {
    if (Number(x.ordine) !== k) aggiorna(x.id, { ordine: k })
  })
}

// IL MENÙ DEI CLIENTI VISTO DALLA SCHEDA DEL PRODOTTO. Flavio, 04/11/2026:
// «quando nel menù del gestionale fai attiva sul menù, dovrebbe apparire
// una tendina con tutti gli item dove uno seleziona quello a cui si deve
// agganciare». Qui si vede in quale sezione compare il prodotto per la sua
// categoria, e in quali sezioni scelte a mano; lo si aggiunge a un'altra,
// o lo si toglie.
export function InStruttura({ drink, carta, categories }) {
  const righe = righeStruttura(carta?.sezioni, categories)
  const aMano = righe.filter((r) => r.id && !r.categoria_id)
  if (!aMano.length) return null
  const perCategoria = righe.find((r) => r.categoria_id && r.categoria_id === drink.category_id)
  const nomeDi = new Map(aMano.map((r) => [r.id, nomeSezione(r, categories)]))
  const mie = (carta?.voci || []).filter((v) => v.drink_id === drink.id && nomeDi.has(v.sezione_id))
  return (
    <div className="carta-agganci" style={{ margin: '6px 0' }}>
      <span className="muted small">Menù dei clienti:</span>{' '}
      {perCategoria && (
        <span className="muted small">
          {nomeSezione(perCategoria, categories)}
          {perCategoria.nascosta ? ' (nascosta)' : ''}
          {mie.length ? ' · ' : ''}
        </span>
      )}
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
      <select
        value=""
        aria-label={`Aggiungi ${drink.name} a una sezione`}
        onChange={(e) => {
          const sezione_id = e.target.value
          if (!sezione_id) return
          const voci = (carta?.voci || []).filter((v) => v.sezione_id === sezione_id)
          creaVoceCarta({ sezione_id, drink_id: drink.id, ordine: voci.length })
        }}
        style={{ marginTop: 4 }}
      >
        <option value="">Aggiungi a una sezione…</option>
        {aMano.map((r) => (
          <option key={r.id} value={r.id}>
            {nomeDi.get(r.id)}
          </option>
        ))}
      </select>
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
    <div className={`card menu-item struttura-voce${attenuata ? ' attenuata' : ''}${snella ? ' snella' : ''}`}>
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

// UNA VOCE SCELTA A MANO: i testi sono suoi se li ha, se no quelli della
// scheda del prodotto collegato; il prodotto della cassa dà prezzo,
// disponibilità e quello che arriva al banco.
function VoceAMano({ voce, drink, snella, drinks, categories, immagini, primo, ultimo, sposta }) {
  const cliente = drink ? perIlCliente(drink) : null
  const ritocco = (campo, cosa) =>
    testo(voce[campo]) ? (
      <Ripristina cosa={cosa} verso="come la scheda" onClick={() => aggiornaVoceCarta(voce.id, { [campo]: '' })} />
    ) : null
  const origine = (campo) => (testo(voce[campo]) ? 'solo in questa sezione' : drink ? 'dalla scheda prodotto' : '')
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
            ? 'Prodotto fuori menù: la voce non compare al tavolo.'
            : null
      }
      piede={
        <>
          <div className="struttura-collegamento">
            <span className="wys-etichetta" aria-hidden="true">
              🔗 Prodotto della cassa
            </span>
            <TendinaGestionale
              valore={voce.drink_id}
              drinks={drinks}
              categories={categories}
              onChange={(id) => aggiornaVoceCarta(voce.id, { drink_id: id })}
              aria-label="Prodotto della cassa"
            />
          </div>
          <div className="struttura-tasti">
            <button className="btn ghost small" aria-label="Voce su" disabled={primo} onClick={() => sposta(-1)}>
              ↑
            </button>
            <button className="btn ghost small" aria-label="Voce giù" disabled={ultimo} onClick={() => sposta(1)}>
              ↓
            </button>
            <button
              className="btn ghost small"
              aria-label={`Togli ${nomeVoce(voce, cliente)} dalla sezione`}
              onClick={() => eliminaVoceCarta(voce.id)}
            >
              🗑
            </button>
          </div>
        </>
      }
    >
      <Testo
        etichetta="Nome"
        origine={origine('nome')}
        ritoccato={Boolean(testo(voce.nome))}
        ripristina={ritocco('nome', 'il nome')}
        proprio={voce.nome}
        base={cliente?.name}
        salva={(nome) => aggiornaVoceCarta(voce.id, { nome })}
        placeholder="Nome letto dal cliente"
        aria-label="Nome nella sezione"
        className="wys-nome"
      />
      {!snella && (
        <>
          <Testo
            area
            etichetta="Descrizione"
            origine={origine('descrizione')}
            ritoccato={Boolean(testo(voce.descrizione))}
            ripristina={ritocco('descrizione', 'la descrizione')}
            proprio={voce.descrizione}
            base={drink?.description}
            salva={(descrizione) => aggiornaVoceCarta(voce.id, { descrizione })}
            placeholder="Provenienza, carattere, servizio"
            aria-label="Descrizione nella sezione"
          />
          {/* Dalla ricetta mai (ingredientiCarta.js): solo il ritocco o
              quelli scritti sulla scheda. */}
          <Testo
            etichetta="Ingredienti"
            origine={origine('ingredienti')}
            ritoccato={Boolean(testo(voce.ingredienti))}
            ripristina={ritocco('ingredienti', 'gli ingredienti')}
            proprio={voce.ingredienti}
            base={drink?.ingredienti}
            salva={(ingredienti) => aggiornaVoceCarta(voce.id, { ingredienti })}
            placeholder="Separati da virgola"
            aria-label="Ingredienti nella sezione"
          />
        </>
      )}
    </Card>
  )
}

// UN PRODOTTO DI UNA SEZIONE CHE SEGUE UNA CATEGORIA: i testi sono quelli
// della scheda e si scrivono lì (`onModifica`), perché valgono ovunque il
// cliente legga quel prodotto. Il nome per il cliente, se manca, è quello
// della cassa; gli ingredienti, se mancano, quelli della ricetta.
function ProdottoDiCategoria({ drink, snella, immagini, onModifica, onApriScheda }) {
  const ricetta = (ingredientiInCarta({ ...drink, ingredienti: null }) || []).join(', ')
  const scheda = 'scheda prodotto · vale ovunque'
  return (
    <Card
      drink={drink}
      snella={snella}
      immagini={immagini}
      piede={
        <>
          <div className="struttura-collegamento">
            <span className="wys-etichetta">🔗 Prodotto della cassa</span>
            <span className="small">{drink.name}</span>
          </div>
          <div className="struttura-tasti">
            <button className="btn ghost small" aria-label={`Apri la scheda di ${drink.name}`} onClick={() => onApriScheda(drink)}>
              Scheda prodotto
            </button>
          </div>
        </>
      }
    >
      <Testo
        etichetta="Nome"
        origine={testo(drink.nome_cliente) ? scheda : 'nome della cassa'}
        ripristina={
          testo(drink.nome_cliente) ? (
            <Ripristina cosa="il nome" verso="come la cassa" onClick={() => onModifica(drink.id, { nome_cliente: null })} />
          ) : null
        }
        proprio={drink.nome_cliente}
        base={drink.name}
        salva={(v) => onModifica(drink.id, { nome_cliente: v || null })}
        aria-label={`Nome per il cliente di ${drink.name}`}
        className="wys-nome"
      />
      {!snella && (
        <>
          <Testo
            area
            etichetta="Descrizione"
            origine={testo(drink.description) ? scheda : ''}
            proprio={drink.description}
            salva={(v) => onModifica(drink.id, { description: v || null })}
            placeholder="Nessuna descrizione: provenienza, carattere, servizio"
            aria-label={`Descrizione di ${drink.name}`}
          />
          <Testo
            etichetta="Ingredienti"
            origine={testo(drink.ingredienti) ? scheda : ricetta ? 'dalla ricetta' : ''}
            proprio={drink.ingredienti}
            base={ricetta}
            salva={(v) => onModifica(drink.id, { ingredienti: v || null })}
            placeholder="Separati da virgola"
            aria-label={`Ingredienti di ${drink.name}`}
          />
        </>
      )}
    </Card>
  )
}

// La struttura arriva da MenuManager, che la tiene già per le schede dei
// prodotti: una sottoscrizione sola. Anche i prodotti, coi loro testi:
// `onModificaProdotto` li ritocca, `onApriScheda` apre la scheda intera.
export default function StrutturaMenu({ carta, drinks, categories, disegni = false, onModificaProdotto, onApriScheda }) {
  const [nuova, setNuova] = useState('')
  const chiaro = useFondoChiaro()
  const immagini = { chiaro, disegni }

  const perId = useMemo(() => new Map((drinks || []).map((d) => [d.id, d])), [drinks])
  const righe = righeStruttura(carta.sezioni, categories)
  const catPerId = new Map((categories || []).map((c) => [c.id, c]))
  const vociDi = (sezioneId) =>
    ordina(
      carta.voci.filter((v) => v.sezione_id === sezioneId),
      (v) => nomeVoce(v, perId.get(v.drink_id) && perIlCliente(perId.get(v.drink_id)))
    )
  const prodottiDi = (categoriaId) => (drinks || []).filter((d) => d.category_id === categoriaId)

  // Una sezione nuova va in cima: di solito è la Signature, o quella dei
  // consigli dello staff, e scendere è un tocco su ↓.
  function aggiungiSezione() {
    if (!nuova.trim()) return
    const primo = Math.min(0, ...carta.sezioni.map((s) => Number(s.ordine) || 0))
    creaSezioneCarta({ nome: nuova, ordine: primo - 1 })
    setNuova('')
  }

  // Una riga ancora non scritta (una categoria che nessuna sezione segue)
  // si scrive insieme a tutte quelle che le stanno intorno: vedi
  // scriviStruttura.
  function modifica(idx, patch) {
    const r = righe[idx]
    if (r.id) aggiornaSezioneCarta(r.id, patch)
    else scriviStruttura(righe.map((x, k) => (k === idx ? { ...x, ...patch } : x)))
  }

  function spostaRiga(idx, dir) {
    const j = idx + dir
    if (j < 0 || j >= righe.length) return
    const nuove = [...righe]
    ;[nuove[idx], nuove[j]] = [nuove[j], nuove[idx]]
    scriviStruttura(nuove)
  }

  function eliminaSezione(r) {
    const voci = vociDi(r.id)
    const nome = nomeSezione(r, categories)
    const conVoci = voci.length ? ` e le sue ${voci.length === 1 ? 'voce' : `${voci.length} voci`}` : ''
    if (!confirm(`Eliminare la sezione «${nome}»${conVoci}? I prodotti della cassa restano.`)) return
    eliminaSezioneCarta(
      r.id,
      voci.map((v) => v.id)
    )
  }

  return (
    <div className="struttura-menu">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>📖 Menù dei clienti</h3>
        <p className="muted small" style={{ margin: '0 0 8px' }}>
          Il menù consultato al tavolo, nell'ordine in cui compare. I testi si modificano direttamente nelle card; la
          modifica si registra all'uscita dal campo. Il personale ordina sempre dal menù della cassa.
        </p>
        <dl className="struttura-legenda small">
          <dt>Sezione che segue una categoria</dt>
          <dd>
            Mostra i prodotti disponibili della categoria, compresi quelli aggiunti in seguito. I testi sono quelli della
            scheda prodotto e valgono in tutto il menù.
          </dd>
          <dt>Sezione con voci scelte a mano</dt>
          <dd>
            Ogni voce è collegata a un prodotto della cassa (🔗), da cui prende prezzo e disponibilità; l'ordine arriva al
            banco con quel prodotto, col nome letto dal cliente nella nota. Nome, descrizione e ingredienti si possono
            ritoccare per la sola sezione; svuotando il campo si torna al testo della scheda.
          </dd>
          <dt>Sopra ogni campo</dt>
          <dd>Da dove viene il testo: dalla scheda prodotto, dalla cassa, dalla ricetta, o solo da questa sezione.</dd>
        </dl>
        <a className="btn ghost small" href={PERCORSO_ANTEPRIMA} target="_blank" rel="noreferrer">
          👁 Anteprima del menù dei clienti
        </a>
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <div className="wys-etichetta">
          <label htmlFor="struttura-nuova">Nuova sezione con voci scelte a mano</label>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            id="struttura-nuova"
            value={nuova}
            onChange={(e) => setNuova(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && aggiungiSezione()}
            placeholder="Signature, Suggeriti dallo staff…"
            aria-label="Nome della nuova sezione"
          />
          <button className="btn small" onClick={aggiungiSezione}>
            Aggiungi
          </button>
        </div>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          Si aggiunge in cima al menù.
        </p>
      </div>

      {righe.map((r, idx) => {
        const nome = nomeSezione(r, categories)
        const snella = r.vista === 'snella'
        const segue = Boolean(r.categoria_id)
        const categoria = segue ? catPerId.get(r.categoria_id) : null
        const voci = segue ? [] : vociDi(r.id)
        const prodotti = segue ? prodottiDi(r.categoria_id) : []
        const visibili = prodotti.filter((d) => d.available)
        const fuori = prodotti.length - visibili.length
        return (
          <section
            className={`struttura-sezione${r.nascosta ? ' nascosta' : ''}`}
            key={r.chiave}
            aria-label={`Sezione ${nome}`}
          >
            <div className="struttura-barra">
              <span className="chip">{segue ? `Segue la categoria «${categoria?.name || '—'}»` : 'Voci scelte a mano'}</span>
              <select
                value={r.vista}
                onChange={(e) => modifica(idx, { vista: e.target.value })}
                aria-label="Visualizzazione della sezione"
              >
                {VISTE_SEZIONE.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <label className="struttura-spunta small">
                <input type="checkbox" checked={r.nascosta} onChange={(e) => modifica(idx, { nascosta: e.target.checked })} />
                Nascosta
              </label>
              <span className="grow" />
              <button className="btn ghost small" aria-label="Sezione su" disabled={idx === 0} onClick={() => spostaRiga(idx, -1)}>
                ↑
              </button>
              <button
                className="btn ghost small"
                aria-label="Sezione giù"
                disabled={idx === righe.length - 1}
                onClick={() => spostaRiga(idx, 1)}
              >
                ↓
              </button>
              {/* Una sezione che segue una categoria non si elimina: la
                  categoria tornerebbe in fondo da sola. Si nasconde. */}
              {(!segue || !categoria) && (
                <button className="btn ghost small" aria-label={`Elimina la sezione ${nome}`} onClick={() => eliminaSezione(r)}>
                  🗑
                </button>
              )}
            </div>

            <Testo
              etichetta="Titolo della sezione"
              origine={segue ? (testo(r.nome) ? 'rinominata' : 'nome della categoria') : ''}
              ritoccato={segue && Boolean(testo(r.nome))}
              ripristina={
                segue && testo(r.nome) ? (
                  <Ripristina cosa="il titolo" verso="come la categoria" onClick={() => modifica(idx, { nome: '' })} />
                ) : null
              }
              proprio={r.nome}
              base={categoria?.name}
              obbligatorio={!segue}
              salva={(valore) => modifica(idx, { nome: valore })}
              aria-label="Titolo della sezione"
              className="wys-titolo"
            />
            <p className="muted small struttura-nota">
              {r.nascosta
                ? 'Nascosta: al tavolo la sezione non compare.'
                : snella
                  ? 'Snella: al tavolo nome e prezzo su una riga, senza immagine, descrizione e ingredienti.'
                  : segue
                    ? `${visibili.length} prodotti disponibili${fuori ? `; ${fuori} fuori menù non compaiono` : ''}.`
                    : null}
            </p>

            {segue &&
              visibili.map((d) => (
                <ProdottoDiCategoria
                  key={d.id}
                  drink={d}
                  snella={snella}
                  immagini={immagini}
                  onModifica={onModificaProdotto}
                  onApriScheda={onApriScheda}
                />
              ))}
            {segue && categoria && !visibili.length && (
              <p className="muted small">Nessun prodotto disponibile in questa categoria: al tavolo la sezione non compare.</p>
            )}
            {segue && !categoria && <p className="muted small">La categoria seguita non esiste più: la sezione è vuota.</p>}

            {voci.map((v, j) => (
              <VoceAMano
                key={v.id}
                voce={v}
                drink={perId.get(v.drink_id)}
                snella={snella}
                drinks={drinks}
                categories={categories}
                immagini={immagini}
                primo={j === 0}
                ultimo={j === voci.length - 1}
                sposta={(dir) => sposta(voci, j, dir, aggiornaVoceCarta)}
              />
            ))}
            {/* Una voce nasce già col suo prodotto: una voce senza prodotto
                al tavolo non compare, e restava lì in attesa senza dirlo. */}
            {!segue && (
              <TendinaGestionale
                valore=""
                drinks={drinks}
                categories={categories}
                vuota="+ Aggiungi un prodotto della cassa a questa sezione…"
                onChange={(drink_id) => drink_id && creaVoceCarta({ sezione_id: r.id, drink_id, ordine: voci.length })}
                aria-label={`Aggiungi un prodotto a ${nome}`}
                className="struttura-aggiungi"
              />
            )}
          </section>
        )
      })}
    </div>
  )
}
