# 数学C 図表記法ガイド

既存のコードフェンス `figure 型名` → StudioBlock → Typst AST → Figure Renderer → SVG → Typst の経路を使う。PDFプレビューとダウンロードは従来どおり同じPDFを利用する。残存するPage DOM経路は共通設定からReact SVGを描画する。旧図表の記法・PDFフロー・Archive連携は変更しない。

Studioの「サンプル」→「数学C｜ベクトル・複素数・領域・立体」から6種類の例を読み込める。全体例は [examples.md](examples.md) に収録した。

## 記法の共通ルール

- 三連バッククォートの直後は `figure vector-diagram` のように指定する。裸の `figure ...` 行だけでは既存Parserの図表ブロックにならない。
- 新規6種類のブロック内部はYAML風のキー・値、リスト、配列。インデントはスペース2文字を推奨する。先頭のインデントは揃える。タブ、アンカー、タグ、`{key: value}` 辞書、複数行スカラー、末尾コメントは非対応。コメントは独立した `# ...` 行に置く。
- 文字列の単一／二重引用符の中ではバックスラッシュをそのまま保持する。`label: '\vec{OA}'` と書ける。
- 旧図表の `x-range: -5, 5` などはそのまま使える。新規図表は `xRange: [-5, 5]`。相互に混ぜない。
- 点の参照は点名 `A` または座標 `[2, 3]`。pointsを先に解決し、続いてconstructions、最後に描画要素を処理する。
- 構成同士に依存がある場合、必ず `constructions` に生成順で並べる。構成名を最上位キーとして使う短縮形は、projection→midpoint→internalDivision→externalDivision→parallelThrough→perpendicularThrough→conjugate→rotation→perpendicularBisectorの固定順で処理する。
- `caption` は既存の図キャプション。ボックスの中でも同じコードフェンスを使う。図形は分割せず、既存のページネーションに任せる。

| キー | 意味・初期値 |
|---|---|
| xRange / yRange | 表示範囲。通常 [-5, 5]。solidは頂点に合わせた自動範囲 |
| axes | 座標軸。通常true、solidはfalse。solidでtrueなら投影した3軸 |
| grid | 補助格子。false |
| points | id, x, y, label（省略でid）, labelOffset |
| vectors / segments | from, to, label, labelOffset, dashed, style, arrow。vectorsは矢印が標準 |
| lines / rays | through: [A, B] または from/to。lineは直線、rayはAを始点としB方向に伸びる半直線 |
| polygons | points: [O, A, B], stroke: true, fill: false。塗る場合fill: true |
| circles | center, radius（正数）, dashed/style, label |
| ellipses | center, rx, ry（正数）, dashed/style, label |
| arcs | center, radius, startAngle, endAngle（度）。必要な円弧を直接指定 |
| angleMarks | vertex, from, to, label, radius。2辺間の小さい角。radiusは座標単位 |
| labelOffset | [横, 縦]、SVG上のピクセル。右・下が正。省略時は重なりを減らす候補位置を選ぶ |
| style / dashed | style: solid または dashed。dashed: trueも可 |

円の縦横比と角度を保つため等縮尺で描く。図は白地と濃い線を基本にし、既存のテーマ配色変換に対応する。ラベルは点・他ラベルとの簡易衝突回避を行うが、線との完全な重なり回避は保証しない。密集した図ではlabelOffsetと範囲を調整する。

## 構成・補助点

```figure vector-diagram
xRange: [-1, 9]
yRange: [-1, 5]
points:
  - id: O
    x: 0
    y: 0
  - id: A
    x: 4
    y: 0
  - id: B
    x: 1
    y: 3
constructions:
  - type: midpoint
    id: M
    from: A
    to: B
  - type: internalDivision
    id: G
    from: O
    to: M
    ratio: [2, 1]
  - type: externalDivision
    id: P
    from: O
    to: A
    ratio: [2, 1]
  - type: projection
    id: H
    point: B
    line: [O, A]
    guides: true
  - type: parallelThrough
    line: [O, A]
    through: B
  - type: perpendicularThrough
    line: [O, A]
    through: A
vectors:
  - from: O
    to: G
    label: '\vec{OG}'
segments:
  - from: A
    to: B
```

