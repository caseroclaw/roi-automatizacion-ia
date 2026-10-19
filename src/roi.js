/**
 * Núcleo de cálculo de la calculadora de ROI de automatización con IA.
 * Sin dependencias, sin red: todo se calcula en el navegador.
 *
 * Convención: los importes se manejan en euros (número) y las horas en horas.
 * El coste por hora cargado incluye salario bruto + cotización empresarial,
 * dividido entre las horas realmente trabajadas al año (no 2.080 h teóricas).
 */

/** Cotización empresarial por contingencias comunes en España (régimen general). */
export const SS_CONTINGENCIAS_COMUNES = 0.236;
/** Desempleo, contrato indefinido (empresa). */
export const SS_DESEMPLEO_INDEFINIDO = 0.055;
/** FOGASA (empresa). */
export const SS_FOGASA = 0.002;
/** Formación profesional (empresa). */
export const SS_FORMACION = 0.006;
/** Valor medio orientativo de AT/EP para oficinas y servicios (empresa). */
export const SS_AT_EP_OFICINAS = 0.015;

/**
 * Tasa de cotización empresarial por defecto: 31,4 % sobre el salario bruto.
 * Suma de los cinco conceptos anteriores, redondeada a una décima.
 */
export const TASA_SS_DEFECTO = 0.314;

/** Horas efectivas por persona y año si se descuentan vacaciones y festivos. */
export const HORAS_EFECTIVAS_DEFECTO = 1750;

/** Semanas efectivas por año (52 menos vacaciones típicas de 4 y festivos). */
export const SEMANAS_EFECTO_DEFECTO = 46;

const numero = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const porcentaje = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Formatea un importe en euros con el formato español: 1.234,56 €. */
export function eur(valor) {
  return numero.format(redondear(valor)) + ' €';
}

/** Formatea horas: 123,5 h. */
export function horas(valor) {
  return porcentaje.format(redondear(valor)) + ' h';
}

/** Formatea un porcentaje ya expresado en puntos (12,3 → "12,3 %"). */
export function pct(valor) {
  return porcentaje.format(redondear(valor)) + ' %';
}

/** Formatea meses de amortización de forma legible (0,8 → "0,8 meses"; 26 → "2 años y 2 meses"). */
export function meses(valor) {
  if (!isFinite(valor) || valor <= 0) return 'nunca';
  if (valor < 24) return porcentaje.format(redondear(valor)) + ' meses';
  const anios = Math.floor(valor / 12);
  const resto = Math.round(valor - anios * 12);
  return resto === 0 ? entero.format(anios) + ' años' : entero.format(anios) + ' años y ' + resto + ' meses';
}

export function redondear(valor, decimales = 2) {
  const factor = Math.pow(10, decimales);
  return Math.round((Number(valor) + Number.EPSILON) * factor) / factor;
}

/** Convierte texto con coma decimal en número. Devuelve NaN si no es numérico. */
export function aNumero(texto) {
  if (typeof texto === 'number') return texto;
  if (texto === null || texto === undefined) return NaN;
  const limpio = String(texto).trim().replace(/\s|€/g, '').replace(/\./g, '').replace(',', '.');
  if (limpio === '') return NaN;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : NaN;
}

/**
 * Coste por hora realmente cargado para la empresa.
 * @param {number} brutoAnual salario bruto anual por persona
 * @param {number} tasaSS cotización empresarial (0,314 = 31,4 %)
 * @param {number} horasAnuales horas efectivas trabajadas por persona y año
 */
export function costeHoraCargada(brutoAnual, tasaSS = TASA_SS_DEFECTO, horasAnuales = HORAS_EFECTIVAS_DEFECTO) {
  if (!(brutoAnual > 0)) throw new Error('El salario bruto anual debe ser mayor que 0');
  if (!(horasAnuales > 0)) throw new Error('Las horas efectivas al año deben ser mayores que 0');
  if (tasaSS < 0) throw new Error('La cotización empresarial no puede ser negativa');
  return (brutoAnual * (1 + tasaSS)) / horasAnuales;
}

/**
 * Horas al año que consume un proceso.
 * @param {number} personas personas implicadas
 * @param {number} horasSemana horas por persona y semana
 * @param {number} semanas semanas efectivas al año
 */
export function horasAnuales(personas, horasSemana, semanas = SEMANAS_EFECTO_DEFECTO) {
  return personas * horasSemana * semanas;
}

