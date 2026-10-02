const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

async function renderIcons() {
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const scene = source.match(/<svg class="cat-scene"[\s\S]*?<\/svg>/)?.[0];
  if (!scene) throw new Error("Original Mochi SVG not found.");
  fs.mkdirSync(path.join(root, "icons"), { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const [name, size, scale] of [
      ["cat-192.png", 192, 0.9],
      ["cat-512.png", 512, 0.9],
      // Even the square bounding box fits inside the 80%-diameter safe circle.
      ["cat-maskable-512.png", 512, 0.5625]
    ]) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(`<style>
        html,body { margin:0; width:100%; height:100%; background:#eee8f5; }
        body { display:grid; place-items:center; }
        svg { width:${size * scale}px; height:${size * scale}px; }
      </style>${scene}`);
      await page.screenshot({ path: path.join(root, "icons", name), omitBackground: false });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

renderIcons().catch((error) => { console.error(error); process.exitCode = 1; });
