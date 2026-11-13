// ── LE COMBINAZIONI DEI MODULI, A COPPIE (REQ-DEV-017) ──────────────────
//
// Dieci moduli accesi o spenti fanno 1024 licenze diverse: troppe da
// provare tutte, e quasi tutte inutili. I difetti fra moduli nascono quasi
// sempre fra DUE di loro (l'inventario senza il magazzino, gli ordini dal
// telefono senza il menù digitale), quindi basta un insieme di licenze in
// cui ogni coppia di moduli compaia in tutti e quattro i modi: tutti e due
// accesi, tutti e due spenti, uno sì e l'altro no, e viceversa.
//
// Le righe si scelgono con un algoritmo goloso e deterministico: a ogni
// passo, fra tutte le licenze possibili, quella che copre più coppie non
// ancora viste (a parità, la prima in ordine). Esce sempre lo stesso
// elenco, e con dieci moduli bastano poche righe. Che ogni coppia ci sia lo
// controlla un test (tests/unit/matriceModuli.test.js), non la fiducia
// nell'algoritmo.

// Le quattro combinazioni di una coppia (i, j), come chiave di una mappa.
const chiaveCoppia = (i, j, a, b) => `${i}:${j}:${a ? 1 : 0}${b ? 1 : 0}`

export function coppieDaCoprire(n) {
  const tutte = new Set()
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (const a of [false, true]) for (const b of [false, true]) tutte.add(chiaveCoppia(i, j, a, b))
  return tutte
}

export function coppieDiRiga(riga) {
  const coperte = []
  for (let i = 0; i < riga.length; i++)
    for (let j = i + 1; j < riga.length; j++) coperte.push(chiaveCoppia(i, j, riga[i], riga[j]))
  return coperte
}

// Le righe (array di booleani lunghi n) che coprono tutte le coppie.
export function righeACoppie(n) {
  const scoperte = coppieDaCoprire(n)
  const candidate = Array.from({ length: 2 ** n }, (_, k) =>
    Array.from({ length: n }, (_, i) => Boolean((k >> (n - 1 - i)) & 1)),
  )
  const righe = []
  while (scoperte.size > 0) {
    let migliore = null
    let quante = 0
    for (const riga of candidate) {
      const nuove = coppieDiRiga(riga).filter((c) => scoperte.has(c)).length
      if (nuove > quante) {
        migliore = riga
        quante = nuove
      }
    }
    righe.push(migliore)
    for (const c of coppieDiRiga(migliore)) scoperte.delete(c)
  }
  return righe
}

// Le licenze da provare per un elenco di moduli: nessuno, tutti, ognuno da
// solo, e le righe a coppie. Ogni voce ha un nome leggibile, che finisce
// nel titolo del test: quando una prova diventa rossa si deve capire a
// colpo d'occhio con quale licenza.
export function licenzeDaProvare(ids) {
  const daRiga = (riga) => Object.fromEntries(ids.map((id, i) => [id, riga[i]]))
  const nome = (moduli) => {
    const accesi = ids.filter((id) => moduli[id])
    if (accesi.length === 0) return 'nessun modulo'
    if (accesi.length === ids.length) return 'tutti i moduli'
    return accesi.join(' + ')
  }
  const voci = [
    daRiga(ids.map(() => false)),
    daRiga(ids.map(() => true)),
    ...ids.map((id) => daRiga(ids.map((altro) => altro === id))),
    ...righeACoppie(ids.length).map(daRiga),
  ]
  const viste = new Set()
  return voci
    .map((moduli) => ({ nome: nome(moduli), moduli }))
    .filter(({ nome: n }) => !viste.has(n) && viste.add(n))
}
