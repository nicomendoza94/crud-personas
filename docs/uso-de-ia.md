# Uso de inteligencia artificial en el proyecto

Este documento complementa la sección **"Uso de inteligencia artificial"** del README, donde están el resumen y la tabla de errores detectados. Aquí se detalla **cómo trabajé con la IA** y cuáles fueron **los prompts principales**.

- **Asistente:** Claude (Anthropic), en el chat de claude.ai, dentro de un *Proyecto* con la consigna del examen cargada como contexto.
- **Período:** del 24 de septiembre al 3 de octubre de 2026, incluidos los cambios pedidos después de la primera evaluación.

## Forma de trabajo

Cada funcionalidad siguió el mismo ciclo:

1. **Decidir:** la IA proponía alternativas con sus ventajas y desventajas; **yo elegía**, y cuando no estaba convencido, pedía comparaciones.
2. **Entender:** antes de escribir cada archivo, la IA explicaba el concepto; si algo no quedaba claro, pedía otra explicación.
3. **Implementar y probar:** aplicaba el código en mi equipo, ejecutaba las pruebas (`curl`, navegador, `npm test`, consultas a la base) y compartía las salidas reales para revisarlas.
4. **Registrar:** con la funcionalidad funcionando, commit con su tipo y descripción en español.

## Prompts principales

Los prompts se presentan con la redacción corregida y resumida, conservando su contenido y su intención. Se omiten datos personales, tokens y direcciones.

### 1. Reglas de trabajo

> "En el contexto del proyecto tenés cargada la consigna del examen, con todos los requisitos y reglas que debe cumplir la solución. Vamos a desarrollarlo paso a paso, usando GitHub: cada vez que una funcionalidad esté completa y funcionando, hacemos un commit y continuamos con la siguiente, hasta terminar el proyecto. Los commits tienen que ser profesionales, con su tipo (por ejemplo `feat`, `fix`) y redactados en español. Todo el proyecto también debe estar en español y bien comentado."

### 2. Planificación y arquitectura

> "Antes de escribir código, quiero que definamos las decisiones técnicas y las herramientas que vamos a utilizar. Después, la idea es crear el repositorio desde cero, armar la estructura del proyecto y recién entonces avanzar con el código, de forma de terminar a tiempo. Antes de crear la estructura, necesito entender qué arquitectura vamos a usar: ¿es MVC?"

> "Antes de modificar nada: pensando en cómo se vería más profesional el proyecto, ¿conviene usar MVC o la arquitectura en capas que propusiste al comienzo? Necesito entender las diferencias para decidir."

**Resultado:** inicialmente me incliné por MVC con EJS; después de comparar, elegí la arquitectura en capas.

> "Revisé la propuesta y confirmo el stack: Node.js con Express 5 y PostgreSQL, que ya tengo instalado en mi equipo con Windows, accedido con `pg` y consultas SQL propias, sin ORM. Para validar los datos, zod; para las imágenes, multer, file-type y sharp; para la seguridad HTTP, helmet, express-rate-limit y cookie-parser. El front, en HTML, CSS y JavaScript sin frameworks. Los tests, con el runner nativo de Node, y los datos de prueba, generados con faker. Para exponer la aplicación, Cloudflare Tunnel."

**Resultado:** cada herramienta quedó justificada en la tabla de la sección "Arquitectura y stack" del README.

### 3. Implementación y depuración

> "Antes de avanzar, revisá si mi estructura está bien, especialmente en `src/db`: el archivo SQL y `conexion.js` quedaron dentro de la carpeta de migraciones, ¿es correcto?"

**Resultado:** `conexion.js` estaba mal ubicado y se corrigió.

### 4. Cambios pedidos después de la evaluación

> "Vamos a reemplazar el captcha actual por un captcha deslizante, y necesito tenerlo terminado hoy. Puede ser propio o de un servicio externo: antes de decidir, analicemos las opciones disponibles."

> "Me interesa la opción de GeeTest. Compará cuánto trabajo llevaría integrarlo frente a desarrollar uno propio, para decidir con cuál avanzamos."

**Resultado:** elegí GeeTest. Mantuve el criterio de fallar cerrado, aunque su guía de despliegue exige dejar pasar al usuario si el servicio falla.

> "Vamos a reemplazar GeeTest por un captcha deslizante propio. Antes de empezar, analicemos las distintas formas de implementarlo para elegir la más conveniente. Además, revisemos cuántas veces se puede intentar resolverlo y si hace falta configurar un límite de intentos."

**Resultado:** elegí un rompecabezas con imágenes generadas, la respuesta guardada en la base y verificación de posición y tiempo mínimo. La pregunta sobre los intentos llevó a calcular que adivinar la posición acierta cerca del 7% de las veces, y se agregó un límite de intentos fallidos por IP.

> "La pieza siempre es un cuadrado: ¿qué tan complicado sería que la figura cambie de forma aleatoria?"

**Resultado:** se agregaron seis figuras posibles, elegidas al azar en cada desafío.

## Criterios que seguí

- **Entender antes de implementar:** no apliqué código que no pudiera explicar.
- **Verificar con evidencia:** cada parte se probó en mi equipo antes del commit.
- **Contrastar con la consigna** cada propuesta.
- **No aplicar recomendaciones a ciegas**, ni de la IA ni de terceros.