/**
 * Servicio de auditoría de búsquedas.
 *
 * 1. registrarBusqueda(): crea el registro ANTES de responder al usuario.
 *    Si falla, la búsqueda no se entrega (la auditoría es un control).
 * 2. completarEnSegundoPlano(): DESPUÉS de responder, agrega la geolocalización
 *    de la IP (y, en el próximo paso, la notificación a Telegram). Sus fallas
 *    no afectan al usuario: quedan registradas en el estado de cada columna.
 */
import * as repositorio from '../repositorios/auditoria.repositorio.js';
import { geolocalizar } from './geolocalizacion.servicio.js';

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

/** Tareas que completan el registro después de responder al usuario. */
async function completarRegistro(registro, ipCliente) {
  // geolocalizar() nunca lanza errores: siempre devuelve un estado
  const geo = await geolocalizar(ipCliente.ip);
  await repositorio.actualizarGeolocalizacion(registro.id, geo);
}

/**
 * Inicia las tareas en segundo plano SIN esperarlas (quien llama no usa await).
 *
 * El .catch es obligatorio: un error no capturado en una promesa sin await
 * terminaría el proceso de Node. Si algo falla, se registra en el log y las
 * columnas afectadas quedan en estado 'pendiente'.
 */
export function completarEnSegundoPlano(registro, ipCliente) {
  completarRegistro(registro, ipCliente).catch((err) => {
    console.error(`Auditoría ${registro.id}: no se pudo completar el registro:`, err.message);
  });
}