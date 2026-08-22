---
lesson_id: "typst-03"
title: "二次関数と平方完成"
subject: "数学"
difficulty: "標準"
author: "Markdown教材PDF Studio"
---

# 二次関数と平方完成

二次関数 $y=ax^2+bx+c$ のグラフは放物線です。係数 $a$ の符号で開く向きが決まり、平方完成によって軸と頂点を読み取れます。

$$
y=a\left(x+\frac{b}{2a}\right)^2-\frac{b^2-4ac}{4a}
$$

:::key-point title="平方完成の要点"
係数 $a$ を先にくくり、$x$ の一次の係数の半分を使って完全平方を作ります。独立数式はページの途中で分割しません。
:::

:::exercise id="m001" title="問題1"
$y=2x^2-8x+3$ の軸と頂点を求めなさい。
:::

:::solution for="m001" title="解答1"
平方完成すると次のようになります。

$$
\begin{aligned}
y &= 2x^2-8x+3 \\
  &= 2\left(x^2-4x\right)+3 \\
  &= 2\left(x-2\right)^2-5
\end{aligned}
$$

したがって、軸は $x=2$、頂点は $(2,-5)$ です。
:::

```figure function-graph
functions: y = 2x^2 - 8x + 3 | y=2x^2-8x+3 | solid
x-range: -1, 5
y-range: -6, 12
x-tick: 1
y-tick: 2
show-grid: true
points: 2,-5,P,closed
caption: y=2x^2-8x+3のグラフ
```

## 判別式との関係

方程式 $ax^2+bx+c=0$ の判別式を $D=b^2-4ac$ とすると、放物線と $x$ 軸の共有点の個数は $D$ の符号で決まります。

$$
D>0\Rightarrow 2\text{個},\qquad D=0\Rightarrow 1\text{個},\qquad D<0\Rightarrow 0\text{個}
$$

