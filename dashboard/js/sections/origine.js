// dashboard/js/sections/origine.js v2
// Vraie carte monde D3.js + GeoJSON

import { fetchSupabase } from '../api.js';

const COUNTRY_COORDS = {
  FR:[48.8566,2.3522], BE:[50.8503,4.3517], CH:[46.9481,7.4474],
  CA:[45.4215,-75.6972], MA:[33.9716,-6.8498], DZ:[36.7372,3.0865],
  TN:[36.8065,10.1815], US:[38.8951,-77.0364], GB:[51.5074,-0.1278],
  DE:[52.5200,13.4050], ES:[40.4168,-3.7038], IT:[41.9028,12.4964],
  PT:[38.7169,-9.1399], NL:[52.3676,4.9041], AU:[-35.2809,149.1300],
  BR:[-15.7801,-47.9292], MX:[19.4326,-99.1332], JP:[35.6762,139.6503],
  SN:[14.7167,-17.4677], CI:[5.3484,-4.0083], RU:[55.7558,37.6176],
  CN:[39.9042,116.4074], IN:[28.6139,77.2090], ZA:[-25.7461,28.1881],
  EG:[30.0444,31.2357], NG:[9.0579,7.4951], KE:[-1.2921,36.8219],
  SA:[24.6877,46.7219], TR:[39.9334,32.8597], PL:[52.2297,21.0122],
  SE:[59.3293,18.0686], NO:[59.9139,10.7522], DK:[55.6761,12.5683],
  FI:[60.1699,24.9384], AT:[48.2082,16.3738], CZ:[50.0755,14.4378],
  XX:[20,0],
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

  // Grouper membres par pays
  const byCountry = {};
  _allPlayers.forEach(p => {
    if (!p.country_code) return;
    if (!byCountry[p.country_code]) byCountry[p.country_code] = [];
    byCountry[p.country_code].push(p);
  });

  const tooltip = document.getElementById('origine-tooltip');
  const W = container.offsetWidth || 800;
  const H = Math.round(W * 0.5);

  container.innerHTML = `<div id="map-loading" style="display:flex;align-items:center;justify-content:center;height:${H}px;color:var(--text-muted);gap:10px;font-size:13px"><i class="fas fa-spinner fa-spin"></i> Chargement de la carte...</div>`;

  // Charger D3 et le GeoJSON en parallèle
  await Promise.all([
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js'),
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js')
  ]);

  // GeoJSON monde simplifié
  let world;
  try {
    const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    world = await res.json();
  } catch(e) {
    container.innerHTML = `<div style="padding:24px;color:var(--text-muted)">Impossible de charger la carte. Vérifiez votre connexion.</div>`;
    return;
  }

  container.innerHTML = '';

  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .style('background', 'rgba(0,20,10,.8)')
    .style('border-radius', '12px');

  const projection = d3.geoNaturalEarth1()
    .scale(W / 6.5)
    .translate([W / 2, H / 2]);

  const path = d3.geoPath().projection(projection);

  const countries = topojson.feature(world, world.objects.countries);

  // Codes numériques ISO → alpha2 (subset utile)
  const ISO_NUM = {
    '250':'FR','056':'BE','756':'CH','124':'CA','504':'MA','012':'DZ',
    '788':'TN','840':'US','826':'GB','276':'DE','724':'ES','380':'IT',
    '620':'PT','528':'NL','036':'AU','076':'BR','484':'MX','392':'JP',
    '686':'SN','384':'CI','643':'RU','156':'CN','356':'IN','710':'ZA',
    '818':'EG','566':'NG','404':'KE','682':'SA','792':'TR','616':'PL',
    '752':'SE','578':'NO','208':'DK','246':'FI','040':'AT','203':'CZ',
  };

  const hasMembers = new Set(Object.keys(byCountry));

  // Dessiner les pays
  svg.append('g')
    .selectAll('path')
    .data(countries.features)
    .join('path')
    .attr('d', path)
    .attr('fill', d => {
      const alpha2 = ISO_NUM[String(d.id).padStart(3,'0')];
      return hasMembers.has(alpha2) ? 'rgba(0,255,120,.25)' : 'rgba(0,255,120,.05)';
    })
    .attr('stroke', 'rgba(0,255,120,.15)')
    .attr('stroke-width', 0.4)
    .style('cursor', d => {
      const alpha2 = ISO_NUM[String(d.id).padStart(3,'0')];
      return hasMembers.has(alpha2) ? 'pointer' : 'default';
    })
    .on('mouseenter', function(event, d) {
      const alpha2 = ISO_NUM[String(d.id).padStart(3,'0')];
      if (!hasMembers.has(alpha2)) return;
      d3.select(this).attr('fill', 'rgba(0,255,120,.5)');
      showTooltip(event, alpha2, byCountry[alpha2] || [], tooltip);
    })
    .on('mousemove', function(event) {
      tooltip.style.left = `${event.clientX + 14}px`;
      tooltip.style.top  = `${event.clientY - 10}px`;
    })
    .on('mouseleave', function(event, d) {
      const alpha2 = ISO_NUM[String(d.id).padStart(3,'0')];
      d3.select(this).attr('fill', hasMembers.has(alpha2) ? 'rgba(0,255,120,.25)' : 'rgba(0,255,120,.05)');
      tooltip.classList.remove('visible');
    });

  // Dessiner les pins
  const pinsGroup = svg.append('g');

  Object.entries(byCountry).forEach(([code, members]) => {
    const coords = COUNTRY_COORDS[code];
    if (!coords) return;

    const [x, y] = projection([coords[1], coords[0]]);
    if (!x || !y) return;

    const g = pinsGroup.append('g')
      .attr('transform', `translate(${x},${y})`)
      .style('cursor', 'pointer');

    // Anneau pulsant
    g.append('circle')
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(0,255,120,.4)')
      .attr('stroke-width', 1.5)
      .append('animate')
        .attr('attributeName', 'r')
        .attr('values', '6;14;6')
        .attr('dur', '2s')
        .attr('repeatCount', 'indefinite');

    g.append('animate')
      .attr('attributeName', 'opacity')
      .attr('values', '1;0;1')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite');

    // Point central
    g.append('circle')
      .attr('r', members.length > 3 ? 7 : 5)
      .attr('fill', '#00ff66')
      .style('filter', 'drop-shadow(0 0 4px rgba(0,255,120,.8))');

    // Compteur si > 1
    if (members.length > 1) {
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', members.length > 9 ? '7' : '8')
        .attr('font-weight', '700')
        .attr('fill', '#000')
        .text(members.length);
    }

    g.on('mouseenter', (event) => showTooltip(event, code, members, tooltip))
     .on('mousemove', (event) => {
       tooltip.style.left = `${event.clientX + 14}px`;
       tooltip.style.top  = `${event.clientY - 10}px`;
     })
     .on('mouseleave', () => tooltip.classList.remove('visible'));
  });

  // Graticule
  svg.append('path')
    .datum(d3.geoGraticule()())
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(0,255,120,.04)')
    .attr('stroke-width', 0.5);
}

