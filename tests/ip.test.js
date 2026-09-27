/**
 * Tests de la determinación de la IP del visitante detrás de Cloudflare Tunnel.
 * Las IPs usadas son de rangos reservados para documentación (RFC 5737 / RFC 3849)
 * o direcciones públicas conocidas: ninguna identifica a una persona.
 *
 * Ejecutar con: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarIp, resolverIpCliente, esIpNoPublica, enmascararIp } from '../src/utils/ip.js';

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

describe('esIpNoPublica', () => {
  it('detecta direcciones privadas, locales y de documentación', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.5', '192.168.1.50', '203.0.113.10', '::1', 'fd12::1', '2001:db8::5']) {
      assert.equal(esIpNoPublica(ip), true, ip);
    }
  });

  it('reconoce direcciones públicas', () => {
    // Servidores DNS públicos de Cloudflare y Google: no identifican a una persona
    for (const ip of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']) {
      assert.equal(esIpNoPublica(ip), false, ip);
    }
  });
});

describe('enmascararIp', () => {
  it('oculta el último número de una IPv4', () => {
    assert.equal(enmascararIp('203.0.113.10'), '203.0.113.x');
  });

  it('conserva solo los tres primeros grupos de una IPv6, aunque esté abreviada', () => {
    assert.equal(enmascararIp('2001:db8:1234:5678::1'), '2001:db8:1234:x:x:x:x:x');
    assert.equal(enmascararIp('2001:db8::5'), '2001:db8:0:x:x:x:x:x');
  });
});