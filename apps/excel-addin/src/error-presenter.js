import { normalizeEngineError } from '../../../services/merge-engine/src/error-catalog.js';
import { buildVisibleMvpLimits } from '../../../services/merge-engine/src/mvp-config.js';

export const VIEW_STATE_BY_STATUS = Object.freeze({
  blocked: {
    tone: 'critical',
    canRetry: true,
    canContinue: false,
    highlightPendingConflicts: false,
    userSeverityLabel: 'Bloqueado',
  },
  needs_attention: {
    tone: 'warning',
    canRetry: true,
    canContinue: false,
    highlightPendingConflicts: true,
    userSeverityLabel: 'Requiere atención',
  },
});

export function buildVisibleOperationalLimits() {
  const visible = buildVisibleMvpLimits();
  return {
    standard: [
      `Hasta ${visible.operationalLimits.standard.maxFileSizeMb} MB por archivo en uso estándar.`,
      `Hasta ${visible.operationalLimits.standard.maxSheets} hojas por libro.`,
      `Hasta ${visible.operationalLimits.standard.maxUsedCells.toLocaleString('es-ES')} celdas relevantes por comparación.`,
      `Una operación activa por usuario y sesión.`,
    ],
    extended: [
      `Hasta ${visible.operationalLimits.extended.maxFileSizeMb} MB por archivo con advertencia de degradación controlada.`,
      visible.operationalLimits.extended.degradation,
    ],
    scope: [
      visible.operationalLimits.platformScope.primary,
      visible.operationalLimits.platformScope.controlledAlternative,
      visible.operationalLimits.platformScope.outOfScope,
    ],
    outOfScope: visible.outOfScope,
  };
}

export function resolveActionLabel(code) {
  switch (code) {
    case 'CRITICAL_CONFLICTS_PENDING_EXPORT':
      return 'Revisar conflictos críticos';
    case 'PENDING_CONFLICTS_PENDING_EXPORT':
      return 'Resolver pendientes';
    case 'WORKBOOK_TOO_LARGE':
      return 'Ver límites del MVP';
    case 'UNSUPPORTED_PILOT_FEATURES':
      return 'Ver alcance del piloto';
    case 'AMBIGUOUS_STRUCTURAL_CHANGE':
      return 'Revisar estructura';
    case 'INVALID_SESSION_STATE':
      return 'Reiniciar comparación';
    case 'UNINTERPRETABLE_FORMULAS':
      return 'Revisar fórmulas';
    default:
      return 'Ver cómo resolverlo';
  }
}

export function createUserErrorView(input) {
  const engineError = normalizeEngineError(input);
  const state = VIEW_STATE_BY_STATUS[engineError.status] || VIEW_STATE_BY_STATUS.blocked;

  return {
    type: 'inline-banner',
    tone: state.tone,
    severityLabel: state.userSeverityLabel,
    title: engineError.userTitle,
    message: engineError.userMessage,
    actionLabel: resolveActionLabel(engineError.code),
    nextStep: engineError.userAction,
    canRetry: state.canRetry,
    canContinue: state.canContinue,
    highlightPendingConflicts: state.highlightPendingConflicts,
    supportHint: `Identificador de soporte: ${engineError.supportReference}`,
    visibleOperationalLimits:
      engineError.code === 'WORKBOOK_TOO_LARGE' || engineError.code === 'UNSUPPORTED_PILOT_FEATURES'
        ? buildVisibleOperationalLimits()
        : engineError.visibleMvpLimits ?? null,
    telemetry: buildPresentedTelemetry(engineError, state),
  };
}

function buildPresentedTelemetry(engineError, state) {
  return {
    event: 'excel_addin_user_error_presented',
    code: engineError.code,
    stage: engineError.stage,
    severity: engineError.severity,
    status: engineError.status,
    tone: state.tone,
    severityLabel: state.userSeverityLabel,
    supportReference: engineError.supportReference,
    supportContext: engineError.supportContext,
    technicalDetails: engineError.technicalDetails,
    presentedAt: new Date().toISOString(),
  };
}

export function buildExportGuard(summary = {}) {
  if (summary.sessionInvalid || summary.sessionStatus === 'invalid') {
    return createUserErrorView({
      code: 'INVALID_SESSION_STATE',
      context: {
        operation: 'export-result',
        sessionId: summary.sessionId,
        sessionStatus: summary.sessionStatus || 'invalid',
        invalidReason: summary.invalidReason || 'session invalid during export guard',
        diagnostics: summary,
      },
    });
  }

  if (summary.criticalConflictsPending > 0) {
    return createUserErrorView({
      code: 'CRITICAL_CONFLICTS_PENDING_EXPORT',
      context: {
        sessionId: summary.sessionId,
        operation: 'export-result',
        pendingConflictCount: summary.criticalConflictsPending,
        diagnostics: summary,
      },
    });
  }

  if (summary.totalPending > 0) {
    return createUserErrorView({
      code: 'PENDING_CONFLICTS_PENDING_EXPORT',
      context: {
        operation: 'export-result',
        pendingConflictCount: summary.totalPending,
        diagnostics: summary,
      },
    });
  }

  return {
    type: 'inline-banner',
    tone: 'success',
    severityLabel: 'Listo',
    title: 'Listo para exportar',
    message: 'No quedan conflictos críticos pendientes. Ya puedes exportar el resultado final.',
    actionLabel: 'Exportar resultado',
    nextStep: 'Continúa con la exportación.',
    canRetry: false,
    canContinue: true,
    highlightPendingConflicts: false,
    supportHint: null,
    visibleOperationalLimits: null,
    telemetry: null,
  };
}

export function recordAddinError(logger, viewModel) {
  const payload = {
    event: 'excel_addin_user_error_presented',
    tone: viewModel.tone,
    title: viewModel.title,
    telemetry: viewModel.telemetry,
  };

  if (logger && typeof logger.error === 'function') {
    logger.error(payload);
    return payload;
  }

  console.error(payload);
  return payload;
}
