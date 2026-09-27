/**
 * Servicio de auditoría de búsquedas.
 *
 * 1. registrarBusqueda(): crea el registro ANTES de responder al usuario.
 *    Si falla, la búsqueda no se entrega (la auditoría es un control).
 * 2. completarEnSegundoPlano(): DESPUÉS de responder, agrega la geolocalización
 *    de la IP y envía la notificación a Telegram. Sus fallas no afectan al
 *    usuario: quedan registradas en el estado de cada columna.
 */
import { config } from '../config/entorno.js';
import * as repositorio from '../repositorios/auditoria.repositorio.js';
import { geolocalizar } from './geolocalizacion.servicio.js';
import { enviarMensaje } from './telegram.servicio.js';
import { construirMensajeBusqueda } from '../utils/mensajeTelegram.js';
import { TAMANIO_PAGINA } from './personas.servicio.js';

/**
 * @param {object} busqueda
 * @param {string} busqueda.termino
 * @param {'nombre'|'documento'} busqueda.criterio
 * @param {number} busqueda.cantidadResultados
 * @param {{ ip: string, origen: 'cloudflare'|'conexion' }} busqueda.ipCliente
 * @returns {Promise<{ id: number, fechaHora: Date, criterio: string, cantidadResultados: number }>}
 */
export async function registrarBusqueda({ termino, criterio, cantidadResultados, ipCliente }) {
  const registro = await repositorio.registrar({
    termino,
    criterio,
    cantidadResultados,
    ip: ipCliente.ip,
    ipOrigen: ipCliente.origen,
  });
  // Se devuelve lo necesario para completar el registro después, SIN el término:
  // las tareas en segundo plano (y el mensaje a Telegram) no lo necesitan.
  return { id: registro.id, fechaHora: registro.fecha_hora, criterio, cantidadResultados };
}

/** Tareas que completan el registro después de responder al usuario. */
async function completarRegistro(registro, ipCliente) {
  // 1. Geolocalización (nunca lanza errores: siempre devuelve un estado)
  const geo = await geolocalizar(ipCliente.ip);
  try {
    await repositorio.actualizarGeolocalizacion(registro.id, geo);
  } catch (err) {
    // Si no se pudo guardar, igual se intenta la notificación
    console.error(`Auditoría ${registro.id}: no se pudo guardar la geolocalización:`, err.message);
  }

  // 2. Notificación a Telegram (nunca lanza errores: devuelve estado y detalle)
  const mensaje = construirMensajeBusqueda({ ...registro, ip: ipCliente.ip, geo }, config.zonaHoraria);
  const envio = await enviarMensaje(mensaje);
  await repositorio.actualizarTelegram(registro.id, envio);
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

// -----------------------------------------------------------------------------
// Historial
// -----------------------------------------------------------------------------

/** NUMERIC llega como texto desde pg: se convierte a número (o null). */
function aNumero(valor) {
  return valor === null ? null : Number(valor);
}

/** Convierte una fila de la auditoría en el objeto que se envía al cliente. */
function aRegistroHistorial(fila) {
  return {
    id: fila.id,
    fechaHora: fila.fecha_hora,
    termino: fila.termino,
    criterio: fila.criterio,
    cantidadResultados: fila.cantidad_resultados,
    ip: fila.ip,
    ipOrigen: fila.ip_origen,
    geolocalizacion: {
      estado: fila.geo_estado,
      pais: fila.geo_pais,
      ciudad: fila.geo_ciudad,
      organizacion: fila.geo_organizacion,
      latitud: aNumero(fila.geo_latitud),
      longitud: aNumero(fila.geo_longitud),
    },
    telegram: {
      estado: fila.telegram_estado,
      detalle: fila.telegram_detalle,
    },
  };
}

/** Página del historial de búsquedas, de la más reciente a la más antigua. */
export async function listarHistorial(pagina) {
  const desplazamiento = (pagina - 1) * TAMANIO_PAGINA;
  const [filas, total] = await Promise.all([
    repositorio.listar({ limite: TAMANIO_PAGINA, desplazamiento }),
    repositorio.contar(),
  ]);

  return {
    datos: filas.map(aRegistroHistorial),
    paginacion: {
      pagina,
      tamanioPagina: TAMANIO_PAGINA,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / TAMANIO_PAGINA)),
    },
    retencionDias: config.auditoria.retencionDias,
  };
}

// -----------------------------------------------------------------------------
// Política de retención
// -----------------------------------------------------------------------------

const INTERVALO_RETENCION_MS = 24 * 60 * 60 * 1000; // Una vez por día

/** Elimina los registros más antiguos que el plazo de retención. */
export async function aplicarRetencion() {
  const { retencionDias } = config.auditoria;
  const eliminados = await repositorio.eliminarAnterioresA(retencionDias);
  if (eliminados > 0) {
    console.log(`Retención: se eliminaron ${eliminados} registros de auditoría con más de ${retencionDias} días`);
  }
  return eliminados;
}

/**
 * Aplica la retención al iniciar y luego una vez por día.
 * Una falla (por ejemplo, la base no disponible) se registra y se reintenta
 * en la siguiente ejecución: no detiene el servidor.
 */
export function programarRetencion() {
  const ejecutar = () =>
    aplicarRetencion().catch((err) => {
      console.error('Retención: no se pudo aplicar:', err.message);
    });

  ejecutar();
  const temporizador = setInterval(ejecutar, INTERVALO_RETENCION_MS);
  // unref(): el temporizador no impide que el proceso termine (apagado ordenado)
  temporizador.unref();
}