# Excel Add-in local

Empaquetado mínimo del task pane para poder cargar el complemento en Excel sin montar infraestructura adicional. El add-in se sirve desde `localhost` y el manifiesto apunta directamente al HTML local.

## Qué incluye

- `manifest.xml` con metadatos básicos del complemento, host `Workbook`, task pane local y permisos `ReadWriteDocument`.
- servidor estático mínimo en Node para servir `index.html`, `app.js`, `styles.css` y `assets/`.
- estructura inicial en `assets/manifest/` para iconos y futura evolución del manifiesto.
- validación opcional del manifiesto mediante `office-addin-manifest` ejecutado con `npx`.

## Dependencias CDN

El task pane **mantiene `office.js` y `xlsx` cargados por CDN** desde `index.html`.

- `office.js`: `https://appsforoffice.microsoft.com/lib/1/hosted/office.js`
- `xlsx`: `https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js`

No se han movido al build local para conservar un empaquetado mínimo y evitar introducir bundling o infraestructura extra en esta fase.

## Prerrequisitos

- Node.js 18 o superior.
- Excel Desktop (Microsoft 365) o Excel en la Web con soporte para Office Add-ins.
- Permiso para sideload de complementos en el entorno de desarrollo.

## Arranque local

Desde la raíz del repositorio:

```bash
cd apps/excel-addin
npm run start
```

## URL local esperada

Con el servidor arrancado, el task pane debe quedar disponible en:

- `http://localhost:3000/index.html`

Los assets del manifiesto quedan servidos desde la misma base, por ejemplo:

- `http://localhost:3000/assets/manifest/icon-32.svg`
- `http://localhost:3000/manifest.xml`

## Scripts disponibles

```bash
npm run start
npm run serve
npm run validate:manifest
```

- `start` / `serve`: levanta el servidor estático local del task pane.
- `validate:manifest`: valida `manifest.xml` usando `npx office-addin-manifest validate manifest.xml`.

> Nota: la validación es opcional y descarga la herramienta en el momento si no está disponible en caché.

## Sideload en Excel Desktop

1. Arranca el servidor con `npm run start`.
2. Verifica que `http://localhost:3000/index.html` responda.
3. Abre Excel Desktop.
4. Ve a **Insertar > Mis complementos > Administrar mis complementos** o al flujo de **Cargar mi complemento** según la versión.
5. Selecciona `apps/excel-addin/manifest.xml`.
6. Abre el complemento **Excel Compare** y, si hace falta, usa el botón **Abrir comparador** de la cinta.

## Sideload en Excel Web

1. Arranca el servidor con `npm run start`.
2. Confirma que el navegador puede abrir `http://localhost:3000/index.html` desde la misma máquina donde usarás Excel.
3. En Excel para la Web, abre un workbook.
4. Ve a **Insertar > Complementos > Mis complementos > Cargar mi complemento**.
5. Selecciona `apps/excel-addin/manifest.xml`.
6. Excel cargará el manifiesto y abrirá el task pane local cuando ejecutes el complemento.

## Estructura mínima recomendada

```text
apps/excel-addin/
├── assets/
│   └── manifest/
│       ├── icon-32.svg
│       └── icon-80.svg
├── app.js
├── index.html
├── manifest.xml
├── package.json
├── README.md
├── server.mjs
└── styles.css
```

Esta base permite evolucionar el task pane y el manifiesto sin introducir todavía un pipeline de build más complejo.
