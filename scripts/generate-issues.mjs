#!/usr/bin/env node
/**
 * scripts/generate-issues.mjs
 *
 * Legge `requirements/requirements.yaml` e `requirements/bugs.yaml` e crea
 * issue GitHub per tutte le voci con `generate_issue: true`.
 *
 * Utilizzo:
 *   # Dry run (mostra le issue che verrebbero create, senza crearle)
 *   node scripts/generate-issues.mjs --dry-run
 *
 *   # Crea le issue su GitHub (richiede GITHUB_TOKEN e GITHUB_REPO)
 *   GITHUB_TOKEN=<token> GITHUB_REPO=owner/repo node scripts/generate-issues.mjs
 *
 * Variabili d'ambiente:
 *   GITHUB_TOKEN   Token GitHub con permesso issues:write (obbligatorio per creare issue)
 *   GITHUB_REPO    Repository nel formato "owner/repo" (default: redirect11/tana-drink)
 *   DRY_RUN        Se impostato a "true", non crea issue ma mostra il payload (default: false)
 *
 * Il workflow `.github/workflows/generate-issues.yml` esegue questo script
 * automaticamente quando viene effettuato un push su uno dei due file.
 *
 * Chiusura:
 *   Una voce con `status: fixed` (o `implemented`/`done`) non genera un'issue nuova:
 *   se ne esiste una aperta con quel titolo, lo script la commenta e la chiude. Il
 *   registro (`bugs.yaml`) resta l'unica cosa da aggiornare a mano.
 *
 * Idempotenza:
 *   Il titolo dell'issue viene prefissato con "[ID]", es. "[REQ-SUMUP-SYNC-001] Titolo"
 *   o "[BUG-001] Titolo".
 *   Prima di creare un'issue, lo script verifica se ne esiste già una con lo stesso
 *   titolo (aperta o chiusa). Se esiste, la salta.
 */

import { readFileSync } from 'node:fs'
import { parseRequirementsYaml, etichetteClassificazione, riconciliaEtichette, corpoGenerato, IN_TEST } from './lib-requisiti.mjs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Config ───────────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const GITHUB_REPO = process.env.GITHUB_REPO || 'redirect11/tana-drink'
const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run')

// APRIRE le issue si può da qualunque ramo; CHIUDERLE no. Una voce del
// registro passa a `fixed` sul ramo di hotfix appena la correzione è scritta,
// ma in produzione non c'è ancora niente: chiudendo lì, chi ha segnalato il
// guaio vede l'issue chiusa e l'app che sbaglia ancora. È successo il 17
// agosto 2026, con tre issue chiuse mentre l'hotfix era ancora da provare.
//
// Perciò si chiude SOLO se lo si chiede: in CI lo fa il workflow quando gira
// su `main` (la linea della produzione), a mano si scrive
// `CHIUDE_RISOLTI=true node scripts/generate-issues.mjs`.
const CHIUDE_RISOLTI = process.env.CHIUDE_RISOLTI === 'true'

// TRE LINEE, TRE COSE DIVERSE sulla stessa voce: su release/** si scrive e si
// riallinea, su develop si mette IN PROVA (e' finita, ma al banco non l'ha
// ancora vista nessuno), su main si chiude. Prima il pezzo di mezzo non
// esisteva: una correzione scritta e non ancora provata era indistinguibile
// da una ancora da fare.
const SEGNA_IN_TEST = process.env.SEGNA_IN_TEST === 'true'

const [OWNER, REPO] = GITHUB_REPO.split('/')
const GITHUB_API = 'https://api.github.com'

// ── GitHub API helpers ────────────────────────────────────────────────────────

async function githubFetch(path, options = {}) {
  const url = `${GITHUB_API}${path}`
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(GITHUB_TOKEN ? { Authorization: 'Bearer ' + GITHUB_TOKEN } : {}),
    ...options.headers,
  }
  const res = await fetch(url, { ...options, headers })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, ok: res.ok, body }
}

async function cercaIssue(id) {
  // SI CERCA PER IDENTIFICATIVO, non per titolo. Cercando il titolo intero,
  // bastava rinominare un requisito perche' l'issue non venisse piu'
  // riconosciuta: nasceva un DOPPIONE e la vecchia restava li' orfana. L'id
  // fra parentesi quadre e' l'unica cosa che non cambia mai.
  //
  // Le chiuse sono incluse di proposito: un requisito gia' risolto e chiuso
  // non si ricrea. Il filtro finale e' nostro perche' la ricerca di GitHub
  // ignora le parentesi quadre e restituirebbe anche i vicini di casa
  // (REQ-MAG-1 pesca REQ-MAG-10).
  const q = encodeURIComponent(`repo:${OWNER}/${REPO} is:issue in:title "${id}"`)
  const { ok, body } = await githubFetch(`/search/issues?q=${q}&per_page=10`)
  if (!ok) return []
  return (body.items || []).filter((i) => i.title.startsWith(`[${id}]`))
}

// Il dettaglio serve per corpo ed etichette: la ricerca li tronca.
async function leggiIssue(numero) {
  const { ok, body } = await githubFetch(`/repos/${OWNER}/${REPO}/issues/${numero}`)
  return ok ? body : null
}

