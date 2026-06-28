import { fetchSupabase } from '../api.js';

const params    = new URLSearchParams(window.location.search);
const discordId = params.get('id');

const loading  = document.getElementById('profil-loading');
const notfound = document.getElementById('profil-notfound');
const content  = document.getElementById('profil-content');

const GRADES = [
  { level: 1,  xp: 0,     name: 'Recrue',           emoji: '🪖' },
  { level: 2,  xp: 100,   name: 'Soldat',            emoji: '🎖️' },
  { level: 3,  xp: 250,   name: 'Caporal',           emoji: '🎖️' },
  { level: 4,  xp: 500,   name: 'Sergent',           emoji: '🎖️' },
  { level: 5,  xp: 900,   name: 'Sergent-Chef',      emoji: '🎖️' },
  { level: 6,  xp: 1400,  name: 'Adjudant',          emoji: '⭐' },
  { level: 7,  xp: 2000,  name: 'Adjudant-Chef',     emoji: '⭐' },
  { level: 8,  xp: 2800,  name: 'Lieutenant',        emoji: '⭐⭐' },
  { level: 9,  xp: 3800,  name: 'Capitaine',         emoji: '⭐⭐' },
  { level: 10, xp: 5000,  name: 'Commandant',        emoji: '⭐⭐⭐' },
  { level: 11, xp: 7000,  name: 'Colonel',           emoji: '⭐⭐⭐' },
  { level: 12, xp: 10000, name: 'Général',           emoji: '🏅' },
  { level: 13, xp: 15000, name: 'Maréchal WARSTACK', emoji: '🏆' },
];

function getGrade(xp) {
  let grade = GRADES[0];
  for (const g of GRADES) {
    if (xp >= g.xp) grade = g;
    else break;
  }
  return grade;
}

function getNextGrade(xp) {
  return GRADES.find(g => g.xp > xp) || null;
}

const BR_RANK_SCORES = {
  'bronze i': 1,   'bronze ii': 2,   'bronze iii': 3,   'bronze iv': 4,   'bronze v': 5,
  'silver i': 6,   'silver ii': 7,   'silver iii': 8,   'silver iv': 9,   'silver v': 10,
  'gold i': 11,    'gold ii': 12,    'gold iii': 13,    'gold iv': 14,    'gold v': 15,
  'platinum i': 16,'platinum ii': 17,'platinum iii': 18,'platinum iv': 19,'platinum v': 20,
  'diamond i': 21, 'diamond ii': 22, 'diamond iii': 23, 'diamond iv': 24, 'diamond v': 25,
  'master i': 26,  'master ii': 27,  'master iii': 28,  'master iv': 29,  'master v': 30,
  'masters': 30,
};

const RARITY_CONFIG = {
  common    : { label: 'Commun',     color: '#aaaaaa', glow: 'rgba(170,170,170,.25)' },
  rare      : { label: 'Rare',       color: '#5865f2', glow: 'rgba(88,101,242,.35)'  },
  epic      : { label: 'Épique',     color: '#a335ee', glow: 'rgba(163,53,238,.35)'  },
  legendary : { label: 'Légendaire', color: '#ff8c00', glow: 'rgba(255,140,0,.40)'   },
  mythic    : { label: 'Mythique',   color: '#ff4444', glow: 'rgba(255,68,68,.40)'   },
};

