import {
  DEFAULT_MAX_HTML_BYTES,
  buildHtmlSrcDoc,
  validateHtmlContent,
} from "../html-widget-validation";

describe("validateHtmlContent", () => {
  it("requires non-empty content", () => {
    expect(validateHtmlContent("")).toMatch(/required/);
    expect(validateHtmlContent("   \n\t ")).toMatch(/required/);
  });

  it("accepts ordinary content", () => {
    expect(validateHtmlContent("<h1>Runbook</h1>")).toBeNull();
  });

  it("rejects content over the size cap", () => {
    const tooBig = "a".repeat(DEFAULT_MAX_HTML_BYTES + 1);
    expect(validateHtmlContent(tooBig)).toMatch(/50 KB/);
  });

  it("measures the byte length, not the character count", () => {
    const justUnderInChars = "€".repeat(DEFAULT_MAX_HTML_BYTES - 1);
    expect(justUnderInChars.length).toBeLessThan(DEFAULT_MAX_HTML_BYTES);
    expect(validateHtmlContent(justUnderInChars)).toMatch(/50 KB/);
  });

  it("honors a custom cap", () => {
    expect(validateHtmlContent("abcdef", 4)).toMatch(/KB/);
    expect(validateHtmlContent("ab", 4)).toBeNull();
  });
});

describe("buildHtmlSrcDoc", () => {
  it("embeds the author's HTML verbatim in the body", () => {
    const html = '<h1>Hi</h1><p style="color:red">Note</p>';
    expect(buildHtmlSrcDoc(html)).toContain(html);
  });

  it("locks down subresources with a strict CSP that forbids scripts", () => {
    const doc = buildHtmlSrcDoc("<p>x</p>");
    expect(doc).toContain('http-equiv="Content-Security-Policy"');
    expect(doc).toContain("default-src 'none'");
    expect(doc).not.toContain("script-src");
  });

  it("allows http, https and data images", () => {
    expect(buildHtmlSrcDoc("<p>x</p>")).toContain("img-src http: https: data:");
  });

  it("keeps a hostile payload inert-by-construction rather than stripping it", () => {
    const hostile =
      '<script>alert(document.cookie)</script><img src=x onerror="alert(1)">';
    const doc = buildHtmlSrcDoc(hostile);
    expect(doc).toContain(hostile);
    expect(doc).toContain("default-src 'none'");
  });

  it("emits a light document and places the CSP before the author body", () => {
    const doc = buildHtmlSrcDoc("<main>AUTHOR</main>");
    expect(doc).toContain("background:#ffffff");
    expect(doc.indexOf("Content-Security-Policy")).toBeLessThan(
      doc.indexOf("AUTHOR")
    );
  });
});

describe("validateHtmlContent edge cases", () => {
  it("allows content exactly at the cap and rejects one byte over", () => {
    expect(validateHtmlContent("a".repeat(DEFAULT_MAX_HTML_BYTES))).toBeNull();
    expect(validateHtmlContent("a".repeat(DEFAULT_MAX_HTML_BYTES + 1))).toMatch(
      /50 KB/
    );
  });

  it("counts a 4-byte emoji (surrogate pair) as four bytes", () => {
    const emojiCount = Math.floor(DEFAULT_MAX_HTML_BYTES / 4) + 1;
    const value = "😀".repeat(emojiCount);
    expect(value.length).toBeLessThan(DEFAULT_MAX_HTML_BYTES);
    expect(validateHtmlContent(value)).toMatch(/50 KB/);
  });
});

describe("buildHtmlSrcDoc quality and injection-safety", () => {
  it("embeds content with closing tags and quotes verbatim, without stripping", () => {
    const tricky = `</body></html><div class="x">'q"</div></style><b>keep</b>`;
    expect(buildHtmlSrcDoc(tricky)).toContain(tricky);
  });

  it("constrains media and tables and wraps text so content cannot overflow", () => {
    const doc = buildHtmlSrcDoc("<p>x</p>");
    expect(doc).toContain("max-width:100%");
    expect(doc).toContain("overflow-wrap:anywhere");
    expect(doc).toContain("margin:0");
  });

  it("declares a responsive viewport", () => {
    expect(buildHtmlSrcDoc("<p>x</p>")).toContain('name="viewport"');
  });

  it("permits inline styles but never scripts or eval in the CSP", () => {
    const doc = buildHtmlSrcDoc("<p>x</p>");
    expect(doc).toContain("style-src 'unsafe-inline'");
    expect(doc).not.toContain("unsafe-eval");
    expect(doc).not.toContain("script-src");
  });

  it("emits a light surface (dark mode is handled by the app's invert filter)", () => {
    const doc = buildHtmlSrcDoc("<p>x</p>");
    expect(doc).toContain("background:#ffffff");
    expect(doc).toContain("color:#111827");
    expect(doc).not.toContain("color-scheme");
  });
});
