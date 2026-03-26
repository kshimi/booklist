# Gemini API Setup

This guide explains how to obtain a Gemini API key and configure it for generating AI recommendation comments (`scripts/generate-ai-comments.js`).

> **Scope**: The API key is used only by Node.js scripts. It is never exposed to the browser.

---

## 1. Obtain a Gemini API Key

1. Open [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click **Get API key** in the left sidebar
4. Click **Create API key**
5. Select an existing Google Cloud project or create a new one
6. Copy the generated API key

> The free tier is sufficient for this project. No billing setup is required.

---

## 2. Configure the API Key

Add the key to `.env` in the project root:

```
GEMINI_API_KEY=your_api_key_here
```

`.env` is listed in `.gitignore` and will not be committed to the repository.

---

## 3. Install the SDK

```bash
npm install @google/generative-ai
```

---

## 4. Verify the Setup

Run a small test to confirm the key is working:

```bash
node scripts/generate-ai-comments.js --days 7
```

Expected output (example):

```
処理開始: 対象書籍 7件
[1/7] 「タイトル」（著者名）... 完了
...
保存済み: 7件 → data/book-ai-comments.json
```

If you see a `400 API_KEY_INVALID` error, double-check the key value in `.env`.

---

## 5. Free Tier Limits

The script uses `gemini-1.5-flash`, which has the following free tier limits (as of early 2026):

| Limit | Value |
|-------|-------|
| Requests per minute (RPM) | 15 |
| Requests per day (RPD) | 1,500 |
| Tokens per minute (TPM) | 1,000,000 |

When the daily quota is reached, the script receives a `429` response and stops automatically, saving all comments generated up to that point.

To generate comments for all books (~882 books), run the script across multiple days:

```bash
# Day 1: generate up to the daily limit
node scripts/generate-ai-comments.js

# Day 2: resume (already-generated books are skipped automatically)
node scripts/generate-ai-comments.js
```

---

## 6. Recommended Usage

Generate comments for upcoming daily suggestions first, then fill in the rest:

```bash
# Generate comments for the next 30 days' featured books
node scripts/generate-ai-comments.js --days 30

# Gradually fill in remaining books
node scripts/generate-ai-comments.js
```

---

## Troubleshooting

| Error | Cause | Resolution |
|-------|-------|------------|
| `400 API_KEY_INVALID` | Incorrect or missing API key | Check `GEMINI_API_KEY` in `.env` |
| `429 Resource has been exhausted` | Free tier quota reached | Wait until the next day and re-run |
| `GEMINI_API_KEY is not set` | Environment variable not loaded | Ensure `.env` exists in the project root |