const PAYS_LIST = [
  { name: 'France',         code: 'FR' }, { name: 'Belgique',       code: 'BE' },
  { name: 'Suisse',         code: 'CH' }, { name: 'Canada',         code: 'CA' },
  { name: 'Maroc',          code: 'MA' }, { name: 'Algérie',        code: 'DZ' },
  { name: 'Tunisie',        code: 'TN' }, { name: 'États-Unis',     code: 'US' },
  { name: 'Royaume-Uni',    code: 'GB' }, { name: 'Allemagne',      code: 'DE' },
  { name: 'Espagne',        code: 'ES' }, { name: 'Italie',         code: 'IT' },
  { name: 'Portugal',       code: 'PT' }, { name: 'Pays-Bas',       code: 'NL' },
  { name: 'Australie',      code: 'AU' }, { name: 'Brésil',         code: 'BR' },
  { name: 'Mexique',        code: 'MX' }, { name: 'Japon',          code: 'JP' },
  { name: 'Sénégal',        code: 'SN' }, { name: "Côte d'Ivoire",  code: 'CI' },
  { name: 'Russie',         code: 'RU' }, { name: 'Chine',          code: 'CN' },
  { name: 'Inde',           code: 'IN' }, { name: 'Afrique du Sud', code: 'ZA' },
  { name: 'Turquie',        code: 'TR' }, { name: 'Pologne',        code: 'PL' },
  { name: 'Suède',          code: 'SE' }, { name: 'Norvège',        code: 'NO' },
  { name: 'Danemark',       code: 'DK' }, { name: 'Finlande',       code: 'FI' },
  { name: 'Autre',          code: 'XX' },
];

function getFlag(code) {
  if (!code || code === 'XX') return '🌍';
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0))
  );
}

const CITY_COORDS = {
  'paris': { lat: 48.8566, lng: 2.3522 }, 'marseille': { lat: 43.2965, lng: 5.3698 },
  'lyon': { lat: 45.7640, lng: 4.8357 }, 'toulouse': { lat: 43.6047, lng: 1.4442 },
  'nice': { lat: 43.7102, lng: 7.2620 }, 'nantes': { lat: 47.2184, lng: -1.5536 },
  'montpellier': { lat: 43.6110, lng: 3.8767 }, 'strasbourg': { lat: 48.5734, lng: 7.7521 },
  'bordeaux': { lat: 44.8378, lng: -0.5792 }, 'lille': { lat: 50.6292, lng: 3.0573 },
  'rennes': { lat: 48.1173, lng: -1.6778 }, 'grenoble': { lat: 45.1885, lng: 5.7245 },
  'dijon': { lat: 47.3220, lng: 5.0415 }, 'nîmes': { lat: 43.8367, lng: 4.3601 },
  'toulon': { lat: 43.1242, lng: 5.9280 }, 'reims': { lat: 49.2583, lng: 4.0317 },
  'lunel': { lat: 43.6760, lng: 4.1358 }, 'avignon': { lat: 43.9493, lng: 4.8055 },
  'pau': { lat: 43.2951, lng: -0.3708 }, 'perpignan': { lat: 42.6987, lng: 2.8956 },
  'caen': { lat: 49.1829, lng: -0.3707 }, 'brest': { lat: 48.3904, lng: -4.4861 },
  'rouen': { lat: 49.4432, lng: 1.0993 }, 'metz': { lat: 49.1193, lng: 6.1757 },
  'nancy': { lat: 48.6921, lng: 6.1844 }, 'clermont-ferrand': { lat: 45.7772, lng: 3.0870 },
  'angers': { lat: 47.4784, lng: -0.5632 }, 'le havre': { lat: 49.4938, lng: 0.1077 },
  'amiens': { lat: 49.8941, lng: 2.2958 }, 'tours': { lat: 47.3941, lng: 0.6848 },
  'limoges': { lat: 45.8354, lng: 1.2644 }, 'narbonne': { lat: 43.1836, lng: 3.0042 },
  'montauban': { lat: 44.0181, lng: 1.3528 }, 'albi': { lat: 43.9279, lng: 2.1479 },
  'bayonne': { lat: 43.4929, lng: -1.4748 }, 'cannes': { lat: 43.5528, lng: 7.0174 },
  'aix-en-provence': { lat: 43.5297, lng: 5.4474 }, 'mulhouse': { lat: 47.7508, lng: 7.3359 },
};

