const CACHE_NAME = 'etiquetas-llaza-v20';
const APP_SHELL = [
'./',
'./index.html',
'./manifest.json',
'./static/estilo.css',
'./static/extractor.js',
'./static/app.js',
'./static/fonts/Poppins-ExtraBold.ttf',
'./static/fonts/Poppins-Light.ttf',
'./vendor/pdfjs/pdf.min.js',
'./vendor/pdfjs/pdf.worker.min.js',
'./static/favicon.ico',
'./static/icon-32.png',
'./static/icon-180.png',
'./static/icon-192.png',
'./static/icon-512.png'
];
// Con wifi sin internet o mala señal la red no falla, se queda esperando: pasado este tiempo se usa la copia guardada.
const NET_TIMEOUT = 4000;

// cache: 'reload' para no guardar una copia vieja que tenga el navegador o GitHub Pages.
self.addEventListener('install', (event) => {
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting())
);
});

// Solo borra copias viejas de esta app: todas las apps de andresfh81-boop.github.io comparten las copias guardadas.
self.addEventListener('activate', (event) => {
event.waitUntil(
caches.keys().then((keys) =>
Promise.all(keys.filter((key) => key.startsWith('etiquetas-llaza-') && key !== CACHE_NAME).map((key) => caches.delete(key)))
).then(() => self.clients.claim())
);
});

// "Red primero": mientras haya internet, siempre se pide la versión
// más reciente (así los cambios de la app llegan solos a quien ya la
// tenga instalada). Si falla -sin conexión- o tarda demasiado, se sirve
// la última copia guardada, para que la app siga funcionando offline.
const copia = (request) =>
caches.match(request).then((cached) => {
if (cached) return cached;
if (request.mode === 'navigate') {
return caches.match('./index.html');
}
});

self.addEventListener('fetch', (event) => {
if (event.request.method !== 'GET') return;

const red = fetch(event.request).then((response) => {
if (response && response.status === 200 && response.type === 'basic') {
const clone = response.clone();
caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
}
return response;
});
event.waitUntil(red.catch(() => {}));

event.respondWith(new Promise((resolve) => {
let hecho = false;
const dar = (r) => { if (!hecho && r) { hecho = true; resolve(r); } };
const timer = setTimeout(() => copia(event.request).then(dar), NET_TIMEOUT);
red.then((r) => { clearTimeout(timer); dar(r); })
.catch(() => { clearTimeout(timer); copia(event.request).then((c) => { dar(c); if (!hecho) resolve(Response.error()); }); });
}));
});
