/**
 * Funciones de formato para mostrar datos en pantalla.
 * Las fechas sin hora se manejan como texto (sin objetos Date) para evitar
 * corrimientos de un día por la zona horaria del navegador.
 */

/** '1990-05-10' -> '10/05/1990' */
export function formatearFecha(fechaIso) {
  const [anio, mes, dia] = fechaIso.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Fecha y hora (ISO, en UTC) -> fecha y hora local legible. */
export function formatearFechaHora(instanteIso) {
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(instanteIso),
  );
}

/** '90000001' -> '90.000.001'. Los documentos con letras se muestran tal cual. */
export function formatearDocumento(nroDocumento) {
  return /^\d+$/.test(nroDocumento)
    ? Number(nroDocumento).toLocaleString('es-PY')
    : nroDocumento;
}

/** 34 -> '34 años', 1 -> '1 año' */
export function formatearEdad(edad) {
  return `${edad} ${edad === 1 ? 'año' : 'años'}`;
}

/** Fecha actual del navegador como 'AAAA-MM-DD' (para el máximo del campo de fecha). */
export function fechaHoyLocal() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}