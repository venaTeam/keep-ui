import { ReactNode } from "react";
import Markdown, { Components } from "react-markdown";
import { isHttpUrl } from "@/shared/lib/http-url";

function Link({ href, children }: { href?: string; children?: ReactNode }) {
  if (!isHttpUrl(href)) {
    return <span>{children}</span>;
  }
  // As the browser understands it: a look-alike domain shows as punycode
  const target = new URL(href).href;
  const isLabelled = children !== target;
  return (
    <a
      href={target}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="break-all"
    >
      {isLabelled && <bdi>{children}</bdi>}
      {isLabelled && " "}
      <bdi dir="ltr">{isLabelled ? `(${target})` : target}</bdi>
    </a>
  );
}

function Heading({ children }: { children?: ReactNode }) {
  return <p className="font-semibold">{children}</p>;
}

const COMPONENTS: Components = {
  a: ({ href, children }) => <Link href={href}>{children}</Link>,
  // An answer is not a part of the outline of the page
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
};

const DISALLOWED_ELEMENTS = ["img"];

const transformUrl = (url: string, key: string) =>
  key === "href" && isHttpUrl(url) ? url : null;

/**
 * The text of the model, which may repeat what an alert says. Stricter than
 * `MarkdownHTML`: no HTML at all, nothing that loads by itself, and every link
 * shows where it goes.
 */
export function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div
      dir="auto"
      className="prose prose-sm prose-slate max-w-none break-words prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:my-1 prose-pre:overflow-x-auto"
    >
      <Markdown
        skipHtml
        disallowedElements={DISALLOWED_ELEMENTS}
        urlTransform={transformUrl}
        components={COMPONENTS}
      >
        {content}
      </Markdown>
    </div>
  );
}
