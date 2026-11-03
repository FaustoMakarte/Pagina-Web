#!/usr/bin/env python3
"""Comprobaciones mínimas del sitio antes de desplegarlo.

- index.html existe y no está vacío.
- Las etiquetas HTML están equilibradas.
- No se cargan recursos externos (scripts, hojas de estilo, imágenes, fuentes).

Solo usa la biblioteca estándar: no requiere instalar nada.
"""

from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path

VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}

# Etiquetas que descargan recursos y el atributo que los referencia.
RESOURCE_ATTRIBUTES = {
    "link": "href",
    "script": "src",
    "img": "src",
    "iframe": "src",
    "source": "src",
    "video": "src",
    "audio": "src",
    "embed": "src",
    "object": "data",
}


class SiteChecker(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.errors: list[str] = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        attribute = RESOURCE_ATTRIBUTES.get(tag)
        if attribute:
            value = (values.get(attribute) or "").strip()
            if value.startswith(("http://", "https://", "//")):
                self.errors.append(f"recurso externo en <{tag} {attribute}={value!r}>")

        if tag == "style":
            self.stack.append(tag)
        elif tag not in VOID_TAGS:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in VOID_TAGS:
            return
        if not self.stack:
            self.errors.append(f"</{tag}> sin etiqueta de apertura")
        elif self.stack[-1] != tag:
            self.errors.append(f"</{tag}> cierra a <{self.stack[-1]}>")
            if tag in self.stack:
                while self.stack and self.stack.pop() != tag:
                    pass
        else:
            self.stack.pop()


def main() -> int:
    index = Path("index.html")
    if not index.is_file():
        print("ERROR: no existe index.html")
        return 1

    html = index.read_text(encoding="utf-8")
    if not html.strip():
        print("ERROR: index.html está vacío")
        return 1

    checker = SiteChecker()
    checker.feed(html)
    checker.close()

    problems = list(checker.errors)
    if checker.stack:
        problems.append("etiquetas sin cerrar: " + ", ".join(checker.stack))

    if "@import" in html:
        problems.append("usa @import (recurso externo de CSS)")

    if problems:
        for problem in problems:
            print(f"ERROR: {problem}")
        return 1

    kilobytes = len(html.encode("utf-8")) / 1024
    print(f"OK: index.html válido, autocontenido ({kilobytes:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
