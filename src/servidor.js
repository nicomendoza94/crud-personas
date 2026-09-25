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

// Apagado ordenado con Ctrl+C: deja terminar las peticiones en curso antes de salir.
// (Más adelante también cerraremos aquí la conexión a la base de datos.)
process.on('SIGINT', () => {
  console.log('\nCerrando servidor...');
  servidor.close(() => process.exit(0));
});