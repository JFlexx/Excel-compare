# Propuesta técnica de arquitectura

## 1. Objetivo

Definir una arquitectura base para una solución interna de comparación y merge de libros Excel que permita:

- Leer el workbook activo desde Excel.
- Comparar dos archivos `.xlsx` de forma consistente y auditable.
- Presentar diferencias y decisiones de merge en un panel lateral.
- Aplicar el resultado final al libro de trabajo con trazabilidad.
- Escalar más adelante a nuevos flujos, reglas de negocio y colaboración entre usuarios.

## 2. Principios de diseño

1. **Separación clara de responsabilidades** entre interfaz, orquestación, motor de comparación y persistencia.
2. **Modelo de diferencias estable** para desacoplar la UI del algoritmo de diff/merge.
3. **Integración segura con Excel** usando APIs soportadas y desplegables de forma centralizada.
4. **Escalabilidad futura** para evolucionar desde uso individual a escenarios con auditoría, sesiones persistidas y backend compartido.
5. **Portabilidad empresarial** para minimizar dependencia del escritorio Windows y favorecer despliegues administrados.

## 3. Arquitectura propuesta

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Cliente: Office Add-in dentro de Excel                             │
│  - Task Pane UI                                                    │
│  - Selector de archivos / sesiones                                 │
│  - Visualización de diferencias                                    │
│  - Flujo de decisiones de merge                                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Capa de aplicación                                                 │
│  - Session Comparison Controller                                   │
│  - Gestión de estado del merge                                     │
│  - Validaciones, comandos y navegación                             │
│  - Adaptadores para Excel y backend                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
              ┌────────────────┴───────────────┐
              ▼                                ▼
┌───────────────────────────────┐   ┌─────────────────────────────────┐
│ Motor interno de diff/merge   │   │ Persistencia opcional           │
│  - Ingesta de dos .xlsx       │   │  - Sesiones temporales          │
│  - Normalización              │   │  - Auditoría                    │
│  - Diff estructural/celdas    │   │  - Decisiones del usuario       │
│  - Resolución de conflictos   │   │  - Reanudación                  │
└───────────────────────────────┘   └─────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Integración con Excel                                              │
│  - Lectura del libro activo                                        │
│  - Extracción/tablas/rangos/nombres                               │
│  - Aplicación del resultado final al workbook                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 4. Componentes

### 4.1 Cliente: Office Add-in dentro de Excel con panel lateral

El cliente se implementa como un **Office Add-in** que corre dentro de Excel y expone un **panel lateral (task pane)** como interfaz principal.

#### Responsabilidades

- Mostrar el estado de la comparación actual.
- Permitir cargar una segunda versión del libro o seleccionar una sesión existente.
- Presentar diferencias por hoja, rango, tabla o celda.
- Guiar al usuario en decisiones de merge: aceptar origen A, origen B o aplicar reglas automáticas.
- Lanzar la ejecución final sobre el workbook activo.

#### Estructura recomendada del cliente

- **UI del panel lateral**
  - Lista de hojas afectadas.
  - Resumen de diferencias por severidad/tipo.
  - Vista detalle del conflicto seleccionado.
  - Acciones de merge y confirmación.
- **Servicios cliente**
  - Cliente HTTP/API para backend interno.
  - Adaptador de Office.js para Excel.
  - Manejador de autenticación corporativa si aplica.
- **Estado local de UI**
  - Sesión activa.
  - Diferencia seleccionada.
  - Progreso del procesamiento.
  - Errores recuperables y no recuperables.

#### Motivo de esta elección

El panel lateral es el punto natural para procesos guiados y multi-paso. Evita sobrecargar la cinta de Excel y permite evolucionar la experiencia con mayor densidad de información, filtros, historial y validaciones.

### 4.2 Capa de aplicación: controlador de sesiones de comparación y estado del merge

Se recomienda una capa intermedia de aplicación, separada de la UI, responsable de orquestar el flujo funcional.

#### Responsabilidades

- Crear, recuperar, cerrar o descartar sesiones de comparación.
- Mantener un **estado de merge** explícito y serializable.
- Traducir acciones de usuario en comandos del sistema.
- Coordinar llamadas al motor de diff/merge y a la persistencia.
- Resolver políticas de negocio, por ejemplo:
  - qué tipos de conflicto requieren confirmación manual,
  - qué cambios pueden autoaceptarse,
  - qué validaciones deben ejecutarse antes de aplicar resultados.

