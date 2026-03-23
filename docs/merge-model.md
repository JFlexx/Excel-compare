# Merge session data model

Este documento propone un esquema de datos para representar una sesión de comparación y conciliación entre dos workbooks (`sourceA` y `sourceB`). El modelo está pensado para:

- detectar diferencias estructurales y de contenido,
- registrar conflictos y decisiones del usuario,
- preservar identificadores estables para reabrir la sesión,
- producir un resultado final de merge reproducible.

## Objetivos del modelo

1. **Identificadores estables** para workbook, hoja, celda, conflicto y decisión.
2. **Ubicación explícita** en hoja, fila, columna y dirección A1.
3. **Comparación simétrica** entre `sourceA` y `sourceB`.
4. **Separación entre diff, conflicto, decisión y resultado final**.
5. **Serialización sencilla** en JSON para persistencia, auditoría y APIs.

## Convenciones generales

### Raíz de la sesión

Se recomienda encapsular todo en un documento `mergeSession` con metadatos básicos:

```json
{
  "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
  "createdAt": "2026-03-23T10:30:00Z",
  "sourceA": {
    "workbookId": "wb_a_budget-fp-91f2",
    "label": "budget.base.xlsx",
    "path": "/files/budget.base.xlsx"
  },
  "sourceB": {
    "workbookId": "wb_b_budget-fp-82af",
    "label": "budget.review.xlsx",
    "path": "/files/budget.review.xlsx"
  }
}
```

### Identificadores estables

Los identificadores deben derivarse de datos que no cambien entre cargas triviales:

- `WorkbookDiff.id`: hash de `sourceA.workbookId + sourceB.workbookId`.
- `WorksheetDiff.id`: `wsd:<sheetKey>` donde `sheetKey` combina nombre canónico de hoja y posición conocida.
- `CellDiff.id`: `cell:<sheetKey>:<A1>`.
- `Conflict.id`: `conflict:<scopeType>:<sheetKey>:<rangeA1>`.
- `MergeDecision.id`: `decision:<conflictId>`.
- `MergeResult.id`: hash de `sessionId + selectedDecisions`.

### Ubicación normalizada

Usar siempre una estructura homogénea:

```json
{
  "worksheetName": "Summary",
  "sheetIndex": 0,
  "row": 4,
  "column": 2,
  "a1": "B4",
  "rangeA1": "B4:B6"
}
```

Notas:

- `row` y `column` usan índices base 1.
- `a1` se usa para celdas unitarias.
- `rangeA1` se usa cuando el nodo representa una región.
- Para cambios a nivel hoja, `row`, `column` y `a1` pueden ser `null`.

### Tipo de cambio

Se recomienda un enum compartido:

- `unchanged`
- `added`
- `removed`
- `modified`
- `moved`
- `formula_changed`
- `format_changed`
- `conflict`

### Valores comparados

Cada nodo relevante puede transportar ambos lados:

```json
{
  "sourceA": {
    "value": 1200,
    "displayValue": "1200",
    "formula": null,
    "type": "number",
    "exists": true
  },
  "sourceB": {
    "value": 1350,
    "displayValue": "1350",
    "formula": null,
    "type": "number",
    "exists": true
  }
}
```

### Decisión del usuario y estado final

Todos los nodos pueden exponer estos campos, aunque en algunos casos se rellenen por herencia desde un conflicto padre:

- `userDecision`: `take_a`, `take_b`, `take_both`, `manual_edit`, `skip`, `unresolved`.
- `finalState`: `pending`, `accepted_a`, `accepted_b`, `merged`, `discarded`, `unresolved`.
- `manualEdit`: objeto opcional con `rawValue`, `value`, `displayValue` y `type` cuando la decisión final sea `manual_edit`.
- `resultPreview`: instantánea serializable del valor final por celda para que UI y motor compartan la misma vista previa del resultado.

### Historial mínimo enlazado a la decisión

Para soporte interno y revisión posterior, cada `MergeDecision` debe incluir un historial corto de acciones (`history`) en vez de persistir eventos huérfanos en otra colección. Cada entrada representa una acción observable sobre el conflicto o nodo afectado y debe conservar, como mínimo:

