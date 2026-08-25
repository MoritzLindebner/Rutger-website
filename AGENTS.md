# Rutger — Projektregeln

## Nicht verhandelbar

**Die Seite muss auf jeder Gerätegröße gut aussehen und funktionieren.**
Von 320 px Handy-Hochformat bis 2560 px Desktop, dazu Handy-Querformat
(kurze Höhe, breites Bild). Das ist keine Politur am Ende, sondern
Abnahmebedingung für jede einzelne Änderung.

Konkret heißt das bei jeder Änderung an Layout, Schrift oder Animation:

- **Gemessen, nicht geschaut.** Vor „passt" mindestens diese Breiten
  durchfahren: 320, 375, 768, 1024, 1440, 1920, 2560 — plus 844×390
  (Handy quer). Für jede: `document.documentElement.scrollWidth <=
  innerWidth` (kein horizontales Scrollen), kein Text der aus seinem
  Kasten läuft, kein Element unter der Menüleiste versteckt.
- **Keine festen Pixelmaße für alles, was Inhalt trägt.** Schriftgrößen,
  Abstände und Kartenbreiten über `clamp()` / `min()` / `max()`.
  Feste px sind erlaubt für Strichstärken, Radien und Icons.
- **Achtung bei `transform: scaleX()`**: die Breite nach der Skalierung
  zählt, nicht die im `clamp()`. Wer mit `vw` rechnet, muss den Faktor
  einrechnen.
- **Höhen in `svh`, nicht `vh`.** Auf dem Handy wächst und schrumpft
  `vh` mit der Adressleiste und lässt das Layout springen.
- **Handy-Querformat ist der harte Fall.** ~390 px Höhe abzüglich
  Menüleiste — hier bricht als Erstes etwas.