#### Modelo de estado sugerido

```text
Session
- sessionId
- workbookActivoRef
- workbookComparadoRef
- status: Created | Processing | Ready | Applying | Completed | Failed
- diffSummary
- mergeDecisions[]
- auditTrail[]
- createdBy / createdAt / updatedAt
```

```text
MergeDecision
- diffId
- decision: SourceA | SourceB | Manual | RuleBased | Pending
- decidedBy
- decidedAt
- rationale
```

#### Patrón recomendado

Usar un patrón tipo **controller + application services + state store**. Esto facilita:

- testear la lógica sin depender de Excel,
- soportar reanudación de sesiones,
- migrar a backend más robusto sin rehacer la UI.

### 4.3 Motor de diff/merge: servicio interno que procese dos `.xlsx`

El corazón funcional debe ser un **servicio interno** desacoplado del add-in. Su función es recibir dos archivos `.xlsx` (o representaciones equivalentes), procesarlos y devolver un **modelo de diferencias** estable y consumible por la capa de aplicación.

#### Responsabilidades

- Parsear ambos libros.
- Normalizar estructuras de hojas, rangos, celdas, tablas, fórmulas y metadatos relevantes.
- Detectar cambios:
  - celdas añadidas/eliminadas,
  - cambios de valor,
  - cambios de fórmula,
  - cambios estructurales por hoja o tabla,
  - cambios de formato, si el alcance lo requiere.
- Generar conflictos cuando dos fuentes sean incompatibles bajo las reglas definidas.
- Devolver una propuesta de merge parcial o total cuando sea posible.

#### Entrada y salida sugeridas

**Entrada:**
- `baseWorkbook` o `activeWorkbookSnapshot`
- `compareWorkbook`
- parámetros de comparación
- reglas de negocio opcionales

**Salida:**

```text
DiffModel
- sessionId
- workbookSummary
- sheetDiffs[]
- conflictCount
- autoResolvableCount
- warnings[]
```

```text
SheetDiff
- sheetName
- sheetStatus: Added | Removed | Modified | Unchanged
- cellDiffs[]
- structuralDiffs[]
```

```text
CellDiff
- diffId
- address
- oldValue
- newValue
- oldFormula
- newFormula
- changeType
- conflict: true|false
- suggestedResolution
```

#### Justificación de que sea un servicio interno

- Permite evolucionar el algoritmo sin redistribuir completamente la lógica al cliente.
- Facilita pruebas automatizadas con colecciones de archivos `.xlsx` de referencia.
- Abre la puerta a procesamientos más pesados o asíncronos.
- Reduce acoplamiento con limitaciones del runtime del add-in.

#### Consideraciones técnicas

- Conviene diseñar el motor con una **etapa de normalización** previa para evitar que la UI dependa del formato nativo de Excel.
- Debe existir una capa de **mapping entre conceptos Excel y el dominio de diff**.
- La estrategia de merge debe distinguir entre:
  - cambios deterministas autoaplicables,
  - conflictos que requieren decisión humana,
  - casos no soportados inicialmente que deban marcarse como warning.

### 4.4 Persistencia opcional: almacenamiento temporal, auditoría y decisiones del usuario

La persistencia no es estrictamente obligatoria en una primera iteración, pero es altamente recomendable si el caso de uso interno exige trazabilidad o sesiones largas.

#### Capacidades recomendadas

- **Almacenamiento temporal de sesiones** para reanudar el trabajo.
- **Auditoría** de qué diferencias fueron detectadas y qué decisión tomó cada usuario.
- **Persistencia de decisiones** para evitar pérdida de contexto si Excel se cierra.
- **Soporte de reporting interno** sobre conflictos frecuentes, tiempos de resolución y reglas más usadas.

#### Diseño sugerido

- Persistencia opcional en backend interno, no como dependencia dura del cliente.
- TTL para sesiones temporales.
- Registro auditable de eventos, por ejemplo:
  - sesión creada,
  - diff ejecutado,
  - decisión aplicada,
  - merge final publicado.

#### Entidades sugeridas

- `ComparisonSession`
- `SessionArtifact`
- `DecisionLog`
- `AuditEvent`

#### Beneficio arquitectónico

Esta capa hace viable evolucionar desde un flujo “local e inmediato” a un flujo “supervisado, auditable y colaborativo”, sin reescribir la experiencia del add-in.

