import { Routes, Route, Link, useLocation } from 'react-router-dom'
import MenuPage from './pages/MenuPage.jsx'
import OrderStatusPage from './pages/OrderStatusPage.jsx'
import MyOrdersPage from './pages/MyOrdersPage.jsx'
import BartenderPage from './pages/BartenderPage.jsx'
import { isFirebaseConfigured } from './lib/firebaseClient.js'

export default function App() {
  const location = useLocation()
  const onBackoffice = location.pathname.startsWith('/bar')

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <span>La Tana del Coniglio</span>
        </Link>
        <nav className="row">
          {onBackoffice ? (
            <Link className="btn ghost small" to="/">Vista cliente</Link>
          ) : (
            <>
              <Link className="btn ghost small" to="/ordini">I miei ordini</Link>
              <Link className="btn ghost small" to="/bar">Bartender</Link>
            </>
          )}
        </nav>
      </header>

      {!isFirebaseConfigured && (
        <div className="banner">
          ⚠️ Firebase non è configurato. Imposta <code>VITE_FIREBASE_API_KEY</code> e{' '}
          <code>VITE_FIREBASE_PROJECT_ID</code> (vedi <code>.env.example</code> e{' '}
          <code>firestore.rules</code>).
        </div>
      )}

      <main>
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/ordini" element={<MyOrdersPage />} />
          <Route path="/ordine/:id" element={<OrderStatusPage />} />
          <Route path="/bar" element={<BartenderPage />} />
          <Route path="*" element={<MenuPage />} />
        </Routes>
      </main>
    </div>
  )
}
