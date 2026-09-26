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

## Obtención de la IP del visitante
_(pendiente)_

## Captcha
_(pendiente)_

## Información enviada a Telegram
_(pendiente)_

## Fallas de APIs externas
_(pendiente)_

## Política de retención
_(pendiente)_

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