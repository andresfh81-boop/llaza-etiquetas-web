/* Etiquetas de corte · Llaza — app 100% en el navegador (sin servidor). */

// --- Formatos de etiqueta (igual que nucleo/etiquetas.py) --------------
const FORMATOS = {
  "21": { etiqueta: "21 etiquetas · APLI 01276 · 3×7 · 70 × 42,4 mm", cols: 3, filas: 7, celda_ancho_mm: 70.0, celda_alto_mm: 42.4, col_gap_mm: 0.0, fuente_marcaje_pt: 50, fuente_hoja_pt: 16, fuente_modulo_pt: 24, margen_top_mm: 0.0, margen_bot_mm: 0.0, margen_h_mm: 0.0 },
  "10": { etiqueta: "10 etiquetas · APLI 01277 · 2×5 · 99,1 × 57 mm", cols: 2, filas: 5, celda_ancho_mm: 99.1, celda_alto_mm: 57.0, col_gap_mm: 2.5, fuente_marcaje_pt: 44, fuente_hoja_pt: 18, fuente_modulo_pt: 40, margen_top_mm: 8.5, margen_bot_mm: 0.0, margen_h_mm: 4.65 },
  "4": { etiqueta: "4 etiquetas · 2×2 · 105 × 148,5 mm", cols: 2, filas: 2, celda_ancho_mm: 105.0, celda_alto_mm: 148.5, col_gap_mm: 0.0, fuente_marcaje_pt: 72, fuente_hoja_pt: 24, margen_top_mm: 0.0, margen_bot_mm: 0.0, margen_h_mm: 0.0 },
  "2": { etiqueta: "2 etiquetas · 1×2 · 210 × 148,5 mm", cols: 1, filas: 2, celda_ancho_mm: 210.0, celda_alto_mm: 148.5, col_gap_mm: 0.0, fuente_marcaje_pt: 100, fuente_hoja_pt: 32, margen_top_mm: 0.0, margen_bot_mm: 0.0, margen_h_mm: 0.0 },
  "1": { etiqueta: "1 etiqueta · página completa · 210 × 297 mm", cols: 1, filas: 1, celda_ancho_mm: 210.0, celda_alto_mm: 297.0, col_gap_mm: 0.0, fuente_marcaje_pt: 150, fuente_hoja_pt: 48, margen_top_mm: 0.0, margen_bot_mm: 0.0, margen_h_mm: 0.0 },
};

const NOMBRES_COLOR = { '#D32F2F': 'Rojo', '#0B6DB5': 'Azul', '#2E7D32': 'Verde', '#F9A825': 'Amarillo', '#000000': 'Negro' };
const COLORES_OK = new Set(Object.keys(NOMBRES_COLOR));

// Ajustes por defecto de formato/disposición/color/tamaño. No se guardan
// en ningún sitio (no hay "configuración estándar"): cada hoja empieza
// siempre igual.
const DEFECTO = { formato: '21', disposicion: 'horizontal', color_marcaje: '#000000', color_hoja: '#808080', fuente_pt: '' };

// --- Navegación entre vistas --------------------------------------------
function ocultarTodas() {
  document.getElementById('vista-portada').hidden = true;
  document.getElementById('vista-revisar').hidden = true;
}

function mostrarPortada() {
  ocultarTodas();
  document.getElementById('vista-portada').hidden = false;
}

function avisoRevisar(msg, tipo) {
  const cont = document.getElementById('aviso-revisar');
  cont.innerHTML = '';
  if (!msg) return;
  const div = document.createElement('div');
  div.className = 'aviso' + (tipo === 'err' ? ' err' : '');
  div.textContent = msg;
  cont.appendChild(div);
}

function pintaOpcionesFormato(formatoSeleccionado) {
  const cont = document.getElementById('opciones-formato');
  cont.innerHTML = '';
  for (const [clave, cfg] of Object.entries(FORMATOS)) {
    const label = document.createElement('label');
    label.className = 'opt';
    label.innerHTML = `<input type="radio" name="formato" value="${clave}"> ${cfg.etiqueta}`;
    label.querySelector('input').checked = clave === formatoSeleccionado;
    cont.appendChild(label);
  }
  const label = document.createElement('label');
  label.className = 'opt';
  label.innerHTML = '<input type="radio" name="formato" value="todos"> Todos los formatos (se imprimen una detrás de otra)';
  label.querySelector('input').checked = formatoSeleccionado === 'todos';
  cont.appendChild(label);
  if (![...cont.querySelectorAll('input')].some((i) => i.checked)) {
    cont.querySelector('input').checked = true;
  }
}

// `marcajes` puede ser una lista de textos o de {t, mod}: "mod" es el módulo
// de la hoja de la que sale el marcaje ("1", "2-3"...) y se imprime en la
// etiqueta para distinguir las hojas de una pérgola de varios módulos.
function mostrarRevisar({ marcajes, hoja, aviso, escaneado, colorEstruc, medida, auto, modulos, infoModulo, led, lama, mediaLama }) {
  ocultarTodas();
  document.getElementById('vista-revisar').hidden = false;

  avisoRevisar(escaneado ? 'El PDF parece escaneado (sin texto). Escribe los marcajes a mano.' : aviso, escaneado ? 'err' : null);

  document.getElementById('hoja').value = hoja || '';
  document.getElementById('color_estruc').value = colorEstruc || '';
  document.getElementById('medida').value = medida || '';

  const lista = document.getElementById('lista');
  lista.innerHTML = '';
  document.getElementById('lista-lamas').innerHTML = '';
  for (const m of (marcajes && marcajes.length ? marcajes : [''])) {
    if (typeof m === 'string') anadirFila(m);
    else anadirFila(m.t, false, m.mod);
  }

  // Al leer un PDF se proponen ya las etiquetas automáticas (tapa sup. y
  // transmisión); en una etiqueta genérica empiezan apagadas.
  autoTapa = !!auto;
  hayInfoModulo = !!infoModulo;
  ledPorModulo = led || {};
  lamaPorModulo = lama || {};
  mediaLamaPorModulo = mediaLama || {};
  ajustesEnvio = { ...AJUSTES_ENVIO_DEFECTO };
  ajustesLamas = { ...AJUSTES_LAMAS_DEFECTO };
  ajustesComp = { ...AJUSTES_COMP_DEFECTO };
  document.getElementById('comp-cant').value = 1;
  idioma = 'es';
  document.getElementById('idioma').value = 'es';
  cambiaPestana('componentes');
  iniciaExtras();
  document.getElementById('fs-extras').hidden = !auto;
  document.getElementById('fs-extras-lamas').hidden = !auto;
  document.getElementById('auto-modulos').value = auto ? (modulos || '1') : '';
  // Cajas de envío: por defecto una por módulo (una línea por caja).
  rellenaCajas(infoModulo ? parseModulos(modulos) : []);
  regeneraAuto();

  pintaOpcionesFormato(DEFECTO.formato);
  document.querySelector(`input[name=disposicion][value="${DEFECTO.disposicion}"]`).checked = true;
  document.getElementById('fuente_pt').value = DEFECTO.fuente_pt;
  document.querySelector(`input[name=color_marcaje][value="${DEFECTO.color_marcaje}"]`).checked = true;
  document.getElementById('color_hoja').value = DEFECTO.color_hoja;
}