const COUNTRY_COORDS = {
  'France': { lat: 46.5, lng: 2.5 }, 'Belgique': { lat: 50.5, lng: 4.5 },
  'Suisse': { lat: 46.8, lng: 8.2 }, 'Canada': { lat: 56.0, lng: -96.0 },
  'Maroc': { lat: 31.8, lng: -7.0 }, 'Algérie': { lat: 28.0, lng: 3.0 },
  'Tunisie': { lat: 33.9, lng: 9.5 }, 'États-Unis': { lat: 37.0, lng: -95.0 },
  'Royaume-Uni': { lat: 55.0, lng: -3.0 }, 'Allemagne': { lat: 51.0, lng: 10.0 },
  'Espagne': { lat: 40.0, lng: -4.0 }, 'Italie': { lat: 42.5, lng: 12.5 },
  'Portugal': { lat: 39.5, lng: -8.0 }, 'Pays-Bas': { lat: 52.3, lng: 5.3 },
  'Australie': { lat: -25.0, lng: 133.0 }, 'Brésil': { lat: -10.0, lng: -55.0 },
  'Mexique': { lat: 23.0, lng: -102.0 }, 'Japon': { lat: 36.0, lng: 138.0 },
};

function getCityCoords(city, country) {
  if (city) {
    const c = CITY_COORDS[city.toLowerCase().trim()];
    if (c) return c;
  }
  return COUNTRY_COORDS[country] || { lat: 46.5, lng: 2.5 };
}

function calcScore(s) {
  if (!s) return 0;
  const kd      = parseFloat(s.kd)      || 0;
  const winrate = parseFloat(s.winrate) || 0;
  const kills   = parseInt(s.kills)     || 0;
  const games   = parseInt(s.games)     || 1;
  const kpm     = kills / games;
  const brKey   = (s.br_rank || '').toLowerCase().trim();
  const brVal   = BR_RANK_SCORES[brKey] ?? 0;
  const brScore = (brVal / 30) * 100;
  return (
    (Math.min(winrate / 60, 1) * 100 * 0.30) +
    (Math.min(kd / 5, 1)       * 100 * 0.25) +
    (Math.min(kpm / 20, 1)     * 100 * 0.15) +
    (Math.min(games / 500, 1)  * 100 * 0.10) +
    (brScore                         * 0.25)
  ).toFixed(1);
}

function getDivision(score) {
  const s = parseFloat(score);
  if (s >= 65) return { name: 'WARSTACK', emoji: '🔱', color: '#ff0000' };
  if (s >= 55) return { name: 'Phantom',  emoji: '👻', color: '#9B59B6' };
  if (s >= 45) return { name: 'Elite',    emoji: '💎', color: '#00BFFF' };
  if (s >= 35) return { name: 'Veteran',  emoji: '🎖️', color: '#FF6600' };
  if (s >= 25) return { name: 'Soldat',   emoji: '⚔️', color: '#95A5A6' };
  return             { name: 'Recruit',   emoji: '🪖', color: '#607D8B' };
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

function fmt(v, isPercent = false) {
  if (v === null || v === undefined || v === 0) return '—';
  if (isPercent) return `${parseFloat(v).toFixed(1)}%`;
  return typeof v === 'number' && v > 999 ? Number(v).toLocaleString('fr-FR') : v;
}

function initTabs() {
  document.querySelectorAll('.profil-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profil-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.profil-tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).style.display = 'block';
    });
  });
}

