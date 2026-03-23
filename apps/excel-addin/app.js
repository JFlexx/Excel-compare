import { validateManualEdit } from './src/manual-edit.js';

const DEMO_FILES = Object.freeze([
  {
    side: 'left',
    label: 'Libro base',
    role: 'Referencia original',
    fileName: 'Ventas_Q1_Base.xlsx',
    updatedAt: '18 mar 2026 · 09:14',
    sheets: ['Resumen', 'Clientes', 'Forecast'],
  },
  {
    side: 'right',
    label: 'Libro comparado',
    role: 'Versión con cambios detectados',
    fileName: 'Ventas_Q1_Actualizado.xlsx',
    updatedAt: '21 mar 2026 · 16:42',
    sheets: ['Resumen', 'Clientes', 'Forecast', 'Supuestos'],
  },
]);

const DEMO_CONFLICTS = Object.freeze([
  {
    id: 'conf-1',
    sheet: 'Clientes',
    cell: 'D18',
    type: 'Valor distinto',
    description: 'Cambio de valor simple en una celda existente en ambos lados.',
    leftSource: { value: 'Activo', displayValue: 'Activo', type: 'string' },
    rightSource: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string' },
    supportsManualEdit: true,
  },
  {
    id: 'conf-2',
    sheet: 'Forecast',
    cell: 'B7',
    type: 'Fórmula simple distinta',
    description: 'La fórmula excluye una línea intermedia en la proyección.',
    leftSource: { value: '=SUM(B2:B6)', displayValue: '=SUM(B2:B6)', type: 'formula' },
    rightSource: { value: '=SUM(B2:B6)-B4', displayValue: '=SUM(B2:B6)-B4', type: 'formula' },
    supportsManualEdit: true,
  },
  {
    id: 'conf-3',
    sheet: 'Supuestos',
    cell: 'Hoja completa',
    type: 'Hoja agregada',
    description: 'La hoja solo existe en el archivo comparado y puede aceptarse completa.',
    leftSource: { value: 'No existe en archivo base', displayValue: 'No existe en archivo base', type: 'string' },
    rightSource: { value: 'Nueva hoja con supuestos comerciales', displayValue: 'Nueva hoja con supuestos comerciales', type: 'string' },
    supportsManualEdit: false,
  },
]);

const state = {
  files: [],
  conflicts: [],
  selectedConflictId: null,
  filter: 'all',
  exportStatus: { tone: 'neutral', message: 'Carga la sesión para habilitar la exportación.' },
  sessionStatus: 'Sin sesión cargada',
};

const elements = {
  compareForm: document.getElementById('compare-form'),
  baseWorkbookPath: document.getElementById('base-workbook-path'),
  comparedWorkbookPath: document.getElementById('compared-workbook-path'),
  compareStatus: document.getElementById('compare-status'),
  fileSummary: document.getElementById('file-summary'),
  summarySheets: document.getElementById('summary-sheets'),
  summaryPending: document.getElementById('summary-pending'),
  summaryResolved: document.getElementById('summary-resolved'),
  progressPercent: document.getElementById('progress-percent'),
  conflictCounter: document.getElementById('conflict-counter'),
  statusFilter: document.getElementById('status-filter'),
  conflictList: document.getElementById('conflict-list'),
  detailEmpty: document.getElementById('detail-empty'),
  detailContent: document.getElementById('detail-content'),
  detailStatusChip: document.getElementById('detail-status-chip'),
  detailSheet: document.getElementById('detail-sheet'),
  detailCell: document.getElementById('detail-cell'),
  detailType: document.getElementById('detail-type'),
  detailDescription: document.getElementById('detail-description'),
  leftBookName: document.getElementById('left-book-name'),
  rightBookName: document.getElementById('right-book-name'),
  leftValue: document.getElementById('left-value'),
  rightValue: document.getElementById('right-value'),
  acceptLeft: document.getElementById('accept-left'),
  acceptRight: document.getElementById('accept-right'),
  manualEditScope: document.getElementById('manual-edit-scope'),
  manualEditInput: document.getElementById('manual-edit-input'),
  manualEditHelp: document.getElementById('manual-edit-help'),
  saveManual: document.getElementById('save-manual'),
  clearManual: document.getElementById('clear-manual'),
  resolutionMessage: document.getElementById('resolution-message'),
  finalValue: document.getElementById('final-value'),
  resolutionOrigin: document.getElementById('resolution-origin'),
  exportButton: document.getElementById('export-button'),
  exportMessage: document.getElementById('export-message'),
};

