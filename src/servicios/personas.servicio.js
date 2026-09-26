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
import { procesarImagen, guardarImagen, eliminarImagen, rutaDeImagen } from './imagenes.servicio.js';

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

// -----------------------------------------------------------------------------
// Escritura: alta, edición y baja
// -----------------------------------------------------------------------------

// Código de error de PostgreSQL para la violación de una restricción UNIQUE
const VIOLACION_UNICIDAD = '23505';

function esDocumentoDuplicado(err) {
  return err.code === VIOLACION_UNICIDAD && err.constraint === 'personas_nro_documento_unico';
}

/**
 * Valida y re-codifica las imágenes recibidas.
 * Se ejecuta ANTES de escribir nada en disco: si alguna es inválida,
 * la operación se corta sin dejar archivos guardados.
 *
 * @param {{ frente: Buffer|null, dorso: Buffer|null }} archivos
 * @returns {Promise<[Buffer|null, Buffer|null]>} Imágenes procesadas (null si no se envió)
 */
function procesarImagenesRecibidas(archivos) {
  return Promise.all([
    archivos.frente ? procesarImagen(archivos.frente, 'foto del frente') : null,
    archivos.dorso ? procesarImagen(archivos.dorso, 'foto del dorso') : null,
  ]);
}

/**
 * Guarda en disco las imágenes procesadas y ejecuta la operación en la base.
 * Si la operación falla, borra los archivos recién escritos (compensación):
 * así nunca quedan imágenes que ninguna persona referencia.
 *
 * @param {[Buffer|null, Buffer|null]} procesadas
 * @param {(imagenes: {imagenFrente: string|null, imagenDorso: string|null}) => Promise<any>} operacion
 */
async function guardarConCompensacion(procesadas, operacion) {
  const [frente, dorso] = procesadas;
  const guardadas = [];

  try {
    const imagenFrente = frente ? await guardarImagen(frente) : null;
    if (imagenFrente) guardadas.push(imagenFrente);

    const imagenDorso = dorso ? await guardarImagen(dorso) : null;
    if (imagenDorso) guardadas.push(imagenDorso);

    // "return await" (y no solo "return"): si la operación falla,
    // el error tiene que capturarse en ESTE catch para compensar.
    return await operacion({ imagenFrente, imagenDorso });
  } catch (err) {
    await Promise.all(guardadas.map(eliminarImagen));

    if (esDocumentoDuplicado(err)) {
      throw new ErrorAplicacion(409, 'Ya existe una persona con ese número de documento');
    }
    throw err;
  }
}

/**
 * Da de alta una persona. Las dos imágenes son obligatorias.
 * Orden: validar imágenes -> guardarlas en disco -> insertar en la base.
 */
export async function crear(datos, archivos) {
  if (!archivos.frente || !archivos.dorso) {
    throw new ErrorAplicacion(400, 'Las fotos del frente y del dorso del documento son obligatorias');
  }

  const procesadas = await procesarImagenesRecibidas(archivos);

  const id = await guardarConCompensacion(procesadas, (imagenes) =>
    repositorio.crear({ ...datos, ...imagenes }),
  );

  // Fuera de la compensación: si esta lectura fallara, la persona ya existe
  // y sus imágenes NO deben borrarse.
  return obtener(id);
}

/**
 * Edita una persona. Las imágenes son opcionales: solo se reemplazan las enviadas.
 * Las imágenes anteriores se borran recién cuando la base ya apunta a las nuevas.
 */
export async function actualizar(id, datos, archivos) {
  const actual = await repositorio.buscarPorId(id);
  if (!actual) {
    throw new ErrorAplicacion(404, 'La persona solicitada no existe');
  }

  const procesadas = await procesarImagenesRecibidas(archivos);

  await guardarConCompensacion(procesadas, async (imagenes) => {
    const actualizada = await repositorio.actualizar(id, { ...datos, ...imagenes });
    // Otra petición pudo haberla eliminado entre la lectura y la actualización
    if (!actualizada) {
      throw new ErrorAplicacion(404, 'La persona solicitada no existe');
    }
  });

  // La base ya referencia las imágenes nuevas: las reemplazadas quedan sin uso
  const [nuevoFrente, nuevoDorso] = procesadas;
  await Promise.all([
    nuevoFrente ? eliminarImagen(actual.imagen_frente) : null,
    nuevoDorso ? eliminarImagen(actual.imagen_dorso) : null,
  ]);

  return obtener(id);
}

/**
 * Elimina una persona y luego sus imágenes.
 * Orden: primero la base, después los archivos. Si falla el borrado de un
 * archivo, queda huérfano (inofensivo), pero nunca una persona apuntando
 * a una imagen inexistente.
 */
export async function eliminar(id) {
  const eliminada = await repositorio.eliminar(id);
  if (!eliminada) {
    throw new ErrorAplicacion(404, 'La persona solicitada no existe');
  }

  await Promise.all([
    eliminarImagen(eliminada.imagen_frente),
    eliminarImagen(eliminada.imagen_dorso),
  ]);
}

/**
 * Devuelve la ruta en disco de una imagen de la persona.
 * El nombre del archivo sale de la base, nunca de la petición.
 *
 * @param {'frente'|'dorso'} lado
 * @throws {ErrorAplicacion} 404 si la persona o la imagen no existen
 */
export async function obtenerRutaImagen(id, lado) {
  const persona = await repositorio.buscarPorId(id);
  if (!persona) {
    throw new ErrorAplicacion(404, 'La persona solicitada no existe');
  }

  const nombre = lado === 'frente' ? persona.imagen_frente : persona.imagen_dorso;
  const ruta = rutaDeImagen(nombre);
  if (!ruta) {
    throw new ErrorAplicacion(404, 'La imagen no está disponible');
  }

  return ruta;
}