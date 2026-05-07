// ============================================================
// Lecture données Google Sheets
// Le "pont" entre le site React et la base de données
// ============================================================

const SHEET_ID = '13iCzlEuJXbRq3uk9NzakqSiGisqsZ2a3x4Q5ruWIcOc';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

// Fonction générique pour lire un onglet du Sheet
async function lireOnglet(onglet, plage) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${onglet}!${plage}?key=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.values || [];
}

// ─────────────────────────────────────────
// Publications
// ─────────────────────────────────────────
export async function getPublications() {
  const rows = await lireOnglet('Publications', 'A2:R10000');
  
  return rows
    .filter(row => row[0] && row[0] !== 'yt_EXEMPLE123') // ignore ligne exemple
    .map(row => ({
      content_id:        row[0]  || '',
      date:              row[1]  || '',
      plateforme:        row[2]  || '',
      createur:          row[3]  || '',
      compte:            row[4]  || '',
      lien:              row[5]  || '',
      type_contenu:      row[6]  || '',
      titre_texte:       row[7]  || '',
      vues:              parseInt(row[8])  || 0,
      likes:             parseInt(row[9])  || 0,
      commentaires:      parseInt(row[10]) || 0,
      shares:            parseInt(row[11]) || 0,
      impressions:       parseInt(row[12]) || 0,
      engagement_total:  parseInt(row[13]) || 0,
      jeu:               row[14] || '',
      sponsors_detectes: parseSponsors(row[15]),
      a_verifier:        row[16] === 'TRUE',
      last_synced_at:    row[17] || '',
    }));
}

// ─────────────────────────────────────────
// Lives
// ─────────────────────────────────────────
export async function getLives() {
  const rows = await lireOnglet('Lives', 'A2:U10000');
  
  return rows
    .filter(row => row[0])
    .map(row => ({
      live_id:                    row[0]  || '',
      date:                       row[1]  || '',
      streamer:                   row[2]  || '',
      discord_author:             row[3]  || '',
      jeu:                        row[4]  || '',
      event:                      row[5]  || '',
      duree_minutes:              parseInt(row[6])  || 0,
      twitch_heures_vues:         parseInt(row[7])  || 0,
      twitch_spectateurs_uniques: parseInt(row[8])  || 0,
      twitch_peak:                parseInt(row[9])  || 0,
      twitch_avg:                 parseInt(row[10]) || 0,
      tiktok_heures_vues:         parseInt(row[11]) || 0,
      tiktok_spectateurs_uniques: parseInt(row[12]) || 0,
      tiktok_peak:                parseInt(row[13]) || 0,
      tiktok_avg:                 parseInt(row[14]) || 0,
      sponsors_detectes:          parseSponsors(row[15]),
      source_twitch_url:          row[16] || '',
      source_tiktok_url:          row[17] || '',
      auto_linked:                row[18] === 'TRUE',
      validation_status:          row[19] || '',
      last_synced_at:             row[20] || '',
    }));
}

// ─────────────────────────────────────────
// Filtre les publications par sponsor
// ─────────────────────────────────────────
export function filtrerParSponsor(publications, sponsorName) {
  if (!sponsorName || sponsorName === 'tous') return publications;
  
  return publications.filter(pub => 
    pub.sponsors_detectes.some(s => 
      s.sponsor.toLowerCase() === sponsorName.toLowerCase()
    )
  );
}

// ─────────────────────────────────────────
// Filtre les publications par période
// ─────────────────────────────────────────
export function filtrerParPeriode(publications, dateDebut, dateFin) {
  return publications.filter(pub => {
    const date = new Date(pub.date);
    const debut = dateDebut ? new Date(dateDebut) : null;
    const fin   = dateFin   ? new Date(dateFin)   : null;
    if (debut && date < debut) return false;
    if (fin   && date > fin)   return false;
    return true;
  });
}

// ─────────────────────────────────────────
// Calcule les KPIs pour un sponsor
// ─────────────────────────────────────────
export function calculerKPIs(publications, lives) {
  const totalContenus    = publications.length;
  const totalVues        = publications.reduce((s, p) => s + p.vues, 0);
  const totalLikes       = publications.reduce((s, p) => s + p.likes, 0);
  const totalCommentaires= publications.reduce((s, p) => s + p.commentaires, 0);
  const totalShares      = publications.reduce((s, p) => s + p.shares, 0);
  const totalEngagement  = publications.reduce((s, p) => s + p.engagement_total, 0);
  const totalLives       = lives.length;
  const totalHeuresVues  = lives.reduce((s, l) => s + l.twitch_heures_vues + l.tiktok_heures_vues, 0);

  const tauxEngagement = totalVues > 0 
    ? ((totalEngagement / totalVues) * 100).toFixed(1) 
    : 0;

  return {
    totalContenus,
    totalVues,
    totalLikes,
    totalCommentaires,
    totalShares,
    totalEngagement,
    totalLives,
    totalHeuresVues,
    tauxEngagement,
    portéeMoyenne: totalContenus > 0 ? Math.round(totalVues / totalContenus) : 0,
  };
}

// ─────────────────────────────────────────
// Prépare les données pour le graphique d'évolution
// ─────────────────────────────────────────
export function preparerEvolution(publications, metrique = 'vues') {
  const parDate = {};
  
  publications.forEach(pub => {
    const date = pub.date;
    if (!parDate[date]) parDate[date] = { date, vues: 0, likes: 0, engagement: 0, contenus: 0 };
    parDate[date].vues       += pub.vues;
    parDate[date].likes      += pub.likes;
    parDate[date].engagement += pub.engagement_total;
    parDate[date].contenus   += 1;
  });

  return Object.values(parDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ─────────────────────────────────────────
// Prépare les données par plateforme
// ─────────────────────────────────────────
export function preparerParPlateforme(publications) {
  const plateformes = {};
  
  publications.forEach(pub => {
    if (!plateformes[pub.plateforme]) plateformes[pub.plateforme] = 0;
    plateformes[pub.plateforme] += pub.vues || 1;
  });

  const total = Object.values(plateformes).reduce((s, v) => s + v, 0);
  
  return Object.entries(plateformes).map(([name, value]) => ({
    name,
    value,
    pourcentage: total > 0 ? Math.round((value / total) * 100) : 0,
  })).sort((a, b) => b.value - a.value);
}

// ─────────────────────────────────────────
// Prépare les données par créateur
// ─────────────────────────────────────────
export function preparerParCreateur(publications) {
  const createurs = {};
  
  publications.forEach(pub => {
    if (!createurs[pub.createur]) createurs[pub.createur] = 0;
    createurs[pub.createur] += pub.vues || 1;
  });

  const total = Object.values(createurs).reduce((s, v) => s + v, 0);

  return Object.entries(createurs).map(([name, value]) => ({
    name,
    value,
    pourcentage: total > 0 ? Math.round((value / total) * 100) : 0,
  })).sort((a, b) => b.value - a.value);
}

// ─────────────────────────────────────────
// Formate les grands nombres (ex: 284000 → "284k")
// ─────────────────────────────────────────
export function formatNombre(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

// ─────────────────────────────────────────
// Parse le JSON des sponsors détectés
// ─────────────────────────────────────────
function parseSponsors(str) {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}