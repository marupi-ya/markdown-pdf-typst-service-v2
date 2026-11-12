---
lesson_id: "figure-parity-local"
title: "図表PDFのローカル回帰"
subject: "数学"
difficulty: "表示検証"
author: "ミライコーチング"
---

# 図表PDFのローカル回帰

## 三角形と直角

```figure triangle
vertices: A, 70, 205; B, 70, 55; C, 350, 205
right-angle: A
caption: Aの直角記号
```

:::page-break
:::

## 円と弧

```figure circle
center: O
radius: 80
points: A:20; B:120
arcs: A-B:minor:弧AB
caption: 弧ABの線とラベル
```

:::page-break
:::

## ベン図の数値

```figure venn-diagram
sets: A:集合A; B:集合B
regions: A-only | 12; A&B | 5; B-only | 8; outside | 3
caption: 領域の数値
```

:::page-break
:::

## 数直線の軸

```figure number-line
range: -2, 4
interval: 0, 3
endpoints: closed, open
tick-step: 1
caption: 軸と目盛り
```

:::page-break
:::

## 確率分布の塗り

```figure probability-distribution
distribution: normal
mean: 0
sd: 1
x-range: -3, 3
shade: -1, 1
x-label: z
caption: 正規分布の区間塗り
```
