/**
 * Rutas de personas.
 * Se montan bajo /api/personas en app.js, por lo que "/" aquí
 * corresponde a /api/personas y "/:id" a /api/personas/:id.
 */
import { Router } from 'express';
import * as controlador from '../controladores/personas.controlador.js';
import { subirImagenesPersona } from '../middlewares/subida.js';

const router = Router();

router.get('/', controlador.listar);
router.get('/:id', controlador.obtener);
router.get('/:id/imagenes/:lado', controlador.obtenerImagen);

// El middleware de subida procesa el formulario multipart antes del controlador
router.post('/', subirImagenesPersona, controlador.crear);
router.put('/:id', subirImagenesPersona, controlador.actualizar);
router.delete('/:id', controlador.eliminar);

export default router;