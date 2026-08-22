# Typst PDF Engine

`Markdown教材PDF Studio` の既存Legacy Engineと疎結合なPDF生成経路です。

```text
Markdown
  -> 既存Markdown Parser
  -> 教材AST
  -> Figure Renderer (SVG only)
  -> Typst Generator
  -> official Typst CLI
  -> PDF Blob
  -> browser PDF viewer / download
```

Typst EngineはPage DOM、DOM clone、html2canvas、Canvas、`getBoundingClientRect()`、Legacy Measure Engine、Legacy Pagination Engine、MathJaxのPDF描画を呼びません。PreviewとDownloadは同じPDF Blobを使用します。

## 実行構成

Studio本体はCloudflare Workers上で動くため、ネイティブプロセスを起動しません。公式Typst CLIを実行できるNode.js環境でコンパイラサービスを起動し、Studioのサーバー側プロキシからだけ接続します。

1. 公式Typst CLIをインストールする。
2. 日本語グリフを持つフォントをホストへインストールする。フォントファイルはこのリポジトリへ追加しない。
3. 必要なら環境変数を設定する。

```bash
export TYPST_BIN=/absolute/path/to/typst
export TYPST_FONT_PATHS=/absolute/path/to/japanese-font-directory
export TYPST_SERVICE_TOKEN=replace-with-a-long-random-token
export HOST=0.0.0.0
export PORT=8789
npm run typst:service
```

`TYPST_BIN`を省略した場合は、プロジェクトの`node_modules/.bin/typst`、続いて`PATH`上の`typst`を探します。npm配布バイナリは開発・CI用で、運用では公式配布のTypst CLIを推奨します。

Studio側には次を設定します。

```text
TYPST_SERVICE_URL=https://typst-compiler.example.com
TYPST_SERVICE_TOKEN=replace-with-the-same-token
```

外部入力から接続先URLを指定することはできません。HTTPSのみを許可し、localhostだけHTTPを許可します。サービス未設定、CLI不在、CLI起動失敗、日本語グリフ欠落はそれぞれ識別可能なエラーになります。

## 組版ポリシー

| ASTノード | keepTogether | keepWithNext | allowBreak | Typst表現 |
|---|---:|---:|---:|---|
| Heading | yes | yes | no | sticky heading |
| DisplayMath | yes | no | no | `block(breakable: false)` |
| Figure | yes | no | no | SVG + `block(breakable: false)` |
| 短いProblem | yes | no | no | 非breakable box |
| 長いProblem | no | no | yes | breakable box |
| 短いPoint / Example / Warning | yes | no | no | 非breakable box |
| Answer / Explanation | no | no | yes | breakable box、タイトルはsticky |
| Paragraph / List / Table | no | no | yes | Typst標準フロー |
| PageBreak | yes | no | no | `pagebreak()` |

短いブロックはDOM寸法ではなく、ASTの子ノード数と文字量だけで判定します。空白削減より内容保持を優先します。

## セキュリティ

- Markdownは必ず既存Parserと許可済み教材ASTを通す。
- 通常テキストは`text(JSON文字列)`として出力し、Typstコードとして連結しない。
- LaTeXは独立Adapterの許可リストを通し、未対応コマンドを元Markdown行付きで拒否する。
- 生成資産は`assets/figure-<line>-<type>.svg`だけを許可し、一時作業ディレクトリ外へのパスを拒否する。
- Mermaid SVGからscript、foreignObject、イベント属性、外部参照、DTDを除外する。
- Typstのrootをリクエストごとの一時ディレクトリへ固定する。
- リクエスト、SVG、応答PDFにサイズ上限を設ける。

## テスト

日本語フォントディレクトリを指定して実行します。

```bash
TYPST_FONT_PATHS=/path/to/fonts npm run test:typst
```

テストは6種類のPDFを`output/pdf/`へ生成し、さらに既存3サンプルとpagination stress教材をコンパイルします。`pdftotext`が利用可能な環境では本文抽出も必須とし、元教材の代表文がPDFに残ることを検証します。

## 初期版の制限

- LaTeX Adapterは高校教材で頻出する記法の許可リスト方式で、任意のLaTeXパッケージやマクロは扱わない。
- `image` figureは外部ラスタ画像を安全に取り込む仕様をまだ定義していないためTypst Engineでは拒否する。
- MermaidのPDF経路はブラウザでSVGを生成するが、ページや教材本文を画像化しない。
- コンパイラサービスに`pdftotext`がない場合、グリフ警告とPDF構造検証は行うが本文抽出検証は`unavailable`になる。

