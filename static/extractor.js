/*
 * Extracción de marcajes desde una hoja de corte de Llaza en PDF, hecha
 * enteramente en el navegador con pdf.js (sin servidor).
 *
 * Estrategia (equivalente a la versión Python con pdfplumber, adaptada a
 * los datos que da pdf.js — texto con posición x/y, sin líneas de tabla):
 *   1. Leer cada página con pdf.js y agrupar sus fragmentos de texto en
 *      "líneas" según su coordenada Y.
 *   2. En las primeras líneas de cada página, buscar el fragmento que es
 *      la cabecera "MARCAJE" y quedarnos con su franja de columna (X),
 *      calculada como el punto medio con las cabeceras vecinas.
 *   3. Para cada línea de datos, tomar los fragmentos que caen dentro de
 *      esa franja de columna, reconstruir el texto de la celda y partirlo
 *      en códigos de marcaje.
 *   4. El nº de hoja/pedido se busca por texto en todo el documento.
 */

const CABECERAS_MARCAJE = new Set(['marcaje', 'marcajes', 'marca', 'marcado', 'marcas']);

const RE_HOJA = /(?:hoja\s+de\s+corte|hoja\s+corte|h\.?\s*corte|n[ºo°]\s*hoja|hoja\s*n[ºo°]?|orden\s+de\s+corte|orden\s+de\s+fabricaci[oó]n|of\.?\s*fabricaci[oó]n|n[ºo°]?\s*pedido|pedido\s*n[ºo°]?|albar[aá]n)\s*[:.\-nºo°]{0,4}\s*(\d{4,}[\dA-Z\-/.]{0,14}|[A-Z]{1,4}[\-/]?\d{3,}[\dA-Z\-/.]{0,10})/i;

const RE_NUM_SUELTO = /(?<![\wº°])([A-Z]{0,4}\d{6,})(?![\w])/;

// "COLOR ESTRUC: 7140 MATE" -> "7140". Solo el color de la estructura,
// no el de las lamas (aunque suelen ser el mismo número).
const RE_COLOR_ESTRUC = /color\s*estruc(?:tura)?\.?\s*:?\s*(\d{3,6})/i;

// "DIMENSIONES: 3020 x 5450 mm" o "DIMENS. PÉRGOLA: 7380x8640 mm" ->
// medida de la pérgola. (No coge "DIMENS. MÓDULO 1: ...", que es la de un módulo.)
const RE_MEDIDA = /dimens(?:iones|\.)?\s*(?:p[eé]rgola)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*mm/i;

// "DIMENS. MÓDULO 2-3: ..." -> "2-3" (módulos que cubre esta hoja).
const RE_MODULOS = /m[oó]dulos?\s*(\d+(?:\s*-\s*\d+)?)\s*:/i;

const RE_MARCAJE_OK = /^[A-Z0-9][A-Z0-9\-._]{1,19}$/;

function normaliza(texto) {
  if (!texto) return '';
  let t = texto.trim().toLowerCase();
  for (const [a, b] of [['á', 'a'], ['é', 'e'], ['í', 'i'], ['ó', 'o'], ['ú', 'u']]) {
    t = t.split(a).join(b);
  }
  return t.replace(/\s+/g, ' ');
}

function parteCeldaMarcaje(celda) {
  if (!celda) return [];
  const trozos = celda.split(/[\n\r;,]+|\s*\/\s*|\s{2,}/);
  const codigos = [];
  for (const trozo of trozos) {
    const cod = trozo.trim().toUpperCase().replace(/ /g, '');
    if (!cod) continue;
    if (RE_MARCAJE_OK.test(cod) && /[A-Z]/.test(cod) && /\d/.test(cod)) codigos.push(cod);
  }
  return codigos;
}

// Algunos PDF traen guiones "raros" (‐ ‑ ‒ – — −) en vez del "-" normal
// (p. ej. "V7‐8"): se unifican, y los espacios duros pasan a espacio normal.
function normalizaTexto(s) {
  return String(s || '').replace(/[‐-―−]/g, '-').replace(/ /g, ' ');
}

