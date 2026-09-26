/**
 * Controlador de búsquedas: capa HTTP.
 *
 * La búsqueda se recibe por POST con el término en el cuerpo (JSON) y no en
 * la URL: el término puede ser un dato personal, y las URLs quedan registradas
 * en historiales y logs de servidores e intermediarios.
 */
import * as personasServicio from '../servicios/personas.servicio.js';
import { validar } from '../validaciones/validar.js';
import { esquemaBusqueda } from '../validaciones/personas.esquemas.js';

/** POST /api/busquedas  { "termino": "..." } */
export async function buscar(req, res) {
  const { termino } = validar(esquemaBusqueda, req.body ?? {});
  const resultado = await personasServicio.buscar(termino);
  res.json(resultado);
}