/**
 * Calcula el caso de negocio de automatizar un proceso.
 * @param {object} p
 * @param {string} p.nombre
 * @param {number} p.personas
 * @param {number} p.horasSemana horas por persona y semana
 * @param {number} p.brutoAnual salario bruto anual del perfil
 * @param {number} p.automatizable fracción automatizable (0-1)
 * @param {number} p.implantacion coste único del proyecto
 * @param {number} p.mantenimiento coste anual recurrente (licencias, soporte, hosting)
 * @param {number} [p.tasaSS]
 * @param {number} [p.horasEfectivas]
 * @param {number} [p.semanas]
 * @param {number} [p.dificultad] 1-5, para la matriz de priorización
 */
export function calcularProceso(p) {
  const tasaSS = p.tasaSS ?? TASA_SS_DEFECTO;
  const horasEfectivas = p.horasEfectivas ?? HORAS_EFECTIVAS_DEFECTO;
  const semanas = p.semanas ?? SEMANAS_EFECTO_DEFECTO;
  const automatizable = clamp(p.automatizable, 0, 1);
  const dificultad = clamp(p.dificultad ?? 3, 1, 5);

  const hora = costeHoraCargada(p.brutoAnual, tasaSS, horasEfectivas);
  const horasAnio = horasAnuales(p.personas, p.horasSemana, semanas);
  const costeAnual = horasAnio * hora;
  const ahorroBruto = costeAnual * automatizable;
  const mantenimiento = Math.max(0, p.mantenimiento || 0);
  const ahorroNeto = ahorroBruto - mantenimiento;
  const horasAhorradasAnio = horasAnio * automatizable;
  const paybackMeses = ahorroNeto > 0 ? (Math.max(0, p.implantacion) / ahorroNeto) * 12 : Infinity;
  const neto3 = ahorroNeto * 3 - Math.max(0, p.implantacion);
  const roi3 = p.implantacion > 0 ? (neto3 / p.implantacion) * 100 : Infinity;

  return {
    nombre: p.nombre || 'Proceso',
    personas: Number(p.personas) || 0,
    horasSemana: Number(p.horasSemana) || 0,
    brutoAnual: Number(p.brutoAnual) || 0,
    costeHora: redondear(hora),
    horasAnio: redondear(horasAnio, 1),
    costeAnual: redondear(costeAnual),
    automatizable,
    horasAhorradasAnio: redondear(horasAhorradasAnio, 1),
    ahorroBruto: redondear(ahorroBruto),
    mantenimiento: redondear(mantenimiento),
    ahorroNeto: redondear(ahorroNeto),
    implantacion: redondear(Math.max(0, p.implantacion || 0)),
    paybackMeses: isFinite(paybackMeses) ? redondear(paybackMeses, 1) : Infinity,
    neto3: redondear(neto3),
    roi3: isFinite(roi3) ? redondear(roi3, 1) : Infinity,
    dificultad,
    horasMesAhorradas: redondear(horasAhorradasAnio / 12, 1),
    // Cuadrante de la matriz 2x2: horas/mes ahorradas (eje X) frente a dificultad (eje Y invertido)
    cuadrante: cuadrante(horasAhorradasAnio / 12, dificultad),
  };
}

/** Clasifica un proceso en el cuadrante de priorización. */
export function cuadrante(horasMes, dificultad) {
  const mucho = horasMes >= 10;
  const facil = dificultad <= 2.5;
  if (mucho && facil) return 'empezar-aqui';
  if (mucho && !facil) return 'planificar';
  if (!mucho && facil) return 'si-hay-capacidad';
  return 'descartar';
}

export const ETIQUETA_CUADRANTE = {
  'empezar-aqui': 'Empezar aquí (muchas horas, poca dificultad)',
  planificar: 'Planificar como proyecto (muchas horas, difícil)',
  'si-hay-capacidad': 'Solo si hay capacidad (pocas horas, fácil)',
  descartar: 'Dejar para más adelante (pocas horas, difícil)',
};

/** Versión corta de la etiqueta, para tablas y frases. */
export const ETIQUETA_CORTA = {
  'empezar-aqui': 'Empezar aquí',
  planificar: 'Planificar',
  'si-hay-capacidad': 'Si hay capacidad',
  descartar: 'Más adelante',
};

/** Suma los resultados de varios procesos. */
export function totales(procesos) {
  return procesos.reduce(
    (acc, p) => ({
      costeAnual: acc.costeAnual + p.costeAnual,
      ahorroNeto: acc.ahorroNeto + p.ahorroNeto,
      horasAhorradasAnio: acc.horasAhorradasAnio + p.horasAhorradasAnio,
      implantacion: acc.implantacion + p.implantacion,
      neto3: acc.neto3 + p.neto3,
    }),
    { costeAnual: 0, ahorroNeto: 0, horasAhorradasAnio: 0, implantacion: 0, neto3: 0 }
  );
}

