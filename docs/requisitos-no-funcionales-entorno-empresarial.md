# Requisitos no funcionales para despliegue empresarial de Excel Compare

## 1. Objetivo del documento

Este documento define los requisitos no funcionales mínimos que deben validarse antes de seleccionar de forma definitiva:

- el modelo de add-in de Office,
- la necesidad o no de backend corporativo,
- el método de despliegue interno,
- y la estrategia de soporte, seguridad y operación.

Su función es actuar como filtro de viabilidad para evitar decisiones técnicas incompatibles con las políticas de TI, seguridad, cumplimiento y operación del entorno empresarial.

---

## 2. Alcance

Estos requisitos aplican a cualquier solución de comparación de archivos Excel utilizada por personal interno, terceros autorizados o equipos de soporte dentro del entorno corporativo.

Incluye:

- ejecución en Microsoft Excel de escritorio para Windows,
- ejecución en Microsoft 365 con identidad corporativa,
- ejecución en Excel para Mac cuando sea un requisito real de negocio,
- almacenamiento temporal o persistente de archivos y resultados,
- trazabilidad de decisiones del usuario sobre conflictos o diferencias,
- integración con servicios internos o cloud aprobados por la organización.

No cubre todavía el diseño funcional detallado ni la implementación concreta del producto; define únicamente criterios de aceptación no funcionales previos a la decisión de arquitectura.

---

## 3. Versiones objetivo de Excel

### 3.1 Prioridad de plataformas

La compatibilidad objetivo deberá definirse con el siguiente orden de prioridad:

1. **Excel Desktop para Windows** como plataforma principal.
2. **Excel incluido en Microsoft 365 con identidad corporativa** como entorno base de licenciamiento y gestión.
3. **Excel para Mac** solo si existe una necesidad explícita de usuarios de negocio o directivos que deban operar la solución sin alternativa aceptable.

### 3.2 Versiones mínimas objetivo

#### Windows Desktop

Se considerará soporte objetivo para una de estas combinaciones aprobadas por TI:

- **Opción preferente:** Excel para Microsoft 365 Apps for enterprise, canal corporativo soportado por la organización.
- **Opción alternativa controlada:** Excel 2021 LTSC o versión equivalente aún soportada por Microsoft y aprobada por TI.
- **Opción excepcional:** Excel 2019 únicamente si existe base instalada crítica y si la arquitectura elegida no depende de APIs no disponibles en esa versión.

#### Microsoft 365

- La solución debe ser compatible con identidades Microsoft Entra ID corporativas.
- Debe funcionar con políticas de administración centralizada del tenant.
- Debe validar la compatibilidad con el canal de actualización realmente usado por la empresa (Current Channel, Monthly Enterprise Channel o Semi-Annual Enterprise Channel).

#### Mac

- Solo se considerará soporte oficial si TI confirma parque gestionado de macOS y versión de Excel soportada.
- Si se habilita Mac, la solución deberá documentar de forma explícita cualquier diferencia funcional, limitación de rendimiento o ausencia de APIs respecto a Windows.
- Si no se valida soporte Mac en la fase de filtro, debe declararse como **fuera de alcance inicial**.

### 3.3 Criterio de decisión asociado

Antes de elegir definitivamente la tecnología del add-in, debe confirmarse:

- porcentaje de usuarios en Windows frente a Mac,
- versiones reales desplegadas por endpoint management,
- necesidad de trabajo offline,
- dependencia de APIs exclusivas de Office.js, COM/VSTO o servicios externos.

**Regla de filtro:** si la organización requiere compatibilidad homogénea entre Windows y Mac, deberán descartarse enfoques que solo puedan satisfacerse correctamente en Windows desktop.

---

## 4. Método de despliegue interno del add-in

### 4.1 Modelos permitidos a evaluar

La solución final deberá encajar en uno de estos métodos de distribución interna:

