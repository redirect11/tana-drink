import { useId, useMemo, useState } from 'react'
import {
  creaSezioneCarta,
  aggiornaSezioneCarta,
  eliminaSezioneCarta,
  prepopolaStruttura,
  eliminaStruttura,
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
  prepopolazione,
  fuoriDalMenu,
  strutturaPersonalizzata,
  PERCORSO_ANTEPRIMA,
} from '../lib/strutturaMenu.js'
import { formatPrice } from '../lib/orderStatus.js'
import { immagineVoce, segnapostoDrink } from '../lib/speciali.js'
import { useFondoChiaro } from '../lib/useFondoChiaro.js'

// LA STRUTTURA DEL MENÙ DEI CLIENTI, DAL GESTIONALE (REQ-MENU-025): il
// menù del tavolo com'è, sezione per sezione, coi testi modificabili dove
// stanno. Finché nessuno lo personalizza è quello di sempre, per categorie;
// si parte da una copia delle voci della cassa, e da lì è tutto libero
// (strutturaMenu.js). Flavio, 04/11/2026: «un pannello dove creiamo tutte
// le voci che vanno all'interno del menù vista cliente». Una voce si
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

// La scelta vuota è un invito («+ Aggiungi…», «Scegliere un prodotto»), non
// un valore: una voce senza prodotto non si può fare (REQ-MENU-025).
export function TendinaGestionale({ valore, drinks, categories, onChange, vuota, ...props }) {
  const gruppi = useMemo(() => opzioniGestionale(drinks, categories), [drinks, categories])
  return (
    <select value={valore || ''} onChange={(e) => e.target.value && onChange(e.target.value)} {...props}>
      {(vuota || !valore) && (
        <option value="" disabled={Boolean(valore)}>
          {vuota || '— Scegliere un prodotto della cassa —'}
        </option>
      )}
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

// Su e giù fra le sezioni, o fra le voci di una sezione: si scambia col
// vicino e si rinumera tutta la lista, perché le voci scritte da uno
// script, o aggiunte in fretta, possono avere lo stesso numero d'ordine (e
// le sezioni nuove, messe in cima, un numero negativo), e due numeri
// uguali non si scambiano. Si scrive solo chi cambia davvero.
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
    <div className="carta-agganci" style={{ margin: '6px 0' }}>
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

// «Aggiungi a una sezione…»: la voce nuova va in fondo alla sezione scelta.
function AggiungiA({ drink, carta, sezioni, ...props }) {
  return (
    <select
      value=""
      aria-label={`Aggiungi ${drink.name} a una sezione`}
      onChange={(e) => {
        const sezione_id = e.target.value
        if (!sezione_id) return
        const voci = (carta.voci || []).filter((v) => v.sezione_id === sezione_id)
        creaVoceCarta({ sezione_id, drink_id: drink.id, ordine: voci.length })
      }}
      {...props}
    >
      <option value="">Aggiungi a una sezione…</option>
      {sezioni.map((s) => (
        <option key={s.id} value={s.id}>
          {nomeSezione(s)}
        </option>
      ))}
    </select>
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

// UNA VOCE: i testi sono suoi se li ha, se no quelli della scheda del
// prodotto collegato; il prodotto della cassa dà prezzo, disponibilità e
// quello che arriva al banco. Si sposta in un'altra sezione senza perdere i
// suoi ritocchi.
function Voce({ voce, drink, snella, drinks, categories, sezioni, immagini, primo, ultimo, sposta, spostaIn, onApriScheda }) {
  const cliente = drink ? perIlCliente(drink) : null
  const ritocco = (campo, cosa) =>
    testo(voce[campo]) ? (
      <Ripristina cosa={cosa} verso="come la scheda" onClick={() => aggiornaVoceCarta(voce.id, { [campo]: '' })} />
    ) : null
  const origine = (campo) => (testo(voce[campo]) ? 'solo in questa sezione' : drink ? 'dalla scheda prodotto' : '')
  const altre = sezioni.filter((s) => s.id !== voce.sezione_id)
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
            {altre.length > 0 && (
              <select
                value=""
                aria-label={`Sposta ${nomeVoce(voce, cliente)} in un’altra sezione`}
                onChange={(e) => e.target.value && spostaIn(e.target.value)}
              >
                <option value="">Sposta in…</option>
                {altre.map((s) => (
                  <option key={s.id} value={s.id}>
                    {nomeSezione(s)}
                  </option>
                ))}
              </select>
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
            {d.name} <span className="muted small">· {formatPrice(d.price)}{d.available ? '' : ' · fuori menù'}</span>
          </span>
          <AggiungiA drink={d} carta={carta} sezioni={sezioni} />
        </div>
      ))}
    </details>
  )
}

// La struttura arriva da MenuManager, che la tiene già per le schede dei
// prodotti: una sottoscrizione sola. `onApriScheda` apre la scheda intera
// di un prodotto, e chiusa si torna qui.
export default function StrutturaMenu({ carta, drinks, categories, disegni = false, onApriScheda }) {
  const [nuova, setNuova] = useState('')
  const chiaro = useFondoChiaro()
  const immagini = { chiaro, disegni }

  const perId = useMemo(() => new Map((drinks || []).map((d) => [d.id, d])), [drinks])
  const sezioni = ordina(carta.sezioni)
  const vociDi = (sezioneId) =>
    ordina(
      carta.voci.filter((v) => v.sezione_id === sezioneId),
      (v) => nomeVoce(v, perId.get(v.drink_id) && perIlCliente(perId.get(v.drink_id)))
    )

  // LA COPIA DELLE VOCI DELLA CASSA, sempre a portata. Compariva solo
  // prima della personalizzazione, e su un menù già personalizzato (quello
  // della demo) non si trovava: l'utente, 05/11/2026, «serve un tasto per
  // prepopolare tutto come se fosse il menu cassa e poi da lì modifico».
  // Sopra una struttura che c'è già la sostituisce, e prima lo chiede: i
  // ritocchi fatti se ne vanno con lei.
  function prepopola() {
    if (strutturaPersonalizzata(carta)) {
      if (
        !confirm(
          'Sostituire tutte le sezioni e le voci con una copia del menù della cassa? Sezioni, spostamenti e testi ritoccati andranno persi.'
        )
      )
        return
      eliminaStruttura(carta)
    }
    prepopolaStruttura(prepopolazione(drinks, categories))
  }

  const intestazione = (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>📖 Menù dei clienti</h3>
      {strutturaPersonalizzata(carta) ? (
        <>
          <p className="muted small" style={{ margin: '0 0 8px' }}>
            Il menù consultato al tavolo, nell'ordine in cui compare. Sezioni e voci si aggiungono, si spostano e si
            rinominano liberamente; i testi si modificano direttamente nelle card e la modifica si registra all'uscita dal
            campo. Il personale ordina sempre dal menù della cassa.
          </p>
          <dl className="struttura-legenda small">
            <dt>🔗 Prodotto della cassa</dt>
            <dd>
              Ogni voce è collegata a un prodotto della cassa, da cui prende prezzo e disponibilità; l'ordine arriva al
              banco con quel prodotto, col nome letto dal cliente nella nota. Lo stesso prodotto può stare in più sezioni.
            </dd>
            <dt>Sopra ogni campo</dt>
            <dd>
              Da dove viene il testo: dalla scheda prodotto, valido in tutto il menù, o solo da questa sezione. Svuotando
              il campo, o con «↺», si torna al testo della scheda.
            </dd>
          </dl>
        </>
      ) : (
        <p className="muted small" style={{ margin: '0 0 8px' }}>
          Il menù dei clienti è diviso come le categorie della cassa, con tutti i prodotti disponibili. Per
          personalizzarlo si parte da una copia: una sezione per categoria, con dentro i suoi prodotti già collegati. Da
          lì sezioni e voci si aggiungono, si spostano, si rinominano e si nascondono liberamente. Un prodotto aggiunto in
          cassa in seguito non entra da solo: compare nell'elenco dei prodotti non presenti, da cui si aggiunge.
        </p>
      )}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className={`btn small${strutturaPersonalizzata(carta) ? ' secondary' : ''}`} onClick={prepopola}>
          {strutturaPersonalizzata(carta) ? 'Riparti dalle voci della cassa' : 'Prepopola con le voci della cassa'}
        </button>
        <a className="btn ghost small" href={PERCORSO_ANTEPRIMA} target="_blank" rel="noreferrer">
          👁 Anteprima del menù dei clienti
        </a>
      </div>
    </div>
  )

  if (!strutturaPersonalizzata(carta)) return <div className="struttura-menu">{intestazione}</div>

  // Una sezione nuova va in cima: di solito è la Signature, o quella dei
  // consigli dello staff, e scendere è un tocco su ↓.
  function aggiungiSezione() {
    if (!nuova.trim()) return
    const primo = Math.min(0, ...carta.sezioni.map((s) => Number(s.ordine) || 0))
    creaSezioneCarta({ nome: nuova, ordine: primo - 1 })
    setNuova('')
  }

  function eliminaSezione(s) {
    const voci = vociDi(s.id)
    const conVoci = voci.length ? ` e le sue ${voci.length === 1 ? 'voce' : `${voci.length} voci`}` : ''
    if (!confirm(`Eliminare la sezione «${nomeSezione(s)}»${conVoci}? I prodotti della cassa restano.`)) return
    eliminaSezioneCarta(
      s.id,
      voci.map((v) => v.id)
    )
  }

  function tornaAlleCategorie() {
    if (!confirm('Eliminare tutte le sezioni e le voci? Il menù dei clienti torna a dividersi per le categorie della cassa.')) return
    eliminaStruttura(carta)
  }

  return (
    <div className="struttura-menu">
      {intestazione}

      <FuoriDalMenu prodotti={fuoriDalMenu(carta, drinks)} carta={carta} sezioni={sezioni} />

      <div className="card" style={{ marginTop: 8 }}>
        <div className="wys-etichetta">
          <label htmlFor="struttura-nuova">Nuova sezione</label>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            id="struttura-nuova"
            value={nuova}
            onChange={(e) => setNuova(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && aggiungiSezione()}
            placeholder="Signature, Suggeriti dallo staff, Gin…"
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

      {sezioni.map((s, idx) => {
        const nome = nomeSezione(s)
        const snella = s.vista === 'snella'
        const voci = vociDi(s.id)
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
              <span className="grow" />
              <button
                className="btn ghost small"
                aria-label="Sezione su"
                disabled={idx === 0}
                onClick={() => sposta(sezioni, idx, -1, aggiornaSezioneCarta)}
              >
                ↑
              </button>
              <button
                className="btn ghost small"
                aria-label="Sezione giù"
                disabled={idx === sezioni.length - 1}
                onClick={() => sposta(sezioni, idx, 1, aggiornaSezioneCarta)}
              >
                ↓
              </button>
              <button className="btn ghost small" aria-label={`Elimina la sezione ${nome}`} onClick={() => eliminaSezione(s)}>
                🗑
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
                drinks={drinks}
                categories={categories}
                sezioni={sezioni}
                immagini={immagini}
                primo={j === 0}
                ultimo={j === voci.length - 1}
                sposta={(dir) => sposta(voci, j, dir, aggiornaVoceCarta)}
                spostaIn={(sezione_id) =>
                  aggiornaVoceCarta(v.id, { sezione_id, ordine: carta.voci.filter((x) => x.sezione_id === sezione_id).length })
                }
                onApriScheda={onApriScheda}
              />
            ))}
            {/* Una voce nasce già col suo prodotto: senza, al tavolo non
                compare, e restava lì in attesa senza dirlo. */}
            <TendinaGestionale
              valore=""
              drinks={drinks}
              categories={categories}
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
    </div>
  )
}
