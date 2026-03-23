const ERROR_DEFINITIONS = Object.freeze({
  CORRUPT_FILE: {
    code: 'CORRUPT_FILE',
    userTitle: 'No pudimos abrir el archivo',
    userMessage:
      'Parece que el archivo está dañado, incompleto o protegido de una forma que este MVP todavía no puede procesar. Prueba con otra copia del archivo o vuelve a guardarlo antes de intentarlo de nuevo.',
    userAction:
      'Revisa si el archivo se abre correctamente en Excel y vuelve a cargarlo.',
    status: 'blocked',
    severity: 'error',
    stage: 'ingestion',
  },
  UNSUPPORTED_FORMAT: {
    code: 'UNSUPPORTED_FORMAT',
    userTitle: 'Este archivo no es compatible',
    userMessage:
      'Por ahora solo podemos trabajar con libros Excel compatibles con el MVP. Usa un archivo .xlsx o .xlsm sin características fuera del alcance actual.',
    userAction:
      'Guarda el archivo en un formato compatible e inténtalo otra vez.',
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
      'Encontramos una hoja que no se puede interpretar de forma confiable. Puedes revisar el archivo y simplificar esa hoja antes de volver a compararlo.',
    userAction:
      'Comprueba si la hoja tiene protección, referencias rotas o estructuras especiales.',
    status: 'blocked',
    severity: 'error',
    stage: 'analysis',
  },
  UNINTERPRETABLE_FORMULAS: {
    code: 'UNINTERPRETABLE_FORMULAS',
    userTitle: 'Hay fórmulas que necesitan revisión',
    userMessage:
      'Detectamos fórmulas que este MVP no puede interpretar con seguridad. Necesitamos que las revises o simplifiques antes de continuar.',
    userAction:
      'Verifica las fórmulas señaladas y vuelve a intentar la comparación.',
    status: 'needs_attention',
    severity: 'error',
    stage: 'analysis',
  },
  WORKBOOK_TOO_LARGE: {
    code: 'WORKBOOK_TOO_LARGE',
    userTitle: 'El libro es demasiado grande para este MVP',
    userMessage:
      'El archivo supera el tamaño o la complejidad que podemos procesar de forma confiable en esta versión. Divide el libro o reduce el alcance antes de volver a intentarlo.',
    userAction:
      'Reduce la cantidad de hojas o el rango utilizado y vuelve a cargar el archivo.',
    status: 'blocked',
    severity: 'error',
    stage: 'limits',
  },
  CRITICAL_CONFLICTS_PENDING_EXPORT: {
    code: 'CRITICAL_CONFLICTS_PENDING_EXPORT',
    userTitle: 'Todavía no puedes exportar',
    userMessage:
      'Aún quedan conflictos críticos por resolver. Revisa los elementos marcados y completa esas decisiones antes de exportar el resultado final.',
    userAction:
      'Abre la lista de conflictos críticos y resuélvelos antes de exportar.',
    status: 'blocked',
    severity: 'error',
    stage: 'export',
  },
});

function sanitizeForUser(value) {
  if (!value) return undefined;
  return String(value)
    .replace(/(?:[A-Z]:)?[^\s]+\.(?:js|ts|json|xml|zip|xlsx|xlsm)/gi, '[archivo interno]')
    .replace(/\b(?:TypeError|RangeError|SyntaxError|ReferenceError|OpenXml|ZipException|Stack trace)\b/gi, 'detalle interno')
    .replace(/\s+/g, ' ')
    .trim();
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
  };
}

function buildError(code, context = {}, cause) {
  const definition = ERROR_DEFINITIONS[code];
  if (!definition) {
    throw new Error(`Unsupported merge engine error code: ${code}`);
  }

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
    supportContext: pickSupportContext(context),
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
  const probe = [input.rawCode, input.message, input.cause?.message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (probe.includes('zip') || probe.includes('crc') || probe.includes('corrupt')) {
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
  if (probe.includes('limit') || probe.includes('too large') || probe.includes('max cells')) {
    return 'WORKBOOK_TOO_LARGE';
  }
  if (probe.includes('export') || probe.includes('critical conflict')) {
    return 'CRITICAL_CONFLICTS_PENDING_EXPORT';
  }

  return input.fallbackCode || 'CORRUPT_FILE';
}

function normalizeEngineError(input = {}) {
  const cause = input.cause instanceof Error ? input.cause : undefined;
  const code = input.code || inferErrorCode(input);
  return buildError(code, input.context, cause);
}

function logEngineError(logger, engineError) {
  const payload = {
    event: 'merge_engine_error',
    code: engineError.code,
    status: engineError.status,
    severity: engineError.severity,
    stage: engineError.stage,
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
  buildError,
  inferErrorCode,
  normalizeEngineError,
  logEngineError,
  sanitizeForUser,
};
