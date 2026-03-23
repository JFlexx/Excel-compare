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
- `Solo pendientes`
- `Solo resueltos`
- `Valor distinto`
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
