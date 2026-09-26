/**
 * Interfaz de gestión de personas: listado paginado, alta, edición,
 * detalle con imágenes y eliminación.
 *
 * Regla de seguridad: los datos que vienen de la API se insertan SIEMPRE con
 * textContent (nunca con innerHTML). Así se muestran como texto y no pueden
 * interpretarse como HTML ni ejecutar código, aunque contengan etiquetas.
 */
import * as api from './api.js';
import {
  formatearFecha,
  formatearFechaHora,
  formatearDocumento,
  formatearEdad,
  fechaHoyLocal,
} from './formato.js';

// Mismo límite que el servidor. Aquí es solo para avisar antes de enviar:
// el control real lo hace el servidor.
const TAMANIO_MAXIMO_IMAGEN = 2 * 1024 * 1024;
const DURACION_MENSAJE_MS = 5000;

// --- Referencias a los elementos del HTML ------------------------------------
const el = {
  mensaje: document.getElementById('mensaje'),
  cuerpoTabla: document.getElementById('cuerpo-tabla'),
  infoPagina: document.getElementById('info-pagina'),
  botonAnterior: document.getElementById('boton-anterior'),
  botonSiguiente: document.getElementById('boton-siguiente'),
  botonNueva: document.getElementById('boton-nueva'),

  dialogoFormulario: document.getElementById('dialogo-formulario'),
  formulario: document.getElementById('formulario-persona'),
  tituloFormulario: document.getElementById('titulo-formulario'),
  ayudaImagenes: document.getElementById('ayuda-imagenes'),
  erroresFormulario: document.getElementById('errores-formulario'),
  botonGuardar: document.getElementById('boton-guardar'),

  dialogoDetalle: document.getElementById('dialogo-detalle'),
  datosDetalle: document.getElementById('datos-detalle'),
  imagenFrente: document.getElementById('imagen-frente'),
  imagenDorso: document.getElementById('imagen-dorso'),

  dialogoConfirmar: document.getElementById('dialogo-confirmar'),
  textoConfirmar: document.getElementById('texto-confirmar'),
  botonConfirmarEliminar: document.getElementById('boton-confirmar-eliminar'),
};

// Campos del formulario, accesibles por su atributo name
const campos = el.formulario.elements;

// --- Estado de la interfaz ---------------------------------------------------
const estado = {
  pagina: 1,
  totalPaginas: 1,
  personasDePagina: new Map(), // id -> persona, de la página visible
  idEnEdicion: null, // null = alta; número = edición de esa persona
  idAEliminar: null,
};

// =============================================================================
// Mensajes
// =============================================================================

let temporizadorMensaje;

/** Muestra un mensaje de estado que desaparece solo después de unos segundos. */
function mostrarMensaje(texto, tipo = 'exito') {
  el.mensaje.textContent = texto;
  el.mensaje.className = `mensaje ${tipo}`;
  el.mensaje.hidden = false;

  clearTimeout(temporizadorMensaje);
  temporizadorMensaje = setTimeout(() => {
    el.mensaje.hidden = true;
  }, DURACION_MENSAJE_MS);
}

// =============================================================================
// Listado
// =============================================================================

function crearCelda(texto) {
  const celda = document.createElement('td');
  celda.textContent = texto;
  return celda;
}

function crearBotonAccion(texto, accion, id, claseExtra = '') {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = `boton boton-chico ${claseExtra}`.trim();
  boton.textContent = texto;
  // Los atributos data-* identifican qué hacer y sobre quién (ver delegación de eventos)
  boton.dataset.accion = accion;
  boton.dataset.id = String(id);
  return boton;
}

function crearFila(persona) {
  const fila = document.createElement('tr');
  fila.append(
    crearCelda(persona.apellidos),
    crearCelda(persona.nombres),
    crearCelda(formatearDocumento(persona.nroDocumento)),
    crearCelda(formatearFecha(persona.fechaNacimiento)),
    crearCelda(formatearEdad(persona.edad)),
  );

  const acciones = document.createElement('div');
  acciones.className = 'celda-acciones';
  acciones.append(
    crearBotonAccion('Ver', 'ver', persona.id),
    crearBotonAccion('Editar', 'editar', persona.id),
    crearBotonAccion('Eliminar', 'eliminar', persona.id, 'boton-peligro'),
  );

  const celdaAcciones = document.createElement('td');
  celdaAcciones.append(acciones);
  fila.append(celdaAcciones);
  return fila;
}

/** Fila única con un texto (listado vacío o con error). */
function crearFilaMensaje(texto) {
  const celda = crearCelda(texto);
  celda.colSpan = 6;
  celda.className = 'celda-vacia';
  const fila = document.createElement('tr');
  fila.append(celda);
  return fila;
}

