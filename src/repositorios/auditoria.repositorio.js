/**
 * Repositorio de auditoría de búsquedas (tabla auditoria_busquedas).
 */
import { pool } from '../db/conexion.js';

/**
 * Registra una búsqueda ejecutada.
 * La geolocalización y el envío a Telegram quedan en estado 'pendiente'.
 *
 * @returns {Promise<{id: number, fecha_hora: Date}>}
 */
export async function registrar({ termino, criterio, cantidadResultados, ip, ipOrigen }) {
  const { rows } = await pool.query(
    `INSERT INTO auditoria_busquedas (termino, criterio, cantidad_resultados, ip, ip_origen)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, fecha_hora`,
    [termino, criterio, cantidadResultados, ip, ipOrigen],
  );
  return rows[0];
}