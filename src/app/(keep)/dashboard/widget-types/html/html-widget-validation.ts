export const DEFAULT_MAX_HTML_BYTES = 50 * 1024;

/**
 * UTF-8 byte length of a string, computed without TextEncoder/Blob so it works
 * identically in the browser and in the jsdom test environment.
 */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/**
 * Validates author HTML for an HTML widget: required and capped so the
 * dashboard's inline config blob stays small. Returns an error message or null.
 */
export function validateHtmlContent(
  html: string,
  maxBytes: number = DEFAULT_MAX_HTML_BYTES
): string | null {
  if (!html.trim()) {
    return "HTML content is required";
  }
  if (utf8ByteLength(html) > maxBytes) {
    return `HTML is larger than ${Math.round(maxBytes / 1024)} KB`;
  }
  return null;
}

/**
 * Wraps author HTML in a self-contained light document for a scriptless
 * sandboxed iframe. Safety is provided by the iframe sandbox (opaque origin, no
 * scripts, no forms, no top-navigation) and a strict Content-Security-Policy, so
 * the markup is embedded verbatim rather than stripped. Dark mode is handled by
 * the app's global invert filter, which inverts the iframe along with the page,
 * so the document is always emitted light. The base styles keep content from
 * overflowing the frame.
 */
export function buildHtmlSrcDoc(html: string): string {
  const csp =
    "default-src 'none'; " +
    "img-src http: https: data:; " +
    "style-src 'unsafe-inline' https:; " +
    "font-src https: data:; " +
    "media-src http: https: data:";
  const baseStyles =
    "html,body{margin:0}" +
    `body{padding:8px;font-family:ui-sans-serif,system-ui,-apple-system,` +
    `Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;` +
    `color:#111827;background:#ffffff;overflow-wrap:anywhere}` +
    `a{color:#2563eb}` +
    "img,video,table{max-width:100%}img,video{height:auto}";
  return (
    "<!doctype html><html><head>" +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<style>${baseStyles}</style>` +
    `</head><body>${html}</body></html>`
  );
}
