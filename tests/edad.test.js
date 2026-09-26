/**
 * Tests del cálculo de edad.
 * Cubren los casos que exige la consigna: el día exacto del cumpleaños
 * y los nacidos el 29 de febrero, además de la zona horaria.
 *
 * Ejecutar con: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularEdad, fechaHoyEnZona } from '../src/utils/edad.js';

describe('calcularEdad', () => {
  it('resta un año si el cumpleaños todavía no llegó', () => {
    assert.equal(calcularEdad('1990-05-10', '2026-05-09'), 35);
  });

  it('suma el año exactamente el día del cumpleaños', () => {
    assert.equal(calcularEdad('1990-05-10', '2026-05-10'), 36);
  });

  it('mantiene la edad el día después del cumpleaños', () => {
    assert.equal(calcularEdad('1990-05-10', '2026-05-11'), 36);
  });

  it('compara el mes antes que el día', () => {
    // Mes de referencia anterior, aunque el día sea mayor
    assert.equal(calcularEdad('1990-05-10', '2026-04-30'), 35);
  });

  it('devuelve 0 para quien nació hoy', () => {
    assert.equal(calcularEdad('2026-09-25', '2026-09-25'), 0);
  });

  describe('nacidos el 29 de febrero', () => {
    it('en año no bisiesto, el 28/02 todavía no cumplió', () => {
      assert.equal(calcularEdad('2000-02-29', '2027-02-28'), 26);
    });

    it('en año no bisiesto, cumple el 01/03', () => {
      assert.equal(calcularEdad('2000-02-29', '2027-03-01'), 27);
    });

    it('en año bisiesto, cumple el 29/02', () => {
      assert.equal(calcularEdad('2000-02-29', '2028-02-29'), 28);
    });
  });

  it('rechaza fechas con formato inválido', () => {
    assert.throws(() => calcularEdad('10/05/1990', '2026-05-10'), TypeError);
  });
});

describe('fechaHoyEnZona', () => {
  it('devuelve la fecha en formato AAAA-MM-DD', () => {
    assert.match(fechaHoyEnZona('America/Asuncion'), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('usa la fecha local de la zona y no la de UTC', () => {
    // 01:30 del 26/09 en UTC equivale a la noche del 25/09 en Asunción
    const instante = new Date('2026-09-26T01:30:00Z');
    assert.equal(fechaHoyEnZona('UTC', instante), '2026-09-26');
    assert.equal(fechaHoyEnZona('America/Asuncion', instante), '2026-09-25');
  });
});