# 開発プロジェクトテンプレート 利用ガイド

## 概要

本テンプレートは、Claude Code を活用した GitHub Issue 起点の開発ワークフローを標準化するためのものです。
新規プロジェクト開始時にコピー配置して利用します。

## 利用手順

### 1. テンプレートのコピー

本ディレクトリ（`docs/template/`）配下のファイルをプロジェクトルートにコピーします。

```bash
# プロジェクトルートで実行
cp -r docs/template/CLAUDE.md .
cp -r docs/template/.claude .
cp -r docs/template/.github .
cp -r docs/template/docs/* docs/
```

> **注意**: 既存の `docs/` ディレクトリがある場合は、上書きに注意してください。

### 2. CLAUDE.md のカスタマイズ

`CLAUDE.md` 内のプレースホルダをプロジェクト固有の情報に置き換えます。

| プレースホルダ | 置き換え内容 |
|----------------|-------------|
| `{{PROJECT_NAME}}` | プロジェクト名 |
| `{{PROJECT_DESCRIPTION}}` | プロジェクトの一文概要 |
| `{{TECH_STACK}}` | 使用する技術スタック |
| `{{DOCKER_SERVICE}}` | Docker Compose のサービス名 |

### 3. settings.local.json の追加設定

テンプレートには汎用コマンドのみが含まれています。必要に応じて以下を追加してください。

- **プロジェクト固有パスを含むコマンド**: 例 `git -C /path/to/project status`
- **WebFetch のドメイン制限**: プロジェクトで参照する外部サービスのドメイン

### 4. GitHub Issue テンプレートの調整

`.github/ISSUE_TEMPLATE/bug_report.yml` の「発生環境」ドロップダウンの選択肢を、プロジェクトの環境に合わせて変更してください。

### 5. ドキュメントの作成

以下のドキュメントをプロジェクトに合わせて記入します（各ファイルにガイドコメントがあります）。

**要件定義段階**:
- `docs/requirements/` - 課題定義、仕様検討、要件定義

**アプリケーション仕様**:
- `docs/app/overview.md` - プロジェクト概要
- `docs/app/architecture.md` - アーキテクチャ
- `docs/app/database.md` - DB設計

**開発環境**:
- `docs/dev/setup.md` - 環境構築手順（Claude Code 向け・英語）
- `docs/dev/setup_user_guidance.md` - 環境構築ガイダンス（ユーザー向け・日本語）

## テンプレート構成

```
CLAUDE.md                           プロジェクトガイド（要カスタマイズ）
.claude/
  settings.local.json               Permission設定
  skills/
    design-doc/SKILL.md             設計書作成スキル
    implement/SKILL.md              実装スキル
    commit/SKILL.md                 コミットスキル
    review/SKILL.md                 レビュースキル
.github/
  ISSUE_TEMPLATE/
    bug_report.yml                  バグ報告テンプレート
    feature_request.yml             機能要望テンプレート
    config.yml                      ブランクIssue許可
  pull_request_template.md          PRテンプレート
docs/
  README.md                        ドキュメントインデックス
  requirements/                    要件定義
  app/
    overview.md                    プロジェクト概要
    architecture.md                アーキテクチャ
    database.md                    DB設計
    design/                        Issue別設計書
    spec/
      functional/                  機能仕様
      system/                      システム仕様
  dev/
    setup.md                       環境構築手順（Claude Code向け）
    setup_user_guidance.md         環境構築ガイダンス（ユーザー向け）
    workflow.md                    開発ワークフロー（Claude Code向け）
    workflow_user_guidance.md      開発操作ガイダンス（ユーザー向け）
```

## 言語ポリシー

| 対象読者 | 言語 | 対象ファイル |
|---------|------|-------------|
| Claude Code | 英語 | CLAUDE.md, skills/, workflow.md, setup.md, PR template |
| ユーザー（開発者） | 日本語 | Issue templates, docs/app/, docs/requirements/, user_guidance |
