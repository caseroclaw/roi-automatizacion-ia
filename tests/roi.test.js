/**
 * Pruebas del núcleo de cálculo. Los números están calculados a mano en los
 * comentarios para que sirvan de documentación de la fórmula.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TASA_SS_DEFECTO, HORAS_EFECTIVAS_DEFECTO, SEMANAS_EFECTO_DEFECTO,
  costeHoraCargada, horasAnuales, calcularProceso, cuadrante, priorizar, totales,
  informe, csv, aNumero, eur, meses, redondear,
} from '../src/roi.js';

const cerca = (a, b, tolerancia = 0.02) =>
  assert.ok(Math.abs(a - b) <= tolerancia, `esperaba ${b}, obtuve ${a}`);

test('la tasa de cotización por defecto suma los cinco conceptos empresariales', () => {
  // 23,6 % contingencias + 5,5 % desempleo + 0,2 % FOGASA + 0,6 % FP + 1,5 % AT/EP = 31,4 %
  cerca(TASA_SS_DEFECTO, 0.236 + 0.055 + 0.002 + 0.006 + 0.015, 0.0001);
});

test('coste por hora cargado: 24.000 € brutos → 18,02 €/h', () => {
  // 24.000 × 1,314 = 31.536 € ; 31.536 / 1.750 h = 18,0206 €/h
  cerca(costeHoraCargada(24000), 18.02);
  // Con 30 % de cotización y 1.800 h: 24.000 × 1,3 / 1.800 = 17,333 €/h
  cerca(costeHoraCargada(24000, 0.3, 1800), 17.33);
});

test('el coste por hora es mayor que el salario/hora teórico (incluye cotización)', () => {
  const cargado = costeHoraCargada(24000);
  const teorico = 24000 / HORAS_EFECTIVAS_DEFECTO;
  assert.ok(cargado > teorico, 'el coste cargado debe incluir la cotización empresarial');
  cerca(cargado / teorico, 1.314, 0.001);
});

test('entradas inválidas en el coste por hora lanzan error explícito', () => {
  assert.throws(() => costeHoraCargada(0), /mayor que 0/);
  assert.throws(() => costeHoraCargada(-100), /mayor que 0/);
  assert.throws(() => costeHoraCargada(24000, 0.3, 0), /horas efectivas/);
  assert.throws(() => costeHoraCargada(24000, -1), /no puede ser negativa/);
});

test('horas al año: 3 personas × 6 h/semana × 46 semanas = 828 h', () => {
  assert.equal(horasAnuales(3, 6), 828);
  assert.equal(SEMANAS_EFECTO_DEFECTO, 46);
});

test('caso completo: 3 personas, 6 h/semana, 60 % automatizable, 12.000 € de implantación', () => {
  const r = calcularProceso({
    nombre: 'Conciliación de facturas',
    personas: 3,
    horasSemana: 6,
    brutoAnual: 24000,
    automatizable: 0.6,
    implantacion: 12000,
    mantenimiento: 1200,
    dificultad: 2,
  });
  cerca(r.costeHora, 18.02);
  cerca(r.horasAnio, 828, 0.05);
  cerca(r.costeAnual, 828 * 18.0206, 1);        // ≈ 14.921 €
  cerca(r.horasAhorradasAnio, 496.8, 0.1);      // 828 × 0,6
  cerca(r.ahorroBruto, 828 * 18.0206 * 0.6, 1);  // ≈ 8.953 €
  cerca(r.ahorroNeto, r.ahorroBruto - 1200, 0.01);
  cerca(r.paybackMeses, (12000 / r.ahorroNeto) * 12, 0.2); // ≈ 18,6 meses
  cerca(r.neto3, r.ahorroNeto * 3 - 12000, 0.05);
  assert.equal(r.cuadrante, 'empezar-aqui'); // 41,4 h/mes y dificultad 2
});

test('el mantenimiento se descuenta antes de llamar ahorro a nada', () => {
  const base = { personas: 2, horasSemana: 5, brutoAnual: 26000, automatizable: 0.5, implantacion: 6000 };
  const sinMantenimiento = calcularProceso({ ...base, mantenimiento: 0 });
  const conMantenimiento = calcularProceso({ ...base, mantenimiento: 3000 });
  cerca(sinMantenimiento.ahorroNeto - conMantenimiento.ahorroNeto, 3000, 0.01);
  assert.ok(conMantenimiento.paybackMeses > sinMantenimiento.paybackMeses);
});

test('si el mantenimiento se come el ahorro, la amortización es infinita (nunca)', () => {
  const r = calcularProceso({
    personas: 1, horasSemana: 1, brutoAnual: 20000, automatizable: 0.3,
    implantacion: 9000, mantenimiento: 5000,
  });
  assert.equal(r.paybackMeses, Infinity);
  assert.equal(meses(r.paybackMeses), 'nunca');
  assert.ok(r.ahorroNeto < 0, 'el ahorro neto debe poder ser negativo');
});

test('cuadrantes de priorización según horas/mes y dificultad', () => {
  assert.equal(cuadrante(40, 1), 'empezar-aqui');
  assert.equal(cuadrante(40, 5), 'planificar');
  assert.equal(cuadrante(2, 1), 'si-hay-capacidad');
  assert.equal(cuadrante(2, 5), 'descartar');
  assert.equal(cuadrante(10, 2.5), 'empezar-aqui'); // límites inclusivos
});

test('priorizar coloca primero lo que se debe empezar y luego el payback más corto', () => {
  const procesos = [
    calcularProceso({ nombre: 'Descartable', personas: 1, horasSemana: 0.5, brutoAnual: 20000, automatizable: 0.2, implantacion: 9000, mantenimiento: 0, dificultad: 5 }),
    calcularProceso({ nombre: 'Planificable', personas: 4, horasSemana: 8, brutoAnual: 24000, automatizable: 0.7, implantacion: 25000, mantenimiento: 2000, dificultad: 4.5 }),
    calcularProceso({ nombre: 'Rápido', personas: 2, horasSemana: 4, brutoAnual: 24000, automatizable: 0.8, implantacion: 3000, mantenimiento: 300, dificultad: 1 }),
  ];
  const orden = priorizar(procesos).map((p) => p.nombre);
  assert.equal(orden[0], 'Rápido');
  assert.equal(orden[2], 'Descartable');
});

test('totales suma costes, ahorros e inversión', () => {
  const a = calcularProceso({ personas: 2, horasSemana: 4, brutoAnual: 24000, automatizable: 0.5, implantacion: 4000, mantenimiento: 500 });
  const b = calcularProceso({ personas: 1, horasSemana: 3, brutoAnual: 30000, automatizable: 0.4, implantacion: 2000, mantenimiento: 0 });
  const t = totales([a, b]);
  cerca(t.implantacion, 6000, 0.01);
  cerca(t.ahorroNeto, a.ahorroNeto + b.ahorroNeto, 0.02);
  cerca(t.horasAhorradasAnio, a.horasAhorradasAnio + b.horasAhorradasAnio, 0.02);
});

test('el informe incluye supuestos, cada proceso y el total', () => {
  const p = calcularProceso({ nombre: 'Altas de clientes', personas: 2, horasSemana: 5, brutoAnual: 24000, automatizable: 0.6, implantacion: 8000, mantenimiento: 600 });
  const texto = informe([p], { empresa: 'Talleres Ejemplo SL', fecha: '19/10/2026' });
  assert.match(texto, /Talleres Ejemplo SL/);
  assert.match(texto, /Cotización empresarial aplicada: 31,4 %/);
  assert.match(texto, /Altas de clientes/);
  assert.match(texto, /Amortización:/);
  assert.match(texto, /TOTAL/);
  assert.match(texto, /no es una promesa/);
});

test('el CSV usa punto y coma, rellena personas/horas y escapa comillas', () => {
  const p = calcularProceso({ nombre: 'Proceso "raro"; con coma', personas: 1, horasSemana: 2, brutoAnual: 22000, automatizable: 0.5, implantacion: 1000, mantenimiento: 0 });
  const salida = csv([p]);
  assert.ok(salida.split('\r\n').length >= 2);
  assert.match(salida, /"Proceso ""raro""; con coma"/);
  assert.match(salida.split('\r\n')[0], /Proceso;Personas;Horas\/semana por persona/);
  const fila = salida.split('\r\n')[1];
  assert.match(fila, /;1;2;/, 'la fila debe llevar personas y horas/semana: ' + fila);
  assert.match(fila, /,/, 'los decimales deben ir con coma para Excel en español');
});

test('aNumero acepta el formato español y rechaza basura', () => {
  assert.equal(aNumero('1.234,56'), 1234.56);
  assert.equal(aNumero('24.000'), 24000);
  assert.equal(aNumero('18,5'), 18.5);
  assert.equal(aNumero(' 850 € '), 850);
  assert.ok(Number.isNaN(aNumero('')));
  assert.ok(Number.isNaN(aNumero('abc')));
});

test('formato español de importes y meses', () => {
  assert.equal(eur(14920.6), '14.920,60 €');
  assert.equal(redondear(1.005, 2), 1.01);
  assert.equal(meses(18.6), '18,6 meses');
  assert.equal(meses(26), '2 años y 2 meses');
  assert.equal(meses(24), '2 años');
});
