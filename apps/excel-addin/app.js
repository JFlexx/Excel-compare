import {
  buildConflictIndex,
  findConflictByWorksheetAndAddress,
  findConflictsIntersectingRange,
  normalizeSessionPayload,
  pickBestConflictMatch,
} from './src/session-model.js';
import { validateManualEdit } from './src/manual-edit.js';
import { applyManualDecisionToSession, applySideDecisionToSession, buildReviewSummary } from './src/session-operations.js';
import {
  getCurrentSelection,
  loadSessionFromHost,
  persistSessionToHost,
  registerSelectionChangedHandler,
  selectConflictInWorkbook,
  waitForOfficeHost,
} from './src/office-client.js';

const LOCAL_SESSION_KEY = 'excelCompare.usableSession';

const state = {
  session: null,
  selectedConflictId: null,
  filter: 'all',
  sheetFilter: 'all',
  hostReady: false,
  hostWorkbookInfo: null,
  hostSelectionBinding: null,
  exportStatus: { tone: 'neutral', message: 'Carga una sesión para habilitar la exportación.' },
  sessionStatus: 'Sin sesión cargada',
};

const elements = {
  compareForm: document.getElementById('compare-form'),
  baseWorkbookFile: document.getElementById('base-workbook-file'),
  comparedWorkbookFile: document.getElementById('compared-workbook-file'),
  sessionFileForm: document.getElementById('session-file-form'),
  sessionFileInput: document.getElementById('session-file-input'),
  sessionUrlForm: document.getElementById('session-url-form'),
  sessionUrlInput: document.getElementById('session-url-input'),
  loadHostSession: document.getElementById('load-host-session'),
  clearSession: document.getElementById('clear-session'),
  compareStatus: document.getElementById('compare-status'),
  hostChip: document.getElementById('host-chip'),
  fileSummary: document.getElementById('file-summary'),
  summarySheets: document.getElementById('summary-sheets'),
  summaryPending: document.getElementById('summary-pending'),
  summaryResolved: document.getElementById('summary-resolved'),
  progressPercent: document.getElementById('progress-percent'),
  conflictCounter: document.getElementById('conflict-counter'),
  statusFilter: document.getElementById('status-filter'),
  sheetFilter: document.getElementById('sheet-filter'),
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
  reviewChip: document.getElementById('review-chip'),
  reviewAffectedSheets: document.getElementById('review-affected-sheets'),
  reviewCriticalPending: document.getElementById('review-critical-pending'),
  pendingConflictList: document.getElementById('pending-conflict-list'),
  exportButton: document.getElementById('export-button'),
  exportMessage: document.getElementById('export-message'),
};

initApp();

async function initApp() {
  bindEvents();
  await detectOfficeHost();
  restoreLocalSession();
  render();
}

function bindEvents() {
  elements.compareForm.addEventListener('submit', handleCompareWorkbooks);
  elements.sessionFileForm.addEventListener('submit', handleSessionFileImport);
  elements.sessionUrlForm.addEventListener('submit', handleRemoteSessionLoad);
  elements.loadHostSession.addEventListener('click', handleLoadHostSession);
  elements.clearSession.addEventListener('click', handleClearSession);
  elements.statusFilter.addEventListener('change', handleFilterChange);
  elements.sheetFilter.addEventListener('change', handleSheetFilterChange);
  elements.conflictList.addEventListener('click', handleConflictSelection);
  elements.pendingConflictList.addEventListener('click', handlePendingConflictSelection);
  elements.acceptLeft.addEventListener('click', () => applySideDecision('left'));
  elements.acceptRight.addEventListener('click', () => applySideDecision('right'));
  elements.saveManual.addEventListener('click', handleManualSave);
  elements.clearManual.addEventListener('click', clearManualDraft);
  elements.exportButton.addEventListener('click', handleExport);
}

async function detectOfficeHost() {
  try {
    await waitForOfficeHost();
    state.hostReady = true;
    state.hostWorkbookInfo = await getCurrentSelection().catch(() => null);
    elements.hostChip.textContent = 'Host Excel detectado';
    elements.hostChip.className = 'chip chip-success';
  } catch {
    state.hostReady = false;
    elements.hostChip.textContent = 'Host web/local';
    elements.hostChip.className = 'chip chip-neutral';
  }
}

