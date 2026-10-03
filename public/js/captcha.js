/**
 * Captcha deslizante propio: el usuario arrastra el botón del riel para mover la
 * pieza hasta el hueco del rompecabezas.
 *
 * Las imágenes las genera el servidor, que es el ÚNICO que conoce la posición
 * correcta. Este módulo solo dibuja el desafío y envía la posición donde el
 * usuario soltó la pieza: no decide si es correcta.
 *
 * Cada desafío admite un solo intento: si la respuesta es rechazada, se pide uno nuevo.
 */
import * as api from './api.js';

const el = {
  dialogo: document.getElementById('dialogo-captcha'),
  fondo: document.getElementById('fondo-captcha'),
  pieza: document.getElementById('pieza-captcha'),
  tirador: document.getElementById('tirador-captcha'),
  error: document.getElementById('error-captcha'),
  botonNuevo: document.getElementById('boton-nuevo-desafio'),
};

let pendiente = null; // La solicitud en curso: { resolver }
let desafio = null; // El desafío que se está mostrando (id y medidas)
let arrastre = null; // Mientras se arrastra: { inicioX, posicionInicial }
let posicion = 0; // Posición horizontal actual de la pieza, en píxeles
let enviando = false;

function mostrarError(texto) {
  el.error.textContent = texto;
  el.error.hidden = false;
}

function ocultarError() {
  el.error.hidden = true;
}

/** Mueve la pieza y el botón juntos, sin salirse de la imagen. */
function moverA(x) {
  const maximo = desafio ? desafio.ancho - desafio.ladoPieza : 0;
  posicion = Math.min(Math.max(x, 0), maximo);
  el.pieza.style.left = `${posicion}px`;
  el.tirador.style.left = `${posicion}px`;
}

/** Pide un desafío nuevo al servidor y lo dibuja. */
async function cargarDesafio() {
  desafio = null;
  el.tirador.disabled = true;
  moverA(0);
  try {
    desafio = await api.pedirDesafio();
    el.fondo.src = desafio.fondo;
    el.pieza.src = desafio.pieza;
    el.pieza.style.top = `${desafio.piezaY}px`;
    el.tirador.disabled = false;
  } catch (err) {
    mostrarError(err.message);
  }
}

/** Envía la posición al servidor, que decide si la pieza quedó en su lugar. */
async function enviarRespuesta() {
  enviando = true;
  el.tirador.disabled = true;
  try {
    await api.verificarCaptcha({ desafioId: desafio.id, posicion: Math.round(posicion) });
    terminar(true);
  } catch (err) {
    // Un solo intento por desafío: se muestra el motivo y se pide uno nuevo
    mostrarError(err.message);
    await cargarDesafio();
  } finally {
    enviando = false;
  }
}

/** Cierra el diálogo y devuelve el resultado, una sola vez. */
function terminar(verificado) {
  if (!pendiente) return;
  const { resolver } = pendiente;
  pendiente = null;
  if (el.dialogo.open) el.dialogo.close();
  resolver(verificado);
}

// --- Arrastre con los eventos del puntero (mouse, dedo o lápiz) ---

el.tirador.addEventListener('pointerdown', (evento) => {
  if (!desafio || enviando) return;
  arrastre = { inicioX: evento.clientX, posicionInicial: posicion };
  // Sigue recibiendo los movimientos aunque el puntero salga del botón
  el.tirador.setPointerCapture(evento.pointerId);
});

el.tirador.addEventListener('pointermove', (evento) => {
  if (!arrastre) return;
  moverA(arrastre.posicionInicial + (evento.clientX - arrastre.inicioX));
});

el.tirador.addEventListener('pointerup', () => {
  if (!arrastre) return;
  arrastre = null;
  ocultarError();
  enviarRespuesta();
});

// Si el sistema interrumpe el arrastre, la pieza vuelve al inicio
el.tirador.addEventListener('pointercancel', () => {
  arrastre = null;
  moverA(0);
});

el.botonNuevo.addEventListener('click', () => {
  ocultarError();
  cargarDesafio();
});

// Cancelar (botón o tecla Esc) equivale a no verificar
el.dialogo.addEventListener('close', () => terminar(false));

/**
 * Muestra el captcha y espera a que el usuario lo resuelva.
 * @returns {Promise<boolean>} true si se verificó y hay sesión de búsqueda;
 *                             false si el usuario canceló
 */
export function solicitarCaptcha() {
  ocultarError();
  el.dialogo.showModal();
  const promesa = new Promise((resolver) => {
    pendiente = { resolver };
  });
  cargarDesafio();
  return promesa;
}