function subirPDF() {
  document.getElementById('pdf').click();
}

// Lee una o varias hojas de corte (p. ej. MOD. 1 y MOD. 2-3 de una pérgola
// de 3 módulos) y las junta en una sola lista.
async function procesarArchivosPDF(archivos) {
  const files = [...(archivos || [])];
  if (!files.length) return;
  const pdfs = files.filter((f) => /\.pdf$/i.test(f.name));
  if (!pdfs.length) {
    alert('El archivo debe ser un PDF.');
    return;
  }
  const estado = document.getElementById('nombre-pdf');
  const lecturas = [];
  const fallos = [];
  let plano = null;
  let nombrePlano = '';
  for (const file of pdfs) {
    estado.textContent = 'Leyendo ' + file.name + '…';
    try {
      // El plano (dibujo con MÓDULO 1, 2, 3…) no es una hoja de corte: sirve
      // para saber a qué módulo pertenece cada pieza.
      const p = plano ? null : await leePlano(file).catch(() => null);
      if (p) { plano = p; nombrePlano = file.name; continue; }
      lecturas.push({ nombre: file.name, r: await extraerDePDF(file) });
    } catch (err) {
      fallos.push(file.name + ' (' + err.message + ')');
    }
  }
  estado.textContent = 'Ningún archivo seleccionado';
  if (!lecturas.length && plano) {
    alert('Has soltado solo el plano. Suelta también la hoja de corte (o varias) para leer las piezas.');
    return;
  }
  if (!lecturas.length) {
    alert('No se ha podido leer el PDF (' + fallos.join(', ') + '). Prueba con "Crear etiqueta genérica" e introduce los marcajes a mano.');
    return;
  }

  // Módulos que cubren todas las hojas juntas (1 + 2-3 -> 1, 2, 3).
  const modulos = [];
  for (const { r } of lecturas) for (const n of parseModulos(r.modulos)) if (!modulos.includes(n)) modulos.push(n);
  modulos.sort((a, b) => a - b);
  const infoModulo = lecturas.some(({ r }) => r.modulos);

  const hojas = [...new Set(lecturas.map(({ r }) => r.hoja).filter(Boolean))];
  const avisos = [];
  if (lecturas.length > 1) avisos.push(`Se han juntado ${lecturas.length} hojas: ${lecturas.map((l) => l.nombre).join(' + ')}.`);
  if (plano) avisos.push(`Plano leído (${nombrePlano}): las piezas llevan su módulo.`);
  if (hojas.length > 1) avisos.push(`Ojo: no tienen el mismo nº de pedido (${hojas.join(', ')}); se ha puesto el primero.`);
  if (fallos.length) avisos.push('No se han podido leer: ' + fallos.join(', ') + '.');
  for (const { r } of lecturas) if (r.aviso && lecturas.length === 1) avisos.push(r.aviso);

  const marcajes = [];
  // Una pegatina solo lleva "MÓD. x" si su hoja es de un único módulo. Una hoja
  // "MÓDULOS 2-3" es un bloque unido: sus piezas no son de un módulo concreto,
  // así que no se pone módulo (nunca dos en la misma etiqueta).
  // Con el plano, las piezas de una hoja de varios módulos sí se pueden repartir:
  // solo quedan sin módulo las que están en la pared que separa dos módulos.
  const mapaNodos = plano ? modulosDeNodos(plano) : null;
  let sinModulo = 0;
  for (const { r } of lecturas) {
    const ms = parseModulos(r.modulos);
    const nodosHoja = nodosDeMarcajes(r.marcajes);
    for (const m of r.marcajes) {
      // Los pilares no llevan módulo.
      if (/^P\d/i.test(m)) { marcajes.push({ t: m, mod: '' }); continue; }
      if (ms.length > 1 && mapaNodos) {
        for (const pz of piezasConModulo(m, plano, mapaNodos, ms, nodosHoja)) {
          if (!pz.mod) sinModulo++;
          marcajes.push(pz);
        }
      } else {
        marcajes.push({ t: m, mod: ms.length === 1 ? r.modulos : '' });
      }
    }
  }
  if (plano && sinModulo) avisos.push(`${sinModulo} piezas están entre dos módulos y van sin módulo.`);

  // LAMA LED y LAMA por módulo: en una hoja con varios módulos (MOD. 2-3) cada fila
  // es de un módulo, por orden (la 1ª fila -> M2, la 2ª -> M3).
  const repartePorModulo = (campo) => {
    const res = {};
    for (const { r } of lecturas) {
      const ms = parseModulos(r.modulos);
      (r[campo] || []).forEach((q, i) => {
        const n = ms.length ? ms[Math.min(i, ms.length - 1)] : 1;
        res[n] = (res[n] || 0) + q;
      });
    }
    return res;
  };
  const led = repartePorModulo('lamaLed');
  const lama = repartePorModulo('lamas');
  const mediaLama = repartePorModulo('mediasLamas');

  mostrarRevisar({
    marcajes: marcajes.length ? marcajes : [''],
    hoja: hojas[0] || '',
    aviso: avisos.join(' ') || null,
    escaneado: lecturas.length === 1 && lecturas[0].r.esEscaneado,
    colorEstruc: lecturas.map(({ r }) => r.colorEstruc).find(Boolean),
    medida: lecturas.map(({ r }) => r.medida).find(Boolean),
    auto: marcajes.length > 0,
    modulos: modulos.length ? modulos.join(', ') : '',
    infoModulo,
    led,
    lama,
    mediaLama,
  });
}

// Compatibilidad: una sola hoja.
function procesarArchivoPDF(file) {
  return procesarArchivosPDF(file ? [file] : []);
}

function onPDFElegido(e) {
  const files = [...e.target.files];
  e.target.value = '';
  procesarArchivosPDF(files);
}

function crearGenerica() {
  mostrarRevisar({
    marcajes: [''],
    hoja: '',
    aviso: 'Etiqueta genérica: deja el nº de pedido en blanco para que no aparezca.',
    escaneado: false,
    colorEstruc: null,
    medida: null,
  });
}

// --- Arrastrar y soltar el PDF -------------------------------------------
(function inicializaDragAndDrop() {
  const zona = document.getElementById('zona-pdf');
  ['dragenter', 'dragover'].forEach((ev) => {
    zona.addEventListener(ev, (e) => {
      e.preventDefault();
      zona.classList.add('drag-activo');
    });
  });
  ['dragleave', 'dragend', 'drop'].forEach((ev) => {
    zona.addEventListener(ev, (e) => {
      e.preventDefault();
      zona.classList.remove('drag-activo');
    });
  });
  zona.addEventListener('drop', (e) => {
    procesarArchivosPDF(e.dataTransfer.files);
  });
})();

