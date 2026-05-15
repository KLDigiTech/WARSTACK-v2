export function createPanel({ title, body }) {
  return `
    <div class="panel">
      <div class="panel-header"><h2>${title}</h2></div>
      <div class="panel-body">${body}</div>
    </div>
  `;
}