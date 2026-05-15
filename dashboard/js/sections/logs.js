function bindToggle(id) {
  document.getElementById(id)?.addEventListener('click', () => {
    document.getElementById(id).classList.toggle('on');
  });
}

export async function initLogs() {
  bindToggle('toggle-delete');
  bindToggle('toggle-edit');
  bindToggle('toggle-sanctions');
}