- `conflictId`: conflicto afectado o `targetId` si la decisión apunta directo a una celda/hoja.
- `decision`: decisión tomada en ese paso.
- `finalValue`: valor final seleccionado o editado. Puede ser escalar o un objeto con `value`, `displayValue`, `formula` y `type`.
- `occurredAt`: fecha y hora en ISO-8601.
- `sessionId`: identificador de sesión.
- `actor`: objeto opcional con `userId`, `displayName` y `origin` cuando el entorno ya permite conocer al usuario.

Este historial se considera parte del contexto de `MergeDecision`: sirve para reconstruir cómo se resolvió un conflicto, generar resúmenes técnicos y emitir exportaciones sencillas sin perder la relación entre conflicto, decisión y resultado.

---

## 1. WorkbookDiff

Representa el diff global entre ambos workbooks.

### Campos sugeridos

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | Identificador estable del diff de workbooks. |
| `nodeType` | string | Valor fijo: `WorkbookDiff`. |
| `sourceAWorkbookId` | string | ID estable del workbook origen A. |
| `sourceBWorkbookId` | string | ID estable del workbook origen B. |
| `location` | object | Ubicación lógica del workbook; normalmente sin coordenadas. |
| `changeType` | string | Cambio agregado a nivel workbook. |
| `sourceA` | object | Metadatos y existencia del workbook A. |
| `sourceB` | object | Metadatos y existencia del workbook B. |
| `userDecision` | string | Decisión aplicada al conjunto, si existe. |
| `finalState` | string | Estado agregado de la sesión. |
| `worksheetDiffs` | array | Lista de `WorksheetDiff`. |
| `conflicts` | array | Lista de conflictos transversales o agregados. |
| `summary` | object | Conteos de hojas, celdas y conflictos. |

### Ejemplo mínimo

```json
{
  "id": "wbd:wb_a_budget-fp-91f2:wb_b_budget-fp-82af",
  "nodeType": "WorkbookDiff",
  "sourceAWorkbookId": "wb_a_budget-fp-91f2",
  "sourceBWorkbookId": "wb_b_budget-fp-82af",
  "location": {
    "worksheetName": null,
    "sheetIndex": null,
    "row": null,
    "column": null,
    "a1": null,
    "rangeA1": null
  },
  "changeType": "modified",
  "sourceA": {
    "label": "budget.base.xlsx",
    "path": "/files/budget.base.xlsx",
    "exists": true
  },
  "sourceB": {
    "label": "budget.review.xlsx",
    "path": "/files/budget.review.xlsx",
    "exists": true
  },
  "userDecision": "unresolved",
  "finalState": "pending"
}
```

---

## 2. WorksheetDiff

Representa el diff de una hoja concreta.

### Campos sugeridos

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | ID estable de hoja. |
| `nodeType` | string | Valor fijo: `WorksheetDiff`. |
| `worksheetId` | string | Identificador lógico de la hoja. |
| `location` | object | Hoja y posición; para hoja completa, sin celda. |
| `changeType` | string | `added`, `removed`, `modified`, etc. |
| `sourceA` | object | Estado de la hoja en A. |
| `sourceB` | object | Estado de la hoja en B. |
| `userDecision` | string | Decisión del usuario para la hoja. |
| `finalState` | string | Estado final de la hoja. |
| `cellDiffs` | array | Lista de `CellDiff`. |
| `conflicts` | array | Conflictos en la hoja. |
| `summary` | object | Conteos visibles por hoja, por ejemplo total y pendientes. |

### Ejemplo mínimo

```json
{
  "id": "wsd:summary:0",
  "nodeType": "WorksheetDiff",
  "worksheetId": "ws:summary:0",
  "location": {
    "worksheetName": "Summary",
    "sheetIndex": 0,
    "row": null,
    "column": null,
    "a1": null,
    "rangeA1": "Summary!A1:XFD1048576"
  },
  "changeType": "modified",
  "sourceA": {
    "name": "Summary",
    "exists": true
  },
  "sourceB": {
    "name": "Summary",
    "exists": true
  },
  "userDecision": "unresolved",
  "finalState": "pending",
  "summary": {
    "totalConflictCount": 21,
    "pendingConflictCount": 3
  }
}
```

