# English

All five English types are registry content blocks and use the existing Markdown parser, StudioBlock, Typst AST, generator, themes and Official CLI. They never parse English grammar, infer a translation or call AI. See generated `syntax.md` and `/studio-spec.json` for minimal/standard/error examples and full nested schemas.

## Original and annotation data

`syntax-annotation` stores one `originalText` and an `annotations` array. Each annotation has a unique sentence-local id, start/end range, role, optional label, parent, relation, note and drawing style. Offsets count Unicode code points, start at zero and exclude end. The Unicode character 😀 counts as one. A parent must contain its child; parent cycles and missing relation IDs are errors. Decoration segments concatenate to the exact original string. No spell correction, whitespace normalization, reordered tokens or inferred roles are allowed.

Levels are selected by `levels.complete/questions/answers`; defaults are minimal/plain/detailed. Minimal displays underlines and S/V/O/C/M legends. Detailed adds overlines, bracket strokes, secondary-role legends and explicit parent/relation IDs. Overlapping annotations combine strokes while all exact ranges remain in the AST. A text legend quotes each target range and supplies role and relation labels instead of drawing unreliable long dependency arcs. Plain hides decoration while retaining target anchors. `originalText` in annotation/passage blocks is plain text; ordinary Markdown paragraphs and translation pairs still support bold, italic and inline math.

## Translation and long reading

`translation-pair.pairs` holds id, optional number, originalText, translation, vocabulary and note. Pairs flow one above the other. Short pairs stay together; long pairs break naturally, with no equal-height columns.

`reading-passage` has a passage id, paragraphs with paragraph IDs, and sentences with sentence IDs and optional annotations. Its enclosing Typst block is breakable. Sentence numbers are layout elements separate from originalText. Line numbers use the Official Typst `par.line` margin API, which marks numbers as PDF artifacts. They reset at passage start; no page-scope rule is changed. Exact print line numbers can change with font/page settings. Use semantic IDs for durable references. PDF readers vary in whether artifact numbers are included during plain text extraction; the source text remains native, selectable text.

For author-confirmed grammar ranges, opt in with `annotationPresentation: interlinear`. The default remains `legend`. `paragraphNumbers: false` and `sentenceNumbers: false` hide the generated headings and sentence numbers without changing the original text. The interlinear layout keeps each paragraph as flowing prose. It draws one continuous underline across a short phrase and centers one label below the whole range: `a book` can have a single `O1` label. The optional author `label` is printed as given, so `O1` and `O2` remain distinct; without it, the role supplies the label. Nested ranges use separate rows in parent-to-child order, with the outer line continuing beneath the inner range. Internal span IDs stay out of visible labels. Each source code point is emitted once. The author must set valid code-point offsets; Studio does not infer grammar. For example:

For a reading passage with nested analysis, `annotationPresentation: hierarchy` is an optional alternative. It preserves the same `start`, `end`, `parent`, `role`, and `label` input contract. Root ranges appear as a bracket and a single role label above the original text; nested ranges appear as continuous underlines and labels below it. A third or deeper level gets its own lower row. S, V, O, C, and other roles use restrained colors, while position, bracket endpoints, underline, and printed role labels keep the meaning visible in grayscale. Short phrases remain one measured unit; longer phrases split only at word boundaries with continuation ticks and one label at their first segment. The default and existing `interlinear` rendering are unchanged. The author should update any prose explaining the old below-only layout when selecting `hierarchy`.

For an underlines-first layout, opt in with `annotationPresentation: adaptive`. Ranges without contained annotations remain below the sentence, including ordinary S/V/O roles. Only a range containing another annotation moves to an upper bracket; multiple containing ancestors occupy separate upper rows, while the innermost range remains below. Equal-boundary containment requires an explicit `parent` chain, and ranges that merely touch at an endpoint do not count as overlapping. Placement is determined before word-boundary wrapping, so a long range keeps its side across lines or pages and prints its label only on the first segment. The same source text, offsets, IDs, roles, labels and fallback warnings are preserved. Color supplements the upper bracket, lower underline and printed role labels. The global default remains `legend`; existing `interlinear` and `hierarchy` outputs are unchanged. Authors selecting `adaptive` should update any prose describing the annotation placement and check the rendered PDF.

For an all-below layout, opt in with `annotationPresentation: stacked`. The innermost roles sit immediately below the source; each containing ancestor occupies a lower row. This matches the inner-above-outer arrangement without putting labels above the English. `annotationLabelSize` controls stacked labels in points (7–11, default 8.5) independently of body size. Long ranges wrap at word boundaries and keep one role label with continuation ticks; paragraphs still flow across pages. Existing four modes retain their rendering when functional groups are absent.

