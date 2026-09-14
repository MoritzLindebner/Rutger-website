# -*- coding: utf-8 -*-
"""Eventfotos aus den Originalen auf Webmass bringen.

Warum ueberhaupt ein Skript: die Reihe in der Events-Sektion lebt davon, dass
die Kacheln UNGLEICH HOCH sind. Breit sind sie alle gleich (so macht es auch
die Vorlage tlb.betteroff.studio, dort gemessen: min-width == max-width), also
entsteht der Rhythmus allein aus dem Seitenverhaeltnis. Dort waren es 0.563,
0.749, 0.794 und 1.183 - drei von vier hochkant.

Kameramaterial kommt aber durchweg als 3:2 quer aus dem Gehaeuse. Ohne
Beschnitt ist jede Kachel gleich hoch und die Reihe sieht aus wie ein Zaun.
Der Beschnitt ist damit keine Nachbearbeitung, sondern der Effekt selbst.

Geschnitten wird aus dem ORIGINAL, nicht aus dem fertigen WebP: ein
9:16-Ausschnitt aus 1080 px Breite waere nur noch 405 px breit, und die Kachel
zeigt auf einem 2x-Schirm schon 720.

Aufruf:  py -3.13 events/build-events.py <Ordner mit den Originalen>
     oder EVENT_SRC=<Ordner> py -3.13 events/build-events.py

Der Quellordner steht bewusst NICHT im Code: die Originale liegen ausserhalb
des Repos, und ein fester Pfad waere ein privates Verzeichnis im oeffentlichen
Verlauf - und auf jeder anderen Maschine sowieso falsch.
"""
from PIL import Image, ImageOps
import os
import sys

SRC = (sys.argv[1] if len(sys.argv) > 1 else "") or os.environ.get("EVENT_SRC", "")
if not SRC or not os.path.isdir(SRC):
    sys.exit("Quellordner fehlt. Aufruf: py -3.13 events/build-events.py <Ordner>")
DST = os.path.dirname(os.path.abspath(__file__))

# Die Kachel ist hoechstens 360 CSS-px breit; 1080 reichen damit bis 3x.
WIDTH = 1080

# (Quelldatei, Zieldatei, Verhaeltnis Breite/Hoehe, Mitte x, Mitte y)
# Die Mitte ist ein Anteil der Originalbreite/-hoehe und sagt, worum herum
# geschnitten wird. Der Ausschnitt ist immer der groesste, der im Bild Platz
# hat - liegt die Mitte zu nah am Rand, rutscht er an den Rand statt kleiner
# zu werden.
JOBS = [
    ("FelixMM_PHOTO_TRAEGERTAL-41.jpg", "traegertal-01.webp", 0.794, 0.55, 0.50),
    ("FelixMM_PHOTO_TRAEGERTAL-45.jpg", "traegertal-02.webp", 0.563, 0.53, 0.50),
    ("FelixMM_PHOTO_TRAEGERTAL-55.jpg", "traegertal-03.webp", 1.500, 0.50, 0.50),
    (os.path.join("wetransfer__dsc1933-arw_2026-09-03_1439", "IMG_3133.JPG"),
     "clubshow-01.webp", 0.750, 0.63, 0.50),
    (os.path.join("wetransfer__dsc1933-arw_2026-09-03_1439", "IMG_3150.JPG"),
     "clubshow-02.webp", 1.185, 0.33, 0.50),
]


def crop_to(im, ratio, cx, cy):
    """Groesster Ausschnitt mit diesem Verhaeltnis, um (cx, cy) herum."""
    w, h = im.size
    if w / h > ratio:           # Bild ist breiter als gewuenscht -> Seiten weg
        cw, ch = round(h * ratio), h
    else:                       # Bild ist hoeher -> oben und unten weg
        cw, ch = w, round(w / ratio)
    left = min(max(round(cx * w - cw / 2), 0), w - cw)
    top = min(max(round(cy * h - ch / 2), 0), h - ch)
    return im.crop((left, top, left + cw, top + ch))


for src, out, ratio, cx, cy in JOBS:
    im = ImageOps.exif_transpose(Image.open(os.path.join(SRC, src))).convert("RGB")
    before = im.size
    im = crop_to(im, ratio, cx, cy)
    im = im.resize((WIDTH, round(WIDTH / ratio)), Image.LANCZOS)
    p = os.path.join(DST, out)
    im.save(p, "WEBP", quality=80, method=6)
    print("%-22s %dx%d -> %dx%d  ar=%.3f  %5.0f KB" % (
        out, before[0], before[1], im.size[0], im.size[1],
        im.size[0] / im.size[1], os.path.getsize(p) / 1024))