// Agrupa los fragmentos de texto de una página en líneas según su Y,
// tolerando pequeñas diferencias (letras con distinto alto en la misma fila).
// Las coordenadas se pasan a las de la página "tal como se ve" (Y hacia
// abajo, con la rotación de la página ya aplicada): hay hojas que vienen
// giradas 90° y con las coordenadas en bruto salían las filas del revés.
function agrupaEnLineas(items, viewport) {
  const TOL_Y = 2.2;
  const ordenados = items
    .map((it) => {
      const [a, b, , , e, f] = it.transform;
      const [x, y] = viewport.convertToViewportPoint(e, f);
      const n = Math.hypot(a, b) || 1;
      const [x2, y2] = viewport.convertToViewportPoint(e + (it.width || 0) * a / n, f + (it.width || 0) * b / n);
      return { str: normalizaTexto(it.str), x, y, width: Math.hypot(x2 - x, y2 - y) };
    })
    .filter((it) => it.str && it.str.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const lineas = [];
  for (const it of ordenados) {
    let linea = lineas.find((l) => Math.abs(l.y - it.y) <= TOL_Y);
    if (!linea) {
      linea = { y: it.y, items: [] };
      lineas.push(linea);
    }
    linea.items.push(it);
  }
  lineas.sort((a, b) => a.y - b.y);
  for (const l of lineas) l.items.sort((a, b) => a.x - b.x);
  return lineas;
}

// Reconstruye el texto de una franja de columna a partir de los fragmentos
// de una línea que caen dentro de ella. Si hay un hueco grande entre dos
// fragmentos se marca con doble espacio (así luego se separan como dos
// códigos, igual que hacía pdfplumber con las celdas).
function textoDeFranja(linea, xMin, xMax) {
  const items = linea.items.filter((it) => {
    const centro = it.x + it.width / 2;
    return (centro >= xMin && centro < xMax) || (it.x >= xMin && it.x < xMax);
  });
  if (!items.length) return '';
  let out = items[0].str;
  for (let i = 1; i < items.length; i++) {
    const anterior = items[i - 1];
    const hueco = items[i].x - (anterior.x + anterior.width);
    out += (hueco > 4 ? '  ' : ' ') + items[i].str;
  }
  return out;
}

function buscaCabeceraMarcaje(linea) {
  for (let i = 0; i < linea.items.length; i++) {
    const n = normaliza(linea.items[i].str);
    if (CABECERAS_MARCAJE.has(n) || n.startsWith('marcaj')) return i;
  }
  return -1;
}

async function procesaPagina(page, colPrevia) {
  const contenido = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const lineas = agrupaEnLineas(contenido.items, viewport);
  const anchoPagina = viewport.width;

  const textoLineas = lineas.map((l) => l.items.map((it) => it.str).join(' '));

  let colRange = null;
  let idxCabecera = -1;
  for (let i = 0; i < Math.min(15, lineas.length); i++) {
    const idx = buscaCabeceraMarcaje(lineas[i]);
    if (idx >= 0) {
      const its = lineas[i].items;
      const xIzq = idx > 0 ? (its[idx - 1].x + its[idx].x) / 2 : 0;
      const xDer = idx < its.length - 1 ? (its[idx].x + its[idx + 1].x) / 2 : anchoPagina;
      colRange = { min: xIzq, max: xDer };
      idxCabecera = i;
      break;
    }
  }

  // Filas "LAMA LED" y su cantidad (el primer número que va detrás del nombre).
  const led = [];
  for (const l of lineas) {
    const its = l.items;
    let idx = its.findIndex((it) => /lama\s*led/i.test(it.str));
    if (idx < 0) {
      const j = its.findIndex((it, k) => /^lama$/i.test(it.str.trim()) && k + 1 < its.length && /^led$/i.test(its[k + 1].str.trim()));
      idx = j >= 0 ? j + 1 : -1;
    }
    if (idx < 0) continue;
    for (let k = idx + 1; k < its.length; k++) {
      if (/^\d+$/.test(its[k].str.trim())) { led.push(parseInt(its[k].str, 10)); break; }
    }
  }

  const usable = colRange || colPrevia || null;
  const codigos = [];
  let filasDatos = 0;
  if (usable) {
    for (let i = 0; i < lineas.length; i++) {
      if (i === idxCabecera) continue;
      const celda = textoDeFranja(lineas[i], usable.min, usable.max);
      const cods = parteCeldaMarcaje(celda);
      if (cods.length) codigos.push(...cods);
      filasDatos++;
    }
  }

  return {
    texto: textoLineas.join('\n'),
    codigos,
    led,
    colRange: colRange || colPrevia,
    columnaEncontrada: !!colRange,
    filasDatos,
  };
}

async function extraerDePDF(file) {
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;

  let textoTotal = '';
  let marcajes = [];
  const lamaLed = [];
  let colPrevia = null;
  let columnaEncontrada = false;
  let filasDatos = 0;

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const r = await procesaPagina(page, colPrevia);
    textoTotal += '\n' + r.texto;
    marcajes.push(...r.codigos);
    lamaLed.push(...r.led);
    if (r.columnaEncontrada) columnaEncontrada = true;
    colPrevia = r.colRange;
    filasDatos += r.filasDatos;
  }

  const esEscaneado = textoTotal.trim().replace(/\s/g, '').length < 40 && !columnaEncontrada;

  const resultado = {
    marcajes,
    hoja: null,
    colorEstruc: null,
    medida: null,
    modulos: null,
    lamaLed,
    esEscaneado,
    aviso: null,
    nPaginas: pdf.numPages,
    columnaEncontrada,
  };

  if (esEscaneado) {
    resultado.aviso = 'El PDF parece una imagen escaneada (sin texto). Introduce los marcajes a mano.';
    return resultado;
  }

  const mHoja = textoTotal.match(RE_HOJA);
  if (mHoja) {
    resultado.hoja = mHoja[1].trim().toUpperCase();
  } else {
    const cabecera = textoTotal.trim().split('\n').slice(0, 20).join('\n');
    const mSuelto = cabecera.match(RE_NUM_SUELTO);
    if (mSuelto) {
      resultado.hoja = mSuelto[1].toUpperCase();
    } else {
      const base = (file.name || '').replace(/\.pdf$/i, '');
      const mNombre = base.toUpperCase().match(/([A-Z]?\d{4,})/);
      if (mNombre) resultado.hoja = mNombre[1];
    }
  }

  const mColor = textoTotal.match(RE_COLOR_ESTRUC);
  if (mColor) resultado.colorEstruc = mColor[1];

  const mMedida = textoTotal.match(RE_MEDIDA);
  if (mMedida) resultado.medida = `${mMedida[1]} x ${mMedida[2]} mm`;

  const mMod = textoTotal.match(RE_MODULOS);
  if (mMod) resultado.modulos = mMod[1].replace(/\s+/g, '');

  if (!marcajes.length) {
    resultado.aviso = columnaEncontrada
      ? 'Se encontró la columna MARCAJE pero está vacía o no se pudo leer. Revisa e introduce los marcajes a mano.'
      : 'No se pudo localizar la columna MARCAJE en las tablas del PDF. Introduce los marcajes a mano.';
  }

  return resultado;
}

