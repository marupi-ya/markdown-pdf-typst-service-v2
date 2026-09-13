---
lesson_id: "C01"
title: "数学C 図表確認サンプル"
subject: "数学C"
difficulty: "L04 発展"
author: "ミライコーチング"
---

# 数学C 図表確認サンプル

:::explanation title="ベクトルの合成と重心"

$\vec{OA}=(4,0)$、$\vec{OB}=(0,3)$ とする。三角形OABの重心Gは、辺ABの中点Mを用いて求められる。

```figure vector-diagram
xRange: [-1, 5]
yRange: [-1, 4]
axes: true
grid: true
points:
  - id: O
    x: 0
    y: 0
  - id: A
    x: 4
    y: 0
  - id: B
    x: 0
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
vectors:
  - from: O
    to: A
    label: '\vec{OA}'
    labelOffset: [0, 38]
  - from: O
    to: B
    label: '\vec{OB}'
    labelOffset: [-50, 0]
  - from: O
    to: G
segments:
  - from: A
    to: B
  - from: O
    to: M
    dashed: true
```

:::

:::example title="複素数の回転と共役"

点Zを原点の周りに90度回転した点をR、Zの共役をCとする。

```figure complex-plane
xRange: [-3, 4]
yRange: [-3, 4]
grid: true
points:
  - id: O
    x: 0
    y: 0
  - id: Z
    x: 2
    y: 1
    label: z
constructions:
  - type: conjugate
    id: C
    point: Z
    label: '\bar{z}'
  - type: rotation
    id: R
    point: Z
    angle: 90
    label: "z'"
circles:
  - center: O
    radius: 2.2360679775
    dashed: true
vectors:
  - from: O
    to: Z
  - from: O
    to: R
segments:
  - from: Z
    to: C
    dashed: true
angleMarks:
  - vertex: O
    from: Z
    to: R
    label: '\theta'
```

:::

:::point title="円と半平面の共通部分"

塗りつぶしは3条件の共通部分である。$x=1$ は含まない境界である。

```figure region-plot
xRange: [-4, 5]
yRange: [-4, 5]
grid: true
boundaries:
  - type: circle
    center: [0, 0]
    radius: 3
  - type: line
    equation: x + y = 4
    label: x+y=4
    labelAt: [2, 2]
  - type: line
    equation: x = 1
    style: dashed
regions:
  - conditions: [x^2 + y^2 <= 9, x + y <= 4, x > 1]
    fill: hatch
```

:::

:::explanation title="立方体と断面"

立方体を斜めから見た模式図である。青い面は対角断面ACGEを表す。

```figure solid-geometry
type: cube
showHiddenEdges: true
sections:
  - points: [A, C, G, E]
highlightSegments:
  - [A, G]
```

:::

:::example title="媒介変数表示：サイクロイド"

$x=t-\sin t$、$y=1-\cos t$ の曲線である。

```figure parametric-curve
xRange: [-1, 7]
yRange: [-1, 3]
x: t - sin(t)
y: 1 - cos(t)
tRange: [0, 6.283185307]
grid: true
```

:::

:::explanation title="極方程式：三葉線"

$r=3\cos(3\theta)$ の概形である。角度はラジアンで指定する。

```figure polar-graph
xRange: [-4, 4]
yRange: [-4, 4]
r: 3*cos(3*theta)
thetaRange: [0, 6.283185307]
polarGrid: false
```

:::
