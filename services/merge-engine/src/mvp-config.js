export const OFFICIAL_MVP_FLOW = Object.freeze([
  'select_workbooks',
  'normalize_workbooks',
  'create_merge_session',
  'persist_checkpoint',
  'resolve_conflicts',
  'validate_final_state',
  'export_result_workbook',
]);

export const OFFICIAL_MVP_FLOW_LABELS = Object.freeze({
  select_workbooks: 'Seleccionar workbook base y comparado',
  normalize_workbooks: 'Normalizar ambos workbooks',
  create_merge_session: 'Crear merge session',
  persist_checkpoint: 'Persistir checkpoint',
  resolve_conflicts: 'Resolver conflictos',
  validate_final_state: 'Validar estado final',
  export_result_workbook: 'Exportar workbook resultante',
});

export const PILOT_SUPPORTED_SCOPE = Object.freeze([
  'Cambios de valor en una celda con mapeo claro por coordenadas.',
  'Fórmulas simples en una sola celda.',
  'Hojas agregadas o eliminadas cuando la identidad es inequívoca.',
  'Aceptar izquierda, aceptar derecha y edición manual básica por celda.',
]);

export const PILOT_OUT_OF_SCOPE = Object.freeze([
  'Macros y código VBA.',
  'Tablas dinámicas complejas.',
  'Objetos embebidos o flotantes como gráficos, imágenes o controles.',
  'Formatos avanzados cuyo merge requiera semántica propia de Excel.',
  'Cambios estructurales ambiguos: renombrados dudosos, celdas combinadas o desplazamientos complejos.',
  'Comparación de más de dos versiones simultáneamente.',
  'Colaboración multiusuario en tiempo real y reglas avanzadas por dominio.',
]);

export const OPERATIONAL_LIMITS = Object.freeze({
  standard: {
    maxFileSizeMb: 25,
    maxSheets: 25,
    maxUsedCells: 200000,
    maxConcurrentOperationsPerUser: 1,
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

export function buildVisibleMvpLimits() {
  return {
    officialFlow: OFFICIAL_MVP_FLOW.map((step) => ({ step, label: OFFICIAL_MVP_FLOW_LABELS[step] })),
    supportedScope: [...PILOT_SUPPORTED_SCOPE],
    outOfScope: [...PILOT_OUT_OF_SCOPE],
    operationalLimits: OPERATIONAL_LIMITS,
  };
}
