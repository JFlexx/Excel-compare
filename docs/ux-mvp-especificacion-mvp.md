# Especificación UX del MVP para usuarios internos no técnicos

## 1. Objetivo del MVP

Permitir que una persona interna sin conocimientos técnicos compare dos archivos Excel, revise diferencias por hoja, resuelva conflictos de forma guiada y exporte un archivo final consolidado sin necesitar entender estructuras de datos, fórmulas complejas ni procesos de merge manuales.

## 2. Perfil de usuario

### Usuario principal
- Perfil: operaciones, finanzas, administración, back office o soporte.
- Nivel técnico: básico.
- Frecuencia esperada: uso ocasional o recurrente según proceso interno.
- Necesidad principal: identificar rápido qué cambió y decidir qué versión conservar.

### Principios UX
- Lenguaje simple y orientado a tareas.
- Jerarquía visual clara entre archivos, hojas y conflictos.
- Evitar ambigüedad sobre qué acción modifica el resultado final.
- Minimizar errores irreversibles mediante confirmaciones y estados visibles.
- Mantener siempre visible cuántos conflictos quedan pendientes.

## 3. Alcance funcional del MVP

Incluye:
- Carga o selección de archivo base.
- Carga o selección de archivo comparado.
- Visualización lado a lado del contenido.
- Lista de conflictos con navegación guiada.
- Resolución por conflicto.
- Edición manual puntual.
- Filtros por tipo de cambio.
- Navegación por hoja.
- Guardado de progreso local de la sesión (si aplica en producto) o al menos mantenimiento del estado mientras la sesión esté abierta.
- Exportación del archivo final.

No incluye en este MVP:
- Resolución automática avanzada por reglas.
- Colaboración multiusuario en tiempo real.
- Comentarios por celda.
- Historial detallado de versiones.
- Integración con aprobaciones.

## 4. Arquitectura de la interfaz

La aplicación se organiza en 3 momentos principales:
1. Vista inicial de carga/selección de archivos.
2. Workspace de comparación con layout principal.
3. Flujo de guardado/exportación.

---

## 5. Vista inicial: carga o selección de archivos

### Objetivo
Ayudar al usuario a empezar sin dudas, dejando claro qué es el archivo base, cuál es el archivo comparado y qué sucede después.

### Estructura
- Encabezado con título y breve explicación.
- Dos tarjetas simétricas:
  - Archivo base.
  - Archivo comparado.
- Área de acciones principal.
- Zona de validaciones y errores.

### Contenido visible
**Título principal**
- `Comparar archivos Excel`

**Texto de apoyo**
- `Selecciona un archivo base y un archivo comparado para revisar diferencias y resolver conflictos.`

### Tarjeta 1: archivo base
**Etiqueta**
- `Archivo base`

**Descripción**
- `Usa esta versión como referencia original.`

**Botones**
- `Cargar archivo`
- `Seleccionar reciente`
- `Quitar archivo`

**Estado vacío**
- `No hay archivo base seleccionado.`

**Estado con archivo**
- Mostrar:
  - nombre del archivo,
  - fecha de modificación si está disponible,
  - tamaño,
  - hoja(s) detectadas.

### Tarjeta 2: archivo comparado
**Etiqueta**
- `Archivo comparado`

**Descripción**
- `Usa esta versión para detectar cambios frente al archivo base.`

**Botones**
- `Cargar archivo`
- `Seleccionar reciente`
- `Quitar archivo`

**Estado vacío**
- `No hay archivo comparado seleccionado.`

### Acción principal
**Botón primario**
- `Comparar archivos`

**Estado deshabilitado del botón**
- Deshabilitado hasta tener ambos archivos válidos.

**Texto auxiliar bajo el botón**
- `Solo se permiten archivos .xlsx y .xlsm.`

### Wireframe de baja fidelidad: vista inicial

