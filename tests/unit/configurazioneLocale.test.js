'use strict'

// CHE COSA PUÒ DIRE UNA CONFIGURAZIONE (REQ-FLOTTA-034, REQ-SIC-017).
//
// La configurazione di un locale la scrive la regia al deploy del sito
// uguale per tutti, ed è un file PUBBLICO: la copia ricordata nel
// dispositivo la può cambiare chi ha il dispositivo in mano. La regola su
// cosa ammette è una sola, e la usano l'app (che lascia cadere quello che
// non sa seguire) e personalizza.mjs (che lo rifiuta prima di pubblicare).

import { describe, it, expect } from 'vitest'
import {
  linkSicuro,
  socialSicuri,
  filtraVenue,
  leggiConfigurazione,
  problemiConfigurazione,
  CAMPI_VENUE,
  PROGETTI_REGIA,
} from '../../src/porte/configurazioneLocale.mjs'
import { CHIAVI_VENUE } from '../../src/lib/venue.js'
import { PROGETTI_REGIA as DI_AGGIORNAMENTI } from '../../src/lib/aggiornamenti.js'

const BUONA = {
  backend: 'firebase',
  locale: 'bar-mario',
  firebase: { apiKey: 'k', authDomain: 'mario.firebaseapp.com', projectId: 'mario-drink', appId: '1:2:web:3' },
  venue: { venue_name: 'Bar Mario', venue_email: 'ciao@barmario.it', venue_socials: [{ piattaforma: 'instagram', href: 'https://instagram.com/barmario' }] },
  profilo: 'completo',
  regia: 'drink-regia-test',
}

describe('i link del locale sono solo link (REQ-SIC-017)', () => {
  it('passano http, https, mailto e tel', () => {
    for (const h of ['https://instagram.com/x', 'http://bar.it', 'mailto:ciao@bar.it', 'tel:+39081123', '  https://spazi.it  ']) expect(linkSicuro(h), h).toBe(true)
  })

  it('non passano javascript:, data:, vuoti e indirizzi senza schema, comunque scritti', () => {
    for (const h of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<b>', 'vbscript:x', '', '   ', 'www.bar.it', '/relativo', null, 42])
      expect(linkSicuro(h), String(h)).toBe(false)
  })

  it('i social cattivi si tolgono, quelli buoni restano puliti', () => {
    expect(
      socialSicuri([
        { piattaforma: 'instagram', href: ' https://instagram.com/x ' },
        { piattaforma: 'trappola', href: 'javascript:alert(1)' },
        'non un oggetto',
        { href: 'tel:+39081' },
      ])
    ).toEqual([
      { piattaforma: 'instagram', href: 'https://instagram.com/x' },
      { piattaforma: 'link', href: 'tel:+39081' },
    ])
    expect(socialSicuri('instagram')).toEqual([])
  })
})

describe('il locale nella configurazione', () => {
  it('le chiavi ammesse sono quelle dell’app, né una di più né una di meno', () => {
    expect([...CAMPI_VENUE].sort()).toEqual([...CHIAVI_VENUE].sort())
  })

  it('tiene solo le chiavi note e solo testi', () => {
    expect(filtraVenue({ venue_name: 'Bar', venue_city: 3, segreto: 'x', venue_socials: [{ href: 'javascript:x' }] })).toEqual({ venue_name: 'Bar', venue_socials: [] })
    expect(filtraVenue({ altro: 1 })).toBeNull()
    expect(filtraVenue('Bar')).toBeNull()
  })

  it('i progetti della regia sono scritti in un posto solo', () => {
    expect(DI_AGGIORNAMENTI).toBe(PROGETTI_REGIA)
  })
})

describe('l’app segue quello che sa seguire', () => {
  it('una configurazione buona passa intera', () => {
    const c = leggiConfigurazione(BUONA)
    expect(c).toMatchObject({ backend: 'firebase', locale: 'bar-mario', profilo: 'completo', regia: 'drink-regia-test' })
    expect(c.venue.venue_name).toBe('Bar Mario')
    expect(c.firebase.projectId).toBe('mario-drink')
    expect(c.firebase.vapidKey).toBe('')
  })

  it('un profilo o una regia fuori elenco valgono «quello della build», non un valore qualunque', () => {
    const c = leggiConfigurazione({ ...BUONA, profilo: 'gratis', regia: 'regia-di-qualcun-altro' })
    expect(c.profilo).toBeNull()
    expect(c.regia).toBeNull()
  })

  it('senza backend noto, chiave o progetto non la segue', () => {
    expect(leggiConfigurazione({ ...BUONA, backend: 'pocketbase' })).toBeNull()
    expect(leggiConfigurazione({ ...BUONA, firebase: { projectId: 'x' } })).toBeNull()
    for (const v of [null, [], 'firebase', {}]) expect(leggiConfigurazione(v)).toBeNull()
  })
})

describe('al deploy si rifiuta quello che l’app lascerebbe cadere', () => {
  it('una configurazione buona non ha problemi', () => {
    expect(problemiConfigurazione(BUONA)).toEqual([])
    const { profilo, regia, ...senzaFacoltativi } = BUONA
    expect(profilo && regia).toBeTruthy()
    expect(problemiConfigurazione(senzaFacoltativi)).toEqual([])
  })

  it('dice ogni problema, in parole per chi pubblica', () => {
    const p = problemiConfigurazione({
      backend: 'firebase',
      locale: 'Bar Mario',
      firebase: { apiKey: 'k', projectId: 'p', segreto: 'x' },
      venue: { venue_name: '', venue_theme_color: 'rosso', venue_socials: [{ href: 'javascript:x' }], extra: 1 },
      profilo: 'gratis',
      regia: 'altra',
      ospite: true,
    })
    const tutto = p.join('\n')
    for (const atteso of [
      'campo sconosciuto: ospite',
      'locale: serve lo slug',
      'firebase: campo sconosciuto segreto',
      'firebase.authDomain manca',
      'firebase.appId manca',
      'venue: campo sconosciuto extra',
      'venue.venue_name manca',
      'venue_theme_color deve essere un colore',
      'venue_socials: ogni voce vuole un link',
      'profilo "gratis" non previsto',
      'regia "altra" non prevista',
    ])
      expect(tutto, atteso).toContain(atteso)
  })

  it('senza i dati del locale non si pubblica', () => {
    const { venue, ...senza } = BUONA
    expect(venue).toBeTruthy()
    expect(problemiConfigurazione(senza)).toContain('manca venue{} con i dati del locale')
    expect(problemiConfigurazione('{}')).toEqual(['la configurazione non è un oggetto JSON'])
  })
})
