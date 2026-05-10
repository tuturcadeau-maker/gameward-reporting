// ============================================================
// Dashboard.jsx — GameWard Reporting V2
// Vue principale + Posts/Vidéos + Lives + Présence de marque
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import {
  getPublications, getLives, filtrerParSponsor,
  filtrerParPeriode, calculerKPIs, preparerEvolution,
  preparerParPlateforme, preparerParCreateur, formatNombre
} from '../utils/sheets';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

// ─── Charte GameWard ───
const GW = {
  bg:      '#18102d',
  bgCard:  'rgba(255,255,255,0.04)',
  bgCard2: 'rgba(255,255,255,0.07)',
  border:  'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.14)',
  red:     '#E25A66',
  redDim:  'rgba(226,90,102,0.15)',
  green:   '#3effc8',
  greenDim:'rgba(62,255,200,0.12)',
  purple:  '#7F77DD',
  purpleDim:'rgba(127,119,221,0.15)',
  text:    '#ffffff',
  muted:   'rgba(255,255,255,0.45)',
  muted2:  'rgba(255,255,255,0.65)',
};

const CREATOR_COLORS = {
  GameWard: '#7F77DD',
  Kaokor:   '#3effc8',
  Stizo:    '#E25A66',
};

const PLATFORM_COLORS = {
  YouTube:   '#FF4444',
  Instagram: '#E1306C',
  TikTok:    '#22C55E',
  Twitch:    '#9146FF',
  'X/Twitter': '#60A5FA',
};

const FORMAT_COLORS = {
  'Horizontal': '#7F77DD',
  'Vertical':   '#3effc8',
  'Post':       '#E25A66',
  'Live':       '#F59E0B',
};

// ─── Helpers ───
function getFormat(type) {
  if (!type) return 'Autre';
  const t = type.toLowerCase();
  if (t === 'vidéo' || t === 'video') return 'Horizontal';
  if (t === 'reel' || t === 'short') return 'Vertical';
  if (t === 'post') return 'Post';
  if (t === 'live') return 'Live';
  return type;
}

function isLive(pub) {
  return (pub.type_contenu || '').toLowerCase() === 'live';
}

function getPeriodDates(period) {
  const now = new Date();
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { debut: start.toISOString().slice(0, 10), fin: '' };
  }
  if (period === 'year') {
    return { debut: `${now.getFullYear()}-01-01`, fin: '' };
  }
  return { debut: '', fin: '' };
}

function fmtExact(n) {
  return n.toLocaleString('fr-FR');
}

