import { callBotAPI } from '../api.js';

let emojis = [];
let loaded = false;
let activePicker = null;

// ── INIT GLOBAL ───────────────────────────────────────────────────────────────

export async function loadEmojis(force = false) {
    if (loaded && !force) return;
    const data = await callBotAPI('emojis');
    emojis = data?.emojis || [];
    loaded = true;
}

// ── ATTACHER sur un textarea ──────────────────────────────────────────────────
// Usage : attachEmojiPicker('mon-textarea-id')

export function attachEmojiPicker(textareaId) {
    const ta = document.getElementById(textareaId);
    if (!ta) return;

    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;display:contents';

    // Bouton
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-picker-btn';
    btn.title = 'Emojis Discord';
    btn.innerHTML = '😀';

    // Insérer le bouton juste après le textarea
    ta.insertAdjacentElement('afterend', btn);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePicker(btn, ta);
    });
}

// ── TOGGLE PICKER ─────────────────────────────────────────────────────────────

function togglePicker(btn, ta) {
    // Fermer si déjà ouvert sur ce bouton
    if (activePicker && activePicker._btn === btn) {
        closePicker();
        return;
    }

    closePicker();

    const picker = buildPicker(ta);
    picker._btn = btn;
    document.body.appendChild(picker);
    activePicker = picker;

    // Position sous le bouton
    const rect = btn.getBoundingClientRect();
    picker.style.top = (rect.top + window.scrollY - picker.offsetHeight - 8) + 'px';
    picker.style.left = Math.min(rect.left + window.scrollX, window.innerWidth - 270) + 'px';

    // Fermer au clic extérieur
    setTimeout(() => {
        document.addEventListener('click', outsideClick);
    }, 10);

    // Rafraîchir les emojis custom en arrière-plan (au cas où un emoji vient d'être
    // ajouté sur Discord) ; on ré-affiche la grille si le picker est toujours ouvert.
    loadEmojis(true).then(() => {
        if (activePicker === picker && typeof picker._refreshGrid === 'function') {
            picker._refreshGrid();
        }
    });
}

function closePicker() {
    if (activePicker) {
        activePicker.remove();
        activePicker = null;
        document.removeEventListener('click', outsideClick);
    }
}

function outsideClick(e) {
    if (activePicker && !activePicker.contains(e.target)) {
        closePicker();
    }
}

// ── BUILD PICKER ──────────────────────────────────────────────────────────────

function buildPicker(ta) {
    const picker = document.createElement('div');
    picker.className = 'emoji-picker-dropdown';

    // Recherche
    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = '🔍 Rechercher...';
    search.className = 'emoji-picker-search';
    picker.appendChild(search);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'emoji-picker-tabs';

    const tabUnicode = document.createElement('button');
    tabUnicode.className = 'emoji-tab active';
    tabUnicode.textContent = '😀 Unicode';
    tabUnicode.dataset.tab = 'unicode';

    const tabCustom = document.createElement('button');
    tabCustom.className = 'emoji-tab';
    tabCustom.textContent = '⭐ Serveur';
    tabCustom.dataset.tab = 'custom';

    tabs.appendChild(tabUnicode);
    tabs.appendChild(tabCustom);
    picker.appendChild(tabs);

    // Grille
    const grid = document.createElement('div');
    grid.className = 'emoji-picker-grid';
    picker.appendChild(grid);

    let currentTab = 'unicode';

    const renderGrid = (filter = '') => {
        grid.innerHTML = '';

        if (currentTab === 'unicode') {
            const filtered = UNICODE_EMOJIS.filter(e =>
                !filter || e.includes(filter) || getEmojiName(e).includes(filter.toLowerCase())
            );
            filtered.forEach(emoji => {
                const btn = document.createElement('button');
                btn.className = 'emoji-item';
                btn.textContent = emoji;
                btn.title = getEmojiName(emoji);
                btn.addEventListener('click', () => {
                    insertAtCursor(ta, emoji);
                    closePicker();
                });
                grid.appendChild(btn);
            });
        } else {
            const filtered = emojis.filter(e =>
                !filter || e.name.toLowerCase().includes(filter.toLowerCase())
            );

            if (!filtered.length) {
                grid.innerHTML = `<div style="color:var(--text-muted);font-size:0.8rem;padding:0.5rem;text-align:center">
          ${emojis.length ? 'Aucun résultat' : 'Aucun emoji custom sur ce serveur'}
        </div>`;
                return;
            }

            filtered.forEach(emoji => {
                const btn = document.createElement('button');
                btn.className = 'emoji-item emoji-custom';
                btn.title = `:${emoji.name}:`;
                btn.innerHTML = `<img src="${emoji.url}" alt="${emoji.name}">`;
                btn.addEventListener('click', () => {
                    insertAtCursor(ta, emoji.string);
                    closePicker();
                });
                grid.appendChild(btn);
            });
        }
    };

    // Events tabs
    tabs.querySelectorAll('.emoji-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            renderGrid(search.value);
        });
    });

    // Recherche live
    search.addEventListener('input', () => renderGrid(search.value));

    renderGrid();
    picker._refreshGrid = () => renderGrid(search.value);
    return picker;
}

