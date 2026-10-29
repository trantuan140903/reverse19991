import fs from 'fs';

async function run() {
  const res = await fetch("https://uttu.merui.net/garments/");
  const html = await res.text();

  // 1. Extract series ID -> Name
  const seriesMap = {};
  const seriesRegex = /data-filter-option=series\s+value=([^\s>]+)\s+data-locale-name="([^"]+)"/g;
  let sm;
  while ((sm = seriesRegex.exec(html)) !== null) {
    const id = sm[1];
    const rawLocale = sm[2].replace(/&quot;/g, '"');
    try {
      const parsed = JSON.parse(rawLocale);
      seriesMap[id] = parsed.en || parsed.zh || id;
    } catch {
      seriesMap[id] = rawLocale;
    }
  }
  console.log("Found series in dropdown:", Object.keys(seriesMap).length);

  // 2. Locate const R=[
  const startMarker = "const R=[";
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) {
    console.error("Could not find start marker");
    return;
  }

  // Count brackets to find the end of array
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let endIdx = -1;
  const contentStart = startIdx + startMarker.length - 1; // pointing to '['

  for (let i = contentStart; i < html.length; i++) {
    const char = html[i];
    const prevChar = i > 0 ? html[i - 1] : '';

    if (inString) {
      if (char === stringChar && prevChar !== '\\') {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '[') {
      depth++;
    } else if (char === ']') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx === -1) {
    console.error("Could not find matching closing bracket");
    return;
  }

  const arrayCode = html.slice(contentStart, endIdx + 1);
  console.log("Extracted array code length:", arrayCode.length);

  // Safely evaluate array code
  const fn = new Function(`return ${arrayCode};`);
  const R = fn();
  console.log("Successfully parsed R items:", R.length);

  // Read existing garments.json
  const garmentsPath = "./src/data/garments.json";
  let garments = {};
  if (fs.existsSync(garmentsPath)) {
    garments = JSON.parse(fs.readFileSync(garmentsPath, "utf8"));
  }

  let updatedCount = 0;
  for (const item of R) {
    const g = item.garment;
    if (!g || !g.id) continue;
    const gid = String(g.id);
    const seriesID = g.seriesID ? String(g.seriesID) : "";
    const seriesName = seriesID && seriesMap[seriesID] ? seriesMap[seriesID] : (g.category === 'default' ? 'Default Base' : g.category === 'insight' ? 'Insight II' : '');

    const gName = typeof g.name === "object" ? (g.name.en || g.name.zh || "Default") : String(g.name || "Default");

    if (!garments[gid]) {
      garments[gid] = {
        garmentId: gid,
        name: gName,
        category: g.category || "default",
        version: String(g.version || item.version || "1.0"),
        charId: item.profile ? item.profile.ID : 0,
        charName: item.profile ? item.profile.Name : "",
        charVersion: item.profile ? item.profile.Version : "1.0",
        seriesId: seriesID,
        seriesName: seriesName,
      };
      updatedCount++;
    } else {
      garments[gid].seriesId = seriesID;
      garments[gid].seriesName = seriesName;
      if (gName && gName !== "Default" && (garments[gid].name === "Default" || garments[gid].name.startsWith("Skin #"))) {
        garments[gid].name = gName;
      }
      updatedCount++;
    }
  }

  fs.writeFileSync(garmentsPath, JSON.stringify(garments, null, 2), "utf8");
  fs.writeFileSync("./src/data/series.json", JSON.stringify(seriesMap, null, 2), "utf8");
  console.log(`Updated ${updatedCount} garments with Series data into garments.json!`);
}

run();
