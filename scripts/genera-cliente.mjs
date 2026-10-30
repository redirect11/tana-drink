// =====================================================================
//  CREA LA CARTELLA DI UN CLIENTE, clienti/<slug>/, dai dati dell'attivazione.
//
//    node scripts/genera-cliente.mjs --slug bar-mario --nome "Bar Mario"
//
//  La lancia la regia (repository drink-regia), attivando o aggiornando un
//  locale, prima della build `CLIENTE=<slug>` (REQ-VENUE-006): è un
//  contratto con quel repository, argomenti compresi. Scrive venue.json
//  col nome del locale e copia i file neutri
//  di clienti/demo/public/ (se ci sono). Il locale completa il resto da
//  Impostazioni → Il locale, senza rebuild (REQ-VENUE-001). Se la cartella
//  esiste già non la tocca: è il caso di un cliente curato a mano.
// =====================================================================
import { existsSync, mkdirSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { arg } from './lib-firestore.js'

const slug = arg('slug')
const nome = arg('nome', slug)
if (!slug || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(slug)) {
  console.error('Uso: node scripts/genera-cliente.mjs --slug <slug> [--nome "Nome del locale"]')
  process.exit(1)
}
const cartella = join('clienti', slug)
if (existsSync(join(cartella, 'venue.json'))) {
  console.log(`[cliente] ${cartella} esiste già: non tocco niente`)
  process.exit(0)
}
mkdirSync(join(cartella, 'public'), { recursive: true })
writeFileSync(
  join(cartella, 'venue.json'),
  JSON.stringify(
    {
      venue_name: nome,
      venue_short_name: nome.length > 12 ? nome.split(/\s+/)[0] : nome,
      // La preposizione non si indovina dal nome: vuota, l'app dice «da
      // <nome>», e il locale la scrive da Impostazioni → Il locale.
      venue_presso: '',
      venue_tagline: '',
      venue_about: '',
      venue_city: '',
      venue_email: '',
      venue_email_domain: '',
      venue_legal_name: '',
      venue_address: '',
      venue_postal_city: '',
      venue_description: `Ordina da ${nome}`,
      venue_theme_color: '#0e0e15',
      venue_socials: [],
    },
    null,
    2
  ) + '\n'
)
const neutri = join('clienti', 'demo', 'public')
if (existsSync(neutri)) for (const f of readdirSync(neutri)) copyFileSync(join(neutri, f), join(cartella, 'public', f))
console.log(`[cliente] ✓ ${cartella} creato per «${nome}»`)