```text
+----------------------------------------------------------------------------------+
| Comparar archivos Excel                                                          |
| Selecciona un archivo base y un archivo comparado para revisar diferencias       |
| y resolver conflictos.                                                           |
|                                                                                  |
| +--------------------------------+  +------------------------------------------+ |
| | Archivo base                   |  | Archivo comparado                       | |
| | Usa esta versión como          |  | Usa esta versión para detectar         | |
| | referencia original.           |  | cambios frente al archivo base.        | |
| |                                |  |                                        | |
| | [Cargar archivo]               |  | [Cargar archivo]                       | |
| | [Seleccionar reciente]         |  | [Seleccionar reciente]                 | |
| |                                |  |                                        | |
| | No hay archivo base            |  | No hay archivo comparado               | |
| | seleccionado.                  |  | seleccionado.                          | |
| +--------------------------------+  +------------------------------------------+ |
|                                                                                  |
| [Comparar archivos]                                                              |
| Solo se permiten archivos .xlsx y .xlsm.                                         |
+----------------------------------------------------------------------------------+
```

### Mensajes de error exactos en la vista inicial
- `Debes seleccionar un archivo base.`
- `Debes seleccionar un archivo comparado.`
- `El archivo seleccionado no es compatible. Usa un archivo .xlsx o .xlsm.`
- `No pudimos abrir el archivo. Verifica que no esté dañado o protegido.`
- `No pudimos comparar los archivos porque no tienen hojas válidas.`
- `El archivo base y el archivo comparado no pueden ser el mismo archivo.`
- `La carga tardó más de lo esperado. Intenta de nuevo.`

### Comportamiento recomendado
- Si falta un archivo, resaltar la tarjeta incompleta con borde de advertencia.
- Si el archivo es válido, mostrar un check visual y resumen corto.
- Al hacer clic en `Comparar archivos`, mostrar estado de progreso:
  - `Preparando comparación...`
  - `Analizando hojas...`
  - `Detectando conflictos...`

---

## 6. Layout principal del comparador

### Objetivo
Permitir revisar diferencias de manera estructurada y resolver conflictos sin perder contexto.

### Layout obligatorio del MVP
- Panel izquierdo: contenido del archivo base.
- Panel derecho: contenido del archivo comparado.
- Lista de conflictos: columna o panel dedicado de navegación y resolución.

### Distribución sugerida
- Header superior fijo.
- Subheader con navegación por hoja, filtros y contador.
- Área central con tres zonas:
  - izquierda 35%,
  - lista de conflictos 30%,
  - derecha 35%.

### Componentes del header superior
- Nombre de comparación: `Base vs comparado`
- Archivos activos resumidos.
- Botón secundario: `Cambiar archivos`
- Botón secundario: `Guardar progreso`
- Botón primario: `Exportar resultado`

### Componentes del subheader
- Selector de hoja.
- Filtros por tipo de cambio.
- Contador de conflictos pendientes.
- Navegación anterior/siguiente conflicto.

### Wireframe de baja fidelidad: layout principal

```text
+--------------------------------------------------------------------------------------------------+
| Base vs comparado                               [Cambiar archivos] [Guardar progreso] [Exportar resultado] |
+--------------------------------------------------------------------------------------------------+
| Hoja: [Clientes v]  Filtros: [Todos v] [Solo conflictos] [Solo cambios]  Pendientes: 12         |
| [Conflicto anterior] [Conflicto siguiente]                                                      |
+--------------------------------+--------------------------------+--------------------------------+
| PANEL IZQUIERDO                | LISTA DE CONFLICTOS           | PANEL DERECHO                  |
| Archivo base                   |                                | Archivo comparado              |
|                                | 1. Fila 18 / Columna D        |                                |
| Hoja: Clientes                 | Estado: Pendiente             | Hoja: Clientes                 |
| Celda D18                      | Tipo: Valor distinto          | Celda D18                      |
| Valor: "Activo"               |                                | Valor: "Inactivo"             |
|                                | [Aceptar izquierda]           |                                |
| Contexto de filas              | [Aceptar derecha]             | Contexto de filas              |
| ...                            | [Editar manualmente]          | ...                            |
|                                | [Saltar]                      |                                |
|                                | [Aplicar a selección]         |                                |
|                                |                                |                                |
|                                | 2. Fila 22 / Columna F        |                                |
|                                | Estado: Resuelto              |                                |
+--------------------------------+--------------------------------+--------------------------------+
```

---

## 7. Panel izquierdo y panel derecho

### Propósito
Mostrar cada versión con el mismo contexto visual para que la comparación sea intuitiva.

### Requisitos de ambos paneles
- Mantener encabezados de columna visibles.
- Mantener número de fila visible.
- Resaltar la celda o rango relacionado con el conflicto seleccionado.
- Scroll sincronizado por defecto entre ambos paneles cuando sea posible.
- Permitir desactivar sincronización si genera confusión en versiones futuras; para MVP puede quedar fijo.

