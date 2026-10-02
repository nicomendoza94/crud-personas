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
import rutasBusquedas from './rutas/busquedas.rutas.js';
import cookieParser from 'cookie-parser';
import rutasConfiguracion from './rutas/configuracion.rutas.js';
import { identificarIpCliente } from './middlewares/ipCliente.js';
import rutasAuditoria from './rutas/auditoria.rutas.js';
import { limiteGeneral } from './middlewares/limitesSolicitudes.js';

// import.meta.dirname es la carpeta de este archivo (src/). La carpeta pública está un nivel arriba.
const RUTA_PUBLICA = path.join(import.meta.dirname, '..', 'public');

export function crearApp() {
  const app = express();

  // 1. Encabezados de seguridad (CSP, nosniff, etc.). Va primero para cubrir todas las respuestas.
  //    La CSP de helmet solo permite recursos del propio servidor; se agrega
  //    exclusivamente el dominio de GeeTest (su script y el iframe del widget).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // GeeTest: su script, las imágenes del deslizador y sus consultas
          scriptSrc: ["'self'", 'https://static.geetest.com', 'https://gcaptcha4.geetest.com'],
          imgSrc: ["'self'", 'data:', 'https://static.geetest.com'],
          connectSrc: ["'self'", 'https://gcaptcha4.geetest.com'],
        },
      },
    }),
  );

  // Identifica la IP real del visitante (detrás de Cloudflare Tunnel).
  // Va antes que todo lo demás para que cualquier parte de la app pueda usarla.
  app.use(identificarIpCliente);

  // 2. Lectura de cuerpos JSON con límite de tamaño: evita que alguien
  //    envíe un JSON gigante para consumir memoria del servidor.
  //    (Las imágenes NO viajan por acá: tendrán su propio manejo con multer.)
  app.use(express.json({ limit: '10kb' }));

  // Lectura de cookies (sesión de búsqueda habilitada por el captcha)
  app.use(cookieParser());

    //  Límite general de solicitudes por IP (el visitante real, ya identificado)
  app.use('/api', limiteGeneral);

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

  app.use('/api/busquedas', rutasBusquedas);

  app.use('/api/configuracion', rutasConfiguracion);

  app.use('/api/auditoria', rutasAuditoria);

  // 4. Archivos del front end. Solo se sirve la carpeta public/:
  //    nada de src/, .env ni almacenamiento/ es accesible desde la web.
  app.use(express.static(RUTA_PUBLICA));

  // 5. Todo lo que no coincidió con nada anterior → 404
  app.use(rutaNoEncontrada);

  // 6. Manejador de errores: siempre al final
  app.use(manejadorErrores);

  return app;
}