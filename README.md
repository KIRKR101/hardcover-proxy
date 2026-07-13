# hardcover-proxy

A Cloudflare Worker that proxies the Hardcover GraphQL API, returning books you're currently reading (with progress) and books you've previously read, with rich metadata.

## Features

- **Currently Reading**: Books in progress with page/percentage progress tracking
- **Previously Read**: Completed books with reading dates and ratings
- **Rich Metadata**: Cover images, authors, series, descriptions, ratings, ISBNs, publishers
- **CORS Enabled**: Accessible from browser-based applications
- **Cached**: 2-hour cache via Cloudflare's edge network
- **JSON Response**: Structured JSON for easy consumption

## Setup

### 1. Get your Hardcover API token

1. Go to [Hardcover API settings](https://hardcover.app/account/api)
2. Copy your API token

### 2. Configure the worker

Set your Hardcover API token as a Cloudflare Worker secret:

```bash
npx wrangler secret put HARDCOVER_API_KEY
# Paste your token when prompted
```

### 3. Deploy

```bash
npm install
npm run deploy
```

Your proxy will be available at: `https://hardcover-proxy.<your-subdomain>.workers.dev/`

## Usage

### Endpoint

**`GET /`** - Returns all books

### Response Format

```json
{
  "user": {
    "id": 123,
    "username": "your_username"
  },
  "currently_reading": [
    {
      "book": {
        "id": 456,
        "title": "Book Title",
        "subtitle": "Optional Subtitle",
        "description": "Book description...",
        "pages": 350,
        "release_date": "2024-01-15",
        "release_year": 2024,
        "rating": 4.2,
        "ratings_count": 1500,
        "slug": "book-title",
        "cover_url": "https://...",
        "authors": ["Author Name"],
        "series": ["Series Name"]
      },
      "user_book": {
        "status": "currently_reading",
        "rating": null,
        "date_added": "2024-03-01",
        "started_reading": "2024-03-10",
        "read_count": 1,
        "owned": true,
        "starred": false,
        "review": null
      },
      "progress": {
        "pages_read": 150,
        "total_pages": 350,
        "percentage": 43
      }
    }
  ],
  "previously_read": [
    {
      "book": {
        "id": 789,
        "title": "Another Book",
        "subtitle": null,
        "description": "Another description...",
        "pages": 280,
        "release_date": "2023-06-20",
        "release_year": 2023,
        "rating": 4.5,
        "ratings_count": 2300,
        "slug": "another-book",
        "cover_url": "https://...",
        "authors": ["Another Author"],
        "series": []
      },
      "user_book": {
        "status": "previously_read",
        "rating": 4.5,
        "date_added": "2023-07-01",
        "first_read_date": "2023-07-15",
        "last_read_date": "2023-07-15",
        "read_count": 1,
        "owned": false,
        "starred": true,
        "review": "Great book!"
      }
    }
  ]
}
```

## Development

### Local development

```bash
npm run dev
```

This starts a local development server. You'll need to set the secret for local development:

```bash
npx wrangler dev --local --persist
```

### Type checking

```bash
npx tsc --noEmit
```

## API Limits

- Hardcover API is rate-limited to 60 requests per minute
- This proxy caches responses for 2 hours to minimize API calls
- Maximum 100 books returned per category (currently reading, previously read)

## Architecture

Mirrors the [letterboxd-proxy](https://github.com/KIRKR101/letterboxd-proxy) pattern:

- Single Cloudflare Worker (`src/worker.ts`)
- TypeScript with strict type checking
- Cloudflare Cache API for response caching
- CORS headers for cross-origin access
- No runtime dependencies

## License

ISC
