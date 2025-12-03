#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import youtubedl from "youtube-dl-exec";
import puppeteer from "puppeteer";

const server = new Server(
  {
    name: "mcp-youtube-transcript",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper to paginate text
function paginateText(text, cursor, pageSize = 5000) {
  const start = cursor ? parseInt(cursor) : 0;
  if (isNaN(start)) {
    throw new Error("Invalid cursor");
  }

  const end = start + pageSize;
  const chunk = text.slice(start, end);
  const nextCursor = end < text.length ? end.toString() : null;

  return {
    text: chunk,
    next_cursor: nextCursor,
    total_length: text.length
  };
}

// Global browser instance
let globalBrowser = null;

async function getBrowser() {
  if (!globalBrowser) {
    globalBrowser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return globalBrowser;
}

// Helper to fetch transcript using Puppeteer (UI Scraping)
async function fetchTranscript(url, lang = "en") {
  console.error(`Launching browser for ${url}...`);
  const browser = await getBrowser();

  const page = await browser.newPage();
  try {
    // Set a real user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // 1. Expand description
    try {
      const expandButton = await page.$('#expand');
      if (expandButton) {
        await expandButton.click();
      }
    } catch (e) {
      // Ignore
    }

    // 2. Click "Show transcript"
    await new Promise(r => setTimeout(r, 2000));

    const showTranscriptClicked = await page.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const transcriptBtn = buttons.find(b => b.textContent.includes('Show transcript'));
      if (transcriptBtn) {
        transcriptBtn.click();
        return true;
      }
      return false;
    });

    if (!showTranscriptClicked) {
      throw new Error("Could not find 'Show transcript' button. Transcripts might be disabled for this video.");
    }

    // 3. Wait for transcript panel
    await page.waitForSelector('ytd-transcript-segment-renderer', { timeout: 10000 });

    // 4. Extract text
    const segments = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
      return els.map(el => {
        const timeStr = el.querySelector('.segment-timestamp')?.textContent?.trim() || "0:00";
        const text = el.querySelector('.segment-text')?.textContent?.trim() || "";

        // Parse time to seconds
        const parts = timeStr.split(':');
        let seconds = 0;
        if (parts.length === 3) {
          seconds += parseInt(parts[0]) * 3600;
          seconds += parseInt(parts[1]) * 60;
          seconds += parseFloat(parts[2]);
        } else if (parts.length === 2) {
          seconds += parseInt(parts[0]) * 60;
          seconds += parseFloat(parts[1]);
        }

        return {
          text,
          start: seconds,
          duration: 0 // Duration is hard to calculate without looking at next segment
        };
      });
    });

    // Calculate durations
    for (let i = 0; i < segments.length - 1; i++) {
      segments[i].duration = segments[i+1].start - segments[i].start;
    }

    return segments;

  } finally {
    await page.close();
  }
}

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  let seconds = 0;
  if (parts.length === 3) {
    seconds += parseInt(parts[0]) * 3600;
    seconds += parseInt(parts[1]) * 60;
    seconds += parseFloat(parts[2]);
  } else if (parts.length === 2) {
    seconds += parseInt(parts[0]) * 60;
    seconds += parseFloat(parts[1]);
  }
  return seconds;
}

// Helper to paginate array
function paginateArray(array, cursor, pageSize = 100) {
  const start = cursor ? parseInt(cursor) : 0;
  if (isNaN(start)) {
    throw new Error("Invalid cursor");
  }

  const end = start + pageSize;
  const chunk = array.slice(start, end);
  const nextCursor = end < array.length ? end.toString() : null;

  return {
    items: chunk,
    next_cursor: nextCursor,
    total_items: array.length
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_transcript",
        description: "Fetches the plain text transcript of a YouTube video.",
        inputSchema: zodToJsonSchema(
          z.object({
            url: z.string().describe("The full URL of the YouTube video"),
            lang: z.string().optional().describe("Language code (default: en)"),
          })
        ),
      },
      {
        name: "get_timed_transcript",
        description: "Fetches the transcript with timestamps.",
        inputSchema: zodToJsonSchema(
          z.object({
            url: z.string().describe("The full URL of the YouTube video"),
            lang: z.string().optional().describe("Language code (default: en)"),
          })
        ),
      },
      {
        name: "get_video_info",
        description: "Fetches metadata about the video.",
        inputSchema: zodToJsonSchema(
          z.object({
            url: z.string().describe("The full URL of the YouTube video"),
          })
        ),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_transcript") {
      const { url, lang = "en" } = args;

      const transcriptItems = await fetchTranscript(url, lang);
      const fullText = transcriptItems.map(item => item.text).join(" ");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              transcript: fullText,
              total_length: fullText.length
            }, null, 2),
          },
        ],
      };
    }

    if (name === "get_timed_transcript") {
      const { url, lang = "en" } = args;

      const transcriptItems = await fetchTranscript(url, lang);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              transcript: transcriptItems,
              total_items: transcriptItems.length,
              url: url
            }, null, 2),
          },
        ],
      };
    }

    if (name === "get_video_info") {
      const { url } = args;

      const info = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCallHome: true,
        noCheckCertificate: true,
        preferFreeFormats: true,
        youtubeSkipDashManifest: true,
      });

      const metadata = {
        title: info.title,
        description: info.description,
        lengthSeconds: info.duration,
        viewCount: info.view_count,
        author: info.uploader,
        publishDate: info.upload_date,
        keywords: info.tags,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(metadata, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Simple Zod to JSON Schema converter for this use case
function zodToJsonSchema(schema) {
  if (schema instanceof z.ZodObject) {
    const properties = {};
    const required = [];

    for (const [key, value] of Object.entries(schema.shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!value.isOptional()) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      required,
    };
  }

  if (schema instanceof z.ZodString) {
    const result = { type: "string" };
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema._def.innerType);
  }

  return { type: "string" }; // Fallback
}

const transport = new StdioServerTransport();
await server.connect(transport);
