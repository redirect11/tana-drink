// ── IL CONTRATTO DELLA PORTA DEI DATI (REQ-FLOTTA-021) ────────────────
//
// Le prove di quello che src/porte/dati.js promette, scritte SULLA PORTA e
// non su Firebase: ricevono le funzioni di un adattatore e i suoi database,
// e non sanno cosa c'è dietro. Oggi girano sull'adattatore Firebase con
// l'emulatore (tests/regole/contrattoDati.test.js). Il giorno del secondo
// adattatore, la stessa serie gira anche su quello: se passa, l'app ci
// lavora.
//
// Non è un file *.test.js: lo usa chi lo fa girare.
//
// `prepara()` restituisce:
//   porta            le funzioni dell'adattatore, coi nomi della porta
//   db               un database in cui si legge e si scrive
//   dbSenzaPermessi  lo stesso database, visto da chi può leggere ma non
//                    scrivere: serve a provare la scrittura RIFIUTATA
//   chiudi()         per finire

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Una promessa che si risolve quando la condizione è vera, o fallisce.
function quando(condizione, ms = 5000) {
  return new Promise((ok, ko) => {
    const inizio = Date.now()
    const giro = () => {
      if (condizione()) return ok()
      if (Date.now() - inizio > ms) return ko(new Error('la condizione non è arrivata'))
      setTimeout(giro, 10)
    }
    giro()
  })
}

