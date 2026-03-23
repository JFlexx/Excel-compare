import { buildConflictDetailPanelModel } from './src/detail-panel.js';
import {
  applyBlockResolution,
  buildInitialMergeSession,
  buildResumeDescriptor,
  clearPersistedSession,
  loadPersistedSession,
  persistSession,
  recordConflictResolution,
  saveManualEditCheckpoint,
} from './src/session-persistence.js';

const CURRENT_USER = {
  userId: 'user:mvp-demo',
  displayName: 'Operador MVP',
  origin: 'office-addin'
};

const baseFiles = [
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
];

const baseConflicts = [
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
    leftValue: 12500,
    rightValue: 13250,
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
];

const state = {
  files: baseFiles,
  session: buildInitialMergeSession(baseFiles, baseConflicts),
  selectedConflictId: 'conf-1',
  filter: 'all',
  resumeDescriptor: null,
  manualDraft: '',
};

const elements = {
  fileSummary: document.querySelector('#file-summary'),
  activeSheet: document.querySelector('#active-sheet'),
  activeCell: document.querySelector('#active-cell'),
  pendingCount: document.querySelector('#pending-count'),
  resolvedCount: document.querySelector('#resolved-count'),
  progressPercent: document.querySelector('#progress-percent'),
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
  applyLeftSheet: document.querySelector('#apply-left-sheet'),
  applyRightSheet: document.querySelector('#apply-right-sheet'),
  manualEditInput: document.querySelector('#manual-edit-input'),
  manualEditSave: document.querySelector('#manual-edit-save'),
  manualEditHint: document.querySelector('#manual-edit-hint'),
  manualEditPreview: document.querySelector('#manual-edit-preview'),
  sessionStatusChip: document.querySelector('#session-status-chip'),
  sessionStatusText: document.querySelector('#session-status-text'),
  sessionLastUpdated: document.querySelector('#session-last-updated'),
  sessionProgress: document.querySelector('#session-progress'),
  resumeAction: document.querySelector('#resume-action'),
  discardResume: document.querySelector('#discard-resume'),
};

function getConflicts() {
  return state.session.conflicts ?? [];
}

function getSelectedConflict() {
  return getConflicts().find((conflict) => conflict.id === state.selectedConflictId) ?? null;
}

function getFilteredConflicts() {
  if (state.filter === 'all') {
    return getConflicts();
  }

  if (state.filter === 'resolved') {
    return getConflicts().filter((conflict) => conflict.finalState !== 'pending');
  }

  return getConflicts().filter((conflict) => conflict.finalState === 'pending');
}

function persistAndRefreshResume() {
  persistSession(state.session);
  state.resumeDescriptor = buildResumeDescriptor(loadPersistedSession(), state.files);
}

function ensureSelectedConflict() {
  const visibleConflicts = getFilteredConflicts();
  if (visibleConflicts.some((conflict) => conflict.id === state.selectedConflictId)) {
    return;
  }

  state.selectedConflictId = visibleConflicts[0]?.id ?? getConflicts()[0]?.id ?? null;
}

