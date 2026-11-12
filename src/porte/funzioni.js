// ── LA PORTA DELLE FUNZIONI DEL LOCALE ─────────────────────────────────────
//
// Le Functions del locale si chiamano da qui (oggi `richiestaAI`, REQ-AI-003).
// Il contratto: chiamaFunzione(nome, dati, { attesaMs }) → i dati della risposta, o una
// promessa che fallisce con un errore che ha `code`. Dietro c'è
// l'adattatore di Firebase (src/adattatori/firebase/funzioni.js); la porta
// non conosce Firebase (tests/unit/confineFirebase.test.js).
export { chiamaFunzione } from '../adattatori/firebase/funzioni.js'