function renderWARSTACKBlock(xpData, walletData, equippedItems) {
  const xp        = xpData?.xp      ?? 0;
  const coins     = walletData?.coins ?? 0;
  const grade     = getGrade(xp);
  const nextGrade = getNextGrade(xp);
  const progress  = nextGrade
    ? Math.round(((xp - grade.xp) / (nextGrade.xp - grade.xp)) * 100)
    : 100;

  const block = document.getElementById('profil-warstack-block');
  if (!block) return;

  const badges = (equippedItems || []).filter(i => i.shop_items?.category === 'badge');
  const titles = (equippedItems || []).filter(i => i.shop_items?.category === 'title');
  const equippedTitle = titles[0]?.shop_items || null;

  const badgesHtml = badges.length ? `
    <div class="profil-ws-equipped-badges">
      ${badges.map(b => {
        const item = b.shop_items;
        const rc   = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
        return `<span class="profil-ws-badge rarity-${item.rarity}" title="${item.name}" style="--rarity-glow:${rc.glow};--rarity-color:${rc.color}">${item.icon || '🏅'}</span>`;
      }).join('')}
    </div>` : '';

  const titleBannerHtml = equippedTitle ? `
    <div class="profil-ws-title-banner rarity-${equippedTitle.rarity}" style="--rarity-color:${(RARITY_CONFIG[equippedTitle.rarity] || RARITY_CONFIG.common).color};--rarity-glow:${(RARITY_CONFIG[equippedTitle.rarity] || RARITY_CONFIG.common).glow}">
      <span class="profil-ws-title-icon">${equippedTitle.icon || '📛'}</span>
      <span class="profil-ws-title-text">${equippedTitle.name}</span>
      <span class="profil-ws-title-rarity">${(RARITY_CONFIG[equippedTitle.rarity] || RARITY_CONFIG.common).label}</span>
    </div>` : '';

  block.innerHTML = `
    <div class="profil-ws-top">
      <div class="profil-ws-grade">
        <div class="profil-ws-grade-icon">${grade.emoji}</div>
        <div class="profil-ws-grade-info">
          <div class="profil-ws-grade-name">${grade.name}</div>
          <div class="profil-ws-grade-level">Niveau ${grade.level}</div>
        </div>
      </div>
      ${titleBannerHtml}
    </div>
    <div class="profil-ws-bar-wrap">
      <div class="profil-ws-bar" style="width:${progress}%"></div>
    </div>
    <div class="profil-ws-bar-label">
      <span>${xp.toLocaleString('fr-FR')} XP</span>
      <span>${nextGrade ? `→ ${nextGrade.emoji} ${nextGrade.name} dans ${(nextGrade.xp - xp).toLocaleString('fr-FR')} XP` : '🏆 Grade MAX'}</span>
    </div>
    <div class="profil-ws-counters">
      <div class="profil-ws-counter">
        <div class="profil-ws-counter-val">✨ ${xp.toLocaleString('fr-FR')}</div>
        <div class="profil-ws-counter-label">XP Total</div>
      </div>
      <div class="profil-ws-counter">
        <div class="profil-ws-counter-val" style="color:#FFD700">💰 ${coins.toLocaleString('fr-FR')}</div>
        <div class="profil-ws-counter-label">WAR Coins</div>
      </div>
      <div class="profil-ws-counter">
        <div class="profil-ws-counter-val">${walletData?.total_earned?.toLocaleString('fr-FR') ?? 0}</div>
        <div class="profil-ws-counter-label">Total gagné</div>
      </div>
    </div>
    ${badgesHtml}
  `;
}

function renderEquippedItems(equippedItems) {
  if (!equippedItems.length) return;

  const badges = equippedItems.filter(i => i.shop_items?.category === 'badge');
  const titles = equippedItems.filter(i => i.shop_items?.category === 'title');

  const heroBadges = document.getElementById('p-hero-badges');
  if (heroBadges && badges.length) {
    heroBadges.innerHTML = badges.map(b => {
      const item = b.shop_items;
      const rc   = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
      return `<span class="profil-hero-badge rarity-${item.rarity}" title="${item.name}" style="--rarity-color:${rc.color}">${item.icon || '🏅'}</span>`;
    }).join('');
  }

  if (titles.length) {
    const item    = titles[0].shop_items;
    const rc      = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
    const titleEl = document.createElement('div');
    titleEl.className = 'profil-equipped-title';
    titleEl.style.setProperty('--rarity-color', rc.color);
    titleEl.style.setProperty('--rarity-glow', rc.glow);
    titleEl.innerHTML = `<span>${item.icon || '📛'}</span> ${item.name}`;
    const platform = document.getElementById('p-platform');
    if (platform) platform.insertAdjacentElement('beforebegin', titleEl);
  }

  const tabBtn  = document.getElementById('tab-equip-btn');
  const tabPane = document.getElementById('tab-equip');
  const grid    = document.getElementById('p-equip-grid');
  if (!tabBtn || !tabPane || !grid) return;

  tabBtn.style.display = '';

  grid.innerHTML = equippedItems.map(pi => {
    const item = pi.shop_items;
    if (!item) return '';
    const rc = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
    return `
      <div class="profil-equip-card rarity-${item.rarity}" style="--rarity-color:${rc.color};--rarity-glow:${rc.glow}">
        <div class="profil-equip-card-glow"></div>
        <div class="profil-equip-icon">${item.icon || '🎁'}</div>
        <div class="profil-equip-name">${item.name}</div>
        <div class="profil-equip-cat">${item.category === 'badge' ? '🏅 Badge' : '📛 Titre'}</div>
        <div class="profil-equip-rarity rarity-badge-${item.rarity}">${rc.label}</div>
        ${item.description ? `<div class="profil-equip-desc">${item.description}</div>` : ''}
        <div class="profil-equip-equipped-tag"><i class="fas fa-check-circle"></i> Équipé</div>
      </div>
    `;
  }).join('');
}

