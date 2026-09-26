/**
 * Rutas de búsqueda. Se montan bajo /api/busquedas en app.js.
 *
 *  POST /api/busquedas/verificacion  Verifica el captcha y abre una sesión de búsqueda
 *  POST /api/busquedas               Busca (requiere una sesión vigente)
 */
import { Router } from 'express';
import * as controlador from '../controladores/busquedas.controlador.js';
import { exigirSesionBusqueda } from '../middlewares/sesionBusqueda.js';

const router = Router();

router.post('/verificacion', controlador.verificarCaptcha);
router.post('/', exigirSesionBusqueda, controlador.buscar);

export default router;