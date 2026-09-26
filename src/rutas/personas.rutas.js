/**
 * Rutas de personas.
 * Se montan bajo /api/personas en app.js, por lo que "/" aquí
 * corresponde a /api/personas y "/:id" a /api/personas/:id.
 */
import { Router } from 'express';
import * as controlador from '../controladores/personas.controlador.js';

const router = Router();

router.get('/', controlador.listar);
router.get('/:id', controlador.obtener);

export default router;