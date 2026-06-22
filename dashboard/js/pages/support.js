import { supabase }                     from '../supabaseClient.js';
import { SUPABASE_URL, SUPABASE_KEY, BOT_URL } from '../config.js';

const params  = new URLSearchParams(window.location.search);
const guildId = params.get('guild');

const elLoading = document.getElementById('support-loading');
const elLogin   = document.getElementById('support-login');
const elForm    = document.getElementById('support-form');
const elSuccess = document.getElementById('support-success');

let selectedCategoryId = null;
let currentUser        = null;

async function init() {
  if (!guildId) { showError('Lien invalide.'); return; }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    hide(elLoading);
    show(elLogin);
    document.getElementById('btn-discord-login').addEventListener('click', loginWithDiscord);
    return;
  }

  currentUser = session.user;
  await showForm(session);
}

async function loginWithDiscord() {
  await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options : {
      redirectTo: window.location.href,
      scopes    : 'identify',
    },
  });
}

async function showForm(session) {
  hide(elLoading);

  const meta       = session.user.user_metadata || {};
  const discordId  = meta.provider_id || meta.sub || session.user.id;
  const username   = meta.full_name || meta.name || meta.custom_claims?.global_name || 'Membre';
  const avatarUrl  = meta.avatar_url || '';

  currentUser = { discordId, username, avatarUrl };

  document.getElementById('support-user-info').innerHTML = `
    <img src="${avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}"
         onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
    <span>${username}</span>
  `;

  const { data: existing } = await sbGet(`tickets?guild_id=eq.${guildId}&discord_id=eq.${discordId}&status=in.(open,in_progress)&select=id&limit=1`);
  if (existing?.length) {
    show(document.getElementById('support-already'));
    document.getElementById('support-fields').style.display = 'none';
    show(elForm);
    return;
  }

  await loadCategories();

  show(elForm);

  document.getElementById('btn-submit-ticket').addEventListener('click', submitTicket);
  document.getElementById('support-back-portail').href = `portail.html?guild=${guildId}`;
}

async function loadCategories() {
  const cats = await sbGet(`ticket_categories?guild_id=eq.${guildId}&active=eq.true&order=position.asc&select=id,label,emoji`);
  if (!cats?.length) return;

  const grid = document.getElementById('support-categories');
  grid.innerHTML = cats.map(c => `
    <button class="support-cat-btn" data-id="${c.id}">
      ${c.emoji} ${c.label}
    </button>
  `).join('');

  grid.querySelectorAll('.support-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.support-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategoryId = btn.dataset.id;
    });
  });

  document.getElementById('support-cat-group').style.display = 'flex';
}

async function submitTicket() {
  const subject     = document.getElementById('support-subject').value.trim();
  const description = document.getElementById('support-description').value.trim();
  const btn         = document.getElementById('btn-submit-ticket');

  if (!subject || subject.length < 5)       { alert('Sujet trop court (5 caractères min).'); return; }
  if (!description || description.length < 10) { alert('Description trop courte (10 caractères min).'); return; }

  btn.disabled   = true;
  btn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i> Envoi...';

  try {
    const res = await fetch(`${BOT_URL}/api/ticket/create-public`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        guild_id   : guildId,
        discord_id : currentUser.discordId,
        username   : currentUser.username,
        avatar_url : currentUser.avatarUrl,
        subject,
        description,
        category_id: selectedCategoryId || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        show(document.getElementById('support-already'));
        document.getElementById('support-fields').style.display = 'none';
        return;
      }
      throw new Error(data.error || 'Erreur serveur');
    }

    hide(elForm);
    show(elSuccess);

  } catch (err) {
    alert(`Erreur : ${err.message}`);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';
  }
}

async function sbGet(endpoint) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function show(el) { if (el) el.style.display = 'flex'; }
function hide(el) { if (el) el.style.display = 'none'; }

function showError(msg) {
  hide(elLoading);
  elLogin.innerHTML = `<p style="color:var(--red)">${msg}</p>`;
  show(elLogin);
}

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    hide(elLogin);
    await showForm(session);
  }
});

init();