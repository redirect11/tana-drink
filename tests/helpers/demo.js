// ── ACCENDERE LA DEMO IN UN TEST (REQ-FLOTTA-019) ─────────────────────────
//
// Nella build `__DEMO__` è un letterale. Nei test vitest.config.mjs la fa
// diventare `globalThis.__DEMO_TEST__`, ma vitest la tratta in due modi:
// in ambiente Node la sostituisce nel codice (e allora conta
// `__DEMO_TEST__`), in happy-dom la legge come variabile globale
// `__DEMO__`, calcolata una volta all'avvio. Qui si accendono tutte e due:
// dopo, `vi.resetModules()` e un `import()` danno il modulo nella sua
// versione demo.

export function accendiDemo(acceso = true) {
  globalThis.__DEMO_TEST__ = acceso
  globalThis.__DEMO__ = acceso
}

export function spegniDemo() {
  delete globalThis.__DEMO_TEST__
  globalThis.__DEMO__ = undefined
}
