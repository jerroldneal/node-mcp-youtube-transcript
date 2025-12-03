# Node.js YouTube Transcript MCP

This is a Node.js implementation of the YouTube Transcript MCP server, replicating the features of [jkawamoto/mcp-youtube-transcript](https://github.com/jkawamoto/mcp-youtube-transcript).

## Features

- `get_transcript`: Fetch plain text transcript.
- `get_timed_transcript`: Fetch transcript with timestamps.
- `get_video_info`: Fetch video metadata.

## Implementation Details

- **Transcript Fetching**: Uses **Puppeteer** (Headless Chrome) to scrape the transcript directly from the YouTube UI. This approach is used to bypass YouTube's aggressive rate limiting (HTTP 429) on standard API endpoints and `youtube-dl`.
- **Video Info**: Uses `youtube-dl-exec` (yt-dlp) for metadata.

## Prerequisites

- **Docker**: Recommended for running the server, as it includes the necessary Chromium dependencies.
- **Node.js 18+**: If running locally.
- **Chromium/Chrome**: If running locally, Puppeteer needs a browser instance.

## Usage

### Docker (Recommended)

1. Build the image:
   ```bash
   docker compose build
   ```

2. Run the server (Stdio):
   ```bash
   docker compose run --rm -i mcp-node-youtube
   ```

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the server:
   ```bash
   node index.js
   ```

3. Run the test client:
   ```bash
   node client.js
   ```

## Troubleshooting

- **Timeout Errors**: If the transcript takes too long to load, the Puppeteer timeout might need to be increased in `index.js`.
- **"Show transcript" not found**: Some videos do not have transcripts available, or the UI layout might vary by region/user agent.
