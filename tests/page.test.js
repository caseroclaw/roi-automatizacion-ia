/**
 * Comprobaciones de la página: contenido citable, enlaces de marca sin nofollow,
 * JSON-LD válido y ausencia de recursos remotos (la herramienta debe ser autocontenida).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');

test('la página enlaza a plataformaia.com al menos 4 veces y sin nofollow', () => {
  const enlaces = html.match(/<a [^>]*href="https:\/\/plataformaia\.com[^"]*"[^>]*>/g) || [];
  assert.ok(enlaces.length >= 4, 'debe haber al menos 4 enlaces a plataformaia.com, hay ' + enlaces.length);
  for (const enlace of enlaces) {
    assert.ok(!/rel="[^"]*nofollow/.test(enlace), 'ningún enlace de marca debe llevar nofollow: ' + enlace);
  }
});

test('la página no contiene ninguna aparición de nofollow', () => {
  assert.equal((html.match(/nofollow/g) || []).length, 0);
});

test('enlaza a las dos guías del blog y a las páginas de servicio', () => {
  for (const url of [
    'https://plataformaia.com/es/blog/ia-precios-margenes-pymes',
    'https://plataformaia.com/es/blog/automatizacion-procesos-backoffice-ia-pymes',
    'https://plataformaia.com/es/consultoria-ia-madrid',
    'https://plataformaia.com/es/automatizacion-ia',
    'https://plataformaia.com/es/contacto',
  ]) {
    assert.ok(html.includes('href="' + url + '"'), 'falta el enlace ' + url);
  }
});

test('el JSON-LD declara SoftwareApplication y FAQPage con 6 preguntas', () => {
  const bloque = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(bloque, 'debe existir un bloque JSON-LD');
  const datos = JSON.parse(bloque[1]);
  const tipos = (datos['@graph'] || []).map((n) => n['@type']);
  assert.ok(tipos.includes('SoftwareApplication'));
  assert.ok(tipos.includes('FAQPage'));
  const faq = datos['@graph'].find((n) => n['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity.length, 6);
  for (const item of faq.mainEntity) {
    assert.equal(item['@type'], 'Question');
    assert.ok(item.name.length > 15, 'pregunta demasiado corta: ' + item.name);
    assert.ok(item.acceptedAnswer.text.length > 120, 'respuesta demasiado corta: ' + item.name);
  }
  const app = datos['@graph'].find((n) => n['@type'] === 'SoftwareApplication');
  assert.equal(app.offers.price, '0');
  assert.equal(app.creator.url, 'https://plataformaia.com/');
});

test('las preguntas y respuestas del JSON-LD coinciden palabra por palabra con la página visible', () => {
  const bloque = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
  const faq = JSON.parse(bloque)['@graph'].find((n) => n['@type'] === 'FAQPage');
  const limpiar = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const bloques = [...html.matchAll(/<details>([\s\S]*?)<\/details>/g)].map((m) => m[1]);
  assert.equal(bloques.length, faq.mainEntity.length, 'el número de <details> debe igualar al de preguntas del schema');
  for (const item of faq.mainEntity) {
    const visible = bloques.find((b) => limpiar(b).includes(item.name));
    assert.ok(visible, 'la pregunta no está visible: ' + item.name);
    const respuestaVisible = limpiar(visible).replace(limpiar(item.name), '').trim();
    assert.equal(
      respuestaVisible,
      limpiar(item.acceptedAnswer.text),
      'la respuesta visible debe ser idéntica al schema (Google exige texto equivalente): ' + item.name,
    );
  }
});

test('declara la fecha de modificación y la muestra en la página', () => {
  const datos = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  const app = datos['@graph'].find((n) => n['@type'] === 'SoftwareApplication');
  assert.equal(app.dateModified, '2026-10-20');
  assert.ok(app.datePublished);
  assert.ok(html.includes('Actualizado el 20 de octubre de 2026'), 'la fecha debe ser visible, no solo estar en el schema');
});

test('incluye los bloques de intención: para quién sí, para quién no y referencia citable', () => {
  for (const ancla of ['id="para-quien"', 'id="comparativa"', 'id="citar"']) {
    assert.ok(html.includes(ancla), 'falta la sección ' + ancla);
  }
  assert.ok(html.includes('No te sirve si'), 'falta el bloque de límites explícitos');
  assert.ok(html.includes('Cómo citar esta herramienta'), 'falta la referencia citable');
  assert.ok(html.includes('18,02 €'), 'la referencia citable debe incluir la cifra de coste por hora');
});

test('la comparativa cita a los competidores sin enlazarlos (sin relación comercial)', () => {
  const tabla = /<h2 id="comparativa">[\s\S]*?<\/table>/.exec(html)[0];
  assert.ok(tabla.length > 500, 'la tabla comparativa parece vacía');
  for (const nombre of ['Resolvo', 'Summum IA', 'Impulso Pymes IA']) {
    assert.ok(tabla.includes(nombre), 'falta el competidor ' + nombre);
  }
  const enlacesFuera = tabla.match(/href="https?:\/\/(?!plataformaia\.com|caseroclaw\.github\.io)[^"]+"/g) || [];
  assert.deepEqual(enlacesFuera, [], 'la comparativa no debe enlazar a terceros: ' + enlacesFuera.join(', '));
});

test('la página es autocontenida: sin scripts, hojas ni imágenes remotas', () => {
  const remotos = html.match(/(?:src|href)="https?:\/\/[^"]+"/g) || [];
  const cargas = remotos.filter((u) => !/^href=/.test(u));
  assert.deepEqual(cargas, [], 'no debe cargarse ningún recurso remoto: ' + cargas.join(', '));
  for (const ruta of ['styles.css', 'src/app.js', 'src/roi.js']) {
    assert.ok(existsSync(join(raiz, ruta)), 'falta el fichero ' + ruta);
  }
});

test('el contenido citable incluye las fórmulas y los datos de cotización', () => {
  for (const texto of [
    '23,6', '5,5', 'FOGASA', '31,4 %', '1.750', 'cotización empresarial',
    'Amortización (meses)', 'Neto a 3 años', 'Empezar aquí',
  ]) {
    assert.ok(html.includes(texto), 'falta el dato citable: ' + texto);
  }
});
