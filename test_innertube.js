import { Innertube } from 'youtubei.js';

async function run() {
  console.log("Initializing InnerTube...");
  const youtube = await Innertube.create();

  const videoId = 'jNQXAC9IVRw'; // Me at the zoo

  console.log(`Fetching info for ${videoId}...`);
  try {
    const info = await youtube.getInfo(videoId);
    console.log("Title:", info.basic_info.title);

    console.log("Fetching transcript...");
    const transcriptData = await info.getTranscript();

    if (transcriptData && transcriptData.transcript) {
      console.log("Transcript found!");
      const lines = transcriptData.transcript.content.body.initial_segments.map(seg => seg.snippet.text);
      console.log("Preview:", lines.slice(0, 5).join(" "));
    } else {
      console.log("No transcript found.");
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

run();
