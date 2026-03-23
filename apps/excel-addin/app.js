import { buildFinalReviewModel, generateFinalWorkbookArtifacts, triggerWorkbookDownload } from './src/final-review.js';
import { createUserErrorView, recordAddinError } from './src/error-presenter.js';

const state = {
  logger: {
    error(payload) {
      console.error(payload);
    },
  },
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
  session: buildDemoSession(),
  selectedConflictId: 'conf-1',
  filter: 'all',
  exportFileName: 'ventas_q1_base__merge__2026-03-23_18-00-00.xlsx',
  reviewMessage: null,
  exportStatus: 'idle',
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
  finalBanner: document.querySelector('#final-banner'),
  finalConsistency: document.querySelector('#final-consistency'),
  finalResolvedList: document.querySelector('#final-resolved-list'),
  finalDecisionTypes: document.querySelector('#final-decision-types'),
  finalSheets: document.querySelector('#final-sheets'),
  finalPendingList: document.querySelector('#final-pending-list'),
  exportFileName: document.querySelector('#export-file-name'),
  exportButton: document.querySelector('#export-button'),
  exportMessage: document.querySelector('#export-message'),
};

function buildDemoSession() {
  return {
    sessionId: 'merge-session:ventas-q1',
    updatedAt: '2026-03-23T18:00:00Z',
    sourceA: { workbookId: 'wb-left', label: 'Ventas_Q1_Base.xlsx' },
    sourceB: { workbookId: 'wb-right', label: 'Ventas_Q1_Actualizado.xlsx' },
    sourceAWorkbook: {
      workbookId: 'wb-left',
      label: 'Ventas_Q1_Base.xlsx',
      worksheets: [
        {
          id: 'ws:Resumen:0',
          name: 'Resumen',
          index: 0,
          cells: {
            C4: { value: 'Pendiente de revisión', displayValue: 'Pendiente de revisión', type: 'string', exists: true },
          },
        },
        {
          id: 'ws:Clientes:1',
          name: 'Clientes',
          index: 1,
          cells: {
            D18: { value: 'Activo', displayValue: 'Activo', type: 'string', exists: true },
            F22: { value: 12500, displayValue: '12500', type: 'number', exists: true },
          },
        },
        {
          id: 'ws:Forecast:2',
          name: 'Forecast',
          index: 2,
          cells: {
            B7: { value: '=SUM(B2:B6)', displayValue: '=SUM(B2:B6)', formula: '=SUM(B2:B6)', type: 'formula', exists: true },
          },
        },
      ],
    },
    sourceBWorkbook: {
      workbookId: 'wb-right',
      label: 'Ventas_Q1_Actualizado.xlsx',
      worksheets: [
        {
          id: 'ws:Resumen:0',
          name: 'Resumen',
          index: 0,
          cells: {
            C4: { value: 'Validado por finanzas', displayValue: 'Validado por finanzas', type: 'string', exists: true },
          },
        },
        {
          id: 'ws:Clientes:1',
          name: 'Clientes',
          index: 1,
          cells: {
            D18: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string', exists: true },
            F22: { value: 13250, displayValue: '13250', type: 'number', exists: true },
          },
        },
        {
          id: 'ws:Forecast:2',
          name: 'Forecast',
          index: 2,
          cells: {
            B7: { value: '=SUM(B2:B6)-B4', displayValue: '=SUM(B2:B6)-B4', formula: '=SUM(B2:B6)-B4', type: 'formula', exists: true },
          },
        },
      ],
    },
    workbookDiff: {
      id: 'wbd:wb-left:wb-right',
      sourceA: { workbookId: 'wb-left', exists: true },
      sourceB: { workbookId: 'wb-right', exists: true },
      worksheetDiffs: [
        {
          id: 'wsd:Resumen:0',
          worksheetId: 'ws:Resumen:0',
          location: { worksheetName: 'Resumen', sheetIndex: 0 },
          cellDiffs: [
            {
              id: 'cell:Resumen:0:C4',
              worksheetId: 'ws:Resumen:0',
              location: { worksheetName: 'Resumen', sheetIndex: 0, a1: 'C4' },
              sourceA: { value: 'Pendiente de revisión', displayValue: 'Pendiente de revisión', type: 'string', exists: true },
              sourceB: { value: 'Validado por finanzas', displayValue: 'Validado por finanzas', type: 'string', exists: true },
            },
          ],
          conflicts: [
            {
              id: 'conf-4',
              changeType: 'conflict',
              location: { worksheetName: 'Resumen', sheetIndex: 0, a1: 'C4' },
              reason: 'Cambio de estado del resumen ejecutivo.',
              cellRefs: ['cell:Resumen:0:C4'],
            },
          ],
        },
        {
          id: 'wsd:Clientes:1',
          worksheetId: 'ws:Clientes:1',
          location: { worksheetName: 'Clientes', sheetIndex: 1 },
          cellDiffs: [
            {
              id: 'cell:Clientes:1:D18',
              worksheetId: 'ws:Clientes:1',
              location: { worksheetName: 'Clientes', sheetIndex: 1, a1: 'D18' },
              sourceA: { value: 'Activo', displayValue: 'Activo', type: 'string', exists: true },
              sourceB: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string', exists: true },
            },
            {
              id: 'cell:Clientes:1:F22',
              worksheetId: 'ws:Clientes:1',
              location: { worksheetName: 'Clientes', sheetIndex: 1, a1: 'F22' },
              sourceA: { value: 12500, displayValue: '12500', type: 'number', exists: true },
              sourceB: { value: 13250, displayValue: '13250', type: 'number', exists: true },
            },
          ],
          conflicts: [
            {
              id: 'conf-1',
              changeType: 'conflict',
              location: { worksheetName: 'Clientes', sheetIndex: 1, a1: 'D18' },
              reason: 'Cambio en el estado operativo del cliente 1042.',
              cellRefs: ['cell:Clientes:1:D18'],
            },
            {
              id: 'conf-2',
              changeType: 'conflict',
              location: { worksheetName: 'Clientes', sheetIndex: 1, a1: 'F22' },
              reason: 'Ajuste del importe comprometido para el mes actual.',
              cellRefs: ['cell:Clientes:1:F22'],
            },
          ],
        },
        {
          id: 'wsd:Forecast:2',
          worksheetId: 'ws:Forecast:2',
          location: { worksheetName: 'Forecast', sheetIndex: 2 },
          cellDiffs: [
            {
              id: 'cell:Forecast:2:B7',
              worksheetId: 'ws:Forecast:2',
              location: { worksheetName: 'Forecast', sheetIndex: 2, a1: 'B7' },
              sourceA: { value: '=SUM(B2:B6)', displayValue: '=SUM(B2:B6)', formula: '=SUM(B2:B6)', type: 'formula', exists: true },
              sourceB: { value: '=SUM(B2:B6)-B4', displayValue: '=SUM(B2:B6)-B4', formula: '=SUM(B2:B6)-B4', type: 'formula', exists: true },
            },
          ],
          conflicts: [
            {
              id: 'conf-3',
              changeType: 'formula_changed',
              severity: 'critical',
              location: { worksheetName: 'Forecast', sheetIndex: 2, a1: 'B7' },
              reason: 'La fórmula excluye una línea intermedia en la proyección.',
              cellRefs: ['cell:Forecast:2:B7'],
            },
          ],
        },
      ],
      conflicts: [],
    },
    mergeDecisions: [
      createDecision({ id: 'conf-2', location: { worksheetName: 'Clientes', sheetIndex: 1, a1: 'F22' }, userDecision: 'take_b', finalState: 'accepted_b' }),
      createDecision({ id: 'conf-4', location: { worksheetName: 'Resumen', sheetIndex: 0, a1: 'C4' }, userDecision: 'take_a', finalState: 'accepted_a' }),
    ],
  };
}

