/**
 * Cliente de la API. Todas las llamadas al servidor pasan por este módulo.
 */

/** Error con la información que devuelve la API (mensaje, código y detalles). */
export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles = []) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}

/**
 * Realiza una petición y devuelve el cuerpo JSON de la respuesta.
 * @throws {ErrorApi} si no hay conexión o la respuesta indica un error
 */
async function solicitar(url, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(url, opciones);
  } catch {
    // fetch solo falla así cuando no pudo comunicarse con el servidor
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Intente nuevamente.');
  }

  // 204 No Content: operación exitosa sin cuerpo (ej: eliminación)
  if (respuesta.status === 204) {
    return null;
  }

  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    // La respuesta no era JSON: se usa el mensaje genérico de abajo
  }

  // fetch NO lanza error ante un 400 o un 500: hay que revisar respuesta.ok
  if (!respuesta.ok) {
    throw new ErrorApi(
      respuesta.status,
      cuerpo?.error ?? 'Ocurrió un error inesperado. Intente nuevamente.',
      cuerpo?.detalles ?? [],
    );
  }

  return cuerpo;
}

export function listarPersonas(pagina) {
  return solicitar(`/api/personas?pagina=${encodeURIComponent(pagina)}`);
}

export function obtenerPersona(id) {
  return solicitar(`/api/personas/${encodeURIComponent(id)}`);
}

/**
 * Los formularios con archivos se envían como FormData. No se define el
 * encabezado Content-Type: el navegador lo arma solo (multipart/form-data
 * con el separador entre partes).
 */
export function crearPersona(datosFormulario) {
  return solicitar('/api/personas', { method: 'POST', body: datosFormulario });
}

export function actualizarPersona(id, datosFormulario) {
  return solicitar(`/api/personas/${encodeURIComponent(id)}`, { method: 'PUT', body: datosFormulario });
}

export function eliminarPersona(id) {
  return solicitar(`/api/personas/${encodeURIComponent(id)}`, { method: 'DELETE' });
}