内分点は AP:PB=m:n、P=(nA+mB)/(m+n)。外分点はP=(mB−nA)/(m−n)、m,nは正、m≠n。projectionは無限直線への垂線の足である。平行・垂直・垂直二等分線は表示範囲で切り取った直線になる。

重心は中点と2:1の内分で構成できる。内心・外心・垂心については専用の自動計算はなく、求めた座標をpointsへ指定する。ベクトルの合成・成分分解・平行四辺形はvectors/segments/polygonsで表す。

## 複素数平面

```figure complex-plane
points:
  - id: A
    x: 2
    y: 1
    label: '\alpha'
constructions:
  - type: conjugate
    id: C
    point: A
    label: '\bar{z}'
  - type: rotation
    id: R
    point: A
    center: [0, 0]
    angle: 90
  - type: perpendicularBisector
    line: [A, C]
circles:
  - center: A
    radius: 2
rays:
  - from: [0, 0]
    to: A
```

conjugateは実軸に関する鏡映、rotationのangleは度、center省略時は原点。複素数積による拡大縮小は求めた座標をpointsへ指定する。`|z-a|=r` はcircles、`|z-a|=|z-b|` はperpendicularBisector、半平面はregionsへ実数座標の条件を指定する。偏角条件の軌跡は解いて得た円弧をarcsへ指定する。複素方程式からの自動軌跡推定は行わない。

## 領域・曲線

```figure region-plot
xRange: [-3, 4]
yRange: [-2, 6]
boundaries:
  - type: parabola
    equation: y = x^2
    xRange: [-2, 3]
  - type: line
    equation: y = x + 2
regions:
  - conditions: [y >= x^2, y <= x + 2]
    fill: hatch
```

- `regions` の全条件の共通部分を標準で1領域として塗る。`regionMode: overlay` のとき各regions項目を独立して重ねる。項目内のconditionsは常にAND。conditionには条件1つ、conditionsには配列を指定する。
- `fill: light` は淡色、`fill: hatch` は淡色＋斜線。
- boundariesを省略すると不等式から境界線を自動生成する。`<` / `>` は破線、`<=` / `>=` は実線。
- boundariesを明示した場合は指定した線だけを描く。含まない境界には `style: dashed` を明示する。
- boundariesのtypeはline/circle/ellipse/parabola/curve。circleはcenter/radiusでも書ける。他はequationを指定する。ellipseの例は `x^2/9 + y^2/4 = 1`。
- boundaryのlabelAt: [x,y]で式ラベルの基準位置を指定する。xRangeで曲線の一部を表示できる。
- 交点は数値座標をpointsに指定する。交点の自動求解・厳密な数式処理は未対応。

式では `x,y`、曲線では `t`、極方程式では `theta` を使う。四則演算、`^` / `**`、括弧、abs/sqrt/sin/cos/tan/exp/log、pi/eを扱う。乗算の省略は禁止（`2*x`）。絶対値は `abs(x)`。`|x|`、LaTeXのfrac、連鎖不等式、論理演算子は非対応。数式はJavaScriptとして実行しない。

領域・陰関数の境界は固定上限の数値近似であり、幅が極端に狭い領域、孤立点、接するだけの集合、特異点を含む式を完全再現するものではない。範囲を絞り、境界と重要点を明示する。曲線の不連続区間は別のcurves項目へ分割する。パラメータは数値を代入してから指定する。

## 空間図形

```figure solid-geometry
type: tetrahedron
showHiddenEdges: true
sections:
  - points: [A, B, D]
highlightSegments:
  - [C, D]
```