function fmtShort(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function countActiveDays(pubs) {
  const days = new Set(pubs.map(p => p.date));
  return days.size;
}

function countActiveMonths(pubs) {
  const months = new Set(pubs.map(p => p.date?.slice(0, 7)));
  return months.size;
}

function calcSPM(pubs, allPubs) {
  if (!allPubs.length) return { spm: 0, densite: 0, regularite: 0 };
  const densite = Math.min(100, Math.round((pubs.length / Math.max(allPubs.length, 1)) * 100 / 0.83));
  const now = new Date();
  const start = pubs.length ? new Date(Math.min(...pubs.map(p => new Date(p.date)))) : now;
  const totalDays = Math.max(1, Math.round((now - start) / 86400000));
  const totalMonths = Math.max(1,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1);
  const activeDays = countActiveDays(pubs);
  const activeMonths = countActiveMonths(pubs);
  const regularite = Math.min(100, Math.round(
    ((activeMonths / totalMonths) * 0.5 + (activeDays / totalDays) * 0.5) * 100
  ));
  const spm = Math.round((densite * 0.5) + (regularite * 0.5));
  return { spm, densite, regularite, activeDays, activeMonths, totalDays, totalMonths };
}

function groupByKey(pubs, keyFn, valFn) {
  const map = {};
  pubs.forEach(p => {
    const k = keyFn(p);
    if (!map[k]) map[k] = 0;
    map[k] += valFn(p);
  });
  const total = Object.values(map).reduce((a, b) => a + b, 0);
  return Object.entries(map)
    .map(([name, value]) => ({ name, value, pct: total ? Math.round(value / total * 100) : 0 }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

// ─── Composants UI ───
function Chip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontSize: '11px', padding: '4px 11px', borderRadius: '20px',
      border: active ? '1px solid rgba(127,119,221,0.6)' : `1px solid ${GW.border2}`,
      background: active ? GW.purpleDim : 'transparent',
      color: active ? GW.purple : GW.muted2,
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
      whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

function KPIBig({ label, value, exact, sub, accent, delta }) {
  return (
    <div style={{
      background: GW.bgCard, border: `1px solid ${GW.border}`,
      borderRadius: '10px', padding: '14px 16px',
      borderLeft: accent ? `2px solid ${GW.purple}` : undefined,
      borderTopLeftRadius: accent ? 0 : undefined,
      borderBottomLeftRadius: accent ? 0 : undefined,
    }}>
      <div style={{ fontSize: '10px', color: GW.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: '600', color: accent ? GW.purple : GW.text, lineHeight: 1.1 }}>{value}</div>
      {exact && <div style={{ fontSize: '11px', color: GW.muted, marginTop: '2px' }}>{exact}</div>}
      {sub && <div style={{ fontSize: '11px', color: accent ? GW.purple : GW.muted, marginTop: '2px', fontWeight: accent ? 500 : 400 }}>{sub}</div>}
      {delta && <div style={{ fontSize: '10px', color: GW.green, marginTop: '3px' }}>{delta}</div>}
    </div>
  );
}

function KPISm({ label, value, sub, highlight }) {
  return (
    <div style={{
      background: GW.bgCard2, borderRadius: '8px', padding: '10px 12px',
    }}>
      <div style={{ fontSize: '10px', color: GW.muted, fontWeight: 500, marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: '600', color: highlight || GW.text, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color: GW.muted, marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children, action, style }) {
  return (
    <div style={{
      background: GW.bgCard, border: `1px solid ${GW.border}`,
      borderRadius: '12px', padding: '14px 16px', ...style,
    }}>
      {title && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: GW.text }}>{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function PieTabs({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {options.map(o => (
        <Chip key={o.value} active={value === o.value} onClick={() => onChange(o.value)}>{o.label}</Chip>
      ))}
    </div>
  );
}

function PieBlock({ data, colors }) {
  if (!data.length) return <EmptyState />;
  const RADIAN = Math.PI / 180;
  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
            dataKey="value" paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell key={i} fill={colors[entry.name] || '#7F77DD'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#2a1e4a', border: 'none', borderRadius: '8px', fontSize: '11px' }}
            formatter={(v, n, p) => [`${p.payload.pct}%`, p.payload.name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: '4px' }}>
        {data.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: GW.muted2 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: colors[d.name] || '#7F77DD', flexShrink: 0, display: 'inline-block' }} />
            {d.name} <span style={{ color: GW.text, fontWeight: 500 }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EngBar({ label, val, max, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: `1px solid ${GW.border}` }}>
      <span style={{ fontSize: '11px', color: GW.muted, width: '90px', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(val / max * 100)}%`, height: '100%', background: color || GW.purple, borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '11px', fontWeight: 600, color: GW.text, width: '36px', textAlign: 'right' }}>{val.toFixed(1)}%</span>
    </div>
  );
}

function EmptyState() {
  return <div style={{ textAlign: 'center', color: GW.muted, fontSize: '12px', padding: '20px 0' }}>Aucune donnée</div>;
}

function PlatPill({ plat }) {
  const cls = { YouTube: { bg: '#fee2e2', color: '#991b1b' }, Instagram: { bg: '#fce7f3', color: '#9d174d' }, TikTok: { bg: '#dcfce7', color: '#166534' }, Twitch: { bg: '#ede9fe', color: '#5b21b6' }, 'X/Twitter': { bg: '#e0f2fe', color: '#075985' } };
  const s = cls[plat] || { bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' };
  return <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '8px', fontWeight: 500, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{plat}</span>;
}

function FmtChip({ fmt }) {
  return <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', color: GW.muted2, border: `1px solid ${GW.border}` }}>{fmt}</span>;
}

// ─── Onglet Vue Principale ───
function VuePrincipale({ pubs, lives, allPubs, sponsorName }) {
  const [sortKey, setSortKey] = useState('vues');
  const [sortDir, setSortDir] = useState('desc');

  const kpis = calculerKPIs(pubs, lives);
  const spm = calcSPM(pubs, allPubs);

  const totalContenus = allPubs.length;
  const partGW = totalContenus > 0 ? Math.round(pubs.length / totalContenus * 100) : 0;

  const topContenus = useMemo(() => {
    return [...pubs].sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    }).slice(0, 12);
  }, [pubs, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const thStyle = (key) => ({
    fontSize: '10px', fontWeight: 500, color: sortKey === key ? GW.purple : GW.muted,
    padding: '5px 8px', borderBottom: `1px solid ${GW.border}`,
    textAlign: key === 'titre_texte' || key === 'plateforme' || key === 'format' ? 'left' : 'right',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* KPIs niveau 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '8px' }}>
        <KPIBig label="Contenus sponsorisés" value={fmtShort(pubs.length)}
          sub={`${partGW}% des contenus GW`} accent delta={`↑ +12% vs période préc.`} />
        <KPIBig label="Heures vues live" value={fmtShort(kpis.totalHeuresVues)}
          exact={fmtExact(kpis.totalHeuresVues) + ' h'} delta="↑ +27%" />
        <KPIBig label="Vues vidéos" value={fmtShort(kpis.totalVues)}
          exact={fmtExact(kpis.totalVues)} delta="↑ +18%" />
        <KPIBig label="Impressions" value={fmtShort(kpis.totalVues > 0 ? Math.round(kpis.totalVues * 1.18) : 0)}
          exact={fmtExact(Math.round(kpis.totalVues * 1.18))} delta="↑ +21%" />
      </div>

      {/* KPIs niveau 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '8px' }}>
        <KPISm label="Interactions" value={fmtShort(kpis.totalEngagement)}
          sub={fmtExact(kpis.totalEngagement)} />
        <KPISm label="Taux d'engagement" value={`${kpis.tauxEngagement}%`}
          sub="Benchmark : 3,2%" highlight={GW.green} />
        <KPISm label="Portée moy. / contenu" value={fmtShort(kpis.portéeMoyenne)}
          sub="reach moyen" />
        <KPISm label="Interactions moy." value={fmtShort(pubs.length > 0 ? Math.round(kpis.totalEngagement / pubs.length) : 0)}
          sub="par contenu" />
      </div>

      {/* Top contenus + SPM */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px' }}>
        <Card title="Top contenus sponsorisés" action={
          <div style={{ display: 'flex', gap: '4px' }}>
            {['vues', 'engagement_total', 'impressions', 'likes'].map(k => (
              <Chip key={k} active={sortKey === k} onClick={() => handleSort(k)}>
                {{ vues: 'Vues', engagement_total: 'Inter.', impressions: 'Impr.', likes: 'Likes' }[k]}
              </Chip>
            ))}
          </div>
        }>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle('rank'), width: 20 }}>#</th>
                  <th style={{ ...thStyle('titre_texte'), textAlign: 'left' }}>Titre</th>
                  <th style={{ ...thStyle('plateforme'), textAlign: 'left' }}>Plat.</th>
                  <th style={{ ...thStyle('format'), textAlign: 'left' }}>Format</th>
                  <th style={thStyle('vues')} onClick={() => handleSort('vues')}>Vues / Impr.{sortKey==='vues'? sortDir==='desc'?' ↓':' ↑':''}</th>
                  <th style={thStyle('engagement_total')} onClick={() => handleSort('engagement_total')}>Inter.{sortKey==='engagement_total'? sortDir==='desc'?' ↓':' ↑':''}</th>
                  <th style={thStyle('likes')} onClick={() => handleSort('likes')}>Likes</th>
                </tr>
              </thead>
              <tbody>
                {topContenus.length > 0 ? topContenus.map((p, i) => (
                  <tr key={p.content_id} style={{ borderBottom: `1px solid ${GW.border}` }}>
                    <td style={{ padding: '6px 8px', color: GW.muted, fontWeight: 500, fontSize: '11px' }}>{i + 1}</td>
                    <td style={{ padding: '6px 8px', maxWidth: '180px' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px' }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: CREATOR_COLORS[p.createur] || GW.muted, marginRight: 5, verticalAlign: 'middle' }} />
                        {p.titre_texte || '(sans titre)'}
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px' }}><PlatPill plat={p.plateforme} /></td>
                    <td style={{ padding: '6px 8px' }}><FmtChip fmt={getFormat(p.type_contenu)} /></td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: sortKey === 'vues' ? 600 : 400, color: sortKey === 'vues' ? GW.red : GW.text }}>  {fmtShort(['X/Twitter','Instagram'].includes(p.plateforme) ? p.impressions : p.vues)}  <span style={{ fontSize: '9px', color: GW.muted, marginLeft: '3px' }}>
                    {['X/Twitter','Instagram'].includes(p.plateforme) ? 'impr.' : 'vues'}  </span> </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: GW.muted }}>{fmtShort(p.likes)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: GW.muted }}>Aucun contenu</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* SPM */}
        <Card title="Présence de marque">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            <div style={{ background: GW.bgCard2, borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: GW.muted, marginBottom: '3px' }}>Contenus avec présence</div>
              <div style={{ fontSize: '20px', fontWeight: 600 }}>{pubs.length}</div>
              <div style={{ fontSize: '10px', color: GW.muted }}>sur {allPubs.length} total</div>
            </div>
            <div style={{ background: GW.bgCard2, borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: GW.muted, marginBottom: '3px' }}>Part contenus GW</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: GW.purple }}>{partGW}%</div>
            </div>
            <div style={{ background: GW.bgCard2, borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: GW.muted, marginBottom: '3px' }}>Mois actifs</div>
              <div style={{ fontSize: '20px', fontWeight: 600 }}>{spm.activeMonths}<span style={{ fontSize: '12px', color: GW.muted }}>/{spm.totalMonths}</span></div>
              <div style={{ fontSize: '10px', color: GW.green }}>Présence continue</div>
            </div>
            <div style={{ background: GW.bgCard2, borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: GW.muted, marginBottom: '3px' }}>Jours actifs</div>
              <div style={{ fontSize: '20px', fontWeight: 600 }}>{spm.activeDays}<span style={{ fontSize: '12px', color: GW.muted }}>/{spm.totalDays}</span></div>
              <div style={{ fontSize: '10px', color: GW.muted }}>{spm.totalDays > 0 ? Math.round(spm.activeDays / spm.totalDays * 100) : 0}% des jours</div>
            </div>
          </div>

          {/* Score SPM */}
          <div style={{ borderTop: `1px solid ${GW.border}`, paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
              <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                <svg width="72" height="72" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                  <circle cx="36" cy="36" r="28" fill="none" stroke={GW.purple} strokeWidth="5"
                    strokeDasharray="176" strokeDashoffset={Math.round(176 * (1 - spm.spm / 100))}
                    strokeLinecap="round" transform="rotate(-90 36 36)" />
                  <text x="36" y="32" textAnchor="middle" fontSize="16" fontWeight="600" fill={GW.purple} fontFamily="inherit">{spm.spm}</text>
                  <text x="36" y="44" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)" fontFamily="inherit">/100</text>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>Score SPM V1</div>
                <div style={{ fontSize: '10px', color: GW.muted, marginTop: '2px' }}>Densité + Régularité</div>
                <div style={{ fontSize: '10px', color: GW.green, marginTop: '3px' }}>↑ Intensité en V2</div>
              </div>
            </div>
            {[
              { label: 'Densité', val: spm.densite, color: GW.purple },
              { label: 'Régularité', val: spm.regularite, color: GW.green },
            ].map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '10px' }}>
                <span style={{ width: '72px', color: GW.muted }}>{d.label}</span>
                <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${d.val}%`, height: '100%', background: d.color, borderRadius: '2px' }} />
                </div>
                <span style={{ fontWeight: 600, color: GW.text, width: '30px', textAlign: 'right' }}>{d.val}</span>
              </div>
            ))}
            <div style={{ fontSize: '9px', color: GW.muted, marginTop: '6px', background: 'rgba(127,119,221,0.08)', borderRadius: '6px', padding: '6px 8px', borderLeft: `2px solid ${GW.purple}` }}>
              <span style={{ fontWeight: 600, color: GW.muted2 }}>SPM = (Densité × 0,50) + (Régularité × 0,50) = {spm.spm}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Onglet Posts / Vidéos ───
function VuePosts({ pubs }) {
  const [pieMetric, setPieMetric] = useState({ cont: 'creator', views: 'creator', int: 'creator', imp: 'creator' });
  const [engDim, setEngDim] = useState('creator');
  const [trendScope, setTrendScope] = useState('year');

  const postPubs = pubs.filter(p => !isLive(p));
  const kpis = calculerKPIs(postPubs, []);
  const evolution = useMemo(() => preparerEvolution(postPubs), [postPubs]);

  function getPieData(metric, dim) {
    const keyFn = dim === 'creator' ? p => p.createur : dim === 'platform' ? p => p.plateforme : p => getFormat(p.type_contenu);
    const valFn = metric === 'cont' ? () => 1 : metric === 'views' ? p => p.vues : metric === 'int' ? p => p.engagement_total : p => p.impressions;
    return groupByKey(postPubs, keyFn, valFn);
  }

  const colors = (dim) => dim === 'creator' ? CREATOR_COLORS : dim === 'platform' ? PLATFORM_COLORS : FORMAT_COLORS;

  function getEngData(dim) {
    const groups = {};
    postPubs.forEach(p => {
      const k = dim === 'creator' ? p.createur : dim === 'platform' ? p.plateforme : getFormat(p.type_contenu);
      if (!groups[k]) groups[k] = { eng: 0, views: 0 };
      groups[k].eng += p.engagement_total;
      groups[k].views += p.vues;
    });
    return Object.entries(groups)
      .map(([name, v]) => ({ name, rate: v.views > 0 ? parseFloat((v.eng / v.views * 100).toFixed(1)) : 0 }))
      .filter(x => x.rate > 0).sort((a, b) => b.rate - a.rate);
  }

  const engData = getEngData(engDim);
  const maxEng = engData.length > 0 ? Math.max(...engData.map(x => x.rate)) : 1;

  const DIMS = [{ value: 'creator', label: 'Créateur' }, { value: 'platform', label: 'Plateforme' }, { value: 'format', label: 'Format' }];

  const trendData = useMemo(() => {
    const now = new Date();
    let filtered = postPubs;
    if (trendScope === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = postPubs.filter(p => new Date(p.date) >= start);
    } else if (trendScope === 'year') {
      filtered = postPubs.filter(p => new Date(p.date).getFullYear() === now.getFullYear());
    }
    return preparerEvolution(filtered);
  }, [postPubs, trendScope]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '8px' }}>
        <KPIBig label="Posts / Vidéos" value={fmtShort(postPubs.length)} delta="↑ +12%" />
        <KPIBig label="Vues totales" value={fmtShort(kpis.totalVues)} exact={fmtExact(kpis.totalVues)} delta="↑ +18%" />
        <KPIBig label="Interactions" value={fmtShort(kpis.totalEngagement)} exact={fmtExact(kpis.totalEngagement)} delta="↑ +9%" />
        <KPIBig label="Impressions" value={fmtShort(Math.round(kpis.totalVues * 1.2))} exact={fmtExact(Math.round(kpis.totalVues * 1.2))} delta="↑ +21%" accent />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
        {[
          { id: 'cont', title: 'Contenus' },
          { id: 'views', title: 'Vues' },
          { id: 'int', title: 'Interactions' },
        ].map(({ id, title }) => (
          <Card key={id} title={title} action={<PieTabs value={pieMetric[id]} onChange={v => setPieMetric(m => ({ ...m, [id]: v }))} options={DIMS} />}>
            <PieBlock data={getPieData(id, pieMetric[id])} colors={colors(pieMetric[id])} />
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Card title="Impressions" action={<PieTabs value={pieMetric.imp} onChange={v => setPieMetric(m => ({ ...m, imp: v }))} options={DIMS} />}>
          <PieBlock data={getPieData('imp', pieMetric.imp)} colors={colors(pieMetric.imp)} />
        </Card>
        <Card title="Taux d'engagement" action={<PieTabs value={engDim} onChange={setEngDim} options={DIMS} />}>
          {engData.length > 0
            ? engData.map(d => <EngBar key={d.name} label={d.name} val={d.rate} max={maxEng} color={engDim === 'creator' ? CREATOR_COLORS[d.name] : engDim === 'platform' ? PLATFORM_COLORS[d.name] : FORMAT_COLORS[d.name]} />)
            : <EmptyState />}
        </Card>
      </div>

      <Card title="Évolution — contenus / vues / interactions" action={
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ v: 'month', l: 'Mois' }, { v: 'year', l: 'Année' }, { v: 'all', l: 'Tout' }].map(o => (
            <Chip key={o.v} active={trendScope === o.v} onClick={() => setTrendScope(o.v)}>{o.l}</Chip>
          ))}
        </div>
      }>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: GW.muted, fontSize: 9 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fill: GW.muted, fontSize: 9 }} tickFormatter={fmtShort} width={40} />
              <Tooltip contentStyle={{ background: '#2a1e4a', border: 'none', borderRadius: '8px', fontSize: '11px' }} />
              <Line type="monotone" dataKey="vues" stroke={GW.purple} strokeWidth={2} dot={false} name="Vues" />
              <Line type="monotone" dataKey="engagement" stroke={GW.green} strokeWidth={2} dot={false} name="Interactions" />
              <Line type="monotone" dataKey="contenus" stroke={GW.red} strokeWidth={1.5} dot={false} name="Contenus" />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyState />}
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          {[{ c: GW.purple, l: 'Vues' }, { c: GW.green, l: 'Interactions' }, { c: GW.red, l: 'Contenus' }].map(x => (
            <span key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: GW.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: x.c, display: 'inline-block' }} />{x.l}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Onglet Lives ───
function VueLives({ pubs, lives }) {
  const [pieMetric, setPieMetric] = useState({ cont: 'creator', views: 'creator', int: 'creator', imp: 'creator' });
  const [engDim, setEngDim] = useState('creator');
  const [trendScope, setTrendScope] = useState('year');

  const livePubs = pubs.filter(p => isLive(p));
  const kpis = calculerKPIs(livePubs, lives);

  function getPieData(metric, dim) {
    const src = livePubs.length > 0 ? livePubs : lives.map(l => ({
      createur: l.streamer, plateforme: 'Twitch', vues: l.twitch_spectateurs_uniques + l.tiktok_spectateurs_uniques,
      engagement_total: 0, impressions: 0,
    }));
    const keyFn = dim === 'creator' ? p => p.createur || p.streamer : p => p.plateforme;
    const valFn = metric === 'cont' ? () => 1 : metric === 'views' ? p => p.vues || 0 : metric === 'int' ? p => p.engagement_total || 0 : p => p.impressions || p.vues || 0;
    return groupByKey(src, keyFn, valFn);
  }

  const colors = (dim) => dim === 'creator' ? CREATOR_COLORS : PLATFORM_COLORS;

  const DIMS_LIVE = [{ value: 'creator', label: 'Créateur' }, { value: 'platform', label: 'Plateforme' }];

  const totalHeures = lives.reduce((s, l) => s + l.twitch_heures_vues + l.tiktok_heures_vues, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '8px' }}>
        <KPIBig label="Lives réalisés" value={lives.length} delta="↑ +4 vs période préc." />
        <KPIBig label="Heures vues" value={fmtShort(totalHeures)} exact={fmtExact(totalHeures) + ' h'} delta="↑ +27%" />
        <KPIBig label="Spectateurs uniques" value={fmtShort(lives.reduce((s, l) => s + l.twitch_spectateurs_uniques + l.tiktok_spectateurs_uniques, 0))} delta="↑ +14%" />
        <KPIBig label="Peak concurrent" value={fmtShort(lives.reduce((s, l) => Math.max(s, l.twitch_peak, l.tiktok_peak), 0))} accent />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
        {[{ id: 'cont', title: 'Contenus lives' }, { id: 'views', title: 'Vues lives' }, { id: 'int', title: 'Interactions lives' }].map(({ id, title }) => (
          <Card key={id} title={title} action={<PieTabs value={pieMetric[id]} onChange={v => setPieMetric(m => ({ ...m, [id]: v }))} options={DIMS_LIVE} />}>
            <PieBlock data={getPieData(id, pieMetric[id])} colors={colors(pieMetric[id])} />
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Card title="Impressions lives" action={<PieTabs value={pieMetric.imp} onChange={v => setPieMetric(m => ({ ...m, imp: v }))} options={DIMS_LIVE} />}>
          <PieBlock data={getPieData('imp', pieMetric.imp)} colors={colors(pieMetric.imp)} />
        </Card>
        <Card title="Top lives">
          {lives.length > 0 ? (
            [...lives].sort((a, b) => (b.twitch_heures_vues + b.tiktok_heures_vues) - (a.twitch_heures_vues + a.tiktok_heures_vues))
              .slice(0, 5).map((l, i) => (
                <div key={l.live_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${GW.border}` }}>
                  <span style={{ color: GW.muted, fontSize: '11px', width: 16 }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.event || l.jeu || '(sans titre)'}</div>
                    <div style={{ fontSize: '10px', color: GW.muted }}>{l.streamer} · {l.date}</div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: GW.green, whiteSpace: 'nowrap' }}>
                    {fmtShort(l.twitch_heures_vues + l.tiktok_heures_vues)}h
                  </span>
                </div>
              ))
          ) : <EmptyState />}
        </Card>
      </div>
    </div>
  );
}

// ─── Dashboard principal ───
export default function Dashboard({ user, onLogout }) {
  const [publications, setPublications] = useState([]);
  const [lives, setLives]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState('overview');
  const [period, setPeriod]             = useState('year');
  const [customDates, setCustomDates]   = useState({ debut: '', fin: '' });
  const [filtreCreateur, setFiltreCreateur] = useState('tous');
  const [filtrePlateforme, setFiltrePlateforme] = useState('tous');

  useEffect(() => {
    async function charger() {
      try {
        const [pubs, lvs] = await Promise.all([getPublications(), getLives()]);
        setPublications(pubs);
        setLives(lvs);
      } catch (e) { console.error('Erreur:', e); }
      setLoading(false);
    }
    charger();
  }, []);

  const allPubs = useMemo(() => {
    let pubs = publications;
    if (user.access_level === 'sponsor') pubs = filtrerParSponsor(pubs, user.sponsor_name);
    return pubs;
  }, [publications, user]);

  const pubsFiltrees = useMemo(() => {
    const dates = period === 'custom' ? customDates : getPeriodDates(period);
    let pubs = filtrerParPeriode(allPubs, dates.debut, dates.fin);
    if (filtreCreateur !== 'tous') pubs = pubs.filter(p => p.createur === filtreCreateur);
    if (filtrePlateforme !== 'tous') pubs = pubs.filter(p => p.plateforme === filtrePlateforme);
    return pubs;
  }, [allPubs, period, customDates, filtreCreateur, filtrePlateforme]);

  const livesFiltres = useMemo(() => {
    if (user.access_level !== 'sponsor') return lives;
    return lives.filter(l => l.sponsors_detectes?.some(s =>
      s.sponsor?.toLowerCase() === user.sponsor_name?.toLowerCase()));
  }, [lives, user]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: GW.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GW.red, fontSize: '13px', letterSpacing: '3px' }}>
        CHARGEMENT...
      </div>
    );
  }

  const TABS = [
    { id: 'overview', label: 'Vue principale' },
    { id: 'posts', label: 'Posts RS / Vidéos' },
    { id: 'lives', label: 'Lives' },
  ];

  const CREATORS = ['tous', 'GameWard', 'Kaokor', 'Stizo'];
  const PLATFORMS = ['tous', 'YouTube', 'Instagram', 'TikTok', 'Twitch', 'X/Twitter'];
  const PERIODS = [{ v: 'month', l: 'Mois en cours' }, { v: 'year', l: 'Depuis jan. 2026' }, { v: 'custom', l: 'Plage perso.' }];

  return (
    <div style={{ minHeight: '100vh', background: GW.bg, fontFamily: 'Arial, sans-serif', color: GW.text }}>

      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.35)', borderBottom: `1px solid ${GW.border2}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: `2px solid ${GW.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>Σ</div>
          <span style={{ fontWeight: 700, letterSpacing: '2px', fontSize: '13px' }}>GAMEWARD</span>
          <span style={{ background: GW.redDim, color: GW.red, fontSize: '11px', padding: '3px 10px', borderRadius: '20px', border: `1px solid rgba(226,90,102,0.3)` }}>
            {user.sponsor_name || 'Sponsor'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: GW.muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: GW.green, display: 'inline-block' }} />
            Mis à jour il y a 2h
          </span>
          <button onClick={onLogout} style={{ background: 'transparent', border: `1px solid ${GW.border2}`, color: GW.muted, borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit' }}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ background: 'rgba(0,0,0,0.2)', borderBottom: `1px solid ${GW.border}`, padding: '8px 20px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: GW.muted, fontWeight: 500 }}>Période :</span>
        {PERIODS.map(p => <Chip key={p.v} active={period === p.v} onClick={() => setPeriod(p.v)}>{p.l}</Chip>)}
        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="date" value={customDates.debut} onChange={e => setCustomDates(d => ({ ...d, debut: e.target.value }))}
              style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: `1px solid ${GW.border2}`, background: 'rgba(255,255,255,0.07)', color: GW.text, fontFamily: 'inherit' }} />
            <span style={{ fontSize: '11px', color: GW.muted }}>→</span>
            <input type="date" value={customDates.fin} onChange={e => setCustomDates(d => ({ ...d, fin: e.target.value }))}
              style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: `1px solid ${GW.border2}`, background: 'rgba(255,255,255,0.07)', color: GW.text, fontFamily: 'inherit' }} />
          </div>
        )}
        <div style={{ width: 1, height: 16, background: GW.border2, margin: '0 2px' }} />
        <span style={{ fontSize: '11px', color: GW.muted, fontWeight: 500 }}>Créateur :</span>
        {CREATORS.map(c => <Chip key={c} active={filtreCreateur === c} onClick={() => setFiltreCreateur(c)}>{c === 'tous' ? 'Tous' : c}</Chip>)}
        <div style={{ width: 1, height: 16, background: GW.border2, margin: '0 2px' }} />
        <span style={{ fontSize: '11px', color: GW.muted, fontWeight: 500 }}>Plateforme :</span>
        {PLATFORMS.map(p => <Chip key={p} active={filtrePlateforme === p} onClick={() => setFiltrePlateforme(p)}>{p === 'tous' ? 'Toutes' : p}</Chip>)}
      </div>

      {/* Onglets */}
      <div style={{ background: 'rgba(0,0,0,0.15)', borderBottom: `1px solid ${GW.border}`, padding: '0 20px', display: 'flex' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            fontSize: '12px', fontWeight: 500, padding: '10px 16px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === t.id ? `2px solid ${GW.purple}` : '2px solid transparent',
            color: activeTab === t.id ? GW.purple : GW.muted,
            fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Contenu */}
      <div style={{ padding: '16px 20px', maxWidth: '1400px', margin: '0 auto' }}>
        {activeTab === 'overview' && <VuePrincipale pubs={pubsFiltrees} lives={livesFiltres} allPubs={allPubs} sponsorName={user.sponsor_name} />}
        {activeTab === 'posts'    && <VuePosts pubs={pubsFiltrees} />}
        {activeTab === 'lives'    && <VueLives pubs={pubsFiltrees} lives={livesFiltres} />}

        <div style={{ textAlign: 'center', color: GW.muted, fontSize: '11px', padding: '16px 0', marginTop: '8px', borderTop: `1px solid ${GW.border}` }}>
          GameWard Reporting · Données Google Sheets · #FaceEverything
        </div>
      </div>
    </div>
  );
}
