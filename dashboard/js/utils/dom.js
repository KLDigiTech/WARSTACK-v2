// dashboard/js/utils/dom.js
// Utilitaires DOM légers — importés dans app.js et disponibles globalement

export const $  = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

export const show = (el) => { if (el) el.style.display = ''; };
export const hide = (el) => { if (el) el.style.display = 'none'; };

export const setText = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };
export const setHTML = (sel, html) => { const el = $(sel); if (el) el.innerHTML  = html; };

export const on = (el, event, fn) => el?.addEventListener(event, fn);