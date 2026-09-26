/**
 * Controlador de personas: capa HTTP.
 *
 * Traduce la petición (req) a datos validados, llama al servicio y
 * arma la respuesta (res). No contiene SQL ni reglas de negocio.
 *
 * En Express 5, si una función async lanza un error, Express lo envía
 * automáticamente al manejador de errores: no hace falta try/catch.
 */
import * as servicio from '../servicios/personas.servicio.js';
import { validar } from '../validaciones/validar.js';
import { esquemaId, esquemaListado, esquemaPersona, esquemaImagen } from '../validaciones/personas.esquemas.js';
import { ErrorAplicacion } from '../middlewares/errores.js';

/** GET /api/personas?pagina=N */
export async function listar(req, res) {
  const { pagina } = validar(esquemaListado, req.query);
  const resultado = await servicio.listar(pagina);
  res.json(resultado);
}

/** GET /api/personas/:id */
export async function obtener(req, res) {
  const { id } = validar(esquemaId, req.params);
  const persona = await servicio.obtener(id);
  res.json(persona);
}

/**
 * Extrae los contenidos de los archivos recibidos por multer.
 * Si un archivo no se envió, queda en null.
 */
function extraerArchivos(req) {
  return {
    frente: req.files?.imagenFrente?.[0]?.buffer ?? null,
    dorso: req.files?.imagenDorso?.[0]?.buffer ?? null,
  };
}

/** POST /api/personas (multipart/form-data) */
export async function crear(req, res) {
  // Si la petición no trae cuerpo, req.body es undefined: se valida un objeto vacío
  const datos = validar(esquemaPersona, req.body ?? {});
  const persona = await servicio.crear(datos, extraerArchivos(req));
  // 201 Created, con la URL del recurso creado en el encabezado Location
  res.status(201).location(`/api/personas/${persona.id}`).json(persona);
}

/** PUT /api/personas/:id (multipart/form-data; imágenes opcionales) */
export async function actualizar(req, res) {
  const { id } = validar(esquemaId, req.params);
  const datos = validar(esquemaPersona, req.body ?? {});
  const persona = await servicio.actualizar(id, datos, extraerArchivos(req));
  res.json(persona);
}

/** DELETE /api/personas/:id */
export async function eliminar(req, res) {
  const { id } = validar(esquemaId, req.params);
  await servicio.eliminar(id);
  // 204 No Content: se eliminó, no hay nada que devolver
  res.status(204).end();
}

/** GET /api/personas/:id/imagenes/:lado */
export async function obtenerImagen(req, res, next) {
  const { id, lado } = validar(esquemaImagen, req.params);
  const ruta = await servicio.obtenerRutaImagen(id, lado);

  res.sendFile(
    ruta,
    {
      // Siempre se guardan como WebP: el tipo se fija explícitamente
      headers: { 'Content-Type': 'image/webp', 'Content-Disposition': 'inline' },
    },
    (err) => {
      if (!err) return;
      // El registro existe pero el archivo no está en disco
      if (err.code === 'ENOENT') {
        return next(new ErrorAplicacion(404, 'La imagen no está disponible'));
      }
      next(err);
    },
  );
}