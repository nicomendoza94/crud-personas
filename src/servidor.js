/**
 * Punto de entrada: levanta el servidor HTTP.
 *
 * Escucha únicamente en 127.0.0.1 (configurable, pero debe mantenerse así):
 * de esta forma la única vía de acceso desde internet es el túnel de Cloudflare,
 * que corre en esta misma máquina. Esto es la base para confiar en la IP
 * que informa Cloudflare (ver middleware de IP en el commit de auditoría).
 */
import http from 'node:http';
import { config } from './config/entorno.js';
import { crearApp } from './app.js';
import { verificarConexion, cerrarPool } from './db/conexion.js';

// Fallar rápido: si la base de datos no responde, no tiene sentido levantar el servidor.
try {
  await verificarConexion();
  console.log(`Conectado a PostgreSQL (base: ${config.db.nombre})`);
} catch (err) {
  // err.message describe el problema (ej: contraseña incorrecta) sin exponer credenciales
  console.error('No se pudo conectar a la base de datos:', err.message);
  process.exit(1);
}

const app = crearApp();
const servidor = http.createServer(app);

servidor.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`El puerto ${config.puerto} ya está en uso. Cambie PUERTO en el archivo .env`);
  } else {
    console.error('No se pudo iniciar el servidor:', err);
  }
  process.exit(1);
});

servidor.listen(config.puerto, config.host, () => {
  console.log(`Servidor escuchando en http://${config.host}:${config.puerto} (entorno: ${config.entorno})`);
});

// Apagado ordenado: deja de aceptar conexiones, espera las peticiones en curso
// y cierra las conexiones a la base antes de salir.
// SIGINT = Ctrl+C. SIGTERM = cuando otro proceso pide terminar (ej: el reinicio de --watch).
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    console.log('\nCerrando servidor...');
    servidor.close(async () => {
      await cerrarPool();
      process.exit(0);
    });
  });
}