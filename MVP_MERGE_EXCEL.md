# MVP merge Excel: casos de uso y no-objetivos

## Propósito del documento
Este documento define el alcance inicial del **MVP merge Excel** para alinear a negocio, producto e ingeniería sobre:
- qué cambios debe detectar el sistema;
- qué se considera **conflicto celda** y qué se considera auto-resoluble;
- qué acciones debe poder ejecutar el usuario;
- qué casos límite deben contemplarse desde el inicio; y
- qué criterios de aceptación deben ser visibles para negocio y usuarios internos.

## Objetivo del MVP
Permitir comparar dos versiones de un archivo Excel y construir un resultado final asistido, mostrando diferencias relevantes y permitiendo resolver conflictos con acciones simples como **aceptar izquierda/derecha** o editar el resultado final.

## Alcance funcional del MVP

### 1. Tipos de cambio a detectar
El MVP debe detectar y presentar, como mínimo, los siguientes tipos de cambio:

#### 1.1 Nivel libro
- Archivo agregado o faltante en una comparación esperada.
- Metadatos básicos del libro que afecten la comparación.
- Cambios en estructura global del workbook cuando impliquen hojas agregadas, eliminadas o renombradas.

#### 1.2 Nivel hoja
- Hoja agregada.
- Hoja eliminada.
- Hoja renombrada.
- Hoja movida de posición cuando eso afecte la lectura del usuario.

#### 1.3 Nivel celda
- Cambio de valor en una celda.
- Celda agregada o eliminada dentro del rango usado.
- Cambio entre valor vacío y valor informado.

#### 1.4 Fórmulas
- Fórmula agregada.
- Fórmula eliminada.
- Fórmula modificada.
- Diferencia entre mostrar el valor calculado y la fórmula subyacente.
- Fórmulas inválidas o rotas detectables por Excel.

#### 1.5 Formato
- Cambios de formato relevantes para negocio, por ejemplo:
  - negrita, cursiva o subrayado;
  - color de fondo o color de fuente;
  - formato numérico;
  - bordes básicos.
- No es necesario en el MVP cubrir todos los atributos de estilo de Excel si no impactan decisiones del usuario.

#### 1.6 Filas y columnas
- Filas agregadas o eliminadas.
- Columnas agregadas o eliminadas.
- Cambios que desplacen celdas y alteren el mapeo esperado.
- Ocultamiento o visibilidad de filas/columnas si impacta la lectura comparativa.

#### 1.7 Tablas
- Tabla agregada o eliminada.
- Cambios en estructura de tabla (columnas, encabezados, rangos).
- Cambios dentro de celdas pertenecientes a una tabla.

## Definiciones operativas: conflicto vs cambio auto-resoluble

### 2. Qué se considera conflicto
Se considera **conflicto** todo caso donde el sistema no puede decidir de forma segura qué versión debe prevalecer en el resultado final.

Ejemplos de conflicto:
- La misma celda tiene valores distintos a izquierda y derecha y no existe regla determinística aprobada.
- La misma celda tiene fórmulas distintas a izquierda y derecha.
- Un lado elimina una fila/columna y el otro modifica contenido dentro de esa misma fila/columna.
- Una hoja fue renombrada en un lado y modificada estructuralmente de forma incompatible en el otro.
- Existen cambios de formato y contenido simultáneos sobre el mismo rango y ambos son significativos.
- Una tabla cambia de estructura en ambos lados de forma incompatible.

### 3. Qué se considera cambio auto-resoluble
Se considera **cambio auto-resoluble** todo caso donde el sistema puede aplicar una decisión segura y explicable sin pedir intervención manual.

Ejemplos de cambio auto-resoluble:
- Un elemento existe solo en un lado porque fue agregado allí y el otro lado no lo tocó.
- Un lado modifica formato y el otro no realizó ningún cambio sobre ese mismo alcance.
- Una hoja fue agregada en un lado y no existe evidencia de conflicto de identidad con otra hoja.
- Una fila o columna fue agregada en un lado y no colisiona con cambios del otro lado.
- Una celda pasa de vacía a informada en un solo lado y el otro lado se mantiene sin cambios.

### 4. Regla de transparencia
Todo cambio auto-resoluble debe quedar visible como decisión aplicada por el sistema, para que negocio y usuarios internos entiendan:
- qué se resolvió automáticamente;
- con qué regla; y
- cómo revertirlo si fuera necesario.

## Acciones de usuario permitidas
El MVP debe permitir las siguientes acciones explícitas:

### 5. Resolver por lado
- **Aceptar izquierda** para aplicar la versión izquierda al resultado final.
- **Aceptar derecha** para aplicar la versión derecha al resultado final.

Estas acciones deben existir al menos para:
- conflicto celda;
- conflicto de rango simple;
- bloques homogéneos de cambios.

### 6. Editar resultado final
- El usuario debe poder editar manualmente el valor o fórmula final del resultado.
- La edición manual debe marcar el ítem como resuelto manualmente.
- Debe quedar claro que el valor final ya no coincide exactamente con izquierda ni derecha.

