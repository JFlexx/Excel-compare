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
      const statusClass = conflict.status === 'resolved' ? 'chip-success' : 'chip-pending';
      const statusText = conflict.status === 'resolved' ? 'Resuelto' : 'Pendiente';
      const rangeSupported = state.rangeAvailability.get(conflict.id);
      const capability = rangeSupported === false ? '<span class="conflict-item-note">Sin navegación Office.js</span>' : '';

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
  const visibleConflict = getFilteredConflicts().find((item) => item.id === state.selectedConflictId) ?? conflict;

  if (!visibleConflict) {
    elements.detailEmpty.hidden = false;
    elements.detailContent.hidden = true;
    elements.detailStatusChip.textContent = 'Sin selección';
    elements.detailStatusChip.className = 'chip chip-neutral';
    elements.activeSheet.textContent = state.workbook?.activeWorksheetName ?? '—';
    elements.activeCell.textContent = state.workbook?.selectionAddress ?? '—';
    return;
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
  elements.filter.addEventListener('change', (event) => {
    state.filter = event.target.value;
    renderConflictList();
    renderDetail();
  });

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
  renderFiles();
  void hydrateRealSession();
}

init();