async function injectEditLocalisation(player) {
  const { supabase }                   = await import('../supabaseClient.js');
  const { SUPABASE_URL, SUPABASE_KEY } = await import('../config.js');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const sessionDiscordId = session.user?.user_metadata?.provider_id
                        || session.user?.user_metadata?.sub;
  if (sessionDiscordId !== player.discord_id) return;

  const footer = document.querySelector('.profil-footer');
  if (!footer) return;

  const editBtn = document.createElement('button');
  editBtn.className = 'profil-edit-btn';
  editBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> Ma localisation`;
  footer.prepend(editBtn);

  const modal = document.createElement('div');
  modal.id        = 'localisation-modal';
  modal.className = 'profil-loc-modal';
  modal.innerHTML = `
    <div class="profil-loc-overlay"></div>
    <div class="profil-loc-box">
      <div class="profil-loc-header">
        <h3>📍 Ma localisation</h3>
        <button class="profil-loc-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="profil-loc-body">
        <p class="profil-loc-hint">Ta localisation apparaîtra sur la carte des membres. La ville est optionnelle.</p>
        <div class="form-group">
          <label>Pays <span style="color:#ff4444">*</span></label>
          <select id="loc-pays" class="form-select">
            <option value="">— Sélectionner —</option>
            ${PAYS_LIST.map(p => `
              <option value="${p.code}" ${player.country_code === p.code ? 'selected' : ''}>
                ${getFlag(p.code)} ${p.name}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Région <span class="profil-loc-optional">(optionnel)</span></label>
          <input type="text" id="loc-region" class="form-input"
                 placeholder="Ex: Occitanie, Île-de-France..."
                 value="${player.region || ''}">
        </div>
        <div class="form-group">
          <label>Ville <span class="profil-loc-optional">(optionnel)</span></label>
          <input type="text" id="loc-ville" class="form-input"
                 placeholder="Ex: Montpellier, Paris..."
                 value="${player.city || ''}">
        </div>
      </div>
      <div class="profil-loc-footer">
        <button class="profil-loc-cancel">Annuler</button>
        <button class="profil-loc-save"><i class="fas fa-save"></i> Sauvegarder</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  editBtn.addEventListener('click', () => modal.classList.add('open'));
  modal.querySelector('.profil-loc-overlay').addEventListener('click', () => modal.classList.remove('open'));
  modal.querySelector('.profil-loc-close').addEventListener('click',   () => modal.classList.remove('open'));
  modal.querySelector('.profil-loc-cancel').addEventListener('click',  () => modal.classList.remove('open'));

  modal.querySelector('.profil-loc-save').addEventListener('click', async () => {
    const countryCode = document.getElementById('loc-pays').value;
    const region      = document.getElementById('loc-region').value.trim() || null;
    const city        = document.getElementById('loc-ville').value.trim()  || null;

    if (!countryCode) { alert('Sélectionne un pays.'); return; }

    const country = PAYS_LIST.find(p => p.code === countryCode)?.name || countryCode;
    const saveBtn = modal.querySelector('.profil-loc-save');
    saveBtn.textContent = 'Sauvegarde...';
    saveBtn.disabled    = true;

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/players?discord_id=eq.${player.discord_id}`, {
        method : 'PATCH',
        headers: {
          apikey        : SUPABASE_KEY,
          Authorization : `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer        : 'return=representation',
        },
        body: JSON.stringify({ country, country_code: countryCode, region, city }),
      });

      if (!res.ok) throw new Error('Erreur serveur');

      const coords = getCityCoords(city, country);
      const flag   = getFlag(countryCode);

      await fetch(`${SUPABASE_URL}/rest/v1/member_locations`, {
        method : 'POST',
        headers: {
          apikey        : SUPABASE_KEY,
          Authorization : `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer        : 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          discord_id: player.discord_id,
          username  : player.pseudo || player.username,
          city      : city   || null,
          region    : region || null,
          country,
          lat       : coords?.lat || null,
          lng       : coords?.lng || null,
          flag,
        }),
      });

      modal.classList.remove('open');

      const loc = [city, region, country].filter(Boolean).join(', ');
      let locBadge = document.getElementById('p-localisation');
      if (!locBadge) {
        locBadge           = document.createElement('div');
        locBadge.id        = 'p-localisation';
        locBadge.className = 'profil-localisation';
        document.querySelector('.profil-identity')?.appendChild(locBadge);
      }
      locBadge.innerHTML = `${flag} ${loc}`;

    } catch (err) {
      console.error(err);
      alert('Erreur lors de la sauvegarde. Réessaie.');
    } finally {
      saveBtn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder';
      saveBtn.disabled  = false;
    }
  });
}

