---
lesson_id: "figure-parity2-local"
title: "統計図表PDFのローカル回帰"
subject: "数学"
difficulty: "表示検証"
author: "ミライコーチング"
---

# 統計図表PDFのローカル回帰

## 関数の凡例

```figure function-graph
functions: y=x^2 | 放物線 | solid; y=x+1 | 直線 | dashed
x-range: -2, 3
y-range: -2, 9
legend: true
caption: 関数凡例
```

:::page-break
:::

## 樹形図の段階と結果

```figure tree-diagram
root: S | 開始
branches: S>H1 | 表 | 1/2; S>T1 | 裏 | 1/2; H1>HH | 表 | 1/2; H1>HT | 裏 | 1/2; T1>TH | 表 | 1/2; T1>TT | 裏 | 1/2
nodes: H1 | 1回目が表; T1 | 1回目が裏
results: HH | 表・表 | 1/4; HT | 表・裏 | 1/4; TH | 裏・表 | 1/4; TT | 裏・裏 | 1/4
stages: 開始; 1回目; 2回目
caption: 樹形図結果
```

:::page-break
:::

## 箱ひげ図の軸

```figure box-plot
series: A組 | 30, 45, 60, 72, 88 | 95; B組 | 35, 50, 63, 75, 90
range: 20, 100
tick-step: 10
axis-label: 得点
caption: 箱ひげ図の得点軸
```

:::page-break
:::

## 散布図の軸と傾向線

```figure scatter-plot
points: 1, 42, A; 2, 51, B; 3, 55, C; 4, 68, D
x-range: 0, 5
y-range: 30, 80
x-tick: 1
y-tick: 10
x-label: 学習時間
y-label: 得点
show-grid: true
trend-line: linear
trend-label: 右上がりの傾向
caption: 散布図の軸
```

:::page-break
:::

## 二項分布のパラメータ

```figure probability-distribution
distribution: binomial
n: 10
p: 0.4
x-tick: 2
x-label: 成功回数
shade: 3, 6
show-parameters: true
caption: 二項分布の軸
```

:::page-break
:::

## 正規分布のパラメータ

```figure probability-distribution
distribution: normal
mean: 50
sd: 10
x-range: 20, 80
x-tick: 10
x-label: 点数
shade: left, 40
show-parameters: true
caption: 正規分布の軸
```
