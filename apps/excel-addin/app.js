import { compareSelectedWorkbookFiles } from './src/compare-session.js';

const state = {
  selections: {
    basePath: '',
    comparedPath: '',
  },
  session: null,
  filter: 'all',
  selectedConflictId: null,
  error: null,
  isLoading: false,
};

const elements = {
  compareForm: document.querySelector('#compare-form'),
  basePath: document.querySelector('#base-workbook-path'),
  comparedPath: document.querySelector('#compared-workbook-path'),
  compareButton: document.querySelector('#run-compare'),
  compareError: document.querySelector('#compare-error'),
  compareStatus: document.querySelector('#compare-status'),
  fileSummary: document.querySelector('#file-summary'),
  summarySheets: document.querySelector('#summary-sheets'),
  summaryPending: document.querySelector('#summary-pending'),
  summaryAutoResolved: document.querySelector('#summary-auto-resolved'),
  summaryLines: document.querySelector('#summary-lines'),
  activeSheet: document.querySelector('#active-sheet'),
  activeCell: document.querySelector('#active-cell'),
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
};

function getConflicts() {
  return state.session?.conflicts ?? [];
}

function getSelectedConflict() {
  return getConflicts().find((conflict) => conflict.id === state.selectedConflictId) ?? null;
}

function getFilteredConflicts() {
  const conflicts = getConflicts();
  if (state.filter === 'all') {
    return conflicts;
  }

  if (state.filter === 'pending') {
    return conflicts.filter((conflict) => conflict.finalState === 'unresolved');
  }

  return conflicts.filter((conflict) => conflict.finalState !== 'unresolved');
}

function renderFiles() {
  const files = state.session
    ? [
        {
          label: 'Libro base',
          role: 'Referencia original',
          fileName: state.session.sourceA.label,
          workbookId: state.session.sourceA.workbookId,
          sheetCount: state.session.sourceA.worksheetCount,
          cellCount: state.session.sourceA.cellCount,
          sheetOrder: state.session.sourceA.sheetOrder,
        },
        {
          label: 'Libro comparado',
          role: 'Versión con cambios',
          fileName: state.session.sourceB.label,
          workbookId: state.session.sourceB.workbookId,
          sheetCount: state.session.sourceB.worksheetCount,
          cellCount: state.session.sourceB.cellCount,
          sheetOrder: state.session.sourceB.sheetOrder,
        },
      ]
    : [
        {
          label: 'Libro base',
          role: 'Selecciona la ruta del workbook de referencia para iniciar la comparación.',
          fileName: state.selections.basePath || 'Pendiente de selección',
          workbookId: '—',
          sheetCount: '—',
          cellCount: '—',
          sheetOrder: [],
        },
        {
          label: 'Libro comparado',
          role: 'Selecciona la ruta del workbook con cambios para generar la sesión inicial.',
          fileName: state.selections.comparedPath || 'Pendiente de selección',
          workbookId: '—',
          sheetCount: '—',
          cellCount: '—',
          sheetOrder: [],
        },
      ];

  elements.fileSummary.innerHTML = files
    .map((file) => `
      <article class="file-card" aria-label="${file.label}">
        <h3>${file.label}</h3>
        <p>${file.role}</p>
        <strong>${file.fileName}</strong>
        <div class="file-meta-row">
          <span class="file-meta">Workbook ID: ${file.workbookId}</span>
          <span class="file-meta">Hojas: ${file.sheetCount}</span>
          <span class="file-meta">Celdas canónicas: ${file.cellCount}</span>
          <span class="file-meta">Orden: ${file.sheetOrder.length > 0 ? file.sheetOrder.join(', ') : '—'}</span>
        </div>
      </article>
    `)
    .join('');
}

function renderSummary() {
  const summary = state.session?.summary;
  elements.summarySheets.textContent = String(summary?.affectedWorksheetCount ?? 0);
  elements.summaryPending.textContent = String(summary?.pendingConflictCount ?? 0);
  elements.summaryAutoResolved.textContent = String(summary?.autoResolvedCount ?? 0);
  elements.conflictCounter.textContent = `${summary?.pendingConflictCount ?? 0} pendientes`;
  elements.compareStatus.textContent = state.session
    ? `Sesión ${state.session.status} · ${state.session.sessionId}`
    : 'Selecciona ambos workbooks para generar la sesión inicial.';

  const lines = summary?.visibleSummaryLines ?? ['Aún no hay una sesión de comparación generada.'];
  elements.summaryLines.innerHTML = lines.map((line) => `<li>${line}</li>`).join('');
}

