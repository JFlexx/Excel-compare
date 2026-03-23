# Especificación UX del MVP para usuarios internos no técnicos

## 1. Objetivo del piloto
Permitir que una persona interna sin conocimientos técnicos compare dos archivos Excel, revise diferencias dentro de un subconjunto acotado y exporte un archivo final consolidado **solo cuando el caso entra en el piloto**.

El piloto no debe transmitir que soporta Excel de forma completa. La UX debe dejar claro desde el inicio qué escenarios están soportados y cuáles no.

## 2. Perfil de usuario
- Perfil: operaciones, finanzas, administración, back office o soporte.
- Nivel técnico: básico.
- Necesidad principal: identificar rápido qué cambió y decidir qué versión conservar.
- Restricción clave: necesita mensajes claros cuando un archivo queda fuera del piloto.

## 3. Alcance funcional visible en UX

### Incluye en este piloto
- Carga de archivo base y archivo comparado.
- Visualización lado a lado del contenido soportado.
- Lista de diferencias navegable.
- Resolución por conflicto con `Aceptar izquierda` y `Aceptar derecha`.
- Edición manual básica solo para:
  - cambios de valor;
  - fórmulas simples de una sola celda.
- Hojas agregadas o eliminadas de forma sencilla.
- Exportación del archivo final cuando no quedan pendientes ni bloqueos.

### Queda fuera del piloto
- Macros o VBA.
- Tablas dinámicas complejas.
- Objetos embebidos o flotantes.
- Formatos avanzados.
- Casos estructurales ambiguos.

## 4. Principios UX
- Lenguaje simple y orientado a tareas.
- Jerarquía visual clara entre archivos, hojas y conflictos.
- El alcance del piloto debe estar visible sin que el usuario tenga que abrir documentación.
- Si un caso no está soportado, la interfaz debe bloquearlo con una causa entendible y un siguiente paso sugerido.
- Mantener siempre visible cuántos conflictos quedan pendientes.

## 5. Arquitectura de la interfaz
La aplicación se organiza en 3 momentos principales:
1. Vista inicial de carga/selección de archivos.
2. Workspace de comparación con layout principal.
3. Flujo de guardado/exportación.

## 6. Vista inicial: carga o selección de archivos

### Objetivo
Ayudar al usuario a empezar sin dudas, dejando claro qué es el archivo base, cuál es el archivo comparado y qué puede resolver el piloto.

### Estructura obligatoria
- Encabezado con título y breve explicación.
- Banner visible de **alcance del piloto**.
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

**Banner obligatorio de alcance**
- Título: `Alcance del piloto`
- Texto base: `Este piloto solo admite cambios de valor, fórmulas simples y hojas agregadas o eliminadas de forma sencilla.`
- Lista de casos fuera de alcance:
  - `Macros y VBA`
  - `Tablas dinámicas complejas`
  - `Objetos embebidos`
  - `Formatos avanzados`
  - `Casos estructurales ambiguos`

### Tarjetas de archivo
**Archivo base**
- Etiqueta: `Archivo base`
- Descripción: `Usa esta versión como referencia original.`

**Archivo comparado**
- Etiqueta: `Archivo comparado`
- Descripción: `Usa esta versión para detectar cambios frente al archivo base.`

**Estado con archivo**
- nombre del archivo,
- fecha de modificación si está disponible,
- tamaño,
- hojas detectadas,
- resultado de validación rápida del piloto.

### Acción principal
**Botón primario**
- `Comparar archivos`

**Texto auxiliar bajo el botón**
- `Solo se permiten archivos .xlsx y .xlsm.`

### Mensajes de error exactos en la vista inicial
- `Debes seleccionar un archivo base.`
- `Debes seleccionar un archivo comparado.`
- `El archivo seleccionado no es compatible. Usa un archivo .xlsx o .xlsm.`
- `No pudimos abrir el archivo. Verifica que no esté dañado o protegido.`
- `Este archivo queda fuera del piloto. Solo admitimos cambios de valor, fórmulas simples y hojas agregadas o eliminadas de forma sencilla.`
- `Detectamos macros, tablas dinámicas complejas, objetos embebidos o formatos avanzados. Este caso no está soportado en el piloto.`
- `La estructura del libro es ambigua para este piloto. Revisa hojas renombradas, celdas combinadas o movimientos complejos antes de volver a intentar.`
- `No pudimos comparar los archivos porque no tienen hojas válidas.`
- `El archivo base y el archivo comparado no pueden ser el mismo archivo.`
- `La carga tardó más de lo esperado. Intenta de nuevo.`

### Comportamiento recomendado
- Si falta un archivo, resaltar la tarjeta incompleta con borde de advertencia.
- Si el archivo es válido, mostrar un check visual y resumen corto.
- Si el archivo está fuera del piloto, mostrar un bloqueo rojo antes de habilitar la comparación.
- Al hacer clic en `Comparar archivos`, mostrar estado de progreso:
  - `Preparando comparación...`
  - `Analizando hojas...`
  - `Detectando conflictos...`

