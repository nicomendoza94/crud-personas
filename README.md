# CRUD de personas con auditoría de búsquedas

Aplicación web para registrar y consultar personas (con imágenes de documento),
con verificación captcha antes de buscar, auditoría de cada búsqueda con IP real
y geolocalización, y notificación a un grupo de Telegram.

> ⚠️ Todos los datos e imágenes del sistema son **sintéticos**. No se cargan datos de personas reales.

## Requisitos previos
- Node.js 22 o superior
- PostgreSQL 16 o superior (desarrollado con PostgreSQL 18)

## Instalación y ejecución

1. Clonar el repositorio e instalar dependencias:
```bash
   git clone git@github.com:nicomendoza94/crud-personas.git
   cd crud-personas
   npm install
```

2. Crear el usuario y la base de datos (conectado como superusuario, por ejemplo `psql -U postgres`).
   La aplicación usa un usuario propio sin privilegios de superusuario:
```sql
   CREATE ROLE crud_app WITH LOGIN;
   \password crud_app
   CREATE DATABASE crud_personas OWNER crud_app ENCODING 'UTF8' TEMPLATE template0;
```

3. Copiar `.env.example` a `.env` y completar los valores (como mínimo `DB_CONTRASENA`).

4. Crear las tablas:
```bash
   npm run migrar
```
5. Cargar las 500 personas sintéticas de prueba:
```bash
   npm run seed
```
   Para borrar los datos existentes y volver a cargarlos: `npm run seed -- --reiniciar`.

6. Iniciar la aplicación:
```bash
   npm run dev
```
   Queda disponible en `http://127.0.0.1:3000`.

> **Nota:** los scripts `dev` y `start` usan `--dns-result-order=ipv4first`. En redes con IPv6
> configurado pero sin salida a internet, Node intentaba conectarse a la API de Telegram por
> IPv6 y la conexión agotaba su tiempo de espera. Con esta opción se prioriza IPv4.

## Datos de prueba

Todos los datos son sintéticos, como exige la consigna:
- Nombres y fechas de nacimiento generados con `@faker-js/faker`, con semilla fija
  (el resultado es reproducible).
- Números de documento consecutivos desde **90.000.001**: un rango que no corresponde a
  documentos reales, para no asociar números existentes a nombres inventados.
- Imágenes generadas por el propio script, con la leyenda **MUESTRA — DOCUMENTO NO VÁLIDO**.
- Cada persona tiene sus propios archivos de imagen, para que eliminar una no afecte a otras.

El seed incluye casos para verificar el cálculo de edad: una persona que cumple años el día
de la carga y otra nacida un 29 de febrero. El script informa sus números de documento.

Al finalizar la evaluación, los datos se eliminan con `npm run seed -- --reiniciar`
seguido de la eliminación de la base, o directamente eliminando la base `crud_personas`.

## Arquitectura y stack
_(pendiente)_

## Almacenamiento de imágenes

**Decisión:** las imágenes se guardan en el sistema de archivos (carpeta `almacenamiento/`,
fuera de `public/` y excluida de git). La base de datos guarda solo el nombre del archivo.

**Ventajas obtenidas:**
- La base se mantiene liviana: el listado nunca arrastra datos de imágenes.
- Los respaldos de la base son pequeños y rápidos.
- Las imágenes se envían con `sendFile`, por partes, sin cargarlas completas en memoria.

**Desventajas asumidas:**
- Base y disco pueden desincronizarse; se mitiga con el orden de las operaciones (ver ciclo de vida).
- Hay que respaldar dos cosas: la base y la carpeta de imágenes.
- No escala a varios servidores, porque cada uno tendría su propio disco.

**Cuándo cambiaría el enfoque:** con más de un servidor o en la nube, usaría almacenamiento
de objetos (S3, Cloudflare R2). Base64 en la base lo descarté: aumenta el tamaño ~33% y
engorda cada fila.

**Validación de cada archivo:**
1. Límite de **2 MB** por archivo y máximo 2 archivos por petición (`multer`, en memoria:
   nada se escribe en disco antes de validar).
2. Tipo real detectado por los primeros bytes del contenido (*magic bytes*, con `file-type`):
   se ignoran la extensión y el tipo declarado por el cliente. Se aceptan JPEG, PNG y WebP.
