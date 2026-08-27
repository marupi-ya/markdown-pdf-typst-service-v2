import type { StudioSettings } from "../../theme-settings";
import type { TypstThemeId } from "./types";

export const TYPST_THEME_LABELS: Record<TypstThemeId, string> = {
  "standard-blue": "Standard Blue",
  "standard-green": "Standard Green",
  "modern-navy": "Modern Navy",
  "soft-beige": "Soft Beige",
  "academic-red": "Academic Red",
  "editorial-terracotta": "Editorial Study / テラコッタ",
  "editorial-navy": "Editorial Study / ネイビー",
  "editorial-forest": "Editorial Study / フォレスト",
  "editorial-plum": "Editorial Study / プラム",
  "editorial-ochre": "Editorial Study / オーカー",
};

export const EDITORIAL_TYPST_THEME_IDS = [
  "editorial-terracotta",
  "editorial-navy",
  "editorial-forest",
  "editorial-plum",
  "editorial-ochre",
] as const satisfies readonly TypstThemeId[];

export const CLASSIC_TYPST_THEME_IDS = [
  "standard-blue",
  "standard-green",
  "modern-navy",
  "soft-beige",
  "academic-red",
] as const satisfies readonly TypstThemeId[];

type TypstThemeTokens = {
  layout: "classic" | "editorial";
  primary: string;
  secondary: string;
  text: string;
  muted: string;
  surface: string;
  heading: string;
};

const THEMES: Record<TypstThemeId, TypstThemeTokens> = {
  "standard-blue": {
    layout: "classic",
    primary: "#1769aa",
    secondary: "#dcecf8",
    text: "#162332",
    muted: "#5a6978",
    surface: "#f4f9fd",
    heading: "#0e4f82",
  },
  "standard-green": {
    layout: "classic",
    primary: "#176b42",
    secondary: "#dcefe5",
    text: "#173029",
    muted: "#5d7068",
    surface: "#f3faf6",
    heading: "#105436",
  },
  "modern-navy": {
    layout: "classic",
    primary: "#173a67",
    secondary: "#dfe7f2",
    text: "#142238",
    muted: "#607087",
    surface: "#f5f7fb",
    heading: "#102f57",
  },
  "soft-beige": {
    layout: "classic",
    primary: "#8a5a2b",
    secondary: "#f2e6d5",
    text: "#382d23",
    muted: "#77695b",
    surface: "#fcf8f2",
    heading: "#6e431f",
  },
  "academic-red": {
    layout: "classic",
    primary: "#9c1133",
    secondary: "#f4dfe5",
    text: "#361c24",
    muted: "#786068",
    surface: "#fcf5f7",
    heading: "#7d0d29",
  },
  "editorial-terracotta": {
    layout: "editorial",
    primary: "#b5472e",
    secondary: "#ead8d0",
    text: "#171614",
    muted: "#77716a",
    surface: "#f1eee8",
    heading: "#171614",
  },
  "editorial-navy": {
    layout: "editorial",
    primary: "#315675",
    secondary: "#d9e2e8",
    text: "#17191b",
    muted: "#70767b",
    surface: "#eff2f3",
    heading: "#151a1e",
  },
  "editorial-forest": {
    layout: "editorial",
    primary: "#3e6a52",
    secondary: "#dbe6df",
    text: "#171a18",
    muted: "#6f7772",
    surface: "#eff3f0",
    heading: "#151a17",
  },
  "editorial-plum": {
    layout: "editorial",
    primary: "#72506f",
    secondary: "#e5dce4",
    text: "#1b171b",
    muted: "#766e75",
    surface: "#f3eff2",
    heading: "#1b171b",
  },
  "editorial-ochre": {
    layout: "editorial",
    primary: "#a26a21",
    secondary: "#eadfce",
    text: "#1c1914",
    muted: "#787166",
    surface: "#f3f0ea",
    heading: "#1c1914",
  },
};

export function typstThemeFigurePalette(themeId: TypstThemeId) {
  const theme = THEMES[themeId];
  return theme.layout === "editorial"
    ? { primary: theme.primary, secondary: theme.secondary }
    : undefined;
}

