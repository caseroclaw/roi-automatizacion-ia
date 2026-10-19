#!/usr/bin/env node
/**
 * Verificación previa al despliegue: la página debe enlazar a plataformaia.com sin
 * nofollow, tener JSON-LD válido y no cargar nada remoto.
 * Uso: node tools/check-page.js
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const fallos = [];

const enlaces = html.match(/<a [^>]*href="https:\/\/plataformaia\.com[^"]*"[^>]*>/g) || [];
if (enlaces.length < 4) fallos.push('menos de 4 enlaces a plataformaia.com (' + enlaces.length + ')');
for (const enlace of enlaces) {
  if (/rel="[^"]*nofollow/.test(enlace)) fallos.push('enlace con nofollow: ' + enlace);
}
if (/nofollow/.test(html)) fallos.push('la página contiene la palabra nofollow');

const bloque = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
if (!bloque) {
  fallos.push('falta el bloque JSON-LD');
} else {
  try {
    const datos = JSON.parse(bloque[1]);
    const tipos = (datos['@graph'] || []).map((n) => n['@type']);
    if (!tipos.includes('SoftwareApplication')) fallos.push('JSON-LD sin SoftwareApplication');
    if (!tipos.includes('FAQPage')) fallos.push('JSON-LD sin FAQPage');
    const faq = (datos['@graph'] || []).find((n) => n['@type'] === 'FAQPage');
    if (!faq || faq.mainEntity.length !== 6) fallos.push('FAQPage debe tener 6 preguntas');
    else {
      for (const item of faq.mainEntity) {
        if (!html.includes('<summary>' + item.name + '</summary>')) {
          fallos.push('pregunta del JSON-LD no visible en la página: ' + item.name);
        }
      }
    }
  } catch (error) {
    fallos.push('JSON-LD no es JSON válido: ' + error.message);
  }
}

for (const ruta of ['styles.css', 'src/app.js', 'src/roi.js']) {
  if (!html.includes(ruta)) fallos.push('la página no referencia ' + ruta);
  if (!existsSync(join(raiz, ruta))) fallos.push('falta el fichero ' + ruta);
}

const remotos = (html.match(/<script[^>]*src="https?:[^"]*"/g) || [])
  .concat((html.match(/<link[^>]*href="https?:[^"]*"/g) || []).filter((t) => !/rel="canonical"/.test(t)))
  .concat(html.match(/<img[^>]*src="https?:[^"]*"/g) || []);
if (remotos.length) fallos.push('recursos remotos detectados: ' + remotos.join(', '));

if (fallos.length) {
  console.error('check-page: FALLOS\n- ' + fallos.join('\n- '));
  process.exit(1);
}
console.log('check-page: OK (' + enlaces.length + ' enlaces de marca, sin nofollow, JSON-LD válido, sin recursos remotos)');
