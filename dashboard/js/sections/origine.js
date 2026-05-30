import { callBotAPI, fetchSupabase } from '../api.js';
import { showToast }                 from '../ui/toast.js';

let map       = null;
let markers   = [];
let allMembers = [];

export async function initOrigine() {
  await loadLeaflet();
  await loadData();

  document.getElementById('location-search').addEventListener('input', e => {
    filterMembers(e.target.value);
  });

  document.getElementById('map-filter-country').addEventListener('change', e => {
    filterByCountry(e.target.value);
  });

  document.getElementById('btn-map-reset').addEventListener('click', () => {
    if (map) map.setView([46.5, 2.5], 5);
  });
}

// ── Charger Leaflet dynamiquement ────────────────────────────────────────────

async function loadLeaflet() {
  if (window.L) return;

  // CSS
  const link  = document.createElement('link');
  link.rel    = 'stylesheet';
  link.href   = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  document.head.appendChild(link);

  // JS
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src   = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload  = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── Init carte ───────────────────────────────────────────────────────────────

function initMap(members) {
  if (map) {
    map.remove();
    map = null;
  }

  map = window.L.map('membre-map', {
    center     : [46.5, 2.5],
    zoom       : 5,
    zoomControl: true,
  });

  // Tuiles sombre style WARSTACK
  window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    maxZoom    : 18,
  }).addTo(map);

  addMarkers(members);
}

// ── Ajouter markers ──────────────────────────────────────────────────────────

function addMarkers(members) {
  // Vider anciens markers
  markers.forEach(m => m.remove());
  markers = [];

  members.forEach(member => {
    if (!member.lat || !member.lng) return;

    const icon = window.L.divIcon({
      className: '',
      html: `
        <div style="
          background: #00ff66;
          border: 2px solid #000;
          border-radius: 50%;
          width: 12px;
          height: 12px;
          box-shadow: 0 0 8px rgba(0,255,102,0.8);
          cursor: pointer;
        "></div>
      `,
      iconSize  : [12, 12],
      iconAnchor: [6, 6],
    });

    const marker = window.L.marker([member.lat, member.lng], { icon })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:sans-serif;min-width:120px">
          <div style="font-weight:700;font-size:0.9rem">${member.username}</div>
          <div style="color:#666;font-size:0.8rem;margin-top:2px">
            ${member.flag || ''} ${member.city || ''}${member.region ? `, ${member.region}` : ''}
          </div>
          <div style="color:#999;font-size:0.75rem">${member.country || ''}</div>
        </div>
      `);

    markers.push(marker);
  });
}

// ── Charger données ──────────────────────────────────────────────────────────

async function loadData() {
  const data = await fetchSupabase('member_locations?select=*&order=username.asc');
  allMembers = data || [];

  initMap(allMembers);
  renderList(allMembers);
  renderStats(allMembers);
  renderRegions(allMembers);
  populateCountryFilter(allMembers);
}

// ── Render liste ─────────────────────────────────────────────────────────────

function renderList(members) {
  const el = document.getElementById('locations-list');
  if (!members.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucun membre localisé.<br><br>Les membres utilisent <code>/location set</code> pour s'enregistrer.</div>`;
    return;
  }

  el.innerHTML = members.map(m => `
    <div class="location-row" data-lat="${m.lat}" data-lng="${m.lng}">
      <div class="location-info">
        <span class="location-flag">${m.flag || '🌍'}</span>
        <div>
          <div class="location-name">${m.username}</div>
          <div class="location-place">${m.city || ''}${m.region ? ` · ${m.region}` : ''}</div>
        </div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="window.deleteLocation('${m.discord_id}')">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');

  // Clic → zoom sur la carte
  el.querySelectorAll('.location-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const lat = parseFloat(row.dataset.lat);
      const lng = parseFloat(row.dataset.lng);
      if (lat && lng && map) {
        map.setView([lat, lng], 10);
      }
    });
  });

  window.deleteLocation = async (discord_id) => {
    if (!confirm('Supprimer la localisation de ce membre ?')) return;
    await fetchSupabase(`member_locations?discord_id=eq.${discord_id}`, 'DELETE');
    showToast('✅ Localisation supprimée');
    await loadData();
  };
}

// ── Stats ────────────────────────────────────────────────────────────────────

function renderStats(members) {
  const countries = new Set(members.map(m => m.country).filter(Boolean));
  const regions   = new Set(members.map(m => m.region).filter(Boolean));
  const france    = members.filter(m => m.country === 'France').length;

  document.getElementById('stat-locations-total').textContent     = members.length;
  document.getElementById('stat-locations-france').textContent    = france;
  document.getElementById('stat-locations-countries').textContent = countries.size;
  document.getElementById('stat-locations-regions').textContent   = regions.size;
}

// ── Top régions ──────────────────────────────────────────────────────────────

function renderRegions(members) {
  const counts = {};
  members.forEach(m => {
    if (!m.region) return;
    counts[m.region] = (counts[m.region] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const el     = document.getElementById('regions-list');

  if (!sorted.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucune donnée.</div>`;
    return;
  }

  const max = sorted[0][1];
  el.innerHTML = sorted.map(([region, count]) => `
    <div class="region-row">
      <div class="region-info">
        <span class="region-name">${region}</span>
        <span class="region-count">${count}</span>
      </div>
      <div class="region-bar">
        <div class="region-bar-fill" style="width:${Math.round((count / max) * 100)}%"></div>
      </div>
    </div>
  `).join('');
}

// ── Filtres ──────────────────────────────────────────────────────────────────

function filterMembers(query) {
  const filtered = query
    ? allMembers.filter(m =>
        m.username.toLowerCase().includes(query.toLowerCase()) ||
        (m.city || '').toLowerCase().includes(query.toLowerCase()) ||
        (m.region || '').toLowerCase().includes(query.toLowerCase())
      )
    : allMembers;

  renderList(filtered);
  addMarkers(filtered);
}

function filterByCountry(country) {
  const filtered = country === 'all'
    ? allMembers
    : allMembers.filter(m => m.country === country);

  addMarkers(filtered);
  renderList(filtered);

  if (filtered.length && map) {
    if (country === 'France') map.setView([46.5, 2.5], 5);
    else map.setView([20, 0], 2);
  }
}

function populateCountryFilter(members) {
  const countries = [...new Set(members.map(m => m.country).filter(Boolean))].sort();
  const select    = document.getElementById('map-filter-country');

  select.innerHTML = `<option value="all">Tous les pays</option>` +
    countries.map(c => `<option value="${c}"${c === 'France' ? ' selected' : ''}>${c}</option>`).join('');
}