3. Re-codificación completa con `sharp` a WebP: si el contenido no es una imagen real, falla.
   El archivo guardado es nuevo, sin metadatos EXIF (que pueden incluir ubicación GPS) ni
   contenido oculto del original. Se reduce a 1600 px por lado como máximo.
4. Límite de **25 megapíxeles** de entrada, contra "bombas de descompresión".

**Nombre del archivo:** lo genera el servidor (`<UUID>.webp`). El nombre enviado por el cliente
se ignora. Antes de acceder al disco se verifica que el nombre tenga exactamente ese formato.

**Ciclo de vida:**
- *Alta:* se validan ambas imágenes, se guardan y se inserta la fila. Si el `INSERT` falla
  (por ejemplo, documento duplicado), se borran los archivos recién escritos.
- *Edición:* las imágenes son opcionales. Las nuevas se guardan antes de actualizar la fila,
  y las reemplazadas se borran después.
- *Baja:* se elimina la fila y luego sus imágenes. Si falla el borrado de un archivo, queda
  huérfano (inofensivo); nunca queda una persona apuntando a una imagen inexistente.

**Acceso:** solo a través de `GET /api/personas/:id/imagenes/:lado`. El nombre del archivo se
toma de la base, nunca de la petición, y se envía con `Content-Type: image/webp`,
`X-Content-Type-Options: nosniff` y `Cache-Control: no-store`.

## Búsqueda

`POST /api/busquedas` con `{ "termino": "..." }`. El término viaja en el cuerpo y no en la URL
porque puede ser un dato personal, y las URLs quedan registradas en historiales y logs de
servidores e intermediarios. Además, cada búsqueda genera un registro de auditoría: no es una
lectura sin efectos.

**Campos y criterio de coincidencia:**
- Si el término contiene algún dígito, se busca por **número de documento**, por prefijo y
  normalizado igual que al guardar (sin puntos, guiones ni espacios): `90.000.1` encuentra
  `90000100`, `90000101`, etc. Es seguro porque los nombres no admiten dígitos.
- Si no, se busca por **nombres y apellidos**: deben aparecer todas las palabras (hasta 5), en
  cualquier orden, sin distinguir mayúsculas ni tildes (`jose garcia` encuentra a "José García").

**Término vacío o demasiado corto:** se exige un mínimo de 3 caracteres, contados después de
quitar los espacios de los extremos. Con menos, la respuesta es 400 con un mensaje claro.

**Entradas inesperadas:**
- Más de 100 caracteres: 400.
- Contenido que no es texto (número, lista, objeto) o JSON mal formado: 400.
- Caracteres de control: 400.
- Comodines de SQL (`%`, `_`): se escapan y se buscan de forma literal; `%%%` no devuelve
  toda la tabla.
- Las consultas son siempre parametrizadas: ningún carácter puede alterar la consulta SQL.

**Resultados:** como máximo 50, ordenados por apellido. Si hay más coincidencias se indica
para que el usuario refine el término.

**Eficiencia:** índice de trigramas (`pg_trgm`) sobre nombres y apellidos sin tildes
(`unaccent`), e índice `text_pattern_ops` sobre el documento para la búsqueda por prefijo.

**En la interfaz,** la búsqueda se ejecuta solo al presionar "Buscar", nunca mientras se escribe.

## Obtención de la IP del visitante

La aplicación se expone mediante Cloudflare Tunnel: el visitante se conecta a Cloudflare, y
`cloudflared` (en esta misma máquina) reenvía la petición a la aplicación. Para la aplicación,
todas las conexiones provienen de `127.0.0.1`, por lo que la IP de la conexión no sirve.

## Geolocalización de la IP

