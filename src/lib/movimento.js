// «RIDUCI MOVIMENTO»: chi l'ha chiesto al telefono (accessibilità) non deve
// vedere niente muoversi da solo, compresi gli scorrimenti guidati, che
// allora vanno di colpo invece che morbidi. Una lettura sola per gli stili
// strutturati del menù, che se la copiavano uno per uno.
export const nessunMovimento = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// Il `behavior` di scrollIntoView che rispetta «riduci movimento».
export const comeScorrere = () => (nessunMovimento() ? 'auto' : 'smooth')
