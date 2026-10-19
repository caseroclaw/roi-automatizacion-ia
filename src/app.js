/**
 * Interfaz de la calculadora. Sin red, sin dependencias: solo DOM y el núcleo roi.js.
 */
import {
  calcularProceso, priorizar, totales, informe, csv, eur, horas, pct, meses,
  aNumero, ETIQUETA_CUADRANTE, ETIQUETA_CORTA, TASA_SS_DEFECTO, HORAS_EFECTIVAS_DEFECTO, SEMANAS_EFECTO_DEFECTO,
} from './roi.js';

const CLAVE = 'plataformaia-roi-v1';
const MAX_PROCESOS = 6;

const EJEMPLO = [
  { nombre: 'Altas y datos de clientes', personas: '2', horasSemana: '5', brutoAnual: '24000', automatizable: '70', implantacion: '4500', mantenimiento: '600', dificultad: '2' },
  { nombre: 'Conciliación de facturas y cobros', personas: '1', horasSemana: '6', brutoAnual: '26000', automatizable: '60', implantacion: '6000', mantenimiento: '900', dificultad: '3' },
  { nombre: 'Presupuestos desde fotos y medidas', personas: '2', horasSemana: '4', brutoAnual: '28000', automatizable: '50', implantacion: '7500', mantenimiento: '1200', dificultad: '4' },
];

const CAMPOS = [
  { clave: 'nombre', tipo: 'text', ancho: '1 1 220px', etiqueta: 'Nombre del proceso' },
  { clave: 'personas', tipo: 'text', ancho: '76px', etiqueta: 'Personas' },
  { clave: 'horasSemana', tipo: 'text', ancho: '90px', etiqueta: 'Horas por semana y persona' },
  { clave: 'brutoAnual', tipo: 'text', ancho: '110px', etiqueta: 'Salario bruto anual por persona' },
  { clave: 'automatizable', tipo: 'text', ancho: '90px', etiqueta: 'Porcentaje automatizable' },
  { clave: 'implantacion', tipo: 'text', ancho: '110px', etiqueta: 'Coste de implantación' },
  { clave: 'mantenimiento', tipo: 'text', ancho: '110px', etiqueta: 'Mantenimiento anual' },
  { clave: 'dificultad', tipo: 'text', ancho: '76px', etiqueta: 'Dificultad de 1 a 5' },
];

const $ = (sel) => document.querySelector(sel);
const cuerpoProcesos = $('#tablaProcesos tbody');
const cuerpoResultados = $('#tablaResultados tbody');
const resumen = $('#resumen');
const aviso = $('#aviso');

let filas = [];

function leerSupuestos() {
  return {
    tasaSS: aNumero($('#tasaSS').value) / 100,
    horasEfectivas: aNumero($('#horasEfectivas').value),
    semanas: aNumero($('#semanas').value),
  };
}

function nuevaFila(datos = {}) {
  const tr = document.createElement('tr');
  for (const campo of CAMPOS) {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = campo.tipo;
    input.inputMode = campo.clave === 'nombre' ? 'text' : 'decimal';
    input.setAttribute('aria-label', campo.etiqueta);
    input.dataset.clave = campo.clave;
    input.value = datos[campo.clave] ?? '';
    if (campo.ancho) input.style.maxWidth = campo.ancho;
    input.addEventListener('input', () => {
      input.classList.remove('invalido');
      recalcular();
    });
    td.appendChild(input);
    tr.appendChild(td);
  }
  const tdQuitar = document.createElement('td');
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'icono';
  boton.textContent = '✕';
  boton.title = 'Quitar este proceso';
  boton.setAttribute('aria-label', 'Quitar este proceso');
  boton.addEventListener('click', () => {
    filas = filas.filter((f) => f !== tr);
    tr.remove();
    recalcular();
  });
  tdQuitar.appendChild(boton);
  tr.appendChild(tdQuitar);
  cuerpoProcesos.appendChild(tr);
  filas.push(tr);
  return tr;
}

/** Lee las filas y devuelve los procesos válidos, marcando los campos con error. */
function leerProcesos(supuestos) {
  const procesos = [];
  let errores = 0;
  for (const tr of filas) {
    const datos = {};
    for (const input of tr.querySelectorAll('input')) {
      datos[input.dataset.clave] = input.value.trim();
    }
    const vacia = CAMPOS.every((c) => datos[c.clave] === '');
    if (vacia) continue;

    const nombre = datos.nombre || 'Proceso sin nombre';
    const personas = aNumero(datos.personas);
    const horasSemana = aNumero(datos.horasSemana);
    const brutoAnual = aNumero(datos.brutoAnual);
    const automatizable = aNumero(datos.automatizable);
    const implantacion = aNumero(datos.implantacion);
    const mantenimiento = datos.mantenimiento === '' ? 0 : aNumero(datos.mantenimiento);
    const dificultad = datos.dificultad === '' ? 3 : aNumero(datos.dificultad);

    const invalidos = [];
    if (!(personas > 0)) invalidos.push('personas');
    if (!(horasSemana > 0)) invalidos.push('horasSemana');
    if (!(brutoAnual > 0)) invalidos.push('brutoAnual');
    if (!(automatizable >= 0 && automatizable <= 100)) invalidos.push('automatizable');
    if (!(implantacion >= 0)) invalidos.push('implantacion');
    if (!(mantenimiento >= 0)) invalidos.push('mantenimiento');
    if (!(dificultad >= 1 && dificultad <= 5)) invalidos.push('dificultad');

    for (const input of tr.querySelectorAll('input')) {
      input.classList.toggle('invalido', invalidos.includes(input.dataset.clave));
    }
    if (invalidos.length) {
      errores += 1;
      continue;
    }

    procesos.push(
      calcularProceso({
        nombre,
        personas,
        horasSemana,
        brutoAnual,
        automatizable: automatizable / 100,
        implantacion,
        mantenimiento,
        dificultad,
        tasaSS: supuestos.tasaSS,
        horasEfectivas: supuestos.horasEfectivas,
        semanas: supuestos.semanas,
      })
    );
  }
  return { procesos, errores };
}

