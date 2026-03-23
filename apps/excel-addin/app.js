const state = {
  files: [
    {
      side: 'left',
      label: 'Libro izquierdo',
      role: 'Referencia original',
      fileName: 'Ventas_Q1_Base.xlsx',
      updatedAt: '18 mar 2026 · 09:14',
      sheets: ['Resumen', 'Clientes', 'Forecast'],
      size: '1,8 MB',
    },
    {
      side: 'right',
      label: 'Libro derecho',
      role: 'Versión con cambios detectados',
      fileName: 'Ventas_Q1_Actualizado.xlsx',
      updatedAt: '21 mar 2026 · 16:42',
      sheets: ['Resumen', 'Clientes', 'Forecast'],
      size: '1,9 MB',
    },
  ],
  conflicts: [
    {
      id: 'conf-1',
      sheet: 'Clientes',
      cell: 'D18',
      type: 'Valor distinto',
      leftValue: 'Activo',
      rightValue: 'Inactivo',
      status: 'pending',
      resolution: null,
      description: 'Cambio en el estado operativo del cliente 1042.',
    },
    {
      id: 'conf-2',
      sheet: 'Clientes',
      cell: 'F22',
      type: 'Monto actualizado',
      leftValue: '12500',
      rightValue: '13250',
      status: 'resolved',
      resolution: 'right',
      description: 'Ajuste del importe comprometido para el mes actual.',
    },
    {
      id: 'conf-3',
      sheet: 'Forecast',
      cell: 'B7',
      type: 'Fórmula modificada',
      leftValue: '=SUM(B2:B6)',
      rightValue: '=SUM(B2:B6)-B4',
      status: 'pending',
      resolution: null,
      description: 'La fórmula excluye una línea intermedia en la proyección.',
    },
    {
      id: 'conf-4',
      sheet: 'Resumen',
      cell: 'C4',
      type: 'Texto diferente',
      leftValue: 'Pendiente de revisión',
      rightValue: 'Validado por finanzas',
      status: 'resolved',
      resolution: 'left',
      description: 'Cambio de estado del resumen ejecutivo.',
    },
  ],
  selectedConflictId: 'conf-1',
  filter: 'all',
};

const elements = {
  fileSummary: document.querySelector('#file-summary'),
  activeSheet: document.querySelector('#active-sheet'),
  activeCell: document.querySelector('#active-cell'),
  pendingCount: document.querySelector('#pending-count'),
  resolvedCount: document.querySelector('#resolved-count'),
  conflictCounter: document.querySelector('#conflict-counter'),
  conflictList: document.querySelector('#conflict-list'),
  filter: document.querySelector('#status-filter'),
  detailEmpty: document.querySelector('#detail-empty'),
  detailContent: document.querySelector('#detail-content'),
  detailStatusChip: document.querySelector('#detail-status-chip'),
  detailSheet: document.querySelector('#detail-sheet'),
  detailCell: document.querySelector('#detail-cell'),
  detailType: document.querySelector('#detail-type'),
  leftBookName: document.querySelector('#left-book-name'),
  rightBookName: document.querySelector('#right-book-name'),
  leftValue: document.querySelector('#left-value'),
  rightValue: document.querySelector('#right-value'),
  resolutionMessage: document.querySelector('#resolution-message'),
  acceptLeft: document.querySelector('#accept-left'),
  acceptRight: document.querySelector('#accept-right'),
};

function getSelectedConflict() {
  return state.conflicts.find((conflict) => conflict.id === state.selectedConflictId) ?? null;
}

function getFilteredConflicts() {
  if (state.filter === 'all') {
    return state.conflicts;
  }

  return state.conflicts.filter((conflict) => conflict.status === state.filter);
}

function renderFiles() {
  elements.fileSummary.innerHTML = state.files
    .map(
      (file) => `
        <article class="file-card" aria-label="${file.label}">
          <h3>${file.label}</h3>
          <p>${file.role}</p>
          <strong>${file.fileName}</strong>
          <div class="file-meta-row">
            <span class="file-meta">Actualizado: ${file.updatedAt}</span>
            <span class="file-meta">Tamaño: ${file.size}</span>
            <span class="file-meta">Hojas: ${file.sheets.join(', ')}</span>
            <span class="file-meta">Estado: Cargado correctamente</span>
          </div>
        </article>
      `,
    )
    .join('');
}

