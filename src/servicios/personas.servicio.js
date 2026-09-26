/**
 * Servicio de personas: lógica de negocio.
 *
 * Coordina el repositorio (datos) y decide qué información sale hacia el
 * cliente: agrega la edad derivada, renombra los campos a camelCase y no
 * expone los nombres internos de los archivos de imagen.
 */
import * as repositorio from '../repositorios/personas.repositorio.js';
import { calcularEdad, fechaHoyEnZona } from '../utils/edad.js';
import { config } from '../config/entorno.js';
import { ErrorAplicacion } from '../middlewares/errores.js';

// Cantidad de personas por página del listado
export const TAMANIO_PAGINA = 20;

/** Convierte una fila de la base en el objeto que se envía en el listado. */
function aResumen(fila, hoy) {
  return {
    id: fila.id,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    nroDocumento: fila.nro_documento,
    fechaNacimiento: fila.fecha_nacimiento,
    edad: calcularEdad(fila.fecha_nacimiento, hoy),
  };
}

/**
 * Devuelve una página del listado de personas.
 * Si la página pedida supera el total, devuelve una lista vacía
 * (con los datos de paginación para que el cliente sepa cuántas hay).
 */
export async function listar(pagina) {
  const desplazamiento = (pagina - 1) * TAMANIO_PAGINA;

  // Las dos consultas son independientes: se ejecutan en paralelo,
  // cada una con su propia conexión del pool.
  const [filas, total] = await Promise.all([
    repositorio.listar({ limite: TAMANIO_PAGINA, desplazamiento }),
    repositorio.contar(),
  ]);

  // "Hoy" se calcula una sola vez para toda la página
  const hoy = fechaHoyEnZona(config.zonaHoraria);

  return {
    datos: filas.map((fila) => aResumen(fila, hoy)),
    paginacion: {
      pagina,
      tamanioPagina: TAMANIO_PAGINA,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / TAMANIO_PAGINA)),
    },
  };
}

/**
 * Devuelve el detalle completo de una persona.
 * @throws {ErrorAplicacion} 404 si no existe
 */
export async function obtener(id) {
  const fila = await repositorio.buscarPorId(id);

  if (!fila) {
    throw new ErrorAplicacion(404, 'La persona solicitada no existe');
  }

  const hoy = fechaHoyEnZona(config.zonaHoraria);

  return {
    ...aResumen(fila, hoy),
    // URLs de la API en lugar de los nombres internos de los archivos
    imagenes: {
      frente: `/api/personas/${fila.id}/imagenes/frente`,
      dorso: `/api/personas/${fila.id}/imagenes/dorso`,
    },
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}