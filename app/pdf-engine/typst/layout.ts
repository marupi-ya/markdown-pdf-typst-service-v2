/** Typst measures actual math; no browser DOM or font-size guesses. */
export const COMMON_LAYOUT_HELPERS = String.raw`
#let studio-fit-math(body, wrapped: none, source-line: 0) = context layout(size => {
  let natural = measure(body)
  if natural.width <= size.width { body }
  else if wrapped != none and measure(wrapped).width <= size.width { wrapped }
  else {
    let ratio = size.width / natural.width
    if ratio >= 0.82 { scale(ratio * 100%, reflow: true, body) }
    else {
      metadata((studioWarning: "MATH_TOO_WIDE", sourceLine: source-line, page: here().page()))
      block(breakable: false)[
        #text(size: 9pt, fill: rgb("#9b352c"))[数式が表示幅を超えます。原稿で aligned 等による意味を保つ改行を指定してください。]
        #body
      ]
    }
  }
})
`;

/** Insert visual line breaks only before top-level +/= tokens. No token is
 * removed or reordered, and explicitly aligned/cases input remains authoritative. */
export function semanticMathLines(latex:string) {
  if (latex.length < 130 || /\\(?:begin|end|left|right)\b/u.test(latex)) return undefined;
  let depth=0, segment="", rows:string[]=[];
  for (let i=0;i<latex.length;i++) {
    const character=latex[i];
    const escaped=i>0 && latex[i-1]==="\\";
    if (!escaped && "{([".includes(character)) depth++;
    if (!escaped && "})]".includes(character)) depth--;
    if (!escaped && depth===0 && "+=".includes(character) && segment.length>=55) { rows.push(segment);segment=""; }
    segment+=character;
  }
  if (depth!==0 || !rows.length || rows.length>12) return undefined;
  rows.push(segment);
  return rows;
}
