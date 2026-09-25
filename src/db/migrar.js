/**
 * Script de migraciones.
 *
 * Ejecuta en orden los archivos .sql de src/db/migraciones que todavía
 * no se aplicaron en esta base. Cada migración corre en una transacción:
 * si falla, se deshace por completo y el script se detiene.
 *
 * Uso: npm run migrar
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pool, cerrarPool } from './conexion.js';

const CARPETA_MIGRACIONES = path.join(import.meta.dirname, 'migraciones');

// Solo se consideran archivos con el formato NNN_descripcion.sql
// (ej: 001_crear_tabla_personas.sql). Ignora .gitkeep u otros archivos.
const PATRON_NOMBRE = /^\d{3}_[a-z0-9_]+\.sql$/;

/** Devuelve los nombres de archivo de migración, ordenados por su número. */
async function obtenerArchivosMigracion() {
  const archivos = await fs.readdir(CARPETA_MIGRACIONES);
  // El número con ceros a la izquierda (001, 002...) hace que el orden
  // alfabético coincida con el orden numérico.
  return archivos.filter((nombre) => PATRON_NOMBRE.test(nombre)).sort();
}

async function migrar() {
  // Se usa un único cliente (conexión) para todo el proceso: las transacciones
  // (BEGIN/COMMIT) solo funcionan si todas las consultas van por la misma conexión.
  const cliente = await pool.connect();

  try {
    // Tabla de control: registra qué migraciones ya se ejecutaron
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
        nombre      VARCHAR(255) PRIMARY KEY,
        aplicada_en TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await cliente.query('SELECT nombre FROM migraciones_aplicadas');
    const aplicadas = new Set(rows.map((fila) => fila.nombre));

    const pendientes = (await obtenerArchivosMigracion()).filter((nombre) => !aplicadas.has(nombre));

    if (pendientes.length === 0) {
      console.log('No hay migraciones pendientes. La base está actualizada.');
      return;
    }

    for (const nombre of pendientes) {
      const sql = await fs.readFile(path.join(CARPETA_MIGRACIONES, nombre), 'utf8');

      try {
        await cliente.query('BEGIN');
        // Sin parámetros, `pg` permite ejecutar varias sentencias SQL en una sola llamada
        await cliente.query(sql);
        await cliente.query('INSERT INTO migraciones_aplicadas (nombre) VALUES ($1)', [nombre]);
        await cliente.query('COMMIT');
        console.log(`[OK] Aplicada: ${nombre}`);
      } catch (err) {
        // Deshace todo lo que hizo esta migración, incluidas tablas creadas a medias
        await cliente.query('ROLLBACK');
        throw new Error(`Falló la migración ${nombre}: ${err.message}`, { cause: err });
      }
    }

    console.log(`Migraciones completadas: ${pendientes.length}.`);
  } finally {
    // Devuelve la conexión al pool, haya salido bien o mal
    cliente.release();
  }
}

try {
  await migrar();
} catch (err) {
  console.error(err.message);
  // exitCode en lugar de process.exit(): deja que el bloque finally cierre el pool
  process.exitCode = 1;
} finally {
  await cerrarPool();
}