### Encabezado interno de cada panel
**Panel izquierdo**
- `Archivo base`

**Panel derecho**
- `Archivo comparado`

### Información mínima visible por panel
- Nombre de hoja actual.
- Coordenada de celda seleccionada.
- Valor visible en la celda.
- Contexto cercano: al menos 2 filas arriba y 2 abajo cuando aplique.

### Comportamiento al seleccionar un conflicto
- Centrar automáticamente ambas vistas en la zona afectada.
- Resaltar con color fuerte la celda activa.
- Resaltar con color suave el resto del rango relacionado.

---

## 8. Lista de conflictos

### Propósito
Ser el centro de decisiones del usuario.

### Estructura de cada ítem de conflicto
Cada conflicto debe mostrar:
- índice,
- hoja,
- referencia de celda o rango,
- tipo de cambio,
- estado,
- vista resumida del valor izquierdo y derecho,
- acción principal rápida.

### Orden recomendado
- Primero conflictos pendientes.
- Después conflictos resueltos.
- Dentro de cada grupo, por orden de hoja y posición en la hoja.

### Estados posibles
- `Pendiente`
- `Resuelto`
- `Saltado`
- `Editado manualmente`

### Indicadores visibles
- Chip de estado.
- Icono de tipo de cambio.
- Marca de selección actual.

### Texto cuando no hay conflictos en la vista filtrada
- `No hay conflictos para los filtros seleccionados.`

### Texto cuando todo está resuelto
- `No quedan conflictos pendientes en esta hoja.`

---

## 9. Colores y estados visuales

### Objetivo
Hacer que el usuario identifique rápidamente qué necesita atención y qué ya fue resuelto.

### Paleta funcional sugerida
- Cambio detectado: azul.
- Conflicto pendiente: ámbar/naranja.
- Conflicto resuelto: verde.
- Cambio saltado: gris.
- Error o bloqueo: rojo.
- Selección activa: borde azul oscuro o negro fuerte.

### Reglas visuales
**Cambio detectado sin resolver**
- Fondo suave ámbar.
- Borde lateral ámbar intenso.
- Chip: `Pendiente`

**Conflicto resuelto**
- Fondo suave verde.
- Check visible.
- Chip: `Resuelto`

**Conflicto editado manualmente**
- Fondo suave violeta o azul secundario.
- Chip: `Editado manualmente`

**Conflicto saltado**
- Fondo gris claro.
- Chip: `Saltado`

**Celda con diferencia no conflictiva**
- Fondo azul claro.

**Error de validación o exportación**
- Fondo rojo suave.
- Texto de ayuda visible y accionable.

### Accesibilidad mínima
- No depender solo del color; combinar color + icono + etiqueta.
- Contraste AA en textos y chips.
- Estados hover y focus visibles para navegación con teclado.

---

## 10. Tipos de cambio y filtros

### Tipos de cambio visibles en el MVP
- `Valor distinto`
- `Fila agregada`
- `Fila eliminada`
- `Columna agregada`
- `Columna eliminada`
- `Formato distinto` (solo si el motor lo soporta desde MVP; si no, ocultar)

### Filtros por tipo de cambio
Botones/chips o menú multiselección con estas opciones exactas:
- `Todos`
- `Solo pendientes`
- `Solo resueltos`
- `Valor distinto`
- `Filas agregadas`
- `Filas eliminadas`
- `Columnas agregadas`
- `Columnas eliminadas`

### Comportamiento de filtros
- Mantener el contador total de pendientes visible aunque haya filtros activos.
- Mostrar cuántos resultados devuelve el filtro actual.
- Si un filtro deja vacía la lista, mostrar estado vacío claro.

---

## 11. Navegación por hoja y por conflicto

### Navegación por hoja
**Control**
- Dropdown o tabs si hay pocas hojas.

**Etiqueta**
- `Hoja`

**Formato del selector**
- `Hoja: [Nombre de hoja v]`

**Comportamiento**
- Al cambiar de hoja, conservar filtros activos.
- Recordar el último conflicto visitado por hoja cuando sea posible.
- Si la hoja no tiene conflictos, mostrar resumen sin lista activa.

### Navegación por conflicto
**Botones exactos**
- `Conflicto anterior`
- `Conflicto siguiente`