// ── INSERT AT CURSOR ──────────────────────────────────────────────────────────

function insertAtCursor(ta, text) {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = start + text.length;
    ta.dispatchEvent(new Event('input'));
}

// ── EMOJI NAME ────────────────────────────────────────────────────────────────

function getEmojiName(emoji) {
    const names = {
        '😀': 'souriant', '😂': 'rire', '❤️': 'coeur', '🔥': 'feu', '⚔️': 'epee',
        '🎮': 'manette', '🏆': 'trophee', '🎯': 'cible', '💀': 'crane', '🛡️': 'bouclier',
        '✅': 'valide', '❌': 'croix', '⚠️': 'warning', '📢': 'annonce', '🎫': 'ticket',
        '🌟': 'etoile', '💎': 'diamant', '🚀': 'fusee', '🎉': 'fete', '👑': 'couronne',
    };
    return names[emoji] || '';
}

// ── UNICODE EMOJIS ────────────────────────────────────────────────────────────

const UNICODE_EMOJIS = [
    // Visages
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍',
    '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
    '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺',
    '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓',
    '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲',
    '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠',
    // Gestes
    '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉',
    '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '💪', '🦾', '🙌', '👏', '🤲', '🙏',
    // Objets gaming
    '🎮', '🕹️', '👾', '🎯', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅', '🎗️', '🎟️', '🎪',
    // Combat
    '⚔️', '🛡️', '🗡️', '🔫', '🪃', '🏹', '💣', '🔪', '🪓', '⛏️', '🔨', '🪚',
    // Symboles
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗',
    '💖', '💘', '💝', '💟', '☮️', '✝️', '☯️', '🔥', '💥', '✨', '⭐', '🌟', '💫', '⚡',
    '❄️', '🌊', '💨', '🌀', '🌈', '☀️', '🌙', '⚠️', '❗', '❓', '💯', '🔴', '🟠', '🟡',
    '🟢', '🔵', '🟣', '⚫', '⚪', '🟤',
    // Communication
    '📢', '📣', '🔔', '🔕', '💬', '💭', '🗯️', '📝', '📌', '📍', '🗺️', '🏴', '🚩', '🎌',
    // Divers utiles
    '✅', '❌', '🚫', '⛔', '🔞', '📵', '🔇', '🔈', '🔉', '🔊', '📱', '💻', '🖥️', '⌨️',
    '🖱️', '💾', '💿', '📀', '🎵', '🎶', '🎤', '🎧', '🎼', '🎹', '🥁', '🎸', '🎺', '🎻',
    '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏧', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭',
    '👑', '💎', '💰', '💵', '💴', '💶', '💷', '💸', '💳', '🪙', '🏧', '💹', '📈', '📉', '📊',
];