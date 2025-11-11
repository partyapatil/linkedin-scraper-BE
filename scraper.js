import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";

puppeteer.use(StealthPlugin());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function scrapeLinkedInProfiles(searchQuery) {
  // Detect if running on Render (production) or local
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log(`🌍 Environment: ${isProduction ? 'Production (Render)' : 'Local'}`);
  
  const browser = await puppeteer.launch({
    headless: chromium.headless || "new",
    executablePath: isProduction ? await chromium.executablePath() : undefined,
    args: isProduction 
      ? [
          ...chromium.args,
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--single-process",
          "--no-zygote"
        ]
      : [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=1920,1080"
        ],
  });

  const page = await browser.newPage();

  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    const duckUrl = `https://duckduckgo.com/?q=site:linkedin.com/in/+${encodeURIComponent(searchQuery)}`;
    console.log("🔍 Searching DuckDuckGo:", duckUrl);

    await page.goto(duckUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(randomDelay(3000, 5000));

    await page.evaluate(() => {
      window.scrollBy(0, Math.random() * 500 + 300);
    });
    await sleep(randomDelay(1000, 2000));

    let profiles = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      document.querySelectorAll("a").forEach(a => {
        const href = a.href;
        if (href && href.includes("linkedin.com/in/") && !seen.has(href)) {
          const cleanUrl = href.split('?')[0].split('#')[0];
          
          if (!cleanUrl.includes('/search/') && !seen.has(cleanUrl)) {
            seen.add(cleanUrl);
            
            let name = a.innerText.trim();
            
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
          if (href && href.includes("linkedin.com/in/") && !seen.has(href)) {
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
    return profiles.slice(0, 20);
    
  } catch (error) {
    console.error("❌ Scraping error:", error.message);
    if (browser) {
      await browser.close();
    }
    return [];
  }
}
