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