function renderSummary() {
  const pending = state.conflicts.filter((conflict) => conflict.status === 'pending').length;
  const resolved = state.conflicts.length - pending;

  elements.pendingCount.textContent = String(pending);
  elements.resolvedCount.textContent = String(resolved);
  elements.conflictCounter.textContent = `${pending} pendientes`;
}

function renderConflictList() {
  const conflicts = getFilteredConflicts();

  if (!conflicts.some((conflict) => conflict.id === state.selectedConflictId) && conflicts.length > 0) {
    state.selectedConflictId = conflicts[0].id;
  }

  if (conflicts.length === 0) {
    elements.conflictList.innerHTML = '<li class="empty-state">No hay conflictos para el filtro seleccionado.</li>';
    renderDetail();
    return;
  }

  elements.conflictList.innerHTML = conflicts
    .map((conflict) => {
      const isActive = conflict.id === state.selectedConflictId;
      const statusClass = conflict.status === 'resolved' ? 'chip-success' : 'chip-pending';
      const statusText = conflict.status === 'resolved' ? 'Resuelto' : 'Pendiente';
      return `
        <li>
          <button class="conflict-item ${isActive ? 'is-active' : ''}" type="button" data-conflict-id="${conflict.id}">
            <div class="conflict-item-header">
              <div>
                <h3 class="conflict-item-title">${conflict.sheet} · ${conflict.cell}</h3>
                <p>${conflict.type}</p>
              </div>
              <span class="chip ${statusClass}">${statusText}</span>
            </div>
            <div class="conflict-item-meta">
              <span>Izquierda: ${conflict.leftValue}</span>
              <span>Derecha: ${conflict.rightValue}</span>
            </div>
          </button>
        </li>
      `;
    })
    .join('');

  elements.conflictList.querySelectorAll('[data-conflict-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedConflictId = button.dataset.conflictId;
      renderConflictList();
      renderDetail();
    });
  });
}

function renderDetail() {
  const conflict = getSelectedConflict();
  const visibleConflict = getFilteredConflicts().find((item) => item.id === state.selectedConflictId) ?? conflict;

  if (!visibleConflict) {
    elements.detailEmpty.hidden = false;
    elements.detailContent.hidden = true;
    elements.detailStatusChip.textContent = 'Sin selección';
    elements.detailStatusChip.className = 'chip chip-neutral';
    elements.activeSheet.textContent = '—';
    elements.activeCell.textContent = '—';
    return;
  }

  const current = visibleConflict;
  const isResolved = current.status === 'resolved';
  const leftBook = state.files.find((file) => file.side === 'left');
  const rightBook = state.files.find((file) => file.side === 'right');

  elements.detailEmpty.hidden = true;
  elements.detailContent.hidden = false;
  elements.detailSheet.textContent = current.sheet;
  elements.detailCell.textContent = current.cell;
  elements.detailType.textContent = current.type;
  elements.leftBookName.textContent = leftBook?.fileName ?? 'Libro izquierdo';
  elements.rightBookName.textContent = rightBook?.fileName ?? 'Libro derecho';
  elements.leftValue.textContent = current.leftValue;
  elements.rightValue.textContent = current.rightValue;
  elements.activeSheet.textContent = current.sheet;
  elements.activeCell.textContent = current.cell;
  elements.detailStatusChip.textContent = isResolved ? 'Resuelto' : 'Pendiente';
  elements.detailStatusChip.className = `chip ${isResolved ? 'chip-success' : 'chip-pending'}`;

  if (!isResolved) {
    elements.resolutionMessage.textContent = `${current.description} Este conflicto sigue pendiente.`;
  } else if (current.resolution === 'left') {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió aceptando el valor izquierdo.`;
  } else {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió aceptando el valor derecho.`;
  }

  elements.acceptLeft.disabled = isResolved && current.resolution === 'left';
  elements.acceptRight.disabled = isResolved && current.resolution === 'right';
}

function resolveConflict(side) {
  const conflict = getSelectedConflict();
  if (!conflict) {
    return;
  }

  conflict.status = 'resolved';
  conflict.resolution = side;
  renderSummary();
  renderConflictList();
  renderDetail();
}

function bindEvents() {
  elements.filter.addEventListener('change', (event) => {
    state.filter = event.target.value;
    renderConflictList();
    renderDetail();
  });

  elements.acceptLeft.addEventListener('click', () => resolveConflict('left'));
  elements.acceptRight.addEventListener('click', () => resolveConflict('right'));
}

function init() {
  renderFiles();
  renderSummary();
  renderConflictList();
  renderDetail();
  bindEvents();
}

init();
