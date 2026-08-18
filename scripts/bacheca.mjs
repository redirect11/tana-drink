// LA BACHECA, quel poco che ci serve.
//
// Le issue le scrive `generate-issues.mjs` col token che Actions dà da sé.
// Sulla BACHECA quel token non può scrivere: i Projects v2 vivono
// sull'account, non nel repository, e vogliono un token personale con lo
// scope `project` (nei segreti come PROJECT_TOKEN). Senza quel segreto qui
// non si rompe niente: si salta, e le schede si spostano a mano come prima.
//
// Si parla solo GraphQL, perché i Projects v2 non hanno API REST.

const API = 'https://api.github.com/graphql'

const TOKEN = process.env.PROJECT_TOKEN || ''
const OWNER = process.env.PROGETTO_OWNER || (process.env.GITHUB_REPO || 'redirect11/tana-drink').split('/')[0]
const NUMERO = Number(process.env.PROGETTO_NUMERO || 3)

export const bachecaAttiva = () => Boolean(TOKEN)

async function chiedi(query, variables = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json().catch(() => ({}))
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '))
  return body.data
}

// Gli identificativi della bacheca si chiedono UNA VOLTA: il campo e le sue
// opzioni non cambiano durante una passata, e rifare la domanda a ogni voce
// vuol dire venticinque chiamate per niente.
let cache = null
async function bacheca() {
  if (cache) return cache
  const d = await chiedi(
    `query($owner:String!, $numero:Int!) {
      user(login:$owner) {
        projectV2(number:$numero) {
          id
          field(name:"Status") { ... on ProjectV2SingleSelectField { id options { id name } } }
        }
      }
    }`,
    { owner: OWNER, numero: NUMERO },
  )
  const p = d?.user?.projectV2
  if (!p?.field) throw new Error(`Bacheca #${NUMERO} di ${OWNER}: campo «Status» non trovato`)
  cache = {
    progetto: p.id,
    campo: p.field.id,
    opzioni: Object.fromEntries(p.field.options.map((o) => [o.name, o.id])),
  }
  return cache
}

// La scheda di un'issue su QUESTA bacheca (una issue può stare su più
// bacheche: si prende quella che ci interessa, non la prima che capita).
export async function schedaDellaIssue(repo, numeroIssue) {
  const [proprietario, nome] = repo.split('/')
  const { progetto } = await bacheca()
  const d = await chiedi(
    `query($proprietario:String!, $nome:String!, $numero:Int!) {
      repository(owner:$proprietario, name:$nome) {
        issue(number:$numero) {
          projectItems(first:10) {
            nodes {
              id
              project { id }
              fieldValueByName(name:"Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
            }
          }
        }
      }
    }`,
    { proprietario, nome, numero: numeroIssue },
  )
  const nodi = d?.repository?.issue?.projectItems?.nodes || []
  const scheda = nodi.find((n) => n.project?.id === progetto)
  return scheda ? { id: scheda.id, stato: scheda.fieldValueByName?.name || null } : null
}

export async function spostaScheda(idScheda, nomeStato) {
  const { progetto, campo, opzioni } = await bacheca()
  const opzione = opzioni[nomeStato]
  if (!opzione) throw new Error(`Sulla bacheca non esiste lo stato «${nomeStato}»`)
  await chiedi(
    `mutation($progetto:ID!, $scheda:ID!, $campo:ID!, $opzione:String!) {
      updateProjectV2ItemFieldValue(input:{
        projectId:$progetto, itemId:$scheda, fieldId:$campo,
        value:{ singleSelectOptionId:$opzione }
      }) { projectV2Item { id } }
    }`,
    { progetto, scheda: idScheda, campo, opzione },
  )
}