// --- Lista de marcajes ---------------------------------------------------
const plantilla = document.getElementById('plantilla-fila');

function actualizaContador() {
  const n = document.querySelectorAll('#lista .chk-marcaje:checked').length;
  document.getElementById('contador-marcajes').textContent = n;
  document.getElementById('contador-lamas').textContent = document.querySelectorAll('#lista-lamas .chk-marcaje:checked').length;
}

function alternarFila(chk) {
  const texto = chk.closest('.fila').querySelector('input.mc');
  texto.disabled = !chk.checked;
  actualizaContador();
}

function marcarTodos(marcar, idLista = 'lista') {
  document.querySelectorAll('#' + idLista + ' .chk-marcaje').forEach((chk) => {
    chk.checked = marcar;
    alternarFila(chk);
  });
}

// Las etiquetas de lamas (LAMA MOTOR, LAMA, 1/2 LAMA, LAMA LED) tienen su propia lista y su
// propia impresión (van aparte de las pegatinas de la hoja de corte).
function esLama(clave) {
  return /^(1\/2 )?LAMA( MOTOR| LED)?( M[\d,\- ]+)?$|^T\d+$|^P\. LED PERIMETRAL( M[\d,\- ]+)?$/.test(String(clave || '').toUpperCase());
}

function anadirFila(valor, auto, mod, clave) {
  const nodo = plantilla.content.cloneNode(true);
  nodo.querySelector('input.mc').value = valor || '';
  const lista = document.getElementById(esLama(clave) ? 'lista-lamas' : 'lista');
  lista.appendChild(nodo);
  const fila = lista.lastElementChild;
  fila.dataset.mod = mod || '';
  if (auto) {
    fila.dataset.auto = '1';
    if (clave) fila.dataset.clave = clave;
    fila.classList.add('auto');
  }
}

// --- Etiquetas automáticas (no salen en la hoja de corte) ----------------
// Por cada viga "V1-2" -> "TAPA SUP. 1-2"; y una "T1..Tn" de transmisión
// por módulo. Se marcan con data-auto para poder recalcularlas al cambiar
// los controles sin tocar las que ha escrito o editado el usuario.
const RE_VIGA = /^V(\d+-\d+)$/i;
// Las "TAPA SUP." salen solas al leer un PDF; en una etiqueta genérica no.
let autoTapa = false;
// ¿Las hojas leídas traían el módulo en la cabecera? Si sí, las etiquetas
// de transmisión llevan su módulo (T2 -> "MÓD. 2").
let hayInfoModulo = false;
// Cantidad de LAMA LED de cada módulo leída del PDF: {1: 4, 2: 2, 3: 2}.
let ledPorModulo = {};
// Cantidad de LAMA (normales) de cada módulo: {1: 26, 2: 10, 3: 10}.
let lamaPorModulo = {};
// Cantidad de MEDIA LAMA de cada módulo ("1+1" cuenta 2).
let mediaLamaPorModulo = {};

// --- Idioma de las etiquetas ------------------------------------------------
// Los nombres de las etiquetas que genera la app (tapas, lamas, componentes, caja de
// componentes, BULTO, COLOR) se traducen. Los marcajes de la hoja (V1-2, C4-5, P3...)
// y el módulo (M1) son iguales en todos los idiomas. Las claves son el texto en español.
const IDIOMAS = { es: 'Español', en: 'English', fr: 'Français', it: 'Italiano', pt: 'Português', de: 'Deutsch' };
const TRAD = {
  en: {
    'TAPA SUP.': 'TOP COVER', 'LAMA MOTOR': 'MOTOR LOUVER', 'LAMA': 'LOUVER', '1/2 LAMA': '1/2 LOUVER', 'LAMA LED': 'LED LOUVER',
    'CENTRALITA': 'CONTROL UNIT', 'TRANSFORMADOR CTRAL': 'CTRL TRANSFORMER',
    'CTRAL LED PERIMETRAL': 'CTRL PERIMETER LED', 'CTRAL LED LAMA': 'CTRL LOUVER LED', 'CTRAL FOCO': 'CTRL SPOTLIGHT',
    'TRANSFORMADOR LED PERIMETRAL': 'PERIMETER LED TRANSFORMER', 'TRANSFORMADOR LED LAMA': 'LOUVER LED TRANSFORMER',
    'TRANSFORMADOR FOCO': 'SPOTLIGHT TRANSFORMER', 'COMPONENTES': 'COMPONENTS', 'BULTO:': 'PACKAGE:', 'P. LED PERIMETRAL': 'PERIMETER LED PROFILE', 'COLOR': 'COLOR',
  },
  fr: {
    'TAPA SUP.': 'COUVERCLE SUP.', 'LAMA MOTOR': 'LAME MOTEUR', 'LAMA': 'LAME', '1/2 LAMA': '1/2 LAME', 'LAMA LED': 'LAME LED',
    'CENTRALITA': 'CENTRALE', 'TRANSFORMADOR CTRAL': 'TRANSFO CENTRALE',
    'CTRAL LED PERIMETRAL': 'CENTRALE LED PÉRIMÉTRIQUE', 'CTRAL LED LAMA': 'CENTRALE LED LAME', 'CTRAL FOCO': 'CENTRALE SPOT',
    'TRANSFORMADOR LED PERIMETRAL': 'TRANSFO LED PÉRIMÉTRIQUE', 'TRANSFORMADOR LED LAMA': 'TRANSFO LED LAME',
    'TRANSFORMADOR FOCO': 'TRANSFO SPOT', 'COMPONENTES': 'COMPOSANTS', 'BULTO:': 'COLIS :', 'P. LED PERIMETRAL': 'PROFILÉ LED PÉRIMÉTRIQUE', 'COLOR': 'COULEUR',
  },
  it: {
    'TAPA SUP.': 'COPERCHIO SUP.', 'LAMA MOTOR': 'LAMELLA MOTORE', 'LAMA': 'LAMELLA', '1/2 LAMA': '1/2 LAMELLA', 'LAMA LED': 'LAMELLA LED',
    'CENTRALITA': 'CENTRALINA', 'TRANSFORMADOR CTRAL': 'TRASFORMATORE CENTRALINA',
    'CTRAL LED PERIMETRAL': 'CENTRALINA LED PERIMETRALE', 'CTRAL LED LAMA': 'CENTRALINA LED LAMELLA', 'CTRAL FOCO': 'CENTRALINA FARETTO',
    'TRANSFORMADOR LED PERIMETRAL': 'TRASFORMATORE LED PERIMETRALE', 'TRANSFORMADOR LED LAMA': 'TRASFORMATORE LED LAMELLA',
    'TRANSFORMADOR FOCO': 'TRASFORMATORE FARETTO', 'COMPONENTES': 'COMPONENTI', 'BULTO:': 'COLLO:', 'P. LED PERIMETRAL': 'PROFILO LED PERIMETRALE', 'COLOR': 'COLORE',
  },
  pt: {
    'TAPA SUP.': 'TAMPA SUP.', 'LAMA MOTOR': 'LÂMINA MOTOR', 'LAMA': 'LÂMINA', '1/2 LAMA': '1/2 LÂMINA', 'LAMA LED': 'LÂMINA LED',
    'CENTRALITA': 'CENTRAL', 'TRANSFORMADOR CTRAL': 'TRANSFORMADOR CENTRAL',
    'CTRAL LED PERIMETRAL': 'CENTRAL LED PERIMETRAL', 'CTRAL LED LAMA': 'CENTRAL LED LÂMINA', 'CTRAL FOCO': 'CENTRAL FOCO',
    'TRANSFORMADOR LED PERIMETRAL': 'TRANSFORMADOR LED PERIMETRAL', 'TRANSFORMADOR LED LAMA': 'TRANSFORMADOR LED LÂMINA',
    'TRANSFORMADOR FOCO': 'TRANSFORMADOR FOCO', 'COMPONENTES': 'COMPONENTES', 'BULTO:': 'VOLUME:', 'P. LED PERIMETRAL': 'PERFIL LED PERIMETRAL', 'COLOR': 'COR',
  },
  de: {
    'TAPA SUP.': 'ABDECKUNG OBEN', 'LAMA MOTOR': 'MOTORLAMELLE', 'LAMA': 'LAMELLE', '1/2 LAMA': '1/2 LAMELLE', 'LAMA LED': 'LED-LAMELLE',
    'CENTRALITA': 'STEUERUNG', 'TRANSFORMADOR CTRAL': 'TRAFO STEUERUNG',
    'CTRAL LED PERIMETRAL': 'STEUERUNG LED UMRANDUNG', 'CTRAL LED LAMA': 'STEUERUNG LED-LAMELLE', 'CTRAL FOCO': 'STEUERUNG SPOT',
    'TRANSFORMADOR LED PERIMETRAL': 'TRAFO LED UMRANDUNG', 'TRANSFORMADOR LED LAMA': 'TRAFO LED-LAMELLE',
    'TRANSFORMADOR FOCO': 'TRAFO SPOT', 'COMPONENTES': 'KOMPONENTEN', 'BULTO:': 'PAKET:', 'P. LED PERIMETRAL': 'PROFIL LED UMRANDUNG', 'COLOR': 'FARBE',
  },
};
let idioma = 'es';
function trad(clave) {
  return (TRAD[idioma] && TRAD[idioma][clave]) || clave;
}