function restoreLocalSession() {
  const raw = globalThis.localStorage?.getItem?.(LOCAL_SESSION_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    applyIncomingSession(parsed, {
      workbookInfo: parsed.workbookInfo ?? null,
      message: 'Se restauró la última sesión guardada en este navegador.',
      tone: 'neutral',
    });
  } catch {
    globalThis.localStorage?.removeItem?.(LOCAL_SESSION_KEY);
  }
}

async function handleCompareWorkbooks(event) {
  event.preventDefault();

  const baseFile = elements.baseWorkbookFile.files?.[0];
  const comparedFile = elements.comparedWorkbookFile.files?.[0];
  if (!baseFile || !comparedFile) {
    setStatus('Selecciona ambos workbooks antes de comparar.', 'critical');
    return;
  }

  setStatus('Comparando workbooks y generando la merge session…', 'neutral');

  try {
    const [base64A, base64B] = await Promise.all([
      readFileAsBase64(baseFile),
      readFileAsBase64(comparedFile),
    ]);

    const response = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseWorkbook: { fileName: baseFile.name, base64: base64A },
        comparedWorkbook: { fileName: comparedFile.name, base64: base64B },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'No se pudo comparar los workbooks.');
    }

    applyIncomingSession(payload.session, {
      workbookInfo: state.hostWorkbookInfo,
      message: `Sesión creada con ${payload.session.workbookDiff?.conflicts?.length ?? payload.session.conflicts?.length ?? 0} conflicto(s).`,
      tone: 'success',
    });
  } catch (error) {
    setStatus(error.message || 'No se pudo generar la sesión.', 'critical');
  }
}

async function handleSessionFileImport(event) {
  event.preventDefault();
  const file = elements.sessionFileInput.files?.[0];
  if (!file) {
    setStatus('Selecciona un archivo JSON antes de importar.', 'critical');
    return;
  }

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    applyIncomingSession(payload, {
      workbookInfo: state.hostWorkbookInfo,
      message: `Sesión JSON cargada desde ${file.name}.`,
      tone: 'success',
    });
  } catch (error) {
    setStatus(error.message || 'El archivo de sesión no es válido.', 'critical');
  }
}

async function handleRemoteSessionLoad(event) {
  event.preventDefault();
  const url = elements.sessionUrlInput.value.trim();
  if (!url) {
    setStatus('Introduce la URL de la sesión remota.', 'critical');
    return;
  }

  setStatus('Descargando sesión remota…', 'neutral');

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`No se pudo descargar la sesión (${response.status}).`);
    }

    const payload = await response.json();
    applyIncomingSession(payload, {
      workbookInfo: state.hostWorkbookInfo,
      message: `Sesión remota cargada desde ${url}.`,
      tone: 'success',
    });
  } catch (error) {
    setStatus(error.message || 'No se pudo cargar la sesión remota.', 'critical');
  }
}

async function handleLoadHostSession() {
  setStatus('Intentando cargar la sesión desde Excel/Office settings…', 'neutral');

  try {
    const loaded = await loadSessionFromHost();
    state.hostWorkbookInfo = loaded.workbook;
    applyIncomingSession(loaded.payload, {
      workbookInfo: loaded.workbook,
      message: `Sesión cargada desde ${loaded.source}.`,
      tone: 'success',
    });
  } catch (error) {
    setStatus(error.message || 'No se pudo recuperar una sesión desde el host.', 'critical');
  }
}

function handleClearSession() {
  state.session = null;
  state.selectedConflictId = null;
  state.filter = 'all';
  state.sheetFilter = 'all';
  state.exportStatus = { tone: 'neutral', message: 'Carga una sesión para habilitar la exportación.' };
  state.sessionStatus = 'Sesión limpiada. Ya puedes comparar dos workbooks o importar una sesión.';
  elements.statusFilter.value = 'all';
  elements.sheetFilter.innerHTML = '<option value="all">Todas las hojas</option>';
  elements.sessionUrlInput.value = '';
  globalThis.localStorage?.removeItem?.(LOCAL_SESSION_KEY);
  cleanupSelectionBinding();
  render();
}

function handleFilterChange(event) {
  state.filter = event.target.value;
  ensureSelectedConflictVisible();
  render();
}

function handleSheetFilterChange(event) {
  state.sheetFilter = event.target.value;
  ensureSelectedConflictVisible();
  render();
}

async function handleConflictSelection(event) {
  const button = event.target.closest('[data-conflict-id]');
  if (!button) {
    return;
  }

  state.selectedConflictId = button.dataset.conflictId;
  render();
  await focusConflictInWorkbook(getSelectedConflict());
}

