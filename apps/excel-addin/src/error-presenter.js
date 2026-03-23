import { normalizeEngineError, OPERATIONAL_LIMITS } from '../../../services/merge-engine/src/error-catalog.js';

const VIEW_STATE_BY_STATUS = Object.freeze({
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

function buildVisibleOperationalLimits() {
  return {
    standard: [
      'Hasta 25 MB por archivo en uso estándar.',
      'Hasta 25 hojas por libro.',
      'Hasta 200.000 celdas relevantes por comparación.',
      'Una operación activa por usuario y sesión.',
    ],
    extended: [
      'Hasta 50 MB por archivo con advertencia de degradación controlada.',
      'Si se supera el umbral estándar, el análisis puede ralentizarse o bloquearse para proteger Excel.',
    ],
    scope: [
      OPERATIONAL_LIMITS.platformScope.primary,
      OPERATIONAL_LIMITS.platformScope.controlledAlternative,
      OPERATIONAL_LIMITS.platformScope.outOfScope,
    ],
  };
}

function createUserErrorView(input) {
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
      engineError.code === 'WORKBOOK_TOO_LARGE' ? buildVisibleOperationalLimits() : null,
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

function resolveActionLabel(code) {
  switch (code) {
    case 'CRITICAL_CONFLICTS_PENDING_EXPORT':
      return 'Revisar conflictos críticos';
    case 'WORKBOOK_TOO_LARGE':
      return 'Ver límites operativos';
    case 'INVALID_SESSION_STATE':
      return 'Reiniciar comparación';
    case 'UNINTERPRETABLE_FORMULAS':
      return 'Revisar fórmulas';
    default:
      return 'Ver cómo resolverlo';
  }
}

function buildExportGuard(summary = {}) {
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

function recordAddinError(logger, viewModel) {
  const payload = viewModel.telemetry
    ? {
        ...viewModel.telemetry,
        title: viewModel.title,
      }
    : null;

  if (!payload) {
    return null;
  }

  if (logger && typeof logger.error === 'function') {
    logger.error(payload);
    return payload;
  }

  console.error(payload);
  return payload;
}

export {
  VIEW_STATE_BY_STATUS,
  buildExportGuard,
  buildVisibleOperationalLimits,
  createUserErrorView,
  recordAddinError,
  resolveActionLabel,
};
