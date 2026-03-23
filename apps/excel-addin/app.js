import {
  buildHistoryEntry,
  serializeFinalValue,
  syncDerivedHistoryArtifacts,
  upsertMergeDecision,
} from './src/history-panel.js';

const currentUser = {
  userId: 'user:sandra',
  displayName: 'Sandra López',
  origin: 'office-addin',
};

const state = {
  sessionId: 'ms_2026-03-23T10-30-00Z_ventas-q1',
  actor: currentUser,
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
      location: { worksheetName: 'Clientes', a1: 'D18', rangeA1: 'D18' },
      type: 'Valor distinto',
      leftValue: 'Activo',
      rightValue: 'Inactivo',
      sourceA: { value: 'Activo', displayValue: 'Activo', type: 'string' },
      sourceB: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string' },
      status: 'pending',
      userDecision: 'unresolved',
      finalState: 'pending',
      resolution: null,
      description: 'Cambio en el estado operativo del cliente 1042.',
    },
    {
      id: 'conf-2',
      sheet: 'Clientes',
      cell: 'F22',
      location: { worksheetName: 'Clientes', a1: 'F22', rangeA1: 'F22' },
      type: 'Monto actualizado',
      leftValue: '12500',
      rightValue: '13250',
      sourceA: { value: 12500, displayValue: '12500', type: 'number' },
      sourceB: { value: 13250, displayValue: '13250', type: 'number' },
      status: 'resolved',
      userDecision: 'take_b',
      finalState: 'accepted_b',
      resolution: { side: 'right', finalValue: { value: 13250, displayValue: '13250', type: 'number' }, origin: 'automatic' },
      description: 'Ajuste del importe comprometido para el mes actual.',
    },
    {
      id: 'conf-3',
      sheet: 'Forecast',
      cell: 'B7',
      location: { worksheetName: 'Forecast', a1: 'B7', rangeA1: 'B7' },
      type: 'Fórmula modificada',
      leftValue: '=SUM(B2:B6)',
      rightValue: '=SUM(B2:B6)-B4',
      sourceA: { value: '=SUM(B2:B6)', displayValue: '=SUM(B2:B6)', type: 'formula' },
      sourceB: { value: '=SUM(B2:B6)-B4', displayValue: '=SUM(B2:B6)-B4', type: 'formula' },
      status: 'pending',
      userDecision: 'unresolved',
      finalState: 'pending',
      resolution: null,
      description: 'La fórmula excluye una línea intermedia en la proyección.',
    },
    {
      id: 'conf-4',
      sheet: 'Resumen',
      cell: 'C4',
      location: { worksheetName: 'Resumen', a1: 'C4', rangeA1: 'C4' },
      type: 'Texto diferente',
      leftValue: 'Pendiente de revisión',
      rightValue: 'Validado por finanzas',
      sourceA: { value: 'Pendiente de revisión', displayValue: 'Pendiente de revisión', type: 'string' },
      sourceB: { value: 'Validado por finanzas', displayValue: 'Validado por finanzas', type: 'string' },
      status: 'resolved',
      userDecision: 'take_a',
      finalState: 'accepted_a',
      resolution: { side: 'left', finalValue: { value: 'Pendiente de revisión', displayValue: 'Pendiente de revisión', type: 'string' }, origin: 'manual' },
      description: 'Cambio de estado del resumen ejecutivo.',
    },
  ],
  mergeDecisions: [
    {
      id: 'decision:conf-2',
      nodeType: 'MergeDecision',
      targetType: 'conflict',
      targetId: 'conf-2',
      location: { worksheetName: 'Clientes', a1: 'F22', rangeA1: 'F22' },
      changeType: 'conflict',
      userDecision: 'take_b',
      finalState: 'accepted_b',
      decidedBy: { userId: 'system:auto', displayName: 'Regla de conciliación', origin: 'automatic-rule' },
      decidedAt: '2026-03-23T10:40:00Z',
      note: 'Regla automática: priorizar monto actualizado del archivo comparado.',
      history: [
        buildHistoryEntry({
          sessionId: 'ms_2026-03-23T10-30-00Z_ventas-q1',
          conflict: { id: 'conf-2', location: { worksheetName: 'Clientes', a1: 'F22', rangeA1: 'F22' } },
          decisionId: 'decision:conf-2',
          targetId: 'conf-2',
          decision: 'take_b',
          finalValue: { value: 13250, displayValue: '13250', type: 'number' },
          occurredAt: '2026-03-23T10:40:00Z',
          actor: { userId: 'system:auto', displayName: 'Regla de conciliación', origin: 'automatic-rule' },
          actionType: 'auto_resolved',
          changeOrigin: 'automatic',
        }),
      ],
    },
    {
      id: 'decision:conf-4',
      nodeType: 'MergeDecision',
      targetType: 'conflict',
      targetId: 'conf-4',
      location: { worksheetName: 'Resumen', a1: 'C4', rangeA1: 'C4' },
      changeType: 'conflict',
      userDecision: 'take_a',
      finalState: 'accepted_a',
      decidedBy: currentUser,
      decidedAt: '2026-03-23T10:46:00Z',
      note: 'Soporte mantuvo el texto vigente en el libro base.',
      history: [
        buildHistoryEntry({
          sessionId: 'ms_2026-03-23T10-30-00Z_ventas-q1',
          conflict: { id: 'conf-4', location: { worksheetName: 'Resumen', a1: 'C4', rangeA1: 'C4' } },
          decisionId: 'decision:conf-4',
          targetId: 'conf-4',
          decision: 'take_a',
          finalValue: { value: 'Pendiente de revisión', displayValue: 'Pendiente de revisión', type: 'string' },
          occurredAt: '2026-03-23T10:46:00Z',
          actor: currentUser,
          actionType: 'selected_source',
          changeOrigin: 'manual',
        }),
      ],
    },
  ],
  selectedConflictId: 'conf-1',
  filter: 'all',
  historyScope: 'all',
  exportFormat: 'jsonl',
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
  finalValue: document.querySelector('#final-value'),
  resolutionOrigin: document.querySelector('#resolution-origin'),
  acceptLeft: document.querySelector('#accept-left'),
  acceptRight: document.querySelector('#accept-right'),
  autoResolve: document.querySelector('#auto-resolve'),
  historyCount: document.querySelector('#history-count'),
  historyScope: document.querySelector('#history-scope'),
  historyTimeline: document.querySelector('#history-timeline'),
  exportSummary: document.querySelector('#export-summary'),
  exportPreview: document.querySelector('#export-preview'),
  exportFormat: document.querySelector('#export-format'),
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

