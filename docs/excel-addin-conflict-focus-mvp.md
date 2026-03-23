# Propuesta de integración MVP: sincronización entre lista de conflictos y selección de Excel

## Estado actual del repositorio

En el estado actual de este repositorio no existe la carpeta `apps/excel-addin/` ni código ejecutable del add-in de Excel. Por ese motivo no es posible implementar directamente la funcionalidad solicitada dentro del cliente Office Add-in desde este árbol de trabajo.

Como fallback útil, este documento deja definidos:

- los puntos de integración recomendados;
- los identificadores sugeridos para la implementación;
- el flujo lista → Excel;
- el flujo Excel → lista si la API disponible del host lo permite en el MVP; y
- un contrato de estado mínimo para mantener sincronizados panel lateral, detalle y selección.

## Objetivo funcional

Cuando el usuario seleccione un conflicto en la lista lateral, el add-in debe:

1. abrir o activar la hoja correspondiente;
2. seleccionar y/o resaltar la celda o rango afectado;
3. refrescar el panel de detalle con la información exacta del cambio.

Cuando el usuario cambie manualmente la selección en Excel, el add-in debería intentar:

1. detectar el nuevo rango activo;
2. localizar si pertenece a un conflicto conocido;
3. enfocar el conflicto correspondiente en la lista lateral;
4. actualizar el panel de detalle para reflejar ese conflicto.

## Puntos de integración recomendados

### 1. Estado de navegación de conflictos

Crear un estado explícito en la capa de aplicación o store del add-in.

```ts
interface ConflictFocusState {
  focusedConflictId: string | null;
  focusedWorksheetName: string | null;
  focusedAddress: string | null;
  source: "list" | "excel-selection" | "navigation" | null;
}
```

Responsabilidades:

- evitar dobles sincronizaciones recursivas;
- saber si el foco actual vino desde la lista o desde Excel;
- reutilizar el mismo estado para refrescar la vista de detalle.

### 2. Índice rápido de conflictos por hoja y rango

Construir un índice en memoria en el momento de cargar el `DiffModel` o la sesión de merge.

```ts
interface ConflictIndexEntry {
  conflictId: string;
  worksheetName: string;
  address: string;
  normalizedRangeKey: string;
  type: "cell" | "range" | "row" | "column" | "sheet";
}
```

Funciones sugeridas:

- `buildConflictIndex(conflicts)`
- `findConflictByWorksheetAndAddress(worksheetName, address)`
- `findConflictsIntersectingRange(worksheetName, address)`

Este índice debe ser consumido tanto por la lista lateral como por el listener de selección de Excel.

### 3. Servicio adaptador para Excel

Centralizar toda la integración Office.js en un adaptador con funciones nombradas de forma explícita.

Funciones sugeridas:

- `selectRangeInWorksheet(worksheetName, address)`
- `highlightConflictRange(worksheetName, address)`
- `getCurrentSelection()`
- `registerSelectionChangedHandler()`
- `unregisterSelectionChangedHandler()`

## Flujo MVP lista → Excel

### Handler principal

El punto de entrada recomendado es una acción de aplicación con nombre claro:

```ts
async function focusConflict(conflictId: string): Promise<void>
```

### Secuencia recomendada

1. Buscar el conflicto en el store.
2. Actualizar el estado `focusedConflictId`.
3. Refrescar inmediatamente el panel de detalle con los datos exactos del conflicto.
4. Llamar al adaptador Excel para activar hoja y seleccionar rango.
5. Aplicar resaltado visual adicional si el MVP lo necesita.
6. Hacer scroll/focus del item correspondiente en la lista lateral.

### Pseudocódigo

```ts
async function focusConflict(conflictId: string): Promise<void> {
  const conflict = conflictStore.getById(conflictId);
  if (!conflict) return;

  navigationStore.setFocusedConflict({
    focusedConflictId: conflict.id,
    focusedWorksheetName: conflict.worksheetName,
    focusedAddress: conflict.address,
    source: "list",
  });

  detailPanelStore.setConflictDetail(buildConflictDetailViewModel(conflict));

  await selectRangeInWorksheet(conflict.worksheetName, conflict.address);
  await highlightConflictRange(conflict.worksheetName, conflict.address);

  conflictListRef.scrollToConflict(conflict.id);
}
```