- type: cube/cuboid/tetrahedron/triangular-prism/custom。
- cube/cuboidはA〜H、tetrahedronはA〜D、triangular-prismはA〜Fが標準頂点名。labelsに座標を指定しても基本立体の頂点名を維持する。
- dimensions: [幅,奥行き,高さ]で各座標方向を伸縮できる。tetrahedronの初期値は正四面体。
- view: [方位角,仰角]（度、標準[35,25]）。基本立体は面の向きから隠れ線を判定する。
- showHiddenEdges: falseで隠れ線を省略。dashedSegmentsで追加の破線、highlightSegmentsで追加の線分。
- sectionsはpolygonsと同じ形式で頂点名を面の周囲順に並べる。断面の交点・頂点順は利用者が決める。交差する順序や立体外の断面は自動修正しない。
- customはlabels: の下に `P: [x,y,z]` を並べ、edges: に `- [P,Q]` を指定。任意立体の遮蔽判定は行わず、隠れ線はdashedSegmentsで明示する。
- 空間座標を2Dへ正射影した模式図。投影図の長さや角度は空間内の実測値を表さない。3Dエンジン、任意平面との自動切断、3D内分点の自動構成は未対応。

## 媒介変数・極座標

```figure parametric-curve
x: 3*cos(t)
y: 2*sin(t)
tRange: [0, 6.283185307]
```

```figure polar-graph
r: 2*(1+cos(theta))
thetaRange: [0, 6.283185307]
polarGrid: true
```

角度は式内ではラジアン。curves配列にx/y/tRangeまたはr/thetaRangeを持つ項目を並べると複数曲線を描ける。代表点・接線はpoints/linesで明示する。polarGridは極座標の円と放射線を描く（標準true）。接線自動微分は未対応。

## ラベルとエラー

ラベルは通常文字、ギリシャ文字、`\vec{OA}` / `\overrightarrow{OA}`、`\bar{z}` / `\overline{z}`、数字の上付き・下付きに対応。$で囲んでもよい。矢印と上線はSVG線で描く。複雑な分数や行列は本文の数式に置き、図内では短い記号を使う。未対応LaTeXはエラーとして表示する。

| エラー | 修正 |
|---|---|
| 点Qが未定義 | pointsへQを追加、または参照名を修正 |
| 外分比m≠n | [1,1]は外分点を定義できないため別の比にする |
| 半径は正の数 | radiusに0より大きい数を指定 |
| ponts: 未対応の項目 | pointsへ修正 |
| 2*x形式の乗算が必要 | 2x→2*x、x(y+1)→x*(y+1) |
| 表示範囲外 | xRange/yRangeを広げる |
| 数学C図表は生成サービスの更新待ち | 既存Typstサービスに同じ実装を反映し、healthのsupportedFiguresを確認 |

図表型、Markdownの行番号、項目パス、期待形式を返す。生成できない図を黙って落としてPDFを完成扱いにはしない。

## 教材生成AIへの指示

1. 新規6種類に限ってこのガイドを適用する。既存図表のキー名・記法は書き換えない。
2. 数学的条件を先に解き、点・交点・断面の順序を確定してから記法へ落とす。
3. 点名を重複させず、構成は生成順でconstructionsへまとめる。
4. 独立したfigureコードフェンスに入れ、説明・式・captionの役割を分ける。
5. 領域のANDはconditions、複数領域を別々に示すときだけregionMode: overlay。
6. 含む境界／含まない境界を実線／破線で区別する。
7. 複雑なラベルを避け、重要な式は本文に置く。密集時はlabelOffsetを指定する。
8. 全点が表示範囲に入ることを確認する。模式図・数値近似であることが解釈に影響する場合は本文で明示する。
9. 入試難度だけを理由に未対応のlocus、halfPlane等のキーを作らない。既存プリミティブへ分解する。
10. PDFの目視確認で矢印・隠れ線・塗る側・境界・ラベルを確認する。生成成功だけで数学的正しさを保証しない。