function initApp() {
  elements.compareForm.addEventListener('submit', handleLoadSession);
  elements.statusFilter.addEventListener('change', handleFilterChange);
  elements.conflictList.addEventListener('click', handleConflictSelection);
  elements.acceptLeft.addEventListener('click', () => applySideDecision('left'));
  elements.acceptRight.addEventListener('click', () => applySideDecision('right'));
  elements.saveManual.addEventListener('click', handleManualSave);
  elements.clearManual.addEventListener('click', clearManualDraft);
  elements.exportButton.addEventListener('click', handleExport);

  render();
}

function handleLoadSession(event) {
  event.preventDefault();

  const leftName = normalizeFileName(elements.baseWorkbookPath.value, DEMO_FILES[0].fileName);
  const rightName = normalizeFileName(elements.comparedWorkbookPath.value, DEMO_FILES[1].fileName);

  state.files = [
    { ...DEMO_FILES[0], fileName: leftName },
    { ...DEMO_FILES[1], fileName: rightName },
  ];
  state.conflicts = DEMO_CONFLICTS.map((conflict) => ({
    ...conflict,
    leftValue: conflict.leftSource.displayValue,
    rightValue: conflict.rightSource.displayValue,
    status: 'pending',
    resolution: null,
    manualValue: '',
  }));
  state.selectedConflictId = state.conflicts[0]?.id ?? null;
  state.filter = 'all';
  state.sessionStatus = `Sesión demo cargada con ${state.conflicts.length} conflictos listos para revisar.`;
  state.exportStatus = { tone: 'neutral', message: 'Sesión cargada. Resuelve o edita conflictos antes de exportar.' };
  elements.statusFilter.value = 'all';
  render();
}

function handleFilterChange(event) {
  state.filter = event.target.value;
  const visible = getVisibleConflicts();
  if (!visible.some((conflict) => conflict.id === state.selectedConflictId)) {
    state.selectedConflictId = visible[0]?.id ?? null;
  }
  render();
}

function handleConflictSelection(event) {
  const button = event.target.closest('[data-conflict-id]');
  if (!button) {
    return;
  }

  state.selectedConflictId = button.dataset.conflictId;
  render();
}

function applySideDecision(side) {
  const conflict = getSelectedConflict();
  if (!conflict) {
    return;
  }

  updateConflict(conflict.id, {
    status: 'resolved',
    resolution: side,
    manualValue: '',
  });

  state.exportStatus = {
    tone: 'neutral',
    message: `Se guardó la decisión de ${side === 'left' ? 'izquierda' : 'derecha'} para ${conflict.sheet} ${conflict.cell}.`,
  };
  render();
}

function handleManualSave() {
  const conflict = getSelectedConflict();
  if (!conflict) {
    return;
  }

  const draft = elements.manualEditInput.value.trim();
  const validation = validateManualEdit(
    {
      sourceA: conflict.leftSource,
      sourceB: conflict.rightSource,
    },
    draft,
  );

  if (!conflict.supportsManualEdit) {
    state.exportStatus = { tone: 'critical', message: 'Este conflicto no admite edición manual en el MVP.' };
    render();
    return;
  }

  if (!validation.valid) {
    elements.manualEditHelp.textContent = validation.error;
    elements.manualEditHelp.className = 'manual-edit-help is-error';
    return;
  }

  updateConflict(conflict.id, {
    status: 'manual',
    resolution: 'manual',
    manualValue: validation.displayValue,
  });

  state.exportStatus = {
    tone: 'neutral',
    message: `Edición manual guardada para ${conflict.sheet} ${conflict.cell}.`,
  };
  render();
}