// --- Plano de fabricación ------------------------------------------------
// El plano (una página con el dibujo de la pérgola) trae "MÓDULO 1", "MÓDULO 2"…
// en letra grande y los nodos numerados 1..n en las esquinas. Los marcajes de
// la hoja de corte se nombran con esos nodos (V8-10 = viga del nodo 8 al 10,
// P7 = pilar del nodo 7), así que la posición de los nodos dice a qué módulo
// pertenece cada pieza.

// Centro (en coordenadas de la página tal como se ve) de un trozo de texto.
function centroDeTexto(it, viewport) {
  const [x0, y0] = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
  const s = Math.hypot(it.transform[0], it.transform[1]) || 1;
  const [x1, y1] = viewport.convertToViewportPoint(
    it.transform[4] + (it.transform[0] / s) * it.width,
    it.transform[5] + (it.transform[1] / s) * it.width
  );
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

// Devuelve { modulos: [{n, c}], nodos: [{n, c}] } si el PDF es un plano, o null.
async function leePlano(file) {
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const contenido = await page.getTextContent();
  const items = contenido.items.filter((i) => i.str && i.str.trim());
  const tam = (i) => Math.hypot(i.transform[0], i.transform[1]);

  const modulos = [];
  for (const it of items) {
    const m = it.str.trim().match(/^M[ÓO]DULO\s*(\d+)$/i);
    if (m && tam(it) >= 18 && !modulos.some((x) => x.n === +m[1])) {
      modulos.push({ n: +m[1], c: centroDeTexto(it, viewport) });
    }
  }
  if (!modulos.length) return null;

  // Nodos: números sueltos en letra media-grande (más pequeña que el rótulo
  // MÓDULO y más grande que las cotas).
  const nodos = [];
  for (const it of items) {
    if (/^\d{1,2}$/.test(it.str.trim()) && tam(it) > 12 && tam(it) < 20) {
      nodos.push({ n: +it.str.trim(), c: centroDeTexto(it, viewport) });
    }
  }
  if (nodos.length < 2) return null;
  return { modulos, nodos };
}

// Módulos a los que toca cada nodo: el del rótulo MÓDULO más cercano; si hay
// otro casi igual de cerca (nodo en la pared que separa dos módulos), los dos.
function modulosDeNodos(plano) {
  const mapa = {};
  for (const nd of plano.nodos) {
    const d = plano.modulos
      .map((m) => ({ n: m.n, d: Math.hypot(nd.c[0] - m.c[0], nd.c[1] - m.c[1]) }))
      .sort((a, b) => a.d - b.d);
    mapa[nd.n] = d.filter((x) => x.d <= d[0].d * 1.5).map((x) => x.n);
  }
  return mapa;
}

// [2, 3] -> "2-3"; [1, 3] -> "1, 3".
function textoModulos(lista) {
  const l = [...lista].sort((a, b) => a - b);
  return l.every((n, i) => i === 0 || n === l[i - 1] + 1) && l.length > 1
    ? `${l[0]}-${l[l.length - 1]}`
    : l.join(', ');
}

// ¿Está el punto p sobre el segmento a-b (a menos de 15 pt de la línea)?
function sobreSegmento(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1);
  if (t <= 0.05 || t >= 0.95) return false;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)) < 15;
}

