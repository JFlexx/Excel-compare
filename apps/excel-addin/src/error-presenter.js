const OPERATIONAL_LIMITS = Object.freeze({
  standard: {
    maxFileSizeMb: 25,
    maxSheets: 25,
    maxUsedCells: 200000,
    maxConcurrentOperationsPerUser: 1,
  },
  platformScope: {
    primary: 'Excel Desktop para Windows con Microsoft 365 Apps for enterprise.',
    controlledAlternative: 'Excel 2021 LTSC aprobado por TI.',
    outOfScope: 'Excel para Mac sigue fuera de alcance inicial salvo validación expresa de TI.',
  },
});

const ERROR_DEFINITIONS = Object.freeze({
  UNSUPPORTED_PILOT_FEATURES: {
    code: 'UNSUPPORTED_PILOT_FEATURES',
    userTitle: 'Este archivo queda fuera del piloto',
    userMessage:
      'Detectamos macros, tablas dinámicas complejas, objetos embebidos o formatos avanzados. Este caso queda fuera del alcance del piloto.',
    userAction:
      'Elimina esas características o usa una versión simplificada del libro antes de volver a compararlo.',
    status: 'blocked',
    severity: 'error',
    stage: 'analysis',
  },
  UNINTERPRETABLE_FORMULAS: {
    code: 'UNINTERPRETABLE_FORMULAS',
    userTitle: 'Hay fórmulas que requieren atención',
    userMessage:
      'Detectamos fórmulas no soportadas o ambiguas para este MVP. La sesión sigue disponible, pero necesitas revisarlas antes de continuar.',
    userAction:
      'Identifica las fórmulas marcadas, sustitúyelas por valores o fórmulas compatibles y vuelve a ejecutar el análisis.',
    status: 'needs_attention',
    severity: 'error',
    stage: 'analysis',
  },
  WORKBOOK_TOO_LARGE: {
    code: 'WORKBOOK_TOO_LARGE',
    userTitle: 'El libro supera los límites operativos del MVP',
    userMessage:
      'El archivo excede el tamaño o la complejidad soportados para uso estándar y podríamos degradar el análisis o bloquear Excel si continuamos.',
    userAction:
      'Reduce el alcance a un máximo estándar de 25 MB, 25 hojas y 200.000 celdas relevantes, o divide el libro antes de reintentar.',
    status: 'blocked',
    severity: 'error',
    stage: 'limits',
  },
  CRITICAL_CONFLICTS_PENDING_EXPORT: {
    code: 'CRITICAL_CONFLICTS_PENDING_EXPORT',
    userTitle: 'La exportación está bloqueada',
    userMessage:
      'Todavía quedan conflictos críticos por resolver. Exportar ahora dejaría el resultado final incompleto o inconsistente.',
    userAction:
      'Abre la lista de conflictos críticos, resuélvelos y confirma que no quedan pendientes antes de exportar.',
    status: 'blocked',
    severity: 'error',
    stage: 'export',
  },
  PENDING_CONFLICTS_PENDING_EXPORT: {
    code: 'PENDING_CONFLICTS_PENDING_EXPORT',
    userTitle: 'Debes resolver los pendientes antes de exportar',
    userMessage:
      'Todavía quedan conflictos o decisiones pendientes. Revísalos antes de generar el archivo final para evitar un resultado incompleto.',
    userAction:
      'Vuelve a la revisión final, localiza los pendientes y termina esas decisiones antes de exportar.',
    status: 'blocked',
    severity: 'error',
    stage: 'export',
  },
  INVALID_SESSION_STATE: {
    code: 'INVALID_SESSION_STATE',
    userTitle: 'La sesión requiere reiniciarse',
    userMessage:
      'Detectamos una sesión inválida o inconsistente y detuvimos la operación para evitar cambios silenciosamente corruptos.',
    userAction:
      'Cierra la comparación actual, vuelve a cargar ambos libros y comparte el identificador de soporte si el problema se repite.',
    status: 'blocked',
    severity: 'critical',
    stage: 'session',
  },
});

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

