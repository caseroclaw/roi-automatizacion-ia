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

test('las preguntas del JSON-LD coinciden con las de la página visible', () => {
  const bloque = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
  const faq = JSON.parse(bloque)['@graph'].find((n) => n['@type'] === 'FAQPage');
  for (const item of faq.mainEntity) {
    assert.ok(html.includes('<summary>' + item.name + '</summary>'), 'la pregunta no está visible: ' + item.name);
  }
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