## 7. Layout principal del comparador

### Objetivo
Permitir revisar diferencias de manera estructurada y resolver conflictos sin perder contexto, dejando visible qué tipo de decisiones soporta el piloto.

### Layout obligatorio del MVP
- Panel izquierdo: contenido del archivo base.
- Panel derecho: contenido del archivo comparado.
- Lista de conflictos: columna o panel dedicado de navegación y resolución.
- Banner superior persistente con el alcance del piloto.

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
- Contador resumido siempre visible con total y pendientes.

### Filtros obligatorios en la lista
La lista de conflictos debe soportar, como mínimo, estos filtros combinables:
- `Hoja`
- `Tipo de cambio`
- `Estado`

### Valores exactos de filtro por estado
- `Todos`
- `Pendientes`
- `Resueltos`

### Comportamiento de filtrado
- Los filtros deben poder combinarse sin perder la selección activa si el conflicto sigue visible.
- El filtro por hoja debe actualizar tanto la lista como el contador contextual de la hoja.
- El filtro por tipo de cambio debe admitir selección única o múltiple según el componente elegido.
- El filtro por estado pendiente/resuelto debe aplicarse también a acciones masivas para evitar operar sobre conflictos ocultos por error.

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
### Banner persistente obligatorio
- `Piloto acotado: valor, fórmula simple, hoja agregada y hoja eliminada.`
- `La edición manual básica solo está disponible para valores y fórmulas simples.`
- Enlace o acción secundaria opcional: `Ver alcance del piloto`

## 8. Tipos de cambio visibles y filtros
La UI no debe mostrar categorías que el piloto todavía no resuelve.

### Tipos de cambio visibles en el piloto
- `Valor distinto`
- `Fórmula simple distinta`
- `Hoja agregada`
- `Hoja eliminada`

### Filtros por tipo de cambio
- `Todos`
- `Valor distinto`
- `Filas agregadas`
- `Filas eliminadas`
- `Columnas agregadas`
- `Columnas eliminadas`

### Filtros por hoja
- Dropdown con opción `Todas las hojas` seguida del listado de hojas con conflictos.
- Cada opción puede mostrar un contador contextual, por ejemplo `Summary (3 pendientes)`.

### Filtros por estado
Control independiente del tipo de cambio con estas opciones exactas:
- `Todos`
- `Pendientes`
- `Resueltos`

### Comportamiento de filtros
- Mantener el contador total de pendientes visible aunque haya filtros activos.
- Mantener visible el contador total de conflictos.
- Mostrar cuántos resultados devuelve el filtro actual.
- Mostrar cuántos conflictos pendientes quedan dentro de la vista actual filtrada.
- Si un filtro deja vacía la lista, mostrar estado vacío claro.

---

## 11. Navegación por hoja y por conflicto

### Navegación por hoja
**Control**
- Dropdown o tabs si hay pocas hojas.
- `Fórmula simple distinta`
- `Hojas agregadas`
- `Hojas eliminadas`

### Tipos que no deben aparecer como resolubles
- `Formato distinto`
- `Tabla dinámica`
- `Macro`
- `Objeto embebido`
- `Cambio estructural complejo`

Si alguno de esos tipos se detecta, debe salir del flujo normal y mostrarse como **bloqueo por caso fuera del piloto**.

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
- `Conflictos: 21`

**Variantes útiles**
- `Pendientes en esta hoja: 3`
- `Resueltos: 9 de 21`
- `Mostrando: 4 de 21`
## 9. Lista de conflictos
Cada ítem debe mostrar:
- índice,
- hoja,
- referencia de celda o nombre de hoja,
- tipo de cambio,
- estado,
- resumen de valor izquierdo y derecho,
- acción principal rápida.

### Estados posibles
- `Pendiente`
- `Resuelto`
- `Editado manualmente`
- `Bloqueado por alcance`

### Estado vacío
- `No hay conflictos para los filtros seleccionados.`

### Texto cuando todo está resuelto en una hoja
- `No quedan conflictos pendientes en esta hoja.`

## 10. Acciones por conflicto

### Acciones soportadas
- `Aceptar izquierda`
- `Aceptar derecha`
- `Editar manualmente`
- `Guardar cambio`
- `Cancelar`

### Restricción obligatoria en edición manual
La edición manual básica:
- solo aplica a una celda;
- solo aplica a valor o fórmula simple;
- no aplica a hojas agregadas/eliminadas ni a casos estructurales.

### Mensajes exactos
- `Se aplicó la versión del archivo base.`
- `Se aplicó la versión del archivo comparado.`
- `La edición manual básica solo está disponible para valores y fórmulas simples.`
- `No pudimos guardar el valor ingresado.`
- `El valor final no puede estar vacío.`
- `Las fórmulas manuales deben empezar por '='.`

