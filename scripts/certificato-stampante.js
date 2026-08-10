// =====================================================================
//  CHE CERTIFICATO HA LA STAMPANTE, e se l'iPad può fidarsene per sempre.
//
//    node scripts/certificato-stampante.js 192.168.1.50
//    node scripts/certificato-stampante.js 192.168.1.50 --salva
//
//  Da lanciare da un computer sulla STESSA RETE della stampante.
//
//  Perché serve. L'avviso che ti costringe ad andare su https://IP:8043 e
//  accettare a mano non si toglie da dentro l'app: nessuna pagina web può
//  dire al browser "fidati". Si toglie dal DISPOSITIVO, installando quel
//  certificato fra quelli attendibili. Ma iOS accetta un certificato solo se
//  l'indirizzo con cui lo chiami è scritto in un campo preciso — il SAN
//  (Subject Alternative Name). Il vecchio campo "Common Name" da solo non
//  basta più dal 2019, ed è per questo che l'eccezione va rifatta di
//  continuo: non è scaduta, è che quel certificato non è valido per quell'IP.
//
//  Questo script legge il certificato senza fidarsene e dice tre cose:
//   1. per quali nomi/indirizzi è valido davvero
//   2. quando scade
//   3. se installandolo sull'iPad il problema sparisce, o se prima va
//      rigenerato dalla pagina della stampante
//
//  Con --salva scrive anche il file .cer da mandare all'iPad.
// =====================================================================
import tls from 'node:tls'
import { writeFileSync } from 'node:fs'

const [ip, ...resto] = process.argv.slice(2)
const SALVA = resto.includes('--salva')
const porta = Number(resto.find((a) => /^\d+$/.test(a))) || 8043

if (!ip) {
  console.error('Uso: node scripts/certificato-stampante.js <IP stampante> [porta] [--salva]')
  process.exit(1)
}

console.log(`[cert] guardo ${ip}:${porta} …\n`)

const socket = tls.connect(
  { host: ip, port: porta, rejectUnauthorized: false, servername: undefined, timeout: 8000 },
  () => {
    const c = socket.getPeerCertificate(true)
    if (!c || !c.subject) {
      console.error('[cert] nessun certificato: la stampante risponde ma non in TLS su questa porta.')
      process.exit(1)
    }

    const nomi = (c.subjectaltname || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const ipNelSan = nomi.some((n) => n === `IP Address:${ip}` || n === `DNS:${ip}`)
    const giorni = Math.round((Date.parse(c.valid_to) - Date.now()) / 86400000)

    console.log(`  intestato a (CN):  ${c.subject?.CN ?? '—'}`)
    console.log(`  emesso da:         ${c.issuer?.CN ?? '—'}`)
    console.log(`  valido fino al:    ${c.valid_to}  (${giorni} giorni)`)
    console.log(`  vale per:          ${nomi.length ? nomi.join(', ') : '— NESSUN SAN —'}`)
    console.log(`  impronta:          ${c.fingerprint256}`)

    console.log('\n  ── Verdetto ──')
    if (giorni <= 0) {
      console.log('  ✖ SCADUTO. Va rigenerato dalla pagina della stampante.')
    } else if (!nomi.length) {
      console.log('  ✖ Non ha il campo SAN: iOS lo rifiuta ANCHE se lo installi come attendibile.')
      console.log('    Va rigenerato dalla pagina della stampante (Security → SSL/TLS),')
      console.log(`    mettendo ${ip} nel Common Name: i firmware recenti lo copiano nel SAN.`)
      console.log('    Poi rilancia questo comando: se qui sotto compare l\'IP, siamo a posto.')
    } else if (!ipNelSan) {
      console.log(`  ✖ Il SAN non contiene ${ip}: il certificato vale per altri nomi.`)
      console.log('    Rigeneralo dalla pagina della stampante usando ESATTAMENTE questo IP.')
    } else if (giorni > 825) {
      console.log('  ⚠ Vale per più di 825 giorni: iOS non accetta durate così lunghe.')
      console.log('    Rigeneralo con una validità di circa un anno.')
    } else {
      console.log('  ✔ VA BENE. Installandolo sull\'iPad come attendibile, gli avvisi')
      console.log('    spariscono per sempre (finché non scade o non cambia l\'IP).')
      console.log('\n    Sull\'iPad: apri il file .cer → Impostazioni → Profilo scaricato →')
      console.log('    Installa; poi Impostazioni → Generali → Info → Attendibilità')
      console.log('    certificati → attiva la spunta su questo certificato.')
    }

    if (SALVA) {
      const pem =
        '-----BEGIN CERTIFICATE-----\n' +
        (c.raw.toString('base64').match(/.{1,64}/g) || []).join('\n') +
        '\n-----END CERTIFICATE-----\n'
      const file = `stampante-${ip.replace(/\./g, '-')}.cer`
      writeFileSync(file, pem)
      console.log(`\n[cert] salvato ${file} — mandalo all'iPad (AirDrop, email o iCloud).`)
    }

    // IP fisso: se cambia, il certificato non combacia più e si ricomincia.
    console.log('\n  Promemoria: sul router prenota questo IP per la stampante.')
    socket.end()
  }
)

socket.on('timeout', () => {
  console.error('[cert] nessuna risposta: stampante spenta, IP sbagliato o rete diversa.')
  socket.destroy()
  process.exit(1)
})
socket.on('error', (e) => {
  console.error(`[cert] non raggiungibile: ${e.message}`)
  process.exit(1)
})