function clearManualDraft() {
  elements.manualEditInput.value = '';
  const conflict = getSelectedConflict();
  elements.manualEditHelp.textContent = conflict?.supportsManualEdit
    ? 'Puedes guardar un valor final o una fórmula simple que empiece por =.'
    : 'La edición manual no está disponible para este conflicto.';
  elements.manualEditHelp.className = 'manual-edit-help';
}

function handleExport() {
  if (state.conflicts.length === 0) {
    state.exportStatus = { tone: 'critical', message: 'Primero debes cargar una sesión.' };
    renderExportStatus();
    return;
  }

  const pending = state.conflicts.filter((conflict) => conflict.status === 'pending').length;
  if (pending > 0) {
    state.exportStatus = {
      tone: 'critical',
      message: `No se puede exportar todavía: quedan ${pending} conflicto(s) pendientes.`,
    };
    renderExportStatus();
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    files: state.files,
    conflicts: state.conflicts.map((conflict) => ({
      id: conflict.id,
      sheet: conflict.sheet,
      cell: conflict.cell,
      resolution: conflict.resolution,
      finalValue: getFinalValue(conflict),
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'excel-compare-mvp-export.json';
  link.click();
  URL.revokeObjectURL(url);

  state.exportStatus = {
    tone: 'success',
    message: 'Exportación lista. Se descargó el resumen JSON del merge MVP.',
  };
  renderExportStatus();
}

function render() {
  renderSummary();
  renderFiles();
  renderConflictList();
  renderDetail();
  renderExportStatus();
  elements.compareStatus.textContent = state.sessionStatus;
}

function renderSummary() {
  const resolved = state.conflicts.filter((conflict) => conflict.status !== 'pending').length;
  const pending = state.conflicts.filter((conflict) => conflict.status === 'pending').length;
  const total = state.conflicts.length;
  const sheetCount = new Set(state.conflicts.map((conflict) => conflict.sheet)).size;
  const progress = total === 0 ? 0 : Math.round((resolved / total) * 100);

  elements.summarySheets.textContent = String(sheetCount);
  elements.summaryPending.textContent = String(pending);
  elements.summaryResolved.textContent = String(resolved);
  elements.progressPercent.textContent = `${progress}%`;
  elements.conflictCounter.textContent = total === 0
    ? 'Sin conflictos'
    : `${getVisibleConflicts().length} visibles · ${pending} pendientes`;
}

function renderFiles() {
  if (state.files.length === 0) {
    elements.fileSummary.innerHTML = '<p class="helper-text">Carga la sesión para ver el resumen de los workbooks.</p>';
    return;
  }

  elements.fileSummary.innerHTML = state.files.map((file) => `
    <article class="file-card">
      <span class="file-side">${escapeHtml(file.label)}</span>
      <h3>${escapeHtml(file.fileName)}</h3>
      <p>${escapeHtml(file.role)}</p>
      <dl class="file-meta-grid">
        <div><dt>Actualizado</dt><dd>${escapeHtml(file.updatedAt)}</dd></div>
        <div><dt>Hojas</dt><dd>${escapeHtml(file.sheets.join(', '))}</dd></div>
      </dl>
    </article>
  `).join('');
}

function renderConflictList() {
  const visibleConflicts = getVisibleConflicts();

  if (visibleConflicts.length === 0) {
    elements.conflictList.innerHTML = '<li class="empty-list">No hay conflictos para este filtro.</li>';
    return;
  }

  elements.conflictList.innerHTML = visibleConflicts.map((conflict) => {
    const activeClass = conflict.id === state.selectedConflictId ? 'is-active' : '';
    return `
      <li>
        <button type="button" class="conflict-item ${activeClass}" data-conflict-id="${conflict.id}">
          <div class="conflict-item-header">
            <strong>${escapeHtml(conflict.sheet)} · ${escapeHtml(conflict.cell)}</strong>
            <span class="chip ${statusChipClass(conflict.status)}">${statusLabel(conflict.status)}</span>
          </div>
          <p class="conflict-item-type">${escapeHtml(conflict.type)}</p>
          <p class="conflict-item-description">${escapeHtml(conflict.description)}</p>
        </button>
      </li>
    `;
  }).join('');
}

function renderDetail() {
  const conflict = getSelectedConflict();

  if (!conflict) {
    elements.detailEmpty.hidden = false;
    elements.detailContent.hidden = true;
    elements.detailStatusChip.textContent = 'Sin selección';
    return;
  }

  elements.detailEmpty.hidden = true;
  elements.detailContent.hidden = false;
  elements.detailStatusChip.textContent = statusLabel(conflict.status);
  elements.detailStatusChip.className = `chip ${statusChipClass(conflict.status)}`;
  elements.detailSheet.textContent = conflict.sheet;
  elements.detailCell.textContent = conflict.cell;
  elements.detailType.textContent = conflict.type;
  elements.detailDescription.textContent = conflict.description;
  elements.leftBookName.textContent = state.files[0]?.fileName ?? 'Libro base';
  elements.rightBookName.textContent = state.files[1]?.fileName ?? 'Libro comparado';
  elements.leftValue.textContent = conflict.leftValue;
  elements.rightValue.textContent = conflict.rightValue;
  elements.manualEditInput.value = conflict.manualValue ?? '';
  elements.manualEditInput.disabled = !conflict.supportsManualEdit;
  elements.saveManual.disabled = !conflict.supportsManualEdit;
  elements.manualEditScope.textContent = conflict.supportsManualEdit ? 'Dentro del alcance' : 'Fuera del alcance';
  elements.manualEditScope.className = `chip ${conflict.supportsManualEdit ? 'chip-neutral' : 'chip-danger'}`;
  elements.manualEditHelp.textContent = conflict.supportsManualEdit
    ? 'Puedes guardar un valor final o una fórmula simple que empiece por =.'
    : 'La edición manual no está disponible para hojas completas en este MVP.';
  elements.manualEditHelp.className = 'manual-edit-help';
  elements.resolutionMessage.textContent = buildResolutionMessage(conflict);
  elements.finalValue.textContent = getFinalValue(conflict);
  elements.resolutionOrigin.textContent = resolutionOrigin(conflict);
}

function renderExportStatus() {
  elements.exportMessage.textContent = state.exportStatus.message;
  elements.exportMessage.className = `export-message tone-${state.exportStatus.tone}`;
}

function updateConflict(conflictId, patch) {
  state.conflicts = state.conflicts.map((conflict) => conflict.id === conflictId ? { ...conflict, ...patch } : conflict);
}

function getVisibleConflicts() {
  if (state.filter === 'all') {
    return state.conflicts;
  }

  return state.conflicts.filter((conflict) => conflict.status === state.filter);
}

function getSelectedConflict() {
  return state.conflicts.find((conflict) => conflict.id === state.selectedConflictId) ?? null;
}

function getFinalValue(conflict) {
  if (conflict.resolution === 'manual') {
    return conflict.manualValue || 'Pendiente';
  }

  if (conflict.resolution === 'left') {
    return conflict.leftValue;
  }

  if (conflict.resolution === 'right') {
    return conflict.rightValue;
  }

  return 'Pendiente';
}

function buildResolutionMessage(conflict) {
  if (conflict.resolution === 'left') {
    return 'Se conservará el valor del libro base.';
  }
  if (conflict.resolution === 'right') {
    return 'Se conservará el valor del libro comparado.';
  }
  if (conflict.resolution === 'manual') {
    return 'Se guardó una edición manual para el resultado final.';
  }
  return 'Pendiente de resolución.';
}

function resolutionOrigin(conflict) {
  if (conflict.resolution === 'manual') {
    return 'Edición manual';
  }
  if (conflict.resolution === 'left' || conflict.resolution === 'right') {
    return 'Selección directa';
  }
  return 'Sin resolver';
}

function statusChipClass(status) {
  if (status === 'resolved') {
    return 'chip-success';
  }
  if (status === 'manual') {
    return 'chip-manual';
  }
  return 'chip-alert';
}

function statusLabel(status) {
  if (status === 'resolved') {
    return 'Resuelto';
  }
  if (status === 'manual') {
    return 'Manual';
  }
  return 'Pendiente';
}

function normalizeFileName(rawValue, fallback) {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.split(/[/\\]/).pop() || fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

initApp();
