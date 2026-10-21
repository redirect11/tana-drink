// UNA SPIEGAZIONE A SCOMPARSA, in cima a una tabella (REQ-UI-029). L'utente,
// 10/10/2026: la spiegazione di «Venduto × Incassato» e di «Acquisti ×
// Fatturato» va «a scomparsa nella schermata stessa». Chiusa di partenza:
// chi la tabella la sa leggere non deve scorrere un paragrafo ogni volta, e
// chi non la sa leggere la trova dove se lo chiede, non in un manuale.
// È `<details>`: si apre e si chiude da tastiera e da lettore di schermo
// senza codice.
export default function Soffietto({ titolo, children }) {
  return (
    <details className="card soffietto">
      <summary>ℹ️ {titolo}</summary>
      <div className="soffietto-corpo">{children}</div>
    </details>
  )
}