function createDecision({ id, location, userDecision, finalState }) {
  return {
    id: `decision:${id}`,
    targetId: id,
    targetType: 'conflict',
    nodeType: 'MergeDecision',
    location,
    userDecision,
    finalState,
    decidedAt: new Date().toISOString(),
  };
}

function buildConflictView(conflict) {
  const decision = state.session.mergeDecisions.find(
    (item) => item.targetId === conflict.id || conflict.cellRefs?.includes(item.targetId),
  );
  const resolved = ['take_a', 'take_b', 'take_left', 'take_right', 'manual_edit'].includes(decision?.userDecision);
  const resolvedSide = decision?.userDecision === 'take_a' || decision?.userDecision === 'take_left'
    ? 'left'
    : decision?.userDecision === 'take_b' || decision?.userDecision === 'take_right'
      ? 'right'
      : 'manual';
  const sourceA = findCellSource(conflict, 'sourceA');
  const sourceB = findCellSource(conflict, 'sourceB');

  return {
    id: conflict.id,
    sheet: conflict.location?.worksheetName ?? 'Hoja',
    cell: conflict.location?.a1 ?? '—',
    type: conflict.changeType === 'formula_changed' ? 'Fórmula modificada' : 'Valor distinto',
    leftValue: sourceA?.displayValue ?? String(sourceA?.value ?? '—'),
    rightValue: sourceB?.displayValue ?? String(sourceB?.value ?? '—'),
    status: resolved ? 'resolved' : 'pending',
    resolution: resolvedSide === 'manual' ? 'manual' : resolvedSide,
    description: conflict.reason,
    critical: conflict.severity === 'critical' || conflict.changeType === 'formula_changed',
  };
}

