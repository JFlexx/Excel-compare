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
import {
  applyConflictToWorkbook,
  getCurrentSelection,
  getRelevantWorkbookRanges,
  loadSessionFromHost,
  persistSessionToHost,
  registerSelectionChangedHandler,
  selectConflictInWorkbook,
} from './src/office-client.js';
import {
  applyConflictResolution,
  buildConflictIndex,
  buildSessionSummary,
  findConflictByWorksheetAndAddress,
  findConflictsIntersectingRange,
  normalizeSessionPayload,
  pickBestConflictMatch,
} from './src/session-model.js';

const state = {
  session: null,
  conflictIndex: null,
  selectedConflictId: null,
  filter: 'all',
  connectionState: 'loading',
  hostMessage: 'Conectando con Excel y cargando la merge session…',
  hostDetails: '',
  sessionSource: '',
  workbook: null,
  selectionCapability: 'unknown',
  selectionWarning: '',
  hostError: null,
  internalSelectionInFlight: false,
  selectionRegistration: null,
  rangeAvailability: new Map(),
  isApplyingResolution: false,
};

const elements = {
  hostBanner: document.querySelector('#host-banner'),
  hostBadge: document.querySelector('#host-badge'),
  hostMessage: document.querySelector('#host-message'),
  hostDetails: document.querySelector('#host-details'),
  reconnectButton: document.querySelector('#reconnect-host'),
  fileSummary: document.querySelector('#file-summary'),
  activeWorkbook: document.querySelector('#active-workbook'),
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
  return state.session?.conflicts.find((conflict) => conflict.id === state.selectedConflictId) ?? null;
}

function getFilteredConflicts() {
  const conflicts = state.session?.conflicts ?? [];
  if (state.filter === 'all') {
    return conflicts;
  }

  return conflicts.filter((conflict) => conflict.status === state.filter);
}

function renderHostState() {
  const config = {
    loading: { label: 'Cargando', className: 'chip chip-neutral' },
    reconnecting: { label: 'Reconectando', className: 'chip chip-alert' },
    ready: { label: 'Conectado', className: 'chip chip-success' },
    error: { label: 'Error de host', className: 'chip chip-danger' },
  }[state.connectionState];

  elements.hostBanner.className = `host-banner ${state.connectionState === 'error' ? 'host-banner-error' : ''}`;
  elements.hostBadge.textContent = config.label;
  elements.hostBadge.className = config.className;
  elements.hostMessage.textContent = state.hostMessage;
  elements.hostDetails.textContent = state.hostDetails || state.selectionWarning || ' ';
  elements.reconnectButton.disabled = state.connectionState === 'loading' || state.connectionState === 'reconnecting';
}

function renderFiles() {
  if (!state.session || !state.workbook) {
    elements.fileSummary.innerHTML = `
      <article class="empty-state">
        Abre el panel desde Excel y carga una merge session real para ver los libros asociados.
      </article>
    `;
    elements.activeWorkbook.textContent = '—';
    return;
  }

  const files = [
    {
      label: 'Libro izquierdo',
      role: 'Origen A en la merge session',
      fileName: state.session.sourceA?.label ?? state.session.sourceA?.workbookId ?? 'Origen A',
      location: state.session.sourceA?.path ?? 'Sin ruta publicada',
      status: 'Metadatos cargados desde la sesión',
    },
    {
      label: 'Workbook activo',
      role: 'Host Excel conectado al task pane',
      fileName: state.workbook.name,
      location: `Hojas detectadas: ${state.workbook.worksheetNames.join(', ') || '—'}`,
      status: `Sesión: ${state.sessionSource || 'host local'}`,
    },
  ];

  if (state.session.sourceB) {
    files.push({
      label: 'Libro derecho',
      role: 'Origen B en la merge session',
      fileName: state.session.sourceB.label ?? state.session.sourceB.workbookId ?? 'Origen B',
      location: state.session.sourceB.path ?? 'Sin ruta publicada',
      status: 'Comparado contra el workbook activo',
    });
  }

  elements.fileSummary.innerHTML = files
    .map(
      (file) => `
        <article class="file-card" aria-label="${file.label}">
          <h3>${file.label}</h3>
          <p>${file.role}</p>
          <strong>${file.fileName}</strong>
          <div class="file-meta-row">
            <span class="file-meta">Detalle: ${file.location}</span>
            <span class="file-meta">Estado: ${file.status}</span>
          </div>
        </article>
      `,
    )
    .join('');

  elements.activeWorkbook.textContent = state.workbook.name;
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
  if (!state.session) {
    elements.pendingCount.textContent = '0';
    elements.resolvedCount.textContent = '0';
    elements.conflictCounter.textContent = 'Sin sesión';
    return;
  }

  const summary = buildSessionSummary(state.session);
  elements.pendingCount.textContent = String(summary.pending);
  elements.resolvedCount.textContent = String(summary.resolved);
  elements.conflictCounter.textContent = `${summary.pending} pendientes`;
}