async function handlePendingConflictSelection(event) {
  const button = event.target.closest('[data-conflict-id]');
  if (!button) {
    return;
  }

  state.selectedConflictId = button.dataset.conflictId;
  render();
  await focusConflictInWorkbook(getSelectedConflict());
}

function applySideDecision(side) {
  const conflict = getSelectedConflict();
  if (!conflict || !state.session) {
    return;
  }

  try {
    const updated = applySideDecisionToSession(state.session, conflict.id, side, {
      decidedBy: 'task-pane',
    });
    commitSessionUpdate(updated, {
      message: `Se guardó la decisión de ${side === 'left' ? 'izquierda' : 'derecha'} para ${conflict.sheet} ${conflict.cell}.`,
      tone: 'success',
    });
  } catch (error) {
    setStatus(error.message || 'No se pudo guardar la decisión.', 'critical');
  }
}

function handleManualSave() {
  const conflict = getSelectedConflict();
  if (!conflict || !state.session) {
    return;
  }

  const rawValue = elements.manualEditInput.value.trim();
  const validation = validateManualEdit(conflict, rawValue);
  if (!validation.valid) {
    elements.manualEditHelp.textContent = validation.error;
    elements.manualEditHelp.className = 'manual-edit-help is-error';
    return;
  }

  try {
    const updated = applyManualDecisionToSession(state.session, conflict.id, rawValue, {
      decidedBy: 'task-pane',
    });
    commitSessionUpdate(updated, {
      message: `Edición manual guardada para ${conflict.sheet} ${conflict.cell}.`,
      tone: 'success',
    });
  } catch (error) {
    elements.manualEditHelp.textContent = error.message || 'No se pudo guardar la edición manual.';
    elements.manualEditHelp.className = 'manual-edit-help is-error';
  }
}

function clearManualDraft() {
  elements.manualEditInput.value = '';
  const conflict = getSelectedConflict();
  elements.manualEditHelp.textContent = conflict?.supportsManualEdit !== false
    ? 'Puedes guardar un valor final o una fórmula simple que empiece por =.'
    : 'La edición manual no está disponible para este conflicto.';
  elements.manualEditHelp.className = 'manual-edit-help';
}

async function handleExport() {
  if (!state.session) {
    state.exportStatus = { tone: 'critical', message: 'Primero debes cargar una sesión.' };
    render();
    return;
  }

  const review = getReview();
  if (!review.canExport) {
    state.exportStatus = {
      tone: 'critical',
      message: `No se puede exportar todavía: quedan ${review.pending} conflicto(s) pendientes.`,
    };
    render();
    return;
  }

  state.exportStatus = { tone: 'neutral', message: 'Generando el workbook final…' };
  render();

  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: state.session }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: 'No se pudo exportar el workbook.' }));
      throw new Error(payload.error || 'No se pudo exportar el workbook.');
    }

    const binary = await response.blob();
    const fileNameHeader = response.headers.get('X-Excel-Compare-FileName');
    const fileName = fileNameHeader ? decodeURIComponent(fileNameHeader) : 'excel-compare-result.xlsx';
    triggerBrowserDownload(binary, fileName);

    state.exportStatus = {
      tone: 'success',
      message: `Workbook exportado correctamente como ${fileName}.`,
    };
    render();
  } catch (error) {
    state.exportStatus = {
      tone: 'critical',
      message: error.message || 'No se pudo exportar el workbook final.',
    };
    render();
  }
}

function applyIncomingSession(rawPayload, { workbookInfo = null, message, tone = 'neutral' } = {}) {
  const normalized = normalizeSessionPayload(rawPayload, workbookInfo);
  normalized.conflicts = (normalized.conflicts ?? []).map((conflict) => ({
    ...conflict,
    supportsManualEdit: conflict.supportsManualEdit ?? (conflict.scopeType !== 'worksheet'),
    manualValue: conflict.manualValue ?? conflict.resolution?.displayValue ?? '',
  }));
  normalized.summary = buildReviewSummary(normalized);
  normalized.status = normalized.summary.pending > 0 ? 'pending_review' : 'ready_for_export';

  state.session = normalized;
  state.selectedConflictId = normalized.conflicts[0]?.id ?? null;
  state.filter = 'all';
  state.sheetFilter = 'all';
  elements.statusFilter.value = 'all';
  syncSheetFilterOptions();
  persistSession(normalized);
  bindHostSelectionUpdates();
  state.sessionStatus = message || `Sesión cargada con ${normalized.conflicts.length} conflicto(s).`;
  state.exportStatus = {
    tone,
    message: normalized.summary.canExport
      ? 'La sesión está lista para exportar el workbook final.'
      : `Sesión cargada. Quedan ${normalized.summary.pending} conflicto(s) pendientes.`,
  };
  render();
}

