/**
 * Configuración de la aplicación a partir de variables de entorno.
 *
 * Toda lectura de process.env se centraliza en este módulo para:
 *  1. Validar al arrancar que no falte ninguna variable ("fallar rápido"):
 *     es mejor que la app no inicie a que falle en medio de una búsqueda.
 *  2. Convertir tipos: process.env siempre devuelve texto.
 *  3. Que el resto del código importe `config` y nunca lea process.env directamente.
 */
import { z } from 'zod';

// Esquema: qué variables esperamos, de qué tipo y con qué valores por defecto.
const esquema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  // z.coerce convierte el texto "3000" en el número 3000 antes de validarlo
  PUERTO: z.coerce.number().int().min(1).max(65535).default(3000),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  // Mostramos QUÉ variable falló y por qué, pero nunca su valor:
  // en el futuro habrá tokens y contraseñas que no deben terminar en un log.
  console.error('Configuración inválida en las variables de entorno:');
  for (const problema of resultado.error.issues) {
    console.error(`  - ${problema.path.join('.')}: ${problema.message}`);
  }
  process.exit(1);
}

const variables = resultado.data;

// Object.freeze impide que otra parte del código modifique la configuración en ejecución.
export const config = Object.freeze({
  entorno: variables.NODE_ENV,
  esProduccion: variables.NODE_ENV === 'production',
  host: variables.HOST,
  puerto: variables.PUERTO,
});