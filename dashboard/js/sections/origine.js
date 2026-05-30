// dashboard/js/sections/origine.js

import { fetchSupabase } from '../api.js';

const ISO_NUM = {
  '250':'FR','056':'BE','756':'CH','124':'CA','504':'MA','012':'DZ',
  '788':'TN','840':'US','826':'GB','276':'DE','724':'ES','380':'IT',
  '620':'PT','528':'NL','036':'AU','076':'BR','484':'MX','392':'JP',
  '686':'SN','384':'CI','643':'RU','156':'CN','356':'IN','710':'ZA',
  '818':'EG','566':'NG','404':'KE','682':'SA','792':'TR','616':'PL',
  '752':'SE','578':'NO','208':'DK','246':'FI','040':'AT','203':'CZ',
};

let _allPlayers = [];

export async function initOrigine() {

  const players = await fetchSupabase(
    'players?select=discord_id,username,pseudo_bf6,avatar_url,country,country_code,region,city,latitude,longitude&country_code=not.is.null'
  );

  _allPlayers = Array.isArray(players)
    ? players
    : [];

  renderStats();
  initTabs();

  await renderMap();

  renderCountriesList();
  renderMembersList(_allPlayers);

  initSearch();
}

// =====================================
// FLAGS
// =====================================

function getFlag(code) {

  if (!code || code === 'XX') return '🌍';

  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0))
  );
}

// =====================================
// STATS
// =====================================

