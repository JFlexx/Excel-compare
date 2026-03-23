# MVP merge Excel: subconjunto piloto realmente entregable

## Propósito del documento
Este documento redefine el alcance del **MVP merge Excel** para dejar un piloto que sí pueda entregarse con un nivel razonable de confianza, **sin depender de soporte total de Excel**.

La prioridad de este piloto es:
- resolver casos frecuentes y comprensibles para usuarios internos;
- bloquear con mensajes claros los casos fuera de alcance;
- mantener trazabilidad de decisiones; y
- evitar prometer compatibilidad total con estructuras avanzadas de Excel.

## Objetivo del piloto
Permitir comparar dos versiones de un archivo Excel y construir un resultado final asistido para un subconjunto acotado de escenarios, mostrando diferencias relevantes y permitiendo resolverlas con acciones simples como **aceptar izquierda**, **aceptar derecha** o **editar manualmente** cuando el caso sea básico.

## Definición del subconjunto piloto

### 1. Casos que sí entran en el piloto
El piloto cubre únicamente estos escenarios.

#### 1.1 Cambios de valor
- Cambio de valor en una celda existente en ambos lados.
- Cambio entre celda vacía y celda informada cuando el mapeo por coordenada es claro.
- Cambios simples de texto, número, fecha o booleano visibles como diferencia celda a celda.

#### 1.2 Fórmulas simples
- Fórmula agregada, eliminada o modificada en una celda individual.
- Fórmulas lineales o aritméticas simples cuya representación puede mostrarse de forma transparente.
- Edición manual básica del resultado final cuando el conflicto sigue siendo de una sola celda y el usuario ingresa un valor o una fórmula simple.

#### 1.3 Hojas agregadas o eliminadas sencillas
- Hoja agregada en un solo lado cuando no hay duda de identidad.
- Hoja eliminada en un solo lado cuando no hay duda de identidad.
- Aplicación de **aceptar izquierda/derecha** para conservar o descartar una hoja completa en estos casos simples.

#### 1.4 Resolución manual básica
- **Aceptar izquierda** y **aceptar derecha** por diferencia individual.
- **Aceptar izquierda** y **aceptar derecha** por bloque homogéneo simple.
- **Editar manualmente** solo para conflictos de valor o fórmulas simples de una sola celda.
- **Deshacer** de decisiones tomadas durante la sesión actual.

## 2. Casos que quedan explícitamente fuera del piloto
Los siguientes casos deben considerarse **no soportados** en esta versión y deben bloquear la comparación o marcar el archivo como fuera de alcance:
- macros y código VBA;
- tablas dinámicas complejas;
- objetos embebidos o flotantes, incluidos gráficos, imágenes ancladas, comentarios enriquecidos o controles;
- formatos avanzados o estilos cuyo merge requiera semántica propia de Excel;
- casos estructurales ambiguos, por ejemplo renombrados dudosos, desplazamientos complejos, celdas combinadas que rompan el mapeo o cambios simultáneos incompatibles.

## 3. Reglas operativas del piloto

### 3.1 Qué se considera conflicto dentro del piloto
Se considera **conflicto** todo caso soportado donde el sistema no puede decidir automáticamente qué versión debe prevalecer.

Ejemplos:
- La misma celda tiene valores distintos a izquierda y derecha.
- La misma celda tiene fórmulas simples distintas a izquierda y derecha.
- Una hoja agregada o eliminada sencilla requiere decisión de conservación.

### 3.2 Qué se considera fuera de alcance
Se considera **fuera de alcance del piloto** todo caso donde el sistema detecta una estructura o característica que impediría una resolución segura y explicable.

Ejemplos:
- El archivo contiene macros.
- El cambio ocurre dentro de una tabla dinámica compleja.
- Hay objetos embebidos relevantes en el rango afectado.
- El caso depende de merge de formato avanzado.
- No puede determinarse con confianza si una hoja fue renombrada, movida o reemplazada.

