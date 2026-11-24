import { render, screen } from "@testing-library/react";
// The real react-markdown: what it lets through is what is tested here
import { AssistantMarkdown } from "../AssistantMarkdown";

const show = (content: string) =>
  render(<AssistantMarkdown content={content} />).container;

describe("markdown", () => {
  it("is rendered", () => {
    const container = show("# Title\n\n**bold** `code`\n\n- one\n- two");
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("code")).toHaveTextContent("code");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    // Not a part of the outline of the page
    expect(screen.queryByRole("heading")).toBeNull();
    expect(container).toHaveTextContent("Title");
  });

  it("is rendered while it is incomplete", () => {
    expect(show("**bo")).toHaveTextContent("**bo");
    expect(show("[label](https://exam")).toHaveTextContent("[label](");
  });
});

describe("links", () => {
  it.each([
    ["[docs](https://example.com/a?b=1#c)", "https://example.com/a?b=1#c"],
    ["[docs](http://example.com)", "http://example.com/"],
    ["[docs](HTTPS://EXAMPLE.com/A)", "https://example.com/A"],
    ["[docs][1]\n\n[1]: https://example.com/ref", "https://example.com/ref"],
  ])("show where they go: %s", (content, href) => {
    show(content);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveTextContent(`docs (${href})`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("show the real target of a label that looks like another one", () => {
    show("[https://keep.example.com](https://evil.test/login)");
    expect(screen.getByRole("link")).toHaveTextContent(
      "https://keep.example.com (https://evil.test/login)"
    );
  });

  it("show a look-alike domain for what it is", () => {
    show("[bank](https://exаmple.com/)");
    expect(screen.getByRole("link")).toHaveTextContent("(https://xn--");
  });

  it("show a bare address once", () => {
    show("<https://example.com/a>");
    expect(screen.getByRole("link").textContent).toBe("https://example.com/a");
  });

  it("isolate the label, so that its direction cannot rearrange the target", () => {
    show("[‮label](https://example.com/)");
    const parts = screen.getByRole("link").querySelectorAll("bdi");
    expect(parts).toHaveLength(2);
    expect(parts[1]).toHaveAttribute("dir", "ltr");
    expect(parts[1]).toHaveTextContent("(https://example.com/)");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java&#10;script:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:x",
    "file:///etc/passwd",
    "mailto:a@example.com",
    "tel:123",
    "//evil.test/a",
    "/alerts/feed",
    "#top",
    "https:",
  ])("to %s are text", (url) => {
    const container = show(`[label](<${url}>)`);
    expect(container).toHaveTextContent("label");
    expect(container.querySelector("a, [href]")).toBeNull();
  });
});

describe("what loads by itself", () => {
  it.each([
    "![alt](https://evil.test/p.png)",
    "![alt][1]\n\n[1]: https://evil.test/p.png",
    "[![alt](https://evil.test/p.png)](https://example.com/)",
    "![alt](data:image/png;base64,AAAA)",
  ])("is left out: %s", (content) => {
    const container = show(content);
    expect(container.querySelector("img, picture, [src]")).toBeNull();
    expect(container.innerHTML).not.toContain("evil.test");
  });
});

describe("HTML", () => {
  it.each([
    "<img src=x onerror=alert(1)>",
    "<script>alert(1)</script>",
    'before <a href="https://evil.test" onclick="x()">text</a> after',
    "<style>* { display: none }</style>",
    '<iframe src="https://evil.test"></iframe>',
    "<details open ontoggle=alert(1)>text</details>",
    '<form action="https://evil.test"><input></form>',
    "<div style='position:fixed'>text</div>",
    "<!-- comment -->",
  ])("is never HTML: %s", (content) => {
    const container = show(content);
    expect(
      container.querySelector(
        "a, img, script, style, iframe, details, form, input, [style], [onclick], [onerror]"
      )
    ).toBeNull();
    expect(container.innerHTML).not.toContain("<!--");
  });

  it("that is escaped stays text", () => {
    show("`<b>` &lt;i&gt;");
    expect(screen.getByText("<b>")).toBeInTheDocument();
    expect(screen.getByText(/<i>/)).toBeInTheDocument();
  });
});
