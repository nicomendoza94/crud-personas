/**
 * Servicio de imágenes: validación, procesamiento y almacenamiento en disco.
 *
 * Es el único módulo que lee o escribe archivos de imágenes.
 *
 * Decisiones (ver README, "Almacenamiento de imágenes"):
 *  - El tipo real se detecta por los primeros bytes del archivo (magic bytes),
 *    nunca por la extensión ni por el tipo declarado por el cliente.
 *  - La imagen se re-codifica a WebP con sharp: el archivo guardado es nuevo,
 *    sin metadatos (EXIF) ni contenido oculto del archivo original.
 *  - El nombre del archivo lo genera el servidor (UUID); el nombre enviado
 *    por el cliente se ignora por completo.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { ErrorAplicacion } from '../middlewares/errores.js';

// Carpeta de almacenamiento, en la raíz del proyecto: fuera de public/,
// por lo que no es accesible desde la web directamente.
export const DIRECTORIO_IMAGENES = path.join(import.meta.dirname, '..', '..', 'almacenamiento');

// Tamaño máximo por archivo recibido: 2 MB
export const TAMANIO_MAXIMO_BYTES = 2 * 1024 * 1024;

// Formatos de entrada aceptados (según sus magic bytes)
const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Máximo de píxeles de la imagen de entrada (25 megapíxeles, ej: 5000 x 5000).
// Protege contra "bombas de descompresión": archivos pequeños que al
// decodificarse ocupan gigabytes de memoria.
const MAXIMO_PIXELES_ENTRADA = 25_000_000;

// Lado máximo de la imagen guardada: suficiente para leer un documento
const LADO_MAXIMO_SALIDA = 1600;

// Formato exacto de los nombres que genera el servidor: <uuid>.webp
const PATRON_NOMBRE_ARCHIVO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/**
 * Valida que el contenido sea realmente una imagen permitida y la re-codifica.
 *
 * @param {Buffer} buffer    Contenido del archivo recibido
 * @param {string} etiqueta  Nombre legible para los mensajes (ej: "foto del frente")
 * @returns {Promise<Buffer>} Imagen nueva en formato WebP
 * @throws {ErrorAplicacion} 400 si no es una imagen válida
 */
export async function procesarImagen(buffer, etiqueta) {
  // 1. Tipo real, según los primeros bytes del contenido
  const tipo = await fileTypeFromBuffer(buffer);
  if (!tipo || !TIPOS_PERMITIDOS.has(tipo.mime)) {
    throw new ErrorAplicacion(400, `La ${etiqueta} debe ser una imagen JPEG, PNG o WebP`);
  }

  // 2. Decodificación y re-codificación completa. Si el contenido no es una
  //    imagen real (o está dañado, o es demasiado grande), sharp falla aquí.
  try {
    return await sharp(buffer, { limitInputPixels: MAXIMO_PIXELES_ENTRADA })
      .rotate() // Aplica la orientación indicada en EXIF antes de descartar los metadatos
      .resize({
        width: LADO_MAXIMO_SALIDA,
        height: LADO_MAXIMO_SALIDA,
        fit: 'inside', // Mantiene la proporción
        withoutEnlargement: true, // No agranda imágenes chicas
      })
      .webp({ quality: 80 }) // sharp no copia los metadatos originales salvo que se le pida
      .toBuffer();
  } catch {
    throw new ErrorAplicacion(
      400,
      `La ${etiqueta} está dañada o supera las dimensiones permitidas`,
    );
  }
}

/**
 * Guarda una imagen ya procesada con un nombre generado por el servidor.
 * @param {Buffer} buffer Imagen procesada (resultado de procesarImagen)
 * @returns {Promise<string>} Nombre del archivo guardado (ej: "<uuid>.webp")
 */
export async function guardarImagen(buffer) {
  const nombre = `${crypto.randomUUID()}.webp`;

  await fs.mkdir(DIRECTORIO_IMAGENES, { recursive: true });
  // flag 'wx': falla si el archivo ya existiera, en lugar de sobrescribirlo
  await fs.writeFile(path.join(DIRECTORIO_IMAGENES, nombre), buffer, { flag: 'wx' });

  return nombre;
}

/**
 * Devuelve la ruta absoluta de una imagen, validando antes el nombre.
 * Defensa en profundidad: un nombre con otro formato (por ejemplo "../algo")
 * nunca se usa para acceder al disco.
 *
 * @returns {string|null} Ruta absoluta, o null si el nombre no es válido
 */
export function rutaDeImagen(nombre) {
  if (typeof nombre !== 'string' || !PATRON_NOMBRE_ARCHIVO.test(nombre)) {
    return null;
  }
  return path.join(DIRECTORIO_IMAGENES, nombre);
}

/**
 * Elimina una imagen del disco. Nunca lanza errores: si no se puede borrar,
 * lo registra y el archivo queda huérfano (inofensivo; se puede limpiar después).
 * Se usa luego de modificar la base, cuando la operación principal ya se completó.
 */
export async function eliminarImagen(nombre) {
  const ruta = rutaDeImagen(nombre);
  if (!ruta) {
    return;
  }

  try {
    await fs.unlink(ruta);
  } catch (err) {
    // ENOENT = el archivo ya no existe: el objetivo (que no esté) se cumple igual
    if (err.code !== 'ENOENT') {
      console.error(`No se pudo eliminar la imagen ${nombre}:`, err.message);
    }
  }
}