### Requisitos funcionales derivados para la UI de conflictos

- Cada `Conflict` debe incluir metadatos suficientes para filtrar por `worksheetName`, `changeType` y `finalState`.
- Los conteos agregados deben exponer al menos `totalConflictCount` y `pendingConflictCount` tanto a nivel workbook como por hoja cuando sea posible.
- Las acciones masivas deben poder describir su alcance en términos de `conflictIds`, rango afectado y hoja activa.
- Cuando una acción afecte a múltiples conflictos/celdas, el payload de confirmación debe poder informar `affectedCellCount` o `affectedConflictCount`.

---

## 3. CellDiff

Representa la diferencia de una celda individual.

### Campos sugeridos

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | ID estable de celda. |
| `nodeType` | string | Valor fijo: `CellDiff`. |
| `worksheetId` | string | Referencia a la hoja contenedora. |
| `location` | object | Hoja, fila, columna y A1. |
| `changeType` | string | Cambio detectado para la celda. |
| `sourceA` | object | Valor/formula/tipo en A. |
| `sourceB` | object | Valor/formula/tipo en B. |
| `userDecision` | string | Decisión para la celda o heredada. |
| `finalState` | string | Estado final resuelto. |
| `conflictIds` | array | Lista de conflictos que incluyen la celda. |

### Ejemplo mínimo

```json
{
  "id": "cell:summary:0:B4",
  "nodeType": "CellDiff",
  "worksheetId": "ws:summary:0",
  "location": {
    "worksheetName": "Summary",
    "sheetIndex": 0,
    "row": 4,
    "column": 2,
    "a1": "B4",
    "rangeA1": "B4"
  },
  "changeType": "modified",
  "sourceA": {
    "value": 1200,
    "displayValue": "1200",
    "formula": null,
    "type": "number",
    "exists": true
  },
  "sourceB": {
    "value": 1350,
    "displayValue": "1350",
    "formula": null,
    "type": "number",
    "exists": true
  },
  "userDecision": "take_b",
  "finalState": "accepted_b",
  "conflictIds": []
}
```

---

## 4. Conflict

Agrupa diferencias que requieren intervención humana. Puede referirse a una celda, rango, hoja o incluso múltiples hojas.

### Campos sugeridos

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | ID estable del conflicto. |
| `nodeType` | string | Valor fijo: `Conflict`. |
| `scopeType` | string | `cell`, `range`, `worksheet`, `workbook`. |
| `location` | object | Ubicación puntual o rango. |
| `changeType` | string | Normalmente `conflict`. |
| `sourceA` | object | Resumen del lado A. |
| `sourceB` | object | Resumen del lado B. |
| `reason` | string | Motivo del conflicto. |
| `cellRefs` | array | IDs de `CellDiff` afectados. |
| `userDecision` | string | Resolución del usuario. |
| `finalState` | string | Estado final del conflicto. |

### Ejemplo mínimo

```json
{
  "id": "conflict:range:summary:0:B4:B6",
  "nodeType": "Conflict",
  "scopeType": "range",
  "location": {
    "worksheetName": "Summary",
    "sheetIndex": 0,
    "row": 4,
    "column": 2,
    "a1": "B4",
    "rangeA1": "B4:B6"
  },
  "changeType": "conflict",
  "sourceA": {
    "value": "Quarterly plan v1",
    "exists": true
  },
  "sourceB": {
    "value": "Quarterly plan v2",
    "exists": true
  },
  "reason": "Multiple dependent cells changed in the same range.",
  "cellRefs": [
    "cell:summary:0:B4",
    "cell:summary:0:B5",
    "cell:summary:0:B6"
  ],
  "userDecision": "manual_edit",
  "finalState": "merged"
}
```

---

## 5. MergeDecision

Registra explícitamente la decisión tomada por el usuario o por una regla automática.

