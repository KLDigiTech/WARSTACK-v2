export function createTable({ headers = [], rows = '' }) {
  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}