function syncArtifacts() {
  const synced = syncDerivedHistoryArtifacts({
    sessionId: state.sessionId,
    conflicts: state.conflicts,
    mergeDecisions: state.mergeDecisions,
  });

  state.decisionTimeline = synced.decisionTimeline;
  state.technicalSummary = synced.technicalSummary;
  state.supportExport = synced.supportExport;
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
      const originChip = conflict.resolution?.origin === 'automatic'
        ? '<span class="chip chip-neutral">Automático</span>'
        : conflict.status === 'resolved'
          ? '<span class="chip chip-outline">Manual</span>'
          : '';

      return `
        <li>
          <button class="conflict-item ${isActive ? 'is-active' : ''}" type="button" data-conflict-id="${conflict.id}">
            <div class="conflict-item-header">
              <div>
                <h3 class="conflict-item-title">${conflict.sheet} · ${conflict.cell}</h3>
                <p>${conflict.type}</p>
              </div>
              <div class="stacked-chips">
                <span class="chip ${statusClass}">${statusText}</span>
                ${originChip}
              </div>
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
      renderHistoryPanel();
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
  const finalValue = current.resolution?.finalValue ? serializeFinalValue(current.resolution.finalValue) : 'Pendiente';
  const originLabel = current.resolution?.origin === 'automatic' ? 'Automático' : current.status === 'resolved' ? 'Manual' : 'Sin resolver';

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
  elements.finalValue.textContent = finalValue;
  elements.resolutionOrigin.textContent = originLabel;
  elements.detailStatusChip.textContent = isResolved ? 'Resuelto' : 'Pendiente';
  elements.detailStatusChip.className = `chip ${isResolved ? 'chip-success' : 'chip-pending'}`;

  if (!isResolved) {
    elements.resolutionMessage.textContent = `${current.description} Este conflicto sigue pendiente.`;
  } else if (current.resolution?.origin === 'automatic') {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió mediante una regla automática registrada en el historial.`;
  } else if (current.resolution?.side === 'left') {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió aceptando el valor izquierdo.`;
  } else {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió aceptando el valor derecho.`;
  }

  elements.acceptLeft.disabled = isResolved && current.resolution?.side === 'left' && current.resolution?.origin === 'manual';
  elements.acceptRight.disabled = isResolved && current.resolution?.side === 'right' && current.resolution?.origin === 'manual';
  elements.autoResolve.disabled = isResolved && current.resolution?.origin === 'automatic';
}

