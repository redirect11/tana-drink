import { useRef, useState } from 'react'
import {
  esportaDatabase,
  importaDatabase,
  riassunto,
  totaleRighe,
  validaBackup,
  scarica,
  nomeFile,
} from '../lib/backup.js'
import { isAdmin } from '../lib/ruoli.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import Icona from './Icona.jsx'
import { tr, trSegnato } from '../lib/lingua.js'

// BACKUP E RIPRISTINO dal gestionale. Scarica tutto il database in un file
// e lo rimette da un file. Serve prima di ogni operazione grossa (importi,
// travasi, pulizie) e come rete di sicurezza: qui dentro ci sono gli
// incassi delle serate, il magazzino e le ore del personale.
// `soloEsporta`: sul locale fermo (REQ-LIC-018) il titolare scarica i suoi
// dati, ma il ripristino no: scrive, e le regole lo rifiuterebbero.
export default function BackupPanel({ role = null, soloEsporta = false }) {
  const [busy, setBusy] = useState(null) // 'export' | 'import' | null
  const [passo, setPasso] = useState('')
  const [esito, setEsito] = useState(null)
  const [errore, setErrore] = useState(null)
  const [daImportare, setDaImportare] = useState(null) // backup letto, in attesa di conferma
  const fileRef = useRef(null)
  const admin = isAdmin(role) && !soloEsporta

  async function esporta() {
    setBusy('export')
    setErrore(null)
    setEsito(null)
    try {
      const backup = await esportaDatabase((nome, n) => setPasso(`${nome}: ${n}`))
      scarica(backup)
      setEsito(tr('✓ Scaricato {file} — {n} documenti.', { file: nomeFile(backup), n: backup.documenti }))
    } catch (e) {
      setErrore(e.message)
    } finally {
      setBusy(null)
      setPasso('')
    }
  }

  async function scegliFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // così si può riselezionare lo stesso file
    if (!file) return
    setErrore(null)
    setEsito(null)
    try {
      const backup = JSON.parse(await file.text())
      const problema = validaBackup(backup)
      if (problema) return setErrore(trSegnato(problema))
      setDaImportare(backup)
    } catch (err) {
      setErrore(tr('File illeggibile: {errore}', { errore: err.message }))
    }
  }

  async function importa() {
    const backup = daImportare
    setDaImportare(null)
    setBusy('import')
    setErrore(null)
    try {
      const { scritti, saltate, fuoriLicenza, soloScript } = await importaDatabase(backup, (nome, fatti, tot) =>
        setPasso(`${nome}: ${fatti}/${tot}`)
      )
      setEsito(
        [
          tr('✓ Ripristinati {n} documenti.', { n: scritti }),
          saltate.length && tr('Saltate (sconosciute a questa versione): {elenco}.', { elenco: saltate.join(', ') }),
          fuoriLicenza.length &&
            tr('Non ripristinate perché di moduli non inclusi nella licenza: {elenco}.', {
              elenco: fuoriLicenza.join(', '),
            }),
          soloScript.length &&
            tr('Lo storico importato ({elenco}) è nel file, e si ripristina con lo script di manutenzione.', {
              elenco: soloScript.join(', '),
            }),
        ]
          .filter(Boolean)
          .join(' ')
      )
    } catch (e) {
      setErrore(e.message)
    } finally {
      setBusy(null)
      setPasso('')
    }
  }

  return (
    <div className="card settings-section">
      <h3>{soloEsporta ? tr('I dati del locale') : tr('Backup e ripristino')}</h3>
      <p className="muted small" style={{ margin: '0 0 10px' }}>
        {soloEsporta
          ? tr('Scarica in un file tutto quello che c’è nel database: ordini, incassi, fatture, clienti, magazzino, menù.')
          : tr(
              'Scarica in un file tutto quello che c’è nel database: ordini, incassi, magazzino, menù, ore del personale.'
            )}
      </p>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn grow" onClick={esporta} disabled={!!busy}>
          {busy === 'export' ? (
            tr('Scarico…')
          ) : (
            <>
              <Icona nome="esporta" gruppo="tasti" /> {tr('Esporta tutto')}
            </>
          )}
        </button>
        {admin && (
          <>
            <button
              className="btn ghost grow"
              onClick={() => fileRef.current?.click()}
              disabled={!!busy}
            >
              {busy === 'import' ? (
                tr('Ripristino…')
              ) : (
                <>
                  <Icona nome="importa" gruppo="tasti" /> {tr('Ripristina da file')}
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={scegliFile}
            />
          </>
        )}
      </div>

      {busy && passo && (
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          {passo}
        </p>
      )}
      {esito && (
        <p className="small" style={{ margin: '8px 0 0' }}>
          {esito}
        </p>
      )}
      {errore && (
        <div className="banner" style={{ marginTop: 8 }}>
          {errore}
        </div>
      )}

      {!soloEsporta && (
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          {tr('Il ripristino riscrive quello che c’è nel file e lascia stare il resto: non cancella nulla.')}{' '}
          {admin
            ? tr(
                'Per rimettere il database esattamente com’era — cancellando anche quello che è arrivato dopo — si usa lo script ripristina-db.js.'
              )
            : tr('Il ripristino è riservato all’admin.')}{' '}
          {tr('Le utenze non sono nel backup: stanno in Firebase Auth, con i loro ruoli.')}
        </p>
      )}

      {daImportare && (
        <ConfirmDialog
          title={tr('Ripristinare da questo file?')}
          message={
            tr('Backup del {data}', { data: (daImportare.creato_il || '').slice(0, 16).replace('T', ' ') }) +
            `${daImportare.progetto ? ` · ${daImportare.progetto}` : ''}\n` +
            tr('{n} documenti in {m} collezioni:', {
              n: totaleRighe(daImportare),
              m: riassunto(daImportare).length,
            }) +
            '\n' +
            riassunto(daImportare)
              .map((r) => `· ${r.nome}: ${r.righe}`)
              .join('\n') +
            '\n\n' +
            tr('I documenti con lo stesso identificativo verranno SOVRASCRITTI.')
          }
          confirmLabel={tr('Ripristina')}
          danger
          onCancel={() => setDaImportare(null)}
          onConfirm={importa}
        />
      )}
    </div>
  )
}
