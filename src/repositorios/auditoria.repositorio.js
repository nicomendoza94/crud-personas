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

/** Guarda el resultado de la geolocalización de la IP de un registro. */
export async function actualizarGeolocalizacion(id, geo) {
  await pool.query(
    `UPDATE auditoria_busquedas
        SET geo_estado       = $2,
            geo_pais         = $3,
            geo_ciudad       = $4,
            geo_organizacion = $5,
            geo_latitud      = $6,
            geo_longitud     = $7
      WHERE id = $1`,
    [
      id,
      geo.estado,
      geo.pais ?? null,
      geo.ciudad ?? null,
      geo.organizacion ?? null,
      geo.latitud ?? null,
      geo.longitud ?? null,
    ],
  );
}

/** Guarda el resultado del envío de la notificación a Telegram. */
export async function actualizarTelegram(id, { estado, detalle }) {
  await pool.query(
    'UPDATE auditoria_busquedas SET telegram_estado = $2, telegram_detalle = $3 WHERE id = $1',
    [id, estado, detalle ?? null],
  );
}