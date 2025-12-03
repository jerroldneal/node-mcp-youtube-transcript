import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["index.js"],
});

const client = new Client(
  {
    name: "test-client",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

async function main() {
  await client.connect(transport);

  console.log("Connected to MCP server");

  const tools = await client.listTools();
  console.log("Available tools:", tools.tools.map((t) => t.name));

  // const url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"; // Me at the zoo
  const url = "https://www.youtube.com/watch?v=cZNEHbpvpZY"; // Me at the zoo

  console.log(`\nFetching video info for ${url}...`);
  const info = await client.callTool({
    name: "get_video_info",
    arguments: { url },
  });
  // console.log("Raw output:", info.content[0].text);
  console.log("Video Info:", JSON.parse(info.content[0].text).title);

  console.log(`\nFetching transcript for ${url}...`);

  const transcript = await client.callTool({
    name: "get_transcript",
    arguments: { url },
  });

  const data = JSON.parse(transcript.content[0].text);
  console.log("Full Transcript Length:", data.total_length);
  console.log("Transcript Preview:", data.transcript.slice(0, 200) + "...");

  console.log(`\nFetching timed transcript for ${url}...`);

  const timedTranscript = await client.callTool({
    name: "get_timed_transcript",
    arguments: { url },
  });

  const timedData = JSON.parse(timedTranscript.content[0].text);
  console.log("Total Timed Items:", timedData.total_items);

  // Enhance with non-enumerable getters (runtime only, won't bloat JSON)
  const enhancedTranscript = timedData.transcript.map(item => {
    const enhancedItem = { ...item };
    const baseUrl = timedData.url;

    Object.defineProperty(enhancedItem, 'url', {
      enumerable: false, // CRITICAL: This prevents JSON.stringify from saving the URLs
      get() {
        return {
          get start() { return `${baseUrl}&t=${Math.floor(item.start)}s`; },
          get end() { return `${baseUrl}&t=${Math.floor(item.start + item.duration)}s`; }
        };
      }
    });

    return enhancedItem;
  });

  if (enhancedTranscript.length > 0) {
    const first = enhancedTranscript[0];

    console.log("--- Runtime Access Check ---");
    console.log("Accessing .url.start works:", first.url.start);

    console.log("\n--- Persistence/JSON Check ---");
    const serialized = JSON.stringify(first, null, 2);
    console.log("JSON.stringify(item) excludes url:", serialized);

    console.log("\n--- Hydration Check ---");
    // Simulate loading from disk
    const loadedItem = JSON.parse(serialized);

    // Hydration function
    function hydrateItem(item, baseUrl) {
      Object.defineProperty(item, 'url', {
        enumerable: false,
        get() {
          return {
            get start() { return `${baseUrl}&t=${Math.floor(item.start)}s`; },
            get end() { return `${baseUrl}&t=${Math.floor(item.start + item.duration)}s`; }
          };
        }
      });
      return item;
    }

    const hydratedItem = hydrateItem(loadedItem, timedData.url);
    console.log("Hydrated item .url.start:", hydratedItem.url.start);
  }

  await client.close();
}

main().catch(console.error);
