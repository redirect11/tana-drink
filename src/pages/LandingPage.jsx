import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

// Landing pubblica a "/". Il menù vero e proprio è su "/menu".
// Se si arriva con un QR-tavolo (?tavolo=) o un link gruppo (?group=),
// si inoltra direttamente al menù preservando i parametri.
export default function LandingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const qs = params.toString()
    if (params.get('tavolo') || params.get('table') || params.get('group')) {
      navigate(`/menu?${qs}`, { replace: true })
    }
  }, [params, navigate])

  return (
    <div className="landing">
      <div className="hero">
        <img
          className="hero-img"
          src="/cocktail-hero.jpg"
          alt="La Tana del Coniglio"
          onError={(e) => (e.target.style.display = 'none')}
        />
        <div className="hero-overlay">
          <img className="hero-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
          <h1 className="hero-title">La Tana del Coniglio</h1>
          <p className="hero-sub">Cocktail bar · Nola</p>
          <Link className="btn" to="/menu" style={{ marginTop: 14, minWidth: 200 }}>
            🍸 Vai al menù
          </Link>
        </div>
      </div>

      <nav className="landing-nav">
        <a href="#chi-siamo">Chi siamo</a>
        <a href="#contatti">Contatti</a>
        <Link to="/menu">Menù</Link>
      </nav>

      <section id="chi-siamo" className="card">
        <h2 style={{ marginTop: 0 }}>Chi siamo</h2>
        <p className="muted">
          La Tana del Coniglio è un cocktail bar a Nola: drink d’autore, ingredienti
          freschi e un’atmosfera speakeasy. {/* TODO: testo definitivo da fornire */}
        </p>
      </section>

      <section id="contatti" className="card">
        <h2 style={{ marginTop: 0 }}>Contatti</h2>
        <p className="muted" style={{ margin: '0 0 6px' }}>
          📍 Nola (NA) {/* TODO: indirizzo completo */}
        </p>
        <p className="muted" style={{ margin: '0 0 6px' }}>
          ✉️ <a href="mailto:info@latanadelconiglio.it">info@latanadelconiglio.it</a>
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Seguici sui social (link in fondo alla pagina).
        </p>
      </section>

      <Link className="btn block" to="/menu" style={{ marginTop: 4 }}>
        🍸 Sfoglia il menù e ordina
      </Link>
    </div>
  )
}