function formatDecisionLabel(decision) {
  const labels = {
    take_a: 'Aceptar izquierda',
    take_b: 'Aceptar derecha',
    auto_take_b: 'Sugerencia automática',
  };

  return labels[decision] ?? decision;
}

function applyDecision({ side, decision, origin, actor, actionType }) {
  const conflict = getSelectedConflict();
  if (!conflict) {
    return;
  }

  const normalizedDecision = decision ?? (side === 'left' ? 'take_a' : 'take_b');
  const finalValue = side === 'left' ? conflict.sourceA : conflict.sourceB;
  const repeatedResolution =
    conflict.status === 'resolved'
    && conflict.userDecision === normalizedDecision
    && (conflict.resolution?.origin ?? 'manual') === origin;

  if (repeatedResolution) {
    return;
  }

  const occurredAt = new Date().toISOString();
  const decisionRecord = {
    id: `decision:${conflict.id}`,
    nodeType: 'MergeDecision',
    targetType: 'conflict',
    targetId: conflict.id,
    location: conflict.location,
    changeType: 'conflict',
    sourceA: conflict.sourceA,
    sourceB: conflict.sourceB,
    userDecision: normalizedDecision,
    finalState: normalizedDecision === 'take_a' ? 'accepted_a' : 'accepted_b',
    decidedBy: actor,
    decidedAt: occurredAt,
    note: formatDecisionLabel(normalizedDecision),
    history: [
      buildHistoryEntry({
        sessionId: state.sessionId,
        conflict,
        decisionId: `decision:${conflict.id}`,
        targetId: conflict.id,
        decision: normalizedDecision,
        finalValue,
        occurredAt,
        actor,
        actionType,
        changeOrigin: origin,
      }),
    ],
  };

  state.mergeDecisions = upsertMergeDecision(state.mergeDecisions, decisionRecord);
  state.conflicts = state.conflicts.map((item) => {
    if (item.id !== conflict.id) {
      return item;
    }

    return {
      ...item,
      status: 'resolved',
      userDecision: normalizedDecision,
      finalState: decisionRecord.finalState,
      resolution: {
        side,
        finalValue,
        origin,
        occurredAt,
        user: actor.displayName ?? actor.userId,
      },
    };
  });

  syncArtifacts();
  renderSummary();
  renderConflictList();
  renderDetail();
  renderHistoryPanel();
}

function getVisibleTimeline() {
  if (state.historyScope === 'selected' && state.selectedConflictId) {
    return (state.decisionTimeline ?? []).filter((item) => item.conflictId === state.selectedConflictId);
  }

  return state.decisionTimeline ?? [];
}

