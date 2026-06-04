/**
 * WARSTACK — Skeleton Loading System
 */

function skeletonHTML(type = 'row', count = 5) {
  const items = [];
  for (let i = 0; i < count; i++) {
    switch (type) {
      case 'kpi':
        items.push(`
          <div class="sk-kpi">
            <div class="skeleton sk-icon" style="width:32px;height:32px;border-radius:8px;flex-shrink:0"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:6px">
              <div class="skeleton sk-title sk-w-1-2"></div>
              <div class="skeleton sk-text-sm sk-w-1-3"></div>
            </div>
          </div>`);
        break;
      case 'activity':
        items.push(`
          <div class="sk-activity">
            <div class="skeleton sk-avatar-sm"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:4px">
              <div class="skeleton sk-text sk-w-3-4"></div>
              <div class="skeleton sk-text-sm sk-w-1-3"></div>
            </div>
            <div class="skeleton sk-text-sm sk-w-1-4"></div>
          </div>`);
        break;
      case 'table':
        items.push(`
          <div class="sk-table-row">
            <div class="skeleton sk-avatar-sm"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:5px">
              <div class="skeleton sk-text sk-w-2-3"></div>
              <div class="skeleton sk-text-sm sk-w-1-3"></div>
            </div>
            <div class="skeleton sk-badge"></div>
          </div>`);
        break;
      case 'card':
        items.push(`
          <div class="sk-card">
            <div class="sk-card-header">
              <div class="skeleton sk-avatar"></div>
              <div style="flex:1;display:flex;flex-direction:column;gap:5px">
                <div class="skeleton sk-text sk-w-2-3"></div>
                <div class="skeleton sk-text-sm sk-w-1-2"></div>
              </div>
            </div>
            <div class="skeleton sk-text sk-w-full"></div>
            <div class="skeleton sk-text sk-w-3-4"></div>
            <div style="display:flex;gap:8px;margin-top:4px">
              <div class="skeleton sk-badge"></div>
              <div class="skeleton sk-badge" style="width:80px"></div>
            </div>
          </div>`);
        break;
      case 'panel-rows':
        items.push(`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03)">
            <div style="display:flex;align-items:center;gap:8px;flex:1">
              <div class="skeleton" style="width:8px;height:8px;border-radius:50%;flex-shrink:0"></div>
              <div class="skeleton sk-text" style="width:${60 + Math.random() * 30 | 0}%"></div>
            </div>
            <div class="skeleton sk-badge"></div>
          </div>`);
        break;
      default:
        items.push(`
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03)">
            <div class="skeleton sk-avatar-sm"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:4px">
              <div class="skeleton sk-text sk-w-3-4"></div>
              <div class="skeleton sk-text-sm sk-w-1-2"></div>
            </div>
          </div>`);
    }
  }
  return items.join('');
}

export function showSkeleton(containerId, type = 'row', count = 5) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = skeletonHTML(type, count);
}

export function clearSkeleton(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.removeAttribute('data-skeleton');
}

export async function withSkeleton(containerId, type, count, loaderFn) {
  showSkeleton(containerId, type, count);
  try {
    const html = await loaderFn();
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = html;
  } catch (err) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem;padding:8px 0">Erreur de chargement</div>`;
    console.error('[Skeleton]', containerId, err);
  }
}