### Campos sugeridos

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | ID estable de la decisión. |
| `nodeType` | string | Valor fijo: `MergeDecision`. |
| `targetType` | string | `workbook`, `worksheet`, `cell`, `conflict`. |
| `targetId` | string | Nodo afectado. |
| `location` | object | Ubicación del objetivo. |
| `changeType` | string | Tipo de cambio del nodo afectado. |
| `sourceA` | object | Snapshot relevante de A. |
| `sourceB` | object | Snapshot relevante de B. |
| `userDecision` | string | Decisión tomada. |
| `finalState` | string | Resultado esperado tras aplicar la decisión. |
| `decidedBy` | string | Usuario o proceso. |
| `decidedAt` | string | Fecha ISO-8601. |
| `note` | string | Comentario opcional. |
| `history` | array | Historial mínimo de acciones enlazado a esta decisión. |

### Ejemplo mínimo

```json
{
  "id": "decision:conflict:range:summary:0:B4:B6",
  "nodeType": "MergeDecision",
  "targetType": "conflict",
  "targetId": "conflict:range:summary:0:B4:B6",
  "location": {
    "worksheetName": "Summary",
    "sheetIndex": 0,
    "row": 4,
    "column": 2,
    "a1": "B4",
    "rangeA1": "B4:B6"
  },
  "changeType": "conflict",
  "sourceA": {
    "value": "Quarterly plan v1",
    "exists": true
  },
  "sourceB": {
    "value": "Quarterly plan v2",
    "exists": true
  },
  "userDecision": "manual_edit",
  "finalState": "merged",
  "decidedBy": "user:ana",
  "decidedAt": "2026-03-23T11:02:00Z",
  "note": "Keep B values but preserve A total in B6.",
  "history": [
    {
      "actionType": "selected_source",
      "conflictId": "conflict:range:summary:0:B4:B6",
      "decision": "take_b",
      "finalValue": {
        "value": "Quarterly plan v2",
        "displayValue": "Quarterly plan v2",
        "formula": null,
        "type": "string"
      },
      "occurredAt": "2026-03-23T11:01:10Z",
      "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
      "actor": {
        "userId": "user:ana",
        "displayName": "Ana",
        "origin": "office-addin"
      }
    },
    {
      "actionType": "manual_edit",
      "conflictId": "conflict:range:summary:0:B4:B6",
      "decision": "manual_edit",
      "finalValue": {
        "value": "Quarterly plan v2 + A total",
        "displayValue": "Quarterly plan v2 + A total",
        "formula": null,
        "type": "string"
      },
      "occurredAt": "2026-03-23T11:02:00Z",
      "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
      "actor": {
        "userId": "user:ana",
        "displayName": "Ana",
        "origin": "office-addin"
      }
    }
  ]
}
```

### Resumen técnico y export simple para soporte

El historial no necesita duplicarse en una tabla independiente. En su lugar, el sistema puede derivar dos vistas ligeras desde `MergeDecision.history`:

1. `technicalSummary`: resumen JSON para inspección rápida en UI interna o adjunto de soporte.
2. `supportExport`: colección plana (`jsonl`, `csv` o `ndjson`) generada a partir de cada entrada de `history`, preservando `decisionId`, `targetId` y `conflictId`.

Ejemplo de `technicalSummary` derivado:

```json
{
  "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
  "generatedAt": "2026-03-23T11:05:00Z",
  "decisionCount": 1,
  "historyEntryCount": 2,
  "conflicts": [
    {
      "decisionId": "decision:conflict:range:summary:0:B4:B6",
      "conflictId": "conflict:range:summary:0:B4:B6",
      "lastDecision": "manual_edit",
      "lastOccurredAt": "2026-03-23T11:02:00Z",
      "lastActor": "user:ana",
      "lastFinalValue": "Quarterly plan v2 + A total"
    }
  ]
}
```

Ejemplo de `supportExport` plano en JSON Lines:

