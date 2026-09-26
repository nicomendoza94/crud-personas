/**
 * Construcción de la aplicación Express.
 * Aquí solo se "arma" la app (middlewares y rutas); quien la pone a escuchar
 * es servidor.js. Esta separación permite importar la app en los tests.
 */
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { rutaNoEncontrada, manejadorErrores } from './middlewares/errores.js';
import rutasPersonas from './rutas/personas.rutas.js';

// import.meta.dirname es la carpeta de este archivo (src/). La carpeta pública está un nivel arriba.
const RUTA_PUBLICA = path.join(import.meta.dirname, '..', 'public');

export function crearApp() {
  const app = express();

  // 1. Encabezados de seguridad (CSP, nosniff, etc.). Va primero para cubrir todas las respuestas.
  app.use(helmet());

  // 2. Lectura de cuerpos JSON con límite de tamaño: evita que alguien
  //    envíe un JSON gigante para consumir memoria del servidor.
  //    (Las imágenes NO viajan por acá: tendrán su propio manejo con multer.)
  app.use(express.json({ limit: '10kb' }));

  // 3. Rutas de la API
  //    Las respuestas de la API contienen datos personales: se indica que no deben
  //    guardarse en caché (ni en el navegador ni en intermediarios como Cloudflare).
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  //    Endpoint de salud: permite verificar rápidamente que el servidor responde
  //    (útil para probar el túnel sin depender de la base de datos).
  app.get('/api/salud', (req, res) => {
    res.json({ estado: 'ok' });
  });

  app.use('/api/personas', rutasPersonas);

  // 4. Archivos del front end. Solo se sirve la carpeta public/:
  //    nada de src/, .env ni almacenamiento/ es accesible desde la web.
  app.use(express.static(RUTA_PUBLICA));

  // 5. Todo lo que no coincidió con nada anterior → 404
  app.use(rutaNoEncontrada);

  // 6. Manejador de errores: siempre al final
  app.use(manejadorErrores);

  return app;
}