## 5. Integración con Excel

La integración con Excel debe resolverse con dos responsabilidades separadas: **lectura del libro activo** y **aplicación del resultado final**.

### 5.1 Cómo leer el libro activo

Desde el Office Add-in, la lectura del workbook activo debe realizarse con **Office.js / Excel JavaScript API**.

#### Flujo recomendado

1. El usuario abre Excel y activa el add-in.
2. El add-in obtiene el contexto del workbook activo.
3. Se extraen las hojas relevantes, rangos usados, tablas, nombres definidos y, cuando aplique, fórmulas/valores.
4. Se construye un **snapshot lógico** del libro activo.
5. Ese snapshot se envía a la capa de aplicación y, si procede, al motor de diff/merge.

#### Recomendaciones

- Leer datos por lotes para reducir round-trips con `context.sync()`.
- Extraer únicamente la superficie necesaria para el caso de uso inicial.
- Separar datos de negocio de detalles visuales o de formato salvo que el merge de formato sea un requisito explícito.
- Mantener una versión serializable del snapshot para trazabilidad y debugging.

### 5.2 Cómo aplicar el resultado final al workbook

El resultado final debe materializarse también mediante **Excel JavaScript API**, idealmente a partir de un plan de cambios generado por la capa de aplicación.

#### Estrategia recomendada

1. La capa de aplicación transforma las decisiones del usuario en un **ApplyPlan**.
2. El add-in ejecuta una validación final de exportación:
   - confirma que no queden conflictos pendientes,
   - confirma que las ediciones manuales tengan estado persistido,
   - confirma que el workbook activo sigue siendo compatible con la sesión.
3. La capa de aplicación genera un **ExportSummary** visible y serializable para auditoría interna.
4. Se aplican cambios por lotes:
   - actualización de celdas,
   - inserción o eliminación de filas/columnas si el alcance lo contempla,
   - actualización de fórmulas,
   - marcas de revisión o comentarios si se desean.
5. Se genera el `.xlsx` final con nombre sugerido por el sistema y editable por el usuario.
6. Se confirma el resultado y se registra la auditoría.

#### ApplyPlan sugerido

```text
ApplyPlan
- targetWorkbookId
- preconditions[]
- operations[]
- rollbackHints[]
- suggestedFileName
- exportSummary
```

```text
Operation
- type: SetValue | SetFormula | AddSheet | DeleteSheet | UpdateTable | HighlightConflict
- target
- payload
- sourceDiffId
```

```text
ExportSummary
- affectedSheets[]
- resolvedConflictCount
- acceptedFromA
- acceptedFromB
- manualEditCount
- autoResolvedCount
- decisionsByType[]
- generatedAt
```

#### Buenas prácticas

- Aplicar cambios en transacciones lógicas por lote.
- Validar precondiciones para detectar si el libro fue modificado después del diff.
- Si el riesgo es alto, crear una hoja de respaldo o un duplicado antes de aplicar cambios masivos.
- Tratar `ExportSummary` como artefacto de salida de primer nivel: debe mostrarse en UI, guardarse junto con la sesión y poder exportarse como evidencia de auditoría.

## 6. Comparativa explícita: Office Add-in vs VBA vs VSTO/COM

### 6.1 Office Add-in

#### Ventajas

- Basado en estándares web y **Office.js**, con mejor alineación para evolución futura.
- Despliegue y actualización más centralizados en entornos Microsoft 365.
- Interfaz moderna en panel lateral, adecuada para workflows complejos.
- Menor dependencia de una instalación local específica.
- Mejor camino para integrar backend, auditoría, autenticación y servicios corporativos.
- Más portable para futuras extensiones a Excel en distintos entornos soportados por la plataforma Office.

#### Limitaciones

- La API de Excel JavaScript puede no cubrir todos los escenarios históricos de automatización de escritorio.
- Requiere diseñar bien las operaciones para evitar sobrecoste en sincronizaciones.
- Algunas capacidades avanzadas de Excel pueden necesitar alternativas o restricciones funcionales.

### 6.2 VBA

#### Ventajas

- Muy cercano al objeto Excel clásico.
- Rápido para prototipos locales o automatizaciones simples.
- Bajo umbral de entrada en organizaciones con legado Office.

#### Desventajas

