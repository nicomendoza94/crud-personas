/**
 * Determinación de la IP real del visitante detrás de Cloudflare Tunnel.
 *
 * Regla:
 *  - Si la conexión llega desde loopback (127.0.0.1 / ::1), quien se conectó es
 *    cloudflared (el túnel, en esta misma máquina). En ese caso se usa el
 *    encabezado CF-Connecting-IP, que Cloudflare escribe con la IP del visitante
 *    y REEMPLAZA si el cliente envía uno propio.
 *  - En cualquier otro caso se usa la IP de la conexión y se ignoran los encabezados.
 *
 * X-Forwarded-For no se usa nunca: el cliente puede agregar valores falsos al
 * comienzo de la lista, y Cloudflare los conserva.
 *
 * Es confiable porque el servidor escucha solo en 127.0.0.1: desde fuera de
 * esta máquina, la única vía de acceso es el túnel.
 */
import net from 'node:net';

/**
 * Valida y normaliza una dirección IP.
 * Convierte las IPv4 representadas como IPv6 ("::ffff:127.0.0.1" -> "127.0.0.1").
 * @returns {string|null} La IP normalizada, o null si no es una IP válida
 */
export function normalizarIp(valor) {
  if (typeof valor !== 'string') return null;

  let ip = valor.trim();
  if (ip.toLowerCase().startsWith('::ffff:') && net.isIPv4(ip.slice(7))) {
    ip = ip.slice(7);
  }
  // net.isIP devuelve 4, 6, o 0 si no es una IP válida
  return net.isIP(ip) ? ip : null;
}

/** true si la IP es de loopback (la propia máquina). */
export function esLoopback(ip) {
  if (!ip) return false;
  return ip === '::1' || (net.isIPv4(ip) && ip.startsWith('127.'));
}

/**
 * Determina la IP del visitante.
 *
 * @param {object} datos
 * @param {string} datos.direccionConexion   IP de la conexión TCP (req.socket.remoteAddress)
 * @param {string} [datos.encabezadoCloudflare] Valor del encabezado CF-Connecting-IP
 * @returns {{ ip: string, origen: 'cloudflare'|'conexion' }}
 */
export function resolverIpCliente({ direccionConexion, encabezadoCloudflare }) {
  const ipConexion = normalizarIp(direccionConexion);

  // Solo se confía en el encabezado si la conexión viene del túnel (loopback)
  if (esLoopback(ipConexion)) {
    const ipCloudflare = normalizarIp(encabezadoCloudflare);
    if (ipCloudflare) {
      return { ip: ipCloudflare, origen: 'cloudflare' };
    }
  }

  // Caso excepcional: si ni siquiera la conexión tiene una IP válida
  return { ip: ipConexion ?? '0.0.0.0', origen: 'conexion' };
}