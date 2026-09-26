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
import { esquemaId, esquemaListado } from '../validaciones/personas.esquemas.js';

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