### 7. Deshacer
- El usuario debe poder deshacer la última acción.
- Idealmente debe poder deshacer múltiples acciones dentro de la sesión actual.
- Deshacer debe cubrir tanto **aceptar izquierda/derecha** como edición manual y aplicación por bloque.

### 8. Aplicar por bloque
- El usuario debe poder aplicar una misma decisión sobre un conjunto agrupado de diferencias.
- Ejemplos:
  - aceptar derecha para todas las celdas cambiadas en una fila;
  - aceptar izquierda para una hoja completa agregada o eliminada;
  - aceptar una decisión sobre un bloque continuo de celdas.

## Casos de uso principales del MVP

### 9. Casos de uso esperados
1. **Comparar dos libros y listar diferencias relevantes**.
2. **Resolver un conflicto celda** eligiendo aceptar izquierda/derecha.
3. **Aplicar una resolución masiva** sobre un bloque simple de cambios homogéneos.
4. **Editar el resultado final** cuando ninguna de las dos versiones sea suficiente.
5. **Revisar cambios auto-resueltos** antes de exportar o guardar el resultado.
6. **Generar un archivo final** con las decisiones aplicadas.

## No-objetivos del MVP
Los siguientes puntos quedan explícitamente fuera del MVP, salvo que negocio los priorice después:
- Colaboración multiusuario en tiempo real.
- Reglas avanzadas configurables por cliente o por dominio.
- Cobertura total de todos los formatos, estilos, macros y objetos embebidos de Excel.
- Soporte completo y confiable para todos los gráficos, comentarios, validaciones, slicers y objetos flotantes.
- Resolución semántica inteligente de fórmulas complejas más allá de reglas básicas y transparentes.
- Integración con flujos empresariales externos, aprobaciones o auditoría avanzada.
- Comparación y merge de más de dos versiones simultáneamente.
- Detección perfecta de intención del usuario en cambios estructurales complejos.

## Casos límite a considerar desde el inicio

### 10. Hojas renombradas
- El sistema debe intentar distinguir entre hoja renombrada y hoja eliminada + hoja nueva.
- Si la identidad no es suficientemente confiable, debe marcarse como conflicto estructural.

### 11. Celdas combinadas
- Las celdas combinadas pueden romper el mapeo simple por coordenadas.
- El MVP debe al menos detectarlas y tratarlas como caso especial visible.
- Si impiden una resolución segura, deben elevarse a conflicto.

### 12. Fórmulas rotas
- Si una fórmula devuelve error o referencia inválida, el sistema debe mostrarlo explícitamente.
- Si la fórmula rota aparece solo en un lado, no debe auto-resolverse sin visibilidad.

### 13. Tablas dinámicas
- Las tablas dinámicas deben tratarse como objeto especial de soporte limitado.
- En el MVP puede bastar con detectar su presencia y advertir soporte parcial.
- Si una diferencia dentro de una tabla dinámica no puede explicarse con seguridad, debe marcarse como no soportada o conflictiva.

### 14. Archivos grandes
- El sistema debe seguir siendo usable con archivos grandes, aunque el MVP puede imponer límites operativos claros.
- Deben definirse umbrales visibles, por ejemplo:
  - cantidad máxima de hojas;
  - cantidad máxima de celdas utilizadas;
  - tiempo objetivo de carga/comparación.
- Si el archivo excede el alcance soportado, el sistema debe informar el motivo de forma entendible.

## Criterios de aceptación visibles para negocio y usuarios internos

### 15. Criterios funcionales
- El usuario puede identificar claramente qué cambió en libro, hoja, celda, fórmula, formato, fila/columna y tablas.
- El usuario puede distinguir entre cambio auto-resoluble y conflicto.
- El usuario puede ejecutar **aceptar izquierda/derecha** sobre una diferencia individual.
- El usuario puede editar el resultado final en al menos conflictos de celda o fórmula simple.
- El usuario puede deshacer acciones recientes.
- El usuario puede aplicar una decisión por bloque en escenarios simples.

### 16. Criterios de experiencia
- La interfaz usa términos comprensibles y consistentes, incluyendo: **MVP merge Excel**, **conflicto celda**, **aceptar izquierda/derecha**.
- Las diferencias auto-resueltas quedan visibles y auditables dentro de la sesión.
- Los conflictos pendientes quedan resaltados y no se confunden con cambios ya resueltos.
- El estado final deja claro si el archivo está listo para exportar o si quedan conflictos por resolver.

### 17. Criterios operativos
- El sistema no bloquea ni falla silenciosamente ante hojas renombradas, celdas combinadas, fórmulas rotas, tablas dinámicas o archivos grandes.
- Cuando un caso no está soportado por el MVP, el sistema lo comunica explícitamente.
- El resultado final exportado refleja exactamente las decisiones visibles del usuario.

## Supuestos para iteraciones futuras
- En futuras versiones podrán agregarse reglas de auto-resolución configurables.
- También podrá ampliarse la cobertura de objetos complejos de Excel.
- La prioridad del MVP es claridad de resolución, no cobertura absoluta del formato Excel.
