import puppeteer from 'puppeteer';

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
  console.log(`Navigating to ${url}...`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Try UI interaction approach
    console.log("Attempting to open transcript via UI...");
    
    // 1. Expand description
    try {
      const expandButton = await page.$('#expand');
      if (expandButton) {
        console.log("Clicking expand description...");
        await expandButton.click();
      }
    } catch (e) {
      console.log("Could not expand description (might be already expanded or different layout)");
    }
    
    // 2. Click "Show transcript"
    // It's usually a button in the description with specific text
    // We'll search for a button containing "Show transcript"
    await new Promise(r => setTimeout(r, 2000)); // Wait for UI
    
    const showTranscriptClicked = await page.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const transcriptBtn = buttons.find(b => b.textContent.includes('Show transcript'));
      if (transcriptBtn) {
        transcriptBtn.click();
        return true;
      }
      return false;
    });
    
    if (showTranscriptClicked) {
      console.log("Clicked 'Show transcript' button.");
      
      // 3. Wait for transcript panel
      console.log("Waiting for transcript panel...");
      await page.waitForSelector('ytd-transcript-segment-renderer', { timeout: 5000 });
      
      // 4. Extract text
      const segments = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
        return els.map(el => {
          const time = el.querySelector('.segment-timestamp')?.textContent?.trim();
          const text = el.querySelector('.segment-text')?.textContent?.trim();
          return { time, text };
        });
      });
      
      console.log(`Extracted ${segments.length} segments.`);
      console.log("Preview:", segments.slice(0, 3));
      return;
    } else {
      console.log("'Show transcript' button not found.");
    }

    // Fallback to previous method if UI fails
    // Extract ytInitialPlayerResponse
    const playerResponse = await page.evaluate(() => {
      return window.ytInitialPlayerResponse;
    });
    
    if (playerResponse && playerResponse.captions) {
      console.log("Captions found in player response!");
      const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
      console.log("Tracks:", tracks.map(t => `${t.name.simpleText} (${t.languageCode})`));
      
      // We can fetch the baseUrl from here
      const track = tracks.find(t => t.languageCode === 'en');
      if (track) {
        console.log("Fetching transcript from:", track.baseUrl);
        
        // Try fetching inside the page context to use browser cookies/headers
        const result = await page.evaluate(async (url) => {
          const response = await fetch(url);
          return {
            status: response.status,
            text: await response.text()
          };
        }, track.baseUrl);
        
        console.log("Status:", result.status);
        console.log("Content length:", result.text.length);
        console.log("Preview:", result.text.slice(0, 200));
      }
    } else {
      console.log("No captions in player response.");
    }
    
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await browser.close();
  }
}

run();