function showTooltip(event, code, members, tooltip) {
  const flag = getFlag(code);
  const country = members[0]?.country || code;

  tooltip.innerHTML = `
    <div class="tooltip-country">${flag} ${country} — ${members.length} membre${members.length > 1 ? 's' : ''}</div>
    ${members.slice(0, 5).map(m => `
      <div class="tooltip-member">
        ${m.avatar_url
          ? `<img src="${m.avatar_url}" alt="">`
          : '<i class="fas fa-user" style="width:20px;text-align:center;color:var(--green-dim)"></i>'}
        <span>${m.username || m.discord_id}</span>
        ${m.city ? `<span style="color:var(--text-muted);font-size:9px;margin-left:4px">— ${m.city}</span>` : ''}
      </div>
    `).join('')}
    ${members.length > 5 ? `<div style="font-size:10px;color:var(--text-muted);margin-top:4px">+${members.length - 5} autres</div>` : ''}
  `;

  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top  = `${event.clientY - 10}px`;
  tooltip.classList.add('visible');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
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

  const sorted = Object.values(byCountry).sort((a, b) => b.count - a.count);
  const max    = sorted[0]?.count || 1;

  if (!sorted.length) {
    container.innerHTML = `<div class="origine-loading">Aucun membre localisé. Utilisez /origine sur Discord !</div>`;
    return;
  }

  container.innerHTML = sorted.map(c => `
    <div class="origine-country-row">
      <div class="origine-country-flag">${getFlag(c.code)}</div>
      <div class="origine-country-info">
        <div class="origine-country-name">${c.name}</div>
        <div class="origine-country-members">${c.count} membre${c.count > 1 ? 's' : ''}</div>
      </div>
      <div class="origine-country-bar-wrap">
        <div class="origine-country-bar" style="width:${(c.count / max) * 100}%"></div>
      </div>
      <div class="origine-country-count">${c.count}</div>
    </div>
  `).join('');
}

function renderMembersList(players) {
  const container = document.getElementById('origine-members-list');
  if (!container) return;

  if (!players?.length) {
    container.innerHTML = `<div class="origine-loading">Aucun membre localisé. Utilisez /origine sur Discord !</div>`;
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
      (p.username || '').toLowerCase().includes(q) ||
      (p.country  || '').toLowerCase().includes(q) ||
      (p.city     || '').toLowerCase().includes(q) ||
      (p.region   || '').toLowerCase().includes(q)
    ));
  });
}