/** Habilita o deshabilita la paginación según la página actual y si hay una carga en curso. */
function actualizarBotonesPaginacion(cargando) {
  el.botonAnterior.disabled = cargando || estado.pagina <= 1;
  el.botonSiguiente.disabled = cargando || estado.pagina >= estado.totalPaginas;
}

/** Pide una página a la API y la dibuja en la tabla. */
async function cargarListado(pagina = estado.pagina) {
  actualizarBotonesPaginacion(true);
  let paginaCorregida = null;

  try {
    const { datos, paginacion } = await api.listarPersonas(pagina);

    // Si la página quedó fuera de rango (ej: se eliminó la última persona
    // de la última página), se carga la última página existente.
    if (datos.length === 0 && paginacion.total > 0 && pagina > paginacion.totalPaginas) {
      paginaCorregida = paginacion.totalPaginas;
      return;
    }

    estado.pagina = paginacion.pagina;
    estado.totalPaginas = paginacion.totalPaginas;
    estado.personasDePagina = new Map(datos.map((persona) => [persona.id, persona]));

    const filas = datos.length > 0
      ? datos.map(crearFila)
      : [crearFilaMensaje('No hay personas registradas.')];
    el.cuerpoTabla.replaceChildren(...filas);

    el.infoPagina.textContent =
      `Página ${paginacion.pagina} de ${paginacion.totalPaginas} (${paginacion.total} personas)`;
  } catch (err) {
    el.cuerpoTabla.replaceChildren(crearFilaMensaje('No se pudo cargar el listado.'));
    mostrarMensaje(err.message, 'error');
  } finally {
    actualizarBotonesPaginacion(false);
  }

  if (paginaCorregida !== null) {
    await cargarListado(paginaCorregida);
  }
}

// =============================================================================
// Formulario de alta y edición
// =============================================================================

function limpiarErrores() {
  el.erroresFormulario.replaceChildren();
  el.erroresFormulario.hidden = true;
}

function mostrarErrores(mensajes) {
  el.erroresFormulario.replaceChildren(
    ...mensajes.map((texto) => {
      const item = document.createElement('li');
      item.textContent = texto;
      return item;
    }),
  );
  el.erroresFormulario.hidden = false;
}

/** Deja el formulario vacío y listo para abrirse. */
function prepararFormulario(titulo, imagenesObligatorias) {
  el.formulario.reset();
  limpiarErrores();
  el.tituloFormulario.textContent = titulo;
  campos.fechaNacimiento.max = fechaHoyLocal();

  campos.imagenFrente.required = imagenesObligatorias;
  campos.imagenDorso.required = imagenesObligatorias;
  el.ayudaImagenes.textContent = imagenesObligatorias
    ? 'Ambas fotos son obligatorias. JPEG, PNG o WebP, hasta 2 MB cada una.'
    : 'Seleccione una foto solo si desea reemplazarla. JPEG, PNG o WebP, hasta 2 MB cada una.';
}

function abrirFormularioAlta() {
  estado.idEnEdicion = null;
  prepararFormulario('Nueva persona', true);
  el.dialogoFormulario.showModal();
}

