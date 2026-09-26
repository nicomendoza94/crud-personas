/**
 * Tests de la determinación de la IP del visitante detrás de Cloudflare Tunnel.
 * Las IPs usadas son de rangos reservados para documentación (RFC 5737 / RFC 3849)
 * o direcciones públicas conocidas: ninguna identifica a una persona.
 *
 * Ejecutar con: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarIp, resolverIpCliente } from '../src/utils/ip.js';

describe('resolverIpCliente', () => {
  it('usa CF-Connecting-IP cuando la conexión viene del túnel (loopback)', () => {
    assert.deepEqual(
      resolverIpCliente({ direccionConexion: '127.0.0.1', encabezadoCloudflare: '203.0.113.10' }),
      { ip: '203.0.113.10', origen: 'cloudflare' },
    );
  });

  it('reconoce loopback escrito como IPv6', () => {
    assert.equal(
      resolverIpCliente({ direccionConexion: '::ffff:127.0.0.1', encabezadoCloudflare: '203.0.113.10' }).ip,
      '203.0.113.10',
    );
    assert.equal(
      resolverIpCliente({ direccionConexion: '::1', encabezadoCloudflare: '2001:db8::5' }).ip,
      '2001:db8::5',
    );
  });

  it('usa la IP de la conexión si el túnel no envió el encabezado', () => {
    assert.deepEqual(
      resolverIpCliente({ direccionConexion: '127.0.0.1' }),
      { ip: '127.0.0.1', origen: 'conexion' },
    );
  });

  it('ignora CF-Connecting-IP si la conexión NO viene del túnel (encabezado falsificado)', () => {
    // Alguien conectado directamente (sin pasar por Cloudflare) intenta hacerse pasar por otra IP
    assert.deepEqual(
      resolverIpCliente({ direccionConexion: '192.168.1.50', encabezadoCloudflare: '8.8.8.8' }),
      { ip: '192.168.1.50', origen: 'conexion' },
    );
  });

  it('descarta un encabezado que no es una IP válida', () => {
    for (const valorInvalido of ['no-es-una-ip', '<script>alert(1)</script>', '203.0.113.10, 8.8.8.8', '']) {
      assert.deepEqual(
        resolverIpCliente({ direccionConexion: '127.0.0.1', encabezadoCloudflare: valorInvalido }),
        { ip: '127.0.0.1', origen: 'conexion' },
      );
    }
  });
});

describe('normalizarIp', () => {
  it('quita el prefijo ::ffff: de las IPv4 escritas como IPv6', () => {
    assert.equal(normalizarIp('::ffff:198.51.100.7'), '198.51.100.7');
  });

  it('devuelve null para valores que no son IPs', () => {
    assert.equal(normalizarIp('999.1.1.1'), null);
    assert.equal(normalizarIp(undefined), null);
  });
});