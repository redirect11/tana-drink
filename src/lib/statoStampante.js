// ── LA STAMPANTE SI VEDE O NO ────────────────────────────────────────
//
// Al banco lo si scopriva stampando: se non usciva niente, la comanda era
// già persa. In sala è peggio — il telefono ha l'IP (arriva dal server) ma
// il certificato della stampante si accetta a mano, e quell'eccezione cade
// da sola: il telefono sembra a posto e non stampa.
//
// Qui si chiede alla stampante se c'è, PRIMA di averne bisogno. Non è una
// stampa di prova: è la stessa stretta di mano che farebbe la comanda, senza
// carta consumata. Se regge, la comanda uscirà; se non regge, si sa adesso.
//
// Lo stato è uno solo per tutta l'app (la connessione è una sola): un
// controllo ogni mezzo minuto finché qualcuno lo guarda, più un controllo
// appena si torna sull'app — è lì che l'eccezione del certificato si
// scopre caduta, non a metà servizio.

import { useEffect, useState } from 'react'
import { loadPrinterSettings, preparaStampante } from './printer.js'

const OGNI = 30000

// 'ignota'  — non l'abbiamo ancora chiesto
// 'spenta'  — nessun IP: qui la stampante non è configurata
// 'ok'      — risponde: la comanda uscirà
// 'ko'      — non risponde, e `motivo` dice perché
let _stato = { stato: 'ignota', motivo: '' }
const _ascolto = new Set()
let _timer = null
let _inCorso = null

function annuncia(next) {
  _stato = next
  for (const f of _ascolto) f(_stato)
}

export function statoStampante() {
  return _stato
}

// Un controllo alla volta: dieci schermate che chiedono insieme non devono
// diventare dieci strette di mano (la stampante ne regge poche).
export function controllaStampante() {
  if (_inCorso) return _inCorso
  _inCorso = (async () => {
    if (!loadPrinterSettings().ip) {
      annuncia({ stato: 'spenta', motivo: 'Stampante non configurata' })
      return _stato
    }
    const r = await preparaStampante()
    annuncia(r.ok ? { stato: 'ok', motivo: '' } : { stato: 'ko', motivo: r.motivo || 'Non risponde' })
    return _stato
  })().finally(() => {
    _inCorso = null
  })
  return _inCorso
}

function avvia() {
  if (_timer) return
  _timer = setInterval(() => controllaStampante(), OGNI)
}

function ferma() {
  clearInterval(_timer)
  _timer = null
}

function alRitorno() {
  if (document.visibilityState === 'visible') controllaStampante()
}

// Torna { stato, motivo, ricontrolla }. Il controllo parte al primo che
// guarda e si ferma quando non guarda più nessuno.
export function useStatoStampante() {
  const [stato, setStato] = useState(_stato)

  useEffect(() => {
    _ascolto.add(setStato)
    if (_ascolto.size === 1) {
      avvia()
      document.addEventListener('visibilitychange', alRitorno)
    }
    controllaStampante()
    return () => {
      _ascolto.delete(setStato)
      if (_ascolto.size === 0) {
        ferma()
        document.removeEventListener('visibilitychange', alRitorno)
      }
    }
  }, [])

  return { ...stato, ricontrolla: controllaStampante }
}
