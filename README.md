# Etiquetas de corte Llaza (web)

App para generar e imprimir etiquetas de marcaje a partir de una hoja de
corte de Llaza en PDF. Funciona **entera en el navegador**: no hay ningún
servidor, el PDF no sale de tu ordenador o móvil.

Es la versión "instalable" de la app, hermana de
[llaza-etiquetas](https://github.com/andresfh81-boop/llaza-etiquetas) (la
versión de escritorio con Flask). Pensada para abrirse desde cualquier
móvil u ordenador, en cualquier wifi, sin instalar Python ni nada.

## Cómo se usa

Abre la dirección publicada (GitHub Pages) desde el móvil o el ordenador
que sea. En el móvil, con "Añadir a pantalla de inicio" queda como un
icono más, igual que una app instalada.

1. Subir PDF de hoja de corte (o "Crear etiqueta genérica" para marcajes
   sueltos sin nº de pedido).
2. Revisar / editar la lista de marcajes detectados.
3. Elegir formato de etiqueta, disposición, color y tamaño.
4. 👁 Vista previa → 🖨 Imprimir (o "Guardar como PDF" desde el diálogo
   de impresión del navegador).

## Diferencias con la versión de escritorio

- No genera un `.docx`: se imprime directamente desde la vista previa
  (o se guarda como PDF desde el propio diálogo de impresión).
- La "configuración estándar" se guarda en el navegador (localStorage)
  en vez de en un `config.json` — es decir, es distinta en cada
  dispositivo/navegador, igual que antes era distinta en cada ordenador.

## Estructura

```
index.html            La app entera (las 3 pantallas: portada, revisar, configuración)
static/extractor.js   Extracción de marcajes del PDF con pdf.js (equivalente a nucleo/extractor.py)
static/app.js         Lógica de la app (listas, vista previa, impresión, configuración)
static/estilo.css     Estilos
vendor/pdfjs/         Librería pdf.js (vendorizada, sin depender de ningún CDN)
manifest.json, sw.js  Convierten la página en una PWA instalable
```

## Desarrollo local

No hace falta ningún servidor especial, cualquier servidor de ficheros
estático vale, por ejemplo:

```bat
python -m http.server 8000
```

y abrir `http://localhost:8000`.

## Publicar en GitHub Pages

Con el repositorio subido a GitHub: **Settings → Pages → Source: Deploy
from a branch → main / (root)**. La URL queda en
`https://<usuario>.github.io/<repositorio>/`.
