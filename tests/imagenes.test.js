/**
 * Tests de validación y procesamiento de imágenes.
 * Las imágenes de prueba se generan en memoria con sharp (colores lisos):
 * no se usa ningún archivo ni dato real.
 *
 * Ejecutar con: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { procesarImagen, rutaDeImagen } from '../src/servicios/imagenes.servicio.js';

/** Genera una imagen de un color liso con las dimensiones indicadas. */
function crearImagen(ancho, alto) {
  return sharp({
    create: { width: ancho, height: alto, channels: 3, background: '#cccccc' },
  });
}

/** Verifica que la promesa falle con un ErrorAplicacion 400. */
function esError400(err) {
  return err.estado === 400;
}

describe('procesarImagen', () => {
  it('acepta un PNG y lo convierte a WebP', async () => {
    const png = await crearImagen(200, 120).png().toBuffer();
    const resultado = await procesarImagen(png, 'foto de prueba');
    const tipo = await fileTypeFromBuffer(resultado);
    assert.equal(tipo.mime, 'image/webp');
  });

  it('reduce las imágenes grandes a 1600 px como máximo', async () => {
    const jpeg = await crearImagen(3000, 2000).jpeg().toBuffer();
    const resultado = await procesarImagen(jpeg, 'foto de prueba');
    const { width, height } = await sharp(resultado).metadata();
    assert.equal(width, 1600);
    assert.ok(height <= 1600);
  });

  it('rechaza texto aunque se lo presente como imagen', async () => {
    // Equivale a renombrar un archivo de texto a "foto.jpg"
    const texto = Buffer.from('<script>alert("no soy una imagen")</script>');
    await assert.rejects(procesarImagen(texto, 'foto de prueba'), esError400);
  });

  it('rechaza formatos de imagen no permitidos (GIF)', async () => {
    const gif = await crearImagen(50, 50).gif().toBuffer();
    await assert.rejects(procesarImagen(gif, 'foto de prueba'), esError400);
  });

  it('rechaza un archivo con firma de PNG pero contenido dañado', async () => {
    const png = await crearImagen(200, 120).png().toBuffer();
    // Conserva la firma inicial (magic bytes) y corta el resto del contenido
    const truncado = png.subarray(0, 60);
    await assert.rejects(procesarImagen(truncado, 'foto de prueba'), esError400);
  });

  it('rechaza imágenes de dimensiones excesivas (bomba de descompresión)', async () => {
    // 5100 x 5100 = 26 megapíxeles: supera el límite de 25, aunque el archivo pese poco
    const enorme = await crearImagen(5100, 5100).png().toBuffer();
    await assert.rejects(procesarImagen(enorme, 'foto de prueba'), esError400);
  });
});

describe('rutaDeImagen', () => {
  it('acepta nombres con el formato generado por el servidor', () => {
    assert.ok(rutaDeImagen('3f2a9c1e-7b4d-4e8a-9f2c-1a5b6c7d8e9f.webp'));
  });

  it('rechaza nombres que intentan salir de la carpeta (path traversal)', () => {
    assert.equal(rutaDeImagen('../../src/app.js'), null);
    assert.equal(rutaDeImagen('..\\..\\.env'), null);
  });

  it('rechaza nombres con otro formato', () => {
    assert.equal(rutaDeImagen('pendiente.webp'), null);
    assert.equal(rutaDeImagen('foto.jpg'), null);
  });
});