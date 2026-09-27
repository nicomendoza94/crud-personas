/**
 * Controlador del historial de búsquedas (auditoría).
 *
 * El historial es accesible sin autenticación porque la consigna excluye la
 * autenticación y la vista es necesaria para la evaluación. En producción
 * requeriría autenticación y control de acceso (ver README, "Fuera de alcance").
 */
import * as auditoriaServicio from '../servicios/auditoria.servicio.js';
import { validar } from '../validaciones/validar.js';
import { esquemaListado } from '../validaciones/personas.esquemas.js';

/** GET /api/auditoria?pagina=N */
export async function listar(req, res) {
  const { pagina } = validar(esquemaListado, req.query);
  const resultado = await auditoriaServicio.listarHistorial(pagina);
  res.json(resultado);
}