**Atajo opcional visible en tooltip**
- `Usa ↑ y ↓ para moverte entre conflictos.`

### Contador persistente
**Formato recomendado**
- `Pendientes: 12`

**Variantes útiles**
- `Pendientes en esta hoja: 3`
- `Resueltos: 9 de 21`

El contador principal siempre debe estar en la parte superior y visible sin scroll.

---

## 12. Acciones por conflicto

Cada conflicto debe ofrecer estas acciones exactas.

### 12.1 Aceptar izquierda
**Botón**
- `Aceptar izquierda`

**Resultado esperado**
- El valor o bloque del panel izquierdo se usa en el resultado final.
- El conflicto pasa a estado `Resuelto`.

**Feedback inmediato**
- Toast: `Se aplicó la versión del archivo base.`

### 12.2 Aceptar derecha
**Botón**
- `Aceptar derecha`

**Resultado esperado**
- El valor o bloque del panel derecho se usa en el resultado final.
- El conflicto pasa a estado `Resuelto`.

**Feedback inmediato**
- Toast: `Se aplicó la versión del archivo comparado.`

### 12.3 Editar manualmente
**Botón**
- `Editar manualmente`

**Patrón recomendado**
- Abrir editor inline o modal simple con valor editable.

**Campo**
- Etiqueta: `Valor final`

**Botones del editor**
- `Guardar cambio`
- `Cancelar`

**Resultado esperado**
- Guardar el valor escrito como resolución final.
- Estado del conflicto: `Editado manualmente`

**Errores exactos**
- `No pudimos guardar el valor ingresado.`
- `El valor final no puede estar vacío.` (solo si la lógica de negocio lo exige)

### 12.4 Saltar
**Botón**
- `Saltar`

**Resultado esperado**
- El conflicto se mantiene sin resolución definitiva.
- Se marca como revisado temporalmente o como `Saltado` según implementación.

**Feedback inmediato**
- Toast: `Conflicto saltado. Puedes resolverlo más tarde.`

### 12.5 Aplicar a selección
**Botón**
- `Aplicar a selección`

### Uso
Permite repetir una misma decisión en varios conflictos seleccionados del mismo tipo o rango compatible.

**Selección múltiple**
- Checkbox por conflicto.
- Checkbox en encabezado de lista si se desea seleccionar visibles.

**Opciones dentro de la acción**
- `Aplicar izquierda a la selección`
- `Aplicar derecha a la selección`
- `Marcar selección como saltada`

**Mensajes exactos**
- `Selecciona al menos un conflicto para aplicar esta acción.`
- `La acción se aplicó a 5 conflictos.`
- `Algunos conflictos no eran compatibles y no se modificaron.`

### Orden visual recomendado de acciones
1. `Aceptar izquierda`
2. `Aceptar derecha`
3. `Editar manualmente`
4. `Saltar`
5. `Aplicar a selección`

Motivo: priorizar acciones directas y de menor fricción antes de acciones avanzadas o masivas.

---

## 13. Mensajes de sistema, ayudas y microcopy

### Tooltips o ayudas breves
- `Archivo base: versión de referencia original.`
- `Archivo comparado: versión con cambios a revisar.`
- `Pendientes: conflictos que aún necesitan decisión.`
- `Resuelto: ya se definió qué valor se exportará.`

### Toasts sugeridos
- `Progreso guardado.`
- `No pudimos guardar el progreso.`
- `Resultado exportado correctamente.`
- `No pudimos exportar el archivo. Intenta de nuevo.`

### Confirmaciones recomendadas
Al intentar salir con conflictos sin resolver:
- Título: `Aún tienes conflictos pendientes`
- Mensaje: `Si sales ahora, el resultado final puede quedar incompleto. ¿Quieres continuar?`
- Botones: `Salir de todos modos` / `Seguir revisando`

Al reemplazar archivos ya cargados:
- Título: `Cambiar archivos`
- Mensaje: `Se perderá la comparación actual si continúas.`
- Botones: `Cambiar archivos` / `Cancelar`

---

## 14. Flujo de guardado y exportación

### Guardar progreso
Objetivo: permitir pausar y retomar sin perder resoluciones hechas.

**Botón**
- `Guardar progreso`

**Estado durante guardado**
- `Guardando progreso...`

**Éxito**
- `Progreso guardado.`

**Error**
- `No pudimos guardar el progreso.`