// Cambia el idioma: se rehacen las etiquetas automáticas y la caja de componentes del envío.
function cambiaIdioma(cod) {
  idioma = IDIOMAS[cod] ? cod : 'es';
  const sel = document.getElementById('idioma');
  if (sel) sel.value = idioma;
  regeneraAuto();
}

// Orden de las etiquetas por tipo: todas las vigas juntas, luego sus tapas, las
// canaletas, los pilares, la transmisión y las lamas. Lo que no encaja
// (marcajes escritos a mano) va al final. Dentro de cada tipo se respeta el orden.
function rangoTipo(texto) {
  const t = String(texto || '').trim().toUpperCase();
  if (/^V\d/.test(t)) return 0;
  if (/^TAPA SUP/.test(t)) return 1;
  if (/^C\d/.test(t)) return 2;
  if (/^P\d/.test(t)) return 3;
  if (/^T\d+$/.test(t)) return 4;
  if (/^LAMA MOTOR/.test(t)) return 5;
  if (/^LAMA LED/.test(t)) return 8;
  if (/^P\. LED PERIMETRAL/.test(t)) return 8.5;
  const iExtra = EXTRAS.findIndex((e) => e.nombre === t.replace(/ M[\d,\- ]+$/, ''));
  if (iExtra >= 0) return 9 + iExtra; // componentes, en el orden de la lista
  if (/^LAMA( M\d+)?$/.test(t)) return 6;
  if (/^1\/2 LAMA/.test(t)) return 7;
  return 9 + EXTRAS.length;
}

function ordenaPorTipo() {
  for (const id of ['lista', 'lista-lamas']) {
    const lista = document.getElementById(id);
    // Las lamas van por módulo (todo el M1, luego el M2...) y dentro de cada uno por tipo;
    // el resto de etiquetas, por tipo.
    const porModulo = id === 'lista-lamas';
    const numMod = (f) => (porModulo ? (parseInt(f.dataset.mod, 10) || 999) : 0);
    const filas = [...lista.children].map((f, i) => ({ f, i, m: numMod(f), r: rangoTipo(f.dataset.clave || f.querySelector('input.mc').value) }));
    filas.sort((a, b) => a.m - b.m || a.r - b.r || a.i - b.i);
    for (const { f } of filas) lista.appendChild(f);
  }
}

// --- Componentes: centralita (todas las pérgolas la llevan) y opcionales ----
// Etiquetas sueltas, sin módulo. Cada una se marca si la pérgola la lleva y se
// elige cuántas etiquetas hacen falta.
const EXTRAS = [
  { nombre: 'CENTRALITA', activo: true },
  { nombre: 'TRANSFORMADOR CTRAL', activo: false },
  { nombre: 'CTRAL LED PERIMETRAL', activo: false },
  { nombre: 'CTRAL LED LAMA', activo: false },
  { nombre: 'CTRAL FOCO', activo: false },
  { nombre: 'TRANSFORMADOR LED PERIMETRAL', activo: false },
  { nombre: 'TRANSFORMADOR LED LAMA', activo: false },
  { nombre: 'TRANSFORMADOR FOCO', activo: false },
];

// Opcionales de la pestaña Lamas (solo si la pérgola los lleva).
const EXTRAS_LAMAS = [
  { nombre: 'P. LED PERIMETRAL', activo: false },
];

function filaExtra(ex) {
  const fila = document.createElement('div');
  fila.className = 'fila extra-fila';
  fila.dataset.nombre = ex.nombre;
  fila.innerHTML = '<label class="opt"><input type="checkbox" class="extra-chk"> <span></span></label>'
    + '<input type="text" class="extra-mods" placeholder="Módulos" inputmode="numeric" aria-label="Módulos" style="width:110px">'
    + '<div class="cant"><button type="button" class="cant-btn" aria-label="Menos">−</button>'
    + '<input type="number" class="caja-cant extra-cant" min="1" max="99" value="1" inputmode="numeric" aria-label="Nº de etiquetas por módulo">'
    + '<button type="button" class="cant-btn" aria-label="Más">＋</button></div>';
  fila.querySelector('span').textContent = ex.nombre;
  const chk = fila.querySelector('.extra-chk');
  chk.checked = ex.activo;
  const inp = fila.querySelector('.extra-cant');
  const mods = fila.querySelector('.extra-mods');
  const [menos, mas] = fila.querySelectorAll('.cant-btn');
  menos.onclick = () => { inp.value = Math.max(1, (parseInt(inp.value, 10) || 1) - 1); chk.checked = true; regeneraAuto(); };
  mas.onclick = () => { inp.value = Math.min(99, (parseInt(inp.value, 10) || 1) + 1); chk.checked = true; regeneraAuto(); };
  chk.onchange = regeneraAuto;
  inp.oninput = regeneraAuto;
  mods.oninput = () => { mods.dataset.tocado = '1'; regeneraAuto(); };
  return fila;
}

