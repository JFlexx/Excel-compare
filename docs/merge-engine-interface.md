# Interfaz propuesta entre `apps/excel-addin/` y `services/merge-engine/`

## Objetivo

Definir un contrato claro entre el add-in de Excel y el servicio de diff/merge para cubrir el flujo completo de una sesión de comparación:

1. iniciar una `mergeSession`,
2. subir o referenciar `sourceA` y `sourceB`,
3. obtener el `workbookDiff` estructurado,
4. guardar `mergeDecisions`,
5. solicitar una vista previa del `mergeResult`,
6. exportar el workbook final.

La interfaz reutiliza de forma explícita el **modelo canónico** ya definido en `docs/merge-model.md` para evitar traducciones innecesarias entre cliente y servicio. En particular, los nombres `mergeSession`, `sourceA`, `sourceB`, `workbookDiff`, `mergeDecisions` y `mergeResult` se mantienen sin alias. 

## Convenciones del contrato

### Reglas de nomenclatura

| Concepto funcional | Nombre de contrato | Observación |
|---|---|---|
| Sesión de comparación | `mergeSession` | No usar `comparisonSession` ni `diffSession`. |
| Workbook izquierdo/base | `sourceA` | Coincide con el modelo canónico. |
| Workbook derecho/comparado | `sourceB` | Coincide con el modelo canónico. |
| Diff global | `workbookDiff` | Se reutiliza `WorkbookDiff`. |
| Decisiones del usuario | `mergeDecisions` | Se reutiliza `MergeDecision`. |
| Resultado final o preliminar | `mergeResult` | Se reutiliza `MergeResult`. |

### Transporte

- JSON sobre HTTPS.
- Fechas en ISO-8601 UTC.
- IDs estables siguiendo las convenciones de `docs/merge-model.md`.
- Operaciones pesadas pueden responder `202 Accepted` con un recurso de estado si el cálculo es asíncrono.

### Estados de sesión recomendados

```json
[
  "created",
  "awaiting_sources",
  "ready_for_diff",
  "processing_diff",
  "diff_ready",
  "preview_ready",
  "exporting",
  "completed",
  "failed"
]
```

## Recursos principales

### `mergeSession`

```json
{
  "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
  "createdAt": "2026-03-23T10:30:00Z",
  "updatedAt": "2026-03-23T10:30:05Z",
  "status": "awaiting_sources",
  "sourceA": null,
  "sourceB": null,
  "workbookDiff": null,
  "mergeDecisions": [],
  "mergeResult": null
}
```

### `SourceWorkbookBinding`

Contrato común para `sourceA` y `sourceB`. Admite dos modalidades: `upload` o `reference`.

```json
{
  "sourceRole": "sourceA",
  "ingestMode": "upload",
  "label": "budget.base.xlsx",
  "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "checksumSha256": "5d41402abc4b2a76b9719d911017c592",
  "uploadToken": "upl_01HQ7Z2Q8KJ9V7M3T6N4",
  "reference": null,
  "origin": {
    "kind": "excel-addin",
    "workbookId": "wb_a_budget-fp-91f2"
  }
}
```

Con referencia a un workbook ya conocido por el servicio:

```json
{
  "sourceRole": "sourceB",
  "ingestMode": "reference",
  "label": "budget.review.xlsx",
  "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "checksumSha256": "7d793037a0760186574b0282f2f435e7",
  "uploadToken": null,
  "reference": {
    "workbookId": "wb_b_budget-fp-82af",
    "artifactId": "artifact:wb_b_budget-fp-82af:v3",
    "path": "/files/budget.review.xlsx",
    "version": "v3"
  },
  "origin": {
    "kind": "document-library",
    "workbookId": "wb_b_budget-fp-82af"
  }
}
```

## Endpoints propuestos

---

## 1. Iniciar una sesión de comparación

### `POST /api/merge-sessions`

Crea una `mergeSession` vacía y devuelve el identificador estable de la sesión.

#### Request

```json
{
  "createdBy": "user:ana",
  "clientContext": {
    "clientName": "apps/excel-addin",
    "clientVersion": "0.1.0",
    "locale": "es-ES"
  },
  "comparisonOptions": {
    "detectFormulaChanges": true,
    "detectFormatChanges": false,
    "includeDefinedNames": true,
    "conflictStrategy": "manual_first"
  }
}
```

#### Response `201 Created`

```json
{
  "mergeSession": {
    "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
    "createdAt": "2026-03-23T10:30:00Z",
    "updatedAt": "2026-03-23T10:30:00Z",
    "status": "awaiting_sources",
    "sourceA": null,
    "sourceB": null,
    "workbookDiff": null,
    "mergeDecisions": [],
    "mergeResult": null,
    "comparisonOptions": {
      "detectFormulaChanges": true,
      "detectFormatChanges": false,
      "includeDefinedNames": true,
      "conflictStrategy": "manual_first"
    }
  }
}
```

---

## 2. Subir binario y vincular `sourceA` / `sourceB`

