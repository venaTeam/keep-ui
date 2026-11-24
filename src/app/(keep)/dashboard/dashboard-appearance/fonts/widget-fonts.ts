import localFont from "next/font/local";
import type { WidgetFontId } from "../widget-typography";

const inter = localFont({
  src: "./files/inter/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const roboto = localFont({
  src: "./files/roboto/roboto-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const ibmPlexSans = localFont({
  src: "./files/ibm-plex-sans/ibm-plex-sans-latin-wght-normal.woff2",
  weight: "100 700",
  display: "swap",
  preload: false,
});

const sourceSans3 = localFont({
  src: "./files/source-sans-3/source-sans-3-latin-wght-normal.woff2",
  weight: "200 900",
  display: "swap",
  preload: false,
});

const atkinsonHyperlegibleNext = localFont({
  src: "./files/atkinson-hyperlegible-next/atkinson-hyperlegible-next-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  preload: false,
});

const rubikLatin = localFont({
  src: "./files/rubik/rubik-latin-wght-normal.woff2",
  weight: "300 900",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

const rubikHebrew = localFont({
  src: "./files/rubik/rubik-hebrew-wght-normal.woff2",
  weight: "300 900",
  display: "swap",
  preload: false,
});

const jetbrainsMono = localFont({
  src: "./files/jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  display: "swap",
  preload: false,
});

const SANS_FALLBACK = "ui-sans-serif, system-ui, sans-serif";
const MONO_FALLBACK = "ui-monospace, Menlo, monospace";

export interface WidgetFont {
  label: string;
  note?: string;
  stack: string;
}

/**
 * The fonts a dashboard widget can use. Files ship with the app (no network
 * fetch at build or run time) and are downloaded by the browser only when a
 * widget renders with them.
 */
export const WIDGET_FONTS: Record<WidgetFontId, WidgetFont> = {
  system: { label: "System default", note: "current", stack: SANS_FALLBACK },
  inter: { label: "Inter", stack: `${inter.style.fontFamily}, ${SANS_FALLBACK}` },
  roboto: {
    label: "Roboto",
    stack: `${roboto.style.fontFamily}, ${SANS_FALLBACK}`,
  },
  "ibm-plex-sans": {
    label: "IBM Plex Sans",
    stack: `${ibmPlexSans.style.fontFamily}, ${SANS_FALLBACK}`,
  },
  "source-sans-3": {
    label: "Source Sans 3",
    stack: `${sourceSans3.style.fontFamily}, ${SANS_FALLBACK}`,
  },
  "atkinson-hyperlegible": {
    label: "Atkinson Hyperlegible Next",
    note: "wall screens",
    stack: `${atkinsonHyperlegibleNext.style.fontFamily}, ${SANS_FALLBACK}`,
  },
  rubik: {
    label: "Rubik",
    note: "Hebrew",
    stack: `${rubikLatin.style.fontFamily}, ${rubikHebrew.style.fontFamily}, ${SANS_FALLBACK}`,
  },
  "jetbrains-mono": {
    label: "JetBrains Mono",
    note: "monospace",
    stack: `${jetbrainsMono.style.fontFamily}, ${MONO_FALLBACK}`,
  },
};

export const WIDGET_FONT_STACKS = Object.fromEntries(
  Object.entries(WIDGET_FONTS).map(([id, font]) => [id, font.stack])
) as Record<WidgetFontId, string>;
