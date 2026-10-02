/**
 * Cliente de la API. Todas las llamadas al servidor pasan por este módulo.
 */

/** Error con la información que devuelve la API (mensaje, código HTTP, detalles y código de error). */
export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles = [], codigo = null) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
    // Código legible por el programa (ej: 'CAPTCHA_REQUERIDO')
    this.codigo = codigo;
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
      cuerpo?.codigo ?? null,
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

/**
 * Búsqueda de personas. El término viaja en el cuerpo (JSON) y no en la URL:
 * puede ser un dato personal, y las URLs quedan registradas en historiales y logs.
 */
export function buscarPersonas(termino) {
  return solicitar('/api/busquedas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ termino }),
  });
}

/** Configuración pública del servidor (ID público del captcha). */
export function obtenerConfiguracion() {
  return solicitar('/api/configuracion');
}

/**
 * Envía al servidor el resultado del captcha deslizante (los cuatro valores que
 * entrega GeeTest). Si es válido, el servidor responde con una cookie de sesión
 * de búsqueda (HttpOnly: el JavaScript no puede leerla, pero el navegador la
 * envía automáticamente en las búsquedas siguientes).
 */
export function verificarCaptcha(resultado) {
  return solicitar('/api/busquedas/verificacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resultado),
  });
}

/** Página del historial de búsquedas (auditoría). */
export function listarAuditoria(pagina) {
  return solicitar(`/api/auditoria?pagina=${encodeURIComponent(pagina)}`);
}