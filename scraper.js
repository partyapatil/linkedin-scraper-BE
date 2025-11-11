import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function scrapeLinkedInProfiles(searchQuery) {
  const browser = await puppeteer.launch({
    headless: "new",
    // Add these args for Render deployment
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--window-size=1920,1080",
      "--single-process",
      "--no-zygote",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ],
  });

  const page = await browser.newPage();

  try {
    // Block unnecessary resources to speed up scraping
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Set realistic viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set additional headers to appear more legitimate
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    // Try DuckDuckGo first (more lenient than Google)
    const duckUrl = `https://duckduckgo.com/?q=site:linkedin.com/in/+${encodeURIComponent(searchQuery)}`;
    console.log("🔍 Searching DuckDuckGo:", duckUrl);

    await page.goto(duckUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(randomDelay(3000, 5000));

    // Simulate human-like scrolling behavior
    await page.evaluate(() => {
      window.scrollBy(0, Math.random() * 500 + 300);
    });
    await sleep(randomDelay(1000, 2000));

    let profiles = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      document.querySelectorAll("a").forEach(a => {
        const href = a.href;
        if (href.includes("linkedin.com/in/") && !seen.has(href)) {
          // Extract clean LinkedIn URL
          const cleanUrl = href.split('?')[0].split('#')[0];
          
          if (!cleanUrl.includes('/search/') && !seen.has(cleanUrl)) {
            seen.add(cleanUrl);
            
            // Try to extract name from text
            let name = a.innerText.trim();
            
            // If name is too long or contains irrelevant text, extract from URL
            if (!name || name.length > 50 || name.includes('...')) {
              const urlParts = cleanUrl.split('/');
              name = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
              name = name.replace(/-/g, ' ')
                         .split(' ')
                         .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                         .join(' ');
            }
            
            results.push({
              name: name || "LinkedIn User",
              title: "LinkedIn Profile",
              location: "Not specified",
              url: cleanUrl
            });
          }
        }
      });
      
      return results;
    });

    console.log("✅ DuckDuckGo profiles found:", profiles.length);

    // Fallback to Bing if DuckDuckGo returns nothing
    if (profiles.length === 0) {
      console.log("🌐 Trying Bing as fallback...");
      
      const bingUrl = `https://www.bing.com/search?q=site:linkedin.com/in/+${encodeURIComponent(searchQuery)}`;
      await page.goto(bingUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(randomDelay(3000, 5000));

      await page.evaluate(() => {
        window.scrollBy(0, Math.random() * 500 + 300);
      });
      await sleep(randomDelay(1000, 2000));

      profiles = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        
        document.querySelectorAll("a").forEach(a => {
          const href = a.href;
          if (href.includes("linkedin.com/in/") && !seen.has(href)) {
            const cleanUrl = href.split('?')[0].split('#')[0];
            
            if (!cleanUrl.includes('/search/') && !seen.has(cleanUrl)) {
              seen.add(cleanUrl);
              
              let name = a.innerText.trim();
              if (!name || name.length > 50) {
                const urlParts = cleanUrl.split('/');
                name = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
                name = name.replace(/-/g, ' ')
                           .split(' ')
                           .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                           .join(' ');
              }
              
              results.push({
                name: name || "LinkedIn User",
                title: "LinkedIn Profile",
                location: "Not specified",
                url: cleanUrl
              });
            }
          }
        });
        
        return results;
      });

      console.log("✅ Bing profiles found:", profiles.length);
    }

    await browser.close();
    return profiles.slice(0, 20); // Limit to top 20 results
    
  } catch (error) {
    console.error("❌ Scraping error:", error.message);
    await browser.close();
    return [];
  }
}