async function loadProfil() {
  if (!discordId) { showNotFound(); return; }

  const [players, xpRows, walletRows, itemsRows] = await Promise.all([
    fetchSupabase(`players?discord_id=eq.${discordId}&select=*`),
    fetchSupabase(`warstack_xp?discord_id=eq.${discordId}&select=*`),
    fetchSupabase(`warstack_wallets?discord_id=eq.${discordId}&select=*`),
    fetchSupabase(`player_items?discord_id=eq.${discordId}&equipped=eq.true&select=*,shop_items(*)`),
  ]);

  const player        = players?.[0];
  const xpData        = xpRows?.[0]    || null;
  const walletData    = walletRows?.[0] || null;
  const equippedItems = itemsRows       || [];

  if (!player) { showNotFound(); return; }

  let snapshot = null;
  if (player.tracker_id) {
    const snaps = await fetchSupabase(`player_snapshots?tracker_id=eq.${player.tracker_id}&order=snapshot_at.desc&limit=1`);
    snapshot    = snaps?.[0] || null;
  }

  const score    = calcScore(snapshot);
  const division = getDivision(score);

  document.getElementById('p-avatar').src                = player.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
  document.getElementById('p-username').textContent       = player.username || player.pseudo_bf6 || '—';
  document.getElementById('p-platform').textContent       = player.platform?.toUpperCase() || '—';
  document.getElementById('p-division').textContent       = `${division.emoji} ${division.name}`;
  document.getElementById('p-division-badge').textContent = division.emoji;
  document.getElementById('p-score').textContent          = score;
  document.documentElement.style.setProperty('--division-color', division.color);

  if (player.country) {
    const flag     = getFlag(player.country_code);
    const loc      = [player.city, player.region, player.country].filter(Boolean).join(', ');
    const identity = document.querySelector('.profil-identity');
    if (identity) {
      const locEl     = document.createElement('div');
      locEl.id        = 'p-localisation';
      locEl.className = 'profil-localisation';
      locEl.innerHTML = `${flag} ${loc}`;
      identity.appendChild(locEl);
    }
  }

  if (snapshot?.br_rank) {
    const brRankEl = document.getElementById('p-br-rank');
    brRankEl.style.display = 'flex';
    document.getElementById('p-br-rank-value').textContent = snapshot.br_rank;
    if (snapshot.br_rank_img) {
      const img = document.getElementById('p-br-rank-img');
      img.src = snapshot.br_rank_img;
      img.style.display = 'inline';
      document.getElementById('p-br-rank-icon').style.display = 'none';
    }
  }

  if (snapshot?.br_rank) {
    if (snapshot.br_rank_img) {
      document.getElementById('p-rank-card').style.display = 'flex';
      document.getElementById('p-rank-card-img').src = snapshot.br_rank_img;
      document.getElementById('p-rank-card-value').textContent = snapshot.br_rank.toUpperCase();
    } else {
      document.getElementById('p-rank-card-fallback').style.display = 'flex';
      document.getElementById('p-rank-card-value-fb').textContent = snapshot.br_rank.toUpperCase();
    }
  }

  document.getElementById('p-kills').textContent   = snapshot?.kills  ? Number(snapshot.kills).toLocaleString('fr-FR')  : '—';
  document.getElementById('p-deaths').textContent  = snapshot?.deaths ? Number(snapshot.deaths).toLocaleString('fr-FR') : '—';
  document.getElementById('p-kd').textContent      = snapshot?.kd     || '—';
  document.getElementById('p-games').textContent   = snapshot?.games  ? Number(snapshot.games).toLocaleString('fr-FR')  : '—';
  document.getElementById('p-winrate').textContent = snapshot?.winrate ? `${parseFloat(snapshot.winrate).toFixed(1)}%` : '—';

  document.getElementById('p-mp-kills').textContent   = fmt(snapshot?.mp_kills);
  document.getElementById('p-mp-deaths').textContent  = fmt(snapshot?.mp_deaths);
  document.getElementById('p-mp-kd').textContent      = snapshot?.mp_kd    || '—';
  document.getElementById('p-mp-winrate').textContent = fmt(snapshot?.mp_winrate, true);

  document.getElementById('p-br-kills').textContent   = fmt(snapshot?.br_kills);
  document.getElementById('p-br-deaths').textContent  = fmt(snapshot?.br_deaths);
  document.getElementById('p-br-kd').textContent      = snapshot?.br_kd    || '—';
  document.getElementById('p-br-winrate').textContent = fmt(snapshot?.br_winrate, true);

  if (snapshot?.br_rank) {
    const banner = document.getElementById('p-br-rank-banner');
    banner.style.display = 'flex';
    document.getElementById('p-br-rank-banner-value').textContent = snapshot.br_rank.toUpperCase();
    if (snapshot.br_rank_img) {
      const img = document.getElementById('p-br-banner-img');
      img.src = snapshot.br_rank_img;
      img.style.display = 'inline';
      document.getElementById('p-br-banner-icon').style.display = 'none';
    }
  }

  if (player.tracker_url) {
    document.getElementById('p-tracker-link').href = player.tracker_url;
  } else {
    document.getElementById('p-tracker-link').style.display = 'none';
  }

  if (snapshot?.snapshot_at) {
    document.getElementById('p-updated').textContent = `Mis à jour le ${formatDate(snapshot.snapshot_at)}`;
  }

  document.title = `${player.username || 'Joueur'} — WARSTACK`;

  renderEquippedItems(equippedItems);
  renderWARSTACKBlock(xpData, walletData, equippedItems);
  initTabs();
  await loadTournois(discordId);
  await loadXPHistory(discordId);
  await injectEditLocalisation(player);
  showContent();
}

