/**
 * Repositorio de personas: acceso a la tabla `personas`.
 *
 * Es la única capa que contiene SQL. Todas las consultas son parametrizadas
 * ($1, $2...): los valores viajan separados del texto de la consulta, por lo
 * que no pueden alterar su estructura (protección contra inyección SQL).
 */
import { pool } from '../db/conexion.js';

// Columnas que necesita la grilla del listado. No incluye imágenes ni fechas
// de auditoría: la respuesta del listado debe ser liviana.
const COLUMNAS_LISTADO = 'id, nombres, apellidos, nro_documento, fecha_nacimiento';

/**
 * Devuelve una página de personas, en orden alfabético.
 * @param {{ limite: number, desplazamiento: number }} opciones
 */
export async function listar({ limite, desplazamiento }) {
  // COLUMNAS_LISTADO es una constante del código, no un dato del usuario:
  // insertarla en el texto es seguro. Los valores variables van siempre como $n.
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_LISTADO}
       FROM personas
      ORDER BY apellidos, nombres, id
      LIMIT $1 OFFSET $2`,
    [limite, desplazamiento],
  );
  return rows;
}

/** Cantidad total de personas (para calcular la cantidad de páginas). */
export async function contar() {
  const { rows } = await pool.query('SELECT COUNT(*) AS total FROM personas');
  return rows[0].total;
}

/**
 * Busca una persona por su id.
 * @returns {Promise<object|null>} La fila completa, o null si no existe.
 */
export async function buscarPorId(id) {
  const { rows } = await pool.query(
    `SELECT id, nombres, apellidos, nro_documento, fecha_nacimiento,
            imagen_frente, imagen_dorso, creado_en, actualizado_en
       FROM personas
      WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Inserta una persona y devuelve el id asignado por la base.
 * @param {object} persona Datos ya validados + nombres de archivo de las imágenes
 */
export async function crear(persona) {
  const { rows } = await pool.query(
    `INSERT INTO personas
       (nombres, apellidos, nro_documento, fecha_nacimiento, imagen_frente, imagen_dorso)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      persona.nombres,
      persona.apellidos,
      persona.nroDocumento,
      persona.fechaNacimiento,
      persona.imagenFrente,
      persona.imagenDorso,
    ],
  );
  return rows[0].id;
}

/**
 * Actualiza los datos de una persona.
 * Cada imagen se reemplaza solo si se indica un nombre nuevo;
 * con null, COALESCE conserva el valor actual de la columna.
 *
 * @returns {Promise<boolean>} true si la persona existía y fue actualizada
 */
export async function actualizar(id, persona) {
  const { rowCount } = await pool.query(
    `UPDATE personas
        SET nombres          = $2,
            apellidos        = $3,
            nro_documento    = $4,
            fecha_nacimiento = $5,
            imagen_frente    = COALESCE($6, imagen_frente),
            imagen_dorso     = COALESCE($7, imagen_dorso),
            actualizado_en   = now()
      WHERE id = $1`,
    [
      id,
      persona.nombres,
      persona.apellidos,
      persona.nroDocumento,
      persona.fechaNacimiento,
      persona.imagenFrente,
      persona.imagenDorso,
    ],
  );
  return rowCount > 0;
}

/**
 * Elimina una persona.
 * RETURNING devuelve los nombres de sus imágenes en la misma operación,
 * para poder borrar los archivos después.
 *
 * @returns {Promise<object|null>} { imagen_frente, imagen_dorso }, o null si no existía
 */
export async function eliminar(id) {
  const { rows } = await pool.query(
    'DELETE FROM personas WHERE id = $1 RETURNING imagen_frente, imagen_dorso',
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Busca personas cuyo número de documento empieza con el prefijo indicado.
 * El prefijo llega normalizado (solo [0-9A-Z]), por lo que no puede contener
 * comodines de LIKE. Usa el índice personas_nro_documento_prefijo.
 */
export async function buscarPorDocumento(prefijo, limite) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_LISTADO}
       FROM personas
      WHERE nro_documento LIKE $1 || '%'
      ORDER BY apellidos, nombres, id
      LIMIT $2`,
    [prefijo, limite],
  );
  return rows;
}

/**
 * Busca personas cuyo nombre completo contiene TODAS las palabras indicadas,
 * sin distinguir mayúsculas ni tildes. Usa el índice personas_busqueda_nombre.
 *
 * @param {string[]} palabras Palabras con los comodines de LIKE ya escapados
 */
export async function buscarPorNombre(palabras, limite) {
  // Una condición por palabra. Los marcadores ($1, $2...) los genera el código
  // según la cantidad de palabras: el texto del usuario nunca se inserta en el
  // SQL, viaja siempre como parámetro.
  const condiciones = palabras.map(
    (_, indice) =>
      `normalizar_texto(nombres || ' ' || apellidos) LIKE '%' || normalizar_texto($${indice + 1}) || '%' ESCAPE '\\'`,
  );

  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_LISTADO}
       FROM personas
      WHERE ${condiciones.join(' AND ')}
      ORDER BY apellidos, nombres, id
      LIMIT $${palabras.length + 1}`,
    [...palabras, limite],
  );
  return rows;
}