function iniciaExtras() {
  // Componentes (pestaña Pegatinas) y opcionales de la pestaña Lamas.
  for (const [id, lista] of [['extras-lista', EXTRAS], ['extras-lamas', EXTRAS_LAMAS]]) {
    const cont = document.getElementById(id);
    cont.innerHTML = '';
    for (const ex of lista) cont.appendChild(filaExtra(ex));
  }
}

// Si la pérgola tiene varios módulos, cada componente sale por módulo (CENTRALITA M1,
// CENTRALITA M2...); con uno solo, sin módulo. Mientras el usuario no toque el campo
// "Módulos" de un componente, este sigue a los módulos de la pérgola.
function hayInfo(mod) {
  return hayInfoModulo ? mod : '';
}

function sincronizaModulosExtras(mods) {
  const porDefecto = mods.length > 1 ? mods.join(', ') : '';
  for (const f of document.querySelectorAll('#extras-lista .extra-fila, #extras-lamas .extra-fila')) {
    const inp = f.querySelector('.extra-mods');
    if (inp.dataset.tocado !== '1') inp.value = porDefecto;
  }
}

// Etiquetas de componentes marcadas: [{nombre: 'CENTRALITA', mod: '2'}, ...]
// (mod vacío = una para toda la pérgola). La cantidad es por módulo.
function extrasMarcados() {
  const salida = [];
  for (const f of document.querySelectorAll('#extras-lista .extra-fila, #extras-lamas .extra-fila')) {
    if (!f.querySelector('.extra-chk').checked) continue;
    const n = Math.max(1, Math.min(99, parseInt(f.querySelector('.extra-cant').value, 10) || 1));
    const mods = parseModulos(f.querySelector('.extra-mods').value);
    for (const m of (mods.length ? mods.map(String) : [''])) {
      for (let i = 0; i < n; i++) salida.push({ nombre: f.dataset.nombre, mod: m });
    }
  }
  return salida;
}

// "1" -> "M1"; "2-3" -> "M2-3"; un texto como "COMPONENTES" se deja tal cual.
function etiquetaModulo(mod) {
  const m = String(mod || '').trim();
  if (!m) return '';
  return /^[\d,\-\s]+$/.test(m) ? 'M' + m : m.toUpperCase();
}

function regeneraAuto() {
  document.querySelectorAll('#lista .fila[data-auto], #lista-lamas .fila[data-auto]').forEach((f) => f.remove());
  const base = [...document.querySelectorAll('#lista .fila')].map((f) => ({ v: f.querySelector('input.mc').value.trim(), mod: f.dataset.mod || '' }));

  if (autoTapa) {
    for (const { v, mod } of base) {
      const m = v.match(RE_VIGA);
      if (m) anadirFila(trad('TAPA SUP.') + ' ' + m[1], true, mod, 'TAPA SUP. ' + m[1]);
    }
  }
  const mods = parseModulos(document.getElementById('auto-modulos').value);
  const tagMod = (n) => (hayInfoModulo ? String(n) : '');
  for (const n of mods) anadirFila('T' + n, true, tagMod(n), 'T' + n);

  if (autoTapa) {
    // Si la pérgola tiene más de 1 módulo, la etiqueta lleva su módulo: "LAMA MOTOR M1".
    // La "M" del módulo ya sale grande en la etiqueta; solo se añade al nombre si las hojas no traen módulo.
    const sufijo = (n) => (mods.length > 1 && !hayInfoModulo ? ' M' + n : '');
    // Una LAMA MOTOR por módulo.
    for (const n of mods) anadirFila(trad('LAMA MOTOR') + sufijo(n), true, tagMod(n), 'LAMA MOTOR');
    // LAMA: una etiqueta por cada dos lamas del módulo.
    for (const n of mods) {
      for (let i = 0; i < Math.ceil((lamaPorModulo[n] || 0) / 2); i++) anadirFila(trad('LAMA') + sufijo(n), true, tagMod(n), 'LAMA');
    }
    // 1/2 LAMA (media lama): una etiqueta por cada dos medias lamas del módulo.
    for (const n of mods) {
      for (let i = 0; i < Math.ceil((mediaLamaPorModulo[n] || 0) / 2); i++) anadirFila(trad('1/2 LAMA') + sufijo(n), true, tagMod(n), '1/2 LAMA');
    }
    // LAMA LED (solo si la hoja las lleva): una etiqueta por cada dos lamas del módulo.
    for (const n of mods) {
      for (let i = 0; i < Math.ceil((ledPorModulo[n] || 0) / 2); i++) anadirFila(trad('LAMA LED') + sufijo(n), true, tagMod(n), 'LAMA LED');
    }
  }
  if (autoTapa) {
    sincronizaModulosExtras(mods);
    for (const { nombre, mod } of extrasMarcados()) anadirFila(trad(nombre) + (mod && !hayInfoModulo ? ' M' + mod : ''), true, hayInfo(mod), nombre);
  }
  ordenaPorTipo();
  actualizaContador();
}

// "1" -> [1]; "2-3" -> [2, 3]; "1, 3" -> [1, 3]. Máx. 20 módulos.
function parseModulos(texto) {
  const salida = [];
  for (const tok of String(texto || '').split(/[,;\s]+/)) {
    const m = tok.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    let a = +m[1], b = m[2] ? +m[2] : a;
    if (b < a) [a, b] = [b, a];
    for (let i = a; i <= b && salida.length < 20; i++) if (!salida.includes(i)) salida.push(i);
  }
  return salida;
}

// Reduce la letra del marcaje lo justo para que un texto largo (p. ej.
// "TAPA SUP. 1-2") quepa en el ancho de la etiqueta -o en su alto si el
// texto va girado-. Los códigos cortos (V1-2, P1...) no cambian.
function ajustaFuente(texto, pt, cfg, vertical, minimo = 8, anchoCar = 0.72) {
  const dispMm = (vertical ? cfg.celda_alto_mm : cfg.celda_ancho_mm) - 5;
  const maxPt = Math.floor(dispMm / (String(texto).length * anchoCar * 0.3528));
  return Math.max(minimo, Math.min(pt, maxPt));
}

