import fs from 'fs';

async function main() {
  console.log('Fetching https://uttu.merui.net/garments ...');
  const res = await fetch('https://uttu.merui.net/garments');
  const html = await res.text();
  
  const startKeyword = '[{profile:{ID:';
  const startIdx = html.indexOf(startKeyword);
  if (startIdx === -1) {
    console.error('Could not find start of garments array');
    process.exit(1);
  }

  // Bracket counting to find exact closing ]
  let bracketDepth = 0;
  let inString = false;
  let stringChar = '';
  let isEscaped = false;
  let endIdx = -1;

  for (let i = startIdx; i < html.length; i++) {
    const char = html[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === stringChar) {
        inString = false;
      }
    } else {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
      } else if (char === '[') {
        bracketDepth++;
      } else if (char === ']') {
        bracketDepth--;
        if (bracketDepth === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (endIdx === -1) {
    console.error('Could not find matching closing bracket');
    process.exit(1);
  }

  const arrayStr = html.slice(startIdx, endIdx + 1);
  console.log('Extracted array string length:', arrayStr.length);
  
  // Safe evaluation
  const items = new Function(`return ${arrayStr}`)();
  console.log(`Evaluated ${items.length} items from UTTU`);
  
  const garmentMap: Record<string, {
    garmentId: string;
    name: string;
    category: string;
    version: string;
    charId: number;
    charName: string;
    charVersion: string;
  }> = {};
  
  for (const item of items) {
    if (!item.garment || !item.garment.id) continue;
    const gid = String(item.garment.id);
    const gName = item.garment.name
      ? (item.garment.name.en || item.garment.name.zh || Object.values(item.garment.name)[0] || 'Skin')
      : 'Skin';
      
    // Garment version: if the garment itself was released in a specific version (e.g. 2.4, 3.2, 1.4), use that!
    let gVer = '';
    if (item.version !== undefined && item.version !== null && item.version !== '') {
      gVer = String(item.version);
    } else if (item.garment.version !== undefined && item.garment.version !== null) {
      gVer = String(item.garment.version);
    } else if (item.profile?.Version) {
      gVer = String(item.profile.Version);
    } else {
      gVer = '1.0';
    }
    
    // Normalize format like "2" -> "2.0", "3" -> "3.0"
    if (/^[0-9]+$/.test(gVer)) {
      gVer = `${gVer}.0`;
    }
    
    garmentMap[gid] = {
      garmentId: gid,
      name: String(gName),
      category: item.garment.category || 'skin',
      version: gVer,
      charId: item.profile?.ID,
      charName: String(item.profile?.Name || ''),
      charVersion: item.profile?.Version || '1.0',
    };
  }
  
  fs.writeFileSync('src/data/garments.json', JSON.stringify(garmentMap, null, 2));
  console.log(`Saved src/data/garments.json with ${Object.keys(garmentMap).length} garments.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
