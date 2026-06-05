import { Routes, Route, Link, useLocation } from 'react-router-dom'
import MenuPage from './pages/MenuPage.jsx'
import OrderStatusPage from './pages/OrderStatusPage.jsx'
import MyOrdersPage from './pages/MyOrdersPage.jsx'
import BartenderPage from './pages/BartenderPage.jsx'
import { isSupabaseConfigured } from './lib/supabaseClient.js'

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

      {!isSupabaseConfigured && (
        <div className="banner">
          ⚠️ Supabase non è configurato. Imposta <code>VITE_SUPABASE_URL</code> e{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> (vedi <code>.env.example</code> e{' '}
          <code>supabase/schema.sql</code>).
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