function pintarResumen(procesos, supuestos) {
  resumen.replaceChildren();
  if (!procesos.length) {
    const p = document.createElement('p');
    p.className = 'vacio';
    p.textContent = 'Añade al menos un proceso con sus horas y su coste para ver el resultado.';
    resumen.appendChild(p);
    return;
  }
  const t = totales(procesos);
  const horaMedia = procesos.reduce((a, p) => a + p.costeHora, 0) / procesos.length;
  const tarjetas = [
    { etiqueta: 'Coste por hora cargado', valor: eur(horaMedia), nota: 'media de los procesos' },
    { etiqueta: 'Coste anual del proceso manual', valor: eur(t.costeAnual) },
    { etiqueta: 'Ahorro neto anual', valor: eur(t.ahorroNeto), clase: t.ahorroNeto > 0 ? 'buena' : 'mala' },
    { etiqueta: 'Horas liberadas al año', valor: horas(t.horasAhorradasAnio), nota: horas(t.horasAhorradasAnio / 12) + ' al mes' },
    { etiqueta: 'Inversión total', valor: eur(t.implantacion) },
    { etiqueta: 'Neto a 3 años', valor: eur(t.neto3), clase: t.neto3 > 0 ? 'buena' : 'mala' },
  ];
  for (const tarjeta of tarjetas) {
    const div = document.createElement('div');
    div.className = 'tarjeta' + (tarjeta.clase ? ' ' + tarjeta.clase : '');
    const etiqueta = document.createElement('p');
    etiqueta.className = 'etiqueta';
    etiqueta.textContent = tarjeta.etiqueta;
    const valor = document.createElement('p');
    valor.className = 'valor';
    valor.textContent = tarjeta.valor;
    div.append(etiqueta, valor);
    if (tarjeta.nota) {
      const nota = document.createElement('small');
      nota.textContent = tarjeta.nota;
      div.appendChild(nota);
    }
    resumen.appendChild(div);
  }
  const primera = priorizar(procesos)[0];
  const recomendacion = document.createElement('p');
  recomendacion.className = 'hint';
  recomendacion.style.marginTop = '14px';
  recomendacion.innerHTML =
    'Empieza por <strong>' + escapar(primera.nombre) + '</strong> (' +
    escapar(ETIQUETA_CORTA[primera.cuadrante]) + '): ' +
    horas(primera.horasMesAhorradas) + ' al mes y amortización en ' + meses(primera.paybackMeses) + '.';
  resumen.appendChild(recomendacion);
}

function pintarResultados(procesos) {
  cuerpoResultados.replaceChildren();
  if (!procesos.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'vacio';
    td.textContent = 'Sin resultados todavía.';
    tr.appendChild(td);
    cuerpoResultados.appendChild(tr);
    return;
  }
  for (const p of priorizar(procesos)) {
    const tr = document.createElement('tr');
    const celdas = [
      { texto: p.nombre },
      { texto: eur(p.costeAnual), num: true },
      { texto: horas(p.horasAhorradasAnio), num: true },
      { texto: eur(p.ahorroNeto), num: true, clase: p.ahorroNeto > 0 ? '' : 'mala' },
      { texto: meses(p.paybackMeses), num: true },
      { texto: eur(p.neto3), num: true },
    ];
    for (const celda of celdas) {
      const td = document.createElement('td');
      td.textContent = celda.texto;
      if (celda.num) td.className = 'num';
      if (celda.clase === 'mala') td.style.color = 'var(--alerta)';
      tr.appendChild(td);
    }
    const tdPrioridad = document.createElement('td');
    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta-prioridad p-' + p.cuadrante;
    etiqueta.textContent = ETIQUETA_CORTA[p.cuadrante];
    tdPrioridad.appendChild(etiqueta);
    tr.appendChild(tdPrioridad);
    cuerpoResultados.appendChild(tr);
  }
}

