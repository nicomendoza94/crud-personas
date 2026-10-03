/**
 * Rutas de búsqueda. Se montan bajo /api/busquedas en app.js.
 *
 *  POST /api/busquedas/desafio       Crea un desafío del captcha deslizante (imágenes, sin la respuesta)
 *  POST /api/busquedas/verificacion  Verifica el captcha y abre una sesión de búsqueda
 *  POST /api/busquedas               Busca (requiere una sesión vigente)
 */
import { Router } from 'express';
import * as controlador from '../controladores/busquedas.controlador.js';
import { exigirSesionBusqueda } from '../middlewares/sesionBusqueda.js';
import { limiteBusquedas, limiteIntentosCaptcha } from '../middlewares/limitesSolicitudes.js';

const router = Router();

// Límite de frecuencia para todas las rutas de búsqueda (verificación incluida)
router.use(limiteBusquedas);

router.post('/desafio', controlador.crearDesafio);
router.post('/verificacion', limiteIntentosCaptcha, controlador.verificarCaptcha);
router.post('/', exigirSesionBusqueda, controlador.buscar);

export default router;