function renderConflictList() {
  if (state.connectionState === 'loading' || state.connectionState === 'reconnecting') {
    elements.conflictList.innerHTML = '<li class="empty-state">Cargando conflictos reales desde la sesión activa…</li>';
    return;
  }

  if (!conflicts.some((conflict) => conflict.id === state.selectedConflictId)) {
    state.selectedConflictId = conflicts[0]?.id ?? null;
  const conflicts = getFilteredConflicts();
  if (!conflicts.some((conflict) => conflict.id === state.selectedConflictId) && conflicts.length > 0) {
    state.selectedConflictId = conflicts[0].id;
  }

  if (conflicts.length === 0) {
    elements.conflictList.innerHTML = '<li class="empty-state">No hay conflictos disponibles para el filtro seleccionado.</li>';
    return;
  }

  elements.conflictList.innerHTML = conflicts
    .map((conflict) => {
      const isActive = conflict.id === state.selectedConflictId;
      const isResolved = conflict.finalState !== 'unresolved';
      const statusClass = isResolved ? 'chip-success' : 'chip-pending';
      const statusText = isResolved ? 'Resuelto' : 'Pendiente';
      const statusClass = conflict.status === 'resolved' ? 'chip-success' : 'chip-pending';
      const statusText = conflict.status === 'resolved' ? 'Resuelto' : 'Pendiente';
      const rangeSupported = state.rangeAvailability.get(conflict.id);
      const capability = rangeSupported === false ? '<span class="conflict-item-note">Sin navegación Office.js</span>' : '';

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
            ${capability}
          </button>
        </li>
      `;
    })
    .join('');

  elements.conflictList.querySelectorAll('[data-conflict-id]').forEach((button) => {
    button.addEventListener('click', () => focusConflict(button.dataset.conflictId, { source: 'list' }));
  });
}

function renderDetail() {
  const conflict = getSelectedConflict();
  if (!conflict) {
    elements.detailEmpty.hidden = false;
    elements.detailContent.hidden = true;
    elements.detailStatusChip.textContent = 'Sin selección';
    elements.detailStatusChip.className = 'chip chip-neutral';
    elements.activeSheet.textContent = state.workbook?.activeWorksheetName ?? '—';
    elements.activeCell.textContent = state.workbook?.selectionAddress ?? '—';
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
  const current = visibleConflict;
  const isResolved = current.status === 'resolved';

  elements.detailEmpty.hidden = true;
  elements.detailContent.hidden = false;
  elements.detailSheet.textContent = current.sheet;
  elements.detailCell.textContent = current.cell;
  elements.detailType.textContent = current.type;
  elements.leftBookName.textContent = state.session?.sourceA?.label ?? 'Origen A';
  elements.rightBookName.textContent = state.session?.sourceB?.label ?? state.workbook?.name ?? 'Workbook activo';
  elements.leftValue.textContent = current.leftValue;
  elements.rightValue.textContent = current.rightValue;
  elements.activeSheet.textContent = current.sheet;
  elements.activeCell.textContent = current.cell;
  elements.detailStatusChip.textContent = isResolved ? 'Resuelto' : 'Pendiente';
  elements.detailStatusChip.className = `chip ${isResolved ? 'chip-success' : 'chip-pending'}`;

  const navigationWarning = state.rangeAvailability.get(current.id) === false
    ? ' Este host no permite navegar automáticamente a este rango.'
    : '';

  if (state.isApplyingResolution) {
    elements.resolutionMessage.textContent = 'Aplicando la resolución en el workbook activo…';
  } else if (!isResolved) {
    elements.resolutionMessage.textContent = `${current.description} Este conflicto sigue pendiente.${navigationWarning}`;
  } else if (current.resolution === 'left') {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió aceptando el valor izquierdo.${navigationWarning}`;
  } else {
    elements.resolutionMessage.textContent = `${current.description} Se resolvió aceptando el valor derecho.${navigationWarning}`;
  }

  elements.acceptLeft.disabled = state.isApplyingResolution || (isResolved && current.resolution === 'left');
  elements.acceptRight.disabled = state.isApplyingResolution || (isResolved && current.resolution === 'right');
}

async function focusConflict(conflictId, { source }) {
  if (!state.session) {
    return;
  }

  state.selectedConflictId = conflictId;
  renderConflictList();
  renderDetail();

  if (source !== 'list') {
    return;
  }

  const conflict = getSelectedConflict();
  if (!conflict) {
    return;
  }

  try {
    state.internalSelectionInFlight = true;
    await selectConflictInWorkbook(conflict, { highlight: true });
    state.selectionWarning = '';
  } catch (error) {
    state.selectionWarning = `No fue posible sincronizar la selección con Excel: ${error.message}`;
    state.internalSelectionInFlight = false;
  }

  renderHostState();
  renderDetail();
}

async function resolveConflict(side) {
  const conflict = getSelectedConflict();
  if (!conflict || !state.session) {
    return;
  }

  state.isApplyingResolution = true;
  renderDetail();

  try {
    await applyConflictToWorkbook(conflict, side);
    state.session = applyConflictResolution(state.session, conflict.id, side);
    await persistSessionToHost(state.session);
    state.hostMessage = 'Se aplicó la resolución en el workbook activo y se guardó el estado de sesión.';
    state.hostDetails = `Último cambio: ${conflict.sheet} ${conflict.cell} → ${side === 'left' ? 'izquierda' : 'derecha'}.`;
  } catch (error) {
    state.hostMessage = 'No se pudo aplicar la resolución en Excel.';
    state.hostDetails = error.message;
  } finally {
    state.isApplyingResolution = false;
    renderSummary();
    renderConflictList();
    renderDetail();
    renderHostState();
  }
}

async function syncSelectionFromExcel() {
  if (!state.session || !state.conflictIndex) {
    return;
  }

  if (state.internalSelectionInFlight) {
    state.internalSelectionInFlight = false;
    return;
  }

  try {
    const selection = await getCurrentSelection();
    if (!selection) {
      return;
    }

    state.workbook = {
      ...(state.workbook ?? {}),
      activeWorksheetName: selection.worksheetName,
      selectionAddress: selection.address,
    };

    const exactConflictId = findConflictByWorksheetAndAddress(
      state.conflictIndex,
      selection.worksheetName,
      selection.address,
    );

    const matchedEntry = exactConflictId
      ? state.conflictIndex.entries.find((entry) => entry.conflictId === exactConflictId)
      : pickBestConflictMatch(
          findConflictsIntersectingRange(state.conflictIndex, selection.worksheetName, selection.address),
        );

    if (!matchedEntry) {
      renderFiles();
      renderDetail();
      return;
    }

    state.selectedConflictId = matchedEntry.conflictId;
    renderFiles();
    renderConflictList();
    renderDetail();
  } catch (error) {
    state.selectionWarning = `No se pudo leer la selección actual del workbook: ${error.message}`;
    renderHostState();
  }
}

async function connectSelectionBridge() {
  if (state.selectionRegistration?.dispose) {
    await state.selectionRegistration.dispose();
  }

  const registration = await registerSelectionChangedHandler(() => {
    void syncSelectionFromExcel();
  });

  state.selectionRegistration = registration;
  if (!registration.supported) {
    state.selectionCapability = 'unsupported';
    state.selectionWarning = registration.error
      ? `El host no expone eventos de selección: ${registration.error.message}`
      : 'El host no soporta eventos de selección; la sincronización Excel → lista queda desactivada.';
  } else {
    state.selectionCapability = 'supported';
    state.selectionWarning = '';
  }
}

async function hydrateRealSession({ reconnecting = false } = {}) {
  state.connectionState = reconnecting ? 'reconnecting' : 'loading';
  state.hostMessage = reconnecting
    ? 'Intentando reconectar con Excel y recargar la sesión…'
    : 'Conectando con Excel y cargando la merge session…';
  state.hostDetails = '';
  state.hostError = null;
  renderHostState();
  renderConflictList();
  renderFiles();

  try {
    const hostData = await loadSessionFromHost();
    state.workbook = hostData.workbook;
    state.session = normalizeSessionPayload(hostData.payload, hostData.workbook);
    state.sessionSource = hostData.source;
    state.selectedConflictId = state.session.conflicts.find((conflict) => conflict.status !== 'resolved')?.id
      ?? state.session.conflicts[0]?.id
      ?? null;
    state.conflictIndex = buildConflictIndex(state.session.conflicts);
    state.connectionState = 'ready';
    state.hostMessage = `Sesión ${state.session.sessionId} cargada correctamente desde ${hostData.source}.`;
    state.hostDetails = `Workbook activo: ${hostData.workbook.name}. Conflictos detectados: ${state.session.conflicts.length}.`;

    const ranges = await getRelevantWorkbookRanges(state.session.conflicts);
    state.rangeAvailability = new Map(ranges.map((range) => [range.conflictId, range.supported]));

    await connectSelectionBridge();
    await syncSelectionFromExcel();
  } catch (error) {
    state.connectionState = 'error';
    state.hostError = error;
    state.session = null;
    state.selectedConflictId = null;
    state.hostMessage = 'No fue posible abrir una sesión real en el host de Excel.';
    state.hostDetails = error.message;
  }

  renderHostState();
  renderFiles();
  renderSummary();
  renderConflictList();
  renderDetail();
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
  elements.acceptLeft.addEventListener('click', () => {
    void resolveConflict('left');
  });
  elements.acceptRight.addEventListener('click', () => {
    void resolveConflict('right');
  });
  elements.reconnectButton.addEventListener('click', () => {
    void hydrateRealSession({ reconnecting: true });
  });
}

function init() {
  bindEvents();
  renderHostState();
  renderSummary();
  renderConflictList();
  renderDetail();
  renderError();
  elements.compareButton.disabled = !canCompare();
  bindEvents();
  renderFiles();
  void hydrateRealSession();
}

init();
