import { fetchSupabase } from '../api.js';
import { showToast }     from '../ui/toast.js';

let map         = null;
let markers     = [];
let allMembers  = [];
let heatLayer   = null;
let heatMode    = false;

// ── INIT ──────────────────────────────────────────────────────────────────────

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

  document.getElementById('btn-map-heatmap').addEventListener('click', toggleHeatmap);
}

// ── LEAFLET + PLUGINS ─────────────────────────────────────────────────────────

async function loadLeaflet() {
  if (window.L) return;

  const link  = document.createElement('link');
  link.rel    = 'stylesheet';
  link.href   = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  document.head.appendChild(link);

  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js');

  const clusterCss = document.createElement('link');
  clusterCss.rel   = 'stylesheet';
  clusterCss.href  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.css';
  document.head.appendChild(clusterCss);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s    = document.createElement('script');
    s.src      = src;
    s.onload   = resolve;
    s.onerror  = reject;
    document.head.appendChild(s);
  });
}

// ── CARTE ─────────────────────────────────────────────────────────────────────

function initMap(members) {
  if (map) { map.remove(); map = null; }

  map = window.L.map('membre-map', {
    center     : [46.5, 2.5],
    zoom       : 5,
    zoomControl: true,
  });

  // Fond sombre CartoDB
  window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    maxZoom    : 20,
  }).addTo(map);

  // Labels en français par-dessus
  window.L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    opacity    : 0.55,
    maxZoom    : 20,
    pane       : 'shadowPane',
  }).addTo(map);

  addMarkers(members);
}

// ── MARQUEURS ─────────────────────────────────────────────────────────────────

