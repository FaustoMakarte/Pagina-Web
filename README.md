# Pagina-Web

Bienvenida a un sitio web: página estática (HTML + CSS, sin dependencias ni
recursos externos) publicada en GitHub Pages mediante GitHub Actions.

**URL del sitio:** https://faustomakarte.github.io/Pagina-Web/

## Estructura

```
index.html                      Página de bienvenida (CSS inline, sin recursos externos)
.github/workflows/deploy.yml    CI/CD: valida, empaqueta y publica en Pages
.github/scripts/check_site.py   Comprobaciones del HTML
.nojekyll                       Evita el procesado con Jekyll
```

## Flujo de despliegue

| Job | Qué hace | Cuándo |
|---|---|---|
| `check` | Valida el HTML y que no cargue recursos externos | push y pull requests |
| `build` | Verifica que Pages use *GitHub Actions* y sube el artefacto | push a `main` |
| `deploy` | Publica y comprueba que la URL responda 200 | push a `main` |

## Uso local

```bash
python .github/scripts/check_site.py   # valida el HTML
```

Para verlo en el navegador, abre `index.html` con doble clic.

## Puesta en marcha (una sola vez)

1. **Settings → Pages → Build and deployment → Source: `GitHub Actions`**.
2. Haz push a `main` (o lanza el workflow desde la pestaña *Actions*).
3. El sitio queda en `https://faustomakarte.github.io/Pagina-Web/`.
