export function createStatCard({ icon, value, label, id }) {
  return `
    <div class="card">
      <div class="card-icon"><i class="${icon}"></i></div>
      <div class="card-content">
        <div class="card-value" id="${id}">${value}</div>
        <div class="card-label">${label}</div>
      </div>
    </div>
  `;
}