// Marcaje en una o dos líneas: un texto con espacios que en una sola línea quedaría
// muy pequeño (p. ej. "TRANSFORMADOR LED PERIMETRAL") se parte en dos líneas, lo más
// equilibradas posible, y así se lee más grande.
function preparaMarcaje(texto, pt, cfg, vertical) {
  const simple = ajustaFuente(texto, pt, cfg, vertical);
  const pal = String(texto).split(' ');
  if (pal.length > 1 && simple < 14) {
    let mejor = null;
    for (let i = 1; i < pal.length; i++) {
      const a = pal.slice(0, i).join(' ');
      const b = pal.slice(i).join(' ');
      const m = Math.max(a.length, b.length);
      if (!mejor || m < mejor.m) mejor = { a, b, m };
    }
    const larga = mejor.a.length >= mejor.b.length ? mejor.a : mejor.b;
    const dos = Math.min(ajustaFuente(larga, pt, cfg, vertical), Math.floor(pt / 2));
    if (dos > simple) return { texto: mejor.a + '\n' + mejor.b, pt: dos };
  }
  return { texto, pt: simple };
}

function anadir() {
  anadirFila('');
  const lista = document.getElementById('lista');
  lista.lastElementChild.querySelector('input.mc').focus();
  actualizaContador();
}

function anadirLama() {
  anadirFila('', false, '', 'LAMA');
  const lista = document.getElementById('lista-lamas');
  lista.lastElementChild.querySelector('input.mc').focus();
  actualizaContador();
}

function borrar(btn) {
  const lista = btn.closest('.fila').parentElement;
  if (lista.children.length > 1) {
    btn.closest('.fila').remove();
  } else {
    const fila = btn.closest('.fila');
    fila.querySelector('input.mc').value = '';
    fila.querySelector('.chk-marcaje').checked = true;
    fila.querySelector('input.mc').disabled = false;
  }
  actualizaContador();
}

// Normaliza igual que app.py::_lista_marcajes: separa por líneas o , ;
// dentro de un mismo campo, sin forzar mayúsculas ni tocar espacios.
// Cada elemento lleva su módulo: {t: "V7-8", mod: "2-3"}.
function listaMarcajes(filas) {
  const salida = [];
  for (const { valor, mod } of filas) {
    for (const trozo of (valor || '').split(/[\n\r,;]+/)) {
      const cod = trozo.trim().replace(/\s+/g, ' ');
      if (cod) salida.push({ t: cod, mod: mod || '' });
    }
  }
  return salida;
}

// --- Vista previa / impresión --------------------------------------------
const MM_A_PX = 96 / 25.4;

// --- Etiquetas de envío (identifican cada caja) --------------------------
// Van en su propia impresión, en el formato elegido: nº de pedido en grande,
// medida, color y módulo(s) de la caja.
let modoEnvio = false;
// Las etiquetas de envío tienen sus PROPIOS ajustes (formato, orientación,
// color, tamaño), distintos de los de las pegatinas de la hoja de corte:
// se imprimen en dos veces y suelen llevar formato distinto. Se cambian en
// la vista previa. Cada hoja nueva empieza con estos valores.
const AJUSTES_ENVIO_DEFECTO = { formato: '2', disposicion: 'horizontal', color: '#000000', fuente: '' };
let ajustesEnvio = { ...AJUSTES_ENVIO_DEFECTO };

// Lo mismo para las lamas: se imprimen aparte, normalmente en formato 4 por hoja.
let modoLamas = false;
const AJUSTES_LAMAS_DEFECTO = { formato: '4', disposicion: 'vertical', color: '#000000', fuente: '90' };
let ajustesLamas = { ...AJUSTES_LAMAS_DEFECTO };

// --- Caja de componentes (sección aparte, la primera) -------------------------
// Todas las pérgolas llevan al menos una caja de componentes (puede haber más). Sus
// etiquetas se preparan lo primero y en su propio formato (4 por hoja por defecto).
let modoComp = false;
const AJUSTES_COMP_DEFECTO = { formato: '4', disposicion: 'vertical', color: '#000000', fuente: '90' };
let ajustesComp = { ...AJUSTES_COMP_DEFECTO };

function cambiaCantComp(delta) {
  const inp = document.getElementById('comp-cant');
  inp.value = Math.max(1, Math.min(99, (parseInt(inp.value, 10) || 1) + delta));
}

// Una etiqueta por caja de componentes.
function cajasComponentes() {
  const n = Math.max(1, Math.min(99, parseInt(document.getElementById('comp-cant').value, 10) || 1));
  return Array(n).fill(trad('COMPONENTES'));
}

// Ajustes propios de lo que se está viendo (envío o lamas), o null para las pegatinas.
function ajustesActivos() {
  return modoEnvio ? ajustesEnvio : (modoLamas ? ajustesLamas : (modoComp ? ajustesComp : null));
}

// Cada fila de la lista es un grupo de cajas: módulo(s) que llevan ("1",
// "2-3") y cuántas cajas son (con la cantidad se repite la etiqueta).
function anadirCaja(mod, cant, fija) {
  const fila = document.createElement('div');
  fila.className = 'fila caja-fila';
  fila.innerHTML = '<input type="text" class="caja-mod" placeholder="Módulo(s): 1 · 2-3">'
    + '<div class="cant"><button type="button" class="cant-btn" aria-label="Menos cajas">−</button>'
    + '<input type="number" class="caja-cant" min="1" max="99" value="1" inputmode="numeric" aria-label="Nº de cajas">'
    + '<button type="button" class="cant-btn" aria-label="Más cajas">＋</button></div>'
    + '<button type="button" class="del" aria-label="Quitar">✕</button>';
  fila.querySelector('.caja-mod').value = mod || '';
  const inp = fila.querySelector('.caja-cant');
  inp.value = cant || 1;
  const [menos, mas] = fila.querySelectorAll('.cant-btn');
  menos.onclick = () => { inp.value = Math.max(1, (parseInt(inp.value, 10) || 1) - 1); };
  mas.onclick = () => { inp.value = Math.min(99, (parseInt(inp.value, 10) || 1) + 1); };
  fila.querySelector('.del').onclick = () => fila.remove();
  if (fija) {
    // Caja de componentes: todas las pérgolas llevan al menos una; no se quita.
    fila.classList.add('caja-comp');
    fila.querySelector('.del').hidden = true;
    fila.querySelector('.caja-mod').readOnly = true;
  }
  document.getElementById('cajas-lista').appendChild(fila);
}

// Por defecto: una caja por módulo (o una sola, sin módulo, si la hoja no lo trae).
function rellenaCajas(modulos) {
  document.getElementById('cajas-lista').innerHTML = '';
  for (const m of (modulos && modulos.length ? modulos : [''])) anadirCaja(String(m), 1);
}

// Lista de etiquetas de envío: el módulo de cada caja, repetido tantas veces como cajas.
function cajasEnvio() {
  const salida = [];
  for (const f of document.querySelectorAll('#cajas-lista .caja-fila')) {
    const mod = f.querySelector('.caja-mod').value.trim();
    const n = Math.max(1, Math.min(99, parseInt(f.querySelector('.caja-cant').value, 10) || 1));
    for (let i = 0; i < n; i++) salida.push(mod);
  }
  return salida.length ? salida : [''];
}

