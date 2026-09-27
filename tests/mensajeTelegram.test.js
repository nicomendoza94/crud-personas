/**
 * Tests del mensaje enviado a Telegram: verifican el criterio de minimización
 * de datos (qué se incluye y, sobre todo, qué NO se incluye).
 *
 * Ejecutar con: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirMensajeBusqueda } from '../src/utils/mensajeTelegram.js';

const ZONA = 'America/Asuncion';

// Búsqueda de ejemplo, con un término que es un dato personal (sintético)
const busqueda = {
  id: 42,
  fechaHora: new Date('2026-09-26T21:15:00Z'),
  criterio: 'documento',
  cantidadResultados: 1,
  ip: '203.0.113.10',
  geo: { estado: 'ok', pais: 'Paraguay', ciudad: 'Asunción', organizacion: 'Proveedor S.A.', latitud: -25.3, longitud: -57.6 },
  termino: '90000123',
};

describe('construirMensajeBusqueda', () => {
  const mensaje = construirMensajeBusqueda(busqueda, ZONA);

  it('incluye el registro, el criterio, la cantidad de resultados y el país', () => {
    assert.match(mensaje, /#42/);
    assert.match(mensaje, /número de documento/);
    assert.match(mensaje, /Resultados: 1/);
    assert.match(mensaje, /Paraguay/);
  });

  it('NO incluye el término buscado, aunque se lo pase por error', () => {
    assert.doesNotMatch(mensaje, /90000123/);
  });

  it('enmascara la IP y no incluye la completa', () => {
    assert.match(mensaje, /203\.0\.113\.x/);
    assert.doesNotMatch(mensaje, /203\.0\.113\.10/);
  });

  it('NO incluye ciudad, organización ni coordenadas', () => {
    assert.doesNotMatch(mensaje, /Asunción/);
    assert.doesNotMatch(mensaje, /Proveedor/);
    assert.doesNotMatch(mensaje, /-25\.3|-57\.6/);
  });

  it('describe el origen cuando no hay geolocalización', () => {
    const sinDatos = construirMensajeBusqueda({ ...busqueda, geo: { estado: 'error' } }, ZONA);
    assert.match(sinDatos, /no disponible/);
  });
});