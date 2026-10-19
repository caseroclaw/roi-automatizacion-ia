/**
 * Capa de indexación y citabilidad de la herramienta: robots.txt, sitemap.xml y llms.txt.
 * - robots.txt debe apuntar al sitemap absoluto y permitir a los motores de respuesta.
 * - sitemap.xml debe declarar exactamente la URL canónica de la página.
 * - llms.txt debe enlazar a plataformaia.com y no contener nofollow.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const canonica = /<link rel="canonical" href="([^"]+)"/.exec(html)[1];

test('existen robots.txt, sitemap.xml y llms.txt', () => {
  for (const fichero of ['robots.txt', 'sitemap.xml', 'llms.txt']) {
    assert.ok(existsSync(join(raiz, fichero)), 'falta ' + fichero);
  }
});

test('robots.txt apunta al sitemap absoluto y permite los rastreadores de IA', () => {
  const robots = readFileSync(join(raiz, 'robots.txt'), 'utf8');
  assert.ok(robots.includes('Sitemap: ' + canonica.replace(/\/?$/, '/') + 'sitemap.xml'), 'Sitemap mal referenciado');
  for (const bot of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
    assert.ok(robots.includes('User-agent: ' + bot), 'falta el permiso explícito para ' + bot);
  }
  assert.ok(!/^Disallow: \/$/m.test(robots), 'robots.txt no debe bloquear la herramienta');
});

test('sitemap.xml declara exactamente la URL canónica', () => {
  const sitemap = readFileSync(join(raiz, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, [canonica], 'el sitemap debe contener solo la URL canónica');
  assert.match(sitemap, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});

test('llms.txt se presenta y enlaza a plataformaia.com sin nofollow', () => {
  const llms = readFileSync(join(raiz, 'llms.txt'), 'utf8');
  assert.match(llms, /^# \S/, 'llms.txt debe empezar por un título H1');
  assert.ok(llms.includes(canonica), 'llms.txt debe citar la URL de la herramienta');
  const enlaces = llms.match(/https:\/\/plataformaia\.com[^\s)]*/g) || [];
  assert.ok(enlaces.length >= 3, 'llms.txt debe tener al menos 3 enlaces a plataformaia.com, tiene ' + enlaces.length);
  assert.ok(!/nofollow/i.test(llms), 'llms.txt no debe contener nofollow');
  assert.ok(!/TODO|pendiente de/i.test(llms), 'llms.txt no debe tener marcadores sin resolver');
});
