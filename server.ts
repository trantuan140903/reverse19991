import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// In-memory cache
const profileCache = new Map<string, { data: any; timestamp: number }>();
const imageCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Helper to convert character name to URL slug
function toSlug(name: string): string {
  return String(name)
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

// 1. Get characters list
app.get('/api/characters', async (_req, res) => {
  try {
    const charsFilePath = path.join(__dirname, 'src', 'data', 'characters.json');
    if (fs.existsSync(charsFilePath)) {
      const data = JSON.parse(fs.readFileSync(charsFilePath, 'utf8'));
      res.json({ success: true, count: data.length, characters: data });
      return;
    }
    // Fallback if file doesn't exist
    res.json({ success: false, error: 'Character data not found' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get character garments and artwork from profile page
app.get('/api/character/:nameOrId', async (req, res) => {
  try {
    const param = req.params.nameOrId.trim();
    const charsFilePath = path.join(__dirname, 'src', 'data', 'characters.json');
    let charList: any[] = [];
    if (fs.existsSync(charsFilePath)) {
      charList = JSON.parse(fs.readFileSync(charsFilePath, 'utf8'));
    }

    // Match by ID or Name or slug
    const char = charList.find(c => {
      const cName = String(c.Name || '');
      const cId = String(c.ID || '');
      const p = param.toLowerCase();
      if (cId === param || cName.toLowerCase() === p || toSlug(cName) === toSlug(param)) {
        return true;
      }
      if (c.LocaleName && typeof c.LocaleName === 'object') {
        for (const val of Object.values(c.LocaleName)) {
          if (typeof val === 'string' && val.toLowerCase() === p) {
            return true;
          }
        }
      }
      if (c['Other Name']) {
        if (typeof c['Other Name'] === 'string' && c['Other Name'].toLowerCase() === p) return true;
        if (Array.isArray(c['Other Name']) && c['Other Name'].some((n: any) => String(n).toLowerCase() === p)) return true;
      }
      return false;
    });

    const slug = char ? toSlug(char.Name) : toSlug(param);
    const charId = char ? char.ID : null;

    // Check cache
    const cacheKey = slug;
    const cached = profileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.json({ success: true, ...cached.data, character: char || cached.data.character });
      return;
    }

    // Fetch from https://uttu.merui.net/profiles/<slug>
    const url = `https://uttu.merui.net/profiles/${slug}`;
    let garments: Array<{
      garmentId: string;
      kind: string;
      name: string;
      imageUrl: string;
      l2dUrl?: string;
      thumbUrl?: string;
      version?: string;
      category?: string;
      seriesId?: string;
      seriesName?: string;
    }> = [];

    let storyBgs: string[] = [];

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.ok) {
        const html = await response.text();

        // Extract garment buttons: data-garment-id=... data-kind=... <span class=truncate>...</span>
        const garmentRegex = /data-garment-id=([0-9]+)\s+data-kind=([a-z0-9_-]+)[^>]*>[\s\S]*?<span class=truncate>([^<]+)<\/span>/gi;
        let m;
        while ((m = garmentRegex.exec(html)) !== null) {
          const garmentId = m[1];
          const kind = m[2];
          const rawName = m[3].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
          garments.push({
            garmentId,
            kind,
            name: rawName,
            imageUrl: `https://assets.merui.net/headicon_img/${garmentId}.webp`,
            l2dUrl: `https://assets.merui.net/headicon_img_l2d/${garmentId}.webp`,
            thumbUrl: `https://assets.merui.net/headicon_small/${garmentId}.webp`
          });
        }

        // Extract story CGs and version backgrounds
        const storyBgMatches = [...html.matchAll(/https:\/\/images\.merui\.net\/storybg\/[^\s"'<>\)]+/gi)]
          .map(x => x[0].replace(/>.*$/, ''))
          .filter(u => !u.includes('smallbg'));
        storyBgs = Array.from(new Set(storyBgMatches));

        // If no garments found via buttons, check headicon_img in html
        if (garments.length === 0) {
          const headiconMatches = [...html.matchAll(/https:\/\/assets\.merui\.net\/headicon_img\/([0-9]+)\.webp/gi)].map(x => x[1]);
          const uniqueIds = Array.from(new Set(headiconMatches));
          uniqueIds.forEach((gid, idx) => {
            garments.push({
              garmentId: gid,
              kind: 'img',
              name: idx === 0 ? 'Default' : `Skin / Insight ${idx}`,
              imageUrl: `https://assets.merui.net/headicon_img/${gid}.webp`,
              l2dUrl: `https://assets.merui.net/headicon_img_l2d/${gid}.webp`,
              thumbUrl: `https://assets.merui.net/headicon_small/${gid}.webp`
            });
          });
        }
      }
    } catch (fetchErr) {
      console.warn('Could not fetch uttu live profile, falling back to ID pattern:', fetchErr);
    }

    // Default fallback if scraping returned empty or failed
    if (garments.length === 0 && charId) {
      const defaultId = `${String(charId).padStart(4, '0')}01`;
      const i2Id = `${String(charId).padStart(4, '0')}02`;
      garments.push({
        garmentId: defaultId,
        kind: 'img',
        name: 'Default',
        imageUrl: `https://assets.merui.net/headicon_img/${defaultId}.webp`,
        l2dUrl: `https://assets.merui.net/headicon_img_l2d/${defaultId}.webp`,
        thumbUrl: `https://assets.merui.net/headicon_small/${defaultId}.webp`
      });
      if (char && char.Rarity >= 4) {
        garments.push({
          garmentId: i2Id,
          kind: 'img',
          name: 'Insight II',
          imageUrl: `https://assets.merui.net/headicon_img/${i2Id}.webp`,
          l2dUrl: `https://assets.merui.net/headicon_img_l2d/${i2Id}.webp`,
          thumbUrl: `https://assets.merui.net/headicon_small/${i2Id}.webp`
        });
      }
    }

    // Enrich garments with release version and category from garments.json
    let garmentsDb: Record<string, any> = {};
    const garmentsDbPath = path.join(__dirname, 'src', 'data', 'garments.json');
    if (fs.existsSync(garmentsDbPath)) {
      try {
        garmentsDb = JSON.parse(fs.readFileSync(garmentsDbPath, 'utf8'));
      } catch (e) {
        console.warn('Could not read garments.json', e);
      }
    }

    // Attach release version and details to all scraped garments
    garments = garments.map(g => {
      const dbInfo = garmentsDb[g.garmentId];
      const gVer = dbInfo?.version || (g.name === 'Default' || g.name === 'Insight II' ? (char?.Version || '1.0') : (char?.Version || '1.0'));
      const gName = dbInfo?.name || g.name;
      const gCat = dbInfo?.category || (g.name === 'Default' ? 'default' : g.name.includes('Insight') ? 'insight' : 'skin');
      const seriesId = dbInfo?.seriesId || '';
      const seriesName = dbInfo?.seriesName || (gCat === 'default' ? 'Default Base' : gCat === 'insight' ? 'Insight II' : 'Series Garment');
      return {
        ...g,
        name: gName,
        version: gVer,
        category: gCat,
        seriesId,
        seriesName,
      };
    });

    // Also include any official skins for this character from garmentsDb if not in scraped list
    if (char && char.ID) {
      const charSkinsInDb = Object.values(garmentsDb).filter(
        (x: any) => x.charId === char.ID || (x.charName && x.charName.toLowerCase() === String(char.Name).toLowerCase())
      );
      for (const skin of charSkinsInDb) {
        if (!garments.some(g => String(g.garmentId) === String(skin.garmentId))) {
          garments.push({
            garmentId: skin.garmentId,
            kind: 'img',
            name: skin.name,
            version: skin.version,
            category: skin.category,
            seriesId: skin.seriesId || '',
            seriesName: skin.seriesName || 'Series Garment',
            imageUrl: `https://assets.merui.net/headicon_img/${skin.garmentId}.webp`,
            l2dUrl: `https://assets.merui.net/headicon_img_l2d/${skin.garmentId}.webp`,
            thumbUrl: `https://assets.merui.net/headicon_small/${skin.garmentId}.webp`
          });
        }
      }
    }

    const resultData = {
      slug,
      character: char || null,
      garments,
      storyBgs,
      profileUrl: `https://uttu.merui.net/profiles/${slug}`
    };

    profileCache.set(cacheKey, { data: resultData, timestamp: Date.now() });
    res.json({ success: true, ...resultData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Image proxy to bypass CORS for HTML5 canvas crop & export
app.get('/api/proxy-image', async (req, res) => {
  try {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      res.status(400).send('Missing url parameter');
      return;
    }

    // Security check: only allow merui.net domains
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.endsWith('merui.net')) {
      res.status(403).send('Forbidden hostname');
      return;
    }

    // Check image cache
    const cached = imageCache.get(rawUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached.buffer);
      return;
    }

    const imgRes = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!imgRes.ok) {
      res.status(imgRes.status).send(`Failed to load image: ${imgRes.statusText}`);
      return;
    }

    const arrayBuf = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const contentType = imgRes.headers.get('content-type') || 'image/webp';

    // Store in cache (limit cache size to 50 items to avoid RAM blowup)
    if (imageCache.size > 50) {
      const firstKey = imageCache.keys().next().value;
      if (firstKey) imageCache.delete(firstKey);
    }
    imageCache.set(rawUrl, { buffer, contentType, timestamp: Date.now() });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// 4. Vite middleware for dev or static serving for prod
async function setupServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
