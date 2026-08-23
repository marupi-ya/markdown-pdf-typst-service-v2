import type { StudioSettings } from "../../theme-settings";
import type { TypstThemeId } from "./types";

export const TYPST_THEME_LABELS: Record<TypstThemeId, string> = {
  "standard-blue": "Standard Blue",
  "standard-green": "Standard Green",
  "modern-navy": "Modern Navy",
  "soft-beige": "Soft Beige",
  "academic-red": "Academic Red",
};

type TypstThemeTokens = {
  primary: string;
  secondary: string;
  text: string;
  muted: string;
  surface: string;
  heading: string;
};

const THEMES: Record<TypstThemeId, TypstThemeTokens> = {
  "standard-blue": {
    primary: "#1769aa",
    secondary: "#dcecf8",
    text: "#162332",
    muted: "#5a6978",
    surface: "#f4f9fd",
    heading: "#0e4f82",
  },
  "standard-green": {
    primary: "#176b42",
    secondary: "#dcefe5",
    text: "#173029",
    muted: "#5d7068",
    surface: "#f3faf6",
    heading: "#105436",
  },
  "modern-navy": {
    primary: "#173a67",
    secondary: "#dfe7f2",
    text: "#142238",
    muted: "#607087",
    surface: "#f5f7fb",
    heading: "#102f57",
  },
  "soft-beige": {
    primary: "#8a5a2b",
    secondary: "#f2e6d5",
    text: "#382d23",
    muted: "#77695b",
    surface: "#fcf8f2",
    heading: "#6e431f",
  },
  "academic-red": {
    primary: "#9c1133",
    secondary: "#f4dfe5",
    text: "#361c24",
    muted: "#786068",
    surface: "#fcf5f7",
    heading: "#7d0d29",
  },
};

function mm(value: number) {
  return `${Number(value.toFixed(2))}mm`;
}

function pt(value: number) {
  return `${Number(value.toFixed(2))}pt`;
}

