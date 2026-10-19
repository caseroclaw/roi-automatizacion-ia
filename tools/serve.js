#!/usr/bin/env node
/**
 * Servidor estático mínimo para probar la página en local (solo desarrollo).
 * Uso: node tools/serve.js [puerto]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const puerto = Number(process.argv[2]) || 8140;
const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  const ruta = normalize(decodeURIComponent((req.url || '/').split('?')[0]));
  const archivo = ruta === '/' || ruta === '\\' ? join(raiz, 'index.html') : join(raiz, ruta);
  if (!archivo.startsWith(raiz)) {
    res.writeHead(403).end('Prohibido');
    return;
  }
  try {
    const contenido = await readFile(archivo);
    res.writeHead(200, { 'content-type': tipos[extname(archivo)] || 'application/octet-stream' });
    res.end(contenido);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('No encontrado');
  }
}).listen(puerto, '127.0.0.1', () => {
  console.log('Sirviendo en http://127.0.0.1:' + puerto + '/');
});
