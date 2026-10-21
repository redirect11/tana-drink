import { Link } from 'react-router-dom'
import { NOME_PRODOTTO, SLOGAN, DESCRIZIONE } from '../lib/prodotto.js'
import { PIANI, MODULI, TERMINALE_IN_PIU, ATTIVAZIONE, euro } from '../lib/piani.js'

// LA PRIMA PAGINA (REQ-FLOTTA-002): cosa fa il prodotto, i piani coi
// prezzi, il tasto per registrarsi. Registro del mestiere, niente toni da
// venditore (DESIGN.md, guardrail 3).
export default function Home({ utente }) {
  return (
    <main className="pagina">
      <section className="hero">
        <h1>{NOME_PRODOTTO}</h1>
        <p className="slogan">{SLOGAN}</p>
        <p className="muted">{DESCRIZIONE}</p>
        <div className="azioni">
          {utente ? (
            <Link className="btn" to="/dashboard">La mia dashboard</Link>
          ) : (
            <>
              <Link className="btn" to="/registrati">Registra il tuo locale</Link>
              <Link className="btn ghost" to="/accedi">Accedi</Link>
            </>
          )}
        </div>
      </section>

      <section id="prezzi">
        <h2>Piani e prezzi</h2>
        <p className="muted">Importi al mese, IVA esclusa. L’attivazione si paga una volta: {euro(ATTIVAZIONE)}.</p>
        <div className="piani">
          {Object.values(PIANI).map((p) => (
            <article className="card piano" key={p.id} aria-label={`Piano ${p.nome}`}>
              <h3>{p.nome}</h3>
              <p className="prezzo">
                {euro(p.prezzo)} <span className="muted small">/ mese</span>
              </p>
              <p className="muted">{p.descrizione}</p>
            </article>
          ))}
        </div>
        <h3>Moduli in più sul piano Base</h3>
        <table className="moduli">
          <tbody>
            {MODULI.map((m) => (
              <tr key={m.id}>
                <th scope="row">{m.nome}</th>
                <td className="muted">{m.descrizione}</td>
                <td className="prezzo-riga">{euro(m.prezzo)} / mese</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Terminale in più</th>
              <td className="muted">Un altro tablet o telefono che batte sulla stessa cassa.</td>
              <td className="prezzo-riga">{euro(TERMINALE_IN_PIU)} / mese</td>
            </tr>
          </tbody>
        </table>
        <p className="muted small">
          Lo scontrino esce su una stampante termica: non è uno scontrino fiscale. Per quello serve un
          registratore telematico, che resta del locale.
        </p>
      </section>
    </main>
  )
}
