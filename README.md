# Calculadora de ROI de automatización con IA (pymes ES)

Herramienta web gratuita que pone cifra a lo que cuesta un proceso manual en una pyme española y calcula en cuántos meses se amortiza automatizarlo. Sin backend, sin registro, sin cookies y sin enviar datos: todo se calcula en el navegador.

**Herramienta viva:** https://caseroclaw.github.io/roi-automatizacion-ia/

Hecha por [Plataforma IA](https://plataformaia.com/), consultora de automatización con IA para pymes en España (Madrid).

## El problema que resuelve

Casi todos los casos de negocio de automatización se equivocan en los mismos tres sitios:

1. **Se usa el salario por hora en lugar del coste por hora.** Un bruto de 24.000 € al año no son 13,19 €/h: con la cotización empresarial (~31,4 % en el régimen general) y sobre horas efectivas (~1.750, no 1.820), son unos **18,02 €/h**. Un 37 % más.
2. **No se descuenta el mantenimiento.** Licencias, alojamiento y soporte se restan *antes* de llamar ahorro a nada. Si se comen el ahorro, la inversión no se amortiza nunca y la herramienta lo dice con esa palabra.
3. **No se prioriza.** Con seis procesos sobre la mesa, el orden importa más que la suma.

## Qué calcula

- **Coste por hora cargado** = bruto anual × (1 + cotización) ÷ horas efectivas al año.
- **Horas al año** = personas × horas por persona y semana × semanas efectivas.
- **Ahorro neto** = coste anual × % automatizable − mantenimiento anual.
- **Amortización (meses)** = inversión ÷ ahorro neto × 12 (`nunca` si el ahorro neto ≤ 0).
- **Neto a 3 años** = ahorro neto × 3 − inversión.
- **Prioridad** en una matriz de dos ejes: horas ahorradas al mes (≥ 10 h) frente a dificultad (≤ 2,5). Cuatro cuadrantes: *Empezar aquí*, *Planificar*, *Si hay capacidad*, *Más adelante*.

Salidas: informe en texto (para pegar en una propuesta o un correo) y CSV con separador `;` y coma decimal, listo para Excel en español.

## Uso

Abre la página publicada, o en local:

```bash
node tools/serve.js 8140   # http://127.0.0.1:8140/
npm test                   # 22 pruebas del núcleo y de la propia página
npm run check              # verificación previa al despliegue
```

## Estructura

```
index.html        página (contenido citable + JSON-LD SoftwareApplication y FAQPage)
styles.css        hoja de estilos, sin dependencias
src/roi.js        núcleo de cálculo puro, sin DOM ni red (importable desde Node)
src/app.js        interfaz: tabla de procesos, resultados, informe, CSV, localStorage
tests/            node:test — fórmulas con números calculados a mano y comprobaciones de la página
tools/serve.js    servidor estático para desarrollo
tools/check-page.js  comprobaciones de despliegue (enlaces sin nofollow, JSON-LD, cero recursos remotos)
```

`src/roi.js` no toca el DOM: se puede importar en Node para generar informes en lote.

```js
import { calcularProceso, priorizar, informe } from './src/roi.js';

const p = calcularProceso({
  nombre: 'Altas de clientes', personas: 2, horasSemana: 5, brutoAnual: 24000,
  automatizable: 0.7, implantacion: 4500, mantenimiento: 600, dificultad: 2,
});
console.log(informe([p], { empresa: 'Talleres Ejemplo SL' }));
```

## Lo que NO hace

No estima ingresos adicionales por vender más o atender fuera de horario, no valora el riesgo de error humano y no sustituye a un piloto. Sirve para lo que sirve un buen caso de negocio: dejar por escrito los supuestos antes de empezar y poder discutirlos.

## Aviso

Las cifras de cotización son orientativas para el régimen general en 2026 y deben ajustarse al convenio y al perfil real. No es asesoramiento fiscal ni financiero. La referencia normativa de la cotización es la Tesorería General de la Seguridad Social; la de los tipos, la Ley de Presupuestos vigente.

## Licencia

MIT — ver [LICENSE](LICENSE).

## Otras herramientas gratuitas de Plataforma IA

- [Generador de QR VeriFactu](https://caseroclaw.github.io/verifactu-qr-web/) — URL de cotejo y QR tributario desde los datos de la factura.
- [Librería `verifactu-qr`](https://github.com/caseroclaw/verifactu-qr) — Python, CLI y servidor MCP.
- [Extensión de navegador VeriFactu QR](https://github.com/caseroclaw/verifactu-qr-extension) — Edge, Chrome y Firefox.
- Guías: [precios y márgenes con IA en una pyme](https://plataformaia.com/es/blog/ia-precios-margenes-pymes) · [procesos de back-office que se automatizan primero](https://plataformaia.com/es/blog/automatizacion-procesos-backoffice-ia-pymes) · [consultoría IA en Madrid](https://plataformaia.com/es/consultoria-ia-madrid).

---

## English summary

Free **AI automation ROI calculator** for Spanish SMEs. It uses the real employer cost of an hour — gross salary plus Spain's ~31.4 % employer social security contribution over ~1,750 effective hours a year — subtracts running costs before calling anything a saving, and returns payback in months and a three-year net figure. Processes are ranked on a two-axis matrix of hours saved per month versus implementation difficulty. Pure client-side JavaScript: no backend, no tracking, no network requests. `src/roi.js` is DOM-free and importable from Node. MIT licensed.
