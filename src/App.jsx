// ============================================================
// App.jsx — Chef d'orchestre GameWard Reporting
// Gère l'authentification et la navigation entre pages
// ============================================================
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { getSession, logout } from './utils/auth';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Vérifie si une session existe au chargement
  useEffect(() => {
    const session = getSession();
    if (session) setUser(session);
    setLoading(false);
  }, []);

  function handleLogin(userData) {
    setUser(userData);
  }

  function handleLogout() {
    logout();
    setUser(null);
  }

  // Chargement initial
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#18102d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#E25A66',
        fontSize: '14px',
        letterSpacing: '2px',
      }}>
        CHARGEMENT...
      </div>
    );
  }

  // Pas connecté → page de login
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Connecté → dashboard
  return <Dashboard user={user} onLogout={handleLogout} />;
}