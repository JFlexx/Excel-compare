const SESSION_KEYS = [
  'excelCompare.mergeSession',
  'excelCompare.session',
  'mergeSession',
  'session',
];

const SESSION_URL_KEYS = ['excelCompare.sessionUrl', 'excelCompare.mergeSessionUrl'];

export async function waitForOfficeHost() {
  if (!globalThis.Office) {
    throw new Error('Office.js no está disponible en este host.');
  }

  return new Promise((resolve, reject) => {
    try {
      Office.onReady((info) => {
        if (info?.host && info.host !== Office.HostType.Excel) {
          reject(new Error(`Este panel requiere Excel y se abrió en ${info.host}.`));
          return;
        }

        resolve(info);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function readActiveWorkbook() {
  assertExcelRuntime();

  return Excel.run(async (context) => {
    const workbook = context.workbook;
    const worksheets = workbook.worksheets;
    const activeWorksheet = worksheets.getActiveWorksheet();
    const selectedRange = workbook.getSelectedRange();

    worksheets.load('items/name');
    activeWorksheet.load('name');
    selectedRange.load('address,rowCount,columnCount');
    await context.sync();

    return {
      name: resolveWorkbookName(),
      worksheetNames: worksheets.items.map((sheet) => sheet.name),
      activeWorksheetName: activeWorksheet.name,
      selectionAddress: stripSheetPrefix(selectedRange.address),
      selection: {
        address: stripSheetPrefix(selectedRange.address),
        rowCount: selectedRange.rowCount,
        columnCount: selectedRange.columnCount,
      },
    };
  });
}

export async function getRelevantWorkbookRanges(conflicts = []) {
  assertExcelRuntime();

  return Excel.run(async (context) => {
    const worksheets = context.workbook.worksheets;
    worksheets.load('items/name');
    await context.sync();

    const availableSheets = new Set(worksheets.items.map((sheet) => sheet.name));

    return conflicts.map((conflict) => ({
      conflictId: conflict.id,
      supported: availableSheets.has(conflict.worksheetName),
      worksheetName: availableSheets.has(conflict.worksheetName) ? conflict.worksheetName : null,
      address: availableSheets.has(conflict.worksheetName) ? conflict.address : null,
    }));
  });
}

export async function selectConflictInWorkbook(conflict, options = {}) {
  assertExcelRuntime();

  return Excel.run(async (context) => {
    const worksheet = context.workbook.worksheets.getItem(conflict.worksheetName);
    const range = worksheet.getRange(conflict.address);

    worksheet.activate();

    if (typeof range.select === 'function') {
      range.select();
    } else if (!options.silent) {
      throw new Error('La API de selección no está disponible en este host de Excel.');
    }

    if (options.highlight !== false) {
      safelyApplyHighlight(range);
    }

    await context.sync();

    return {
      worksheetName: conflict.worksheetName,
      address: conflict.address,
    };
  });
}

export async function getCurrentSelection() {
  assertExcelRuntime();

  return Excel.run(async (context) => {
    const worksheet = context.workbook.worksheets.getActiveWorksheet();
    const range = context.workbook.getSelectedRange();

    worksheet.load('name');
    range.load('address');
    await context.sync();

    return {
      worksheetName: worksheet.name,
      address: stripSheetPrefix(range.address),
    };
  });
}

export async function applyConflictToWorkbook(conflict, resolutionSide) {
  assertExcelRuntime();

  const source = resolutionSide === 'left' ? conflict.leftSource : conflict.rightSource;
  if (!source) {
    throw new Error('El conflicto no contiene datos suficientes para aplicar la resolución.');
  }

  return Excel.run(async (context) => {
    const worksheet = context.workbook.worksheets.getItem(conflict.worksheetName);
    const range = worksheet.getRange(conflict.address);

    worksheet.activate();

    if (source.exists === false) {
      range.clear();
    } else if (source.formula) {
      range.formulas = [[String(source.formula)]];
    } else {
      range.values = [[source.value ?? source.displayValue ?? '']];
    }

    safelyApplyHighlight(range, resolutionSide === 'left' ? '#dff6dd' : '#dceeff');

    await context.sync();

    return {
      worksheetName: conflict.worksheetName,
      address: conflict.address,
      appliedFrom: resolutionSide,
    };
  });
}

export async function registerSelectionChangedHandler(handler) {
  assertExcelRuntime();

  try {
    return Excel.run(async (context) => {
      const workbook = context.workbook;
      const worksheet = workbook.worksheets.getActiveWorksheet();
      const eventSource = workbook.onSelectionChanged && typeof workbook.onSelectionChanged.add === 'function'
        ? workbook.onSelectionChanged
        : worksheet.onSelectionChanged;

      if (!eventSource || typeof eventSource.add !== 'function') {
        return { supported: false, dispose: async () => {} };
      }

      const registration = eventSource.add(handler);
      await context.sync();

      return {
        supported: true,
        dispose: async () => {
          try {
            registration.remove();
          } catch {
            // noop defensivo
          }
        },
      };
    });
  } catch (error) {
    return {
      supported: false,
      error,
      dispose: async () => {},
    };
  }
}

export async function loadSessionFromHost() {
  await waitForOfficeHost();

  const workbook = await readActiveWorkbook();
  const sessionUrl = readStoredString(SESSION_URL_KEYS) ?? readSessionUrlFromLocation();

  if (sessionUrl) {
    const response = await fetch(sessionUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`No se pudo descargar la sesión remota (${response.status}).`);
    }

    return {
      workbook,
      payload: await response.json(),
      source: `remote:${sessionUrl}`,
    };
  }

  const inlineSession = readStoredJson(SESSION_KEYS);
  if (inlineSession) {
    return {
      workbook,
      payload: inlineSession,
      source: 'office-settings',
    };
  }

  throw new Error(
    'No se encontró una merge session en el host. Guarda JSON en Office.settings con la clave excelCompare.mergeSession o configura excelCompare.sessionUrl.',
  );
}

export async function persistSessionToHost(session) {
  if (!globalThis.Office?.context?.document?.settings) {
    return false;
  }

  try {
    Office.context.document.settings.set(SESSION_KEYS[0], JSON.stringify(session));
    await saveOfficeSettings();
    return true;
  } catch {
    return false;
  }
}

function readStoredJson(keys) {
  const settings = globalThis.Office?.context?.document?.settings;
  for (const key of keys) {
    const raw = settings?.get?.(key) ?? globalThis.localStorage?.getItem?.(key) ?? null;
    if (!raw) {
      continue;
    }

    if (typeof raw === 'object') {
      return raw;
    }

    try {
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }

  return null;
}

function readStoredString(keys) {
  const settings = globalThis.Office?.context?.document?.settings;
  for (const key of keys) {
    const value = settings?.get?.(key) ?? globalThis.localStorage?.getItem?.(key) ?? null;
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readSessionUrlFromLocation() {
  try {
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    return params.get('sessionUrl');
  } catch {
    return null;
  }
}

function resolveWorkbookName() {
  const url = globalThis.Office?.context?.document?.url ?? '';
  if (!url) {
    return 'Workbook activo';
  }

  try {
    return decodeURIComponent(url.split('/').pop() || 'Workbook activo');
  } catch {
    return 'Workbook activo';
  }
}

function stripSheetPrefix(address) {
  return String(address ?? '').split('!').pop() ?? '';
}

function safelyApplyHighlight(range, color = '#fff4ce') {
  if (range?.format?.fill) {
    range.format.fill.color = color;
  }
}

function assertExcelRuntime() {
  if (!globalThis.Excel || typeof globalThis.Excel.run !== 'function') {
    throw new Error('La API de Excel no está disponible en este host.');
  }
}

function saveOfficeSettings() {
  return new Promise((resolve, reject) => {
    Office.context.document.settings.saveAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(result);
        return;
      }

      reject(result.error ?? new Error('No se pudieron guardar los settings del documento.'));
    });
  });
}
