# Development Environment Setup

## Prerequisites

- Node.js (LTS) installed locally
- Git configured
- GitHub CLI (`gh`) authenticated
- Google Drive access (required to open PDF links in the app)

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd booklist
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Prepare Input Data

Place the CSV exported from Google Apps Script at:

```
data/booklist.csv
```

The CSV must contain the following columns:
`フォルダパス`, `ファイル名`, `ファイルサイズ(MB)`, `MIMEタイプ`, `作成日`, `最終更新日`, `ファイルURL`, `ファイルID`

### 4. Generate Book Catalog

Run the data processing pipeline to generate `data/books.json`:

```bash
node scripts/process.js
```

Expected output: `data/books.json` with ~819 records.

### 5. Environment Variables (Optional)

A Google Books API key improves fallback lookup for books not found in OpenBD.
Create `.env` in the project root if needed:

```
VITE_GOOGLE_BOOKS_API_KEY=your_api_key_here
```

> The app works without an API key (unauthenticated requests are rate-limited but functional).

## Verification

```bash
# Start development server
npm run dev

# Run tests
npm test
```

Open `http://localhost:5173` (or the port shown in terminal) and confirm the book list loads.

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run tests |
| `npm run lint` | Run linter |
| `node scripts/process.js` | Regenerate `data/books.json` from `data/booklist.csv` |