// Piezas (con su módulo) que salen de un marcaje de la hoja según el plano.
// - Pilares (P…): sin módulo.
// - Si todos sus nodos caen en un solo módulo, ese.
// - Canaleta (C a-b) en la pared entre dos módulos: el módulo que queda a su
//   derecha yendo del nodo a al b (el plano cuenta los nodos hacia la derecha).
// - Viga (V a-b) que pasa por un nodo de la pared entre dos módulos (V8-10 con
//   el 9 en medio): dos pegatinas, la suya (V8-10, módulo del nodo a) y la del
//   otro lado (V9-10, módulo del nodo b).
// - Cualquier otra pieza compartida por dos módulos (V9-12): lleva los dos, "2-3".
// `candidatos` = módulos de su hoja de corte (p. ej. [2, 3]).
function nodosDeMarcajes(marcajes) {
  const salida = new Set();
  for (const cod of marcajes) {
    const m = String(cod).match(/^[A-Z]{1,3}(\d+)(?:-(\d+))?$/i);
    if (m) for (const g of m.slice(1)) if (g) salida.add(+g);
  }
  return salida;
}

// `nodosHoja` = nodos que nombran las piezas de esa hoja (el nodo del medio es uno de ellos).
function piezasConModulo(cod, plano, mapaNodos, candidatos, nodosHoja) {
  const sin = [{ t: cod, mod: '' }];
  const m = String(cod).match(/^([A-Z]{1,3})(\d+)(?:-(\d+))?$/i);
  if (!m) return sin;
  const letra = m[1].toUpperCase();
  if (letra === 'P') return sin;
  const nodos = [+m[2], ...(m[3] ? [+m[3]] : [])];
  if (nodos.some((n) => !mapaNodos[n])) return sin;
  const solo = (lista) => {
    const l = lista.filter((x) => !candidatos.length || candidatos.includes(x));
    return l.length === 1 ? String(l[0]) : '';
  };
  const pos = (n) => plano.nodos.find((x) => x.n === n).c;

  let comun = mapaNodos[nodos[0]].slice();
  for (const n of nodos.slice(1)) comun = comun.filter((x) => mapaNodos[n].includes(x));
  comun = comun.filter((x) => !candidatos.length || candidatos.includes(x));
  if (comun.length === 1) return [{ t: cod, mod: String(comun[0]) }];

  if (comun.length > 1) {
    if (letra === 'C' && nodos.length === 2) {
      const [a, b] = [pos(nodos[0]), pos(nodos[1])];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const derecha = [-dy, dx]; // a la derecha de la marcha, con la y hacia abajo
      const medio = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let mejor = null;
      for (const mod of plano.modulos) {
        if (!comun.includes(mod.n)) continue;
        const punt = (mod.c[0] - medio[0]) * derecha[0] + (mod.c[1] - medio[1]) * derecha[1];
        if (!mejor || punt > mejor.punt) mejor = { n: mod.n, punt };
      }
      if (mejor && mejor.punt > 0) return [{ t: cod, mod: String(mejor.n) }];
    }
    // Pieza compartida por dos módulos (p. ej. V9-12, la viga de la pared entre
    // el 2 y el 3): lleva los dos, "2-3".
    return [{ t: cod, mod: textoModulos(comun) }];
  }

  if (letra === 'V' && nodos.length === 2) {
    const [a, b] = nodos;
    const medio = plano.nodos.find(
      (x) => x.n !== a && x.n !== b && nodosHoja.has(x.n) && mapaNodos[x.n].length > 1 && sobreSegmento(x.c, pos(a), pos(b))
    );
    const modA = solo(mapaNodos[a]), modB = solo(mapaNodos[b]);
    if (medio && modA && modB && modA !== modB) {
      return [{ t: cod, mod: modA }, { t: `${letra}${medio.n}-${b}`, mod: modB }];
    }
  }
  return sin;
}