function renderConflictList() {
  const conflicts = getFilteredConflicts();

  if (!conflicts.some((conflict) => conflict.id === state.selectedConflictId)) {
    state.selectedConflictId = conflicts[0]?.id ?? null;
  }

  if (conflicts.length === 0) {
    elements.conflictList.innerHTML = '<li class="empty-state">No hay conflictos para el filtro seleccionado.</li>';
    renderDetail();
    return;
  }

  elements.conflictList.innerHTML = conflicts
    .map((conflict) => {
      const isActive = conflict.id === state.selectedConflictId;
      const isResolved = conflict.finalState !== 'unresolved';
      const statusClass = isResolved ? 'chip-success' : 'chip-pending';
      const statusText = isResolved ? 'Resuelto' : 'Pendiente';
      return `
        <li>
          <button class="conflict-item ${isActive ? 'is-active' : ''}" type="button" data-conflict-id="${conflict.id}">
            <div class="conflict-item-header">
              <div>
                <h3 class="conflict-item-title">${conflict.location?.worksheetName ?? 'Hoja'} · ${conflict.location?.rangeA1 ?? conflict.location?.a1 ?? '—'}</h3>
                <p>${conflict.reason ?? 'Requiere validación manual.'}</p>
              </div>
              <span class="chip ${statusClass}">${statusText}</span>
            </div>
            <div class="conflict-item-meta">
              <span>Base: ${formatConflictValue(conflict.sourceA)}</span>
              <span>Comparado: ${formatConflictValue(conflict.sourceB)}</span>
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
  if (!conflict) {
    elements.detailEmpty.hidden = false;
    elements.detailContent.hidden = true;
    elements.detailStatusChip.textContent = 'Sin selección';
    elements.detailStatusChip.className = 'chip chip-neutral';
    elements.activeSheet.textContent = '—';
    elements.activeCell.textContent = '—';
    return;
  }

  elements.detailEmpty.hidden = false;
  elements.detailContent.hidden = false;
  elements.detailStatusChip.textContent = conflict.finalState === 'unresolved' ? 'Pendiente' : 'Resuelto';
  elements.detailStatusChip.className = `chip ${conflict.finalState === 'unresolved' ? 'chip-pending' : 'chip-success'}`;
  elements.detailSheet.textContent = conflict.location?.worksheetName ?? '—';
  elements.detailCell.textContent = conflict.location?.rangeA1 ?? conflict.location?.a1 ?? '—';
  elements.detailType.textContent = conflict.changeType ?? 'conflict';
  elements.leftBookName.textContent = state.session?.sourceA?.label ?? 'Libro base';
  elements.rightBookName.textContent = state.session?.sourceB?.label ?? 'Libro comparado';
  elements.leftValue.textContent = formatConflictValue(conflict.sourceA);
  elements.rightValue.textContent = formatConflictValue(conflict.sourceB);
  elements.activeSheet.textContent = conflict.location?.worksheetName ?? '—';
  elements.activeCell.textContent = conflict.location?.rangeA1 ?? conflict.location?.a1 ?? '—';
  elements.resolutionMessage.textContent = conflict.reason ?? 'Este conflicto requiere una decisión del usuario antes del merge final.';
}

function formatConflictValue(side) {
  if (!side?.exists) {
    return 'Sin valor';
  }

  if (side.formula) {
    return side.formula;
  }

  return side.displayValue ?? String(side.value ?? '');
}

function renderError() {
  elements.compareError.hidden = !state.error;
  elements.compareError.textContent = state.error ?? '';
}

async function handleCompareSubmit(event) {
  event.preventDefault();
  state.isLoading = true;
  state.error = null;
  renderError();
  elements.compareButton.disabled = true;
  elements.compareButton.textContent = 'Comparando…';

  try {
    const session = compareSelectedWorkbookFiles({
      baseWorkbook: {
        path: state.selections.basePath,
        label: getFileName(state.selections.basePath),
      },
      comparedWorkbook: {
        path: state.selections.comparedPath,
        label: getFileName(state.selections.comparedPath),
      },
    });

    state.session = session;
    state.selectedConflictId = session.conflicts[0]?.id ?? null;
    renderFiles();
    renderSummary();
    renderConflictList();
    renderDetail();
  } catch (error) {
    state.session = null;
    state.selectedConflictId = null;
    state.error = error instanceof Error ? error.message : 'No se pudo generar la sesión inicial.';
    renderFiles();
    renderSummary();
    renderConflictList();
    renderDetail();
    renderError();
  } finally {
    state.isLoading = false;
    elements.compareButton.disabled = !canCompare();
    elements.compareButton.textContent = 'Comparar workbooks';
    renderError();
  }
}

function bindEvents() {
  elements.basePath.addEventListener('input', (event) => {
    state.selections.basePath = event.target.value.trim();
    elements.compareButton.disabled = !canCompare();
    renderFiles();
  });

  elements.comparedPath.addEventListener('input', (event) => {
    state.selections.comparedPath = event.target.value.trim();
    elements.compareButton.disabled = !canCompare();
    renderFiles();
  });

  elements.filter.addEventListener('change', (event) => {
    state.filter = event.target.value;
    renderConflictList();
    renderDetail();
  });

  elements.compareForm.addEventListener('submit', handleCompareSubmit);
}

function canCompare() {
  return state.selections.basePath.length > 0 && state.selections.comparedPath.length > 0 && !state.isLoading;
}

function getFileName(filePath) {
  return String(filePath).split(/[/\\]/).filter(Boolean).pop() ?? String(filePath);
}

function init() {
  renderFiles();
  renderSummary();
  renderConflictList();
  renderDetail();
  renderError();
  elements.compareButton.disabled = !canCompare();
  bindEvents();
}

init();