Para soportar archivos grandes y evitar mezclar binario con metadatos de negocio, se recomienda separar la subida física del binding lógico a la sesión.

### 2.1 `POST /api/uploads`

Solicita un `uploadToken` para un workbook que después será asociado a `sourceA` o `sourceB`.

#### Request

```json
{
  "fileName": "budget.base.xlsx",
  "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "sizeBytes": 48213,
  "checksumSha256": "5d41402abc4b2a76b9719d911017c592"
}
```

#### Response `201 Created`

```json
{
  "uploadToken": "upl_01HQ7Z2Q8KJ9V7M3T6N4",
  "uploadUrl": "https://uploads.internal.example/upl_01HQ7Z2Q8KJ9V7M3T6N4",
  "expiresAt": "2026-03-23T10:45:00Z"
}
```

### 2.2 `PUT /api/merge-sessions/{sessionId}/sources/sourceA`

### 2.3 `PUT /api/merge-sessions/{sessionId}/sources/sourceB`

Asocia a la sesión un workbook en modo `upload` o `reference`.

#### Request de ejemplo: `sourceA` por upload

```json
{
  "sourceRole": "sourceA",
  "ingestMode": "upload",
  "label": "budget.base.xlsx",
  "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "checksumSha256": "5d41402abc4b2a76b9719d911017c592",
  "uploadToken": "upl_01HQ7Z2Q8KJ9V7M3T6N4",
  "reference": null,
  "origin": {
    "kind": "excel-addin",
    "workbookId": "wb_a_budget-fp-91f2"
  }
}
```

#### Request de ejemplo: `sourceB` por referencia

```json
{
  "sourceRole": "sourceB",
  "ingestMode": "reference",
  "label": "budget.review.xlsx",
  "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "checksumSha256": "7d793037a0760186574b0282f2f435e7",
  "uploadToken": null,
  "reference": {
    "workbookId": "wb_b_budget-fp-82af",
    "artifactId": "artifact:wb_b_budget-fp-82af:v3",
    "path": "/files/budget.review.xlsx",
    "version": "v3"
  },
  "origin": {
    "kind": "document-library",
    "workbookId": "wb_b_budget-fp-82af"
  }
}
```

#### Response `200 OK`

```json
{
  "mergeSession": {
    "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
    "updatedAt": "2026-03-23T10:31:10Z",
    "status": "ready_for_diff",
    "sourceA": {
      "workbookId": "wb_a_budget-fp-91f2",
      "label": "budget.base.xlsx",
      "path": "/files/uploads/upl_01HQ7Z2Q8KJ9V7M3T6N4/budget.base.xlsx"
    },
    "sourceB": {
      "workbookId": "wb_b_budget-fp-82af",
      "label": "budget.review.xlsx",
      "path": "/files/budget.review.xlsx"
    }
  }
}
```

---

## 3. Obtener el diff estructurado

### `POST /api/merge-sessions/{sessionId}/workbook-diff`

Solicita el cálculo del `workbookDiff`. Puede ser síncrono para workbooks pequeños o asíncrono para cargas grandes.

#### Request

```json
{
  "recompute": false,
  "comparisonOptions": {
    "detectFormulaChanges": true,
    "detectFormatChanges": false,
    "includeDefinedNames": true,
    "conflictStrategy": "manual_first"
  }
}
```

#### Response `202 Accepted`

```json
{
  "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
  "status": "processing_diff",
  "operation": {
    "operationId": "op_diff_01HQ80M0A6Y1J",
    "kind": "compute_workbook_diff",
    "pollUrl": "/api/merge-sessions/ms_2026-03-23T10-30-00Z_budget-v1/workbook-diff"
  }
}
```

### `GET /api/merge-sessions/{sessionId}/workbook-diff`

Obtiene el `workbookDiff` estructurado ya normalizado con el modelo canónico.

#### Response `200 OK`

```json
{
  "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
  "status": "diff_ready",
  "workbookDiff": {
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
      "path": "/files/uploads/upl_01HQ7Z2Q8KJ9V7M3T6N4/budget.base.xlsx",
      "exists": true
    },
    "sourceB": {
      "label": "budget.review.xlsx",
      "path": "/files/budget.review.xlsx",
      "exists": true
    },
    "userDecision": "unresolved",
    "finalState": "pending",
    "worksheetDiffs": [
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
        "cellDiffs": [
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
            "userDecision": "unresolved",
            "finalState": "pending",
            "conflictIds": []
          }
        ],
        "conflicts": []
      }
    ],
    "conflicts": [],
    "summary": {
      "worksheetCount": 1,
      "cellDiffCount": 1,
      "conflictCount": 0,
      "autoResolvableCount": 1
    }
  }
}
```

---

## 4. Guardar decisiones de merge

### `PUT /api/merge-sessions/{sessionId}/merge-decisions`

Guarda o reemplaza decisiones sobre nodos del `workbookDiff`. La operación es **idempotente por `MergeDecision.id`**.

#### Request