## Implementación sugerida de `selectRangeInWorksheet`

### Objetivo

Abrir la hoja correcta y llevar la selección al rango afectado.

### Pseudocódigo Office.js

```ts
async function selectRangeInWorksheet(
  worksheetName: string,
  address: string,
): Promise<void> {
  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(worksheetName);
    const range = sheet.getRange(address);

    sheet.activate();
    range.select();

    await context.sync();
  });
}
```

### Variantes útiles para el MVP

Si se desea separar navegación y selección:

- `activateWorksheet(worksheetName)`
- `selectRange(address)` sobre la hoja activa
- `selectRangeInWorksheet(worksheetName, address)` como fachada de alto nivel

## Resaltado adicional del rango afectado

Si el producto necesita una pista visual más fuerte que la selección nativa, añadir un helper opcional:

```ts
async function highlightConflictRange(
  worksheetName: string,
  address: string,
): Promise<void>
```

Opciones MVP:

- usar solo la selección nativa si se quiere minimizar complejidad;
- aplicar color temporal al relleno o borde del rango;
- si hay dos paneles virtuales base/comparado dentro del task pane, reflejar el mismo resaltado en ambas vistas.

Nota: si se modifica formato real del workbook para resaltar, debe existir una estrategia clara para restaurarlo. En un MVP suele ser más seguro apoyarse primero en la selección nativa de Excel y en el resaltado dentro del panel lateral.

## Refresco del panel de detalle

El panel de detalle no debe depender de leer otra vez Excel para renderizarse. Debe refrescarse desde el modelo de conflicto ya cargado.

Función sugerida:

```ts
function refreshConflictDetail(conflictId: string): void
```

### Contenido mínimo del detalle

- `worksheetName`
- `address`
- `changeType`
- `baseValue`
- `compareValue`
- `baseFormula`
- `compareFormula`
- `resolutionStatus`
- `suggestedResolution`
- `metadata` adicional del diff si existe

### Secuencia recomendada

`focusConflict(conflictId)` debería invocar internamente `refreshConflictDetail(conflictId)` antes de esperar la navegación en Excel, para que la UI responda rápido incluso si Office.js tarda.

## Flujo inverso Excel → lista lateral

## Viabilidad MVP

Si la API de Excel disponible en el host soporta eventos de selección, este flujo es razonable para el MVP. Debe implementarse de forma defensiva para evitar bucles entre:

- selección disparada por la lista; y
- selección disparada por el usuario en Excel.

### Punto de entrada sugerido

```ts
async function handleExcelSelectionChanged(): Promise<void>
```

### Secuencia recomendada

1. Leer hoja activa y rango seleccionado.
2. Normalizar la dirección del rango.
3. Buscar conflicto exacto o intersección de rango en el índice.
4. Si hay match, enfocar el conflicto en la lista.
5. Si no hay match, limpiar el foco o mantener el anterior según decisión de UX.

### Pseudocódigo

```ts
async function handleExcelSelectionChanged(): Promise<void> {
  const selection = await getCurrentSelection();
  if (!selection) return;

  if (navigationStore.isInternalSelectionChange()) {
    navigationStore.clearInternalSelectionFlag();
    return;
  }

  const matchedConflict = findConflictsIntersectingRange(
    selection.worksheetName,
    selection.address,
  )[0];

  if (!matchedConflict) {
    navigationStore.clearFocusedConflict();
    return;
  }

  navigationStore.setFocusedConflict({
    focusedConflictId: matchedConflict.conflictId,
    focusedWorksheetName: selection.worksheetName,
    focusedAddress: selection.address,
    source: "excel-selection",
  });

  detailPanelStore.setConflictDetail(
    buildConflictDetailViewModelFromId(matchedConflict.conflictId),
  );

  conflictListRef.scrollToConflict(matchedConflict.conflictId);
  conflictListRef.setActiveConflict(matchedConflict.conflictId);
}
```

## Lectura de selección actual

Función sugerida:

```ts
async function getCurrentSelection(): Promise<{
  worksheetName: string;
  address: string;
} | null>
```

Pseudocódigo orientativo:

