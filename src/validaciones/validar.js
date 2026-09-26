/**
 * Aplica un esquema de zod a datos que vienen del cliente.
 *
 * Si los datos son válidos, devuelve la versión ya convertida
 * (ej: el texto "2" se convierte en el número 2).
 * Si no, lanza un ErrorAplicacion 400 con el detalle de cada campo inválido,
 * que el manejador de errores devuelve al cliente.
 */
import { ErrorAplicacion } from '../middlewares/errores.js';

export function validar(esquema, datos) {
  const resultado = esquema.safeParse(datos);

  if (!resultado.success) {
    const detalles = resultado.error.issues.map((problema) => ({
      campo: problema.path.join('.'),
      mensaje: problema.message,
    }));
    throw new ErrorAplicacion(400, 'Los datos enviados no son válidos', detalles);
  }

  return resultado.data;
}