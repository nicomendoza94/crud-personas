/**
 * Configuración pública que necesita el front end.
 * La clave de sitio de Turnstile es pública por diseño (el widget la usa en el
 * navegador), pero se lee de las variables de entorno para no escribirla en el
 * código. La clave secreta NUNCA se expone.
 */
import { Router } from 'express';
import { config } from '../config/entorno.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    captcha: { claveSitio: config.captcha.claveSitio },
  });
});

export default router;