```json
{"sessionId":"ms_2026-03-23T10-30-00Z_budget-v1","decisionId":"decision:conflict:range:summary:0:B4:B6","targetId":"conflict:range:summary:0:B4:B6","conflictId":"conflict:range:summary:0:B4:B6","decision":"take_b","finalValue":"Quarterly plan v2","occurredAt":"2026-03-23T11:01:10Z","userId":"user:ana"}
{"sessionId":"ms_2026-03-23T10-30-00Z_budget-v1","decisionId":"decision:conflict:range:summary:0:B4:B6","targetId":"conflict:range:summary:0:B4:B6","conflictId":"conflict:range:summary:0:B4:B6","decision":"manual_edit","finalValue":"Quarterly plan v2 + A total","occurredAt":"2026-03-23T11:02:00Z","userId":"user:ana"}
```

---

## 6. MergeResult

Representa el estado materializado tras aplicar todas las decisiones.

### Campos sugeridos

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | ID estable del resultado. |
| `nodeType` | string | Valor fijo: `MergeResult`. |
| `workbookDiffId` | string | Referencia al `WorkbookDiff`. |
| `location` | object | Ámbito workbook. |
| `changeType` | string | Normalmente `modified` o `unchanged`. |
| `sourceA` | object | Metadatos del origen A. |
| `sourceB` | object | Metadatos del origen B. |
| `userDecision` | string | Decisión agregada final. |
| `finalState` | string | `merged`, `unresolved`, etc. |
| `appliedDecisionIds` | array | Decisiones aplicadas. |
| `exportValidation` | object | Resultado de la validación final antes de generar el workbook. |
| `output` | object | Ruta del workbook resultante y resumen. |
| `technicalSummary` | object | Vista derivada para soporte interno a partir de `MergeDecision.history`. |
| `supportExport` | object | Artefacto exportable sencillo generado desde `MergeDecision.history`. |

### Validación final y salida exportable

Antes de crear el archivo `.xlsx`, el sistema debe materializar una validación final explícita. Esta validación bloquea la exportación si:

- existen conflictos con `finalState = unresolved` o `pending`,
- hay decisiones manuales sin valor/fórmula final persistida,
- la sesión referencia hojas u operaciones que ya no son compatibles con el workbook activo.

Se recomienda modelar esta fase con dos estructuras:

```json
{
  "exportValidation": {
    "readyToExport": true,
    "pendingConflictCount": 0,
    "manualEditsWithoutValueCount": 0,
    "structuralErrors": [],
    "validatedAt": "2026-03-23T10:45:00Z"
  },
  "output": {
    "suggestedFileName": "budget.base__merge__2026-03-23_10-45.xlsx",
    "exportSummary": {}
  }
}
```

`output.exportSummary` debe servir tanto para la UI como para auditoría interna.

### Estructura recomendada para `exportSummary`

| Campo | Tipo | Descripción |
|---|---|---|
| `affectedSheets` | array | Nombres de hojas incluidas o modificadas en el resultado. |
| `resolvedConflictCount` | number | Conflictos resueltos en la sesión. |
| `acceptedFromA` | number | Decisiones finales que tomaron el lado A/base. |
| `acceptedFromB` | number | Decisiones finales que tomaron el lado B/comparado. |
| `manualEditCount` | number | Conflictos o celdas resueltos con edición manual. |
| `autoResolvedCount` | number | Cambios resueltos automáticamente por regla. |
| `decisionsByType` | array | Conteo por tipo de decisión. |
| `visibleSummaryLines` | array | Líneas listas para mostrar o copiar en pantalla. |
| `auditExport` | object | Payload resumido para persistencia o descarga posterior. |

### Ejemplo mínimo