function vistaPreviaEnvio() {
  if (!document.getElementById('hoja').value.trim()) {
    alert('Escribe el nº de hoja de corte: es lo que lleva en grande la etiqueta de envío.');
    return;
  }
  modoEnvio = true;
  sincronizaControlesPreview(datosFormulario());
  renderPreview();
  document.getElementById('modal-preview').hidden = false;
  document.body.style.overflow = 'hidden';
}

function vistaPreviaComponentes() {
  if (!document.getElementById('hoja').value.trim()) {
    alert('Escribe el nº de hoja de corte: es lo que lleva en grande la etiqueta.');
    return;
  }
  modoComp = true;
  sincronizaControlesPreview(datosFormulario());
  renderPreview();
  document.getElementById('modal-preview').hidden = false;
  document.body.style.overflow = 'hidden';
}

function vistaPreviaLamas() {
  modoLamas = true;
  const d = datosFormulario();
  if (!d.marcajes.length) { modoLamas = false; alert('No hay etiquetas de lamas que imprimir.'); return; }
  sincronizaControlesPreview(d);
  renderPreview();
  document.getElementById('modal-preview').hidden = false;
  document.body.style.overflow = 'hidden';
}

function datosFormulario() {
  if (modoLamas) {
    return {
      hoja: document.getElementById('hoja').value.trim(),
      marcajes: listaMarcajes(
        [...document.querySelectorAll('#lista-lamas .fila')]
          .filter((fila) => fila.querySelector('.chk-marcaje').checked)
          .map((fila) => ({ valor: fila.querySelector('input.mc').value, mod: fila.dataset.mod }))
      ),
      vertical: ajustesLamas.disposicion === 'vertical',
      colorM: ajustesLamas.color,
      colorH: document.getElementById('color_hoja').value,
      fpt: parseInt(ajustesLamas.fuente, 10) || null,
      formato: ajustesLamas.formato,
      colorEstruc: document.getElementById('color_estruc').value.trim(),
      medida: document.getElementById('medida').value.trim(),
    };
  }
  if (modoEnvio || modoComp) {
    const aj = ajustesActivos();
    const hoja = document.getElementById('hoja').value.trim();
    const color = document.getElementById('color_estruc').value.trim();
    return {
      hoja: '',
      marcajes: (modoComp ? cajasComponentes() : cajasEnvio()).map((mod) => ({ t: hoja, mod })),
      vertical: aj.disposicion === 'vertical',
      colorM: aj.color,
      colorH: document.getElementById('color_hoja').value,
      fpt: parseInt(aj.fuente, 10) || null,
      formato: aj.formato,
      colorEstruc: color ? trad('COLOR') + ' ' + color : '',
      medida: document.getElementById('medida').value.trim(),
      bulto: trad('BULTO:'),
    };
  }
  return {
    hoja: document.getElementById('hoja').value.trim(),
    marcajes: listaMarcajes(
      [...document.querySelectorAll('#lista .fila')]
        .filter((fila) => fila.querySelector('.chk-marcaje').checked)
        .map((fila) => ({ valor: fila.querySelector('input.mc').value, mod: fila.dataset.mod }))
    ),
    vertical: document.querySelector('input[name=disposicion]:checked').value === 'vertical',
    colorM: document.querySelector('input[name=color_marcaje]:checked').value,
    colorH: document.getElementById('color_hoja').value,
    fpt: parseInt(document.getElementById('fuente_pt').value, 10) || null,
    formato: document.querySelector('input[name=formato]:checked').value,
    colorEstruc: document.getElementById('color_estruc').value.trim(),
    medida: document.getElementById('medida').value.trim(),
  };
}

function celda(cfg, mc, d) {
  const c = document.createElement('div');
  c.className = 'prev-cell' + (d.vertical ? ' vert' : '');
  if (!mc) return c;

  if (d.hoja) {
    const h = document.createElement('div');
    h.className = 'prev-num';
    h.textContent = d.hoja;
    h.style.color = d.colorH;
    h.style.fontSize = cfg.fuente_hoja_pt + 'pt';
    c.appendChild(h);
  }
  // Línea de información: "M3" grande, en negrita y del color del marcaje, y detrás
  // la medida de la pérgola pequeña y en gris.
  const modulo = etiquetaModulo(mc.mod);
  // Etiquetas de envío (d.bulto): la "M" del mismo tamaño que el nº de pedido (100 pt en
  // 2 por hoja), siempre que quepa en alto.
  let grandeEnvio = null;
  if (d.bulto && modulo) {
    const marcaPt = ajustaFuente(mc.t, d.fpt || cfg.fuente_marcaje_pt, cfg, d.vertical);
    const otras = marcaPt * 1.15 + 12 + (d.colorEstruc ? cfg.fuente_hoja_pt * 1.15 + 2 : 0) + cfg.fuente_hoja_pt * 1.15 + 6;
    grandeEnvio = Math.floor(Math.min(marcaPt, ((d.vertical ? cfg.celda_ancho_mm : cfg.celda_alto_mm) / 0.3528 - otras) / 1.15));
  }

  const resto = modulo && d.medida ? ' · ' + d.medida : (d.medida || '');
  if (modulo || resto) {
    const grande = grandeEnvio || cfg.fuente_modulo_pt || Math.round(cfg.fuente_hoja_pt * 1.25);
    const pequena = Math.max(7, Math.round(cfg.fuente_hoja_pt * 0.6));
    const dispMm = (d.vertical ? cfg.celda_alto_mm : cfg.celda_ancho_mm) - 5;
    const anchoEst = (modulo.length * 0.72 * grande + resto.length * 0.52 * pequena) * 0.3528;
    const k = anchoEst ? Math.min(1, dispMm / anchoEst) : 1;
    const med = document.createElement('div');
    med.className = 'prev-medida';
    if (modulo) {
      const sm = document.createElement('span');
      sm.textContent = modulo;
      sm.style.cssText = `font-weight:700;color:${d.colorM};font-size:${Math.max(8, Math.floor(grande * k))}pt`;
      med.appendChild(sm);
    }
    if (resto) {
      const sr = document.createElement('span');
      sr.textContent = resto;
      sr.style.cssText = `color:${d.colorH};font-size:${Math.max(6, Math.floor(pequena * k))}pt`;
      med.appendChild(sr);
    }
    c.appendChild(med);
  }
  const m = document.createElement('div');
  m.className = 'prev-marca';
  const pm = preparaMarcaje(mc.t, d.fpt || cfg.fuente_marcaje_pt, cfg, d.vertical);
  m.textContent = pm.texto;
  m.style.whiteSpace = 'pre-line';
  m.style.color = d.colorM;
  m.style.fontSize = pm.pt + 'pt';
  c.appendChild(m);

  if (d.colorEstruc) {
    const ce = document.createElement('div');
    ce.className = 'prev-color-estruc';
    ce.textContent = d.colorEstruc;
    ce.style.color = d.colorH;
    ce.style.fontSize = cfg.fuente_hoja_pt + 'pt';
    c.appendChild(ce);
  }
  if (d.bulto) {
    // Para escribir a mano el nº de caja (etiquetas de envío).
    const b = document.createElement('div');
    b.className = 'prev-bulto';
    b.textContent = d.bulto;
    b.style.color = d.colorH;
    b.style.fontSize = cfg.fuente_hoja_pt + 'pt';
    c.appendChild(b);
  }
  return c;
}

