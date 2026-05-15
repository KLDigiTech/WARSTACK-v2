export function createActionButtons({ edit = null, remove = null, custom = '' }) {
  return `
    <div class="table-actions">
      ${edit   ? `<button class="action-btn edit"   onclick="${edit}"><i class="fas fa-pen"></i></button>`   : ''}
      ${remove ? `<button class="action-btn delete" onclick="${remove}"><i class="fas fa-trash"></i></button>` : ''}
      ${custom}
    </div>
  `;
}