1. **Despliegue centralizado de Office Add-ins** desde el tenant de Microsoft 365.
2. **Catálogo corporativo / App Catalog** controlado por TI.
3. **Paquetización y distribución por herramientas de endpoint management** para componentes de escritorio, si la opción elegida lo requiere.
4. **Instalación restringida para pilotos** únicamente en fases tempranas, con grupo cerrado y aprobación formal.

### 4.2 Requisito principal

El método preferido debe:

- permitir instalación y retirada centralizada,
- soportar versionado controlado,
- permitir despliegue por grupos o unidades organizativas,
- minimizar privilegios locales de administrador,
- y ser compatible con procesos de cambio y release management internos.

### 4.3 Requisitos operativos de despliegue

La opción de despliegue elegida debe ofrecer:

- segregación entre entornos de **desarrollo, pruebas/preproducción y producción**,
- procedimiento de rollback documentado,
- identificación visible de la versión instalada,
- capacidad de desactivar la solución de forma urgente,
- y evidencias de qué versión estuvo disponible para qué colectivo y desde qué fecha.

### 4.4 Criterio de descarte

Se descartará cualquier alternativa que:

- dependa de instalación manual usuario a usuario a escala,
- requiera privilegios locales no permitidos por TI,
- no permita desinstalación remota o control de versiones,
- o no pueda pasar por el proceso normal de validación de software corporativo.

---

## 5. Necesidades de autenticación y autorización

### 5.1 Autenticación

La solución deberá integrarse, salvo excepción justificada, con el proveedor de identidad corporativo basado en **Microsoft Entra ID** u otro IdP oficial aprobado por la empresa.

Requisitos mínimos:

- **Single Sign-On (SSO)** como opción preferente.
- Prohibición de cuentas locales aisladas para usuarios finales, salvo para cuentas técnicas internas expresamente aprobadas.
- Compatibilidad con políticas corporativas de **MFA** y acceso condicional.
- Capacidad de revocación de acceso de forma centralizada al deshabilitar al usuario o retirarlo del grupo autorizado.

### 5.2 Autorización

La autorización debe basarse en principios de **mínimo privilegio** y, cuando aplique, en **roles** o grupos corporativos.

Roles mínimos recomendados:

- **Usuario estándar:** compara archivos y resuelve conflictos dentro de su ámbito.
- **Supervisor o revisor:** consulta resultados, trazas y decisiones auditables.
- **Administrador funcional o técnico:** gestiona configuración, parámetros y soporte operativo.
- **Auditor/compliance:** acceso de solo lectura a evidencias y logs necesarios.

### 5.3 Requisitos de autorización funcional

Deben poder restringirse, al menos, estas capacidades:

- acceso a la aplicación,
- uso de funciones avanzadas,
- acceso a históricos,
- exportación de resultados,
- consulta de auditoría,
- y administración de parámetros o catálogos.

### 5.4 Criterio de descarte

No se aceptará una solución que:

- no soporte identidad corporativa,
- no permita retirar permisos de forma centralizada,
- o no separe claramente permisos de uso, soporte y auditoría.

---

## 6. Restricciones de red, almacenamiento y tratamiento de datos sensibles

### 6.1 Restricciones de red

La arquitectura deberá asumir un entorno empresarial con controles de salida y segmentación de red.

Requisitos mínimos:

- Lista explícita de **dominios, endpoints, puertos y protocolos** requeridos.
- Uso exclusivo de **TLS** en tránsito.
- Capacidad de funcionar detrás de proxy corporativo, inspección TLS o firewalls de salida, si son políticas vigentes.
- Prohibición de conexiones a servicios no aprobados por la organización.
- Posibilidad de operar en escenarios de acceso restringido o sin internet abierta, si el negocio lo requiere.

### 6.2 Almacenamiento

Debe definirse con precisión si los archivos Excel:

- se procesan solo en memoria/localmente,
- se almacenan temporalmente en backend,
- se persisten para trazabilidad,
- o se envían a servicios cloud.

