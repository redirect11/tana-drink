'use strict'

// I LINK DEL LOCALE SONO SOLO LINK (REQ-SIC-017, docs/sicurezza-demo.md
// punto 6). I social del locale si disegnano in `<a href>` nel piede del
// menù di ogni cliente, e `settings/bar` lo scrive anche il bartender: un
// `javascript:` scritto in Impostazioni diventava codice eseguito sul
// telefono di chi apriva il menù. Il filtro sta in due posti, apposta:
// quando si salva, e quando si disegna, per quello salvato prima.

import { describe, it, expect } from 'vitest'
import { socialDaTesto } from '../../src/lib/venue.js'
import { socialDelLocale } from '../../src/lib/social.js'

describe('quando si salvano, da Impostazioni', () => {
  it('un javascript: non si salva, comunque sia scritto', () => {
    expect(socialDaTesto('instagram javascript:alert(1)\nlink JavaScript:alert(document.cookie)\nfacebook https://facebook.com/bar')).toEqual([
      { piattaforma: 'facebook', href: 'https://facebook.com/bar' },
    ])
  })

  it('un indirizzo scritto senza https diventa https, invece di un link rotto', () => {
    expect(socialDaTesto('instagram www.instagram.com/bar\nbar.example\nsito barmario.it:8080/menu')).toEqual([
      { piattaforma: 'instagram', href: 'https://www.instagram.com/bar' },
      { piattaforma: 'link', href: 'https://bar.example' },
      { piattaforma: 'sito', href: 'https://barmario.it:8080/menu' },
    ])
  })

  it('email e telefono restano quello che sono', () => {
    expect(socialDaTesto('email mailto:ciao@bar.it\ntelefono tel:+39081123')).toEqual([
      { piattaforma: 'email', href: 'mailto:ciao@bar.it' },
      { piattaforma: 'telefono', href: 'tel:+39081123' },
    ])
  })
})

describe('quando si disegnano, nel piede del menù', () => {
  it('un link cattivo salvato prima del filtro non diventa un link', () => {
    const venue = {
      venue_socials: [
        { piattaforma: 'instagram', href: 'https://instagram.com/bar' },
        { piattaforma: 'trappola', href: 'javascript:alert(1)' },
        { piattaforma: 'dati', href: 'data:text/html,<script>alert(1)</script>' },
      ],
    }
    expect(socialDelLocale(venue).map((s) => s.href)).toEqual(['https://instagram.com/bar'])
  })
})