function findCellSource(conflict, side) {
  const cellRef = conflict.cellRefs?.[0];
  for (const worksheet of state.session.workbookDiff.worksheetDiffs) {
    const cell = (worksheet.cellDiffs ?? []).find((item) => item.id === cellRef);
    if (cell) {
      return cell[side] ?? null;
    }
  }
  return conflict[side] ?? null;
}

function getConflictViews() {
  return state.session.workbookDiff.worksheetDiffs.flatMap((worksheet) =>
    (worksheet.conflicts ?? []).map(buildConflictView),
  );
}

function getSelectedConflict() {
  return getConflictViews().find((conflict) => conflict.id === state.selectedConflictId) ?? null;
}

function getFilteredConflicts() {
  const conflicts = getConflictViews();
  if (state.filter === 'all') {
    return conflicts;
  }

  return conflicts.filter((conflict) => conflict.status === state.filter);
}

function upsertDecision(decision) {
  const next = state.session.mergeDecisions.filter((item) => item.targetId !== decision.targetId);
  next.push(decision);
  state.session.mergeDecisions = next;
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
  const conflicts = getConflictViews();
  const pending = conflicts.filter((conflict) => conflict.status === 'pending').length;
  const resolved = conflicts.length - pending;

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
  } else if (current.resolution === 'right') {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió aceptando el valor derecho.`;
  } else {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió con una edición manual.`;
  }

  elements.acceptLeft.disabled = isResolved && current.resolution === 'left';
  elements.acceptRight.disabled = isResolved && current.resolution === 'right';
}

function renderFinalReview() {
  const review = buildFinalReviewModel({
    ...state.session,
    exportFileName: state.exportFileName,
  });

  elements.exportFileName.value = review.suggestedFileName;
  renderBanner(review.exportGuard);

  elements.finalConsistency.innerHTML = review.consistency.valid
    ? '<li class="summary-line success">Sesión, workbookDiff y decisiones consistentes.</li>'
    : review.consistency.issues.map((issue) => `<li class="summary-line critical">${issue}</li>`).join('');

  elements.finalResolvedList.innerHTML = review.resolvedConflicts.length
    ? review.resolvedConflicts.map((item) => `<li>${item.sheet} · ${item.cell} — ${item.label}</li>`).join('')
    : '<li>No hay conflictos resueltos todavía.</li>';

  elements.finalDecisionTypes.innerHTML = review.decisionsByType.length
    ? review.decisionsByType.map((item) => `<li>${formatDecisionType(item.decisionType)}: <strong>${item.count}</strong></li>`).join('')
    : '<li>Sin decisiones aplicadas.</li>';

  elements.finalSheets.innerHTML = review.affectedSheets.length
    ? review.affectedSheets.map((sheet) => `<li>${sheet}</li>`).join('')
    : '<li>Sin hojas afectadas.</li>';

  elements.finalPendingList.innerHTML = review.pendingConflicts.length
    ? review.pendingConflicts.map((item) => `<li>${item.sheet} · ${item.cell}${item.critical ? ' · crítico' : ''}</li>`).join('')
    : '<li>No quedan pendientes.</li>';

  elements.exportButton.disabled = !review.exportGuard.canContinue || state.exportStatus === 'loading';
}