export function renderTypstTheme(themeId: TypstThemeId, settings: StudioSettings) {
  const theme = THEMES[themeId];
  const fontSizePt = settings.fontSize;
  const headingScale = Math.max(1.18, settings.headingSize / Math.max(1, settings.fontSize));
  const paragraphGap = Math.max(2.8, settings.paragraphSpacing * 0.55);
  const pageHeader = settings.showHeader
    ? `context grid(
      columns: (1fr, auto),
      text(size: 7.6pt, fill: muted-color)[#document-title],
      text(size: 7.2pt, fill: muted-color)[#document-subject　#document-unit],
    )`
    : "none";
  const footerGrid = settings.pageNumberPosition === "left"
    ? `columns: (auto, 1fr),
        text(size: 7.2pt, fill: muted-color)[#page-no],
        align(right)[#text(size: 7.2pt, fill: muted-color)[#document-copyright]]`
    : settings.pageNumberPosition === "center"
      ? `columns: (1fr, auto, 1fr),
        text(size: 7.2pt, fill: muted-color)[#document-copyright],
        text(size: 7.2pt, fill: muted-color)[#page-no],
        []`
      : `columns: (1fr, auto),
        text(size: 7.2pt, fill: muted-color)[#document-copyright],
        text(size: 7.2pt, fill: muted-color)[#page-no]`;
  const pageFooter = settings.showFooter
    ? `context {
      let page-no = counter(page).display("1")
      grid(
        ${footerGrid},
      )
    }`
    : "none";

  return `#let primary-color = rgb("${theme.primary}")
#let secondary-color = rgb("${theme.secondary}")
#let body-color = rgb("${theme.text}")
#let muted-color = rgb("${theme.muted}")
#let surface-color = rgb("${theme.surface}")
#let heading-color = rgb("${theme.heading}")

#set document(title: document-title, author: document-author)
#set page(
  paper: "a4",
  margin: (
    top: ${mm(settings.marginTop)},
    right: ${mm(settings.marginRight)},
    bottom: ${mm(settings.marginBottom)},
    left: ${mm(settings.marginLeft)},
  ),
  header: ${pageHeader},
  footer: ${pageFooter},
  numbering: "1",
)
#set text(
  font: ("Noto Sans Japanese", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", "Hiragino Sans", "DejaVu Sans"),
  size: ${pt(fontSizePt)},
  fill: body-color,
  lang: "ja",
)
#set par(
  leading: ${Number(Math.max(0.4, settings.lineHeight - 1).toFixed(2))}em,
  spacing: ${pt(settings.paragraphSpacing * 0.75)},
  justify: true,
  first-line-indent: 0pt,
)
#set heading(numbering: "1.1", outlined: false)
#show heading.where(level: 1): it => block(
  sticky: true,
  above: 12pt,
  below: 7pt,
  inset: (bottom: 4pt),
  stroke: (bottom: 1.4pt + primary-color),
  text(size: ${Number((fontSizePt * headingScale * 1.18).toFixed(2))}pt, weight: "bold", fill: heading-color)[#it.body],
)
#show heading.where(level: 2): it => block(
  sticky: true,
  above: 10pt,
  below: 6pt,
  inset: (left: 7pt),
  stroke: (left: 3pt + primary-color),
  text(size: ${Number((fontSizePt * headingScale).toFixed(2))}pt, weight: "bold", fill: heading-color)[#it.body],
)
#show heading.where(level: 3): it => block(
  sticky: true,
  above: 8pt,
  below: 5pt,
  text(size: ${Number((fontSizePt * headingScale * 0.91).toFixed(2))}pt, weight: "bold", fill: heading-color)[#it.body],
)
#show heading.where(level: 4): it => block(
  sticky: true,
  above: 6pt,
  below: 4pt,
  text(weight: "bold", fill: heading-color)[#it.body],
)
#show math.equation: set block(above: 6pt, below: 7pt)
#show table.cell.where(y: 0): set text(weight: "bold")

#let studio-par(body) = block(
  width: 100%,
  below: ${pt(paragraphGap)},
  par()[#body],
)

#let studio-display-math(body) = block(
  width: 100%,
  breakable: false,
  above: 5pt,
  below: 7pt,
  inset: (left: 1.15em, right: 0.4em),
  align(left)[#body],
)

#let studio-box(kind, variant, title, breakable: true, body) = {
  let accent = if variant == "caution" { rgb("#b35b16") }
    else if variant == "solution" { rgb("#596b78") }
    else if variant == "key-point" { rgb("#177257") }
    else if variant == "example" { rgb("#694c98") }
    else if variant == "definition" { heading-color }
    else if variant == "summary" { rgb("#5f4b8b") }
    else { primary-color }
  let fill-color = if variant == "caution" { rgb("#fff6e8") }
    else if variant == "solution" { rgb("#f4f6f7") }
    else if variant == "key-point" { rgb("#eef8f4") }
    else if variant == "example" { rgb("#f7f3fb") }
    else if variant == "definition" { secondary-color }
    else if variant == "summary" { rgb("#f7f4fb") }
    else if kind == "problem" { white }
    else { surface-color }
  let border-color = if variant == "solution" { rgb("#d4dce1") }
    else if variant == "caution" { rgb("#efd2ae") }
    else { secondary-color }
  block(
    width: 100%,
    breakable: breakable,
    above: 7pt,
    below: 8pt,
    inset: (top: 7pt, right: 9pt, bottom: 8pt, left: 10pt),
    fill: fill-color,
    stroke: (left: 3pt + accent, top: 0.7pt + border-color, right: 0.7pt + border-color, bottom: 0.7pt + border-color),
    radius: 2.5pt,
    [
      #block(sticky: true, below: 5pt)[#text(weight: "bold", fill: accent)[#title]]
      #body
    ],
  )
}

#let studio-figure(body, width: 94%, caption: none) = align(center)[
  #block(
    width: width,
    breakable: false,
    above: 8pt,
    below: 9pt,
    [
      #align(center)[#body]
      #if caption != none { align(center)[#text(size: 8pt, fill: muted-color)[#caption]] }
    ],
  )
]
`;
}