**Opciones dentro de la acción**
- `Aplicar izquierda a la selección`
- `Aplicar derecha a la selección`
- `Marcar selección como saltada`
- `Marcar selección como resuelta`

### 12.6 Acciones masivas controladas
Además de la selección manual, el MVP debe ofrecer acciones masivas predefinidas para casos simples:

#### Aceptar izquierda para cambios no conflictivos
- Acción disponible solo cuando el subconjunto seleccionado o filtrado contiene cambios auto-resolubles o no conflictivos.
- Etiqueta sugerida: `Aceptar izquierda en no conflictivos`
- Debe indicar cuántas celdas se verán afectadas antes de ejecutar.

#### Aceptar derecha para una hoja completa
- Acción disponible desde el contexto de hoja.
- Etiqueta sugerida: `Aceptar derecha en la hoja`
- Debe limitarse a la hoja actualmente visible o seleccionada en el filtro.

#### Marcar bloque como resuelto tras revisión
- Acción disponible para rangos continuos o bloques homogéneos revisados por el usuario.
- Etiqueta sugerida: `Marcar bloque como resuelto`
- Debe exigir que el bloque esté claramente delimitado y resaltado antes de confirmar.

### Confirmación obligatoria para acciones masivas
Cuando una acción afecte a múltiples celdas, filas, columnas o conflictos, debe mostrarse una confirmación explícita.

**Regla**
- Pedir confirmación siempre que la acción afecte a más de 1 celda/conflicto.

**Contenido mínimo de la confirmación**
- Título con la acción: por ejemplo `Confirmar acción masiva`
- Resumen de alcance: hoja, bloque o filtro aplicado.
- Número de conflictos o celdas afectadas.
- Advertencia de reversibilidad si existe soporte de deshacer.

**Ejemplos de mensajes**
- `Vas a aceptar la versión izquierda en 18 cambios no conflictivos.`
- `Vas a aceptar la versión derecha en toda la hoja "Summary" (42 celdas).`
- `Vas a marcar 12 celdas del bloque B4:D7 como resueltas tras revisión.`

**Botones**
- `Confirmar`
- `Cancelar`

**Mensajes exactos**
- `Selecciona al menos un conflicto para aplicar esta acción.`
- `La acción se aplicó a 5 conflictos.`
- `Algunos conflictos no eran compatibles y no se modificaron.`
- `Debes confirmar la acción masiva antes de continuar.`

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
Al ejecutar una acción masiva sobre múltiples celdas o conflictos:
- Título: `Confirmar acción masiva`
- Mensaje: `Esta acción modificará múltiples celdas. Revisa el alcance antes de continuar.`
- Botones: `Confirmar` / `Cancelar`

Al intentar salir con conflictos sin resolver:
- Título: `Aún tienes conflictos pendientes`
- Mensaje: `Si sales ahora, el resultado final puede quedar incompleto. ¿Quieres continuar?`
- Botones: `Salir de todos modos` / `Seguir revisando`
## 11. Mensajes de sistema para casos fuera del piloto

### Banner de bloqueo por alcance
- Título: `Este caso queda fuera del piloto`
- Cuerpo: `Detectamos un tipo de contenido o una estructura que este piloto todavía no puede resolver de forma confiable.`

### Motivos que deben poder explicarse
- `Detectamos macros, tablas dinámicas complejas, objetos embebidos o formatos avanzados. Este caso no está soportado en el piloto.`
- `La estructura del libro es ambigua para este piloto. Revisa hojas renombradas, celdas combinadas o movimientos complejos antes de volver a intentar.`
- `Este archivo queda fuera del piloto. Solo admitimos cambios de valor, fórmulas simples y hojas agregadas o eliminadas de forma sencilla.`

### Acción sugerida
- `Ver cómo resolverlo`
- `Cambiar archivos`
- `Revisar estructura`
- `Ver alcance del piloto`

## 12. Guardado y exportación

### Guardar progreso
**Botón**
- `Guardar progreso`

**Éxito**
- `Progreso guardado.`

**Error**
- `No pudimos guardar el progreso.`

### Exportación final
**Botón principal**
- `Exportar resultado`

### Regla obligatoria
Permitir exportar solo cuando:
- no haya conflictos pendientes;
- no existan bloqueos por casos fuera del piloto;
- no haya ediciones manuales incompletas.

### Mensajes exactos de validación
- `Debes resolver todos los conflictos antes de exportar.`
- `Aún tienes conflictos pendientes. Resuélvelos antes de exportar.`
- `Hay ediciones manuales sin guardar en el resultado final.`
- `No pudimos preparar el archivo final porque hay errores estructurales en la sesión.`
- `No puedes exportar mientras exista un caso fuera del piloto sin resolver fuera del sistema.`