function renderBanner(viewModel) {
  elements.finalBanner.className = `banner banner-${viewModel.tone}`;
  elements.finalBanner.innerHTML = `
    <div>
      <strong>${viewModel.title}</strong>
      <p>${viewModel.message}</p>
      <small>${viewModel.nextStep}</small>
    </div>
    <span class="banner-action">${viewModel.actionLabel}</span>
  `;
}

function formatDecisionType(decisionType) {
  switch (decisionType) {
    case 'take_a':
    case 'take_left':
      return 'Aceptadas desde izquierda';
    case 'take_b':
    case 'take_right':
      return 'Aceptadas desde derecha';
    case 'manual_edit':
      return 'Ediciones manuales';
    default:
      return decisionType;
  }
}

function resolveConflict(side) {
  const conflict = getSelectedConflict();
  if (!conflict) {
    return;
  }

  upsertDecision(
    createDecision({
      id: conflict.id,
      location: { worksheetName: conflict.sheet, a1: conflict.cell },
      userDecision: side === 'left' ? 'take_a' : 'take_b',
      finalState: side === 'left' ? 'accepted_a' : 'accepted_b',
    }),
  );

  renderSummary();
  renderConflictList();
  renderDetail();
  renderFinalReview();
}

function presentExportError(error, code) {
  const view = createUserErrorView({
    code,
    cause: error,
    context: {
      sessionId: state.session.sessionId,
      fileName: state.exportFileName,
      operation: 'export-result',
      rawMessage: error.message,
    },
  });
  recordAddinError(state.logger, view);
  state.reviewMessage = { tone: 'critical', text: `${view.title}. ${view.message}` };
  renderExportMessage();
}

function renderExportMessage() {
  if (!state.reviewMessage) {
    elements.exportMessage.textContent = '';
    elements.exportMessage.className = 'export-message';
    return;
  }

  elements.exportMessage.textContent = state.reviewMessage.text;
  elements.exportMessage.className = `export-message tone-${state.reviewMessage.tone}`;
}

async function exportWorkbook() {
  state.exportStatus = 'loading';
  state.reviewMessage = { tone: 'neutral', text: 'Generando el archivo final…' };
  renderExportMessage();
  renderFinalReview();

  try {
    const artifacts = generateFinalWorkbookArtifacts({
      ...state.session,
      exportFileName: state.exportFileName,
    });
    triggerWorkbookDownload(artifacts.binary, artifacts.fileName);
    state.reviewMessage = {
      tone: 'success',
      text: `Resultado exportado correctamente como ${artifacts.fileName}. ${artifacts.exportSummary.resolvedConflictCount} conflictos resueltos incluidos.`,
    };
  } catch (error) {
    if (error.code === 'EXPORT_VALIDATION_FAILED') {
      presentExportError(error, 'EXPORT_VALIDATION_FAILED');
    } else if (/descarga/i.test(error.message) || /entorno/i.test(error.message)) {
      presentExportError(error, 'MERGE_RESULT_DOWNLOAD_FAILED');
    } else {
      presentExportError(error, 'MERGE_RESULT_GENERATION_FAILED');
    }
  } finally {
    state.exportStatus = 'idle';
    renderExportMessage();
    renderFinalReview();
  }
}

function bindEvents() {
  elements.filter.addEventListener('change', (event) => {
    state.filter = event.target.value;
    renderConflictList();
    renderDetail();
  });

  elements.acceptLeft.addEventListener('click', () => resolveConflict('left'));
  elements.acceptRight.addEventListener('click', () => resolveConflict('right'));
  elements.exportFileName.addEventListener('input', (event) => {
    state.exportFileName = event.target.value.trim() || elements.exportFileName.placeholder;
    renderFinalReview();
  });
  elements.exportButton.addEventListener('click', exportWorkbook);
}

function init() {
  renderFiles();
  renderSummary();
  renderConflictList();
  renderDetail();
  renderFinalReview();
  renderExportMessage();
  bindEvents();
}

init();
