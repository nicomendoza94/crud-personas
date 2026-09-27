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

/**
 * Página del historial, de la búsqueda más reciente a la más antigua.
 * host(ip) devuelve la dirección como texto, sin la máscara de red.
 */
export async function listar({ limite, desplazamiento }) {
  const { rows } = await pool.query(
    `SELECT id, fecha_hora, termino, criterio, cantidad_resultados,
            host(ip) AS ip, ip_origen,
            geo_estado, geo_pais, geo_ciudad, geo_organizacion, geo_latitud, geo_longitud,
            telegram_estado, telegram_detalle
       FROM auditoria_busquedas
      ORDER BY fecha_hora DESC, id DESC
      LIMIT $1 OFFSET $2`,
    [limite, desplazamiento],
  );
  return rows;
}

/** Cantidad total de registros (para la paginación). */
export async function contar() {
  const { rows } = await pool.query('SELECT COUNT(*) AS total FROM auditoria_busquedas');
  return rows[0].total;
}

/**
 * Elimina los registros más antiguos que la cantidad de días indicada.
 * @returns {Promise<number>} Cantidad de registros eliminados
 */
export async function eliminarAnterioresA(dias) {
  const { rowCount } = await pool.query(
    'DELETE FROM auditoria_busquedas WHERE fecha_hora < now() - make_interval(days => $1::int)',
    [dias],
  );
  return rowCount;
}