### 3.3 Regla de transparencia
Toda auto-resolución o bloqueo debe quedar explicada con una regla visible para el usuario interno, producto y soporte. El piloto no debe fallar en silencio ni intentar “adivinar” intención estructural compleja.

## 4. Implicaciones obligatorias para UI y mensajes de error
Estas restricciones no pueden quedar solo en documentación.

La UI del piloto debe mostrar explícitamente:
- un banner o bloque de **alcance del piloto** en carga y workspace;
- los tipos de cambio soportados: **valor**, **fórmula simple**, **hoja agregada**, **hoja eliminada**;
- que la edición manual está limitada a **valor o fórmula simple**;
- que exportar solo es posible cuando no quedan conflictos soportados pendientes y no hay bloqueos por casos fuera del piloto.

Mensajes mínimos obligatorios:
- `Este archivo queda fuera del piloto. Solo admitimos cambios de valor, fórmulas simples y hojas agregadas o eliminadas de forma sencilla.`
- `Detectamos macros, tablas dinámicas complejas, objetos embebidos o formatos avanzados. Este caso no está soportado en el piloto.`
- `La estructura del libro es ambigua para este piloto. Revisa hojas renombradas, celdas combinadas o movimientos complejos antes de volver a intentar.`
- `La edición manual básica solo está disponible para valores y fórmulas simples.`

## 5. Ajustes requeridos en tests y ejemplos
Los tests y ejemplos del repositorio deben concentrarse en este slice concreto.

### 5.1 Tests mínimos del piloto
- Caso de cambio simple de valor.
- Caso de fórmula simple editable manualmente.
- Caso de hoja agregada sencilla.
- Caso de hoja eliminada sencilla.
- Caso bloqueado por característica fuera del piloto.
- Caso bloqueado por estructura ambigua.

### 5.2 Ejemplos de referencia
Los ejemplos de UI, payloads y sesiones deben usar nomenclatura y conflictos del piloto, evitando escenarios que sugieran soporte de formatos avanzados, macros o tablas dinámicas complejas.

## 6. Definición de “pilot ready”

### 6.1 Producto
El piloto está **product ready** cuando:
- el alcance soportado y no soportado está visible en la UI;
- el flujo principal permite cargar, comparar, resolver y exportar en casos soportados;
- la exportación se bloquea de forma entendible ante conflictos pendientes o casos fuera de alcance;
- la edición manual básica funciona solo en el slice definido;
- los textos y estados no prometen compatibilidad general con Excel.

### 6.2 Negocio
El piloto está **business ready** cuando:
- existe una promesa comercial y operativa explícita basada en este subconjunto;
- se validó con ejemplos reales de cambios de valor, fórmulas simples y hojas agregadas/eliminadas sencillas;
- el usuario interno entiende qué puede resolver solo y qué debe reenviar o corregir fuera del sistema;
- hay criterios de éxito medibles, por ejemplo tasa de comparación exitosa dentro del slice y porcentaje de exportaciones sin intervención de soporte.

### 6.3 Soporte
El piloto está **support ready** cuando:
- cada bloqueo muestra causa entendible y siguiente paso sugerido;
- existe telemetría mínima para identificar archivo, hoja, operación y motivo de bloqueo;
- soporte dispone de una lista corta de casos aceptados vs no aceptados;
- soporte puede distinguir entre error técnico, límite operativo y caso fuera del piloto sin inspeccionar stack traces ni detalles internos.

## 7. Criterios de aceptación visibles
- El usuario ve claramente qué casos admite el piloto y cuáles no.
- La lista de diferencias usa solo tipos de cambio que el piloto realmente resuelve.
- La UI impide editar manualmente conflictos estructurales o fuera de alcance.
- Los errores usan lenguaje de negocio y no exponen detalles técnicos crudos.
- El resultado exportado refleja exactamente las decisiones visibles del usuario dentro del alcance soportado.

## 8. Decisión de producto para esta iteración
La prioridad del MVP/piloto es **claridad y confiabilidad sobre cobertura**. Si un caso no entra con seguridad en el subconjunto anterior, debe tratarse como **no soportado en el piloto**.
