import React, { type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export type InlineMarkdownKind =
  | "heading"
  | "title"
  | "caption"
  | "label"
  | "metadata";

type MarkdownContentProps = {
  source: string;
};

type InlineMarkdownContentProps = MarkdownContentProps & {
  kind: InlineMarkdownKind;
};

type RehypeNode = {
  children?: RehypeNode[];
  properties?: Record<string, unknown>;
};

function nodeClassNames(node?: RehypeNode) {
  const value = node?.properties?.className;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/\s+/u).filter(Boolean);
  return [];
}

/**
 * Give every inline KaTeX root the same semantic hook. Display math keeps its
 * own `.katex-display` contract and is intentionally excluded.
 */
function rehypeInlineMathContract() {
  return (tree: RehypeNode) => {
    const visit = (node: RehypeNode, parent?: RehypeNode) => {
      const classNames = nodeClassNames(node);
      if (
        classNames.includes("katex") &&
        !nodeClassNames(parent).includes("katex-display") &&
        !classNames.includes("inline-math")
      ) {
        node.properties = {
          ...node.properties,
          className: [...classNames, "inline-math"],
        };
      }
      for (const child of node.children ?? []) visit(child, node);
    };
    visit(tree);
  };
}

const sharedComponents: Components = {
  a: ({ href, children }) => React.createElement(
    "a",
    { href, rel: "noreferrer", target: "_blank" },
    children,
  ),
  img: ({ src, alt }) => {
    const safe =
      typeof src === "string" &&
      (src.startsWith("data:image/") || src.startsWith("blob:") || src.startsWith("/"));
    return safe
      ? React.createElement("img", { alt: alt ?? "", src })
      : React.createElement(
          "span",
          { className: "inline-fallback" },
          `外部画像は読み込みません：${String(alt || src || "")}`,
        );
  },
};

const inlineComponents: Components = {
  ...sharedComponents,
  // react-markdown normally wraps a single inline source in <p>. Titles and
  // captions already own their semantic parent, so retain only the inline AST.
  p: ({ children }) => React.createElement(React.Fragment, null, children),
};

type MathOutput = "htmlAndMathml" | "mathml";

function renderMarkdown(
  source: string,
  components: Components,
  mathOutput: MathOutput = "htmlAndMathml",
): ReactNode {
  return React.createElement(
    ReactMarkdown,
    {
      components,
      rehypePlugins: mathOutput === "mathml"
        ? [[rehypeKatex, { output: "mathml" }], rehypeInlineMathContract]
        : [rehypeKatex, rehypeInlineMathContract],
      remarkPlugins: [remarkGfm, remarkMath],
    },
    source,
  );
}

/** Full Markdown used by prose, lists, tables, and standalone math blocks. */
export function MarkdownContent({ source }: MarkdownContentProps) {
  return renderMarkdown(source, sharedComponents);
}

/**
 * The single inline Markdown/LaTeX entry point for every document heading,
 * title, caption, and label. KaTeX receives only math AST nodes; surrounding
 * Japanese and Markdown decoration remain ordinary inline content.
 */
export function InlineMarkdownContent({ source, kind }: InlineMarkdownContentProps) {
  return React.createElement(
    "span",
    {
      className: "inline-markdown-content",
      "data-inline-markdown": "true",
      "data-inline-markdown-kind": kind,
    },
    // html2canvas serializes each SVG independently. MathML is native SVG
    // foreignObject content and therefore stays single and fully styled in
    // both Preview and PDF, while htmlAndMathml would duplicate each label.
    renderMarkdown(source, inlineComponents, kind === "label" ? "mathml" : "htmlAndMathml"),
  );
}
