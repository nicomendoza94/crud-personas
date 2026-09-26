/**
 * Cálculo de edad a partir de la fecha de nacimiento.
 *
 * La edad no se almacena: se deriva en cada consulta.
 * Todas las fechas se manejan como texto 'AAAA-MM-DD' (sin hora ni zona)
 * para evitar corrimientos de un día por conversiones de zona horaria.
 */

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Devuelve la fecha actual ("hoy") en la zona horaria indicada, como 'AAAA-MM-DD'.
 *
 * @param {string} zonaHoraria Zona IANA, ej: 'America/Asuncion'
 * @param {Date} [instante]    Momento a evaluar; por defecto, ahora.
 *                             Se puede pasar uno fijo para testear.
 */
export function fechaHoyEnZona(zonaHoraria, instante = new Date()) {
  // El formato del locale 'en-CA' es justamente AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

/**
 * Calcula la edad en años cumplidos.
 *
 * Regla: diferencia de años, menos uno si en el año de referencia todavía
 * no llegó el día del cumpleaños (comparando mes y día).
 * Consecuencia para los nacidos el 29/02: en años no bisiestos
 * cumplen el 01/03 (el 28/02 todavía no alcanzaron su fecha).
 *
 * @param {string} fechaNacimiento 'AAAA-MM-DD'
 * @param {string} fechaReferencia 'AAAA-MM-DD' (normalmente, hoy)
 * @returns {number} Años cumplidos
 */
export function calcularEdad(fechaNacimiento, fechaReferencia) {
  if (!FORMATO_FECHA.test(fechaNacimiento) || !FORMATO_FECHA.test(fechaReferencia)) {
    throw new TypeError('Las fechas deben tener el formato AAAA-MM-DD');
  }

  const [anioNac, mesNac, diaNac] = fechaNacimiento.split('-').map(Number);
  const [anioRef, mesRef, diaRef] = fechaReferencia.split('-').map(Number);

  let edad = anioRef - anioNac;

  const yaCumplio = mesRef > mesNac || (mesRef === mesNac && diaRef >= diaNac);
  if (!yaCumplio) {
    edad -= 1;
  }

  return edad;
}