export function contrattoDati(nome, prepara) {
  describe(`la porta dei dati — ${nome}`, () => {
    let p, db, dbSenzaPermessi, chiudi
    // Ogni prova in una collezione sua: le cache dei client restano fra
    // una prova e l'altra, e così non si incrociano.
    let n = 0
    const nuova = () => `contratto_${Date.now().toString(36)}_${n++}`

    beforeAll(async () => {
      ;({ porta: p, db, dbSenzaPermessi, chiudi } = await prepara())
    })
    afterAll(async () => {
      await chiudi?.()
    })

    describe('un documento', () => {
      it('si scrive e si rilegge: id, ref, exists(), data()', async () => {
        const ref = p.doc(db, nuova(), 'd1')
        await p.setDoc(ref, { nome: 'Spritz', prezzo: 6 })
        const s = await p.getDoc(ref)
        expect(s.exists()).toBe(true)
        expect(s.id).toBe('d1')
        expect(s.ref.id).toBe('d1')
        expect(s.data()).toEqual({ nome: 'Spritz', prezzo: 6 })
      })

      it('quello che non c’è dice di no, senza errori', async () => {
        const s = await p.getDoc(p.doc(db, nuova(), 'manca'))
        expect(s.exists()).toBe(false)
        expect(s.data()).toBeUndefined()
      })

      it('setDoc sostituisce; con merge unisce', async () => {
        const ref = p.doc(db, nuova(), 'd1')
        await p.setDoc(ref, { a: 1, b: 2 })
        await p.setDoc(ref, { a: 3 })
        expect((await p.getDoc(ref)).data()).toEqual({ a: 3 })
        await p.setDoc(ref, { b: 4 }, { merge: true })
        expect((await p.getDoc(ref)).data()).toEqual({ a: 3, b: 4 })
      })

      it('updateDoc unisce, anche un campo dentro un altro', async () => {
        const ref = p.doc(db, nuova(), 'd1')
        await p.setDoc(ref, { a: 1, tempi: { ricevuto: 't0' } })
        await p.updateDoc(ref, { b: 2, 'tempi.pronto': 't1' })
        expect((await p.getDoc(ref)).data()).toEqual({ a: 1, b: 2, tempi: { ricevuto: 't0', pronto: 't1' } })
      })

      it('updateDoc su un documento che non c’è fallisce', async () => {
        await expect(p.updateDoc(p.doc(db, nuova(), 'manca'), { a: 1 })).rejects.toBeTruthy()
      })

      it('addDoc e doc(collezione) scelgono l’id in locale', async () => {
        const col = p.collection(db, nuova())
        const ref = await p.addDoc(col, { a: 1 })
        expect(typeof ref.id).toBe('string')
        expect(ref.id.length).toBeGreaterThan(0)
        expect((await p.getDoc(ref)).data()).toEqual({ a: 1 })
        const a = p.doc(col)
        const b = p.doc(col)
        expect(a.id).not.toBe(b.id)
      })

      it('deleteDoc lo toglie', async () => {
        const ref = p.doc(db, nuova(), 'd1')
        await p.setDoc(ref, { a: 1 })
        await p.deleteDoc(ref)
        expect((await p.getDoc(ref)).exists()).toBe(false)
      })
    })

    describe('i valori speciali', () => {
      it('increment, arrayUnion e deleteField', async () => {
        const ref = p.doc(db, nuova(), 'd1')
        await p.setDoc(ref, { last: 4, tag: ['a'], via: 'x' })
        await p.updateDoc(ref, { last: p.increment(1), tag: p.arrayUnion('a', 'b'), via: p.deleteField() })
        expect((await p.getDoc(ref)).data()).toEqual({ last: 5, tag: ['a', 'b'] })
      })

      it('increment su un campo che non c’è parte da zero', async () => {
        const ref = p.doc(db, nuova(), 'd1')
        await p.setDoc(ref, { last: p.increment(1) }, { merge: true })
        expect((await p.getDoc(ref)).data()).toEqual({ last: 1 })
      })

      it('l’ora del server arriva come data, con toDate() e toMillis()', async () => {
        const ref = p.doc(db, nuova(), 'd1')
        const prima = Date.now()
        await p.setDoc(ref, { il: p.serverTimestamp() })
        const il = (await p.getDoc(ref)).data().il
        expect(il.toDate()).toBeInstanceOf(Date)
        expect(Math.abs(il.toMillis() - prima)).toBeLessThan(60000)
      })

      it('le date scritte con Timestamp si rileggono uguali', async () => {
        const ref = p.doc(db, nuova(), 'd1')
        const d = new Date('2026-10-31T22:15:00Z')
        await p.setDoc(ref, { a: p.Timestamp.fromDate(d), b: p.Timestamp.fromMillis(d.getTime()) })
        const v = (await p.getDoc(ref)).data()
        expect(v.a.toMillis()).toBe(d.getTime())
        expect(v.b.toDate().toISOString()).toBe(d.toISOString())
        expect(Math.abs(p.Timestamp.now().toMillis() - Date.now())).toBeLessThan(60000)
      })
    })

    describe('le ricerche', () => {
      let col
      beforeAll(async () => {
        col = nuova()
        const righe = [
          ['m1', { item: 'gin', qta: 5, motivo: 'carico', tag: ['a'], il: new Date('2026-10-01T10:00:00Z') }],
          ['m2', { item: 'gin', qta: -2, motivo: 'vendita', tag: ['b'], il: new Date('2026-10-02T10:00:00Z') }],
          ['m3', { item: 'rum', qta: 3, motivo: 'carico', tag: ['a', 'b'], il: new Date('2026-10-03T10:00:00Z') }],
          ['m4', { item: 'gin', qta: 1, motivo: 'rettifica', tag: [], il: new Date('2026-10-04T10:00:00Z') }],
        ]
        for (const [id, v] of righe) await p.setDoc(p.doc(db, col, id), { ...v, il: p.Timestamp.fromDate(v.il) })
      })
      const ids = (snap) => snap.docs.map((d) => d.id)

      it('where con ==, in, array-contains, != e i confronti', async () => {
        const c = p.collection(db, col)
        expect(ids(await p.getDocs(p.query(c, p.where('item', '==', 'gin')))).sort()).toEqual(['m1', 'm2', 'm4'])
        expect(ids(await p.getDocs(p.query(c, p.where('motivo', 'in', ['carico', 'rettifica'])))).sort()).toEqual(['m1', 'm3', 'm4'])
        expect(ids(await p.getDocs(p.query(c, p.where('tag', 'array-contains', 'b')))).sort()).toEqual(['m2', 'm3'])
        expect(ids(await p.getDocs(p.query(c, p.where('item', '!=', 'gin'))))).toEqual(['m3'])
        expect(ids(await p.getDocs(p.query(c, p.where('qta', '>', 1)))).sort()).toEqual(['m1', 'm3'])
        expect(ids(await p.getDocs(p.query(c, p.where('qta', '<=', 1)))).sort()).toEqual(['m2', 'm4'])
      })

      it('per data, con Timestamp', async () => {
        const c = p.collection(db, col)
        const dal = p.Timestamp.fromDate(new Date('2026-10-02T00:00:00Z'))
        const al = p.Timestamp.fromDate(new Date('2026-10-04T00:00:00Z'))
        const s = await p.getDocs(p.query(c, p.where('il', '>=', dal), p.where('il', '<', al)))
        expect(ids(s).sort()).toEqual(['m2', 'm3'])
      })

      it('orderBy, limit e startAfter', async () => {
        const c = p.collection(db, col)
        expect(ids(await p.getDocs(p.query(c, p.orderBy('il', 'desc'))))).toEqual(['m4', 'm3', 'm2', 'm1'])
        expect(ids(await p.getDocs(p.query(c, p.orderBy('il', 'asc'), p.limit(2))))).toEqual(['m1', 'm2'])
        const dopo = p.Timestamp.fromDate(new Date('2026-10-02T10:00:00Z'))
        expect(ids(await p.getDocs(p.query(c, p.orderBy('il', 'asc'), p.startAfter(dopo), p.limit(1))))).toEqual(['m3'])
      })

      it('la risposta ha docs, empty, size e forEach', async () => {
        const c = p.collection(db, col)
        const s = await p.getDocs(p.query(c, p.where('item', '==', 'rum')))
        expect(s.empty).toBe(false)
        expect(s.size).toBe(1)
        const visti = []
        s.forEach((d) => visti.push(d.data().item))
        expect(visti).toEqual(['rum'])
        const vuota = await p.getDocs(p.query(c, p.where('item', '==', 'vodka')))
        expect(vuota.empty).toBe(true)
        expect(vuota.size).toBe(0)
        expect(vuota.docs).toEqual([])
      })

      it('quello che il dispositivo ha già letto si rilegge senza il server', async () => {
        const q = p.query(p.collection(db, col), p.where('item', '==', 'gin'))
        await p.getDocs(q)
        expect(ids(await p.getDocsFromCache(q)).sort()).toEqual(['m1', 'm2', 'm4'])
        const ref = p.doc(db, col, 'm1')
        await p.getDoc(ref)
        expect((await p.getDocFromCache(ref)).data().item).toBe('gin')
      })
    })

    describe('gli ascolti', () => {
      it('un documento: la prima risposta subito, poi ogni cambio, fino a smetti()', async () => {
        const ref = p.doc(db, nuova(), 'd1')
        await p.setDoc(ref, { stato: 'ricevuto' })
        const visti = []
        const smetti = p.onSnapshot(ref, (s) => visti.push(s.exists() ? s.data().stato : null))
        await quando(() => visti.includes('ricevuto'))
        await p.updateDoc(ref, { stato: 'pronto' })
        await quando(() => visti.includes('pronto'))
        smetti()
        await p.updateDoc(ref, { stato: 'ritirato' })
        await new Promise((r) => setTimeout(r, 300))
        expect(visti).not.toContain('ritirato')
      })

      it('una ricerca: entra chi comincia a corrispondere, esce chi smette', async () => {
        const col = nuova()
        await p.setDoc(p.doc(db, col, 'o1'), { stato: 'ricevuto' })
        let ultimi = null
        const smetti = p.onSnapshot(p.query(p.collection(db, col), p.where('stato', '==', 'ricevuto')), (s) => {
          ultimi = s.docs.map((d) => d.id).sort()
        })
        await quando(() => ultimi?.join() === 'o1')
        await p.setDoc(p.doc(db, col, 'o2'), { stato: 'ricevuto' })
        await quando(() => ultimi?.join() === 'o1,o2')
        await p.updateDoc(p.doc(db, col, 'o1'), { stato: 'pronto' })
        await quando(() => ultimi?.join() === 'o2')
        smetti()
      })
    })

    describe('il lotto', () => {
      it('set, update e delete insieme', async () => {
        const col = nuova()
        await p.setDoc(p.doc(db, col, 'b'), { v: 1 })
        await p.setDoc(p.doc(db, col, 'c'), { v: 1 })
        const lotto = p.writeBatch(db)
        lotto.set(p.doc(db, col, 'a'), { v: 1 })
        lotto.update(p.doc(db, col, 'b'), { v: 2 })
        lotto.delete(p.doc(db, col, 'c'))
        await lotto.commit()
        expect((await p.getDoc(p.doc(db, col, 'a'))).data()).toEqual({ v: 1 })
        expect((await p.getDoc(p.doc(db, col, 'b'))).data()).toEqual({ v: 2 })
        expect((await p.getDoc(p.doc(db, col, 'c'))).exists()).toBe(false)
      })

      it('tutto o niente: se un pezzo è rifiutato, non passa nemmeno il resto', async () => {
        const col = nuova()
        const lotto = p.writeBatch(db)
        lotto.set(p.doc(db, col, 'a'), { v: 1 })
        lotto.update(p.doc(db, col, 'manca'), { v: 2 })
        await expect(lotto.commit()).rejects.toBeTruthy()
        expect((await p.getDoc(p.doc(db, col, 'a'))).exists()).toBe(false)
      })
    })

    // È la promessa su cui sta il local-first (CLAUDE.md): al banco nessuno
    // aspetta il server, e quello che si è appena fatto si vede subito.
    describe('presa in carico e arrivata', () => {
      it('presa in carico: nell’istante della chiamata la vedono le letture e gli ascolti', async () => {
        const ref = p.doc(db, nuova(), 'd1')
        const visti = []
        const smetti = p.onSnapshot(ref, (s) => visti.push(s.exists() ? s.data() : null))
        await quando(() => visti.length > 0)
        let arrivata = false
        const arrivo = p.setDoc(ref, { totale: 18, il: p.serverTimestamp() }).then(() => (arrivata = true))
        // Prima della conferma del server: la cache la vede già…
        const inCache = await p.getDocFromCache(ref)
        expect(inCache.data().totale).toBe(18)
        // …e l'ora del server, che il server non ha ancora messo, vale null.
        expect(inCache.data().il).toBeNull()
        await quando(() => visti.some((v) => v?.totale === 18))
        const primoConIlTotale = visti.find((v) => v?.totale === 18)
        expect(primoConIlTotale.il).toBeNull()
        // Arrivata: la promessa si risolve, e l'ora del server c'è.
        await arrivo
        expect(arrivata).toBe(true)
        await quando(() => visti.some((v) => v?.il && typeof v.il.toDate === 'function'))
        smetti()
      })

      it('rifiutata: la promessa fallisce, e il dispositivo torna a quello che c’era', async () => {
        const col = nuova()
        const ref = p.doc(dbSenzaPermessi, col, 'd1')
        const visti = []
        const smetti = p.onSnapshot(ref, (s) => visti.push(s.exists() ? s.data().v : 'niente'))
        await quando(() => visti.length > 0)
        // L'esito si raccoglie subito: il rifiuto può arrivare mentre si
        // guarda altro, e una promessa rifiutata senza nessuno che la
        // aspetta è un errore a sé.
        const esito = p.setDoc(ref, { v: 'tentativo' }).then(
          () => 'arrivata',
          () => 'rifiutata'
        )
        // Presa in carico anche questa: la vede chi ascolta…
        await quando(() => visti.includes('tentativo'))
        // …ma il server la rifiuta, e il documento torna a non esserci.
        expect(await esito).toBe('rifiutata')
        await quando(() => visti[visti.length - 1] === 'niente')
        smetti()
        expect((await p.getDoc(p.doc(db, col, 'd1'))).exists()).toBe(false)
      })
    })
  })
}