function addMarkers(members) {
  markers.forEach(m => { try { m.remove(); } catch {} });
  markers = [];
  if (heatLayer) { try { map.removeLayer(heatLayer); } catch {} heatLayer = null; }

  if (!map) return;

  // Cluster group custom
  const clusterGroup = window.L.markerClusterGroup({
    maxClusterRadius: 50,
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount();
      return window.L.divIcon({
        html: `<div class="ws-cluster"><span>${count}</span></div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
    },
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
  });

  members.forEach(member => {
    if (!member.lat || !member.lng) return;

    const avatarHtml = member.avatar_url
      ? `<img src="${member.avatar_url}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" style="width:32px;height:32px;border-radius:50%;border:2px solid var(--green);object-fit:cover">`
      : '';
    const fallbackHtml = `<div style="display:${member.avatar_url ? 'none' : 'flex'};width:32px;height:32px;border-radius:50%;background:rgba(0,255,102,0.15);border:2px solid var(--green);align-items:center;justify-content:center;font-size:14px">${member.flag || '🌍'}</div>`;

    const icon = window.L.divIcon({
      className: '',
      html: `
        <div class="ws-pin">
          <div class="ws-pin-avatar">${avatarHtml}${fallbackHtml}</div>
          <div class="ws-pin-tail"></div>
          <div class="ws-pin-pulse"></div>
        </div>`,
      iconSize  : [40, 50],
      iconAnchor: [20, 50],
      popupAnchor: [0, -50],
    });

    const marker = window.L.marker([member.lat, member.lng], { icon });

    const popupContent = `
      <div class="ws-popup">
        <div class="ws-popup-header">
          ${member.avatar_url
            ? `<img src="${member.avatar_url}" class="ws-popup-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">`
            : `<div class="ws-popup-avatar-placeholder">${member.flag || '🌍'}</div>`}
          <div>
            <div class="ws-popup-name">${member.username}</div>
            <div class="ws-popup-location">${member.flag || ''} ${member.city || ''}${member.region ? ` · ${member.region}` : ''}</div>
          </div>
        </div>
        ${member.country ? `<div class="ws-popup-country">${member.country}</div>` : ''}
      </div>`;

    marker.bindPopup(popupContent, {
      className   : 'ws-leaflet-popup',
      maxWidth    : 220,
      closeButton : false,
    });

    clusterGroup.addLayer(marker);
    markers.push(marker);
  });

  map.addLayer(clusterGroup);
  markers.push(clusterGroup);
}

// ── HEATMAP ───────────────────────────────────────────────────────────────────

function toggleHeatmap() {
  heatMode = !heatMode;
  const btn = document.getElementById('btn-map-heatmap');
  btn.classList.toggle('active', heatMode);

  if (heatMode) {
    const filtered = getCurrentFiltered();
    showHeatmap(filtered);
  } else {
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    addMarkers(getCurrentFiltered());
  }
}

function showHeatmap(members) {
  markers.forEach(m => { try { m.remove(); } catch {} });
  markers = [];

  // Heatmap CSS via canvas Leaflet (simulation avec cercles)
  const points = members.filter(m => m.lat && m.lng);
  points.forEach(m => {
    const circle = window.L.circleMarker([m.lat, m.lng], {
      radius      : 18,
      fillColor   : '#ff4500',
      fillOpacity : 0.25,
      color       : '#ff6b35',
      weight      : 1,
      opacity     : 0.6,
    }).addTo(map);
    markers.push(circle);

    const dot = window.L.circleMarker([m.lat, m.lng], {
      radius      : 5,
      fillColor   : '#ff6b35',
      fillOpacity : 0.9,
      color       : '#ff4500',
      weight      : 1,
    }).addTo(map);
    markers.push(dot);
  });
}

function getCurrentFiltered() {
  const country = document.getElementById('map-filter-country')?.value;
  const search  = document.getElementById('location-search')?.value?.toLowerCase();
  let result = [...allMembers];
  if (country && country !== 'all') result = result.filter(m => m.country === country);
  if (search) result = result.filter(m =>
    m.username?.toLowerCase().includes(search) ||
    (m.city || '').toLowerCase().includes(search) ||
    (m.region || '').toLowerCase().includes(search)
  );
  return result;
}

// ── DONNÉES ───────────────────────────────────────────────────────────────────

async function loadData() {
  const data = await fetchSupabase('member_locations?select=*&order=username.asc');
  allMembers = data || [];

  // Récupérer les avatars depuis la table players
  const players = await fetchSupabase('players?select=discord_id,avatar_url') || [];
  const avatarMap = {};
  players.forEach(p => { avatarMap[p.discord_id] = p.avatar_url; });
  allMembers.forEach(m => { if (!m.avatar_url && avatarMap[m.discord_id]) m.avatar_url = avatarMap[m.discord_id]; });

  initMap(allMembers);
  renderList(allMembers);
  renderStats(allMembers);
  renderRegions(allMembers);
  renderCountries(allMembers);
  populateCountryFilter(allMembers);
  animateCounters();
}

// ── LISTE MEMBRES ─────────────────────────────────────────────────────────────

function renderList(members) {
  const el = document.getElementById('locations-list');
  if (!members.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;padding:1rem">Aucun membre localisé.<br>Les membres utilisent <code>/location set</code> pour s'enregistrer.</div>`;
    return;
  }

  el.innerHTML = members.map(m => `
    <div class="carte-member-row" data-lat="${m.lat}" data-lng="${m.lng}">
      <div class="carte-member-avatar-wrap">
        ${m.avatar_url
          ? `<img src="${m.avatar_url}" class="carte-member-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">`
          : `<div class="carte-member-avatar-placeholder">${m.flag || '🌍'}</div>`}
      </div>
      <div class="carte-member-info">
        <div class="carte-member-name">${m.username}</div>
        <div class="carte-member-place">${m.flag || ''} ${m.city || '—'}${m.region ? ` · ${m.region}` : ''}</div>
      </div>
      <button class="btn btn-danger btn-sm carte-delete-btn" onclick="event.stopPropagation();window.deleteLocation('${m.discord_id}')" title="Supprimer">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');

  el.querySelectorAll('.carte-member-row').forEach(row => {
    row.addEventListener('click', () => {
      const lat = parseFloat(row.dataset.lat);
      const lng = parseFloat(row.dataset.lng);
      if (lat && lng && map) {
        map.setView([lat, lng], 12);
        // Trouver et ouvrir le popup
        const member = allMembers.find(m => Math.abs(m.lat - lat) < 0.001 && Math.abs(m.lng - lng) < 0.001);
        if (member) {
          markers.forEach(mk => {
            if (mk.getLatLng && Math.abs(mk.getLatLng().lat - lat) < 0.001) {
              mk.openPopup();
            }
          });
        }
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

// ── STATS ─────────────────────────────────────────────────────────────────────

function renderStats(members) {
  const countries = new Set(members.map(m => m.country).filter(Boolean));
  const regions   = new Set(members.map(m => m.region).filter(Boolean));
  const france    = members.filter(m => m.country === 'France').length;

  document.getElementById('stat-locations-total').dataset.target     = members.length;
  document.getElementById('stat-locations-france').dataset.target    = france;
  document.getElementById('stat-locations-countries').dataset.target = countries.size;
  document.getElementById('stat-locations-regions').dataset.target   = regions.size;
}

function animateCounters() {
  document.querySelectorAll('[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target) || 0;
    let current  = 0;
    const step   = Math.max(1, Math.ceil(target / 30));
    const timer  = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(timer);
    }, 40);
  });
}

// ── TOP RÉGIONS ───────────────────────────────────────────────────────────────

function renderRegions(members) {
  const counts = {};
  members.forEach(m => { if (m.region) counts[m.region] = (counts[m.region] || 0) + 1; });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const el     = document.getElementById('regions-list');

  if (!sorted.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucune donnée.</div>`;
    return;
  }

  const max = sorted[0][1];
  el.innerHTML = sorted.map(([region, count]) => `
    <div class="carte-region-row">
      <div class="carte-region-top">
        <span class="carte-region-name">${region}</span>
        <span class="carte-region-count">${count}</span>
      </div>
      <div class="carte-region-bar-bg">
        <div class="carte-region-bar-fill" style="width:${Math.round((count / max) * 100)}%"></div>
      </div>
    </div>
  `).join('');
}

// ── TOP PAYS ──────────────────────────────────────────────────────────────────

function renderCountries(members) {
  const counts = {};
  members.forEach(m => { if (m.country) counts[m.country] = (counts[m.country] || 0) + 1; });

  const flags = { 'France': '🇫🇷', 'Belgique': '🇧🇪', 'Suisse': '🇨🇭', 'Canada': '🇨🇦', 'Espagne': '🇪🇸', 'Allemagne': '🇩🇪', 'Italie': '🇮🇹', 'Royaume-Uni': '🇬🇧' };

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const el     = document.getElementById('countries-list');
  const max    = sorted[0]?.[1] || 1;

  if (!sorted.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem">Aucune donnée.</div>`;
    return;
  }

  el.innerHTML = sorted.map(([country, count]) => `
    <div class="carte-country-row">
      <span class="carte-country-flag">${flags[country] || m?.flag || '🌍'}</span>
      <div class="carte-country-info">
        <div class="carte-country-name">${country}</div>
        <div class="carte-country-bar-bg">
          <div class="carte-country-bar-fill" style="width:${Math.round((count / max) * 100)}%"></div>
        </div>
      </div>
      <span class="carte-country-count">${count}</span>
    </div>
  `).join('');
}

// ── FILTRES ───────────────────────────────────────────────────────────────────

function filterMembers(query) {
  const filtered = query
    ? allMembers.filter(m =>
        m.username?.toLowerCase().includes(query.toLowerCase()) ||
        (m.city || '').toLowerCase().includes(query.toLowerCase()) ||
        (m.region || '').toLowerCase().includes(query.toLowerCase())
      )
    : allMembers;

  renderList(filtered);
  if (heatMode) showHeatmap(filtered);
  else addMarkers(filtered);
}

function filterByCountry(country) {
  const filtered = country === 'all'
    ? allMembers
    : allMembers.filter(m => m.country === country);

  if (heatMode) showHeatmap(filtered);
  else addMarkers(filtered);
  renderList(filtered);

  if (map) {
    if (country === 'France') map.setView([46.5, 2.5], 5);
    else if (country === 'all') map.setView([20, 10], 2);
    else map.setView([20, 0], 3);
  }
}

function populateCountryFilter(members) {
  const countries = [...new Set(members.map(m => m.country).filter(Boolean))].sort();
  const select    = document.getElementById('map-filter-country');
  select.innerHTML =
    `<option value="all">🌐 Tous les pays</option>` +
    countries.map(c => `<option value="${c}"${c === 'France' ? ' selected' : ''}>${c}</option>`).join('');
}