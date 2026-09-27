/**
 * Rutas del historial de búsquedas. Se montan bajo /api/auditoria en app.js.
 */
import { Router } from 'express';
import * as controlador from '../controladores/auditoria.controlador.js';

const router = Router();

router.get('/', controlador.listar);

export default router;