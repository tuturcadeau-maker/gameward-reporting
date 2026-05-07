// ============================================================
// Authentification GameWard
// Lit les utilisateurs depuis Google Sheets
// ============================================================

const SHEET_ID = '13iCzlEuJXbRq3uk9NzakqSiGisqsZ2a3x4Q5ruWIcOc';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

// Hash SHA-256 d'un mot de passe
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Récupère les utilisateurs depuis Google Sheets
async function getUsers() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Users!A2:G100?key=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.values) return [];
  
  return data.values.map(row => ({
    sponsor_name:  row[0] || '',
    username:      row[1] || '',
    password_hash: row[2] || '',
    access_level:  row[3] || 'sponsor',
    active:        row[4] === 'TRUE',
    date_created:  row[5] || '',
    last_login:    row[6] || '',
  }));
}

// Connexion
export async function login(username, password) {
  try {
    const users = await getUsers();
    const hash = await hashPassword(password);
    
    const user = users.find(u => 
      u.username === username && 
      u.password_hash === hash && 
      u.active
    );
    
    if (!user) return { success: false, error: 'Identifiant ou mot de passe incorrect' };
    
    // Sauvegarde en session
    const session = {
      username:     user.username,
      sponsor_name: user.sponsor_name,
      access_level: user.access_level,
      logged_at:    new Date().toISOString(),
    };
    sessionStorage.setItem('gw_session', JSON.stringify(session));
    
    return { success: true, user: session };
    
  } catch(e) {
    return { success: false, error: 'Erreur de connexion, réessaie' };
  }
}

// Récupère la session actuelle
export function getSession() {
  const session = sessionStorage.getItem('gw_session');
  return session ? JSON.parse(session) : null;
}

// Déconnexion
export function logout() {
  sessionStorage.removeItem('gw_session');
}

// Vérifie si connecté
export function isAuthenticated() {
  return getSession() !== null;
}