Requisitos mínimos:

- minimización de datos almacenados,
- cifrado en reposo para cualquier almacenamiento persistente,
- retención definida y aprobada,
- borrado seguro de temporales,
- segregación por entorno,
- y restricción geográfica/regulatoria del almacenamiento cuando aplique.

### 6.3 Datos sensibles

La solución debe considerarse apta para tratar potencialmente:

- información financiera,
- datos personales,
- información contractual,
- información comercial sensible,
- o documentos internos clasificados.

Por tanto, se requiere:

- clasificación de datos soportados y prohibidos,
- evaluación de si el contenido del Excel sale del equipo del usuario,
- enmascaramiento o minimización en logs,
- prohibición de usar datos reales en entornos no productivos sin controles aprobados,
- revisión de cumplimiento con normativas internas y regulatorias aplicables.

### 6.4 Criterio de decisión asociado

**Regla de filtro:** si la política corporativa prohíbe extraer contenido de Excel fuera del endpoint o del tenant aprobado, deberán priorizarse arquitecturas con procesamiento local o dentro de infraestructura corporativa controlada.

---

## 7. Requisitos de auditoría

### 7.1 Objetivo

Debe existir trazabilidad suficiente para reconstruir qué usuario realizó una comparación, qué conflictos fueron detectados, qué decisión se tomó sobre cada conflicto y en qué momento.

### 7.2 Eventos mínimos a auditar

Se deberán registrar, como mínimo:

- identidad del usuario autenticado,
- fecha y hora con zona horaria normalizada,
- identificador único de la operación de comparación,
- archivo origen y archivo destino o sus identificadores corporativos,
- versión de la aplicación o add-in,
- conjunto de conflictos detectados,
- decisión tomada para cada conflicto,
- usuario que aceptó, rechazó o marcó manualmente cada conflicto,
- fecha y hora de cada aceptación o resolución,
- resultado final de la operación,
- e incidencias o errores relevantes.

### 7.3 Requisitos técnicos de auditoría

La auditoría deberá cumplir además:

- integridad razonable frente a manipulación no autorizada,
- retención acorde a la política corporativa,
- capacidad de búsqueda por usuario, archivo, fecha y operación,
- exportación controlada para auditoría o compliance,
- sincronización horaria fiable,
- y separación entre logs técnicos y evidencias funcionales.

### 7.4 Privacidad y acceso

Los registros de auditoría:

- solo podrán consultarse por perfiles autorizados,
- no deberán exponer más contenido del archivo del estrictamente necesario,
- y deberán respetar las políticas de privacidad laboral y protección de datos aplicables.

### 7.5 Criterio de descarte

Se descartará cualquier alternativa que no permita responder de forma confiable a la pregunta:

> **Quién aceptó qué conflicto y cuándo.**

---

## 8. Límites de rendimiento

### 8.1 Propósito

Estos umbrales sirven para evaluar si la arquitectura propuesta es viable para el uso empresarial esperado. Deberán refinarse durante la fase de pruebas, pero deben existir objetivos iniciales antes de seleccionar tecnología.

### 8.2 Umbrales iniciales recomendados

Salvo que negocio indique otros valores, la solución deberá aspirar como mínimo a soportar:

- **Tamaño máximo de archivo por libro:** hasta 25 MB por archivo en uso estándar.
- **Escenario extendido deseable:** hasta 50 MB por archivo con advertencia de degradación controlada.
- **Número máximo de hojas por libro:** al menos 25 hojas en escenario estándar.
- **Número de celdas relevantes a comparar:** al menos 200.000 celdas no vacías agregadas por operación estándar.
- **Comparación concurrente por usuario:** una operación activa por sesión de usuario, evitando saturación local o remota.

### 8.3 Tiempos objetivo

Para archivos dentro del umbral estándar:

