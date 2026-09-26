/**
 * Rutas de búsqueda. Se montan bajo /api/busquedas en app.js.
 * (En los próximos commits se agregan aquí la verificación del captcha
 * y el registro de auditoría.)
 */
import { Router } from 'express';
import * as controlador from '../controladores/busquedas.controlador.js';

const router = Router();

router.post('/', controlador.buscar);

export default router;