function formatLastUpdated(value) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderFiles() {
  elements.fileSummary.innerHTML = state.files
    .map((file, index) => {
      const fingerprint = index === 0 ? state.session.sourceA : state.session.sourceB;
      return `
        <article class="file-card" aria-label="${file.label}">
          <h3>${file.label}</h3>
          <p>${file.role}</p>
          <strong>${file.fileName}</strong>
          <div class="file-meta-row">
            <span class="file-meta">Actualizado: ${file.updatedAt}</span>
            <span class="file-meta">Tamaño: ${file.size}</span>
            <span class="file-meta">Hojas: ${file.sheets.join(', ')}</span>
            <span class="file-meta">Checksum MVP: ${fingerprint.checksum}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderSummary() {
  const progress = state.session.progress;
  elements.pendingCount.textContent = String(progress.pending);
  elements.resolvedCount.textContent = String(progress.resolved);
  elements.progressPercent.textContent = `${progress.percent}%`;
  elements.conflictCounter.textContent = `${progress.pending} pendientes`;
}

function renderSessionResumeStatus() {
  const descriptor = state.resumeDescriptor;
  const chipClass = descriptor?.status === 'resumable'
    ? 'chip-success'
    : descriptor?.status === 'invalid'
      ? 'chip-alert'
      : 'chip-neutral';

  const chipText = descriptor?.status === 'resumable'
    ? 'Reanudable'
    : descriptor?.status === 'invalid'
      ? 'Inválida'
      : 'Sin sesión';

  const progress = descriptor?.progress ?? state.session.progress;
  elements.sessionStatusChip.textContent = chipText;
  elements.sessionStatusChip.className = `chip ${chipClass}`;
  elements.sessionStatusText.textContent = descriptor?.reason
    ?? 'Hay una sesión compatible guardada para continuar el trabajo en el mismo workbook.';
  elements.sessionLastUpdated.textContent = formatLastUpdated(descriptor?.lastUpdatedAt ?? state.session.updatedAt);
  elements.sessionProgress.textContent = `${progress.resolved}/${progress.total} resueltos · ${progress.percent}% completado`;
  elements.resumeAction.disabled = !(descriptor?.canResume);
}

function renderConflictList() {
  ensureSelectedConflict();
  const conflicts = getFilteredConflicts();

  if (conflicts.length === 0) {
    elements.conflictList.innerHTML = '<li class="empty-state">No hay conflictos para el filtro seleccionado.</li>';
    renderDetail();
    return;
  }

  elements.conflictList.innerHTML = conflicts
    .map((conflict) => {
      const isActive = conflict.id === state.selectedConflictId;
      const isResolved = conflict.finalState !== 'pending';
      const statusClass = isResolved ? 'chip-success' : 'chip-pending';
      const statusText = isResolved ? 'Resuelto' : 'Pendiente';
      return `
        <li>
          <button class="conflict-item ${isActive ? 'is-active' : ''}" type="button" data-conflict-id="${conflict.id}">
            <div class="conflict-item-header">
              <div>
                <h3 class="conflict-item-title">${conflict.location.worksheetName} · ${conflict.location.a1}</h3>
                <p>${conflict.description}</p>
              </div>
              <span class="chip ${statusClass}">${statusText}</span>
            </div>
            <div class="conflict-item-meta">
              <span>Izquierda: ${conflict.sourceA.displayValue}</span>
              <span>Derecha: ${conflict.sourceB.displayValue}</span>
            </div>
          </button>
        </li>
      `;
    })
    .join('');

  elements.conflictList.querySelectorAll('[data-conflict-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedConflictId = button.dataset.conflictId;
      state.manualDraft = '';
      renderConflictList();
      renderDetail();
    });
  });
}

function renderManualEdit(conflict) {
  const model = buildConflictDetailPanelModel(state.session, conflict.id, state.manualDraft);
  elements.manualEditInput.value = state.manualDraft;
  elements.manualEditHint.textContent = model.editableField.validationMessage
    ?? `Tipo esperado: ${model.editableField.expectedType}. Guarda el valor final para crear un checkpoint.`;
  elements.manualEditHint.className = model.editableField.validationMessage ? 'manual-edit-hint is-error' : 'manual-edit-hint';
  elements.manualEditSave.disabled = !model.actions.saveManualEdit.enabled;
  elements.manualEditPreview.textContent = model.preview
    ? `${model.preview.value} · origen ${model.preview.origin}`
    : 'Sin vista previa manual para este conflicto.';
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
  const isResolved = current.finalState !== 'pending';
  const leftBook = state.files.find((file) => file.side === 'left');
  const rightBook = state.files.find((file) => file.side === 'right');

  elements.detailEmpty.hidden = true;
  elements.detailContent.hidden = false;
  elements.detailSheet.textContent = current.location.worksheetName;
  elements.detailCell.textContent = current.location.a1;
  elements.detailType.textContent = current.description;
  elements.leftBookName.textContent = leftBook?.fileName ?? 'Libro izquierdo';
  elements.rightBookName.textContent = rightBook?.fileName ?? 'Libro derecho';
  elements.leftValue.textContent = current.sourceA.displayValue;
  elements.rightValue.textContent = current.sourceB.displayValue;
  elements.activeSheet.textContent = current.location.worksheetName;
  elements.activeCell.textContent = current.location.a1;
  elements.detailStatusChip.textContent = isResolved ? 'Resuelto' : 'Pendiente';
  elements.detailStatusChip.className = `chip ${isResolved ? 'chip-success' : 'chip-pending'}`;

  if (!isResolved) {
    elements.resolutionMessage.textContent = `${current.description} Este conflicto sigue pendiente.`;
  } else if (current.userDecision === 'manual_edit') {
    elements.resolutionMessage.textContent = `${current.description} Se guardó una edición manual y se registró un checkpoint.`;
  } else if (current.userDecision === 'take_a') {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió aceptando el valor izquierdo.`;
  } else {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió aceptando el valor derecho.`;
  }

  elements.acceptLeft.disabled = isResolved && current.userDecision === 'take_a';
  elements.acceptRight.disabled = isResolved && current.userDecision === 'take_b';
  elements.applyLeftSheet.disabled = current.location.worksheetName == null;
  elements.applyRightSheet.disabled = current.location.worksheetName == null;
  elements.applyLeftSheet.textContent = `Aplicar izquierda en ${current.location.worksheetName}`;
  elements.applyRightSheet.textContent = `Aplicar derecha en ${current.location.worksheetName}`;
  renderManualEdit(current);
}

function rerender() {
  renderFiles();
  renderSummary();
  renderSessionResumeStatus();
  renderConflictList();
  renderDetail();
}

function resolveConflict(resolution) {
  const conflict = getSelectedConflict();
  if (!conflict) {
    return;
  }

  state.session = recordConflictResolution(state.session, {
    conflictId: conflict.id,
    resolution,
    actor: CURRENT_USER,
  });
  persistAndRefreshResume();
  rerender();
}

function applyResolutionToSheet(resolution) {
  const conflict = getSelectedConflict();
  if (!conflict) {
    return;
  }

  state.session = applyBlockResolution(state.session, {
    worksheetName: conflict.location.worksheetName,
    resolution,
    actor: CURRENT_USER,
  });
  persistAndRefreshResume();
  rerender();
}

function saveManualEdit() {
  const conflict = getSelectedConflict();
  if (!conflict || state.manualDraft.trim() === '') {
    return;
  }

  state.session = saveManualEditCheckpoint(state.session, {
    conflictId: conflict.id,
    rawValue: state.manualDraft,
    actor: CURRENT_USER,
  });
  state.manualDraft = '';
  persistAndRefreshResume();
  rerender();
}

function startFreshSession() {
  state.session = buildInitialMergeSession(state.files, baseConflicts);
  state.selectedConflictId = state.session.conflicts[0]?.id ?? null;
  state.manualDraft = '';
  persistAndRefreshResume();
  rerender();
}

function resumePersistedSession() {
  if (!state.resumeDescriptor?.canResume || !state.resumeDescriptor.session) {
    return;
  }

  state.session = state.resumeDescriptor.session;
  state.selectedConflictId = state.session.conflicts.find((conflict) => conflict.finalState === 'pending')?.id
    ?? state.session.conflicts[0]?.id
    ?? null;
  state.manualDraft = '';
  persistAndRefreshResume();
  rerender();
}

function discardPersistedSession() {
  clearPersistedSession();
  state.resumeDescriptor = buildResumeDescriptor(loadPersistedSession(), state.files);
  startFreshSession();
}

function bindEvents() {
  elements.filter.addEventListener('change', (event) => {
    state.filter = event.target.value;
    rerender();
  });

  elements.acceptLeft.addEventListener('click', () => resolveConflict('left'));
  elements.acceptRight.addEventListener('click', () => resolveConflict('right'));
  elements.applyLeftSheet.addEventListener('click', () => applyResolutionToSheet('left'));
  elements.applyRightSheet.addEventListener('click', () => applyResolutionToSheet('right'));
  elements.manualEditInput.addEventListener('input', (event) => {
    state.manualDraft = event.target.value;
    renderDetail();
  });
  elements.manualEditSave.addEventListener('click', () => saveManualEdit());
  elements.resumeAction.addEventListener('click', () => resumePersistedSession());
  elements.discardResume.addEventListener('click', () => discardPersistedSession());
}

function init() {
  const persistedEnvelope = loadPersistedSession();
  state.resumeDescriptor = buildResumeDescriptor(persistedEnvelope, state.files);

  if (!persistedEnvelope) {
    persistAndRefreshResume();
  }

  state.selectedConflictId = state.session.conflicts.find((conflict) => conflict.finalState === 'pending')?.id
    ?? state.session.conflicts[0]?.id
    ?? null;

  bindEvents();
  rerender();
}

init();
