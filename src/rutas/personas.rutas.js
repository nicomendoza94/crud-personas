/**
 * Rutas de personas.
 * Se montan bajo /api/personas en app.js, por lo que "/" aquí
 * corresponde a /api/personas y "/:id" a /api/personas/:id.
 */
import { Router } from 'express';
import * as controlador from '../controladores/personas.controlador.js';
import { subirImagenesPersona } from '../middlewares/subida.js';
import { limiteEscrituras } from '../middlewares/limitesSolicitudes.js';

const router = Router();

router.get('/', controlador.listar);
router.get('/:id', controlador.obtener);
router.get('/:id/imagenes/:lado', controlador.obtenerImagen);

// Escritura: límite de frecuencia y luego el procesamiento del formulario multipart.
// El límite va primero: una solicitud rechazada no llega a procesar imágenes.
router.post('/', limiteEscrituras, subirImagenesPersona, controlador.crear);
router.put('/:id', limiteEscrituras, subirImagenesPersona, controlador.actualizar);
router.delete('/:id', limiteEscrituras, controlador.eliminar);

export default router;