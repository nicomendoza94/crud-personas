/**
 * Servicio de auditoría de búsquedas.
 *
 * El registro se crea ANTES de responder al usuario: si no se puede auditar,
 * la búsqueda no se entrega (la auditoría es un control, no un complemento).
 * La geolocalización y la notificación a Telegram se agregan en los próximos
 * pasos, después de responder, y sus fallas no afectan la búsqueda.
 */
import * as repositorio from '../repositorios/auditoria.repositorio.js';

/**
 * @param {object} busqueda
 * @param {string} busqueda.termino
 * @param {'nombre'|'documento'} busqueda.criterio
 * @param {number} busqueda.cantidadResultados
 * @param {{ ip: string, origen: 'cloudflare'|'conexion' }} busqueda.ipCliente
 * @returns {Promise<{ id: number, fechaHora: Date }>}
 */
export async function registrarBusqueda({ termino, criterio, cantidadResultados, ipCliente }) {
  const registro = await repositorio.registrar({
    termino,
    criterio,
    cantidadResultados,
    ip: ipCliente.ip,
    ipOrigen: ipCliente.origen,
  });
  return { id: registro.id, fechaHora: registro.fecha_hora };
}