function sanitizeForUser(value) {
  if (!value) {
    return undefined;
  }

  return String(value)
    .replace(/(?:[A-Z]:)?[^\s]+\.(?:js|ts|json|xml|zip|xlsx|xlsm)/gi, '[archivo interno]')
    .replace(/\b(?:TypeError|RangeError|SyntaxError|ReferenceError|OpenXml|ZipException|Stack trace)\b/gi, 'detalle interno')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSupportReference(context = {}, code) {
  const sessionToken = context.sessionId ? String(context.sessionId).slice(-8) : 'sin-sesion';
  return `SUP-${code}-${sessionToken}`;
}

function resolveActionLabel(code) {
  switch (code) {
    case 'UNSUPPORTED_PILOT_FEATURES':
      return 'Ver alcance del piloto';
    case 'UNINTERPRETABLE_FORMULAS':
      return 'Revisar fórmulas';
    case 'WORKBOOK_TOO_LARGE':
      return 'Ver límites operativos';
    case 'CRITICAL_CONFLICTS_PENDING_EXPORT':
      return 'Revisar conflictos críticos';
    case 'PENDING_CONFLICTS_PENDING_EXPORT':
      return 'Resolver pendientes';
    case 'INVALID_SESSION_STATE':
      return 'Reiniciar comparación';
    default:
      return 'Ver cómo resolverlo';
  }
}

function buildVisibleOperationalLimits() {
  return {
    standard: [
      'Hasta 25 MB por archivo en uso estándar.',
      'Hasta 25 hojas por libro.',
      'Hasta 200.000 celdas relevantes por comparación.',
      'Una operación activa por usuario y sesión.',
    ],
    scope: [
      OPERATIONAL_LIMITS.platformScope.primary,
      OPERATIONAL_LIMITS.platformScope.controlledAlternative,
      OPERATIONAL_LIMITS.platformScope.outOfScope,
    ],
  };
}

function normalizeEngineError(input = {}) {
  const code = input.code ?? 'INVALID_SESSION_STATE';
  const definition = ERROR_DEFINITIONS[code] ?? ERROR_DEFINITIONS.INVALID_SESSION_STATE;
  const context = input.context ?? {};

  return {
    ...definition,
    supportReference: buildSupportReference(context, definition.code),
    supportContext: {
      sessionId: context.sessionId,
      operation: context.operation,
      limits: context.limits,
      metrics: context.metrics,
      pendingConflictCount: context.pendingConflictCount,
      sessionStatus: context.sessionStatus,
      invalidReason: context.invalidReason,
    },
    technicalDetails: {
      source: context.source || 'merge-engine',
      operation: context.operation,
      diagnostics: context.diagnostics,
      userHint: sanitizeForUser(context.userHint),
    },
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

export function createUserErrorView(input) {
  const engineError = normalizeEngineError(input);
  const state = VIEW_STATE_BY_STATUS[engineError.status] ?? VIEW_STATE_BY_STATUS.blocked;

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
    visibleOperationalLimits: engineError.code === 'WORKBOOK_TOO_LARGE' ? buildVisibleOperationalLimits() : null,
    telemetry: buildPresentedTelemetry(engineError, state),
  };
}

export function buildExportGuard(summary = {}) {
  if (summary.sessionInvalid || summary.sessionStatus === 'invalid') {
    return createUserErrorView({
      code: 'INVALID_SESSION_STATE',
      context: {
        sessionId: summary.sessionId,
        operation: 'export-result',
        sessionStatus: summary.sessionStatus || 'invalid',
        invalidReason: summary.invalidReason || 'session invalid during export guard',
      },
    });
  }

  if ((summary.criticalConflictsPending ?? 0) > 0) {
    return createUserErrorView({
      code: 'CRITICAL_CONFLICTS_PENDING_EXPORT',
      context: {
        sessionId: summary.sessionId,
        operation: 'export-result',
        pendingConflictCount: summary.criticalConflictsPending,
      },
    });
  }

  if ((summary.totalPending ?? 0) > 0) {
    return createUserErrorView({
      code: 'PENDING_CONFLICTS_PENDING_EXPORT',
      context: {
        sessionId: summary.sessionId,
        operation: 'export-result',
        pendingConflictCount: summary.totalPending,
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
  if (!viewModel?.telemetry) {
    return null;
  }

  const payload = {
    ...viewModel.telemetry,
    tone: viewModel.tone,
    title: viewModel.title,
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
  buildVisibleOperationalLimits,
  resolveActionLabel,
};
