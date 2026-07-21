// ABBINAMENTO NOMI PRODOTTO fra gestionale e listino fornitori.
//
// Gli stessi articoli sono scritti in modi diversi nei due mondi: refusi
// ("Ca Veneze" / "Ca Venezze"), parole invertite ("Buckwheat Catskill" /
// "Catskill Buckwheat"), nomi abbreviati ("Chouffe" / "MC Chouffe").
// Servono però anche i FALSI AMICI: "Chianti" e "Chinotto" si somigliano
// come stringhe ma non c'entrano nulla — abbinarli significherebbe dare a
// un vino il costo di una bibita. Per questo `bestMatch` non restituisce
// solo il candidato migliore ma anche QUANTO è sicuro e PERCHÉ, e segnala
// l'ambiguità quando due candidati sono equivalenti.
//
// Logica pura, interamente testabile.

// Nome confrontabile: minuscole, senza accenti né punteggiatura.
export function normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const tokens = (s) => normName(s).split(' ').filter(Boolean)

// Distanza di Levenshtein (numero minimo di modifiche di carattere).
export function levenshtein(a, b) {
  const s = String(a ?? '')
  const t = String(b ?? '')
  if (s === t) return 0
  if (!s.length) return t.length
  if (!t.length) return s.length
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i)
  for (let i = 1; i <= s.length; i++) {
    const cur = [i]
    for (let j = 1; j <= t.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1, // cancellazione
        cur[j - 1] + 1, // inserimento
        prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1) // sostituzione
      )
    }
    prev = cur
  }
  return prev[t.length]
}

// Somiglianza 0..1 fra due nomi normalizzati.
export function similarity(a, b) {
  const s = normName(a)
  const t = normName(b)
  if (!s && !t) return 1
  const max = Math.max(s.length, t.length)
  if (!max) return 0
  return 1 - levenshtein(s, t) / max
}

// Punteggio di un singolo candidato, con la ragione dell'abbinamento.
// Le strategie sono in ordine di affidabilità decrescente.
function scoreOne(name, candidate) {
  const a = normName(name)
  const b = normName(candidate)
  if (!a || !b) return { score: 0, reason: 'vuoto' }
  if (a === b) return { score: 1, reason: 'esatto' }

  const ta = tokens(a)
  const tb = tokens(b)
  const sa = new Set(ta)
  const sb = new Set(tb)

  // Stesse parole in ordine diverso: praticamente certo.
  if (sa.size === sb.size && [...sa].every((t) => sb.has(t))) {
    return { score: 0.99, reason: 'stesse parole' }
  }

  // Un nome contiene tutte le parole dell'altro ("Chouffe" ⊂ "MC Chouffe").
  // Vale solo se le parole in comune sono "sostanziose": una sigla di due
  // lettere in comune non basta a dire che è lo stesso prodotto.
  const [corto, lungo] = ta.length <= tb.length ? [sa, sb] : [sb, sa]
  const contenuto = [...corto].every((t) => lungo.has(t))
  const utili = [...corto].filter((t) => t.length >= 4).length
  if (contenuto && utili >= 1) {
    const extra = lungo.size - corto.size
    // Più parole di troppo → meno certezza (Bulleit vs Bulleit Rye ok,
    // Curado vs Curado Tequila Reposado Anejo molto meno).
    return { score: Math.max(0.8, 0.95 - extra * 0.07), reason: 'contenuto' }
  }

  return { score: similarity(a, b), reason: 'somiglianza' }
}

// I NUMERI nel nome sono quasi sempre il formato o l'invecchiamento
// ("Paulaner 50" vs "Paulaner", "Don Papa 7 anni"): se non coincidono si
// tratta di un altro articolo, con un altro costo. Si tiene il punteggio
// sotto la soglia di sicurezza, così non viene mai abbinato da solo.
const CAP_NUMERI_DIVERSI = 0.85

function numeri(s) {
  return new Set(tokens(s).filter((t) => /[0-9]/.test(t)))
}

function stessiNumeri(a, b) {
  const na = numeri(a)
  const nb = numeri(b)
  if (na.size !== nb.size) return false
  for (const n of na) if (!nb.has(n)) return false
  return true
}

// Miglior candidato per `name` fra `candidates`.
// Ritorna { value, score, reason, ambiguous }: `ambiguous` è vero se un
// altro candidato ha un punteggio praticamente uguale — in quel caso non
// si può decidere da soli.
export function bestMatch(name, candidates) {
  let best = null
  let second = null
  for (const c of candidates || []) {
    let { score, reason } = scoreOne(name, c)
    if (score < 1 && !stessiNumeri(name, c) && score > CAP_NUMERI_DIVERSI) {
      score = CAP_NUMERI_DIVERSI
      reason = 'formato diverso'
    }
    if (!best || score > best.score) {
      second = best
      best = { value: c, score, reason }
    } else if (!second || score > second.score) {
      second = { value: c, score, reason }
    }
  }
  if (!best) return null
  const ambiguous = !!second && best.score - second.score < 0.02 && best.score < 1
  return { ...best, score: Math.round(best.score * 1000) / 1000, ambiguous }
}
