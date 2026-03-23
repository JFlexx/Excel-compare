const state = {
  files: [
    {
      side: 'left',
      label: 'Archivo base',
      role: 'Referencia original',
      fileName: 'Ventas_Q1_Base.xlsx',
      updatedAt: '18 mar 2026 · 09:14',
      sheets: ['Resumen', 'Clientes', 'Forecast'],
      size: '1,8 MB',
      pilotValidation: 'Dentro del piloto',
    },
    {
      side: 'right',
      label: 'Archivo comparado',
      role: 'Versión con cambios detectados',
      fileName: 'Ventas_Q1_Actualizado.xlsx',
      updatedAt: '21 mar 2026 · 16:42',
      sheets: ['Resumen', 'Clientes', 'Forecast', 'Supuestos'],
      size: '1,9 MB',
      pilotValidation: 'Dentro del piloto',
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
      manualValue: '',
      supportsManualEdit: true,
      description: 'Cambio de valor simple en una celda existente en ambos lados.',
    },
    {
      id: 'conf-2',
      sheet: 'Forecast',
      cell: 'B7',
      type: 'Fórmula simple distinta',
      leftValue: '=SUM(B2:B6)',
      rightValue: '=SUM(B2:B6)-B4',
      status: 'manual',
      resolution: 'manual',
      manualValue: '=SUM(B2:B6)-B5',
      supportsManualEdit: true,
      description: 'La fórmula sigue siendo de una sola celda y se puede editar manualmente con una expresión simple.',
    },
    {
      id: 'conf-3',
      sheet: 'Supuestos',
      cell: 'Hoja completa',
      type: 'Hoja agregada',
      leftValue: 'No existe en archivo base',
      rightValue: 'Nueva hoja con supuestos comerciales',
      status: 'resolved',
      resolution: 'right',
      manualValue: '',
      supportsManualEdit: false,
      description: 'La hoja solo existe en el archivo comparado y puede aceptarse completa.',
    },
    {
      id: 'conf-4',
      sheet: 'Resumen histórico',
      cell: 'Hoja completa',
      type: 'Hoja eliminada',
      leftValue: 'Hoja presente en archivo base',
      rightValue: 'No existe en archivo comparado',
      status: 'pending',
      resolution: null,
      manualValue: '',
      supportsManualEdit: false,
      description: 'Caso sencillo de hoja eliminada. Se resuelve aceptando izquierda o derecha para la hoja completa.',
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
  manualEditInput: document.querySelector('#manual-edit-input'),
  manualEditHelp: document.querySelector('#manual-edit-help'),
  manualEditScope: document.querySelector('#manual-edit-scope'),
  saveManual: document.querySelector('#save-manual'),
  clearManual: document.querySelector('#clear-manual'),
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

function getStatusMeta(status) {
  if (status === 'resolved') {
    return { className: 'chip-success', text: 'Resuelto' };
  }

  if (status === 'manual') {
    return { className: 'chip-manual', text: 'Editado manualmente' };
  }

  return { className: 'chip-pending', text: 'Pendiente' };
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
            <span class="file-meta">Validación piloto: ${file.pilotValidation}</span>
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
    elements.conflictList.innerHTML = '<li class="empty-state">No hay conflictos para los filtros seleccionados.</li>';
    renderDetail();
    return;
  }

  elements.conflictList.innerHTML = conflicts
    .map((conflict) => {
      const isActive = conflict.id === state.selectedConflictId;
      const statusMeta = getStatusMeta(conflict.status);

      return `
        <li>
          <button class="conflict-item ${isActive ? 'is-active' : ''}" type="button" data-conflict-id="${conflict.id}">
            <div class="conflict-item-header">
              <div>
                <h3 class="conflict-item-title">${conflict.sheet} · ${conflict.cell}</h3>
                <p>${conflict.type}</p>
              </div>
              <span class="chip ${statusMeta.className}">${statusMeta.text}</span>
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
  const statusMeta = getStatusMeta(current.status);
  const leftBook = state.files.find((file) => file.side === 'left');
  const rightBook = state.files.find((file) => file.side === 'right');
  const manualAllowed = current.supportsManualEdit;

  elements.detailEmpty.hidden = true;
  elements.detailContent.hidden = false;
  elements.detailSheet.textContent = current.sheet;
  elements.detailCell.textContent = current.cell;
  elements.detailType.textContent = current.type;
  elements.leftBookName.textContent = leftBook?.fileName ?? 'Archivo base';
  elements.rightBookName.textContent = rightBook?.fileName ?? 'Archivo comparado';
  elements.leftValue.textContent = current.leftValue;
  elements.rightValue.textContent = current.rightValue;
  elements.activeSheet.textContent = current.sheet;
  elements.activeCell.textContent = current.cell;
  elements.detailStatusChip.textContent = statusMeta.text;
  elements.detailStatusChip.className = `chip ${statusMeta.className}`;
  elements.manualEditInput.value = current.manualValue ?? '';

  if (current.status === 'pending') {
    elements.resolutionMessage.textContent = `${current.description} Este conflicto sigue pendiente.`;
  } else if (current.status === 'manual') {
    elements.resolutionMessage.textContent = `${current.description} Se registró una edición manual básica o un comentario operativo del piloto.`;
  } else if (current.resolution === 'left') {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió aceptando el valor izquierdo.`;
  } else {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió aceptando el valor derecho.`;
  }

  elements.acceptLeft.disabled = current.status === 'resolved' && current.resolution === 'left';
  elements.acceptRight.disabled = current.status === 'resolved' && current.resolution === 'right';
  elements.manualEditInput.disabled = !manualAllowed;
  elements.saveManual.disabled = !manualAllowed;
  elements.clearManual.disabled = !manualAllowed;
  elements.manualEditScope.textContent = manualAllowed ? 'Dentro del alcance' : 'Fuera del alcance';
  elements.manualEditScope.className = `chip ${manualAllowed ? 'chip-neutral' : 'chip-alert'}`;
  elements.manualEditHelp.textContent = manualAllowed
    ? 'La edición manual básica solo está disponible para valores y fórmulas simples.'
    : 'La edición manual básica solo está disponible para valores y fórmulas simples.';
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

function validateManualValue(conflict, rawValue) {
  const trimmed = rawValue.trim();
  if (!conflict.supportsManualEdit) {
    return 'La edición manual básica solo está disponible para valores y fórmulas simples.';
  }

  if (!trimmed) {
    return 'El valor final no puede estar vacío.';
  }

  if (conflict.type === 'Fórmula simple distinta' && !trimmed.startsWith('=')) {
    return "Las fórmulas manuales deben empezar por '='.";
  }

  return null;
}

function saveManualEdit() {
  const conflict = getSelectedConflict();
  if (!conflict) {
    return;
  }

  const rawValue = elements.manualEditInput.value;
  const validationMessage = validateManualValue(conflict, rawValue);
  if (validationMessage) {
    elements.manualEditHelp.textContent = validationMessage;
    return;
  }

  conflict.status = 'manual';
  conflict.resolution = 'manual';
  conflict.manualValue = rawValue.trim();
  elements.manualEditHelp.textContent = 'Se guardó una edición manual básica para este conflicto.';
  renderSummary();
  renderConflictList();
  renderDetail();
}

function clearManualEditDraft() {
  const conflict = getSelectedConflict();
  if (!conflict || !conflict.supportsManualEdit) {
    return;
  }

  elements.manualEditInput.value = conflict.manualValue ?? '';
  elements.manualEditHelp.textContent = 'La edición manual básica solo está disponible para valores y fórmulas simples.';
}

function bindEvents() {
  elements.filter.addEventListener('change', (event) => {
    state.filter = event.target.value;
    renderConflictList();
    renderDetail();
  });

  elements.acceptLeft.addEventListener('click', () => resolveConflict('left'));
  elements.acceptRight.addEventListener('click', () => resolveConflict('right'));
  elements.saveManual.addEventListener('click', saveManualEdit);
  elements.clearManual.addEventListener('click', clearManualEditDraft);
}

function init() {
  renderFiles();
  renderSummary();
  renderConflictList();
  renderDetail();
  bindEvents();
}

init();