```ts
async function getCurrentSelection() {
  return Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    const range = context.workbook.getSelectedRange();

    sheet.load("name");
    range.load("address");

    await context.sync();

    return {
      worksheetName: sheet.name,
      address: range.address,
    };
  });
}
```

## Registro del evento de selección

Funciones sugeridas:

- `registerSelectionChangedHandler()`
- `disposeSelectionChangedHandler()`

En la implementación real conviene:

- registrar el handler al montar el workspace de comparación;
- desregistrarlo al desmontar el task pane o cambiar de sesión;
- evitar listeners duplicados si el panel se vuelve a renderizar.

## Evitar bucles de sincronización

Este es el riesgo principal del flujo bidireccional.

### Solución mínima para el MVP

Mantener un flag transitorio:

```ts
interface NavigationRuntimeState {
  internalSelectionInFlight: boolean;
}
```

### Regla

Antes de ejecutar `selectRangeInWorksheet(...)` desde `focusConflict(...)`:

- marcar `internalSelectionInFlight = true`.

Cuando llegue el evento `handleExcelSelectionChanged()`:

- si el flag está activo, consumirlo y salir sin volver a enfocar.

Esto evita un ciclo del tipo:

1. usuario selecciona conflicto en lista;
2. add-in selecciona celda en Excel;
3. Excel dispara evento de selección;
4. add-in intenta reenfocar otra vez el mismo conflicto.

## Matching de rangos

Para un MVP, el matching puede implementarse por prioridad:

1. coincidencia exacta de hoja + dirección;
2. si no existe, intersección de la selección con un rango de conflicto;
3. si hay múltiples matches, elegir el de menor tamaño o el primero visible en la lista.

Funciones sugeridas:

- `normalizeAddress(address)`
- `rangesIntersect(a, b)`
- `pickBestConflictMatch(matches)`

## View models recomendados

### Para la lista lateral

```ts
interface ConflictListItemViewModel {
  id: string;
  worksheetName: string;
  address: string;
  title: string;
  subtitle: string;
  status: "pending" | "resolved" | "auto";
  isFocused: boolean;
}
```

### Para el detalle

```ts
interface ConflictDetailViewModel {
  id: string;
  worksheetName: string;
  address: string;
  changeType: string;
  baseDisplayValue: string;
  compareDisplayValue: string;
  resolutionStatus: string;
  explanation: string;
}
```

## Ubicaciones recomendadas si el add-in existiera en `apps/excel-addin/`

Estructura orientativa:

```text
apps/excel-addin/
  src/
    application/
      focusConflict.ts
      refreshConflictDetail.ts
      handleExcelSelectionChanged.ts
    adapters/excel/
      selectRangeInWorksheet.ts
      getCurrentSelection.ts
      registerSelectionChangedHandler.ts
    domain/conflicts/
      buildConflictIndex.ts
      findConflictsIntersectingRange.ts
    state/
      navigationStore.ts
      conflictStore.ts
      detailPanelStore.ts
    ui/
      ConflictList.tsx
      ConflictDetailPanel.tsx
```

## Criterios de aceptación MVP

### Lista → Excel

- al hacer clic en un conflicto, se activa la hoja correcta;
- la celda o rango afectado queda seleccionado;
- el ítem de la lista queda marcado como activo;
- el panel de detalle muestra los datos exactos del conflicto sin lag perceptible.

### Excel → lista

- si el usuario selecciona una celda que pertenece a un conflicto, la lista lateral enfoca ese conflicto;
- el panel de detalle se actualiza al conflicto detectado;
- no se generan bucles visibles de selección;
- si la celda no pertenece a ningún conflicto, el comportamiento es consistente y explícito.

## Recomendación final

Cuando el código del add-in esté disponible, la implementación debería empezar por estos tres puntos en este orden:

1. `focusConflict(conflictId)` como orquestador de lista → detalle → Excel;
2. `selectRangeInWorksheet(worksheetName, address)` como adaptador Office.js encapsulado;
3. `handleExcelSelectionChanged()` con índice de conflictos e inmunidad a bucles.

Ese orden permite entregar primero el flujo principal de navegación guiada y dejar el flujo inverso como mejora incremental si el host de Excel confirma el soporte de eventos necesario en el MVP.