async function loadTournois(discordId) {
  const container = document.getElementById('p-tournois');

  const entries = await fetchSupabase(`tournament_entries?discord_id=eq.${discordId}&select=*&order=created_at.desc`);
  if (!entries?.length) {
    container.innerHTML = '<div class="profil-empty">Aucun tournoi participé pour l\'instant.</div>';
    return;
  }

  const rows = await Promise.all(entries.map(async (entry) => {
    const tournois = await fetchSupabase(`tournaments?id=eq.${entry.tournament_id}&select=*`);
    const tournoi  = tournois?.[0];
    if (!tournoi) return null;

    const subs = await fetchSupabase(`tournament_submissions?tournament_id=eq.${entry.tournament_id}&discord_id=eq.${discordId}&status=eq.approved&order=submitted_at.desc`);

    let totalKills = 0, bestKd = 0, totalGames = subs?.length || 0;
    if (subs?.length) {
      subs.forEach(s => {
        totalKills += s.kills || 0;
        if ((s.kd || 0) > bestKd) bestKd = s.kd;
      });
    }

    const scores      = await fetchSupabase(`tournament_scores?tournament_id=eq.${entry.tournament_id}&order=total_score.desc`);
    const rank        = scores?.findIndex(s => s.discord_id === discordId) ?? -1;
    const rankDisplay = rank >= 0 ? `#${rank + 1}` : '—';
    const isMvp       = rank === 0;
    const isTop3      = rank >= 0 && rank < 3;
    const lastSub     = subs?.[0] || null;

    return { tournoi, entry, lastSub, totalKills, bestKd, totalGames, rankDisplay, isMvp, isTop3 };
  }));

  const valid = rows.filter(Boolean);
  if (!valid.length) {
    container.innerHTML = '<div class="profil-empty">Aucune donnée de tournoi.</div>';
    return;
  }

  container.innerHTML = valid.map(({ tournoi, lastSub, totalKills, bestKd, totalGames, rankDisplay, isMvp, isTop3 }) => `
    <div class="profil-tournoi-card">
      <div class="profil-tournoi-header">
        <div>
          <div class="profil-tournoi-name">${tournoi.name}</div>
          ${tournoi.phase ? `<div class="profil-tournoi-phase">${tournoi.phase}</div>` : ''}
          <div class="profil-tournoi-dates">${formatDate(tournoi.start_date)} → ${formatDate(tournoi.end_date)}</div>
        </div>
        <div class="profil-tournoi-rank ${isMvp ? 'mvp' : isTop3 ? 'top3' : ''}">${rankDisplay}</div>
      </div>
      <div class="profil-tournoi-stats">
        <div class="profil-tournoi-stat"><strong>${lastSub?.kd ?? '—'}</strong><span>Meilleur K/D</span></div>
        <div class="profil-tournoi-stat"><strong>${totalKills || '—'}</strong><span>Kills totaux</span></div>
        <div class="profil-tournoi-stat"><strong>${totalGames || '—'}</strong><span>Parties</span></div>
        <div class="profil-tournoi-stat"><strong>${rankDisplay}</strong><span>Classement</span></div>
      </div>
      ${isMvp ? '<div class="profil-tournoi-badge mvp">⭐ MVP</div>' : ''}
      ${isTop3 && !isMvp ? '<div class="profil-tournoi-badge top3">🏆 Top 3</div>' : ''}
    </div>
  `).join('');
}