function mm(value: number) {
  return `${Number(value.toFixed(2))}mm`;
}

function pt(value: number) {
  return `${Number(value.toFixed(2))}pt`;
}

function renderEditorialTypstTheme(theme: TypstThemeTokens, settings: StudioSettings) {
  const fontSizePt = settings.fontSize;
  const headingScale = Math.max(1.18, settings.headingSize / Math.max(1, settings.fontSize));
  const paragraphGap = Math.max(2.8, settings.paragraphSpacing * 0.5);
  const displayMathSize = fontSizePt * 1.13;
  const emphasizedMathSize = fontSizePt * 1.18;
  const pageHeader = settings.showHeader
    ? `context {
      let page-no = counter(page).display("1")
      block(
        width: 100%,
        inset: (bottom: 4.5pt),
        stroke: (bottom: 0.35pt + rule-color),
      )[
        #grid(
          columns: (1fr, auto),
          editorial-label([#document-subject  /  STUDY NOTES]),
          editorial-label([LESSON #document-lesson-id  /  #page-no]),
        )
      ]
    }`
    : "none";
  const footerGrid = settings.pageNumberPosition === "left"
    ? `columns: (auto, 1fr),
        editorial-label([P. #page-no], fill: primary-color),
        align(right)[#editorial-label([#document-copyright])]`
    : settings.pageNumberPosition === "center"
      ? `columns: (1fr, auto, 1fr),
        editorial-label([#document-author]),
        editorial-label([P. #page-no], fill: primary-color),
        align(right)[#editorial-label([#document-copyright])]`
      : `columns: (1fr, auto),
        editorial-label([#document-author]),
        editorial-label([P. #page-no], fill: primary-color)`;
  const pageFooter = settings.showFooter
    ? `context {
      let page-no = counter(page).display("1")
      block(
        width: 100%,
        inset: (top: 5pt),
        stroke: (top: 0.35pt + rule-color),
      )[
        #grid(
          ${footerGrid},
        )
      ]
    }`
    : "none";

  return `#let primary-color = rgb("${theme.primary}")
#let secondary-color = rgb("${theme.secondary}")
#let body-color = rgb("${theme.text}")
#let muted-color = rgb("${theme.muted}")
#let surface-color = rgb("${theme.surface}")
#let heading-color = rgb("${theme.heading}")
#let paper-color = rgb("#fbfaf6")
#let rule-color = rgb("#dedbd4")
#let panel-color = rgb("#f0eee8")
#let ink-color = rgb("#11110f")
#let sans-font = ("Noto Sans Japanese", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", "Hiragino Sans", "DejaVu Sans")
#let serif-font = ("Noto Serif CJK JP", "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", "Noto Sans CJK JP", "DejaVu Serif")

#let editorial-label(body, fill: muted-color) = text(
  font: sans-font,
  size: 6.8pt,
  weight: "medium",
  tracking: 0.13em,
  fill: fill,
)[#body]

#set document(title: document-title, author: document-author)
#set page(
  paper: "a4",
  fill: paper-color,
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
  font: serif-font,
  size: ${pt(fontSizePt)},
  fill: body-color,
  lang: "ja",
)
#set par(
  leading: ${Number(Math.max(0.4, settings.lineHeight - 1).toFixed(2))}em,
  spacing: ${pt(settings.paragraphSpacing * 0.68)},
  justify: true,
  first-line-indent: 0pt,
)
#set heading(numbering: none, outlined: false)

#show heading.where(level: 1): it => block(
  sticky: true,
  above: 11pt,
  below: 8pt,
  inset: (bottom: 6pt),
  stroke: (bottom: 1.15pt + ink-color),
)[
  #grid(
    columns: (62pt, 1fr),
    gutter: 11pt,
    align(left + bottom)[
      #text(font: sans-font, size: 25pt, weight: "light", fill: primary-color)[#document-lesson-id]
    ],
    [
      #editorial-label([LESSON  /  #document-unit], fill: primary-color)
      #v(2.5pt)
      #text(size: ${Number((fontSizePt * headingScale * 1.12).toFixed(2))}pt, weight: "bold", fill: heading-color)[#document-title]
    ],
  )
]

#let editorial-section-counter = counter("editorial-section")
#show heading.where(level: 2): it => {
  editorial-section-counter.step()
  block(
    sticky: true,
    above: 11pt,
    below: 5.5pt,
    inset: (top: 7pt),
    stroke: (top: 0.35pt + rule-color),
  )[
    #grid(
      columns: (62pt, 1fr),
      gutter: 11pt,
      align(right + top)[
        #context editorial-label(
          [SECTION #editorial-section-counter.display("1")],
          fill: primary-color,
        )
      ],
      text(size: ${Number((fontSizePt * headingScale).toFixed(2))}pt, weight: "bold", fill: heading-color)[#it.body],
    )
  ]
}

#show heading.where(level: 3): it => block(
  sticky: true,
  above: 8pt,
  below: 4.5pt,
  inset: (bottom: 3pt),
  stroke: (bottom: 0.35pt + rule-color),
)[
  #editorial-label([SUBSECTION], fill: primary-color)
  #h(8pt)
  #text(size: ${Number((fontSizePt * headingScale * 0.89).toFixed(2))}pt, weight: "bold", fill: heading-color)[#it.body]
]

#show heading.where(level: 4): it => block(
  sticky: true,
  above: 6pt,
  below: 4pt,
  text(weight: "bold", fill: heading-color)[#it.body],
)
#show math.equation: set block(above: 5.5pt, below: 6.5pt)
#show table.cell.where(y: 0): set text(weight: "bold")

#let studio-par(body) = block(
  width: 100%,
  below: ${pt(paragraphGap)},
  par()[#body],
)

#let studio-display-math(body, emphasis: false) = block(
  width: 100%,
  breakable: false,
  above: 5.5pt,
  below: 7pt,
  inset: (left: 1.1em, right: 0.4em),
  align(left)[
    #text(size: if emphasis { ${pt(emphasizedMathSize)} } else { ${pt(displayMathSize)} })[#body]
  ],
)

#let studio-final-display-math(body) = block(
  width: 100%,
  breakable: false,
  above: 6pt,
  below: 7pt,
  inset: (left: 9pt),
  stroke: (left: 1.4pt + primary-color),
  align(left)[#text(size: ${pt(emphasizedMathSize)}, weight: "medium")[#body]],
)

#let studio-conclusion(body) = block(
  width: 100%,
  above: 2pt,
  below: ${pt(paragraphGap)},
  inset: (left: 8pt),
  stroke: (left: 1.2pt + primary-color),
  text(weight: "medium")[#body],
)

#let studio-box(kind, variant, title, breakable: true, body) = {
  let role-label = if variant == "learning-goals" { "GOAL" }
    else if variant == "solution" { "ANSWER / 解答" }
    else if variant == "summary" { "SUMMARY" }
    else if variant == "caution" { "CAUTION / 注意" }
    else if variant == "key-point" { "POINT" }
    else if variant == "definition" { "DEFINITION" }
    else if variant == "explanation" { "EXPLANATION / 解説" }
    else if variant == "example" { "EXAMPLE" }
    else if variant == "exercise" { "EXERCISE" }
    else if variant == "answer-question" { "QUESTION" }
    else { "NOTE" }

  if variant == "summary" {
    block(
      width: 100%,
      breakable: breakable,
      above: 8pt,
      below: 8pt,
      inset: (top: 8pt, right: 10pt, bottom: 8.5pt, left: 10pt),
      fill: ink-color,
      radius: 0pt,
    )[
      #grid(
        columns: (48pt, 1fr),
        gutter: 10pt,
        editorial-label([#role-label], fill: primary-color),
        text(fill: white)[
          #strong[#title]
          #v(3.5pt)
          #body
        ],
      )
    ]
  } else if kind == "problem" or variant == "example" or variant == "exercise" or variant == "answer-question" {
    block(
      width: 100%,
      breakable: breakable,
      above: 7pt,
      below: 8pt,
      inset: (top: 8pt, right: 10pt, bottom: 8pt, left: 10pt),
      fill: panel-color,
      stroke: none,
      radius: 0pt,
    )[
      #block(sticky: true, below: 5pt)[
        #box(fill: ink-color, inset: (x: 7pt, y: 3.5pt), radius: 0pt)[
          #text(font: sans-font, size: 7.3pt, weight: "bold", fill: white)[#title]
        ]
        #h(7pt)
        #editorial-label([#role-label], fill: primary-color)
      ]
      #body
    ]
  } else if variant == "learning-goals" {
    block(
      width: 100%,
      breakable: breakable,
      above: 5pt,
      below: 8pt,
      inset: (top: 6pt, bottom: 7pt),
      stroke: (bottom: 0.35pt + rule-color),
    )[
      #grid(
        columns: (62pt, 1fr),
        gutter: 11pt,
        align(right + top)[#editorial-label([#role-label], fill: primary-color)],
        [
          #text(font: sans-font, size: 7.3pt, weight: "medium", fill: muted-color)[#title]
          #v(3.5pt)
          #body
        ],
      )
    ]
  } else if variant == "solution" {
    block(
      width: 100%,
      breakable: breakable,
      above: 7pt,
      below: 8pt,
      inset: (top: 2pt, bottom: 7pt),
      stroke: (bottom: 0.35pt + rule-color),
    )[
      #block(sticky: true, below: 5pt)[
        #editorial-label([#role-label], fill: primary-color)
        #h(7pt)
        #text(font: sans-font, size: 7.5pt, weight: "medium", fill: muted-color)[#title]
      ]
      #body
    ]
  } else {
    let callout-fill = if variant == "definition" { secondary-color } else { white }
    let callout-stroke = if variant == "explanation" { (bottom: 0.35pt + rule-color) } else { (left: 1.35pt + primary-color) }
    block(
      width: 100%,
      breakable: breakable,
      above: 6.5pt,
      below: 7.5pt,
      inset: (top: 6pt, right: 8pt, bottom: 6.5pt, left: 9pt),
      fill: callout-fill,
      stroke: callout-stroke,
      radius: 0pt,
    )[
      #block(sticky: true, below: 4pt)[
        #editorial-label([#role-label], fill: primary-color)
        #h(7pt)
        #text(font: sans-font, size: 7.5pt, weight: "medium", fill: muted-color)[#title]
      ]
      #body
    ]
  }
}

#let studio-figure(body, width: 94%, caption: none) = align(center)[
  #block(
    width: width,
    breakable: false,
    above: 8pt,
    below: 8pt,
    [
      #align(center)[#body]
      #if caption != none {
        align(right)[
          #editorial-label([FIG.], fill: primary-color)
          #h(4pt)
          #text(font: sans-font, size: 6.8pt, fill: muted-color)[#caption]
        ]
      }
    ],
  )
]
`;
}

