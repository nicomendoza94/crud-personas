/**
 * Seed: carga personas sintéticas para desarrollo y evaluación.
 *
 * Uso:
 *   npm run seed                  Carga las personas (solo si la tabla está vacía)
 *   npm run seed -- --reiniciar   Borra todas las personas e imágenes y vuelve a cargar
 *
 * Todos los datos son ficticios:
 *  - Nombres y fechas generados con faker, con semilla fija (resultado reproducible).
 *  - Números de documento consecutivos desde 90.000.001: un rango que no corresponde
 *    a documentos reales, para no asociar números existentes a nombres inventados.
 *  - Imágenes generadas con la leyenda MUESTRA.
 *
 * Usa las mismas validaciones y funciones que la aplicación: cada persona
 * cargada pasa por los mismos controles que una cargada desde el formulario.
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { fakerES as faker } from '@faker-js/faker';
import { config } from '../config/entorno.js';
import { pool, cerrarPool } from './conexion.js';
import * as repositorio from '../repositorios/personas.repositorio.js';
import {
  procesarImagen,
  guardarImagen,
  eliminarImagen,
  DIRECTORIO_IMAGENES,
} from '../servicios/imagenes.servicio.js';
import { esquemaPersona } from '../validaciones/personas.esquemas.js';
import { fechaHoyEnZona } from '../utils/edad.js';

const CANTIDAD = 500;
const DOCUMENTO_INICIAL = 90_000_001;
const SEMILLA = 2026;

/** Imagen SVG de una tarjeta de muestra (proporción de un documento de identidad). */
function tarjetaSvg(lado, fondo) {
  return Buffer.from(`
    <svg width="856" height="540" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="30" fill="${fondo}"/>
      <text x="50%" y="42%" font-size="110" font-family="Arial" font-weight="bold"
            text-anchor="middle" fill="#b00020">MUESTRA</text>
      <text x="50%" y="60%" font-size="36" font-family="Arial"
            text-anchor="middle" fill="#333333">${lado}</text>
      <text x="50%" y="75%" font-size="30" font-family="Arial"
            text-anchor="middle" fill="#555555">DATO SINTÉTICO - DOCUMENTO NO VÁLIDO</text>
    </svg>`);
}

/**
 * Genera y procesa las dos imágenes de muestra UNA sola vez.
 * El SVG se convierte primero a PNG, porque procesarImagen solo acepta
 * JPEG, PNG o WebP (igual que desde el formulario).
 */
async function generarImagenesMuestra() {
  const [frentePng, dorsoPng] = await Promise.all([
    sharp(tarjetaSvg('FRENTE', '#dbeafe')).png().toBuffer(),
    sharp(tarjetaSvg('DORSO', '#fef3c7')).png().toBuffer(),
  ]);
  return Promise.all([
    procesarImagen(frentePng, 'imagen de muestra del frente'),
    procesarImagen(dorsoPng, 'imagen de muestra del dorso'),
  ]);
}

/** Convierte un Date en 'AAAA-MM-DD'. */
function aFechaIso(fecha) {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Genera los datos de las personas y los valida con el mismo esquema del formulario.
 * Las primeras son casos especiales para verificar el cálculo de edad.
 */
function generarPersonas() {
  const hoy = fechaHoyEnZona(config.zonaHoraria);
  const [, mesHoy, diaHoy] = hoy.split('-');

  // 1992 es bisiesto: el caso "cumple hoy" es válido aunque hoy sea 29 de febrero
  const casosEspeciales = [
    { fechaNacimiento: `1992-${mesHoy}-${diaHoy}`, descripcion: 'cumple años hoy' },
    { fechaNacimiento: '2000-02-29', descripcion: 'nació un 29 de febrero' },
  ];

  const personas = [];
  for (let i = 0; i < CANTIDAD; i++) {
    const especial = casosEspeciales[i];
    const datos = {
      nombres: faker.person.firstName(),
      // faker en español ya genera dos apellidos por llamada
      apellidos: faker.person.lastName(),
      nroDocumento: String(DOCUMENTO_INICIAL + i),
      // Edad mínima 1: evita fechas del día actual que, por diferencia de
      // zona horaria con UTC, podrían resultar "futuras"
      fechaNacimiento:
        especial?.fechaNacimiento ?? aFechaIso(faker.date.birthdate({ mode: 'age', min: 1, max: 95 })),
    };

    // parse (no safeParse): si algún dato generado no fuera válido, el seed se detiene
    personas.push({ ...esquemaPersona.parse(datos), descripcion: especial?.descripcion });
  }
  return personas;
}

/** Borra todas las personas y sus imágenes (solo con --reiniciar). */
async function reiniciar() {
  // RESTART IDENTITY: los ids vuelven a empezar desde 1
  await pool.query('TRUNCATE personas RESTART IDENTITY');

  // eliminarImagen solo borra archivos con formato <uuid>.webp (ignora .gitkeep)
  const archivos = await fs.readdir(DIRECTORIO_IMAGENES).catch(() => []);
  await Promise.all(archivos.map(eliminarImagen));
}

async function ejecutarSeed() {
  if (config.esProduccion) {
    throw new Error('El seed no puede ejecutarse en producción.');
  }

  const reiniciarSolicitado = process.argv.includes('--reiniciar');
  const existentes = await repositorio.contar();

  if (existentes > 0 && !reiniciarSolicitado) {
    throw new Error(
      `La tabla ya tiene ${existentes} personas. Para borrarlas y volver a cargar: npm run seed -- --reiniciar`,
    );
  }

  if (reiniciarSolicitado) {
    await reiniciar();
    console.log('Datos anteriores eliminados.');
  }

  const inicio = performance.now();
  faker.seed(SEMILLA);

  const personas = generarPersonas();
  const [frente, dorso] = await generarImagenesMuestra();

  for (const [indice, persona] of personas.entries()) {
    // Cada persona tiene sus propios archivos: al eliminarla se borran solo los suyos
    const imagenFrente = await guardarImagen(frente);
    const imagenDorso = await guardarImagen(dorso);
    await repositorio.crear({ ...persona, imagenFrente, imagenDorso });

    if ((indice + 1) % 100 === 0) {
      console.log(`  ${indice + 1} / ${CANTIDAD}`);
    }
  }

  const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
  console.log(`Se cargaron ${CANTIDAD} personas sintéticas en ${segundos} s.`);

  console.log('\nCasos para verificar el cálculo de edad:');
  for (const persona of personas.filter((p) => p.descripcion)) {
    console.log(`  - Documento ${persona.nroDocumento}: ${persona.descripcion} (${persona.fechaNacimiento})`);
  }
}

try {
  await ejecutarSeed();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await cerrarPool();
}