Every reading sentence can now provide `functionGroups`, using the same code-point ranges and validation as `syntax-annotation`: `noun` displays 〈…〉, `adjective` displays 〔…〕, and `adverb` displays (…) around author-supplied ranges. These are independent of S/V/O/C/M roles. No ranges or roles are inferred. Crossing/duplicate/out-of-range groups are rejected with the sentence path. All five annotated modes show groups; `plain` (including default question editions) hides both groups and roles. Original text and literal punctuation are retained.

In the editor, **英語の構造表示** opens a compact preview and controls for all five layouts, label size, and annotation counts. **全N件に適用** changes only the display keys of actual `reading-passage` fences. It preserves IDs, comments, annotations, other Markdown, and edition settings; one Undo restores the previous source. Invalid/incomplete blocks stop the entire edit. A sample can be inserted at the cursor without replacing selected text. Regenerate the PDF after changing the layout, and update explanatory prose manually if it describes an older placement.

```content reading-passage
id: example
annotationPresentation: interlinear
paragraphNumbers: false
sentenceNumbers: false
paragraphs:
  - id: p1
    sentences:
      - id: s1
        originalText: "The cook keeps the soup warm."
        annotations:
          - id: subject
            start: 0
            end: 8
            role: S
            style: underline
          - id: verb
            start: 9
            end: 14
            role: V
            style: underline
          - id: object
            start: 15
            end: 23
            role: O
            style: underline
          - id: complement
            start: 24
            end: 28
            role: C
            style: underline
```

The renderer measures the available passage width. A phrase that fits stays one unit; a longer range breaks at word boundaries, draws continuation ticks on the underline, and prints its label only at the first segment. Its single label is centered under the first segment, so a wrapped range has no global center label. A source token and its label stay together; the passage and paragraph can still flow across pages. Extremely narrow frames that cannot hold any measured segment show the unchanged source and a visible width warning with the author label/range. Crossing or ambiguous duplicate ranges, source line breaks, more than four nested levels, very long labels, and tokens longer than 28 code points switch to a warning and source-preserving legend. The visible legend states the reason and retains roles even in minimal mode. Any font substitution should be checked in the rendered PDF. Existing SVGs with individually fixed word x-coordinates are particularly sensitive to font substitution; use native text annotations or an outlined/approved raster asset for such diagrams.

Vocabulary targets use the complete tuple passageId/paragraphId/sentenceId/spanId as appropriate. The initial stable placements are paragraph-end and passage-end. Paragraph-end requires a paragraph target. `vocabulary-note` reuses the same target and vocabulary schemas for a separate list. Notes are authored, not inferred.

## References and output editions

`question-reference` resolves its target against the shared extension document index. Native PDF links point to metadata anchors. Repeated words and IDs in different passages do not collide. Missing or duplicate targets produce a QA warning and a visible unconfirmed-reference message, never a guessed link. Answer editions reuse the original referenced source block once, including when `includeQuestionInAnswer` is false. Markdown is not duplicated or rewritten. The same mechanism is available to image annotation extensions.

Set `showPage: true` to append the actual PDF page number of a resolved target. Set `showTargetLabel: false` to print only the author-facing `label` and page, while retaining the link. Both options default to the previous output (`false` and `true` respectively). For example, `label: 本文参照`, `showPage: true`, `showTargetLabel: false`, and a `target` with `passageId`/`paragraphId` prints `本文参照 (p. 2)` when the referenced paragraph is on page 2.

English composition reuses exercise/solution, headings and emphasis. No separate composition parser or content type is introduced.

## Regression scope and limits

`english-grammar.md` covers short sentences, SVO, SVOC, relatives, participles, infinitives, long modifiers, nested clauses, translation, vocabulary, composition and Japanese/English mixed punctuation/emphasis/math. `english-reading.md` covers multi-page flow, native line/sentence numbers, an underlined span and linked questions/solutions. Both run complete/questions/answers/split through the Official CLI, PDF text extraction, semantic metadata and tolerant image comparison.

Initial limits: 120 annotations per sentence, 100 paragraphs and 100 sentences per paragraph, 60,000 YAML source characters per extension inherited from math-C. Arbitrary grammar tree diagrams, curved dependency arcs, automatic coreference and inline passage footnote positioning are unsupported. Malformed extension configuration uses the existing visible-source local fallback; it never silently drops the source. No automatic grammar/translation repair is provided.

Official API references: https://typst.app/docs/reference/model/par/#definitions-line and https://typst.app/docs/reference/pdf/artifact/ .
