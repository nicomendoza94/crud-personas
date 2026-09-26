/**
 * Identifica la IP real del visitante en cada petición (ver utils/ip.js)
 * y la deja disponible en res.locals.ipCliente = { ip, origen }.
 */
import { resolverIpCliente } from '../utils/ip.js';

export function identificarIpCliente(req, res, next) {
  res.locals.ipCliente = resolverIpCliente({
    direccionConexion: req.socket.remoteAddress,
    // req.get lee un encabezado sin distinguir mayúsculas
    encabezadoCloudflare: req.get('cf-connecting-ip'),
  });
  next();
}