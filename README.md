# Excel-compare

## Objetivo del producto

Excel-compare busca ayudar a usuarios internos a comparar dos versiones de un workbook de Excel, identificar diferencias relevantes, resolver cada conflict de forma guiada y producir un result workbook reproducible y auditable.

El producto está pensado para reducir revisiones manuales hoja por hoja, mantener trazabilidad sobre cada decision tomada dentro de una merge session y ofrecer una experiencia operable desde Excel mediante un add-in.

## Alcance del MVP

El MVP se enfoca en un flujo claro y usable para comparación de dos archivos:

- cargar un workbook base y un workbook comparado;
- generar una merge session con un resumen de diferencias;
- detectar cambios a nivel de hoja, celda, fórmulas y estructuras básicas;
- identificar cada conflict que requiera intervención manual;
- permitir registrar una decision por conflict o por bloques simples de cambios homogéneos;
- construir y exportar un result workbook con las decisiones aplicadas.

Quedan fuera del MVP, por ahora, la colaboración multiusuario en tiempo real, las reglas avanzadas configurables por dominio y la cobertura exhaustiva de todos los objetos complejos de Excel.

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

- `apps/excel-addin/`: contendrá la UI del task pane, la integración con Office.js y la orquestación de la experiencia de usuario dentro de Excel.
- `services/merge-engine/`: concentrará la normalización de workbooks, el cálculo de diferencias, la detección de conflict y la generación del resultado aplicable.
- `schemas/`: almacenará ejemplos, contratos JSON y estructuras compartidas para merge session, conflict, decision y result workbook.
- `docs/`: reunirá la documentación de arquitectura, UX, restricciones empresariales y decisiones técnicas del repositorio.

## Flujo de alto nivel

1. **Carga de archivos**
   - El usuario abre el add-in y selecciona el workbook base y el workbook comparado.
   - La interfaz crea o reanuda una merge session.

2. **Ingesta y normalización**
   - El merge engine lee ambos archivos.
   - El servicio normaliza hojas, rangos, celdas, fórmulas y metadatos relevantes para compararlos con una estructura consistente.

3. **Detección de diferencias**
   - El sistema genera un modelo de cambios por workbook, hoja y celda.
   - Cada diferencia se clasifica como cambio auto-resoluble o conflict según reglas del MVP.

4. **Resolución guiada**
   - La UI presenta cada conflict con contexto suficiente.
   - El usuario registra una decision, por ejemplo aceptar una fuente, editar manualmente o aplicar una resolución por bloque.

5. **Construcción del resultado**
   - El merge engine aplica las decisions de la merge session.
   - Se genera un result workbook consistente con el estado final acordado.

6. **Exportación y trazabilidad**
   - El usuario exporta el result workbook.
   - La merge session conserva el historial mínimo necesario de conflicts, decisions y estado final para auditoría o reanudación futura.

## Documentación relacionada

- [Propuesta técnica de arquitectura](docs/propuesta-arquitectura-diseno.md)
- [Modelo de datos de merge session](docs/merge-model.md)
- [Especificación UX del MVP](docs/ux-mvp-especificacion-mvp.md)
- [Requisitos no funcionales para entorno empresarial](docs/requisitos-no-funcionales-entorno-empresarial.md)
- [Casos de uso y no-objetivos del MVP](MVP_MERGE_EXCEL.md)