**API elegida:** [ipapi.co](https://ipapi.co), gratuita y sin registro. Funciona por HTTPS y
entrega país, ciudad, organización y coordenadas aproximadas. Se descartó ip-api.com porque su
plan gratuito solo funciona por HTTP: enviaría las IPs de los visitantes sin cifrar.

**Cuándo se consulta:** después de responder al usuario, en segundo plano. La búsqueda nunca
espera a la API. El resultado actualiza el registro de auditoría ya creado.

**Tolerancia a fallas** (el estado queda registrado en `geo_estado`):

| Situación | Comportamiento | Estado |
|---|---|---|
| IP privada, loopback o reservada | No se consulta la API | `ip_privada` |
| Respuesta con datos | Se guardan país, ciudad, organización y coordenadas | `ok` |
| La API no tiene datos de esa IP | Se registra sin datos | `sin_datos` |
| Límite de uso superado (HTTP 429) | Se dejan de hacer consultas durante el tiempo indicado por `Retry-After` (60 s por defecto) | `limite_excedido` |
| Sin respuesta, error o demora | Tiempo máximo de 3 s (`GEOLOCALIZACION_TIEMPO_MAXIMO_MS`) | `error` |

- La función de geolocalización nunca lanza errores; la tarea en segundo plano captura cualquier
  otro error (por ejemplo, de la base) y lo registra en el log. En ese caso la columna queda en
  `pendiente`.
- **Caché en memoria de 24 horas** (máximo 1000 IPs): una misma IP no se consulta más de una vez
  por día, lo que protege la cuota gratuita.
- Los datos recibidos se tratan como externos: los textos se recortan al largo de cada columna y
  las coordenadas se validan antes de guardarlas.
- La geolocalización por IP es aproximada: indica dónde está registrado un bloque de direcciones,
  no la ubicación física de la persona.

**Regla implementada** (`src/utils/ip.js`):
- Si la conexión proviene de loopback (`127.0.0.0/8` o `::1`), es decir, del túnel, se usa el
  encabezado **`CF-Connecting-IP`**, validado como IP con `net.isIP`.
- En cualquier otro caso, se usa la IP de la conexión (`req.socket.remoteAddress`) y se ignoran
  todos los encabezados.
- **`X-Forwarded-For` no se usa nunca.**

**Por qué es confiable:**
- `CF-Connecting-IP` lo escribe Cloudflare con la IP del visitante; si el cliente envía uno
  propio, Cloudflare lo reemplaza.
- `X-Forwarded-For`, en cambio, es una lista a la que Cloudflare *agrega* la IP real, conservando
  los valores que haya enviado el cliente: tomar el primer valor sería confiar en el atacante.
- El servidor escucha **solo en `127.0.0.1`**: desde fuera de esta máquina, la única forma de
  llegar a la aplicación es a través del túnel. Una conexión directa desde otra dirección
  conserva su IP real y su `CF-Connecting-IP` se ignora.
- Un valor que no es una IP válida (texto, varias IPs) se descarta.

**Límite conocido:** un proceso que corra en el mismo servidor podría enviar un
`CF-Connecting-IP` arbitrario. Requiere acceso a la máquina, lo que ya implica acceso a la base.

Se registra también el **origen** de cada IP (`cloudflare` o `conexion`). La lógica está cubierta
por tests (`tests/ip.test.js`), incluidos los casos de encabezados falsificados.

**Alternativa descartada:** `app.set('trust proxy', ...)` de Express. Funciona con
`X-Forwarded-For`, pero se prefirió una regla explícita y específica para Cloudflare, en una
función pura y testeable.

## Captcha

**Mecanismo:** Cloudflare Turnstile (gratuito, sin rastreo publicitario, habitualmente se
resuelve con un clic).

**Validación:**
1. El navegador resuelve el widget y obtiene un token de Turnstile.
2. Lo envía a `POST /api/busquedas/verificacion`.
3. El servidor lo verifica con la API de Cloudflare (`siteverify`) usando la clave secreta,
   con un tiempo máximo de espera de 5 segundos.
4. Si es válido, abre una **sesión de búsqueda**: genera un token aleatorio de 32 bytes, lo envía
   en una cookie `HttpOnly`, `SameSite=Strict`, restringida a `/api/busquedas` (y `Secure` en
   producción), y guarda en la base solo su hash SHA-256.
5. `POST /api/busquedas` exige esa sesión: sin ella responde 403 con el código `CAPTCHA_REQUERIDO`.

**Por qué no puede eludirse:** un token de Turnstile solo se obtiene resolviendo el widget en un
navegador, y solo es válido si Cloudflare lo confirma: un token inventado es rechazado. Los tokens
son de un solo uso y vencen a los 5 minutos. Una llamada directa a `POST /api/busquedas` (por
ejemplo con `curl`) sin sesión, o con una cookie inventada, recibe 403.

**Política (equilibrio entre seguridad y usabilidad):** un captcha aprobado habilita
**20 búsquedas durante 10 minutos**, lo que ocurra primero (configurable con
`CAPTCHA_MAXIMO_BUSQUEDAS` y `CAPTCHA_VIGENCIA_MINUTOS`). Después se solicita nuevamente. La
búsqueda se ejecuta solo al presionar "Buscar", nunca mientras se escribe. Cada intento de
búsqueda descuenta una unidad, aunque el término sea inválido.

**Detalles de implementación:**
- La búsqueda se descuenta con un único `UPDATE` atómico: aunque lleguen muchas peticiones
  simultáneas con la misma cookie, nunca se superan las búsquedas habilitadas.
- Se guarda el hash y no el token: una copia de la base no permite usar sesiones.
- Si no se puede consultar a Cloudflare, la búsqueda **no** se habilita (se falla cerrado,
  respuesta 503): el captcha es un control de seguridad y no debe desactivarse ante una falla.
- Las claves se leen de variables de entorno. La clave de sitio (pública por diseño) se entrega
  al front mediante `GET /api/configuracion`; la secreta nunca sale del servidor.
- La CSP solo permite scripts e iframes del propio servidor y de `challenges.cloudflare.com`.

## Información enviada a Telegram

Cada búsqueda genera una notificación a un grupo de Telegram, enviada en segundo plano después de
responder al usuario.

**Contexto:** Telegram es un tercero fuera del control de la organización. Los mensajes quedan en
sus servidores (los chats de grupo no tienen cifrado de extremo a extremo), los ven todos los
miembros del grupo, incluidos los futuros, pueden reenviarse, y no se les aplica nuestra política
de retención.

**Criterio: minimización de datos.** La notificación sirve para avisar *que* ocurrió una búsqueda
y detectar actividad anómala (ráfagas, horarios inusuales, orígenes inesperados). No reemplaza a
la auditoría: el detalle queda en la base.

| Se envía | Motivo |
|---|---|
| Número de registro de auditoría | Permite consultar el detalle en el historial sin exponerlo |
| Fecha y hora | Detectar patrones temporales |
| Criterio (nombre o documento) | Tipo de búsqueda, sin revelar qué se buscó |
| Cantidad de resultados | Distinguir búsquedas amplias de búsquedas puntuales |
| País (aproximado) | Detectar accesos desde orígenes inesperados |
| IP enmascarada (`181.120.5.x`) | Relacionar búsquedas de un mismo origen sin identificar al visitante |

| Se omite | Motivo |
|---|---|
| Término buscado | Puede ser el nombre o el número de documento de una persona: es el dato más sensible |
| Resultados | Datos personales de las personas encontradas |
| IP completa | Dato personal del visitante: con la IP y la fecha, un proveedor puede identificarlo |
| Ciudad, organización y coordenadas | Precisan demasiado la ubicación o identifican al proveedor o la empresa del visitante |

**Implementación:**
- La función que arma el mensaje (`src/utils/mensajeTelegram.js`) ni siquiera recibe el término
  buscado: no puede incluirse por error. Los tests lo verifican pasándoselo a propósito.
- El mensaje se envía como texto plano, sin `parse_mode`: parte del contenido proviene de una API
  externa y no debe interpretarse como HTML ni Markdown.
- El token del bot y el identificador del chat se leen de variables de entorno. Los errores se
  registran con una descripción propia, nunca con la URL de la API (que contiene el token).
- El bot se configuró en BotFather para no poder ser agregado a otros grupos (`/setjoingroups`).

**Configuración del bot:** se crea con `@BotFather` (`/newbot`), se agrega al grupo y se envía
`/start@nombre_del_bot` en el grupo. El identificador del chat se obtiene con el método
`getUpdates` de la API.

## Fallas de APIs externas

Principio: las integraciones **complementarias** (geolocalización y Telegram) nunca afectan la
búsqueda; los **controles** (captcha y auditoría) fallan cerrados.

| Integración | Momento | Si falla |
|---|---|---|
| Captcha (Cloudflare) | Antes de buscar | **No se habilita la búsqueda** (503): es un control de seguridad |
| Registro de auditoría (base) | Antes de responder | **No se entregan los resultados**: no hay búsquedas sin auditar |
| Geolocalización (ipapi.co) | Después de responder | La búsqueda no se afecta; queda `geo_estado` con el motivo |
| Telegram | Después de responder | La búsqueda no se afecta; queda `telegram_estado = 'error'` y el detalle |

**Telegram en particular:**
- Tiempo máximo de espera: 5 s (`TELEGRAM_TIEMPO_MAXIMO_MS`).
- Se valida que la respuesta tenga `ok: true`; cualquier otra respuesta es un error.
- Casos identificados en el detalle: token inválido (401), **bot removido del grupo** o sin
  permiso (403), grupo convertido en supergrupo (id nuevo informado), límite de envíos (429),
  sin respuesta o demora.
- No se reintenta el envío (mejora posible, ver "Fuera de alcance").

Las tareas posteriores a la respuesta se ejecutan sin `await` y con un `.catch` obligatorio: un
error no capturado terminaría el proceso de Node. Si la tarea no llega a completarse, la columna
correspondiente queda en `pendiente`.

## Historial y política de retención

**Vista:** `/historial.html` (API: `GET /api/auditoria?pagina=N`), paginada de a 20 registros,
de la búsqueda más reciente a la más antigua. Muestra fecha y hora, término, criterio, cantidad
de resultados, IP y su origen (túnel o conexión directa), ubicación y resultado del envío a
Telegram.

**Acceso:** la consigna excluye la autenticación y la vista es necesaria para la evaluación, por
lo que el historial es accesible para quien acceda a la aplicación. Es un riesgo reconocido: el
historial contiene términos de búsqueda e IPs. Se mitiga con respuestas sin caché
(`Cache-Control: no-store`), paginación y una retención corta. En producción requeriría
autenticación, control de acceso por roles y auditoría de las consultas al propio historial.

**Retención: 30 días** (configurable con `RETENCION_AUDITORIA_DIAS`, entre 1 y 365).
- Fundamento: la auditoría contiene datos personales (términos buscados e IPs). Se conservan solo
  el tiempo necesario para revisar el uso reciente del sistema; conservar más aumenta el daño
  posible ante una filtración sin un beneficio claro.
- Aplicación: al iniciar el servidor y luego cada 24 horas se eliminan los registros más antiguos
  que el plazo. El borrado usa el índice sobre `fecha_hora`.
- Las sesiones de búsqueda vencidas se eliminan cada vez que se crea una nueva.
- **Límite:** la retención no alcanza a los mensajes ya enviados a Telegram. Por eso esos mensajes
  no contienen el término buscado ni la IP completa.

## Fuera de alcance y mejoras futuras
_(pendiente)_

## Uso de inteligencia artificial

Se utilizó Claude (Anthropic) como asistente durante el desarrollo.
Cada entrada registra en qué se usó, qué errores cometió la herramienta y qué se corrigió.

| Fecha | Parte del proyecto | Uso de la IA | Errores detectados / correcciones |
|-------|--------------------|--------------|-----------------------------------|
| 2026-09-24 | Planificación | Análisis de la consigna y propuesta de stack, arquitectura y decisiones de seguridad | Propuso `dotenv`; se reemplazó por `--env-file`, nativo de Node. La primera estructura no tenía capa de repositorios: el SQL iba a quedar mezclado con la lógica en los servicios. Se agregó `src/repositorios/` |
| 2026-09-24 | Arquitectura | Comparación entre MVC con EJS y API REST en capas | Se evaluaron ambas; se eligió API REST en capas por su separación de responsabilidades y su alineación con el mercado laboral actual |
| 2026-09-25 | Configuración inicial | Generación de `package.json` y archivos base | El `package.json` de ejemplo tenía versiones de dependencias anteriores a las instaladas; se conservaron las versiones reales de `package-lock.json` |
| 2026-09-25 | Documentación | Propuesta de ubicación de la bitácora de IA | La ubicó en un archivo aparte (`docs/uso-ia.md`), aunque la consigna pide documentarla en el README; se movió al README |
| 2026-09-25 | Planificación | Orden de los commits | El plan separaba el CRUD de la subida de imágenes, pero las imágenes son obligatorias (NOT NULL): no era posible dar de alta sin ellas. Se reorganizó en commits de lectura y de escritura con imágenes |
| 2026-09-26 | Seed | Generación de apellidos con faker | Supuso que `faker.person.lastName()` devuelve un apellido, pero en español devuelve dos: las personas quedaban con cuatro apellidos. Se detectó al revisar los resultados de búsqueda y se corrigió |