async function abrirFormularioEdicion(id) {
  try {
    const persona = await api.obtenerPersona(id);
    estado.idEnEdicion = id;
    prepararFormulario('Editar persona', false);

    // Asignar .value es seguro: el navegador lo trata siempre como texto
    campos.nombres.value = persona.nombres;
    campos.apellidos.value = persona.apellidos;
    campos.nroDocumento.value = persona.nroDocumento;
    campos.fechaNacimiento.value = persona.fechaNacimiento;

    el.dialogoFormulario.showModal();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

/**
 * Revisa los archivos elegidos antes de enviarlos.
 * Quita del formulario los campos de archivo vacíos (en la edición, no elegir
 * una foto significa conservar la actual) y avisa si alguno supera el límite.
 */
function revisarArchivos(datosFormulario) {
  const errores = [];
  const archivos = [
    ['imagenFrente', 'La foto del frente'],
    ['imagenDorso', 'La foto del dorso'],
  ];

  for (const [campo, etiqueta] of archivos) {
    const archivo = datosFormulario.get(campo);
    if (!(archivo instanceof File) || archivo.size === 0) {
      datosFormulario.delete(campo);
    } else if (archivo.size > TAMANIO_MAXIMO_IMAGEN) {
      errores.push(`${etiqueta} supera el tamaño máximo de 2 MB.`);
    }
  }
  return errores;
}

async function guardarFormulario(evento) {
  // Evita que el navegador envíe el formulario recargando la página
  evento.preventDefault();
  limpiarErrores();

  const datosFormulario = new FormData(el.formulario);
  const errores = revisarArchivos(datosFormulario);
  if (errores.length > 0) {
    mostrarErrores(errores);
    return;
  }

  // Evita envíos duplicados por doble clic
  el.botonGuardar.disabled = true;
  try {
    const esAlta = estado.idEnEdicion === null;
    const persona = esAlta
      ? await api.crearPersona(datosFormulario)
      : await api.actualizarPersona(estado.idEnEdicion, datosFormulario);

    el.dialogoFormulario.close();
    mostrarMensaje(
      `${esAlta ? 'Se registró' : 'Se actualizó'} a ${persona.nombres} ${persona.apellidos}.`,
    );
    await cargarListado();
  } catch (err) {
    // Si el servidor indicó qué campos fallaron, se muestra cada uno
    const mensajes = err.detalles?.length > 0 ? err.detalles.map((d) => d.mensaje) : [err.message];
    mostrarErrores(mensajes);
  } finally {
    el.botonGuardar.disabled = false;
  }
}

// =============================================================================
// Detalle
// =============================================================================

async function abrirDetalle(id) {
  try {
    const persona = await api.obtenerPersona(id);

    const filas = [
      ['Nombres', persona.nombres],
      ['Apellidos', persona.apellidos],
      ['Nro. de documento', formatearDocumento(persona.nroDocumento)],
      ['Fecha de nacimiento', formatearFecha(persona.fechaNacimiento)],
      ['Edad', formatearEdad(persona.edad)],
      ['Registrado', formatearFechaHora(persona.creadoEn)],
      ['Última modificación', formatearFechaHora(persona.actualizadoEn)],
    ];

    el.datosDetalle.replaceChildren(
      ...filas.flatMap(([titulo, valor]) => {
        const dt = document.createElement('dt');
        dt.textContent = titulo;
        const dd = document.createElement('dd');
        dd.textContent = valor;
        return [dt, dd];
      }),
    );

    // Las imágenes se piden a la API solo al abrir el detalle, nunca en el listado
    el.imagenFrente.src = persona.imagenes.frente;
    el.imagenDorso.src = persona.imagenes.dorso;

    el.dialogoDetalle.showModal();
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

// =============================================================================
// Eliminación
// =============================================================================

function pedirConfirmacionEliminar(id) {
  const persona = estado.personasDePagina.get(id);
  estado.idAEliminar = id;
  el.textoConfirmar.textContent = persona
    ? `¿Desea eliminar a ${persona.nombres} ${persona.apellidos} (documento ${formatearDocumento(persona.nroDocumento)})?`
    : '¿Desea eliminar a esta persona?';
  el.dialogoConfirmar.showModal();
}

async function confirmarEliminar() {
  el.botonConfirmarEliminar.disabled = true;
  try {
    await api.eliminarPersona(estado.idAEliminar);
    el.dialogoConfirmar.close();
    mostrarMensaje('La persona fue eliminada.');
    await cargarListado();
  } catch (err) {
    el.dialogoConfirmar.close();
    mostrarMensaje(err.message, 'error');
  } finally {
    el.botonConfirmarEliminar.disabled = false;
    estado.idAEliminar = null;
  }
}

// =============================================================================
// Eventos
// =============================================================================

// Delegación: un único escuchador en el cuerpo de la tabla atiende los botones
// de todas las filas, incluso las que se crean después al cambiar de página.
el.cuerpoTabla.addEventListener('click', (evento) => {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;

  const id = Number(boton.dataset.id);
  switch (boton.dataset.accion) {
    case 'ver':
      abrirDetalle(id);
      break;
    case 'editar':
      abrirFormularioEdicion(id);
      break;
    case 'eliminar':
      pedirConfirmacionEliminar(id);
      break;
  }
});

// Cualquier botón con data-cerrar cierra el diálogo que lo contiene
document.addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-cerrar]');
  if (boton) {
    boton.closest('dialog').close();
  }
});

// Al cerrar el detalle se quitan las imágenes (no quedan en memoria de la página)
el.dialogoDetalle.addEventListener('close', () => {
  el.imagenFrente.removeAttribute('src');
  el.imagenDorso.removeAttribute('src');
});

el.botonNueva.addEventListener('click', abrirFormularioAlta);
el.formulario.addEventListener('submit', guardarFormulario);
el.botonConfirmarEliminar.addEventListener('click', confirmarEliminar);
el.botonAnterior.addEventListener('click', () => cargarListado(estado.pagina - 1));
el.botonSiguiente.addEventListener('click', () => cargarListado(estado.pagina + 1));

// Carga inicial
cargarListado(1);