function renderHistoryPanel() {
  const selectedConflict = getSelectedConflict();
  const timeline = getVisibleTimeline();
  const selectedConflictLabel = selectedConflict ? `${selectedConflict.sheet} · ${selectedConflict.cell}` : 'sin conflicto';

  elements.historyCount.textContent = `${timeline.length} eventos`;
  elements.historyTimeline.innerHTML = timeline.length === 0
    ? '<li class="empty-state">Aún no hay acciones registradas para este alcance.</li>'
    : timeline
      .map((item) => {
        const isLinked = item.conflictId === state.selectedConflictId;
        const modeClass = item.isAutomatic ? 'chip-neutral' : 'chip-outline';
        const modeLabel = item.isAutomatic ? 'Automático' : 'Manual';

        return `
          <li>
            <button class="history-item ${isLinked ? 'is-linked' : ''}" type="button" data-history-conflict-id="${item.conflictId}">
              <div class="history-item-header">
                <strong>${item.conflictLabel}</strong>
                <div class="stacked-chips">
                  <span class="chip ${modeClass}">${modeLabel}</span>
                  <span class="chip chip-neutral">${item.actionType}</span>
                </div>
              </div>
              <div class="history-item-meta">
                <span><strong>Decisión:</strong> ${item.decision}</span>
                <span><strong>Valor final:</strong> ${item.finalValueText}</span>
                <span><strong>Usuario:</strong> ${item.actorName}</span>
                <span><strong>Fecha:</strong> ${new Date(item.occurredAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            </button>
          </li>
        `;
      })
      .join('');

  elements.historyTimeline.querySelectorAll('[data-history-conflict-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedConflictId = button.dataset.historyConflictId;
      renderConflictList();
      renderDetail();
      renderHistoryPanel();
    });
  });

  const exportRows = state.supportExport?.rows ?? [];
  elements.exportSummary.innerHTML = `
    <li>Conflictos enlazados: <strong>${state.technicalSummary?.decisionCount ?? 0}</strong></li>
    <li>Eventos históricos: <strong>${state.supportExport?.rowCount ?? 0}</strong></li>
    <li>Acciones manuales: <strong>${state.supportExport?.manualCount ?? 0}</strong></li>
    <li>Acciones automáticas: <strong>${state.supportExport?.automaticCount ?? 0}</strong></li>
    <li>Conflicto seleccionado: <strong>${selectedConflictLabel}</strong></li>
    <li>Exportación lista con hoja/celda por fila: <strong>${exportRows.length ? 'Sí' : 'No'}</strong></li>
  `;
  elements.exportPreview.textContent = state.exportFormat === 'csv'
    ? state.supportExport?.csv ?? ''
    : state.supportExport?.jsonl ?? '';
}

function bindEvents() {
  elements.filter.addEventListener('change', (event) => {
    state.filter = event.target.value;
    renderConflictList();
    renderDetail();
  });

  elements.historyScope.addEventListener('change', (event) => {
    state.historyScope = event.target.value;
    renderHistoryPanel();
  });

  elements.exportFormat.addEventListener('change', (event) => {
    state.exportFormat = event.target.value;
    renderHistoryPanel();
  });

  elements.acceptLeft.addEventListener('click', () => applyDecision({
    side: 'left',
    origin: 'manual',
    actor: state.actor,
    actionType: 'selected_source',
  }));

  elements.acceptRight.addEventListener('click', () => applyDecision({
    side: 'right',
    origin: 'manual',
    actor: state.actor,
    actionType: 'selected_source',
  }));

  elements.autoResolve.addEventListener('click', () => applyDecision({
    side: 'right',
    decision: 'take_b',
    origin: 'automatic',
    actor: { userId: 'system:auto', displayName: 'Regla de conciliación', origin: 'automatic-rule' },
    actionType: 'auto_resolved',
  }));
}

function init() {
  syncArtifacts();
  renderFiles();
  renderSummary();
  renderConflictList();
  renderDetail();
  renderHistoryPanel();
  bindEvents();
}

init();
