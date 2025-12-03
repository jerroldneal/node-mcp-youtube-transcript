import youtubedl from "youtube-dl-exec";
import fs from "fs";

const url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

async function run() {
  console.log("Starting...");
  try {
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });

    console.log("Title:", output.title);
    // if (output.subtitles) console.log("Has Manual Subs");
    // if (output.automatic_captions) console.log("Has Auto Subs");
    const jsonSub = output.subtitles.en.find(s => s.ext === "json3");
    if (jsonSub) {
      console.log("Fetching JSON3 URL:", jsonSub.url);
      const res = await fetch(jsonSub.url);
      console.log("Status:", res.status);
      const text = await res.text();
      console.log("Content Preview:", text.slice(0, 100));
    }

  } catch (e) {
    console.error("Error:", e);
  }
}

run();
