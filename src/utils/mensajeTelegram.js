/**
 * Texto de la notificación de búsqueda que se envía a Telegram.
 *
 * Criterio de minimización (ver README, "Información enviada a Telegram"):
 * Telegram es un tercero fuera de nuestro control, así que el mensaje solo
 * avisa QUE ocurrió una búsqueda. Se envían: número de registro, fecha y hora,
 * criterio, cantidad de resultados, país aproximado e IP enmascarada.
 * NO se envían: el término buscado, los resultados, la IP completa, la ciudad,
 * la organización ni las coordenadas. El detalle queda en el historial.
 *
 * La función ni siquiera recibe el término: no hay forma de incluirlo por error.
 */
import { enmascararIp } from './ip.js';

const DESCRIPCION_SIN_PAIS = {
  ip_privada: 'red privada o local',
  sin_datos: 'sin datos para esta IP',
  limite_excedido: 'no disponible (límite de la API de ubicación)',
  error: 'no disponible (falla de la API de ubicación)',
};

/**
 * @param {object} datos
 * @param {number} datos.id                 Número del registro de auditoría
 * @param {Date}   datos.fechaHora
 * @param {'nombre'|'documento'} datos.criterio
 * @param {number} datos.cantidadResultados
 * @param {string} datos.ip                 IP completa (se enmascara aquí)
 * @param {{estado: string, pais?: string}} datos.geo
 * @param {string} zonaHoraria              Zona para mostrar la hora (ej: America/Asuncion)
 * @returns {string} Texto plano (sin formato HTML ni Markdown)
 */
export function construirMensajeBusqueda(
  { id, fechaHora, criterio, cantidadResultados, ip, geo },
  zonaHoraria,
) {
  const fecha = new Intl.DateTimeFormat('es-PY', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: zonaHoraria,
  }).format(fechaHora);

  const pais = geo.estado === 'ok' && geo.pais
    ? geo.pais
    : DESCRIPCION_SIN_PAIS[geo.estado] ?? 'no disponible';

  return [
    'Nueva búsqueda en el registro de personas',
    '',
    `Registro de auditoría: #${id}`,
    `Fecha y hora: ${fecha}`,
    `Criterio: ${criterio === 'documento' ? 'número de documento' : 'nombre y apellido'}`,
    `Resultados: ${cantidadResultados}`,
    `Origen: ${pais} (IP ${enmascararIp(ip)})`,
    '',
    'Por protección de datos, el término buscado no se incluye. Consulte el historial de auditoría.',
  ].join('\n');
}