async function loadXPHistory(discordId) {
  const container = document.getElementById('p-xp-history');
  if (!container) return;

  const rows = await fetchSupabase(
    `warstack_transactions?discord_id=eq.${discordId}&order=created_at.desc&limit=10`
  );

  if (!rows?.length) {
    container.innerHTML = '<div class="profil-empty">Aucune transaction XP.</div>';
    return;
  }

  container.innerHTML = rows.map(r => `
    <div class="profil-tournoi-card" style="padding:12px 16px">
      <div>
        <div style="font-weight:600;font-size:0.9rem">${r.reason || r.type || 'Transaction'}</div>
        <div style="color:var(--text-muted);font-size:0.75rem">${formatDate(r.created_at)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:1.1rem;font-weight:700;color:${r.amount > 0 ? 'var(--green)' : 'var(--red)'}">
          ${r.amount > 0 ? '+' : ''}${r.amount} XP
        </div>
        ${r.coins ? `<div style="font-size:0.8rem;color:#FFD700">${r.coins > 0 ? '+' : ''}${r.coins} 💰</div>` : ''}
      </div>
    </div>
  `).join('');
}

function showNotFound() {
  loading.style.display  = 'none';
  notfound.style.display = 'flex';
  content.style.display  = 'none';
}

function showContent() {
  loading.style.display  = 'none';
  notfound.style.display = 'none';
  content.style.display  = 'block';
}

loadProfil();