- apertura/preparación de la comparación: **≤ 5 segundos**,
- análisis inicial: **≤ 30 segundos**,
- presentación de resultados navegables: **≤ 5 segundos** tras finalizar el análisis,
- registro de decisiones del usuario sobre conflictos: **≤ 2 segundos** por acción visible.

Para escenarios extendidos, puede aceptarse degradación, pero deberá estar documentada y comunicada al usuario.

### 8.4 Comportamiento ante exceso de límites

La solución deberá:

- detectar archivos o estructuras fuera del umbral,
- avisar al usuario con mensaje claro,
- evitar bloqueos indefinidos de Excel,
- permitir cancelación segura,
- y registrar el evento para análisis operativo.

### 8.5 Criterio de decisión asociado

**Regla de filtro:** si la opción técnica no puede alcanzar estos umbrales en equipos corporativos de referencia, deberá descartarse o limitarse formalmente su alcance de uso.

---

## 9. Reglas de soporte y mantenimiento interno

### 9.1 Modelo de soporte

Debe definirse un modelo de soporte interno antes de la implantación productiva.

Requisitos mínimos:

- identificación de **propietario funcional**,
- identificación de **propietario técnico**,
- asignación a mesa de ayuda o canal interno de soporte,
- procedimiento de escalado,
- y catálogo de incidencias conocidas.

### 9.2 Cobertura operativa

Debe definirse:

- horario de soporte,
- tiempos objetivo de respuesta y resolución por severidad,
- responsables de monitorización si existe backend,
- responsables de renovación de certificados, secretos o registros de aplicación,
- y responsables de validación tras cambios de versión de Excel o Microsoft 365.

### 9.3 Mantenimiento evolutivo y preventivo

La solución debe prever:

- revisión periódica de compatibilidad con nuevas versiones de Office,
- gestión de vulnerabilidades y dependencias,
- ciclo de pruebas regresivas,
- plan de continuidad ante cambios del tenant o políticas corporativas,
- y procedimiento de retirada controlada si la solución deja de ser compatible o aprobada.

### 9.4 Documentación obligatoria

Antes de producción deberá existir como mínimo:

- guía de instalación y despliegue,
- guía operativa,
- matriz de roles y accesos,
- procedimiento de recuperación ante fallo,
- inventario de dependencias técnicas,
- y procedimiento de auditoría y extracción de evidencias.

### 9.5 Criterio de descarte

No deberá aprobarse una arquitectura que dependa de conocimiento tácito de una sola persona o que carezca de un responsable interno claro de operación y mantenimiento.

---

## 10. Criterios de salida para la decisión de arquitectura

Solo podrá avanzarse a la elección definitiva de **Office Add-in**, backend y estrategia de despliegue cuando estén respondidas y aprobadas estas preguntas:

1. ¿Qué versiones reales de Excel están en uso y cuáles son obligatorias?
2. ¿Es obligatorio soportar Mac desde el primer release?
3. ¿Puede el contenido de los Excel salir del endpoint o del tenant corporativo?
4. ¿Se requiere SSO con Entra ID y control por grupos/roles?
5. ¿Qué método de despliegue interno aprobará TI?
6. ¿Qué nivel de auditoría es obligatorio para cumplir trazabilidad y compliance?
7. ¿Cuáles son los límites máximos de tamaño, complejidad y tiempo aceptables?
8. ¿Quién dará soporte y cómo se mantendrá la solución en el tiempo?

Si cualquiera de estas preguntas queda sin respuesta validada, la decisión de arquitectura deberá considerarse **provisional**.

---

## 11. Recomendación de uso del documento

Se recomienda usar este documento como checklist de evaluación comparativa entre alternativas técnicas. Para cada opción considerada, deberá marcarse si:

- **Cumple**,
- **Cumple con restricciones**,
- **Requiere excepción**,
- o **No cumple**.

La alternativa final solo deberá aprobarse si satisface los requisitos críticos de seguridad, despliegue, auditoría y soporte definidos por la organización.
