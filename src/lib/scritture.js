/* global __DEMO__ */
// ── LE SCRITTURE SU FIRESTORE PASSANO DA QUI ──────────────────────────
//
// Nei locali veri sono le funzioni di Firestore, identiche: la promessa si
// risolve alla conferma del server, e chi la aspetta vede anche un rifiuto
// (un permesso che manca, un documento che non c'è).
//
// Nella DEMO la rete del database è spenta per sempre (REQ-FLOTTA-019):
// la conferma del server non arriva mai, e chi aspettava una scrittura
// restava fermo. Lì la scrittura si considera fatta appena è nella cache
// del browser (confermaLocale.js).
//
// `__DEMO__` è una costante della build (clienti/pluginCliente.js): nella
// build di un locale vero vale `false`, il ramo sparisce e con lui
// confermaLocale. Un test controlla che nessun altro modulo dell'app
// importi le scritture direttamente da 'firebase/firestore'.
//
// Le funzioni di Firestore si prendono AL MOMENTO DELLA CHIAMATA, non al
// caricamento: chi nei test finge Firestore con un pezzo solo (un ascolto,
// una lettura) non deve fingere anche le scritture che non usa.
import * as sdk from 'firebase/firestore'
import { confermaLocale } from './confermaLocale.js'

let locali = null
const demo = () =>
  (locali ||= confermaLocale({
    setDoc: (...a) => sdk.setDoc(...a),
    updateDoc: (...a) => sdk.updateDoc(...a),
    deleteDoc: (...a) => sdk.deleteDoc(...a),
    writeBatch: (...a) => sdk.writeBatch(...a),
    doc: (...a) => sdk.doc(...a),
  }))

export const setDoc = (...a) => (__DEMO__ ? demo().setDoc(...a) : sdk.setDoc(...a))
export const updateDoc = (...a) => (__DEMO__ ? demo().updateDoc(...a) : sdk.updateDoc(...a))
export const addDoc = (...a) => (__DEMO__ ? demo().addDoc(...a) : sdk.addDoc(...a))
export const deleteDoc = (...a) => (__DEMO__ ? demo().deleteDoc(...a) : sdk.deleteDoc(...a))
export const writeBatch = (...a) => (__DEMO__ ? demo().writeBatch(...a) : sdk.writeBatch(...a))
