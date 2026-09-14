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

// "DIMENSIONES: 3020 x 5450 mm" -> "3020 x 5450 mm" (medida de la pérgola/toldo).
const RE_MEDIDA = /dimensiones?\.?\s*:?\s*(\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\s*mm)/i;

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

// Agrupa los fragmentos de texto de una página en líneas según su Y,
// tolerando pequeñas diferencias (letras con distinto alto en la misma fila).
function agrupaEnLineas(items) {
  const TOL_Y = 2.2;
  const ordenados = items
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width || 0 }))
    .filter((it) => it.str && it.str.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lineas = [];
  for (const it of ordenados) {
    let linea = lineas.find((l) => Math.abs(l.y - it.y) <= TOL_Y);
    if (!linea) {
      linea = { y: it.y, items: [] };
      lineas.push(linea);
    }
    linea.items.push(it);
  }
  lineas.sort((a, b) => b.y - a.y);
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
    return centro >= xMin && centro < xMax;
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
  const lineas = agrupaEnLineas(contenido.items);
  const anchoPagina = page.view[2] - page.view[0];

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
  let colPrevia = null;
  let columnaEncontrada = false;
  let filasDatos = 0;

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const r = await procesaPagina(page, colPrevia);
    textoTotal += '\n' + r.texto;
    marcajes.push(...r.codigos);
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
  if (mMedida) resultado.medida = mMedida[1].replace(/\s+/g, ' ').trim();

  if (!marcajes.length) {
    resultado.aviso = columnaEncontrada
      ? 'Se encontró la columna MARCAJE pero está vacía o no se pudo leer. Revisa e introduce los marcajes a mano.'
      : 'No se pudo localizar la columna MARCAJE en las tablas del PDF. Introduce los marcajes a mano.';
  }

  return resultado;
}