export function renderTypstTheme(themeId: TypstThemeId, settings: StudioSettings) {
  const theme = THEMES[themeId];
  if (theme.layout === "editorial") return renderEditorialTypstTheme(theme, settings);
  const fontSizePt = settings.fontSize;
  const headingScale = Math.max(1.18, settings.headingSize / Math.max(1, settings.fontSize));
  const paragraphGap = Math.max(2.8, settings.paragraphSpacing * 0.52);
  const displayMathSize = fontSizePt * 1.12;
  const emphasizedMathSize = fontSizePt * 1.16;
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
  spacing: ${pt(settings.paragraphSpacing * 0.72)},
  justify: true,
  first-line-indent: 0pt,
)
#set heading(numbering: "1.1", outlined: false)
#show heading.where(level: 1): it => block(
  sticky: true,
  above: 11pt,
  below: 6.5pt,
  inset: (bottom: 4pt),
  stroke: (bottom: 1.4pt + primary-color),
  text(size: ${Number((fontSizePt * headingScale * 1.18).toFixed(2))}pt, weight: "bold", fill: heading-color)[#it.body],
)
#show heading.where(level: 2): it => block(
  sticky: true,
  above: 9pt,
  below: 5.5pt,
  inset: (left: 7pt),
  stroke: (left: 3pt + primary-color),
  text(size: ${Number((fontSizePt * headingScale).toFixed(2))}pt, weight: "bold", fill: heading-color)[#it.body],
)
#show heading.where(level: 3): it => block(
  sticky: true,
  above: 7.5pt,
  below: 4.5pt,
  text(size: ${Number((fontSizePt * headingScale * 0.91).toFixed(2))}pt, weight: "bold", fill: heading-color)[#it.body],
)
#show heading.where(level: 4): it => block(
  sticky: true,
  above: 5.5pt,
  below: 4pt,
  text(weight: "bold", fill: heading-color)[#it.body],
)
#show math.equation: set block(above: 5.5pt, below: 6.5pt)
#show table.cell.where(y: 0): set text(weight: "bold")