```json
{
  "id": "merge-result:ms_2026-03-23T10-30-00Z_budget-v1:001",
  "nodeType": "MergeResult",
  "workbookDiffId": "wbd:wb_a_budget-fp-91f2:wb_b_budget-fp-82af",
  "location": {
    "worksheetName": null,
    "sheetIndex": null,
    "row": null,
    "column": null,
    "a1": null,
    "rangeA1": null
  },
  "changeType": "modified",
  "sourceA": {
    "workbookId": "wb_a_budget-fp-91f2",
    "exists": true
  },
  "sourceB": {
    "workbookId": "wb_b_budget-fp-82af",
    "exists": true
  },
  "userDecision": "take_both",
  "finalState": "merged",
  "appliedDecisionIds": [
    "decision:cell:summary:0:B4",
    "decision:conflict:range:summary:0:B4:B6"
  ],
  "exportValidation": {
    "readyToExport": true,
    "pendingConflictCount": 0,
    "manualEditsWithoutValueCount": 0,
    "structuralErrors": [],
    "validatedAt": "2026-03-23T10:45:00Z"
  },
  "output": {
    "workbookId": "wb_merged_budget-fp-1aa1",
    "path": "/files/budget.merged.xlsx",
    "suggestedFileName": "budget.base__merge__2026-03-23_10-45.xlsx",
    "resolvedConflictCount": 2,
    "unresolvedConflictCount": 0
  },
  "technicalSummary": {
    "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
    "generatedAt": "2026-03-23T11:05:00Z",
    "decisionCount": 2,
    "historyEntryCount": 3
  },
  "supportExport": {
    "format": "jsonl",
    "path": "/files/support/ms_2026-03-23T10-30-00Z_budget-v1.history.jsonl",
    "generatedFrom": "mergeDecisions[*].history"
    "unresolvedConflictCount": 0,
    "exportSummary": {
      "affectedSheets": [
        "Summary",
        "Forecast"
      ],
      "resolvedConflictCount": 2,
      "acceptedFromA": 1,
      "acceptedFromB": 4,
      "manualEditCount": 1,
      "autoResolvedCount": 2,
      "decisionsByType": [
        {
          "decisionType": "take_a",
          "count": 1
        },
        {
          "decisionType": "take_b",
          "count": 4
        },
        {
          "decisionType": "manual_edit",
          "count": 1
        },
        {
          "decisionType": "auto_resolved",
          "count": 2
        }
      ],
      "visibleSummaryLines": [
        "Cambios aceptados de archivo base: 1",
        "Cambios aceptados de archivo comparado: 4",
        "Ediciones manuales: 1",
        "Conflictos resueltos: 2"
      ],
      "auditExport": {
        "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
        "affectedSheets": [
          "Summary",
          "Forecast"
        ],
        "resolvedConflictCount": 2,
        "decisionsByType": [
          {
            "decisionType": "take_a",
            "count": 1
          },
          {
            "decisionType": "take_b",
            "count": 4
          },
          {
            "decisionType": "manual_edit",
            "count": 1
          },
          {
            "decisionType": "auto_resolved",
            "count": 2
          }
        ]
      }
    }
  }
}
```

---

## Relación entre nodos

```text
WorkbookDiff
└── WorksheetDiff[]
    ├── CellDiff[]
    └── Conflict[]

Conflict[] -> MergeDecision[]
WorkbookDiff + MergeDecision[] -> MergeResult
```

## Recomendaciones de implementación

- Mantener `sourceA` y `sourceB` incluso después del merge para auditoría.
- No sobrescribir `CellDiff` originales; registrar la resolución en `MergeDecision` y `MergeResult`.
- Registrar el historial mínimo dentro de `MergeDecision.history`; evitar una bitácora separada sin referencia directa al conflicto o nodo resuelto.
- Derivar `technicalSummary` y `supportExport` desde `mergeDecisions[*].history` para no duplicar lógica de auditoría.
- Permitir que `Conflict` apunte a múltiples `CellDiff` para soportar rangos, fórmulas dependientes o bloques pegados.
- Si una hoja fue añadida o eliminada, marcar `sourceA.exists` o `sourceB.exists` como `false`.
- Guardar `displayValue` además de `value` para evitar ambigüedades con fechas, porcentajes y formatos localizados.
- Para fórmulas, almacenar tanto la fórmula como, si aplica, el valor calculado visible.

## Ejemplos JSON incluidos

El archivo `schemas/merge-session.example.json` incluye ejemplos pequeños de:

1. cambio simple de valor,
2. fórmula distinta entre ambos archivos,
3. hoja añadida y hoja eliminada,
4. conflicto múltiple en un rango.