async function aggiornaIssue(numero, patch) {
  return githubFetch(`/repos/${OWNER}/${REPO}/issues/${numero}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

// Un bug risolto nel registro è un'issue da chiudere: così non si aggiorna la
// stessa cosa in due posti (e non restano aperte issue di roba già sistemata).
const STATI_CHIUSI = new Set(['fixed', 'implemented', 'done'])

async function commentIssue(number, body) {
  return githubFetch(`/repos/${OWNER}/${REPO}/issues/${number}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
}

async function closeIssue(number) {
  return githubFetch(`/repos/${OWNER}/${REPO}/issues/${number}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
  })
}

async function createIssue({ title, body, labels }) {
  return githubFetch(`/repos/${OWNER}/${REPO}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, labels }),
  })
}

// ── Issue body builder ────────────────────────────────────────────────────────

function buildIssueBody(req) {
  const testCasesSection = req.test_cases.length > 0
    ? `\n## Test case associati\n${req.test_cases.map((tc) => `- ${tc}`).join('\n')}\n`
    : ''

  // DOVE MORDE. Un bug in produzione è un'altra cosa da uno visto in test:
  // lì ci sono i conti veri del locale, e chi legge l'issue deve saperlo
  // dalla prima riga, non dopo aver letto la descrizione.
  const dove =
    req.in_produzione === true
      ? '\n> ⚠️ **In produzione**: succede sull’installazione che sta lavorando.\n'
      : req.in_produzione === false
        ? '\n> Visto solo in test.\n'
        : ''

  return `## ${req.id} — ${req.title}
${dove}
**Area**: \`${req.area}\`
${req.severity || req.priority ? `**Quanto fa male**: ${req.severity || '—'} · **Quando si fa**: ${req.priority || 'da decidere'}
` : ''}
**Status**: ${req.status}

## Descrizione

${req.description}
${testCasesSection}
---
*Issue generata automaticamente da \`scripts/generate-issues.mjs\` a partire da \`${req.source_file}\`.*
`
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // requirements.yaml è la mappa di cosa esiste, bugs.yaml di cosa non va:
  // stesso formato, stesso giro di issue. Il secondo può mancare (è nato dopo).
  const sorgenti = [
    { rel: 'requirements/requirements.yaml', obbligatorio: true },
    { rel: 'requirements/bugs.yaml', obbligatorio: false },
  ]

  const toGenerate = []
  for (const s of sorgenti) {
    const yamlPath = join(ROOT, ...s.rel.split('/'))
    let yamlText
    try {
      yamlText = readFileSync(yamlPath, 'utf8')
    } catch (_e) {
      if (s.obbligatorio) {
        console.error(`❌ File non trovato: ${yamlPath}`)
        process.exit(1)
      }
      continue
    }
    for (const voce of parseRequirementsYaml(yamlText)) {
      if (voce.generate_issue) toGenerate.push({ ...voce, source_file: s.rel })
    }
  }

  if (toGenerate.length === 0) {
    console.log('ℹ️  Nessuna voce con generate_issue: true trovata. Nulla da fare.')
    console.log('   Per creare un\'issue, imposta generate_issue: true in requirements/requirements.yaml o requirements/bugs.yaml')
    return
  }

  console.log(`📋 ${toGenerate.length} voce/i da processare:\n`)

  if (DRY_RUN) {
    console.log('🔍 DRY RUN — nessuna issue sarà creata.\n')
  } else if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN non impostato. Usa --dry-run oppure esporta GITHUB_TOKEN.')
    process.exit(1)
  }

  let created = 0
  let skipped = 0
  let closed = 0
  let updated = 0
  let errors = 0

  for (const req of toGenerate) {
    const issueTitle = `[${req.id}] ${req.title}`
    console.log(`▸ ${issueTitle}`)

    const risolto = STATI_CHIUSI.has(String(req.status || '').toLowerCase())


    // Check idempotenza: esiste già un'issue con questo titolo?
    const existing = await cercaIssue(req.id)

    // SU DEVELOP: la voce e' finita ma non provata. Non si chiude — in
    // produzione non c'e' ancora niente — si segna «in prova», che e' l'unica
    // informazione che mancava a chi guarda l'elenco delle issue.
    if (risolto && !CHIUDE_RISOLTI) {
      const aperta = existing.find((i) => i.state === 'open')
      if (!SEGNA_IN_TEST || !aperta) {
        console.log(`  ⏭  Risolto (${req.status}) — l'issue si chiude da main, non da qui.`)
        skipped++
        continue
      }
      const attuali = (aperta.labels || []).map((l) => (typeof l === 'string' ? l : l.name))
      if (attuali.includes(IN_TEST)) {
        console.log(`  ⏭  Gia' in prova: ${aperta.html_url}`)
        skipped++
        continue
      }
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Da mettere in prova (+${IN_TEST}): ${aperta.html_url}`)
        updated++
        continue
      }
      const esito = await aggiornaIssue(aperta.number, { labels: [...attuali, IN_TEST] })
      if (esito.ok) {
        console.log(`  🧪 In prova (+${IN_TEST}): ${aperta.html_url}`)
        updated++
      } else {
        console.error(`  ❌ Errore ${esito.status} su #${aperta.number}:`, esito.body.message || '')
        errors++
      }
      await new Promise((r) => setTimeout(r, 200))
      continue
    }

    if (risolto) {
      const aperta = existing.find((i) => i.state === 'open')
      if (DRY_RUN) {
        console.log(aperta ? `  [DRY RUN] Risolto (${req.status}) — chiuderebbe ${aperta.html_url}` : `  [DRY RUN] Risolto — nessuna issue aperta.`)
        aperta ? closed++ : skipped++
        continue
      }
      if (!aperta) {
        console.log(`  ⏭  Risolto (${req.status}) — nessuna issue aperta da chiudere.`)
        skipped++
        continue
      }
      await commentIssue(
        aperta.number,
        `Risolto: nel registro \`${req.source_file}\` la voce è passata a **${req.status}**.

${req.description}`
      )
      // Chiusa: «in prova» non vuol dire piu' niente, e lasciarla vorrebbe
      // dire che nell'elenco filtrato per in-test resta roba gia' in
      // produzione.
      const conProva = (aperta.labels || []).map((l) => (typeof l === 'string' ? l : l.name))
      if (conProva.includes(IN_TEST)) {
        await aggiornaIssue(aperta.number, { labels: conProva.filter((l) => l !== IN_TEST) })
      }
      const { ok, status, body } = await closeIssue(aperta.number)
      if (ok) {
        console.log(`  ✅ Issue chiusa: ${aperta.html_url}`)
        closed++
      } else {
        console.error(`  ❌ Errore ${status} chiudendo #${aperta.number}:`, body.message || '')
        errors++
      }
      await new Promise((r) => setTimeout(r, 200))
      continue
    }

    // L'ISSUE C'E' GIA': si riallinea, non si salta. Prima si saltava e basta,
    // e una voce che cambiava — un titolo riscritto, una priorita' nuova —
    // restava scritta solo nel registro: su GitHub, dove la gente guarda, non
    // arrivava mai.
    if (existing.length > 0) {
      const numero = existing[0].number
      const issue = (await leggiIssue(numero)) || existing[0]
      const attuali = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name))
      const { daAggiungere, daTogliere, finali } = riconciliaEtichette(attuali, req)
      const corpo = buildIssueBody(req)
      // Il corpo si riscrive solo se e' ancora il nostro: se qualcuno ci ha
      // scritto dentro un'analisi, quella vale piu' del testo generato.
      const corpoDaRiscrivere = corpoGenerato(issue.body) && (issue.body || '').trim() !== corpo.trim()
      const titoloDaCambiare = issue.title !== issueTitle

      const patch = {}
      if (titoloDaCambiare) patch.title = issueTitle
      if (corpoDaRiscrivere) patch.body = corpo
      if (daAggiungere.length || daTogliere.length) patch.labels = finali

      if (Object.keys(patch).length === 0) {
        console.log(`  ⏭  Gia' allineata: ${issue.html_url}`)
        skipped++
        continue
      }

      const cambiamenti = [
        titoloDaCambiare ? 'titolo' : null,
        corpoDaRiscrivere ? 'testo' : null,
        daAggiungere.length ? `+${daAggiungere.join(' +')}` : null,
        daTogliere.length ? `-${daTogliere.join(' -')}` : null,
      ].filter(Boolean).join(', ')

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Da riallineare (${cambiamenti}): ${issue.html_url}`)
        updated++
        continue
      }

      const esito = await aggiornaIssue(numero, patch)
      if (esito.ok) {
        console.log(`  ♻️  Riallineata (${cambiamenti}): ${issue.html_url}`)
        updated++
      } else {
        console.error(`  ❌ Errore ${esito.status} riallineando #${numero}:`, esito.body.message || '')
        errors++
      }
      await new Promise((r) => setTimeout(r, 200))
      continue
    }

    if (DRY_RUN) {
      console.log('  [DRY RUN] Nuova. Labels:', [...new Set([...req.labels, ...etichetteClassificazione(req)])].join(', ') || '(nessuna)')
      created++
      continue
    }

    const { ok, status, body } = await createIssue({
      title: issueTitle,
      body: buildIssueBody(req),
      labels: [...new Set([...req.labels, ...etichetteClassificazione(req)])],
    })

    if (ok) {
      console.log(`  ✅ Issue creata: ${body.html_url}`)
      created++
    } else {
      console.error(`  ❌ Errore ${status}:`, body.message || JSON.stringify(body))
      errors++
    }

    // Rate limiting: GitHub API ha limite di ~10 req/s per token autenticati
    await new Promise((r) => setTimeout(r, 200))
  }

  console.log(`\n📊 Riepilogo: ${created} create, ${updated} riallineate, ${closed} chiuse, ${skipped} saltate, ${errors} errori`)
  if (errors > 0) process.exit(1)
}

main().catch((e) => {
  console.error('❌ Errore inatteso:', e)
  process.exit(1)
})
