/**
 * Configuración pública que necesita el front end.
 * el captcha_id es público por diseño (el navegador lo necesita), y la Key nunca se expone.
 */
import { Router } from 'express';
import { config } from '../config/entorno.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    captcha: { captchaId: config.captcha.captchaId },
  });
});

export default router;