function commitSessionUpdate(nextSession, { message, tone = 'neutral' } = {}) {
  const normalized = normalizeSessionPayload(nextSession, state.hostWorkbookInfo);
  normalized.summary = buildReviewSummary(normalized);
  normalized.status = normalized.summary.pending > 0 ? 'pending_review' : 'ready_for_export';
  state.session = normalized;
  persistSession(normalized);
  state.sessionStatus = message || 'Sesión actualizada.';
  state.exportStatus = {
    tone,
    message: normalized.summary.canExport
      ? 'No quedan pendientes. Ya puedes exportar el workbook final.'
      : `Sesión actualizada. Quedan ${normalized.summary.pending} conflicto(s) pendientes.`,
  };
  render();
}

function persistSession(session) {
  globalThis.localStorage?.setItem?.(LOCAL_SESSION_KEY, JSON.stringify(session));
  persistSessionToHost(session).catch(() => {});
}

function getVisibleConflicts() {
  const conflicts = state.session?.conflicts ?? [];
  return conflicts.filter((conflict) => {
    const matchesStatus = state.filter === 'all' || conflict.status === state.filter;
    const conflictSheet = conflict.worksheetName ?? conflict.sheet;
    const matchesSheet = state.sheetFilter === 'all' || conflictSheet === state.sheetFilter;
    return matchesStatus && matchesSheet;
  });
}

function getSelectedConflict() {
  return (state.session?.conflicts ?? []).find((conflict) => conflict.id === state.selectedConflictId) ?? null;
}

function getReview() {
  return buildReviewSummary(state.session ?? { conflicts: [] });
}

function ensureSelectedConflictVisible() {
  const visible = getVisibleConflicts();
  if (!visible.some((conflict) => conflict.id === state.selectedConflictId)) {
    state.selectedConflictId = visible[0]?.id ?? state.session?.conflicts?.[0]?.id ?? null;
  }
}

function syncSheetFilterOptions() {
  const sheets = [...new Set((state.session?.conflicts ?? []).map((conflict) => conflict.worksheetName ?? conflict.sheet).filter(Boolean))];
  elements.sheetFilter.innerHTML = ['<option value="all">Todas las hojas</option>', ...sheets.map((sheet) => `<option value="${escapeHtml(sheet)}">${escapeHtml(sheet)}</option>`)].join('');
  elements.sheetFilter.value = state.sheetFilter;
}

function render() {
  renderSummary();
  renderFiles();
  renderConflictList();
  renderDetail();
  renderReview();
  renderExportStatus();
  elements.compareStatus.textContent = state.sessionStatus;
}

function renderSummary() {
  const review = getReview();
  const progress = review.total === 0 ? 0 : Math.round((review.resolved / review.total) * 100);

  elements.summarySheets.textContent = String(review.affectedSheets.length);
  elements.summaryPending.textContent = String(review.pending);
  elements.summaryResolved.textContent = String(review.resolved);
  elements.progressPercent.textContent = `${progress}%`;
  elements.conflictCounter.textContent = review.total === 0
    ? 'Sin conflictos'
    : `${getVisibleConflicts().length} visibles · ${review.pending} pendientes`;
  elements.conflictCounter.className = `chip ${review.pending > 0 ? 'chip-alert' : 'chip-success'}`;
}

