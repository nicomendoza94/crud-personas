/**
 * Pool de conexiones a PostgreSQL.
 *
 * Abrir una conexión es costoso (red + autenticación). El pool mantiene
 * algunas conexiones abiertas y las presta a cada consulta. Se crea una
 * única vez y todos los repositorios importan este mismo objeto.
 */
import pg from 'pg';
import { config } from '../config/entorno.js';

const { Pool, types } = pg;

// Por defecto, `pg` convierte las columnas DATE en objetos Date de JavaScript
// a la medianoche de la zona horaria local. Una fecha de nacimiento no tiene hora
// ni zona: convertirla puede correrla un día según el huso horario del servidor.
// Por eso pedimos que el tipo DATE (código interno 1082) llegue como texto 'AAAA-MM-DD'.
types.setTypeParser(1082, (valor) => valor);

// El tipo BIGINT (código interno 20) llega como texto por defecto, porque
// puede superar el máximo entero exacto de JavaScript (2^53).
// Nuestros ids y conteos nunca se acercan a ese límite, así que es seguro
// convertirlos a número.
types.setTypeParser(20, (valor) => Number(valor));

export const pool = new Pool({
  host: config.db.host,
  port: config.db.puerto,
  database: config.db.nombre,
  user: config.db.usuario,
  password: config.db.contrasena,

  // Máximo de conexiones simultáneas. Suficiente para esta aplicación
  // y evita agotar las conexiones del servidor PostgreSQL.
  max: 10,
  // Cierra conexiones que estuvieron sin uso durante 30 segundos
  idleTimeoutMillis: 30_000,
  // Si no se logra conectar en 5 segundos, falla en vez de esperar indefinidamente
  connectionTimeoutMillis: 5_000,
  // Ninguna consulta puede durar más de 5 segundos: protege al servidor
  // de consultas que se cuelguen o sean abusivamente costosas
  statement_timeout: 5_000,
  // Nombre visible en pgAdmin (pestaña de actividad) para identificar a la app
  application_name: 'crud-personas',
});

// Si una conexión inactiva del pool se corta (por ejemplo, se reinicia PostgreSQL),
// `pg` emite un evento 'error'. Sin este manejador, Node cerraría todo el proceso.
pool.on('error', (err) => {
  console.error('Error inesperado en una conexión inactiva de la base de datos:', err.message);
});

/** Verifica que la base responde. Se usa al arrancar el servidor. */
export async function verificarConexion() {
  await pool.query('SELECT 1');
}

/** Cierra todas las conexiones del pool (apagado ordenado). */
export async function cerrarPool() {
  await pool.end();
}