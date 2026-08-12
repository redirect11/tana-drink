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

// BACKUP E RIPRISTINO dal gestionale. Scarica tutto il database in un file
// e lo rimette da un file. Serve prima di ogni operazione grossa (importi,
// travasi, pulizie) e come rete di sicurezza: qui dentro ci sono gli
// incassi delle serate, il magazzino e le ore del personale.
export default function BackupPanel({ role = null }) {
  const [busy, setBusy] = useState(null) // 'export' | 'import' | null
  const [passo, setPasso] = useState('')
  const [esito, setEsito] = useState(null)
  const [errore, setErrore] = useState(null)
  const [daImportare, setDaImportare] = useState(null) // backup letto, in attesa di conferma
  const fileRef = useRef(null)
  const admin = isAdmin(role)

  async function esporta() {
    setBusy('export')
    setErrore(null)
    setEsito(null)
    try {
      const backup = await esportaDatabase((nome, n) => setPasso(`${nome}: ${n}`))
      scarica(backup)
      setEsito(`✓ Scaricato ${nomeFile(backup)} — ${backup.documenti} documenti.`)
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
      if (problema) return setErrore(problema)
      setDaImportare(backup)
    } catch (err) {
      setErrore(`File illeggibile: ${err.message}`)
    }
  }

  async function importa() {
    const backup = daImportare
    setDaImportare(null)
    setBusy('import')
    setErrore(null)
    try {
      const { scritti, saltate } = await importaDatabase(backup, (nome, fatti, tot) =>
        setPasso(`${nome}: ${fatti}/${tot}`)
      )
      setEsito(
        `✓ Ripristinati ${scritti} documenti.` +
          (saltate.length ? ` Saltate (sconosciute a questa versione): ${saltate.join(', ')}.` : '')
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
      <h3>Backup e ripristino</h3>
      <p className="muted small" style={{ margin: '0 0 10px' }}>
        Scarica in un file tutto quello che c’è nel database: ordini, incassi,
        magazzino, menù, ore del personale. Fallo prima di ogni operazione
        grossa — e ogni tanto anche senza motivo.
      </p>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn grow" onClick={esporta} disabled={!!busy}>
          {busy === 'export' ? 'Scarico…' : '⬇️ Esporta tutto'}
        </button>
        {admin && (
          <>
            <button
              className="btn ghost grow"
              onClick={() => fileRef.current?.click()}
              disabled={!!busy}
            >
              {busy === 'import' ? 'Ripristino…' : '⬆️ Ripristina da file'}
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

      <p className="muted small" style={{ margin: '10px 0 0' }}>
        Il ripristino <strong>riscrive</strong> quello che c’è nel file e lascia
        stare il resto: non cancella nulla.{' '}
        {admin
          ? 'Per rimettere il database esattamente com’era — cancellando anche quello che è arrivato dopo — si usa lo script ripristina-db.js.'
          : 'Il ripristino è riservato all’admin.'}{' '}
        Le utenze non sono nel backup: stanno in Firebase Auth, con i loro ruoli.
      </p>

      {daImportare && (
        <ConfirmDialog
          title="Ripristinare da questo file?"
          message={
            `Backup del ${(daImportare.creato_il || '').slice(0, 16).replace('T', ' ')}` +
            `${daImportare.progetto ? ` · ${daImportare.progetto}` : ''}\n` +
            `${totaleRighe(daImportare)} documenti in ${riassunto(daImportare).length} collezioni:\n` +
            riassunto(daImportare)
              .map((r) => `· ${r.nome}: ${r.righe}`)
              .join('\n') +
            `\n\nI documenti con lo stesso identificativo verranno SOVRASCRITTI.`
          }
          confirmLabel="Ripristina"
          danger
          onCancel={() => setDaImportare(null)}
          onConfirm={importa}
        />
      )}
    </div>
  )
}
