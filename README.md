# Excel-compare

## Objetivo del producto

Excel-compare busca ayudar a usuarios internos a comparar dos versiones de un workbook de Excel, identificar diferencias relevantes, resolver cada conflicto de forma guiada y producir un workbook resultante reproducible y auditable.

El producto está pensado para reducir revisiones manuales hoja por hoja, mantener trazabilidad sobre cada decisión tomada dentro de una merge session y ofrecer una experiencia operable desde Excel mediante un add-in.

## Cómo empezar hoy

### 1. Preparar el motor

```bash
cd services/merge-engine
npm install
npm test
```

### 2. Levantar el add-in usable

```bash
cd apps/excel-addin
npm test
npm start
```

Luego abre `http://localhost:3000/index.html`.

### 3. Flujos soportados ahora mismo

1. comparar dos workbooks `.xlsx/.xlsm` reales desde el task pane local;
2. importar una merge session `.json` ya existente;
3. recuperar una sesión desde `Office.settings` o `sessionUrl` cuando el panel se ejecuta dentro de Excel;
4. resolver conflictos uno por uno con aceptar izquierda, aceptar derecha o edición manual básica;
5. revisar pendientes, conflictos críticos y hojas afectadas;
6. exportar el workbook final en `.xlsx` cuando la sesión queda consistente y sin pendientes.

## Alcance del MVP

El MVP se enfoca en un flujo claro y usable para comparación de dos archivos:

- cargar un workbook base y un workbook comparado;
- generar una merge session con un resumen de diferencias;
- detectar cambios a nivel de hoja, celda, fórmulas y estructuras básicas;
- identificar cada conflicto que requiera intervención manual;
- permitir registrar una decisión por conflicto o por bloques simples de cambios homogéneos;
- construir y exportar un workbook resultante.

## Qué queda fuera del piloto

Quedan fuera del piloto, y ahora se muestran con el mismo lenguaje tanto en UI como en errores del motor:

- macros y código VBA;
- tablas dinámicas complejas;
- objetos embebidos o flotantes como gráficos, imágenes o controles;
- formatos avanzados cuyo merge requiera semántica propia de Excel;
- cambios estructurales ambiguos, como renombrados dudosos, celdas combinadas o desplazamientos complejos;
- comparación de más de dos versiones simultáneamente;
- colaboración multiusuario en tiempo real y reglas avanzadas por dominio.

## Ejemplo real de sesión del MVP

El repositorio incluye una sesión completa de ejemplo en `schemas/examples/mvp-session-example.json`. Allí se ve, en un único artefacto:

- el archivo base `budget.base.xlsx` y el comparado `budget.review.xlsx`;
- el conflicto detectado en `Summary!C3` por fórmula distinta;
- la decisión registrada `take_a` para conservar la fórmula del libro base;
- el artefacto exportable con la hoja `Summary` ya resuelta y la hoja `Notes` agregada desde el comparado.

## Estructura del repositorio

```text
.
├── apps/
│   └── excel-addin/        # Interfaz y experiencia dentro de Excel
├── services/
│   └── merge-engine/       # Lógica de comparación, conflictos y resolución
├── schemas/                # Ejemplos de merge session y estructuras de datos
├── docs/                   # Arquitectura, UX y decisiones técnicas
├── MVP_MERGE_EXCEL.md      # Alcance funcional y no-objetivos del MVP
└── README.md               # Visión general del proyecto
```

### Responsabilidades por carpeta

- `apps/excel-addin/`: UI del task pane, integración con Office.js y orquestación de la experiencia de usuario dentro de Excel.
- `services/merge-engine/`: normalización de workbooks, cálculo de diferencias, detección de conflicto y generación del resultado aplicable.
- `schemas/`: contratos JSON, ejemplos y estructuras compartidas para merge session, conflicto, decisión y workbook resultante.
- `docs/`: arquitectura, UX, restricciones empresariales y decisiones técnicas.

## Documentación relacionada

- [Propuesta técnica de arquitectura](docs/propuesta-arquitectura-diseno.md)
- [Propuesta de integración MVP para foco de conflictos en el add-in](docs/excel-addin-conflict-focus-mvp.md)
- [Modelo de datos de merge session](docs/merge-model.md)
- [Especificación UX del MVP](docs/ux-mvp-especificacion-mvp.md)
- [Requisitos no funcionales para entorno empresarial](docs/requisitos-no-funcionales-entorno-empresarial.md)
- [Casos de uso y no-objetivos del MVP](MVP_MERGE_EXCEL.md)
