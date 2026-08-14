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
 * Idempotenza:
 *   Il titolo dell'issue viene prefissato con "[ID]", es. "[REQ-SUMUP-SYNC-001] Titolo"
 *   o "[BUG-001] Titolo".
 *   Prima di creare un'issue, lo script verifica se ne esiste già una con lo stesso
 *   titolo (aperta o chiusa). Se esiste, la salta.
 */

import { readFileSync } from 'node:fs'
import { parseRequirementsYaml } from './lib-requisiti.mjs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Config ───────────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const GITHUB_REPO = process.env.GITHUB_REPO || 'redirect11/tana-drink'
const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run')

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

async function searchIssues(title) {
  // Cerca issue esistenti (aperte o chiuse) con questo titolo esatto, per idempotenza.
  // Le chiuse sono incluse di proposito: se un'issue di requisito è già stata risolta
  // e chiusa, NON vogliamo ricrearla automaticamente.
  const q = encodeURIComponent(`repo:${OWNER}/${REPO} is:issue in:title "${title}"`)
  const { ok, body } = await githubFetch(`/search/issues?q=${q}&per_page=5`)
  if (!ok) return []
  return body.items || []
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

  return `## ${req.id} — ${req.title}

**Area**: \`${req.area}\`
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
  let errors = 0

  for (const req of toGenerate) {
    const issueTitle = `[${req.id}] ${req.title}`
    console.log(`▸ ${issueTitle}`)

    if (DRY_RUN) {
      console.log('  [DRY RUN] Payload:')
      console.log('  Title:', issueTitle)
      console.log('  Labels:', req.labels.join(', ') || '(nessuna)')
      console.log('  Body (anteprima):', buildIssueBody(req).slice(0, 200) + '...\n')
      created++
      continue
    }

    // Check idempotenza: esiste già un'issue con questo titolo?
    const existing = await searchIssues(issueTitle)
    if (existing.length > 0) {
      console.log(`  ⏭  Saltato — issue già esistente: ${existing[0].html_url}`)
      skipped++
      continue
    }

    const { ok, status, body } = await createIssue({
      title: issueTitle,
      body: buildIssueBody(req),
      labels: req.labels,
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

  console.log(`\n📊 Riepilogo: ${created} create, ${skipped} saltate, ${errors} errori`)
  if (errors > 0) process.exit(1)
}

main().catch((e) => {
  console.error('❌ Errore inatteso:', e)
  process.exit(1)
})
