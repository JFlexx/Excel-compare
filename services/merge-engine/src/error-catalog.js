const OPERATIONAL_LIMITS = Object.freeze({
  standard: {
    maxFileSizeMb: 25,
    maxSheets: 25,
    maxUsedCells: 200000,
    maxConcurrentOperationsPerUser: 1,
    preparationSeconds: 5,
    analysisSeconds: 30,
    presentationSeconds: 5,
    decisionSeconds: 2,
  },
  extended: {
    maxFileSizeMb: 50,
    degradation: 'Puede haber degradación controlada y se advertirá antes de continuar.',
  },
  platformScope: {
    primary: 'Excel Desktop para Windows con Microsoft 365 Apps for enterprise.',
    controlledAlternative: 'Excel 2021 LTSC aprobado por TI.',
    exceptionalAlternative: 'Excel 2019 solo si TI lo mantiene y no faltan APIs necesarias.',
    outOfScope: 'Excel para Mac sigue fuera de alcance inicial salvo validación expresa de TI.',
  },
});

const ERROR_DEFINITIONS = Object.freeze({
export const ERROR_DEFINITIONS = Object.freeze({
  CORRUPT_FILE: {
    code: 'CORRUPT_FILE',
    userTitle: 'No pudimos abrir el archivo',
    userMessage:
      'Parece que el archivo está dañado, incompleto o protegido de una forma que este MVP todavía no puede procesar.',
    userAction:
      'Abre el libro en Excel, guarda una copia nueva y vuelve a cargarla. Si falla otra vez, comparte el identificador de soporte con el equipo interno.',
    status: 'blocked',
    severity: 'error',
    stage: 'ingestion',
  },
  UNSUPPORTED_FORMAT: {
    code: 'UNSUPPORTED_FORMAT',
    userTitle: 'Este archivo no es compatible',
    userMessage:
      'Por ahora solo podemos trabajar con libros .xlsx o .xlsm sin características fuera del alcance inicial.',
    userAction:
      'Guarda el archivo en un formato compatible y elimina características no soportadas antes de reintentar.',
    status: 'blocked',
    severity: 'error',
    stage: 'ingestion',
  },
  UNSUPPORTED_PILOT_FEATURES: {
    code: 'UNSUPPORTED_PILOT_FEATURES',
    userTitle: 'Este archivo queda fuera del piloto',
    userMessage:
      'Detectamos macros, tablas dinámicas complejas, objetos embebidos o formatos avanzados. Este caso no está soportado en el piloto.',
    userAction:
      'Elimina esas características o usa una versión simplificada del libro antes de volver a compararlo.',
    status: 'blocked',
    severity: 'error',
    stage: 'analysis',
  },
  AMBIGUOUS_STRUCTURAL_CHANGE: {
    code: 'AMBIGUOUS_STRUCTURAL_CHANGE',
    userTitle: 'La estructura del libro es ambigua para este piloto',
    userMessage:
      'Revisa hojas renombradas, celdas combinadas o movimientos complejos antes de volver a intentar. Este piloto solo admite hojas agregadas o eliminadas de forma sencilla.',
    userAction:
      'Simplifica la estructura del libro o separa el cambio en un archivo más claro para el piloto.',
    status: 'blocked',
    severity: 'error',
    stage: 'analysis',
  },
  UNREADABLE_SHEET: {
    code: 'UNREADABLE_SHEET',
    userTitle: 'No pudimos leer una de las hojas',
    userMessage:
      'Encontramos una hoja que no se puede interpretar de forma confiable con este MVP.',
    userAction:
      'Revisa si la hoja tiene protección, referencias rotas o estructuras especiales; después vuelve a comparar.',
    status: 'blocked',
    severity: 'error',
    stage: 'analysis',
  },
  UNINTERPRETABLE_FORMULAS: {
    code: 'UNINTERPRETABLE_FORMULAS',
    userTitle: 'Hay fórmulas que requieren atención',
    userMessage:
      'Detectamos fórmulas no soportadas o ambiguas para este MVP. La sesión se mantiene consistente, pero necesitas revisarlas antes de continuar con confianza.',
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
  EXPORT_VALIDATION_FAILED: {
    code: 'EXPORT_VALIDATION_FAILED',
    userTitle: 'La sesión no está lista para generar el archivo final',
    userMessage:
      'Detectamos una inconsistencia entre la sesión, el diff o las decisiones guardadas. Revisa la sesión y vuelve a intentarlo.',
    userAction:
      'Actualiza la sesión de merge, confirma que las decisiones pertenezcan a esta comparación y vuelve a generar el resultado.',
    status: 'blocked',
    severity: 'error',
    stage: 'export',
  },
  MERGE_RESULT_GENERATION_FAILED: {
    code: 'MERGE_RESULT_GENERATION_FAILED',
    userTitle: 'No pudimos generar el archivo final',
    userMessage:
      'Ocurrió un problema al construir el resultado consolidado. Intenta de nuevo y, si el error continúa, vuelve a abrir la comparación.',
    userAction:
      'Reintenta la generación del archivo final o vuelve a cargar la comparación.',
    status: 'blocked',
    severity: 'error',
    stage: 'export',
  },
  MERGE_RESULT_DOWNLOAD_FAILED: {
    code: 'MERGE_RESULT_DOWNLOAD_FAILED',
    userTitle: 'No pudimos descargar el archivo final',
    userMessage:
      'Generamos el resultado, pero no fue posible iniciar la descarga del archivo. Verifica los permisos de descarga del navegador o del add-in e inténtalo de nuevo.',
    userAction:
      'Comprueba que el navegador permita descargas y vuelve a intentar la exportación.',
    status: 'blocked',
    severity: 'error',
    stage: 'export',
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

export function sanitizeForUser(value) {
  if (!value) return undefined;
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

function pickSupportContext(context = {}) {
  return {
    sessionId: context.sessionId,
    workbookId: context.workbookId,
    worksheetName: context.worksheetName,
    fileName: context.fileName,
    operation: context.operation,
    limits: context.limits,
    metrics: context.metrics,
    pendingConflictCount: context.pendingConflictCount,
    sessionStatus: context.sessionStatus,
    invalidReason: context.invalidReason,
  };
}

export function buildError(code, context = {}, cause) {
  const definition = ERROR_DEFINITIONS[code];
  if (!definition) {
    throw new Error(`Unsupported merge engine error code: ${code}`);
  }

  const supportReference = buildSupportReference(context, definition.code);

  return {
    code: definition.code,
    userTitle: definition.userTitle,
    userMessage: definition.userMessage,
    userAction: definition.userAction,
    status: definition.status,
    severity: definition.severity,
    stage: definition.stage,
    recoverable: false,
    userHint: sanitizeForUser(context.userHint),
    supportReference,
    supportContext: pickSupportContext(context),
    operationalLimits: OPERATIONAL_LIMITS,
    technicalDetails: {
      source: context.source || 'merge-engine',
      operation: context.operation,
      rawMessage: cause?.message || context.rawMessage,
      rawCode: cause?.code || context.rawCode,
      stack: cause?.stack,
      causeName: cause?.name,
      diagnostics: context.diagnostics,
    },
  };
}

function inferErrorCode(input = {}) {
  const probe = [input.rawCode, input.message, input.cause?.message, input.context?.invalidReason]
export function inferErrorCode(input = {}) {
  const probe = [input.rawCode, input.message, input.cause?.message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (probe.includes('session') || probe.includes('preview missing') || probe.includes('invalid state') || probe.includes('inconsistent')) {
    return 'INVALID_SESSION_STATE';
  }
  if (probe.includes('zip') || probe.includes('crc') || probe.includes('corrupt') || probe.includes('damaged')) {
    return 'CORRUPT_FILE';
  }
  if (probe.includes('unsupported') || probe.includes('xlsb') || probe.includes('csv')) {
    return 'UNSUPPORTED_FORMAT';
  }
  if (probe.includes('macro') || probe.includes('vba') || probe.includes('pivot') || probe.includes('embedded') || probe.includes('object') || probe.includes('format')) {
    return 'UNSUPPORTED_PILOT_FEATURES';
  }
  if (probe.includes('ambiguous') || probe.includes('rename') || probe.includes('merged cell') || probe.includes('structural')) {
    return 'AMBIGUOUS_STRUCTURAL_CHANGE';
  }
  if (probe.includes('worksheet') || probe.includes('sheet')) {
    return 'UNREADABLE_SHEET';
  }
  if (probe.includes('formula') || probe.includes('#ref!') || probe.includes('#name?')) {
    return 'UNINTERPRETABLE_FORMULAS';
  }
  if (probe.includes('limit') || probe.includes('too large') || probe.includes('max cells') || probe.includes('25 mb')) {
    return 'WORKBOOK_TOO_LARGE';
  }
  if (probe.includes('pending conflict') || probe.includes('pending decision')) {
    return 'PENDING_CONFLICTS_PENDING_EXPORT';
  }
  if (probe.includes('export') || probe.includes('critical conflict')) {
    return 'CRITICAL_CONFLICTS_PENDING_EXPORT';
  }

  return input.fallbackCode || 'CORRUPT_FILE';
}

export function normalizeEngineError(input = {}) {
  const cause = input.cause instanceof Error ? input.cause : undefined;
  const code = input.code || inferErrorCode(input);
  return buildError(code, input.context, cause);
}

export function logEngineError(logger, engineError) {
  const payload = {
    event: 'merge_engine_error',
    code: engineError.code,
    status: engineError.status,
    severity: engineError.severity,
    stage: engineError.stage,
    supportReference: engineError.supportReference,
    supportContext: engineError.supportContext,
    technicalDetails: engineError.technicalDetails,
  };

  if (logger && typeof logger.error === 'function') {
    logger.error(payload);
    return payload;
  }

  console.error(payload);
  return payload;
}

export {
  ERROR_DEFINITIONS,
  OPERATIONAL_LIMITS,
  buildError,
  inferErrorCode,
  normalizeEngineError,
  logEngineError,
  sanitizeForUser,
};
