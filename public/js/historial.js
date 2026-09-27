/**
 * Pantalla del historial de búsquedas (auditoría).
 *
 * Todo lo que viene de la API (incluido el término buscado, que escribió un
 * usuario, y los datos de la API de geolocalización) se inserta como texto:
 * textContent o append() con strings. Nunca innerHTML.
 */
import * as api from './api.js';
import { formatearFechaHora } from './formato.js';

// Textos legibles para cada estado registrado en la auditoría
const ETIQUETAS_GEOLOCALIZACION = {
  ok: 'Ubicada',
  ip_privada: 'IP privada o local',
  sin_datos: 'Sin datos',
  limite_excedido: 'Límite de la API',
  error: 'Falla de la API',
  pendiente: 'Pendiente',
};

const ETIQUETAS_TELEGRAM = {
  enviado: 'Enviado',
  error: 'Error',
  pendiente: 'Pendiente',
};

// Color de la etiqueta según el estado
const CLASE_ESTADO = {
  ok: 'estado-ok',
  enviado: 'estado-ok',
  error: 'estado-error',
  limite_excedido: 'estado-error',
  pendiente: 'estado-pendiente',
  ip_privada: 'estado-neutro',
  sin_datos: 'estado-neutro',
};

const el = {
  mensaje: document.getElementById('mensaje'),
  infoRetencion: document.getElementById('info-retencion'),
  cuerpoTabla: document.getElementById('cuerpo-tabla'),
  infoPagina: document.getElementById('info-pagina'),
  botonAnterior: document.getElementById('boton-anterior'),
  botonSiguiente: document.getElementById('boton-siguiente'),
};

const estado = { pagina: 1, totalPaginas: 1 };

// --- Construcción de celdas --------------------------------------------------

/**
 * Crea una celda con el contenido indicado. append() con un string inserta
 * TEXTO (no HTML), por lo que es tan seguro como textContent.
 */
function crearCelda(...contenido) {
  const celda = document.createElement('td');
  celda.append(...contenido);
  return celda;
}

/** Línea de texto secundario (más chica y gris) debajo del dato principal. */
function crearTextoSecundario(texto) {
  const elemento = document.createElement('small');
  elemento.className = 'texto-secundario';
  elemento.textContent = texto;
  return elemento;
}

/** Etiqueta de color para un estado. */
function crearEtiquetaEstado(valor, etiquetas) {
  const etiqueta = document.createElement('span');
  etiqueta.className = `estado ${CLASE_ESTADO[valor] ?? 'estado-neutro'}`;
  etiqueta.textContent = etiquetas[valor] ?? valor;
  return etiqueta;
}

function crearCeldaIp(registro) {
  const origen = registro.ipOrigen === 'cloudflare' ? 'vía túnel (Cloudflare)' : 'conexión directa';
  return crearCelda(registro.ip, crearTextoSecundario(origen));
}

function crearCeldaUbicacion({ estado: estadoGeo, pais, ciudad, organizacion, latitud, longitud }) {
  if (estadoGeo !== 'ok') {
    return crearCelda(crearEtiquetaEstado(estadoGeo, ETIQUETAS_GEOLOCALIZACION));
  }

  const contenido = [[ciudad, pais].filter(Boolean).join(', ')];
  if (organizacion) {
    contenido.push(crearTextoSecundario(organizacion));
  }
  if (latitud !== null && longitud !== null) {
    contenido.push(crearTextoSecundario(`${latitud.toFixed(4)}, ${longitud.toFixed(4)} (aprox.)`));
  }
  return crearCelda(...contenido);
}

function crearCeldaTelegram({ estado: estadoEnvio, detalle }) {
  const contenido = [crearEtiquetaEstado(estadoEnvio, ETIQUETAS_TELEGRAM)];
  if (detalle) {
    contenido.push(crearTextoSecundario(detalle));
  }
  return crearCelda(...contenido);
}

function crearFila(registro) {
  const fila = document.createElement('tr');
  fila.append(
    crearCelda(formatearFechaHora(registro.fechaHora), crearTextoSecundario(`Registro #${registro.id}`)),
    crearCelda(registro.termino),
    crearCelda(registro.criterio === 'documento' ? 'Documento' : 'Nombre'),
    crearCelda(String(registro.cantidadResultados)),
    crearCeldaIp(registro),
    crearCeldaUbicacion(registro.geolocalizacion),
    crearCeldaTelegram(registro.telegram),
  );
  return fila;
}

function crearFilaMensaje(texto) {
  const celda = crearCelda(texto);
  celda.colSpan = 7;
  celda.className = 'celda-vacia';
  const fila = document.createElement('tr');
  fila.append(celda);
  return fila;
}

// --- Carga -------------------------------------------------------------------

function mostrarError(texto) {
  el.mensaje.textContent = texto;
  el.mensaje.className = 'mensaje error';
  el.mensaje.hidden = false;
}

function actualizarBotones(cargando) {
  el.botonAnterior.disabled = cargando || estado.pagina <= 1;
  el.botonSiguiente.disabled = cargando || estado.pagina >= estado.totalPaginas;
}

async function cargarHistorial(pagina) {
  actualizarBotones(true);
  try {
    const { datos, paginacion, retencionDias } = await api.listarAuditoria(pagina);

    estado.pagina = paginacion.pagina;
    estado.totalPaginas = paginacion.totalPaginas;

    el.cuerpoTabla.replaceChildren(
      ...(datos.length > 0 ? datos.map(crearFila) : [crearFilaMensaje('Todavía no hay búsquedas registradas.')]),
    );
    el.infoPagina.textContent =
      `Página ${paginacion.pagina} de ${paginacion.totalPaginas} (${paginacion.total} búsquedas)`;
    el.infoRetencion.textContent =
      `Cada búsqueda ejecutada queda registrada. Los registros se conservan ${retencionDias} días ` +
      'y luego se eliminan automáticamente.';
  } catch (err) {
    el.cuerpoTabla.replaceChildren(crearFilaMensaje('No se pudo cargar el historial.'));
    mostrarError(err.message);
  } finally {
    actualizarBotones(false);
  }
}

el.botonAnterior.addEventListener('click', () => cargarHistorial(estado.pagina - 1));
el.botonSiguiente.addEventListener('click', () => cargarHistorial(estado.pagina + 1));

cargarHistorial(1);