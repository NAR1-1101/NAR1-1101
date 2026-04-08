# Core Pulse Idle (iPad向けインクリメンタルゲーム)

iPad向けに最適化したモバイルファーストの放置×タップゲームです。  
指だけで遊びやすいUI（大きなタップ領域 / 44px以上の操作要素）を採用し、横向き・縦向きの両方に対応しています。

## 実装スタック
- HTML
- CSS
- JavaScript（外部ライブラリなし）
- LocalStorage セーブ

## ファイル構成
- `index.html` : 画面構造（ステータス、コア、タブ、モーダル）
- `style.css` : iPad向けレスポンシブUI、ダークSFテーマ
- `script.js` : ゲームロジック（タップ、設備、強化、転生、イベント、実績、統計、オフライン報酬）

## 起動方法
```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開いてください（iPad Safari想定）。

## 主な機能
- タップで Energy 獲得
- 設備購入と自動生成（EPS）
- 購入数モード（x1 / x10 / x100 / MAX）
- 長押し連続購入
- 通常アップグレード
- 転生と Shard
- 恒久アップグレード
- オフライン報酬
- ランダムイベント
- 実績 / 統計
- 数値省略表記（K, M, B, T...）

## 補足
- セーブキーは `corePulseIdle.v1` を利用しています。
- バランス調整は `script.js` 冒頭の `BALANCE` / `BUILDINGS` / `UPGRADES` / `PERMANENT` を中心に変更できます。