#let studio-par(body) = block(
  width: 100%,
  below: ${pt(paragraphGap)},
  par()[#body],
)

#let studio-display-math(body, emphasis: false) = block(
  width: 100%,
  breakable: false,
  above: 5.5pt,
  below: 7pt,
  inset: (left: 1.15em, right: 0.4em),
  align(left)[
    #text(size: if emphasis { ${pt(emphasizedMathSize)} } else { ${pt(displayMathSize)} })[#body]
  ],
)

#let studio-final-display-math(body) = block(
  width: 100%,
  breakable: false,
  above: 6pt,
  below: 7pt,
  inset: (left: 1.15em, right: 0.4em),
  align(left)[#text(size: ${pt(emphasizedMathSize)})[#body]],
)

#let studio-conclusion(body) = block(
  width: 100%,
  above: 1.5pt,
  below: ${pt(paragraphGap)},
  text(weight: "medium")[#body],
)

#let studio-box(kind, variant, title, breakable: true, body) = {
  let accent = if variant == "caution" { rgb("#b35b16") }
    else if variant == "solution" { rgb("#596b78") }
    else if variant == "key-point" { rgb("#177257") }
    else if variant == "definition" { heading-color }
    else { primary-color }
  let fill-color = if variant == "caution" { rgb("#fff6e8") }
    else if variant == "solution" { rgb("#f4f6f7") }
    else if variant == "key-point" { rgb("#eef8f4") }
    else if variant == "definition" { secondary-color }
    else if variant == "summary" { secondary-color }
    else { white }
  let border-color = if variant == "solution" { rgb("#d4dce1") }
    else if variant == "caution" { rgb("#efd2ae") }
    else { secondary-color }
  let plain-box = variant == "explanation" or variant == "learning-goals"
  let box-stroke = if plain-box {
    (left: 3pt + accent)
  } else {
    (left: 3pt + accent, top: 0.7pt + border-color, right: 0.7pt + border-color, bottom: 0.7pt + border-color)
  }
  let title-size = if variant == "solution" or kind == "problem" { 1.04em } else { 1em }
  block(
    width: 100%,
    breakable: breakable,
    above: 6.5pt,
    below: 7.5pt,
    inset: (top: 7pt, right: 9pt, bottom: 7.5pt, left: 10pt),
    fill: fill-color,
    stroke: box-stroke,
    radius: 2.5pt,
    [
      #if variant == "solution" {
        block(
          sticky: true,
          below: 4pt,
          inset: (bottom: 3pt),
          stroke: (bottom: 0.5pt + border-color),
        )[#text(size: title-size, weight: "bold", fill: accent)[#title]]
      } else {
        block(sticky: true, below: 4.5pt)[#text(size: title-size, weight: "bold", fill: accent)[#title]]
      }
      #body
    ],
  )
}

#let studio-figure(body, width: 94%, caption: none) = align(center)[
  #block(
    width: width,
    breakable: false,
    above: 8pt,
    below: 8pt,
    [
      #align(center)[#body]
      #if caption != none { align(center)[#text(size: 8pt, fill: muted-color)[#caption]] }
    ],
  )
]
`;
}
