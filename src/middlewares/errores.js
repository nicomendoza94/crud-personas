/**
 * Manejo centralizado de errores.
 *
 * Regla: el cliente recibe mensajes genéricos; el detalle técnico
 * (traza, consulta, ruta de archivo) queda solo en la consola del servidor.
 */

/**
 * Error "esperado", lanzado a propósito por nuestro código.
 * Su mensaje es seguro de mostrar al usuario porque lo redactamos nosotros.
 *
 * Uso: throw new ErrorAplicacion(404, 'Persona no encontrada');
 */
export class ErrorAplicacion extends Error {
  /**
   * @param {number} estado     Código HTTP (400, 404, 409...)
   * @param {string} mensaje    Mensaje apto para el usuario
   * @param {object} [detalles] Información adicional segura (ej: qué campos fallaron)
   * @param {string} [codigo]   Código para que el cliente identifique el caso
   *                            (ej: 'CAPTCHA_REQUERIDO')
   */
  constructor(estado, mensaje, detalles, codigo) {
    super(mensaje);
    this.name = 'ErrorAplicacion';
    this.estado = estado;
    this.detalles = detalles;
    this.codigo = codigo;
  }
}

/** Responde 404 a cualquier ruta que no exista. */
export function rutaNoEncontrada(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

/**
 * Manejador global de errores.
 * Express lo identifica como manejador de errores porque recibe 4 parámetros,
 * por eso `next` debe estar declarado aunque no siempre se use.
 */
export function manejadorErrores(err, req, res, next) {
  // Si la respuesta ya empezó a enviarse, no podemos cambiarla:
  // delegamos en Express para que cierre la conexión.
  if (res.headersSent) {
    return next(err);
  }

  // Errores propios: se muestran tal cual (son mensajes controlados)
  if (err instanceof ErrorAplicacion) {
    return res.status(err.estado).json({ error: err.message, detalles: err.detalles, codigo: err.codigo });
  }

  // Errores del parser de JSON de Express: son culpa del cliente, no del servidor
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La petición supera el tamaño permitido' });
  }

  // Cualquier otro error es inesperado: detalle completo al log, mensaje genérico al usuario
  console.error(`[${new Date().toISOString()}] Error no controlado en ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: 'Ocurrió un error interno. Intente nuevamente más tarde.' });
}