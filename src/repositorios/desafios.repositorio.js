/**
 * Repositorio de desafíos del captcha deslizante (tabla desafios_captcha).
 * La posición correcta del hueco vive solo aquí: nunca se envía al navegador.
 */
import { pool } from '../db/conexion.js';

/** Guarda un desafío nuevo con su posición correcta y su vencimiento. */
export async function crear(id, posicionX, vigenciaSegundos) {
  await pool.query(
    `INSERT INTO desafios_captcha (id, posicion_x, expira_en)
     VALUES ($1, $2, now() + make_interval(secs => $3::float8))`,
    [id, posicionX, vigenciaSegundos],
  );
}

/**
 * Obtiene el desafío y lo BORRA en una única operación atómica: cada desafío
 * admite un solo intento, acierte o no. Si llegan dos verificaciones del mismo
 * desafío a la vez, solo una lo encuentra.
 *
 * Además de la posición correcta, la base calcula si el desafío sigue vigente y
 * cuántos milisegundos pasaron desde que se creó (con su propio reloj).
 *
 * @returns {Promise<{posicion_x: number, vigente: boolean, milisegundos: number}|null>}
 *          null si el desafío no existe (o ya fue utilizado)
 */
export async function consumir(id) {
  const { rows } = await pool.query(
    `DELETE FROM desafios_captcha
      WHERE id = $1
      RETURNING posicion_x,
                expira_en > now() AS vigente,
                (EXTRACT(EPOCH FROM now() - creado_en) * 1000)::float8 AS milisegundos`,
    [id],
  );
  return rows[0] ?? null;
}

/** Borra los desafíos vencidos que nadie intentó resolver (limpieza). */
export async function eliminarVencidos() {
  await pool.query('DELETE FROM desafios_captcha WHERE expira_en <= now()');
}