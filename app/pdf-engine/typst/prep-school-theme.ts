import type { StudioSettings } from "../../theme-settings";

export function prepSchoolFigureSvg(svg: string, compact: boolean, bars: boolean) {
  let result = compact ? svg.replace(/font-size: 12px/g, "font-size: 22px").replace(/font-size: 11px/g, "font-size: 20px") : svg;
  if (bars) result = result.replace(/rx="3" fill="#[a-f0-9]{6}"/gi, 'rx="0" fill="#e4e9ed" stroke="#454545" stroke-width="1.5"');
  return result;
}

/** White, serif textbook with restrained rules; shares the existing semantic AST. */
export function renderPrepSchoolTheme(settings: StudioSettings) {
  const pt = (n: number) => `${Number(n.toFixed(2))}pt`;
  const mm = (n: number) => `${Number(n.toFixed(2))}mm`;
  const header = settings.showHeader ? `context block(width: 100%, inset: (bottom: 5pt), stroke: (bottom: 0.5pt + muted-color))[
    #grid(columns: (1fr, auto), text(size: 9pt)[#document-subject　基礎講義], text(size: 9pt)[#document-unit])
  ]` : "none";
  const footer = settings.showFooter ? `context grid(columns: (1fr, auto, 1fr),
    text(size: 7pt)[${settings.pageNumberPosition === "left" ? '#counter(page).display("1")' : '#document-copyright'}],
    [${settings.pageNumberPosition === "center" ? '#text(size: 8pt)[#counter(page).display("1")]' : ''}],
    align(right)[${settings.pageNumberPosition === "right" ? '#text(size: 8pt)[#counter(page).display("1")]' : settings.pageNumberPosition === "left" ? '#text(size: 7pt)[#document-copyright]' : ''}],
  )` : "none";
  return `#let primary-color = rgb("#52799b")
#let secondary-color = rgb("#e4e9ed")
#let body-color = rgb("#151515")
#let muted-color = rgb("#454545")
#let surface-color = white
#let heading-color = rgb("#173955")
#let serif-font = ("Noto Serif CJK JP", "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", "Noto Sans CJK JP", "DejaVu Serif")
#let sans-font = ("Noto Sans CJK JP", "Noto Sans Japanese", "Noto Sans JP", "Yu Gothic", "DejaVu Sans")
#set document(title: document-title, author: document-author)
#set page(paper: "a4", fill: white,
  margin: (top: ${mm(settings.marginTop)}, right: ${mm(settings.marginRight)}, bottom: ${mm(settings.marginBottom)}, left: ${mm(settings.marginLeft)}),
  header: ${header}, footer: ${footer}, numbering: "1",
)
#set text(font: serif-font, size: ${pt(settings.fontSize)}, fill: body-color, lang: "ja")
#set par(leading: ${Math.max(0.3, settings.lineHeight - 1).toFixed(2)}em, spacing: ${pt(settings.paragraphSpacing)}, justify: false)
#set heading(numbering: none, outlined: false)
#set list(spacing: 6pt)
#show list: set block(above: 6pt, below: 7pt)
#set enum(spacing: 6pt)
#show enum: set block(above: 6pt, below: 7pt)
#show heading.where(level: 1): it => block(sticky: true, above: 6pt, below: 14pt, inset: (bottom: 5pt))[
  #text(size: ${pt(settings.headingSize * 1.12)}, weight: "bold")[#it.body]
]
#show heading.where(level: 2): it => block(width: 100%, sticky: true, above: 13pt, below: 7pt, inset: (bottom: 4pt), stroke: (bottom: 0.55pt + primary-color))[
  #text(size: ${pt(settings.headingSize)}, weight: "bold")[#it.body]
]
#show heading.where(level: 3): it => block(sticky: true, above: 12pt, below: 7pt, inset: (top: 3pt, bottom: 3pt))[
  #text(font: sans-font, size: ${pt(settings.fontSize * 1.08)}, weight: "bold")[#it.body]
]
#show heading.where(level: 4): it => block(sticky: true, above: 6pt, below: 4pt)[#strong[#it.body]]
#show math.equation: set block(above: 4pt, below: 5pt)
#show table.cell.where(y: 0): set text(font: sans-font, weight: "bold")

#let studio-par(body) = block(width: 100%, above: 0pt, below: ${pt(Math.max(3, settings.paragraphSpacing * 0.6))}, inset: (top: 1.5pt, bottom: 1.5pt))[#par(body)]
#let studio-display-math(body, emphasis: false) = block(width: 100%, breakable: false, above: 6pt, below: 7pt, inset: (y: 2pt))[
  #align(center)[#text(size: if emphasis { ${pt(settings.fontSize * 1.18)} } else { ${pt(settings.fontSize * 1.12)} })[#body]]
]
#let studio-final-display-math(body) = studio-display-math(body)
#let studio-conclusion(body) = studio-par(body)

#let textbook-label(title, framed: false) = box(
  fill: secondary-color, stroke: if framed { 0.5pt + primary-color } else { none },
  inset: (x: 7pt, y: 4pt), radius: 0pt,
)[#text(font: sans-font, size: ${pt(settings.fontSize * 0.95)}, weight: "bold", fill: heading-color)[#title]]

// All callout titles sit above the body. A long title must never reserve a
// sidebar for an entire multi-paragraph derivation.
#let textbook-heading(title, label: false) = block(width: 100%, sticky: true,
  below: 7pt, inset: (bottom: 3pt))[
  #if label { textbook-label(title) } else {
    text(font: sans-font, weight: "bold", fill: heading-color)[#title]
  }
]

#let studio-box(kind, variant, title, breakable: true, body) = {
  let framed = variant == "definition" or variant == "example" or variant == "exercise" or variant == "answer-question"
  let goal = variant == "learning-goals"
  let ruled = variant == "key-point" or variant == "summary" or variant == "caution"
  if framed {
    block(width: 100%, breakable: breakable, above: 11pt, below: 12pt,
      stroke: 0.6pt + primary-color, radius: 0pt,
      inset: (x: 10pt, y: 9pt),
    )[
      #textbook-heading(title, label: true)
      #body
    ]
  } else if goal {
    block(width: 100%, breakable: breakable, above: 8pt, below: 13pt,
      inset: (x: 9pt, y: 7pt), stroke: (top: 0.5pt + primary-color, bottom: 0.5pt + primary-color),
    )[
      #textbook-heading(title, label: true)
      #body
    ]
  } else if ruled {
    block(width: 100%, breakable: breakable, above: 11pt, below: 12pt,
      inset: (top: 8pt, bottom: 7pt, left: 8pt, right: 8pt),
      stroke: (top: 0.5pt + primary-color, bottom: 0.5pt + primary-color),
    )[
      #textbook-heading(title, label: true)
      #body
    ]
  } else if variant == "solution" {
    block(width: 100%, breakable: breakable, above: 13pt, below: 13pt)[
      #block(width: 100%, sticky: true, below: 8pt, inset: (top: 3pt, bottom: 6pt), stroke: (bottom: 0.5pt + primary-color))[
        #text(font: sans-font, weight: "bold", fill: heading-color)[#title]
      ]
      #body
    ]
  } else {
    block(width: 100%, breakable: breakable, above: 12pt, below: 12pt)[
      #textbook-heading(title)
      #body
    ]
  }
}

#let textbook-figure-counter = counter("textbook-figure")
#let studio-figure(body, width: 94%, caption: none) = {
  textbook-figure-counter.step()
  align(center)[
    #block(width: width, breakable: false, above: 7pt, below: 7pt)[
      #align(center)[#body]
      #if caption != none {
        v(4pt)
        align(center)[
          #text(font: sans-font, size: 8pt, weight: "bold", fill: heading-color)[図 #context textbook-figure-counter.display("1")]
          #h(6pt)
          #text(size: 8pt)[#caption]
        ]
      }
    ]
  ]
}
`;
}
