/**
 * Captcha deslizante propio: un rompecabezas generado por el servidor.
 *
 * El servidor elige al azar dónde va el hueco, dibuja un fondo aleatorio, recorta
 * la pieza y guarda en la base SOLO la posición horizontal correcta. Al navegador
 * le envía las dos imágenes, nunca la posición: la respuesta correcta la conoce
 * solo el servidor. El navegador envía la posición donde el usuario soltó la
 * pieza, y el servidor decide.
 *
 * Reglas de la verificación:
 *  - Un solo intento por desafío: se elimina al verificarlo, acierte o no.
 *  - El desafío vence a los VIGENCIA_SEGUNDOS.
 *  - Exige un tiempo mínimo de resolución (una persona no responde al instante).
 *  - Acepta un pequeño margen de error en la posición.
 *
 * Limitación conocida: un programa podría analizar la imagen para encontrar el
 * hueco. Se mitiga con fondos aleatorios distintos en cada desafío, un único
 * intento, el tiempo mínimo, el límite de solicitudes por IP y la sesión de
 * búsqueda limitada.
 */
import crypto from 'node:crypto';
import sharp from 'sharp';
import { ErrorAplicacion } from '../middlewares/errores.js';
import * as repositorio from '../repositorios/desafios.repositorio.js';

// --- Dimensiones (en píxeles) ---
export const ANCHO = 320;
export const ALTO = 160;
export const LADO_PIEZA = 50;
const MARGEN = 10;
// El hueco nunca empieza junto al borde izquierdo, donde arranca la pieza:
// así la posición inicial no puede coincidir por casualidad con la correcta
const X_MINIMA = LADO_PIEZA + 20;

// --- Reglas de la verificación ---
const VIGENCIA_SEGUNDOS = 120;
const TIEMPO_MINIMO_MS = 1000;
export const TOLERANCIA_PX = 6;

// Cantidad de formas al azar del fondo: dificultan detectar el hueco automáticamente
const CANTIDAD_FORMAS = 14;

// Formato de un UUID (validación previa a consultar la base)
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Entero aleatorio entre min y max (inclusive), con un generador seguro. */
function aleatorio(min, max) {
  return crypto.randomInt(min, max + 1);
}

/** Color aleatorio en formato #rrggbb. */
function colorAleatorio() {
  return `#${crypto.randomBytes(3).toString('hex')}`;
}

