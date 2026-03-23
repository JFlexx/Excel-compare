import { normalizeEngineError } from '../../../services/merge-engine/src/error-catalog.js';

export const VIEW_STATE_BY_STATUS = Object.freeze({
  blocked: {
    tone: 'critical',
    canRetry: true,
    canContinue: false,
    highlightPendingConflicts: false,
  },
  needs_attention: {
    tone: 'warning',
    canRetry: true,
    canContinue: false,
    highlightPendingConflicts: true,
  },
});

export function createUserErrorView(input) {
  const engineError = normalizeEngineError(input);
  const state = VIEW_STATE_BY_STATUS[engineError.status] || VIEW_STATE_BY_STATUS.blocked;

  return {
    type: 'inline-banner',
    tone: state.tone,
    title: engineError.userTitle,
    message: engineError.userMessage,
    actionLabel: resolveActionLabel(engineError.code),
    nextStep: engineError.userAction,
    canRetry: state.canRetry,
    canContinue: state.canContinue,
    highlightPendingConflicts: state.highlightPendingConflicts,
    telemetry: {
      code: engineError.code,
      stage: engineError.stage,
      severity: engineError.severity,
      supportContext: engineError.supportContext,
      technicalDetails: engineError.technicalDetails,
    },
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
    default:
      return 'Ver cómo resolverlo';
  }
}

export function buildExportGuard(summary = {}) {
  if (summary.criticalConflictsPending > 0) {
    return createUserErrorView({
      code: 'CRITICAL_CONFLICTS_PENDING_EXPORT',
      context: {
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
    title: 'Listo para exportar',
    message: 'No quedan conflictos críticos pendientes. Ya puedes exportar el resultado final.',
    actionLabel: 'Exportar resultado',
    nextStep: 'Continúa con la exportación.',
    canRetry: false,
    canContinue: true,
    highlightPendingConflicts: false,
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
