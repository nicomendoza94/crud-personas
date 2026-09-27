/**
 * Geolocalización de direcciones IP con la API pública de ipapi.co.
 *
 * Elección: ipapi.co funciona por HTTPS sin registro y entrega país, ciudad,
 * organización y coordenadas. (ip-api.com se descartó: su plan gratuito solo
 * funciona por HTTP, lo que enviaría las IPs de los visitantes sin cifrar.)
 *
 * geolocalizar() NUNCA lanza errores: siempre devuelve un resultado con un estado
 * ('ok', 'ip_privada', 'sin_datos', 'limite_excedido' o 'error'), que se registra
 * en la auditoría. Una falla de la API no afecta la búsqueda del usuario.
 */
import { config } from '../config/entorno.js';
import { esIpNoPublica } from '../utils/ip.js';

const URL_API = 'https://ipapi.co';

// Caché en memoria: la ubicación de una IP no cambia de un minuto a otro,
// y cada consulta repetida gastaría la cuota gratuita
const DURACION_CACHE_MS = 24 * 60 * 60 * 1000;
const MAXIMO_ENTRADAS_CACHE = 1000;
const cache = new Map(); // ip -> { resultado, expira }

// Tras superar el límite de la API, se deja de consultarla durante un tiempo
const PAUSA_POR_DEFECTO_MS = 60 * 1000;
let pausadaHasta = 0;

// --- Validación de los datos recibidos (vienen de un tercero) ----------------

/** Texto recortado al largo máximo de su columna, o null. */
function textoSeguro(valor, largoMaximo) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio ? limpio.slice(0, largoMaximo) : null;
}

/** Número dentro de un rango, o null. */
function numeroSeguro(valor, minimo, maximo) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= minimo && numero <= maximo ? numero : null;
}

// --- Caché y pausa -----------------------------------------------------------

function leerCache(ip) {
  const entrada = cache.get(ip);
  if (!entrada) return null;
  if (entrada.expira < Date.now()) {
    cache.delete(ip);
    return null;
  }
  return entrada.resultado;
}

function guardarEnCache(ip, resultado) {
  // Un Map recorre sus claves en orden de inserción: la primera es la más antigua
  if (cache.size >= MAXIMO_ENTRADAS_CACHE) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(ip, { resultado, expira: Date.now() + DURACION_CACHE_MS });
}

/** Deja de consultar la API por el tiempo indicado (o el de por defecto). */
function pausarConsultas(segundosIndicados) {
  const esperaMs = segundosIndicados > 0 ? segundosIndicados * 1000 : PAUSA_POR_DEFECTO_MS;
  pausadaHasta = Date.now() + esperaMs;
  console.warn(`Geolocalización: límite de la API superado; consultas pausadas ${esperaMs / 1000} s`);
}

// --- Consulta ----------------------------------------------------------------

/**
 * Obtiene la información disponible de una IP.
 * @param {string} ip IP ya validada
 * @returns {Promise<{estado: string, pais?: string, ciudad?: string,
 *   organizacion?: string, latitud?: number, longitud?: number}>}
 */
export async function geolocalizar(ip) {
  // 1. IPs privadas o reservadas: la API no tiene datos útiles; no se consulta
  if (esIpNoPublica(ip)) {
    return { estado: 'ip_privada' };
  }

  // 2. Resultado reciente guardado
  const enCache = leerCache(ip);
  if (enCache) return enCache;

  // 3. Límite superado recientemente: no se insiste
  if (Date.now() < pausadaHasta) {
    return { estado: 'limite_excedido' };
  }

  let respuesta;
  let datos;
  try {
    respuesta = await fetch(`${URL_API}/${encodeURIComponent(ip)}/json/`, {
      headers: { Accept: 'application/json', 'User-Agent': 'crud-personas/1.0' },
      // Tiempo máximo de espera: si la API demora, se abandona la consulta
      signal: AbortSignal.timeout(config.geolocalizacion.tiempoMaximoMs),
    });
    datos = await respuesta.json();
  } catch (err) {
    const motivo = err.name === 'TimeoutError' ? 'tiempo de espera agotado' : err.message;
    console.error(`Geolocalización: no se pudo consultar la API (${motivo})`);
    return { estado: 'error' };
  }

  // 4. Límite de uso superado (la API lo indica con 429 o con reason "RateLimited")
  if (respuesta.status === 429 || datos?.reason === 'RateLimited') {
    pausarConsultas(Number(respuesta.headers.get('retry-after')));
    return { estado: 'limite_excedido' };
  }

  // 5. La API respondió con un error propio
  if (!respuesta.ok || datos?.error) {
    if (datos?.reserved) return { estado: 'ip_privada' };
    console.error(`Geolocalización: la API respondió ${respuesta.status} (${datos?.reason ?? 'sin detalle'})`);
    return { estado: respuesta.ok ? 'sin_datos' : 'error' };
  }

  // 6. Respuesta válida: se toman solo los campos necesarios, validados
  const resultado = {
    pais: textoSeguro(datos.country_name, 100),
    ciudad: textoSeguro(datos.city, 100),
    organizacion: textoSeguro(datos.org, 200),
    latitud: numeroSeguro(datos.latitude, -90, 90),
    longitud: numeroSeguro(datos.longitude, -180, 180),
  };
  resultado.estado = resultado.pais || resultado.ciudad ? 'ok' : 'sin_datos';

  guardarEnCache(ip, resultado);
  return resultado;
}