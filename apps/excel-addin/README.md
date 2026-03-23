# apps/excel-addin

Implementación del task pane del MVP para ejecutar un único flujo oficial: seleccionar dos workbooks, normalizarlos, crear la merge session, persistir checkpoints, resolver conflictos, validar el estado final y exportar el resultado.

## Cómo empezar hoy

```bash
cd ../services/merge-engine
npm install
npm test

cd ../../apps/excel-addin
npm test
```

Con esto validas la orquestación principal del add-in, la persistencia de checkpoints, la revisión final y la construcción del workbook exportable.

## Flujo oficial soportado por el add-in

1. seleccionar workbook base y comparado;
2. normalizar ambos libros;
3. crear la merge session inicial;
4. guardar el checkpoint inicial y los siguientes checkpoints de resolución;
5. resolver conflictos individuales, por bloque o con edición manual básica;
6. validar consistencia y pendientes antes de exportar;
7. generar el workbook final descargable.

## Qué queda fuera del piloto

El add-in debe comunicar explícitamente estos límites cuando aparezcan en validación o en errores:

- macros y VBA;
- tablas dinámicas complejas;
- objetos embebidos o flotantes;
- formatos avanzados con semántica propia de Excel;
- cambios estructurales ambiguos;
- multiusuario en tiempo real;
- comparación de más de dos versiones.

## Artefactos principales

- `src/compare-session.js`: crea la sesión oficial del MVP a partir de dos workbooks normalizados.
- `src/session-persistence.js`: persiste la sesión, reanuda checkpoints y registra decisiones.
- `src/final-review.js`: valida consistencia, resume la revisión y genera el workbook final.
- `src/detail-panel.js`: expone las acciones de aceptar izquierda/derecha y edición manual básica.
