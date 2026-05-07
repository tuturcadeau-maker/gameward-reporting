// ============================================================
// Page de connexion GameWard
// ============================================================
import { useState } from 'react';
import { login } from '../utils/auth';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(username, password);
    
    if (result.success) {
      onLogin(result.user);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#18102d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Grille décorative GameWard */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.05,
        backgroundImage: 'linear-gradient(#E25A66 1px, transparent 1px), linear-gradient(90deg, #E25A66 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }}/>

      <div style={{
        width: '100%', maxWidth: '420px',
        margin: '0 16px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(226,90,102,0.3)',
        borderRadius: '16px',
        padding: '40px 36px',
        backdropFilter: 'blur(10px)',
      }}>
        {/* Logo GameWard */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px',
            borderRadius: '50%',
            border: '2px solid #E25A66',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '24px',
          }}>Σ</div>
          <div style={{
            color: '#fff',
            fontSize: '22px',
            fontWeight: '700',
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}>GAMEWARD</div>
          <div style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '12px',
            marginTop: '6px',
            letterSpacing: '2px',
          }}>PARTNER REPORTING</div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '11px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>Identifiant</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="ton_identifiant"
              required
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '11px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Message d'erreur */}
          {error && (
            <div style={{
              background: 'rgba(226,90,102,0.15)',
              border: '1px solid rgba(226,90,102,0.4)',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#E25A66',
              fontSize: '13px',
              marginBottom: '16px',
            }}>{error}</div>
          )}

          {/* Bouton connexion */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? 'rgba(226,90,102,0.5)' : '#E25A66',
              border: 'none',
              borderRadius: '8px',
              padding: '13px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '24px',
          color: 'rgba(255,255,255,0.2)',
          fontSize: '11px',
        }}>
          #FaceEverything
        </div>
      </div>
    </div>
  );
}