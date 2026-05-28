// dashboard/js/sections/origine.js
// Carte mondiale interactive des membres WARSTACK

import { fetchSupabase } from '../api.js';

const COUNTRY_COORDS = {
  FR: [46.2276, 2.2137],   BE: [50.5039, 4.4699],   CH: [46.8182, 8.2275],
  CA: [56.1304, -106.347], MA: [31.7917, -7.0926],  DZ: [28.0339, 1.6596],
  TN: [33.8869, 9.5375],   US: [37.0902, -95.7129], GB: [55.3781, -3.4360],
  DE: [51.1657, 10.4515],  ES: [40.4637, -3.7492],  IT: [41.8719, 12.5674],
  PT: [39.3999, -8.2245],  NL: [52.1326, 5.2913],   AU: [-25.274, 133.775],
  BR: [-14.235, -51.925],  MX: [23.6345, -102.552], JP: [36.2048, 138.253],
  SN: [14.4974, -14.4524], CI: [7.5400, -5.5471],   XX: [20, 0],
};

function getFlag(code) {
  if (!code || code === 'XX') return '🌍';
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0))
  );
}

let _allPlayers = [];

export async function initOrigine() {
  const players = await fetchSupabase(
    'players?select=discord_id,username,pseudo_bf6,avatar_url,country,country_code,region,city&country_code=not.is.null'
  );
  _allPlayers = Array.isArray(players) ? players : [];

  renderStats();
  initTabs();
  await renderMap();
  renderCountriesList();
  renderMembersList(_allPlayers);
  initSearch();
}

function renderStats() {
  const pays  = new Set(_allPlayers.map(p => p.country_code).filter(Boolean));
  const villes= new Set(_allPlayers.map(p => p.city).filter(Boolean));
  document.getElementById('origine-stats-row').innerHTML = `
    <div class="origine-stat-card">
      <div class="origine-stat-value">${_allPlayers.length}</div>
      <div class="origine-stat-label">Membres localisés</div>
    </div>
    <div class="origine-stat-card">
      <div class="origine-stat-value">${pays.size}</div>
      <div class="origine-stat-label">Pays représentés</div>
    </div>
    <div class="origine-stat-card">
      <div class="origine-stat-value">${villes.size}</div>
      <div class="origine-stat-label">Villes</div>
    </div>
  `;
}

