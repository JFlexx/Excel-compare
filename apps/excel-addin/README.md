# Excel Add-in local

Implementación del task pane del MVP para ejecutar un flujo usable desde navegador o Excel:

1. comparar dos workbooks reales;
2. crear la merge session inicial;
3. persistirla localmente y, cuando existe, también en `Office.settings`;
4. resolver conflictos con decisiones izquierda/derecha o edición manual básica;
5. revisar pendientes antes de exportar;
6. exportar el workbook final en `.xlsx`.

## Cómo empezar hoy

```bash
cd ../services/merge-engine
npm install
npm test

cd ../../apps/excel-addin
npm test
npm start
```

Abre `http://localhost:3000/index.html` para usar el task pane local.

## Flujos soportados por el add-in

### Comparar workbooks reales

- selecciona un workbook base y uno comparado en la UI;
- el servidor local genera la `merge session` usando el motor compartido;
- la lista de conflictos se actualiza con filtros por estado y hoja.

### Cargar una merge session existente

- importa un archivo JSON de sesión;
- o carga una sesión remota por URL;
- o recupérala desde Excel si está guardada en `Office.settings`.

### Resolver conflictos

- aceptar izquierda;
- aceptar derecha;
- guardar edición manual para valores y fórmulas simples;
- revisar el resumen final de pendientes y conflictos críticos.

### Exportar workbook final

- cuando ya no quedan pendientes, el botón de exportación descarga el `.xlsx` final.

## Qué queda fuera del piloto

El add-in comunica explícitamente estos límites cuando aparezcan en validación o en errores:

- macros y VBA;
- tablas dinámicas complejas;
- objetos embebidos o flotantes;
- formatos avanzados con semántica propia de Excel;
- cambios estructurales ambiguos;
- multiusuario en tiempo real;
- comparación de más de dos versiones.

## Artefactos principales

- `app.js`: shell usable del task pane con comparación real, importación de sesión, revisión final y exportación.
- `server.mjs`: servidor local estático más endpoints `/api/compare` y `/api/export`.
- `src/server-session.js`: adapta uploads/workbooks al motor y genera el `.xlsx` final.
- `src/session-model.js`: normaliza sesiones para la UI y para sincronización con Excel.
- `src/session-operations.js`: aplica decisiones del task pane y actualiza la vista previa local.
