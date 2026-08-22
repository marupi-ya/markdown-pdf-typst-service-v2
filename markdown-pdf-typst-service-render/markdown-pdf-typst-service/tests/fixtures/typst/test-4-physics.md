---
lesson_id: "typst-04"
title: "等加速度直線運動"
subject: "物理"
difficulty: "標準"
author: "Markdown教材PDF Studio"
---

# 等加速度直線運動

初速度を $v_0$、加速度を $a$、時間を $t$ とすると、速度と変位は次式で表されます。

$$
v=v_0+at
$$

$$
x=v_0t+\frac{1}{2}at^2
$$

| 物理量 | 記号 | SI単位 | 意味 |
|---|---|---|---|
| 変位 | $x$ | m | 基準点からの位置の変化 |
| 速度 | $v$ | m/s | 単位時間あたりの変位 |
| 加速度 | $a$ | m/s^2 | 単位時間あたりの速度変化 |
| 時間 | $t$ | s | 運動を観測した時間 |

```figure function-graph
functions: y = 2*x | v(t)=2t | solid
x-range: 0, 6
y-range: 0, 12
x-tick: 1
y-tick: 2
show-grid: true
points: 3,6,P,closed
caption: 加速度2 m/s²の速度−時間グラフ
```

:::exercise id="p001" title="問題"
静止していた物体が $2.0\,\mathrm{m/s^2}$ の一定加速度で $3.0\,\mathrm{s}$ 運動した。3.0秒後の速度と変位を求めなさい。
:::

:::solution for="p001" title="解答"
$v_0=0$ を用いると、速度は $v=0+2.0\times3.0=6.0\,\mathrm{m/s}$ です。また、変位は $x=0+\frac{1}{2}\times2.0\times3.0^2=9.0\,\mathrm{m}$ です。
:::