/** Ordena los procesos por prioridad: primero el cuadrante "empezar aquí", luego payback. */
export function priorizar(procesos) {
  const peso = { 'empezar-aqui': 0, planificar: 1, 'si-hay-capacidad': 2, descartar: 3 };
  return [...procesos].sort((a, b) => {
    const d = peso[a.cuadrante] - peso[b.cuadrante];
    if (d !== 0) return d;
    return a.paybackMeses - b.paybackMeses;
  });
}

/** Genera el informe en texto plano listo para pegar en un correo o una propuesta. */
export function informe(procesos, meta = {}) {
  const orden = priorizar(procesos);
  const t = totales(procesos);
  const lineas = [];
  lineas.push('CÁLCULO DE ROI DE AUTOMATIZACIÓN CON IA' + (meta.empresa ? ' — ' + meta.empresa : ''));
  lineas.push('Generado el ' + (meta.fecha || new Date().toLocaleDateString('es-ES')) + ' con la calculadora gratuita de Plataforma IA (plataformaia.com)');
  lineas.push('');
  lineas.push('SUPUESTOS');
  lineas.push('- Cotización empresarial aplicada: ' + pct((meta.tasaSS ?? TASA_SS_DEFECTO) * 100) + ' sobre el salario bruto');
  lineas.push('- Horas efectivas por persona y año: ' + entero.format(meta.horasEfectivas ?? HORAS_EFECTIVAS_DEFECTO) + ' h');
  lineas.push('- Semanas efectivas al año: ' + entero.format(meta.semanas ?? SEMANAS_EFECTO_DEFECTO));
  lineas.push('');
  for (const p of orden) {
    lineas.push('· ' + p.nombre + ' — ' + ETIQUETA_CUADRANTE[p.cuadrante]);
    lineas.push('  Coste actual del proceso: ' + eur(p.costeAnual) + '/año (' + horas(p.horasAnio) + ' a ' + eur(p.costeHora) + '/h)');
    lineas.push('  Automatizable: ' + pct(p.automatizable * 100) + ' → ' + horas(p.horasAhorradasAnio) + ' al año');
    lineas.push('  Ahorro neto: ' + eur(p.ahorroNeto) + '/año (descontando ' + eur(p.mantenimiento) + ' de mantenimiento)');
    lineas.push('  Inversión: ' + eur(p.implantacion) + ' · Amortización: ' + meses(p.paybackMeses) + ' · Neto a 3 años: ' + eur(p.neto3));
    lineas.push('');
  }
  lineas.push('TOTAL');
  lineas.push('- Coste anual de los procesos analizados: ' + eur(t.costeAnual));
  lineas.push('- Ahorro neto anual: ' + eur(t.ahorroNeto) + ' (' + horas(t.horasAhorradasAnio) + ' liberadas al año)');
  lineas.push('- Inversión total: ' + eur(t.implantacion) + ' · Neto a 3 años: ' + eur(t.neto3));
  lineas.push('');
  lineas.push('Un cálculo de ROI no es una promesa: es una forma de dejar por escrito los supuestos antes de empezar.');
  return lineas.join('\n');
}

/** Exporta los procesos a CSV con separador punto y coma (Excel en español). */
export function csv(procesos) {
  const cabecera = [
    'Proceso', 'Personas', 'Horas/semana por persona', 'Coste hora (EUR)', 'Horas al año',
    'Coste anual (EUR)', 'Automatizable (%)', 'Horas ahorradas al año', 'Ahorro neto anual (EUR)',
    'Inversión (EUR)', 'Mantenimiento anual (EUR)', 'Amortización (meses)', 'Neto a 3 años (EUR)', 'Prioridad',
  ];
  const filas = procesos.map((p) => [
    p.nombre, p.personas, p.horasSemana, p.costeHora, p.horasAnio, p.costeAnual, (p.automatizable * 100).toFixed(0),
    p.horasAhorradasAnio, p.ahorroNeto, p.implantacion, p.mantenimiento,
    isFinite(p.paybackMeses) ? p.paybackMeses : '', p.neto3, ETIQUETA_CUADRANTE[p.cuadrante],
  ]);
  const decimal = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : v);
  const escapar = (v) => {
    const s = String(decimal(v) ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cabecera, ...filas].map((f) => f.map(escapar).join(';')).join('\r\n');
}

function clamp(valor, min, max) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
