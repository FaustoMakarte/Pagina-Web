# Pagina-Web

Bienvenida con login y **juego de truco** contra la máquina, en HTML, CSS y
JavaScript puros. Sin frameworks, sin dependencias y sin recursos externos.

**URL del sitio:** https://faustomakarte.github.io/Pagina-Web/

## Acceso

- Usuario: `Admin`
- Contraseña: `admin123`

> ⚠️ El login es un filtro del lado del cliente: cualquiera puede leer el código
> y saltárselo. No protege información sensible; solo evita el acceso casual.

Para cambiar la contraseña, editá `PASSWORD_HASH` en `app.js` con el hash
FNV-1a de la nueva clave. Para calcularlo:

```bash
node -e "let h=0x811c9dc5; for (const c of 'NUEVA_CLAVE') { h^=c.charCodeAt(0); h=Math.imul(h,0x01000193)>>>0 } console.log(h.toString(16).padStart(8,'0'))"
```

## El juego

- Truco a 15 puntos, 1 jugador contra la máquina.
- Mazo español de 40 cartas, sin flor.
- Envido, envido envido, real envido y falta envido.
- Truco, retruco y vale cuatro, con quiero / no quiero.
- Parda y mano resueltas por las reglas habituales.
- La máquina canta según la fuerza de su mano y juega buscando imponerse.

## Estructura

```
index.html                      Interfaz: login + tablero (CSS inline)
truco.js                        Motor del juego (sin DOM, testeable)
app.js                          Login y render del estado
tests/truco.test.js             Tests del motor (node --test)
.github/workflows/deploy.yml    CI/CD: valida, testea, empaqueta y publica
.github/scripts/check_site.py   Comprobaciones del HTML
.nojekyll                       Evita el procesado con Jekyll
```

## Uso local

```bash
python .github/scripts/check_site.py   # valida el HTML
node --test tests/*.test.js                     # tests del motor
python -m http.server 8765             # y abrí http://localhost:8765
```

## Flujo de despliegue

| Job | Qué hace | Cuándo |
|---|---|---|
| `check` | Valida el HTML, verifica que no haya recursos externos y corre los tests | push y pull requests |
| `build` | Comprueba la configuración de Pages y sube el artefacto | push a `main` |
| `deploy` | Publica y confirma que la URL responda 200 | push a `main` |

## Puesta en marcha (una sola vez)

1. **Settings → Pages → Build and deployment → Source: `GitHub Actions`**.
2. Haz push a `main` (o lanza el workflow desde la pestaña *Actions*).
3. El sitio queda en `https://faustomakarte.github.io/Pagina-Web/`.