function renderFiles() {
  const session = state.session;
  if (!session) {
    elements.fileSummary.innerHTML = '<p class="helper-text">Compara dos workbooks, importa una sesión JSON o recupérala desde Excel.</p>';
    return;
  }

  const files = [session.sourceA, session.sourceB].filter(Boolean);
  const workbookInfo = session.workbookInfo;

  elements.fileSummary.innerHTML = [
    ...files.map((file, index) => `
      <article class="file-card">
        <span class="file-side">${index === 0 ? 'Izquierda' : 'Derecha'}</span>
        <h3>${escapeHtml(file.label ?? file.workbookName ?? `Workbook ${index + 1}`)}</h3>
        <p>${escapeHtml(file.path ?? 'Origen local o sesión importada')}</p>
        <dl class="file-meta-grid">
          <div><dt>Workbook ID</dt><dd>${escapeHtml(file.workbookId ?? '—')}</dd></div>
          <div><dt>Hojas</dt><dd>${escapeHtml(String(file.sheetOrder?.length ?? file.worksheetCount ?? '—'))}</dd></div>
        </dl>
      </article>
    `),
    workbookInfo ? `
      <article class="file-card">
        <span class="file-side">Host Excel</span>
        <h3>${escapeHtml(workbookInfo.name ?? 'Workbook activo')}</h3>
        <p>${escapeHtml(workbookInfo.activeWorksheetName ?? workbookInfo.worksheetName ?? 'Selección actual')}</p>
        <dl class="file-meta-grid">
          <div><dt>Selección</dt><dd>${escapeHtml(workbookInfo.selectionAddress ?? workbookInfo.address ?? '—')}</dd></div>
          <div><dt>Hojas visibles</dt><dd>${escapeHtml(String(workbookInfo.worksheetNames?.length ?? '—'))}</dd></div>
        </dl>
      </article>
    ` : '',
  ].join('');
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
        <button type="button" class="conflict-item ${activeClass}" data-conflict-id="${escapeHtml(conflict.id)}">
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
    elements.detailStatusChip.className = 'chip chip-neutral';
    return;
  }

  const preview = getPreviewValue(conflict);
  const manualHelp = conflict.supportsManualEdit === false
    ? 'La edición manual no está disponible para este conflicto.'
    : 'Puedes guardar un valor final o una fórmula simple que empiece por =.';

  elements.detailEmpty.hidden = true;
  elements.detailContent.hidden = false;
  elements.detailStatusChip.textContent = statusLabel(conflict.status);
  elements.detailStatusChip.className = `chip ${statusChipClass(conflict.status)}`;
  elements.detailSheet.textContent = conflict.sheet;
  elements.detailCell.textContent = conflict.cell;
  elements.detailType.textContent = conflict.type;
  elements.detailDescription.textContent = conflict.description;
  elements.leftBookName.textContent = state.session?.sourceA?.label ?? 'Libro base';
  elements.rightBookName.textContent = state.session?.sourceB?.label ?? 'Libro comparado';
  elements.leftValue.textContent = conflict.leftValue;
  elements.rightValue.textContent = conflict.rightValue;
  elements.manualEditInput.value = conflict.status === 'manual' ? (conflict.manualValue ?? '') : '';
  elements.manualEditInput.disabled = conflict.supportsManualEdit === false;
  elements.saveManual.disabled = conflict.supportsManualEdit === false;
  elements.manualEditScope.textContent = conflict.supportsManualEdit === false ? 'Fuera del alcance' : 'Dentro del alcance';
  elements.manualEditScope.className = `chip ${conflict.supportsManualEdit === false ? 'chip-danger' : 'chip-neutral'}`;
  elements.manualEditHelp.textContent = manualHelp;
  elements.manualEditHelp.className = 'manual-edit-help';
  elements.resolutionMessage.textContent = buildResolutionMessage(conflict, preview);
  elements.finalValue.textContent = preview.displayValue ?? 'Pendiente';
  elements.resolutionOrigin.textContent = preview.originLabel;
}

function renderReview() {
  const review = getReview();
  elements.reviewAffectedSheets.textContent = review.affectedSheets.length > 0 ? review.affectedSheets.join(', ') : '—';
  elements.reviewCriticalPending.textContent = String(review.criticalPending);
  elements.reviewChip.textContent = !state.session
    ? 'Sin revisar'
    : review.canExport
      ? 'Listo para exportar'
      : `Faltan ${review.pending}`;
  elements.reviewChip.className = `chip ${!state.session ? 'chip-neutral' : review.canExport ? 'chip-success' : 'chip-alert'}`;

  if (review.pendingConflicts.length === 0) {
    elements.pendingConflictList.innerHTML = '<li class="empty-list">No quedan conflictos pendientes.</li>';
    return;
  }

  elements.pendingConflictList.innerHTML = review.pendingConflicts.map((conflict) => `
    <li>
      <button type="button" class="conflict-item" data-conflict-id="${escapeHtml(conflict.id)}">
        <div class="conflict-item-header">
          <strong>${escapeHtml(conflict.sheet)} · ${escapeHtml(conflict.cell)}</strong>
          <span class="chip ${conflict.severity === 'critical' || ['formula_changed', 'worksheet_missing', 'worksheet_added', 'structural_conflict'].includes(conflict.changeType) ? 'chip-danger' : 'chip-alert'}">Pendiente</span>
        </div>
        <p class="conflict-item-description">${escapeHtml(conflict.description ?? conflict.reason ?? 'Requiere decisión.')}</p>
      </button>
    </li>
  `).join('');
}