### Resumen visible obligatorio en exportación
- `Cambios aceptados de archivo base: N`
- `Cambios aceptados de archivo comparado: N`
- `Ediciones manuales: N`
- `Conflictos resueltos: N`
- `Hojas afectadas: Hoja1, Hoja2, ...`
- `Decisiones por tipo: aceptar izquierda, aceptar derecha, edición manual`
- `Casos bloqueados por alcance: N`

## 13. Estados vacíos, de carga y de error
- `Preparando comparación...`
- `Cargando hojas y diferencias...`
- `No encontramos diferencias entre los archivos seleccionados.`
- `No hay conflictos en esta hoja.`
- `No pudimos completar la comparación.`

---

## 16. Reglas de comportamiento UX clave

- Siempre debe existir una única selección activa de conflicto.
- Al resolver un conflicto, mover automáticamente al siguiente pendiente si existe.
- Si no quedan pendientes en la hoja, mostrar resumen y sugerir cambiar de hoja.
- Las acciones deben reflejarse en tiempo real en contador, colores y lista.
- Evitar pérdida silenciosa de datos: toda acción masiva debe mostrar resumen del resultado.
- Toda acción masiva con más de un elemento afectado debe requerir confirmación explícita antes de aplicarse.

---

## 17. Wireframe de flujo completo

```text
(1) INICIO
[Archivo base] + [Archivo comparado] -> [Comparar archivos]

(2) WORKSPACE
[Hoja] [Filtros] [Conflictos: 21] [Pendientes: 12]
[Panel izquierdo] [Lista de conflictos] [Panel derecho]

(3) RESOLUCIÓN
[Aceptar izquierda] / [Aceptar derecha] / [Editar manualmente] / [Saltar]

(4) CIERRE
[Pendientes: 0] -> [Exportar resultado] -> [Confirmación de exportación]
```

---

## 18. Criterios de aceptación UX para el MVP

1. Un usuario no técnico entiende en menos de 30 segundos la diferencia entre `Archivo base` y `Archivo comparado`.
2. El sistema muestra siempre un contador visible en la cabecera de trabajo, sin requerir scroll.
3. El sistema muestra siempre un contador visible de conflictos totales y pendientes.
4. La lista de conflictos permite filtrar por hoja, tipo de cambio y estado pendiente/resuelto.
5. Cada conflicto puede resolverse con una de las acciones pedidas y existen acciones masivas controladas para casos simples.
6. Toda acción masiva que afecte a múltiples celdas pide confirmación explícita antes de ejecutarse.
7. El usuario puede navegar por hoja y por conflicto sin perder contexto visual.
8. Los estados `Pendiente`, `Resuelto`, `Saltado` y `Editado manualmente` son distinguibles por color, icono y etiqueta.
9. El flujo de exportación deja claro cuándo el archivo está listo para salir.
10. Todos los botones y mensajes críticos usan lenguaje simple y consistente.

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
- `Aceptar izquierda en no conflictivos`
- `Aceptar derecha en la hoja`
- `Marcar bloque como resuelto`
- `Confirmar`
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
- `Debes confirmar la acción masiva antes de continuar.`
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
- `Conflictos: 21`
- `Pendientes: 12`
- `Progreso guardado.`
- `Resultado exportado correctamente.`
- `No hay conflictos para los filtros seleccionados.`
- `No quedan conflictos pendientes en esta hoja.`
## 14. Criterios de aceptación UX para el piloto
1. Un usuario no técnico entiende en menos de 30 segundos qué casos soporta el piloto.
2. La UI deja visible el alcance soportado en la carga y en el workspace.
3. Cada conflicto soportado puede resolverse con `Aceptar izquierda`, `Aceptar derecha` o edición manual básica cuando corresponda.
4. La edición manual no aparece como opción válida para casos estructurales o fuera de alcance.
5. Los casos no soportados bloquean el flujo con un mensaje exacto y accionable.
6. El flujo de exportación deja claro cuándo el archivo está listo para salir y cuándo no por límites del piloto.

## 15. Definición UX de “pilot ready”

### Producto
- El banner de alcance está implementado en las pantallas clave.
- No se muestran tipos de conflicto que el piloto no pueda resolver.
- La exportación está protegida por validaciones del slice piloto.

### Negocio
- La UX explica el alcance sin depender de onboarding manual.
- Los mensajes de error no prometen soporte completo de Excel.
- El usuario puede completar el flujo principal en escenarios reales del slice.

### Soporte
- Cada bloqueo deja ver el motivo y el siguiente paso.
- El soporte puede identificar rápidamente si se trata de un caso fuera del piloto o de un error operativo.
- La UI entrega suficiente contexto para pedir al usuario una versión simplificada del archivo cuando aplique.