function renderStats() {

  const pays = new Set(
    _allPlayers.map(p => p.country_code).filter(Boolean)
  );

  const villes = new Set(
    _allPlayers.map(p => p.city).filter(Boolean)
  );

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

// =====================================
// TABS
// =====================================

function initTabs() {

  document.querySelectorAll('.origine-tab').forEach(tab => {

    tab.addEventListener('click', () => {

      document.querySelectorAll('.origine-tab')
        .forEach(t => t.classList.remove('active'));

      document.querySelectorAll('.origine-tab-content')
        .forEach(c => c.classList.remove('active'));

      tab.classList.add('active');

      document
        .getElementById(`tab-${tab.dataset.tab}`)
        .classList.add('active');
    });
  });
}

// =====================================
// MAP
// =====================================

async function renderMap() {

  const container = document.getElementById('world-map');

  if (!container) return;

  const tooltip = document.getElementById('origine-tooltip');

  const W = container.offsetWidth || 1400;
  const H = Math.round(W * 0.55);

  container.innerHTML = `
    <div id="map-loading"
      style="
        display:flex;
        align-items:center;
        justify-content:center;
        height:${H}px;
        color:var(--text-muted);
        gap:10px;
        font-size:13px
      ">
      <i class="fas fa-spinner fa-spin"></i>
      Chargement de la carte...
    </div>
  `;

  await Promise.all([
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js'),
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js')
  ]);

  let world;
  let franceRegions;

  try {

    const [worldRes, regionsRes] = await Promise.all([

      fetch(
        'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
      ),

      fetch(
        'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions.geojson'
      )
    ]);

    world = await worldRes.json();
    franceRegions = await regionsRes.json();

  } catch (e) {

    console.error(e);

    container.innerHTML = `
      <div style="padding:24px;color:var(--text-muted)">
        Impossible de charger la carte.
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="origine-map-toolbar">
      <button id="map-reset-btn" class="map-reset-btn">
        <i class="fas fa-globe"></i>
        Monde
      </button>
    </div>
  `;

  // =====================================
  // SVG
  // =====================================

  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .style('background', 'rgba(0,20,10,.92)')
    .style('border-radius', '14px');

  // =====================================
  // GROUPS
  // =====================================

  const mapGroup = svg.append('g');

  const countriesGroup = mapGroup.append('g');
  const regionsGroup = mapGroup.append('g');
  const pinsGroup = mapGroup.append('g');

  // =====================================
  // WORLD PROJECTION
  // =====================================

  const worldProjection = d3.geoNaturalEarth1()
    .scale(W / 6.5)
    .translate([W / 2, H / 2]);

  const worldPath = d3.geoPath()
    .projection(worldProjection);

  const countries = topojson.feature(
    world,
    world.objects.countries
  );

  // =====================================
  // WORLD MAP
  // =====================================

  countriesGroup
    .selectAll('path')
    .data(countries.features)
    .join('path')

    .attr('d', worldPath)

    .attr('fill', 'rgba(255,255,255,.03)')

    .attr('stroke', 'rgba(255,255,255,.08)')

    .attr('stroke-width', 0.5)

    .style('cursor', 'pointer')

    .on('mouseenter', function() {

      d3.select(this)
        .attr('fill', 'rgba(0,255,120,.08)');
    })

    .on('mouseleave', function() {

      d3.select(this)
        .attr('fill', 'rgba(255,255,255,.03)');
    })

    .on('click', function(event, d) {

      const alpha2 = ISO_NUM[String(d.id).padStart(3,'0')];

      if (!alpha2) return;

      // FRANCE DETAILLEE
      if (alpha2 === 'FR') {

        renderFranceRegions();

      } else {

        resetMap();
      }
    });

  // =====================================
  // WORLD PINS
  // =====================================

  function renderWorldPins() {

    pinsGroup.selectAll('*').remove();

    const grouped = {};

    _allPlayers.forEach(player => {

      if (
        !player.latitude ||
        !player.longitude ||
        !player.country_code
      ) return;

      if (!grouped[player.country_code]) {
        grouped[player.country_code] = [];
      }

      grouped[player.country_code].push(player);
    });

    Object.values(grouped).forEach(players => {

      const player = players[0];

      const latitude = parseFloat(player.latitude);
      const longitude = parseFloat(player.longitude);

      const projected = worldProjection([
        longitude,
        latitude
      ]);

      if (!projected) return;

      const [x, y] = projected;

      if (
        isNaN(x) ||
        isNaN(y)
      ) return;

      const g = pinsGroup.append('g')
        .attr('transform', `translate(${x},${y})`)
        .style('cursor', 'pointer');

      // pulse
      g.append('circle')
        .attr('r', 10)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(0,255,120,.35)')
        .attr('stroke-width', 1.5)
        .append('animate')
        .attr('attributeName', 'r')
        .attr('values', '5;14;5')
        .attr('dur', '2s')
        .attr('repeatCount', 'indefinite');

      // core
      g.append('circle')
        .attr('r', players.length > 1 ? 7 : 5)
        .attr('fill', '#00ff66')
        .style(
          'filter',
          'drop-shadow(0 0 8px rgba(0,255,120,.95))'
        );
    });
  }

  // =====================================
  // FRANCE DETAILLEE
  // =====================================

  function renderFranceRegions() {

    // clean
    regionsGroup.selectAll('*').remove();
    pinsGroup.selectAll('*').remove();

    // hide world
    countriesGroup
      .transition()
      .duration(600)
      .style('opacity', 0);

    // FRANCE PROJECTION
    const franceProjection = d3.geoMercator()
      .center([2.454071, 46.279229])
      .scale(W * 2.2)
      .translate([W / 2, H / 2]);

    const francePath = d3.geoPath()
      .projection(franceProjection);

    // REGIONS
    regionsGroup
      .selectAll('path')
      .data(franceRegions.features)
      .join('path')

      .attr('d', francePath)

      .attr('fill', 'rgba(0,255,120,.05)')

      .attr('stroke', 'rgba(0,255,120,.55)')

      .attr('stroke-width', 1.2)

      .style(
        'filter',
        'drop-shadow(0 0 3px rgba(0,255,120,.18))'
      )

      .style('cursor', 'pointer')

      .on('mouseenter', function(event, d) {

        d3.select(this)
          .attr('fill', 'rgba(0,255,120,.18)');

        const regionName =
          d.properties.nom ||
          d.properties.name ||
          'Région';

        tooltip.innerHTML = `
          <div class="tooltip-country">
            🇫🇷 ${regionName}
          </div>
        `;

        tooltip.style.left = `${event.clientX + 14}px`;
        tooltip.style.top = `${event.clientY - 10}px`;

        tooltip.classList.add('visible');
      })

      .on('mousemove', function(event) {

        tooltip.style.left = `${event.clientX + 14}px`;
        tooltip.style.top = `${event.clientY - 10}px`;
      })

      .on('mouseleave', function() {

        d3.select(this)
          .attr('fill', 'rgba(0,255,120,.05)');

        tooltip.classList.remove('visible');
      });

    // GPS PINS
    const francePlayers = _allPlayers.filter(player =>

      player.country_code === 'FR' &&
      player.latitude &&
      player.longitude
    );

    francePlayers.forEach(player => {

      const latitude = parseFloat(player.latitude);
      const longitude = parseFloat(player.longitude);

      const projected = franceProjection([
        longitude,
        latitude
      ]);

      if (!projected) return;

      const [x, y] = projected;

      if (
        isNaN(x) ||
        isNaN(y)
      ) return;

      const g = pinsGroup.append('g')
        .attr('transform', `translate(${x},${y})`)
        .style('cursor', 'pointer');

      // pulse
      g.append('circle')
        .attr('r', 12)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(0,255,120,.35)')
        .attr('stroke-width', 2)
        .append('animate')
        .attr('attributeName', 'r')
        .attr('values', '5;16;5')
        .attr('dur', '2s')
        .attr('repeatCount', 'indefinite');

      // core
      g.append('circle')
        .attr('r', 6)
        .attr('fill', '#00ff66')
        .style(
          'filter',
          'drop-shadow(0 0 10px rgba(0,255,120,.95))'
        );

      // tooltip
      g.on('mouseenter', (event) => {

        tooltip.innerHTML = `
          <div class="tooltip-country">
            🇫🇷 ${player.country || 'France'}
          </div>

          <div class="tooltip-member">

            ${player.avatar_url
              ? `<img src="${player.avatar_url}" alt="">`
              : `<i class="fas fa-user"
                  style="
                    width:20px;
                    text-align:center;
                    color:var(--green-dim)
                  "></i>`}

            <span>
              ${player.username || player.discord_id}
            </span>

          </div>

          <div
            style="
              margin-top:6px;
              color:var(--text-muted);
              font-size:11px
            "
          >
            ${[
              player.city,
              player.region,
              player.country
            ]
            .filter(Boolean)
            .join(', ')}
          </div>
        `;

        tooltip.style.left = `${event.clientX + 14}px`;
        tooltip.style.top = `${event.clientY - 10}px`;

        tooltip.classList.add('visible');
      })

      .on('mousemove', (event) => {

        tooltip.style.left = `${event.clientX + 14}px`;
        tooltip.style.top = `${event.clientY - 10}px`;
      })

      .on('mouseleave', () => {

        tooltip.classList.remove('visible');
      });
    });
  }

  // =====================================
  // RESET MAP
  // =====================================

  function resetMap() {

    regionsGroup.selectAll('*').remove();
    pinsGroup.selectAll('*').remove();

    countriesGroup
      .transition()
      .duration(400)
      .style('opacity', 1);

    renderWorldPins();
  }

  // =====================================
  // RESET BTN
  // =====================================

  document
    .getElementById('map-reset-btn')
    ?.addEventListener('click', resetMap);

  // =====================================
  // INITIAL WORLD PINS
  // =====================================

  renderWorldPins();

  // =====================================
  // GRID
  // =====================================

  mapGroup.append('path')
    .datum(d3.geoGraticule()())
    .attr('d', worldPath)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(0,255,120,.04)')
    .attr('stroke-width', 0.5);
}

// =====================================
// SCRIPT LOADER
// =====================================

function loadScript(src) {

  return new Promise((resolve, reject) => {

    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const s = document.createElement('script');

    s.src = src;

    s.onload = resolve;
    s.onerror = reject;

    document.head.appendChild(s);
  });
}

// =====================================
// COUNTRIES LIST
// =====================================

function renderCountriesList() {

  const container = document.getElementById('countries-list');

  if (!container) return;

  const byCountry = {};

  _allPlayers.forEach(p => {

    if (!p.country_code) return;

    if (!byCountry[p.country_code]) {

      byCountry[p.country_code] = {
        name: p.country,
        code: p.country_code,
        count: 0
      };
    }

    byCountry[p.country_code].count++;
  });

  const sorted = Object.values(byCountry)
    .sort((a, b) => b.count - a.count);

  const max = sorted[0]?.count || 1;

  container.innerHTML = sorted.map(c => `
    <div class="origine-country-row">

      <div class="origine-country-flag">
        ${getFlag(c.code)}
      </div>

      <div class="origine-country-info">
        <div class="origine-country-name">
          ${c.name}
        </div>

        <div class="origine-country-members">
          ${c.count} membre${c.count > 1 ? 's' : ''}
        </div>
      </div>

      <div class="origine-country-bar-wrap">
        <div
          class="origine-country-bar"
          style="width:${(c.count / max) * 100}%"
        ></div>
      </div>

      <div class="origine-country-count">
        ${c.count}
      </div>

    </div>
  `).join('');
}

// =====================================
// MEMBERS LIST
// =====================================

function renderMembersList(players) {

  const container =
    document.getElementById('origine-members-list');

  if (!container) return;

  container.innerHTML = players.map(p => {

    const location = [
      p.city,
      p.region,
      p.country
    ]
    .filter(Boolean)
    .join(', ');

    return `
      <div class="origine-member-card">

        ${p.avatar_url
          ? `<img
              class="origine-member-avatar"
              src="${p.avatar_url}"
              alt=""
            >`
          : `<div class="origine-member-avatar-placeholder">
              <i class="fas fa-user"></i>
            </div>`}

        <div class="origine-member-info">

          <div class="origine-member-name">
            ${p.username || p.discord_id}
          </div>

          <div class="origine-member-location">
            ${location || '—'}
          </div>

        </div>

        <div class="origine-member-flag">
          ${getFlag(p.country_code)}
        </div>

      </div>
    `;
  }).join('');
}

// =====================================
// SEARCH
// =====================================

function initSearch() {

  document
    .getElementById('origine-member-search')
    ?.addEventListener('input', e => {

      const q =
        e.target.value.toLowerCase().trim();

      if (!q) {
        renderMembersList(_allPlayers);
        return;
      }

      renderMembersList(
        _allPlayers.filter(p =>

          (p.username || '')
            .toLowerCase()
            .includes(q)

          ||

          (p.country || '')
            .toLowerCase()
            .includes(q)

          ||

          (p.city || '')
            .toLowerCase()
            .includes(q)

          ||

          (p.region || '')
            .toLowerCase()
            .includes(q)
        )
      );
    });
}