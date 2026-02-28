# 環境構築ガイダンス

## 前提条件

以下のソフトウェアがインストールされていることを確認してください。

| ソフトウェア | 用途 |
|-------------|------|
| Docker Desktop | コンテナ実行環境 |
| Git | バージョン管理 |
| GitHub CLI (`gh`) | GitHub 操作 |
| VS Code（推奨） | エディタ |
| Claude Code | AI 開発アシスタント |

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Docker 環境の起動

```bash
docker compose up -d
```

起動後、以下で状態を確認します。

```bash
docker compose ps
```

### 3. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、必要な値を設定します。

```bash
cp .env.example .env
```

<!-- 設定が必要な環境変数について説明を記述 -->

### 4. 初回セットアップ

Claude Code に以下のように指示してセットアップを実行できます。

```
docs/dev/setup.md に従って初回セットアップを実行してください
```

## 動作確認

<!-- アプリケーションへのアクセス方法を記述 -->

- アプリケーション: http://localhost:3000
- データベース管理: <!-- Prisma Studio 等のURL -->

## トラブルシューティング

### Docker コンテナが起動しない

```bash
# ログを確認
docker compose logs

# コンテナを再ビルド
docker compose build --no-cache
docker compose up -d
```

### ポートが競合する

他のアプリケーションが同じポートを使用していないか確認してください。

```bash
# 使用中のポートを確認
lsof -i :<port-number>
```

### npm install が失敗する

```bash
# node_modules を削除して再インストール
docker compose exec <service> rm -rf node_modules
docker compose exec <service> npm install
```