Si el producto aún no soporta persistencia real, el MVP puede mostrar guardado de sesión local solo si es técnicamente viable. Si no existe esta capacidad, ocultar el botón antes de liberar el MVP.

### Exportación final
**Botón principal**
- `Exportar resultado`

**Regla recomendada**
- Permitir exportar solo cuando no haya conflictos pendientes.
- Si negocio exige exportación parcial, entonces mostrar advertencia explícita.
- Antes de habilitar la exportación, recalcular el estado de la sesión para confirmar que no existan conflictos en `Pending`, validaciones fallidas ni ediciones manuales incompletas.

**Estado sin permisos de exportación por pendientes**
- Botón deshabilitado o interceptado con mensaje:
- `Debes resolver todos los conflictos antes de exportar.`

**Validaciones previas obligatorias**
- Verificar `Conflictos pendientes: 0`.
- Verificar que todas las ediciones manuales tengan valor o fórmula final guardada.
- Verificar que el libro resultado pueda generarse con las hojas seleccionadas sin errores estructurales.
- Si alguna validación falla, mostrar un resumen bloqueante con:
  - cantidad de conflictos pendientes,
  - hojas afectadas,
  - acción sugerida para continuar.

**Mensajes exactos de validación**
- `Aún tienes conflictos pendientes. Resuélvelos antes de exportar.`
- `Hay ediciones manuales sin guardar en el resultado final.`
- `No pudimos preparar el archivo final porque hay errores estructurales en la sesión.`

### Modal o paso de exportación
Campos mínimos:
- Nombre del archivo final.
- Nombre sugerido del archivo final.
- Hoja(s) incluidas si aplica.
- Resumen visible de decisiones aplicadas.
- Confirmación de reemplazo si el nombre ya existe.

**Textos exactos**
- Título: `Exportar resultado final`
- Campo: `Nombre del archivo`
- Etiqueta auxiliar: `Nombre sugerido`
- Bloque de resumen: `Resumen de esta exportación`
- Botones: `Exportar` / `Cancelar`

**Nombre sugerido del archivo**
- Formato recomendado: `{archivo-base-sin-extension}__merge__{fecha-hora-local}.xlsx`.
- Si existe una sesión nombrada, permitir usar `{nombre-sesion}__resultado.xlsx`.
- El usuario puede editar el nombre sugerido antes de confirmar.

**Resumen visible obligatorio**
- `Cambios aceptados de archivo base: N`
- `Cambios aceptados de archivo comparado: N`
- `Ediciones manuales: N`
- `Conflictos resueltos: N`
- `Hojas afectadas: Hoja1, Hoja2, ...`
- `Decisiones por tipo: aceptar izquierda, aceptar derecha, edición manual, auto-resuelto`

**Comportamiento del resumen**
- Debe mostrarse dentro del modal antes de exportar.
- Debe poder copiarse o reutilizarse como base de auditoría interna.
- Debe mantenerse visible también en la pantalla de éxito de exportación.

**Estado en progreso**
- `Generando archivo final...`
- `Preparando resumen de exportación...`

**Éxito**
- `Resultado exportado correctamente.`
- CTA adicional: `Abrir carpeta`
- CTA adicional: `Copiar resumen`

**Errores exactos**
- `Debes indicar un nombre para el archivo final.`
- `Ya existe un archivo con ese nombre.`
- `No pudimos exportar el archivo. Verifica permisos e inténtalo de nuevo.`

### Wireframe de baja fidelidad: exportación

```text
+----------------------------------------------------------+
| Exportar resultado final                                 |
|                                                          |
| Nombre del archivo                                       |
| [resultado_final.xlsx                           ]        |
| Sugerido: budget.base__merge__2026-03-23_10-45.xlsx      |
|                                                          |
| Conflictos pendientes: 0                                 |
| Cambios aceptados de archivo base: 12                    |
| Cambios aceptados de archivo comparado: 18               |
| Ediciones manuales: 3                                    |
| Conflictos resueltos: 9                                  |
| Hojas afectadas: Summary, Forecast, Input                |
| Decisiones por tipo: izq 12 / der 18 / manual 3 / auto 6 |
|                                                          |
|                     [Cancelar] [Copiar resumen] [Exportar] |
+----------------------------------------------------------+
```

---

## 15. Estados vacíos, de carga y de error

### Estado de carga inicial
- `Preparando comparación...`
- Skeleton en tarjetas o barra de progreso.

