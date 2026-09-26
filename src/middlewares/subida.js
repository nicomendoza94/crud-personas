/**
 * Middleware de subida de imágenes de persona (formularios multipart/form-data).
 *
 * - Los archivos quedan en memoria (Buffer): nunca se escriben en disco sin antes
 *   pasar por la validación y re-codificación de imagenes.servicio.js.
 * - Solo se aceptan los campos de archivo "imagenFrente" e "imagenDorso",
 *   uno de cada uno, con un tamaño máximo por archivo.
 * - Los errores de la subida se traducen a ErrorAplicacion con mensajes propios.
 */
import multer from 'multer';
import { ErrorAplicacion } from './errores.js';
import { TAMANIO_MAXIMO_BYTES } from '../servicios/imagenes.servicio.js';

const TAMANIO_MAXIMO_MB = TAMANIO_MAXIMO_BYTES / (1024 * 1024);

const procesarFormulario = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: TAMANIO_MAXIMO_BYTES, // Tamaño máximo por archivo
    files: 2, // Cantidad máxima de archivos
    fields: 10, // Cantidad máxima de campos de texto
    fieldSize: 1024, // Tamaño máximo de cada campo de texto (1 KB)
    parts: 12, // Cantidad máxima de partes en total (archivos + campos)
  },
}).fields([
  { name: 'imagenFrente', maxCount: 1 },
  { name: 'imagenDorso', maxCount: 1 },
]);

/** Traduce los códigos de error de multer a mensajes para el usuario. */
function mensajeDeError(err) {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return `Cada imagen puede pesar como máximo ${TAMANIO_MAXIMO_MB} MB`;
    case 'LIMIT_UNEXPECTED_FILE':
    case 'LIMIT_FILE_COUNT':
      return 'Solo se aceptan los archivos imagenFrente e imagenDorso, uno de cada uno';
    default:
      return 'El formulario enviado no es válido';
  }
}

export function subirImagenesPersona(req, res, next) {
  procesarFormulario(req, res, (err) => {
    if (!err) {
      return next();
    }
    // Cualquier error en esta etapa se debe a lo que envió el cliente
    // (límites superados o formulario mal armado): se responde 400/413.
    const estado = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const mensaje = err instanceof multer.MulterError ? mensajeDeError(err) : 'El formulario enviado no es válido';
    next(new ErrorAplicacion(estado, mensaje));
  });
}