function hojaPrev(cfg, chunk, d) {
  const hoja = document.createElement('div');
  hoja.className = 'prev-hoja';
  hoja.style.padding = `${cfg.margen_top_mm}mm ${cfg.margen_h_mm}mm ${cfg.margen_bot_mm}mm`;
  const grid = document.createElement('div');
  grid.className = 'prev-grid';
  grid.style.gridTemplateColumns = `repeat(${cfg.cols}, ${cfg.celda_ancho_mm}mm)`;
  grid.style.gridTemplateRows = `repeat(${cfg.filas}, ${cfg.celda_alto_mm}mm)`;
  grid.style.columnGap = (cfg.col_gap_mm || 0) + 'mm';
  for (let i = 0; i < cfg.cols * cfg.filas; i++) grid.appendChild(celda(cfg, chunk[i], d));
  hoja.appendChild(grid);
  return hoja;
}

function marcarSwatch(color) {
  document.querySelectorAll('.swatch').forEach((s) => {
    s.classList.toggle('activo', s.dataset.color.toUpperCase() === (color || '').toUpperCase());
  });
}

function renderPreview() {
  const cont = document.getElementById('prev-hojas');
  cont.innerHTML = '';
  try {
    const d = datosFormulario();
    if (!d.marcajes.length) {
      cont.innerHTML = '<div class="aviso">Añade al menos un marcaje para ver la vista previa.</div>';
      return;
    }
    const clavesValidas = Object.keys(FORMATOS);
    const claves = d.formato === 'todos'
      ? clavesValidas
      : (clavesValidas.includes(d.formato) ? [d.formato] : [clavesValidas[0]]);

    const anchoDisp = Math.max(200, Math.min(window.innerWidth, 640) - 24);
    const k = Math.max(0.22, Math.min(0.6, anchoDisp / (210 * MM_A_PX)));

    for (const clave of claves) {
      const cfg = FORMATOS[clave];
      if (!cfg) continue;
      const t = document.createElement('div');
      t.className = 'prev-titulo';
      t.textContent = cfg.etiqueta;
      cont.appendChild(t);

      const porPag = cfg.cols * cfg.filas;
      const nPag = Math.max(1, Math.ceil(d.marcajes.length / porPag));
      for (let p = 0; p < nPag; p++) {
        const wrap = document.createElement('div');
        wrap.className = 'prev-wrap';

        const escala = document.createElement('div');
        escala.className = 'prev-scale';
        escala.style.width = Math.round(210 * MM_A_PX * k) + 'px';
        escala.style.height = Math.round(297 * MM_A_PX * k) + 'px';

        const chunk = d.marcajes.slice(p * porPag, (p + 1) * porPag);
        const h = hojaPrev(cfg, chunk, d);
        h.style.transform = `scale(${k})`;
        escala.appendChild(h);
        wrap.appendChild(escala);

        if (nPag > 1) {
          const pie = document.createElement('div');
          pie.className = 'prev-pag';
          pie.textContent = `hoja ${p + 1} de ${nPag}`;
          wrap.appendChild(pie);
        }
        cont.appendChild(wrap);
      }
    }
  } catch (err) {
    cont.innerHTML = '';
    const aviso = document.createElement('div');
    aviso.className = 'aviso err';
    aviso.textContent = 'No se ha podido dibujar la vista previa (' + err.message + ').';
    cont.appendChild(aviso);
  }
}

(function inicializaSelectFormato() {
  const sel = document.getElementById('prev-formato');
  for (const [clave, cfg] of Object.entries(FORMATOS)) {
    const op = document.createElement('option');
    op.value = clave;
    op.textContent = cfg.etiqueta;
    sel.appendChild(op);
  }
  const op = document.createElement('option');
  op.value = 'todos';
  op.textContent = 'Todos los formatos';
  sel.appendChild(op);
})();

function sincronizaControlesPreview(d) {
  document.getElementById('prev-formato').value = FORMATOS[d.formato] || d.formato === 'todos' ? d.formato : '21';
  document.getElementById('prev-disposicion').value = d.vertical ? 'vertical' : 'horizontal';
  document.getElementById('prev-fuente').value = d.fpt || '';
  marcarSwatch(d.colorM);
}

function vistaPrevia() {
  const d = datosFormulario();
  if (!d.marcajes.length) { alert('Añade al menos un marcaje.'); return; }
  sincronizaControlesPreview(d);
  renderPreview();
  document.getElementById('modal-preview').hidden = false;
  document.body.style.overflow = 'hidden';
}

function cerrarPreview() {
  modoEnvio = false;
  modoLamas = false;
  modoComp = false;
  document.getElementById('modal-preview').hidden = true;
  document.body.style.overflow = '';
}

function imprimir() {
  window.print();
}

// Los controles de la vista previa cambian los ajustes de lo que se está
// viendo: los de las pegatinas (los del formulario) o los del envío.
document.getElementById('prev-formato').addEventListener('change', (e) => {
  if (ajustesActivos()) ajustesActivos().formato = e.target.value;
  else {
    const radio = document.querySelector(`input[name=formato][value="${e.target.value}"]`);
    if (radio) radio.checked = true;
  }
  renderPreview();
});

document.getElementById('prev-disposicion').addEventListener('change', (e) => {
  if (ajustesActivos()) ajustesActivos().disposicion = e.target.value;
  else {
    const radio = document.querySelector(`input[name=disposicion][value="${e.target.value}"]`);
    if (radio) radio.checked = true;
  }
  renderPreview();
});

document.getElementById('prev-fuente').addEventListener('input', (e) => {
  if (ajustesActivos()) ajustesActivos().fuente = e.target.value;
  else document.getElementById('fuente_pt').value = e.target.value;
  renderPreview();
});

document.querySelectorAll('.prev-swatches .swatch').forEach((btn) => {
  btn.addEventListener('click', () => {
    const color = btn.dataset.color;
    if (ajustesActivos()) ajustesActivos().color = color;
    else {
      const radio = document.querySelector(`input[name=color_marcaje][value="${color}"]`);
      if (radio) radio.checked = true;
    }
    marcarSwatch(color);
    renderPreview();
  });
});

// --- Pestañas: pegatinas de la hoja de corte / lamas / etiquetas de envío --------
function cambiaPestana(cual) {
  for (const t of ['componentes', 'pegatinas', 'lamas', 'envio']) {
    document.getElementById('panel-' + t).hidden = cual !== t;
    document.getElementById('tab-' + t).classList.toggle('activa', cual === t);
  }
}

// --- Arranque --------------------------------------------------------
document.getElementById('pdf').addEventListener('change', onPDFElegido);
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
}
mostrarPortada();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