### Estado de carga del workspace
- `Cargando hojas y diferencias...`

### Estado vacío sin diferencias
- `No encontramos diferencias entre los archivos seleccionados.`
- Acción secundaria: `Exportar resultado`
- Acción secundaria opcional: `Cambiar archivos`

### Estado de error recuperable en comparación
- `No pudimos completar la comparación.`
- Botones: `Intentar de nuevo` / `Cambiar archivos`

### Estado de hoja sin conflictos
- `No hay conflictos en esta hoja.`

---

## 16. Reglas de comportamiento UX clave

- Siempre debe existir una única selección activa de conflicto.
- Al resolver un conflicto, mover automáticamente al siguiente pendiente si existe.
- Si no quedan pendientes en la hoja, mostrar resumen y sugerir cambiar de hoja.
- Las acciones deben reflejarse en tiempo real en contador, colores y lista.
- Evitar pérdida silenciosa de datos: toda acción masiva debe mostrar resumen del resultado.

---

## 17. Wireframe de flujo completo

```text
(1) INICIO
[Archivo base] + [Archivo comparado] -> [Comparar archivos]

(2) WORKSPACE
[Hoja] [Filtros] [Pendientes]
[Panel izquierdo] [Lista de conflictos] [Panel derecho]

(3) RESOLUCIÓN
[Aceptar izquierda] / [Aceptar derecha] / [Editar manualmente] / [Saltar]

(4) CIERRE
[Pendientes: 0] -> [Exportar resultado] -> [Confirmación de exportación]
```

---

## 18. Criterios de aceptación UX para el MVP

1. Un usuario no técnico entiende en menos de 30 segundos la diferencia entre `Archivo base` y `Archivo comparado`.
2. El sistema muestra siempre un contador visible de conflictos pendientes.
3. Cada conflicto puede resolverse con una de las cinco acciones pedidas.
4. El usuario puede navegar por hoja y por conflicto sin perder contexto visual.
5. Los estados `Pendiente`, `Resuelto`, `Saltado` y `Editado manualmente` son distinguibles por color, icono y etiqueta.
6. El flujo de exportación deja claro cuándo el archivo está listo para salir.
7. Todos los botones y mensajes críticos usan lenguaje simple y consistente.

---

## 19. Resumen de copy exacto obligatorio

### Botones
- `Cargar archivo`
- `Seleccionar reciente`
- `Quitar archivo`
- `Comparar archivos`
- `Cambiar archivos`
- `Guardar progreso`
- `Exportar resultado`
- `Conflicto anterior`
- `Conflicto siguiente`
- `Aceptar izquierda`
- `Aceptar derecha`
- `Editar manualmente`
- `Guardar cambio`
- `Cancelar`
- `Saltar`
- `Aplicar a selección`
- `Exportar`
- `Abrir carpeta`
- `Intentar de nuevo`
- `Salir de todos modos`
- `Seguir revisando`

### Mensajes de error
- `Debes seleccionar un archivo base.`
- `Debes seleccionar un archivo comparado.`
- `El archivo seleccionado no es compatible. Usa un archivo .xlsx o .xlsm.`
- `No pudimos abrir el archivo. Verifica que no esté dañado o protegido.`
- `No pudimos comparar los archivos porque no tienen hojas válidas.`
- `El archivo base y el archivo comparado no pueden ser el mismo archivo.`
- `La carga tardó más de lo esperado. Intenta de nuevo.`
- `No pudimos guardar el valor ingresado.`
- `Selecciona al menos un conflicto para aplicar esta acción.`
- `Debes resolver todos los conflictos antes de exportar.`
- `Debes indicar un nombre para el archivo final.`
- `Ya existe un archivo con ese nombre.`
- `No pudimos exportar el archivo. Verifica permisos e inténtalo de nuevo.`

### Mensajes de éxito o estado
- `Preparando comparación...`
- `Analizando hojas...`
- `Detectando conflictos...`
- `Se aplicó la versión del archivo base.`
- `Se aplicó la versión del archivo comparado.`
- `Conflicto saltado. Puedes resolverlo más tarde.`
- `La acción se aplicó a 5 conflictos.`
- `Progreso guardado.`
- `Resultado exportado correctamente.`
- `No hay conflictos para los filtros seleccionados.`
- `No quedan conflictos pendientes en esta hoja.`