function recalcular() {
  const supuestos = leerSupuestos();
  const supuestosValidos =
    supuestos.tasaSS >= 0 && supuestos.tasaSS < 1 && supuestos.horasEfectivas > 0 && supuestos.semanas > 0;
  $('#tasaSS').classList.toggle('invalido', !(supuestos.tasaSS >= 0 && supuestos.tasaSS < 1));
  $('#horasEfectivas').classList.toggle('invalido', !(supuestos.horasEfectivas > 0));
  $('#semanas').classList.toggle('invalido', !(supuestos.semanas > 0));

  const { procesos, errores } = supuestosValidos ? leerProcesos(supuestos) : { procesos: [], errores: 0 };
  pintarResumen(procesos, supuestos);
  pintarResultados(procesos);
  aviso.textContent = errores
    ? 'Hay ' + errores + ' proceso(s) con campos en rojo: revisa personas, horas, salario, porcentaje (0-100), importes y dificultad (1-5).'
    : '';
  aviso.style.color = errores ? 'var(--alerta)' : 'var(--ok)';
  return { procesos, supuestos };
}

function textoInforme(procesos, supuestos) {
  return informe(procesos, {
    empresa: '',
    fecha: new Date().toLocaleDateString('es-ES'),
    tasaSS: supuestos.tasaSS,
    horasEfectivas: supuestos.horasEfectivas,
    semanas: supuestos.semanas,
  });
}

function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function guardar() {
  try {
    const datos = filas.map((tr) => {
      const obj = {};
      for (const input of tr.querySelectorAll('input')) obj[input.dataset.clave] = input.value;
      return obj;
    });
    localStorage.setItem(CLAVE, JSON.stringify({
      supuestos: { tasaSS: $('#tasaSS').value, horasEfectivas: $('#horasEfectivas').value, semanas: $('#semanas').value },
      procesos: datos,
    }));
    aviso.textContent = 'Guardado en este navegador. Nada se ha enviado a ningún servidor.';
    aviso.style.color = 'var(--ok)';
  } catch {
    aviso.textContent = 'Tu navegador no permite guardar datos locales; el cálculo sigue funcionando.';
  }
}

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return false;
    const datos = JSON.parse(crudo);
    if (datos.supuestos) {
      $('#tasaSS').value = datos.supuestos.tasaSS ?? '31,4';
      $('#horasEfectivas').value = datos.supuestos.horasEfectivas ?? '1750';
      $('#semanas').value = datos.supuestos.semanas ?? '46';
    }
    for (const p of datos.procesos || []) nuevaFila(p);
    return (datos.procesos || []).length > 0;
  } catch {
    return false;
  }
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// --- eventos ---
$('#anadir').addEventListener('click', () => {
  if (filas.length >= MAX_PROCESOS) {
    aviso.textContent = 'Para comparar más de ' + MAX_PROCESOS + ' procesos, exporta el CSV y trabaja en tandas.';
    aviso.style.color = 'var(--alerta)';
    return;
  }
  nuevaFila();
  recalcular();
});

$('#ejemplo').addEventListener('click', () => {
  filas.forEach((f) => f.remove());
  filas = [];
  for (const p of EJEMPLO) nuevaFila(p);
  recalcular();
  aviso.textContent = 'Ejemplo cargado: tres procesos típicos de una pyme de servicios. Cambia las cifras por las tuyas.';
  aviso.style.color = 'var(--ok)';
});

$('#limpiar').addEventListener('click', () => {
  filas.forEach((f) => f.remove());
  filas = [];
  nuevaFila();
  recalcular();
  aviso.textContent = '';
  try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
});

$('#copiar').addEventListener('click', async () => {
  const { procesos, supuestos } = recalcular();
  if (!procesos.length) {
    aviso.textContent = 'No hay procesos válidos que copiar.';
    aviso.style.color = 'var(--alerta)';
    return;
  }
  const texto = textoInforme(procesos, supuestos);
  try {
    await navigator.clipboard.writeText(texto);
    aviso.textContent = 'Informe copiado al portapapeles.';
  } catch {
    descargar('informe-roi.txt', texto, 'text/plain;charset=utf-8');
    aviso.textContent = 'El navegador no permite copiar: se ha descargado el informe.';
  }
  aviso.style.color = 'var(--ok)';
});

$('#descargarTxt').addEventListener('click', () => {
  const { procesos, supuestos } = recalcular();
  if (!procesos.length) return;
  descargar('informe-roi-automatizacion.txt', textoInforme(procesos, supuestos), 'text/plain;charset=utf-8');
});

$('#descargarCsv').addEventListener('click', () => {
  const { procesos } = recalcular();
  if (!procesos.length) return;
  descargar('roi-automatizacion.csv', '\ufeff' + csv(procesos), 'text/csv;charset=utf-8');
});

for (const id of ['tasaSS', 'horasEfectivas', 'semanas']) {
  $('#' + id).addEventListener('input', recalcular);
}

// --- arranque ---
const restaurado = cargar();
if (!restaurado) {
  nuevaFila({ nombre: '', personas: '1', horasSemana: '', brutoAnual: '', automatizable: '60', implantacion: '', mantenimiento: '', dificultad: '3' });
}
recalcular();
window.addEventListener('beforeunload', guardar);
