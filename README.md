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

1. Subir PDF de hoja de corte (eligiéndolo o arrastrándolo sobre el
   botón), o "Crear etiqueta genérica" para marcajes sueltos sin nº de
   pedido.
2. Revisar / editar la lista de marcajes detectados.
3. Elegir formato de etiqueta, disposición, color (rojo, azul, verde,
   amarillo o negro) y tamaño.
4. 👁 Vista previa → 🖨 Imprimir (o "Guardar como PDF" desde el diálogo
   de impresión del navegador).

Si el PDF trae "COLOR ESTRUC: NNNN" y/o "DIMENSIONES: A x B mm", esos
datos se detectan solos (y también se pueden escribir o corregir a
mano, por ejemplo en una etiqueta genérica):
- El color de estructura sale a la derecha de cada etiqueta, del mismo
  tamaño que el nº de hoja -en una columna aparte, no debajo del
  marcaje, para que no se salga ni se recorte en las etiquetas pequeñas.
- La medida de la pérgola sale junto al nº de hoja, algo más pequeña.

## Diferencias con la versión de escritorio

- No genera un `.docx`: se imprime directamente desde la vista previa
  (o se guarda como PDF desde el propio diálogo de impresión).
- No hay "configuración estándar": cada hoja empieza siempre con los
  mismos ajustes por defecto (formato 21, horizontal, rojo, letra
  automática) y se cambian ahí mismo si hace falta.

## Estructura

```
index.html            La app entera (las 2 pantallas: portada y revisar)
static/extractor.js   Extracción de marcajes y color de estructura del PDF con pdf.js (equivalente a nucleo/extractor.py)
static/app.js         Lógica de la app (listas, vista previa, impresión, arrastrar y soltar)
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