- Mantenimiento difícil a medida que crece la complejidad.
- Menor robustez para arquitectura multicapa, observabilidad y pruebas modernas.
- Distribución, control de versiones y gobernanza más limitados.
- Peor encaje para integrar servicios internos modernos, auditoría y escalado futuro.
- Mayor exposición a restricciones de seguridad y macros en entornos corporativos.

### 6.3 VSTO/COM

#### Ventajas

- Integración profunda con Excel en Windows.
- Acceso potente al modelo de objetos de Office y al entorno de escritorio.
- Adecuado para escenarios muy ligados a Windows y Office de escritorio administrado.

#### Desventajas

- Fuerte acoplamiento con Windows y con el cliente de escritorio.
- Despliegue y mantenimiento más costosos que un add-in moderno.
- Menor portabilidad estratégica.
- Menor alineación con una visión de plataforma evolutiva basada en servicios.
- Incrementa deuda técnica si en el futuro se quiere abrir el alcance a experiencias más modernas.

## 7. Justificación de la elección recomendada

### Elección propuesta: **Office Add-in + servicio interno de diff/merge**

Para un **uso interno empresarial** con expectativa de crecimiento, la mejor opción es un **Office Add-in** como cliente y un **servicio interno** como motor de comparación/merge.

#### Justificación

1. **Mejor equilibrio entre experiencia de usuario y gobernanza**.
   - El add-in ofrece una UX moderna y guiada dentro de Excel.
   - Permite gestión centralizada y actualizaciones controladas.

2. **Escalabilidad futura**.
   - La lógica pesada de comparación vive fuera del cliente.
   - Es posible incorporar auditoría, reglas, persistencia y métricas sin rediseñar el frontend.

3. **Menor acoplamiento tecnológico**.
   - Evita quedar atado a VBA o a VSTO/COM para funcionalidades estratégicas.
   - Facilita evolución hacia servicios reutilizables por otros canales en el futuro.

4. **Alineación con arquitectura empresarial moderna**.
   - Mejor integración con autenticación, APIs internas, logging, monitoreo y trazabilidad.
   - Más compatible con prácticas DevOps, testing automatizado y versionado del sistema.

5. **Camino incremental**.
   - Puede comenzar con persistencia opcional y un alcance funcional reducido.
   - Luego puede crecer hacia sesiones reanudables, auditoría completa y reglas automáticas avanzadas.

## 8. Propuesta de despliegue por fases

### Fase 1: MVP

- Office Add-in con panel lateral.
- Lectura del workbook activo.
- Carga de segundo `.xlsx`.
- Motor interno con diff básico por hoja/celda/fórmula.
- Aplicación de cambios simples al workbook activo.
- Sin persistencia o con persistencia temporal mínima.

### Fase 2: Operación interna controlada

- Persistencia temporal de sesiones.
- Auditoría de decisiones.
- Reanudación de merge.
- Reglas automáticas configurables.
- Resumen de conflictos y validaciones previas a publicar.

### Fase 3: Escalado empresarial

- Métricas operativas.
- Versionado de reglas de comparación.
- Trazabilidad extendida.
- Integración con identidad corporativa y políticas de acceso.
- Posible reutilización del motor por otros procesos batch o APIs internas.

## 9. Riesgos y mitigaciones

- **Riesgo:** diferencias entre capacidades deseadas y cobertura de Office.js.  
  **Mitigación:** acotar el alcance inicial y validar temprano operaciones críticas sobre workbooks reales.

- **Riesgo:** costo de procesar libros grandes.  
  **Mitigación:** delegar comparación al servicio interno, usar procesamiento asíncrono y limitar payloads del cliente.

- **Riesgo:** inconsistencias si el workbook cambia tras generar el diff.  
  **Mitigación:** usar precondiciones, versionado lógico del snapshot y validación antes de aplicar.

- **Riesgo:** complejidad del merge de fórmulas y estructuras avanzadas.  
  **Mitigación:** clasificar capacidades por niveles y marcar escenarios no soportados desde la primera versión.

## 10. Conclusión

La propuesta recomendada es una arquitectura con **Office Add-in en Excel como cliente**, una **capa de aplicación** que gobierna sesiones y estado de merge, un **motor interno de diff/merge** desacoplado, y una **persistencia opcional** para auditoría y reanudación. Esta arquitectura ofrece la mejor combinación de adopción interna, mantenibilidad y escalabilidad futura frente a alternativas como VBA o VSTO/COM.