function initTabs() {
  document.querySelectorAll('.origine-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.origine-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.origine-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

async function renderMap() {
  const container = document.getElementById('world-map');
  if (!container) return;

  const byCountry = {};
  _allPlayers.forEach(p => {
    if (!p.country_code) return;
    if (!byCountry[p.country_code]) byCountry[p.country_code] = [];
    byCountry[p.country_code].push(p);
  });

  const tooltip = document.getElementById('origine-tooltip');
  const W = 800, H = 420;

  function toXY(lat, lon) {
    return [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
  }

  const pins = Object.entries(byCountry).map(([code, members]) => {
    const coords = COUNTRY_COORDS[code];
    if (!coords) return '';
    const [x, y] = toXY(coords[0], coords[1]);
    return `
      <g class="map-pin" data-code="${code}" transform="translate(${x},${y})">
        <circle class="map-pin-ring" r="10"/>
        <circle class="map-pin-dot" r="5"/>
        ${members.length > 1 ? `<text x="0" y="-10" text-anchor="middle" font-size="10" fill="rgba(0,255,120,.9)" font-weight="700" style="pointer-events:none">${members.length}</text>` : ''}
      </g>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
      <rect width="${W}" height="${H}" fill="rgba(0,20,10,.8)"/>
      ${Array.from({length:7},(_,i)=>`<line x1="0" y1="${(i+1)*H/8}" x2="${W}" y2="${(i+1)*H/8}" stroke="rgba(0,255,120,.04)" stroke-width="0.5"/>`).join('')}
      ${Array.from({length:11},(_,i)=>`<line x1="${(i+1)*W/12}" y1="0" x2="${(i+1)*W/12}" y2="${H}" stroke="rgba(0,255,120,.04)" stroke-width="0.5"/>`).join('')}
      <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="rgba(0,255,120,.08)" stroke-width="1" stroke-dasharray="4 4"/>
      <path d="M370,80 L420,70 L440,90 L430,120 L400,130 L375,115 Z" fill="rgba(0,255,120,.08)" stroke="rgba(0,255,120,.12)" stroke-width="0.5"/>
      <path d="M390,140 L430,135 L450,180 L430,250 L395,255 L375,210 L380,165 Z" fill="rgba(0,255,120,.07)" stroke="rgba(0,255,120,.1)" stroke-width="0.5"/>
      <path d="M100,60 L200,50 L220,100 L180,150 L120,160 L80,120 Z" fill="rgba(0,255,120,.07)" stroke="rgba(0,255,120,.1)" stroke-width="0.5"/>
      <path d="M180,170 L230,165 L240,240 L200,290 L165,270 L155,210 Z" fill="rgba(0,255,120,.07)" stroke="rgba(0,255,120,.1)" stroke-width="0.5"/>
      <path d="M450,60 L650,55 L680,100 L660,140 L580,150 L500,130 L445,100 Z" fill="rgba(0,255,120,.07)" stroke="rgba(0,255,120,.1)" stroke-width="0.5"/>
      <path d="M610,230 L680,220 L700,260 L660,280 L610,265 Z" fill="rgba(0,255,120,.06)" stroke="rgba(0,255,120,.09)" stroke-width="0.5"/>
      <text x="155" y="115" text-anchor="middle" font-size="8" fill="rgba(0,255,120,.25)" letter-spacing="2">AMÉR. NORD</text>
      <text x="200" y="230" text-anchor="middle" font-size="8" fill="rgba(0,255,120,.25)" letter-spacing="2">AMÉR. SUD</text>
      <text x="400" y="100" text-anchor="middle" font-size="8" fill="rgba(0,255,120,.25)" letter-spacing="2">EUROPE</text>
      <text x="410" y="200" text-anchor="middle" font-size="8" fill="rgba(0,255,120,.25)" letter-spacing="2">AFRIQUE</text>
      <text x="570" y="100" text-anchor="middle" font-size="8" fill="rgba(0,255,120,.25)" letter-spacing="2">ASIE</text>
      <text x="655" y="252" text-anchor="middle" font-size="8" fill="rgba(0,255,120,.25)" letter-spacing="2">OCÉANIE</text>
      ${pins}
    </svg>
  `;

  container.querySelectorAll('.map-pin').forEach(pin => {
    const code    = pin.dataset.code;
    const members = byCountry[code] || [];
    pin.addEventListener('mouseenter', e => {
      tooltip.innerHTML = `
        <div class="tooltip-country">${getFlag(code)} ${members[0]?.country || code}</div>
        ${members.slice(0,5).map(m => `
          <div class="tooltip-member">
            ${m.avatar_url ? `<img src="${m.avatar_url}" alt="">` : '<i class="fas fa-user" style="width:20px;text-align:center;color:var(--green-dim)"></i>'}
            ${m.username || m.discord_id}
            ${m.city ? `<span style="color:var(--text-muted);font-size:9px">— ${m.city}</span>` : ''}
          </div>`).join('')}
        ${members.length > 5 ? `<div style="font-size:10px;color:var(--text-muted);margin-top:4px">+${members.length-5} autres</div>` : ''}
      `;
      tooltip.classList.add('visible');
    });
    pin.addEventListener('mousemove', e => {
      tooltip.style.left = `${e.clientX+14}px`;
      tooltip.style.top  = `${e.clientY-10}px`;
    });
    pin.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
  });
}

function renderCountriesList() {
  const container = document.getElementById('countries-list');
  if (!container) return;
  const byCountry = {};
  _allPlayers.forEach(p => {
    if (!p.country_code) return;
    if (!byCountry[p.country_code]) byCountry[p.country_code] = { name: p.country, code: p.country_code, count: 0 };
    byCountry[p.country_code].count++;
  });
  const sorted = Object.values(byCountry).sort((a,b) => b.count - a.count);
  const max = sorted[0]?.count || 1;
  if (!sorted.length) {
    container.innerHTML = `<div class="origine-loading">Aucun membre localisé. Utilisez /origine sur Discord !</div>`;
    return;
  }
  container.innerHTML = sorted.map(c => `
    <div class="origine-country-row">
      <div class="origine-country-flag">${getFlag(c.code)}</div>
      <div class="origine-country-info">
        <div class="origine-country-name">${c.name}</div>
        <div class="origine-country-members">${c.count} membre${c.count>1?'s':''}</div>
      </div>
      <div class="origine-country-bar-wrap">
        <div class="origine-country-bar" style="width:${(c.count/max)*100}%"></div>
      </div>
      <div class="origine-country-count">${c.count}</div>
    </div>
  `).join('');
}

function renderMembersList(players) {
  const container = document.getElementById('origine-members-list');
  if (!container) return;
  if (!players?.length) {
    container.innerHTML = `<div class="origine-loading">Aucun membre localisé.</div>`;
    return;
  }
  container.innerHTML = players.map(p => {
    const location = [p.city, p.region, p.country].filter(Boolean).join(', ');
    return `
      <div class="origine-member-card">
        ${p.avatar_url
          ? `<img class="origine-member-avatar" src="${p.avatar_url}" alt="">`
          : `<div class="origine-member-avatar-placeholder"><i class="fas fa-user"></i></div>`}
        <div class="origine-member-info">
          <div class="origine-member-name">${p.username || p.discord_id}</div>
          <div class="origine-member-location">${location || '—'}</div>
        </div>
        <div class="origine-member-flag">${getFlag(p.country_code)}</div>
      </div>
    `;
  }).join('');
}

function initSearch() {
  document.getElementById('origine-member-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) { renderMembersList(_allPlayers); return; }
    renderMembersList(_allPlayers.filter(p =>
      (p.username||'').toLowerCase().includes(q) ||
      (p.country||'').toLowerCase().includes(q) ||
      (p.city||'').toLowerCase().includes(q) ||
      (p.region||'').toLowerCase().includes(q)
    ));
  });
}