/** Fondo aleatorio en SVG: un degradé y formas de colores superpuestas. */
function generarFondoSvg() {
  const formas = [];
  for (let i = 0; i < CANTIDAD_FORMAS; i++) {
    const color = colorAleatorio();
    const opacidad = (aleatorio(25, 70) / 100).toFixed(2);
    if (i % 2 === 0) {
      formas.push(
        `<circle cx="${aleatorio(0, ANCHO)}" cy="${aleatorio(0, ALTO)}" r="${aleatorio(10, 45)}" ` +
          `fill="${color}" fill-opacity="${opacidad}"/>`,
      );
    } else {
      const x = aleatorio(0, ANCHO);
      const y = aleatorio(0, ALTO);
      formas.push(
        `<rect x="${x}" y="${y}" width="${aleatorio(20, 80)}" height="${aleatorio(10, 40)}" rx="6" ` +
          `fill="${color}" fill-opacity="${opacidad}" transform="rotate(${aleatorio(0, 90)} ${x} ${y})"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}">
    <defs>
      <linearGradient id="degrade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colorAleatorio()}"/>
        <stop offset="1" stop-color="${colorAleatorio()}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#degrade)"/>
    ${formas.join('\n    ')}
  </svg>`;
}

/** Un cuadrado del tamaño de la pieza, con bordes redondeados, en SVG. */
function cuadradoSvg(atributos) {
  const lado = LADO_PIEZA;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}">
       <rect x="1" y="1" width="${lado - 2}" height="${lado - 2}" rx="9" ${atributos}/>
     </svg>`,
  );
}

/**
 * Genera las dos imágenes del desafío para un hueco en (x, y).
 * @returns {Promise<{fondo: Buffer, pieza: Buffer}>} En formato WebP
 */
async function generarImagenes(x, y) {
  const fondo = await sharp(Buffer.from(generarFondoSvg())).png().toBuffer();

  // La pieza: el cuadrado del fondo en (x, y), con bordes redondeados y un borde claro.
  // "dest-in" conserva solo la parte de la imagen que queda dentro de la máscara.
  const pieza = await sharp(fondo)
    .extract({ left: x, top: y, width: LADO_PIEZA, height: LADO_PIEZA })
    .ensureAlpha()
    .composite([
      { input: cuadradoSvg('fill="#fff"'), blend: 'dest-in' },
      { input: cuadradoSvg('fill="none" stroke="#fff" stroke-width="2"') },
    ])
    .webp({ lossless: true })
    .toBuffer();

  // El hueco: el mismo cuadrado, oscurecido en el fondo
  const fondoConHueco = await sharp(fondo)
    .composite([
      {
        input: cuadradoSvg('fill="#000" fill-opacity="0.45" stroke="#fff" stroke-opacity="0.8" stroke-width="2"'),
        left: x,
        top: y,
      },
    ])
    .webp({ quality: 80 })
    .toBuffer();

  return { fondo: fondoConHueco, pieza };
}

function aDataUrl(buffer) {
  return `data:image/webp;base64,${buffer.toString('base64')}`;
}

/**
 * Crea un desafío nuevo.
 * @returns {Promise<object>} Las imágenes y lo necesario para dibujarlas.
 *          NUNCA incluye la posición horizontal correcta.
 */
export async function crearDesafio() {
  // Limpieza de desafíos vencidos, para que la tabla no crezca indefinidamente
  await repositorio.eliminarVencidos();

  const x = aleatorio(X_MINIMA, ANCHO - LADO_PIEZA - MARGEN);
  const y = aleatorio(MARGEN, ALTO - LADO_PIEZA - MARGEN);
  const { fondo, pieza } = await generarImagenes(x, y);

  const id = crypto.randomUUID();
  await repositorio.crear(id, x, VIGENCIA_SEGUNDOS);

  return {
    id,
    fondo: aDataUrl(fondo),
    pieza: aDataUrl(pieza),
    piezaY: y, // la altura no es secreta: lo secreto es la posición horizontal
    ancho: ANCHO,
    alto: ALTO,
    ladoPieza: LADO_PIEZA,
  };
}

/** Indica si la posición enviada está dentro del margen aceptado (función pura). */
export function posicionAceptada(enviada, correcta, tolerancia = TOLERANCIA_PX) {
  return Math.abs(enviada - correcta) <= tolerancia;
}

/**
 * Verifica la respuesta del usuario a un desafío.
 *
 * @param {object} datos { desafioId, posicion }
 * @throws {ErrorAplicacion} 400 si los datos tienen un formato imposible,
 *                           403 si el desafío no existe, venció, ya se usó,
 *                               se resolvió demasiado rápido o la posición no es correcta
 */
export async function verificarCaptcha(datos) {
  const desafioId = datos?.desafioId;
  const posicion = datos?.posicion;

  // 1. Forma: un UUID y un número entero dentro de la imagen
  if (
    typeof desafioId !== 'string' ||
    !PATRON_UUID.test(desafioId) ||
    !Number.isInteger(posicion) ||
    posicion < 0 ||
    posicion > ANCHO
  ) {
    throw new ErrorAplicacion(400, 'Debe completar la verificación antes de buscar.');
  }

  // 2. Obtiene y BORRA el desafío en una sola operación: un único intento
  const desafio = await repositorio.consumir(desafioId);

  if (!desafio || !desafio.vigente) {
    throw new ErrorAplicacion(403, 'La verificación venció o ya fue utilizada. Complétela nuevamente.');
  }

  // 3. Una persona necesita al menos un instante para ver la imagen y arrastrar la pieza
  if (desafio.milisegundos < TIEMPO_MINIMO_MS) {
    throw new ErrorAplicacion(403, 'La verificación no es válida. Complétela nuevamente.');
  }

  // 4. La posición
  if (!posicionAceptada(posicion, desafio.posicion_x)) {
    throw new ErrorAplicacion(403, 'La pieza no quedó en su lugar. Intente nuevamente.');
  }
}