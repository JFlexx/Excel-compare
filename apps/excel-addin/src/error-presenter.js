import { normalizeEngineError } from '../../../services/merge-engine/src/error-catalog.js';
import { normalizeEngineError, OPERATIONAL_LIMITS } from '../../../services/merge-engine/src/error-catalog.js';
import { normalizeEngineError } from '../../../services/merge-engine/src/error-catalog.js';
const ERROR_DEFINITIONS = Object.freeze({
  CORRUPT_FILE: {
    code: 'CORRUPT_FILE',
    userTitle: 'No pudimos abrir el archivo',
    userMessage:
      'Parece que el archivo está dañado, incompleto o protegido de una forma que este MVP todavía no puede procesar. Prueba con otra copia del archivo o vuelve a guardarlo antes de intentarlo de nuevo.',
    userAction: 'Revisa si el archivo se abre correctamente en Excel y vuelve a cargarlo.',
    status: 'blocked',
    severity: 'error',
    stage: 'ingestion',
  },
  UNINTERPRETABLE_FORMULAS: {
    code: 'UNINTERPRETABLE_FORMULAS',
    userTitle: 'Hay fórmulas que necesitan revisión',
    userMessage:
      'Detectamos fórmulas que este MVP no puede interpretar con seguridad. Necesitamos que las revises o simplifiques antes de continuar.',
    userAction: 'Verifica las fórmulas señaladas y vuelve a intentar la comparación.',
    status: 'needs_attention',
    severity: 'error',
    stage: 'analysis',
  },
  WORKBOOK_TOO_LARGE: {
    code: 'WORKBOOK_TOO_LARGE',
    userTitle: 'El libro es demasiado grande para este MVP',
    userMessage:
      'El archivo supera el tamaño o la complejidad que podemos procesar de forma confiable en esta versión. Divide el libro o reduce el alcance antes de volver a intentarlo.',
    userAction: 'Reduce la cantidad de hojas o el rango utilizado y vuelve a cargar el archivo.',
    status: 'blocked',
    severity: 'error',
    stage: 'limits',
  },
  CRITICAL_CONFLICTS_PENDING_EXPORT: {
    code: 'CRITICAL_CONFLICTS_PENDING_EXPORT',
    userTitle: 'Todavía no puedes exportar',
    userMessage:
      'Aún quedan conflictos críticos por resolver. Revisa los elementos marcados y completa esas decisiones antes de exportar el resultado final.',
    userAction: 'Abre la lista de conflictos críticos y resuélvelos antes de exportar.',
    status: 'blocked',
    severity: 'error',
    stage: 'export',
  },
});

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

export function resolveActionLabel(code) {
  switch (code) {
    case 'CRITICAL_CONFLICTS_PENDING_EXPORT':
      return 'Revisar conflictos críticos';
    case 'WORKBOOK_TOO_LARGE':
      return 'Ver límites del MVP';
    case 'UNSUPPORTED_PILOT_FEATURES':
      return 'Ver alcance del piloto';
    case 'AMBIGUOUS_STRUCTURAL_CHANGE':
      return 'Revisar estructura';
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

export function buildExportGuard(summary = {}) {
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

export {
  VIEW_STATE_BY_STATUS,
  buildExportGuard,
  buildVisibleOperationalLimits,
  createUserErrorView,
  recordAddinError,
  resolveActionLabel,
};
function normalizeEngineError(input = {}) {
  const code = input.code || inferErrorCode(input);
  const definition = ERROR_DEFINITIONS[code] || ERROR_DEFINITIONS.CORRUPT_FILE;
  const context = input.context ?? {};

  return {
    ...definition,
    supportContext: {
      sessionId: context.sessionId,
      workbookId: context.workbookId,
      worksheetName: context.worksheetName,
      fileName: context.fileName,
      operation: context.operation,
      limits: context.limits,
      metrics: context.metrics,
      pendingConflictCount: context.pendingConflictCount,
    },
    technicalDetails: {
      source: context.source || 'merge-engine',
      operation: context.operation,
      rawMessage: input.cause?.message || context.rawMessage,
      rawCode: input.cause?.code || context.rawCode,
      stack: input.cause?.stack,
      causeName: input.cause?.name,
      diagnostics: context.diagnostics,
    },
  };
}

function inferErrorCode(input = {}) {
  const probe = [input.rawCode, input.message, input.cause?.message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (probe.includes('formula') || probe.includes('#ref!') || probe.includes('#name?')) {
    return 'UNINTERPRETABLE_FORMULAS';
  }
  if (probe.includes('limit') || probe.includes('too large') || probe.includes('max cells')) {
    return 'WORKBOOK_TOO_LARGE';
  }
  if (probe.includes('export') || probe.includes('critical conflict')) {
    return 'CRITICAL_CONFLICTS_PENDING_EXPORT';
  }

  return input.fallbackCode || 'CORRUPT_FILE';
}