function renderExportStatus() {
  elements.exportMessage.textContent = state.exportStatus.message;
  elements.exportMessage.className = `export-message tone-${state.exportStatus.tone}`;
  elements.exportButton.disabled = !state.session;
}

async function bindHostSelectionUpdates() {
  cleanupSelectionBinding();
  if (!state.hostReady || !state.session) {
    return;
  }

  state.hostSelectionBinding = await registerSelectionChangedHandler(async () => {
    try {
      const selection = await getCurrentSelection();
      state.hostWorkbookInfo = {
        ...(state.hostWorkbookInfo ?? {}),
        worksheetName: selection.worksheetName,
        address: selection.address,
        selectionAddress: selection.address,
      };
      const match = findConflictForSelection(selection);
      if (match && match.conflictId !== state.selectedConflictId) {
        state.selectedConflictId = match.conflictId;
        render();
      } else {
        renderFiles();
      }
    } catch {
      // noop defensivo
    }
  });
}

function cleanupSelectionBinding() {
  if (state.hostSelectionBinding?.dispose) {
    state.hostSelectionBinding.dispose().catch?.(() => {});
  }
  state.hostSelectionBinding = null;
}

function findConflictForSelection(selection) {
  const session = state.session;
  if (!session) {
    return null;
  }

  const index = buildConflictIndex(session.conflicts);
  const exact = findConflictByWorksheetAndAddress(index, selection.worksheetName, selection.address);
  if (exact) {
    return { conflictId: exact };
  }

  const matches = findConflictsIntersectingRange(index, selection.worksheetName, selection.address);
  return pickBestConflictMatch(matches);
}

async function focusConflictInWorkbook(conflict) {
  if (!state.hostReady || !conflict?.worksheetName || !conflict?.address) {
    return;
  }

  try {
    await selectConflictInWorkbook(conflict, { silent: true });
    state.hostWorkbookInfo = {
      ...(state.hostWorkbookInfo ?? {}),
      worksheetName: conflict.worksheetName,
      address: conflict.address,
      selectionAddress: conflict.address,
    };
    renderFiles();
  } catch {
    // noop defensivo
  }
}

function getPreviewValue(conflict) {
  const previewKey = conflict.cellRef ?? conflict.cellRefs?.[0] ?? conflict.id;
  const preview = state.session?.resultPreview?.cells?.[previewKey] ?? null;
  if (preview) {
    return {
      displayValue: preview.displayValue ?? String(preview.value ?? 'Pendiente'),
      originLabel: preview.origin === 'manual_edit'
        ? 'Edición manual'
        : preview.origin === 'sourceB'
          ? 'Libro comparado'
          : 'Libro base',
    };
  }

  if (conflict.status === 'resolved' && conflict.resolution === 'right') {
    return { displayValue: conflict.rightValue, originLabel: 'Libro comparado' };
  }
  if (conflict.status === 'resolved' && conflict.resolution === 'left') {
    return { displayValue: conflict.leftValue, originLabel: 'Libro base' };
  }
  if (conflict.status === 'manual') {
    return { displayValue: conflict.manualValue || 'Pendiente', originLabel: 'Edición manual' };
  }
  return { displayValue: 'Pendiente', originLabel: 'Sin resolver' };
}

function buildResolutionMessage(conflict, preview) {
  if (conflict.status === 'manual') {
    return `Se aplicará la edición manual definida por el revisor. Valor final: ${preview.displayValue}.`;
  }
  if (conflict.status === 'resolved' && conflict.resolution === 'left') {
    return 'Se conservará el valor del libro base.';
  }
  if (conflict.status === 'resolved' && conflict.resolution === 'right') {
    return 'Se conservará el valor del libro comparado.';
  }
  return 'Pendiente de resolución.';
}

function setStatus(message, tone = 'neutral') {
  state.sessionStatus = message;
  state.exportStatus = { tone, message };
  render();
}

function triggerBrowserDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function readFileAsBase64(file) {
  const buffer = await file.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function statusChipClass(status) {
  switch (status) {
    case 'resolved':
      return 'chip-success';
    case 'manual':
      return 'chip-manual';
    default:
      return 'chip-alert';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'resolved':
      return 'Resuelto';
    case 'manual':
      return 'Manual';
    default:
      return 'Pendiente';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