```json
{
  "mergeDecisions": [
    {
      "id": "decision:cell:summary:0:B4",
      "nodeType": "MergeDecision",
      "targetType": "cell",
      "targetId": "cell:summary:0:B4",
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
        "exists": true
      },
      "sourceB": {
        "value": 1350,
        "exists": true
      },
      "userDecision": "take_b",
      "finalState": "accepted_b",
      "decidedBy": "user:ana",
      "decidedAt": "2026-03-23T10:35:00Z",
      "note": "Aceptar el importe revisado."
    }
  ]
}
```

#### Response `200 OK`

```json
{
  "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
  "savedDecisionCount": 1,
  "mergeDecisions": [
    {
      "id": "decision:cell:summary:0:B4",
      "nodeType": "MergeDecision",
      "targetType": "cell",
      "targetId": "cell:summary:0:B4",
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
        "exists": true
      },
      "sourceB": {
        "value": 1350,
        "exists": true
      },
      "userDecision": "take_b",
      "finalState": "accepted_b",
      "decidedBy": "user:ana",
      "decidedAt": "2026-03-23T10:35:00Z",
      "note": "Aceptar el importe revisado."
    }
  ],
  "status": "diff_ready"
}
```

---

## 5. Solicitar vista previa del resultado

### `POST /api/merge-sessions/{sessionId}/merge-result-preview`

Construye una vista previa no exportada del `mergeResult` usando el `workbookDiff` y las `mergeDecisions` vigentes.

#### Request

```json
{
  "includeWorkbookMetadata": true,
  "includeCellChanges": true,
  "validateUnresolvedConflicts": true
}
```

#### Response `200 OK`

```json
{
  "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
  "status": "preview_ready",
  "mergeResult": {
    "id": "merge-result:ms_2026-03-23T10-30-00Z_budget-v1:preview-001",
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
    "userDecision": "take_b",
    "finalState": "merged",
    "appliedDecisionIds": [
      "decision:cell:summary:0:B4"
    ],
    "output": {
      "workbookId": "wb_preview_budget-fp-1aa1",
      "path": null,
      "resolvedConflictCount": 1,
      "unresolvedConflictCount": 0
    }
  },
  "preview": {
    "worksheetChanges": [
      {
        "worksheetId": "ws:summary:0",
        "cellChanges": [
          {
            "a1": "B4",
            "finalValue": 1350,
            "finalFormula": null,
            "finalState": "accepted_b"
          }
        ]
      }
    ],
    "warnings": []
  }
}
```

---

## 6. Exportar workbook final

### `POST /api/merge-sessions/{sessionId}/merge-result-export`

Materializa el `mergeResult` en un archivo descargable o una referencia persistida.

#### Request

```json
{
  "exportFormat": "xlsx",
  "fileName": "budget.merged.xlsx",
  "delivery": {
    "mode": "download_url",
    "expiresInSeconds": 3600
  }
}
```

#### Response `202 Accepted`

```json
{
  "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
  "status": "exporting",
  "operation": {
    "operationId": "op_export_01HQ80WY5TK4P",
    "kind": "export_merge_result",
    "pollUrl": "/api/merge-sessions/ms_2026-03-23T10-30-00Z_budget-v1/merge-result"
  }
}
```

### `GET /api/merge-sessions/{sessionId}/merge-result`

Obtiene el `mergeResult` final una vez exportado.

#### Response `200 OK`

```json
{
  "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
  "status": "completed",
  "mergeResult": {
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
    "userDecision": "take_b",
    "finalState": "merged",
    "appliedDecisionIds": [
      "decision:cell:summary:0:B4"
    ],
    "output": {
      "workbookId": "wb_merged_budget-fp-1aa1",
      "path": "/files/budget.merged.xlsx",
      "downloadUrl": "https://downloads.internal.example/files/budget.merged.xlsx",
      "resolvedConflictCount": 1,
      "unresolvedConflictCount": 0
    }
  }
}
```

## Errores recomendados

Formato común de error:

```json
{
  "error": {
    "code": "invalid_merge_decision",
    "message": "targetId does not belong to the current workbookDiff.",
    "details": {
      "sessionId": "ms_2026-03-23T10-30-00Z_budget-v1",
      "targetId": "cell:summary:0:Z999"
    }
  }
}
```

Códigos sugeridos:

- `session_not_found`
- `source_binding_invalid`
- `source_checksum_mismatch`
- `workbook_diff_not_ready`
- `invalid_merge_decision`
- `unresolved_conflicts`
- `export_failed`

## Recomendaciones de implementación

- El add-in debe tratar `workbookDiff`, `mergeDecisions` y `mergeResult` como documentos canónicos del dominio, no como DTOs a remapear.
- Si el add-in necesita estado visual adicional, debe mantenerlo en estructuras propias de UI sin contaminar el contrato del servicio.
- `sourceA` y `sourceB` deben conservarse en toda la vida de la sesión para auditoría y reintentos.
- Las decisiones deben persistirse como `MergeDecision` independientes del `CellDiff` original para mantener trazabilidad, tal como recomienda el modelo canónico.
