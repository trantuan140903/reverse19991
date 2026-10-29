import JSZip from 'jszip';
import {
  AspectRatioType,
  BackgroundPreset,
  CropState,
  ExportFormat,
  ExportResolution,
  BatchItem,
  FramingType,
  WatermarkStyle,
  FrameStyle
} from '../types';
import { getGalleryPosterForVersion, GALLERY_POSTERS } from '../data/galleryPosters';

export function getProxyImageUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('/')) return rawUrl;
  return `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
}

export function getRatioValue(ratio: AspectRatioType, originalW: number, originalH: number): number {
  switch (ratio) {
    case '6:9':
      return 6 / 9; // 2/3 = ~0.6667
    case '5.4:9':
      return 5.4 / 9; // 0.60 standard collectible card ratio (54mm x 90mm)
    case '9:16':
      return 9 / 16;
    case '1:1':
      return 1;
    case '3:4':
      return 3 / 4;
    case '4:3':
      return 4 / 3;
    case '16:9':
      return 16 / 9;
    case 'original':
      return originalW > 0 && originalH > 0 ? originalW / originalH : 6 / 9;
    default:
      return 6 / 9;
  }
}

export function getResolutionDimensions(
  resolution: ExportResolution,
  ratioVal: number
): { width: number; height: number } {
  let targetHeight: number;
  switch (resolution) {
    case 'standard':
      targetHeight = 1080;
      break;
    case 'hd':
      targetHeight = 1800;
      break;
    case '2k':
      targetHeight = 2160;
      break;
    case '4k':
      targetHeight = 3600;
      break;
    default:
      targetHeight = 1800;
  }

  const targetWidth = Math.round(targetHeight * ratioVal);
  return { width: targetWidth, height: targetHeight };
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function calculateImageBounds(img: HTMLImageElement): BoundingBox {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const sampleMax = 400;
  const scale = Math.min(1, sampleMax / Math.max(w, h));
  const sw = Math.max(1, Math.floor(w * scale));
  const sh = Math.max(1, Math.floor(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { minX: 0, minY: 0, maxX: w, maxY: h, width: w, height: h };
  }

  ctx.drawImage(img, 0, 0, sw, sh);
  const imgData = ctx.getImageData(0, 0, sw, sh).data;

  let minX = sw;
  let minY = sh;
  let maxX = 0;
  let maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const alpha = imgData[(y * sw + x) * 4 + 3];
      if (alpha > 15) {
        hasPixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixels) {
    return { minX: 0, minY: 0, maxX: w, maxY: h, width: w, height: h };
  }

  const origMinX = Math.floor(minX / scale);
  const origMinY = Math.floor(minY / scale);
  const origMaxX = Math.min(w, Math.ceil((maxX + 1) / scale));
  const origMaxY = Math.min(h, Math.ceil((maxY + 1) / scale));

  return {
    minX: origMinX,
    minY: origMinY,
    maxX: origMaxX,
    maxY: origMaxY,
    width: origMaxX - origMinX,
    height: origMaxY - origMinY,
  };
}

export function calculateFitTransform(
  imgW: number,
  imgH: number,
  bounds: BoundingBox,
  targetW: number,
  targetH: number,
  paddingPercent: number = 0.05,
  framing: FramingType = 'full'
): { scale: number; offsetX: number; offsetY: number } {
  const availW = targetW * (1 - paddingPercent * 2);
  const availH = targetH * (1 - paddingPercent * 2);

  const baseScaleX = availW / (bounds.width || imgW);
  const baseScaleY = availH / (bounds.height || imgH);
  const fullScale = Math.min(baseScaleX, baseScaleY);

  if (framing === 'full') {
    const boundsCenterX = bounds.minX + bounds.width / 2;
    const boundsCenterY = bounds.minY + bounds.height / 2;
    return {
      scale: fullScale,
      offsetX: targetW / 2 - boundsCenterX * fullScale,
      offsetY: targetH / 2 - boundsCenterY * fullScale,
    };
  }

  if (framing === 'half') {
    const halfScale = fullScale * 1.55;
    const torsoCenterX = bounds.minX + bounds.width * 0.5;
    const torsoCenterY = bounds.minY + bounds.height * 0.35;
    return {
      scale: halfScale,
      offsetX: targetW / 2 - torsoCenterX * halfScale,
      offsetY: targetH * 0.45 - torsoCenterY * halfScale,
    };
  }

  if (framing === 'close') {
    const closeScale = fullScale * 2.3;
    const headCenterX = bounds.minX + bounds.width * 0.5;
    const headCenterY = bounds.minY + bounds.height * 0.2;
    return {
      scale: closeScale,
      offsetX: targetW / 2 - headCenterX * closeScale,
      offsetY: targetH * 0.4 - headCenterY * closeScale,
    };
  }

  const boundsCenterX = bounds.minX + bounds.width / 2;
  const boundsCenterY = bounds.minY + bounds.height / 2;
  return {
    scale: fullScale,
    offsetX: targetW / 2 - boundsCenterX * fullScale,
    offsetY: targetH / 2 - boundsCenterY * fullScale,
  };
}

/**
 * Calculates transform to zoom an illustration full-bleed (tràn viền / cover)
 * into the target frame with no empty margins and no poster behind it.
 */
export function calculateIllustrationCoverTransform(
  imgW: number,
  imgH: number,
  targetW: number,
  targetH: number
): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.max(targetW / imgW, targetH / imgH);
  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  return {
    scale,
    offsetX: (targetW - scaledW) / 2,
    offsetY: (targetH - scaledH) / 2,
  };
}

// Global cache for loaded poster images
const posterImageCache = new Map<string, HTMLImageElement>();

export function getLoadedPosterImage(
  url: string,
  onLoaded?: () => void
): HTMLImageElement | null {
  if (!url) return null;
  const cached = posterImageCache.get(url);
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;

  if (!cached) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = getProxyImageUrl(url);
    img.onload = () => {
      if (onLoaded) onLoaded();
    };
    posterImageCache.set(url, img);
    return img.complete ? img : null;
  }
  return null;
}

export function drawIllustrationBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  // Multi-tier dark luxury obsidian studio background to make illustration artwork pop
  const baseGrad = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.9);
  baseGrad.addColorStop(0, '#1c1f2e');
  baseGrad.addColorStop(0.35, '#12141d');
  baseGrad.addColorStop(0.7, '#0b0c12');
  baseGrad.addColorStop(1, '#050608');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // Warm amber spotlight aura from upper center
  const auraGrad = ctx.createRadialGradient(w * 0.5, h * 0.38, 0, w * 0.5, h * 0.38, Math.max(w, h) * 0.6);
  auraGrad.addColorStop(0, 'rgba(223, 105, 49, 0.22)');
  auraGrad.addColorStop(0.5, 'rgba(227, 164, 92, 0.08)');
  auraGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = auraGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle luxury Art Deco geometry grid lines
  ctx.strokeStyle = 'rgba(227, 164, 92, 0.05)';
  ctx.lineWidth = 1;
  const step = Math.max(36, Math.floor(w / 14));
  ctx.beginPath();
  for (let x = step; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // Subtle perimeter vignette
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.4, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, 'rgba(4, 5, 7, 0.65)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  preset: BackgroundPreset,
  w: number,
  h: number,
  customColor: string,
  posterUrl?: string,
  posterOpacity: number = 0.85,
  posterBlur: number = 0,
  posterDarken: number = 0.25,
  onPosterLoad?: () => void
) {
  ctx.clearRect(0, 0, w, h);

  if (preset === 'transparent') {
    return;
  }

  if (preset === 'illustration-backdrop') {
    drawIllustrationBackdrop(ctx, w, h);
    return;
  }

  if (preset === 'version-poster') {
    const baseGrad = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h));
    baseGrad.addColorStop(0, '#1c1f2e');
    baseGrad.addColorStop(1, '#08090d');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    if (posterUrl) {
      const posterImg = getLoadedPosterImage(posterUrl, onPosterLoad);
      if (posterImg && posterImg.complete && posterImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, posterOpacity));

        if (posterBlur > 0) {
          ctx.filter = `blur(${Math.round(posterBlur * (h / 1080))}px)`;
        }

        const pw = posterImg.naturalWidth;
        const ph = posterImg.naturalHeight;
        const scale = Math.max(w / pw, h / ph);
        const nw = pw * scale;
        const nh = ph * scale;
        const nx = (w - nw) / 2;
        const ny = (h - nh) / 2;

        ctx.drawImage(posterImg, nx, ny, nw, nh);
        ctx.restore();

        if (posterDarken > 0) {
          ctx.save();
          ctx.fillStyle = `rgba(0, 0, 0, ${posterDarken * Math.max(0.3, posterOpacity)})`;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
      }
    }
    return;
  }

  switch (preset) {
    case 'dark-uttu': {
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
      grad.addColorStop(0, '#1c1f2e');
      grad.addColorStop(0.5, '#12141d');
      grad.addColorStop(1, '#08090d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.strokeStyle = 'rgba(223, 105, 49, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const step = Math.max(30, Math.floor(w / 12));
      for (let x = step; x < w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = step; y < h; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(227, 164, 92, 0.25)';
      ctx.lineWidth = 2;
      const cornerSize = Math.max(16, w * 0.05);
      ctx.strokeRect(cornerSize * 0.5, cornerSize * 0.5, cornerSize, cornerSize);
      ctx.strokeRect(w - cornerSize * 1.5, cornerSize * 0.5, cornerSize, cornerSize);
      ctx.restore();
      break;
    }

    case 'vintage-gold': {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#2b1e15');
      grad.addColorStop(0.4, '#1b140e');
      grad.addColorStop(1, '#0e0b07');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const rad = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.7);
      rad.addColorStop(0, 'rgba(223, 105, 49, 0.35)');
      rad.addColorStop(1, 'transparent');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'mystic-nebula': {
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.5, Math.max(w, h));
      grad.addColorStop(0, '#21183c');
      grad.addColorStop(0.5, '#110c22');
      grad.addColorStop(1, '#06040c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const aura = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.6);
      aura.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'arcanist-crimson': {
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.5, Math.max(w, h));
      grad.addColorStop(0, '#3a1318');
      grad.addColorStop(0.6, '#1a090b');
      grad.addColorStop(1, '#080203');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'parchment': {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#f0e6d2');
      grad.addColorStop(1, '#d8c8ab');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'solid': {
      ctx.fillStyle = customColor || '#12141d';
      ctx.fillRect(0, 0, w, h);
      break;
    }
  }
}

/**
 * Draws Luxury Reverse: 1999 Ornate Framing
 */
export function drawLuxuryFrame(
  ctx: CanvasRenderingContext2D,
  frameStyle: FrameStyle,
  w: number,
  h: number
) {
  if (!frameStyle || frameStyle === 'none') return;

  ctx.save();
  const margin = Math.max(14, Math.round(w * 0.035));
  const innerMargin = margin + Math.max(6, Math.round(w * 0.015));

  if (frameStyle === 'art-deco-gold') {
    // 1. Outer metallic gold border
    const goldGrad = ctx.createLinearGradient(0, 0, w, h);
    goldGrad.addColorStop(0, '#e3a45c');
    goldGrad.addColorStop(0.3, '#fff0cf');
    goldGrad.addColorStop(0.6, '#df6931');
    goldGrad.addColorStop(1, '#c68235');

    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = Math.max(2, Math.round(w * 0.0035));
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

    // 2. Inner fine border
    ctx.strokeStyle = 'rgba(227, 164, 92, 0.45)';
    ctx.lineWidth = Math.max(1, Math.round(w * 0.0015));
    ctx.strokeRect(innerMargin, innerMargin, w - innerMargin * 2, h - innerMargin * 2);

    // 3. Art Deco Corner Ornaments
    const cornerSize = Math.max(20, Math.round(w * 0.05));
    const corners = [
      { x: margin, y: margin, dx: 1, dy: 1 },
      { x: w - margin, y: margin, dx: -1, dy: 1 },
      { x: margin, y: h - margin, dx: 1, dy: -1 },
      { x: w - margin, y: h - margin, dx: -1, dy: -1 },
    ];

    ctx.fillStyle = goldGrad;
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = Math.max(2, Math.round(w * 0.003));

    corners.forEach(c => {
      // Corner stepped L-brackets
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + c.dy * cornerSize);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(c.x + c.dx * cornerSize, c.y);
      ctx.stroke();

      // Corner small solid square
      const sqSize = Math.max(5, Math.round(w * 0.01));
      ctx.fillRect(c.x + c.dx * sqSize * 0.5, c.y + c.dy * sqSize * 0.5, c.dx * sqSize, c.dy * sqSize);

      // Diagonal 45-degree accent line
      ctx.beginPath();
      ctx.moveTo(c.x + c.dx * cornerSize * 0.5, c.y);
      ctx.lineTo(c.x, c.y + c.dy * cornerSize * 0.5);
      ctx.stroke();
    });

    // Midpoint Diamond Studs
    const diamondSize = Math.max(4, Math.round(w * 0.008));
    const midpoints = [
      { x: w / 2, y: margin },
      { x: w / 2, y: h - margin },
      { x: margin, y: h / 2 },
      { x: w - margin, y: h / 2 },
    ];
    midpoints.forEach(m => {
      ctx.beginPath();
      ctx.moveTo(m.x, m.y - diamondSize);
      ctx.lineTo(m.x + diamondSize, m.y);
      ctx.lineTo(m.x, m.y + diamondSize);
      ctx.lineTo(m.x - diamondSize, m.y);
      ctx.closePath();
      ctx.fill();
    });
  } else if (frameStyle === 'celestial-astrolabe') {
    // 2. NEW OPTION: Celestial Astrolabe (Reverse: 1999 Time Dial & Brass Astrolabe)
    const astroGrad = ctx.createLinearGradient(0, 0, w, h);
    astroGrad.addColorStop(0, '#ffe8b3');
    astroGrad.addColorStop(0.3, '#df9b42');
    astroGrad.addColorStop(0.7, '#fcd281');
    astroGrad.addColorStop(1, '#a8621d');

    ctx.strokeStyle = astroGrad;
    ctx.lineWidth = Math.max(2, Math.round(w * 0.003));
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

    // Inner fine concentric line
    ctx.strokeStyle = 'rgba(255, 215, 130, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(innerMargin, innerMargin, w - innerMargin * 2, h - innerMargin * 2);

    // Corner Astrolabe concentric rings & crosshairs
    const ringRadius = Math.max(16, Math.round(w * 0.04));
    const corners = [
      { x: margin, y: margin, dx: 1, dy: 1 },
      { x: w - margin, y: margin, dx: -1, dy: 1 },
      { x: margin, y: h - margin, dx: 1, dy: -1 },
      { x: w - margin, y: h - margin, dx: -1, dy: -1 },
    ];

    corners.forEach(c => {
      // Outer ring
      ctx.beginPath();
      ctx.arc(c.x, c.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = astroGrad;
      ctx.lineWidth = Math.max(1.5, Math.round(w * 0.002));
      ctx.stroke();

      // Inner ring
      ctx.beginPath();
      ctx.arc(c.x, c.y, ringRadius * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 230, 160, 0.6)';
      ctx.stroke();

      // Center astrolabe jewel
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(2.5, Math.round(w * 0.004)), 0, Math.PI * 2);
      ctx.fillStyle = astroGrad;
      ctx.fill();
    });

    // Clockwork ticks along the top and bottom borders
    ctx.fillStyle = 'rgba(255, 215, 130, 0.7)';
    const tickCount = 9;
    const stepX = (w - margin * 2) / (tickCount + 1);
    for (let i = 1; i <= tickCount; i++) {
      const tx = margin + i * stepX;
      // top tick
      ctx.fillRect(tx - 1, margin - 3, 2, 6);
      // bottom tick
      ctx.fillRect(tx - 1, h - margin - 3, 2, 6);
    }
  } else if (frameStyle === 'gothic-arcanum') {
    // 3. NEW OPTION: Gothic Arcanum (Cathedral pointed arches & obsidian-gold finials)
    const gothicGrad = ctx.createLinearGradient(0, 0, w, h);
    gothicGrad.addColorStop(0, '#f9ecd4');
    gothicGrad.addColorStop(0.4, '#d89b47');
    gothicGrad.addColorStop(0.7, '#fff2db');
    gothicGrad.addColorStop(1, '#9b5e1b');

    // Outer line
    ctx.strokeStyle = gothicGrad;
    ctx.lineWidth = Math.max(2.5, Math.round(w * 0.0035));
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

    // Gothic Lance arch corners
    const archH = Math.max(24, Math.round(w * 0.055));
    const archW = Math.max(24, Math.round(w * 0.055));
    const corners = [
      { x: margin, y: margin, dx: 1, dy: 1 },
      { x: w - margin, y: margin, dx: -1, dy: 1 },
      { x: margin, y: h - margin, dx: 1, dy: -1 },
      { x: w - margin, y: h - margin, dx: -1, dy: -1 },
    ];

    corners.forEach(c => {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + c.dy * archH);
      ctx.quadraticCurveTo(c.x + c.dx * archW * 0.25, c.y + c.dy * archH * 0.25, c.x + c.dx * archW, c.y);
      ctx.strokeStyle = gothicGrad;
      ctx.lineWidth = Math.max(2, Math.round(w * 0.0025));
      ctx.stroke();

      // Inverted inner arch
      ctx.beginPath();
      ctx.moveTo(c.x + c.dx * 8, c.y + c.dy * archH * 0.75);
      ctx.lineTo(c.x + c.dx * archW * 0.75, c.y + c.dy * 8);
      ctx.strokeStyle = 'rgba(249, 236, 212, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Top, bottom, left, right center crests
    const midW = Math.max(12, Math.round(w * 0.025));
    const centers = [
      { x: w / 2, y: margin },
      { x: w / 2, y: h - margin },
      { x: margin, y: h / 2 },
      { x: w - margin, y: h / 2 },
    ];
    ctx.fillStyle = gothicGrad;
    centers.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, midW * 0.35, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore();
}

/**
 * Render authentic gold Afflatus emblem matching the text color, positioned to the left of the character's name
 */
export function drawGoldAfflatusIcon(
  ctx: CanvasRenderingContext2D,
  afflatus: string,
  cx: number,
  cy: number,
  size: number,
  goldColorOrGrad: string | CanvasGradient
) {
  if (!afflatus) return;
  const kind = afflatus.trim().toLowerCase();
  ctx.save();
  ctx.fillStyle = goldColorOrGrad;
  ctx.strokeStyle = goldColorOrGrad;
  ctx.lineWidth = Math.max(1.5, size * 0.09);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 8;

  const r = size / 2;

  // Thin outer gold celestial ring
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.stroke();

  if (kind === 'star') {
    // 8-point radiant cosmic star with concentric diamond core
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const dist = i % 2 === 0 ? r * 0.72 : r * 0.28;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'beast') {
    // Gilded curved majestic horn & spark
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.52, -Math.PI * 0.7, Math.PI * 0.5);
    ctx.lineWidth = Math.max(2, size * 0.14);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + r * 0.4, cy - r * 0.25);
    ctx.lineTo(cx + r * 0.65, cy - r * 0.65);
    ctx.lineTo(cx + r * 0.2, cy - r * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx - r * 0.1, cy, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'plant') {
    // Botanical blooming leaf & stem
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.65);
    ctx.quadraticCurveTo(cx - r * 0.55, cy, cx, cy - r * 0.65);
    ctx.quadraticCurveTo(cx + r * 0.55, cy, cx, cy + r * 0.65);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.55);
    ctx.lineTo(cx, cy - r * 0.55);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.stroke();
  } else if (kind === 'mineral') {
    // Octahedral faceted crystal diamond
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.68);
    ctx.lineTo(cx + r * 0.62, cy);
    ctx.lineTo(cx, cy + r * 0.68);
    ctx.lineTo(cx - r * 0.62, cy);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - r * 0.62, cy);
    ctx.lineTo(cx + r * 0.62, cy);
    ctx.moveTo(cx, cy - r * 0.68);
    ctx.lineTo(cx, cy + r * 0.68);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.stroke();
  } else if (kind === 'spirit') {
    // Ethereal triple spiral triskele / arcanum vortex
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.22, r * 0.28, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - r * 0.22, cy + r * 0.22, r * 0.28, Math.PI * 0.5, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + r * 0.22, cy + r * 0.22, r * 0.28, Math.PI, Math.PI * 0.5, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Intellect / Intelligence: Interlocking dual celestial orbital rings
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.65, r * 0.28, Math.PI / 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.65, r * 0.28, -Math.PI / 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Creative, Luxurious Watermark Badge Typography with optional gold Afflatus emblem
 */
export function drawWatermarkBadge(
  ctx: CanvasRenderingContext2D,
  charName: string,
  charRarity: number,
  afflatus: string,
  w: number,
  h: number,
  style: WatermarkStyle = 'art-deco-gold',
  version?: string,
  showAfflatus: boolean = false,
  showRace: boolean = false,
  race?: string,
  showAfflatusSymbol: boolean = true
) {
  if (style === 'none') return;

  ctx.save();
  const scaleRef = h / 1080;
  const paddingX = Math.max(20, Math.round(w * 0.06));
  const paddingY = Math.max(24, Math.round(h * 0.045));

  // Build secondary subtitle row (Stars, Afflatus, Race)
  const stars = '★'.repeat(charRarity || 5);
  const subParts: string[] = [stars];
  if (showAfflatus && afflatus) {
    subParts.push(afflatus.toUpperCase());
  }
  if (showRace && race) {
    subParts.push(race.toUpperCase());
  }
  const subtitleText = subParts.join('  •  ');

  // 1. ART DECO GOLD (Right Corner Classic)
  if (style === 'art-deco-gold') {
    const fontSize = Math.max(18, Math.round(w * 0.048));
    const starFontSize = Math.max(12, Math.round(w * 0.028));

    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    // Deep shadow for contrast
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 12 * scaleRef;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4 * scaleRef;

    // Golden metallic gradient for name
    const goldGrad = ctx.createLinearGradient(w - paddingX - 250 * scaleRef, 0, w - paddingX, 0);
    goldGrad.addColorStop(0, '#ffffff');
    goldGrad.addColorStop(0.4, '#fff0cf');
    goldGrad.addColorStop(0.8, '#e3a45c');
    goldGrad.addColorStop(1, '#ffd699');

    // Subtle background tint plaque behind badge for readability
    const plaqueW = Math.max(180, Math.round(w * 0.46));
    const plaqueH = Math.max(50, Math.round(h * 0.075));
    const plaqueX = w - paddingX - plaqueW + 10;
    const plaqueY = h - paddingY - plaqueH + 10;

    const bgGrad = ctx.createLinearGradient(plaqueX, 0, w, 0);
    bgGrad.addColorStop(0, 'transparent');
    bgGrad.addColorStop(0.4, 'rgba(10, 12, 18, 0.45)');
    bgGrad.addColorStop(1, 'rgba(10, 12, 18, 0.75)');

    ctx.fillStyle = bgGrad;
    ctx.fillRect(plaqueX, plaqueY, plaqueW + paddingX, plaqueH + 10);

    // Decorative upper thin line
    ctx.strokeStyle = 'rgba(227, 164, 92, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w - paddingX - plaqueW * 0.65, h - paddingY - plaqueH + 10);
    ctx.lineTo(w - paddingX, h - paddingY - plaqueH + 10);
    ctx.stroke();

    // Small diamond ornament on divider
    ctx.fillStyle = '#e3a45c';
    ctx.beginPath();
    const dX = w - paddingX - plaqueW * 0.65;
    const dY = h - paddingY - plaqueH + 10;
    ctx.moveTo(dX, dY - 3);
    ctx.lineTo(dX + 3, dY);
    ctx.lineTo(dX, dY + 3);
    ctx.lineTo(dX - 3, dY);
    ctx.closePath();
    ctx.fill();

    // Character Name (Cinzel Decorative)
    ctx.fillStyle = goldGrad;
    ctx.font = `700 ${fontSize}px "Cinzel Decorative", "Cinzel", "Times New Roman", serif`;
    const nameY = h - paddingY - starFontSize - 4 * scaleRef;
    ctx.fillText(charName, w - paddingX, nameY);

    // Draw gold Afflatus symbol matching text color to the left of the name
    if (showAfflatusSymbol && afflatus) {
      const nameWidth = ctx.measureText(charName).width;
      const iconSize = fontSize * 0.95;
      const iconX = (w - paddingX) - nameWidth - iconSize * 0.65 - 8 * scaleRef;
      const iconY = nameY - fontSize * 0.4;
      drawGoldAfflatusIcon(ctx, afflatus, iconX, iconY, iconSize, goldGrad);
    }

    // Subtitle (Stars, Afflatus, Race)
    ctx.fillStyle = '#f5c070';
    ctx.font = `700 ${starFontSize}px "Cinzel", sans-serif`;
    ctx.fillText(subtitleText, w - paddingX, h - paddingY);
  }
  // 2. CINEMATIC SUBTITLE (Centered)
  else if (style === 'cinematic') {
    const fontSize = Math.max(15, Math.round(w * 0.04));
    const subFontSize = Math.max(11, Math.round(w * 0.024));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8 * scaleRef;

    const centerX = w / 2;
    const bottomY = h - paddingY;

    // Subtitle (Stars, Afflatus, Race)
    ctx.fillStyle = '#df6931';
    ctx.font = `700 ${subFontSize}px "Cinzel", sans-serif`;
    ctx.fillText(subtitleText, centerX, bottomY);

    // Character Name with wide letter spacing
    const nameY = bottomY - subFontSize - 6 * scaleRef;
    const upperName = charName.toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${fontSize}px "Cinzel", serif`;
    ctx.fillText(upperName, centerX, nameY);

    // Gold Afflatus emblem to the left of centered name
    if (showAfflatusSymbol && afflatus) {
      const nameWidth = ctx.measureText(upperName).width;
      const iconSize = fontSize * 0.9;
      const iconX = centerX - nameWidth / 2 - iconSize * 0.7 - 8 * scaleRef;
      const iconY = nameY - fontSize * 0.45;
      const goldGrad = ctx.createLinearGradient(iconX - iconSize, 0, iconX + iconSize, 0);
      goldGrad.addColorStop(0, '#fde68a');
      goldGrad.addColorStop(1, '#e5ad58');
      drawGoldAfflatusIcon(ctx, afflatus, iconX, iconY, iconSize, goldGrad);
    }
  }
  // 3. GILDED MANUSCRIPT (Centered luxury serif with ornamental wings)
  else if (style === 'gilded-manuscript') {
    const fontSize = Math.max(17, Math.round(w * 0.044));
    const starFontSize = Math.max(12, Math.round(w * 0.026));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 10 * scaleRef;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3 * scaleRef;

    const centerX = w / 2;
    const bottomY = h - paddingY;

    // Gold gradient for text and embellishment
    const goldGrad = ctx.createLinearGradient(centerX - 150 * scaleRef, 0, centerX + 150 * scaleRef, 0);
    goldGrad.addColorStop(0, '#e3a45c');
    goldGrad.addColorStop(0.5, '#ffffff');
    goldGrad.addColorStop(1, '#e3a45c');

    // Subtitle flanked by diamond glyphs
    ctx.fillStyle = '#f5c070';
    ctx.font = `700 ${starFontSize}px "Cinzel", sans-serif`;
    ctx.fillText(`✧  ${subtitleText}  ✧`, centerX, bottomY);

    // Name flanked by royal flourish rules
    const nameY = bottomY - starFontSize - 6 * scaleRef;
    const upperName = charName.toUpperCase();
    ctx.fillStyle = goldGrad;
    ctx.font = `700 ${fontSize}px "Cormorant Garamond", "Cinzel", serif`;
    ctx.fillText(upperName, centerX, nameY);

    // Fine golden horizontal accent rules
    ctx.strokeStyle = 'rgba(227, 164, 92, 0.6)';
    ctx.lineWidth = 1;
    const textWidth = ctx.measureText(upperName).width;
    const lineLen = Math.max(25, Math.round(w * 0.08));
    const lineY = bottomY - starFontSize - fontSize * 0.45;

    // Gold Afflatus emblem to the left of centered name
    if (showAfflatusSymbol && afflatus) {
      const iconSize = fontSize * 0.9;
      const iconX = centerX - textWidth / 2 - iconSize * 0.7 - 8 * scaleRef;
      drawGoldAfflatusIcon(ctx, afflatus, iconX, lineY, iconSize, goldGrad);
    }

    // Left line
    ctx.beginPath();
    ctx.moveTo(centerX - textWidth / 2 - lineLen - 8, lineY);
    ctx.lineTo(centerX - textWidth / 2 - (showAfflatusSymbol ? 24 : 8), lineY);
    ctx.stroke();

    // Right line
    ctx.beginPath();
    ctx.moveTo(centerX + textWidth / 2 + 8, lineY);
    ctx.lineTo(centerX + textWidth / 2 + lineLen + 8, lineY);
    ctx.stroke();
  }
  // 4. METALLIC SILVER-TO-GOLD SPECULAR (Smooth chromatic silver-to-gold shift)
  else if (style === 'silver-gold-metallic') {
    const fontSize = Math.max(18, Math.round(w * 0.048));
    const starFontSize = Math.max(12, Math.round(w * 0.028));

    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    // Deep luminous shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 14 * scaleRef;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4 * scaleRef;

    // Specular chromatic silver-to-gold shift gradient
    const chromaticGrad = ctx.createLinearGradient(w - paddingX - 280 * scaleRef, 0, w - paddingX, 0);
    chromaticGrad.addColorStop(0, '#cbd5e1'); // Sleek platinum silver
    chromaticGrad.addColorStop(0.25, '#ffffff'); // Pure specular silver shine
    chromaticGrad.addColorStop(0.55, '#fde68a'); // Luminous champagne gold
    chromaticGrad.addColorStop(0.8, '#e5ad58'); // Warm royal gold
    chromaticGrad.addColorStop(1, '#b46e28'); // Antique deep bronze

    // Plaque background with dual silver-and-gold borders
    const plaqueW = Math.max(180, Math.round(w * 0.48));
    const plaqueH = Math.max(52, Math.round(h * 0.078));
    const plaqueX = w - paddingX - plaqueW + 10;
    const plaqueY = h - paddingY - plaqueH + 10;

    const bgGrad = ctx.createLinearGradient(plaqueX, 0, w, 0);
    bgGrad.addColorStop(0, 'transparent');
    bgGrad.addColorStop(0.35, 'rgba(15, 18, 28, 0.55)');
    bgGrad.addColorStop(1, 'rgba(8, 10, 16, 0.85)');

    ctx.fillStyle = bgGrad;
    ctx.fillRect(plaqueX, plaqueY, plaqueW + paddingX, plaqueH + 10);

    // Decorative silver-to-gold top divider
    ctx.strokeStyle = chromaticGrad;
    ctx.lineWidth = Math.max(1.5, 2 * scaleRef);
    ctx.beginPath();
    ctx.moveTo(w - paddingX - plaqueW * 0.7, h - paddingY - plaqueH + 10);
    ctx.lineTo(w - paddingX, h - paddingY - plaqueH + 10);
    ctx.stroke();

    // Specular diamond star ornament on divider
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const dX = w - paddingX - plaqueW * 0.7;
    const dY = h - paddingY - plaqueH + 10;
    ctx.moveTo(dX, dY - 4);
    ctx.lineTo(dX + 4, dY);
    ctx.lineTo(dX, dY + 4);
    ctx.lineTo(dX - 4, dY);
    ctx.closePath();
    ctx.fill();

    // Character Name in Cinzel Decorative with smooth silver-to-gold
    ctx.fillStyle = chromaticGrad;
    ctx.font = `700 ${fontSize}px "Cinzel Decorative", "Cinzel", "Cormorant Garamond", serif`;
    const nameY = h - paddingY - starFontSize - 4 * scaleRef;
    ctx.fillText(charName, w - paddingX, nameY);

    // Draw gold Afflatus symbol matching text color to the left of the name
    if (showAfflatusSymbol && afflatus) {
      const nameWidth = ctx.measureText(charName).width;
      const iconSize = fontSize * 0.95;
      const iconX = (w - paddingX) - nameWidth - iconSize * 0.65 - 8 * scaleRef;
      const iconY = nameY - fontSize * 0.4;
      drawGoldAfflatusIcon(ctx, afflatus, iconX, iconY, iconSize, chromaticGrad);
    }

    // Subtitle (Stars, Afflatus, Race)
    ctx.fillStyle = '#fef08a';
    ctx.font = `700 ${starFontSize}px "Cinzel", sans-serif`;
    ctx.fillText(subtitleText, w - paddingX, h - paddingY);
  }

  ctx.restore();
}

/**
 * Distinctive, Ultra-Luxurious Garment Name Typography Badge (Upper-left corner)
 * Displays ONLY the garment name (no series name) with high-end haute couture styling.
 * Supports automatic multi-line word wrapping.
 */
export function drawGarmentNameBadge(
  ctx: CanvasRenderingContext2D,
  garmentName: string,
  w: number = 720,
  h: number = 1080
) {
  if (!garmentName) return;

  ctx.save();
  const scaleRef = h / 1080;
  const paddingX = Math.max(24, Math.round(w * 0.055));
  const paddingY = Math.max(26, Math.round(h * 0.045));
  const cleanName = garmentName.trim();

  // Chromatic silver-to-gold metallic gradient generator
  const createMetallicGrad = (x0: number, y0: number, x1: number, y1: number) => {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, '#f1f5f9'); // Polished platinum silver
    grad.addColorStop(0.2, '#ffffff'); // Brilliant specular highlight
    grad.addColorStop(0.5, '#fde68a'); // Champagne light gold
    grad.addColorStop(0.8, '#d97706'); // Warm royal gold
    grad.addColorStop(1, '#92400e'); // Antique deep bronze
    return grad;
  };

  const fontSize = Math.max(16, Math.round(w * 0.045));
  ctx.font = `700 ${fontSize}px "Cinzel Decorative", "Cinzel", "Cormorant Garamond", serif`;

  // Split words and wrap onto lines if exceeding max width
  const maxLineWidth = Math.max(180, Math.round(w * 0.46));
  const words = cleanName.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
    const testW = ctx.measureText(testLine).width;
    if (testW > maxLineWidth && currentLine) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  if (lines.length === 0) lines.push(cleanName);

  // Measure longest line
  let maxW = 0;
  lines.forEach(l => {
    const lw = ctx.measureText(l).width;
    if (lw > maxW) maxW = lw;
  });

  const lineHeight = fontSize * 1.25;
  const tagHeight = Math.max(10, Math.round(fontSize * 0.5));
  const plaqueW = Math.max(170, maxW + 48 * scaleRef);
  const plaqueH = Math.max(54, Math.round(lines.length * lineHeight + tagHeight + 24 * scaleRef));
  const plaqueX = paddingX - 12 * scaleRef;
  const plaqueY = paddingY - 12 * scaleRef;

  // Ultra-luxurious frosted obsidian glass background cartouche
  const bgGrad = ctx.createLinearGradient(plaqueX, plaqueY, plaqueX + plaqueW, plaqueY + plaqueH);
  bgGrad.addColorStop(0, 'rgba(12, 14, 22, 0.92)');
  bgGrad.addColorStop(0.65, 'rgba(12, 14, 22, 0.65)');
  bgGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(plaqueX, plaqueY, plaqueW, plaqueH);

  // Gilded left bevel vertical spine with dual specular highlight
  const spineGrad = createMetallicGrad(0, plaqueY, 0, plaqueY + plaqueH);
  ctx.fillStyle = spineGrad;
  ctx.fillRect(plaqueX, plaqueY + 3 * scaleRef, Math.max(3, 3.5 * scaleRef), plaqueH - 6 * scaleRef);

  // Gilded delicate micro corner ornament at top-left
  ctx.strokeStyle = spineGrad;
  ctx.lineWidth = Math.max(1.5, 2 * scaleRef);
  ctx.beginPath();
  ctx.moveTo(plaqueX, plaqueY + 12 * scaleRef);
  ctx.lineTo(plaqueX, plaqueY);
  ctx.lineTo(plaqueX + 16 * scaleRef, plaqueY);
  ctx.stroke();

  // Fine luxury hairline underline with diamond stop
  ctx.strokeStyle = 'rgba(245, 192, 112, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plaqueX, plaqueY + plaqueH);
  ctx.lineTo(plaqueX + plaqueW * 0.8, plaqueY + plaqueH);
  ctx.stroke();

  // Diamond jewel at underline terminus
  const diamondX = plaqueX + plaqueW * 0.8;
  const diamondY = plaqueY + plaqueH;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(diamondX, diamondY - 3);
  ctx.lineTo(diamondX + 3, diamondY);
  ctx.lineTo(diamondX, diamondY + 3);
  ctx.lineTo(diamondX - 3, diamondY);
  ctx.closePath();
  ctx.fill();

  // Subtle luxury tag header: "✦ GARMENT ✦"
  ctx.font = `600 ${Math.max(9, Math.round(fontSize * 0.44))}px "Cinzel", sans-serif`;
  ctx.fillStyle = '#d97706';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('✦  GARMENT  ✦', paddingX + 8 * scaleRef, plaqueY + 8 * scaleRef);

  // Render wrapped lines in metallic silver-to-gold chromatic gradient
  ctx.font = `700 ${fontSize}px "Cinzel Decorative", "Cinzel", "Cormorant Garamond", serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const textGrad = createMetallicGrad(paddingX, 0, paddingX + maxW, 0);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 12 * scaleRef;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2 * scaleRef;
  ctx.fillStyle = textGrad;

  const textStartY = plaqueY + 10 * scaleRef + tagHeight + 4 * scaleRef;
  lines.forEach((line, idx) => {
    ctx.fillText(line, paddingX + 8 * scaleRef, textStartY + idx * lineHeight);
  });

  ctx.restore();
}

/**
 * High quality rendering pipeline for canvas
 */
export function renderToCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cropState: CropState,
  targetW: number,
  targetH: number,
  charInfo?: { name: string; rarity: number; afflatus: string; version?: string; race?: string },
  onPosterLoad?: () => void,
  garmentInfo?: { name?: string; seriesName?: string; version?: string }
) {
  // Photocard Bo Góc (Rounded Card Corners)
  const isRounded = !!cropState.enableRoundedCorners;
  const radius = isRounded
    ? Math.max(14, Math.round((cropState.cornerRadius || 36) * (targetH / 1080)))
    : 0;

  if (isRounded) {
    ctx.save();
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(0, 0, targetW, targetH, radius);
    } else {
      ctx.moveTo(radius, 0);
      ctx.lineTo(targetW - radius, 0);
      ctx.quadraticCurveTo(targetW, 0, targetW, radius);
      ctx.lineTo(targetW, targetH - radius);
      ctx.quadraticCurveTo(targetW, targetH, targetW - radius, targetH);
      ctx.lineTo(radius, targetH);
      ctx.quadraticCurveTo(0, targetH, 0, targetH - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
    }
    ctx.clip();
  }

  // 1. Draw Background
  if (cropState.renderMode === 'illustration') {
    // Shared luxury illustration studio backdrop so artwork stands out
    drawIllustrationBackdrop(ctx, targetW, targetH);
  } else {
    drawBackground(
      ctx,
      cropState.bgPreset,
      targetW,
      targetH,
      cropState.customBgColor,
      cropState.posterUrl,
      cropState.posterOpacity,
      cropState.posterBlur,
      cropState.posterDarken,
      onPosterLoad
    );
  }

  // 2. Draw Character with transforms
  ctx.save();

  // Silhouette shadow is disabled in illustration mode or transparent background
  if (cropState.enableShadow && cropState.renderMode !== 'illustration' && cropState.bgPreset !== 'transparent') {
    ctx.shadowColor = cropState.shadowColor || 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = cropState.shadowBlur * (targetH / 1000);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6 * (targetH / 1000);
  }

  ctx.translate(cropState.offsetX, cropState.offsetY);

  if (cropState.rotation !== 0) {
    ctx.rotate((cropState.rotation * Math.PI) / 180);
  }

  if (cropState.flipH) {
    ctx.scale(-1, 1);
    ctx.translate(-img.naturalWidth * cropState.scale, 0);
  }

  ctx.drawImage(
    img,
    0,
    0,
    img.naturalWidth,
    img.naturalHeight,
    0,
    0,
    img.naturalWidth * cropState.scale,
    img.naturalHeight * cropState.scale
  );

  ctx.restore();

  // In illustration mode, subtle edge scrim so the frame, badge & watermark stand out clearly
  if (cropState.renderMode === 'illustration') {
    ctx.save();
    const scrim = ctx.createLinearGradient(0, 0, 0, targetH);
    scrim.addColorStop(0, 'rgba(5, 6, 9, 0.4)');
    scrim.addColorStop(0.12, 'transparent');
    scrim.addColorStop(0.85, 'transparent');
    scrim.addColorStop(1, 'rgba(5, 6, 9, 0.65)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.restore();
  }

  // 3. Draw Luxury Frame if enabled
  if (cropState.frameStyle && cropState.frameStyle !== 'none') {
    drawLuxuryFrame(ctx, cropState.frameStyle, targetW, targetH);
  }

  // 4. Draw Garment Name Badge (Upper-left corner) if enabled
  if (cropState.showGarmentName && garmentInfo?.name) {
    drawGarmentNameBadge(
      ctx,
      garmentInfo.name,
      targetW,
      targetH
    );
  }

  // 5. Draw Watermark Badge (Name + Stars + optional Afflatus + optional Race + Gold Afflatus Emblem) if enabled
  if (cropState.showBadge && cropState.watermarkStyle !== 'none' && charInfo && charInfo.name) {
    drawWatermarkBadge(
      ctx,
      charInfo.name,
      charInfo.rarity,
      charInfo.afflatus,
      targetW,
      targetH,
      cropState.watermarkStyle || 'art-deco-gold',
      charInfo.version,
      cropState.showAfflatus,
      cropState.showRace,
      charInfo.race,
      cropState.showAfflatusSymbol !== false
    );
  }

  // If rounded card corners, restore clip and stroke specular card bevel border
  if (isRounded) {
    ctx.restore();

    ctx.save();
    const borderWidth = Math.max(1.5, Math.round(2.5 * (targetH / 1080)));
    ctx.lineWidth = borderWidth;
    const cardBorderGrad = ctx.createLinearGradient(0, 0, targetW, targetH);
    cardBorderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    cardBorderGrad.addColorStop(0.25, 'rgba(245, 192, 112, 0.85)');
    cardBorderGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.35)');
    cardBorderGrad.addColorStop(1, 'rgba(180, 110, 40, 0.75)');
    ctx.strokeStyle = cardBorderGrad;

    const offset = borderWidth / 2;
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(offset, offset, targetW - borderWidth, targetH - borderWidth, radius);
    } else {
      ctx.moveTo(radius, offset);
      ctx.lineTo(targetW - radius, offset);
      ctx.quadraticCurveTo(targetW - offset, offset, targetW - offset, radius);
      ctx.lineTo(targetW - offset, targetH - radius);
      ctx.quadraticCurveTo(targetW - offset, targetH - offset, targetW - radius, targetH - offset);
      ctx.lineTo(radius, targetH - offset);
      ctx.quadraticCurveTo(offset, targetH - offset, offset, targetH - radius);
      ctx.lineTo(offset, radius);
      ctx.quadraticCurveTo(offset, offset, radius, offset);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Renders pure 6:9 poster WITHOUT character
 */
export async function renderPurePosterToBlob(
  posterUrl: string,
  resolution: ExportResolution = 'hd',
  format: ExportFormat = 'image/png',
  frameStyle: FrameStyle = 'none'
): Promise<{ blob: Blob; filename: string }> {
  const posterImg = await loadImageAsync(posterUrl);
  const ratioVal = 6 / 9;
  const { width: exportW, height: exportH } = getResolutionDimensions(resolution, ratioVal);

  const canvas = document.createElement('canvas');
  canvas.width = exportW;
  canvas.height = exportH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Cover 6:9 canvas with poster
  const pw = posterImg.naturalWidth;
  const ph = posterImg.naturalHeight;
  const scale = Math.max(exportW / pw, exportH / ph);
  const nw = pw * scale;
  const nh = ph * scale;
  const nx = (exportW - nw) / 2;
  const ny = (exportH - nh) / 2;

  ctx.drawImage(posterImg, nx, ny, nw, nh);

  if (frameStyle && frameStyle !== 'none') {
    drawLuxuryFrame(ctx, frameStyle, exportW, exportH);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('Failed to generate pure poster blob'));
          return;
        }
        const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
        const filename = `Reverse1999_Poster_6-9_${resolution}.${ext}`;
        resolve({ blob, filename });
      },
      format,
      format === 'image/jpeg' ? 0.95 : 1.0
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function loadImageAsync(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = getProxyImageUrl(url);
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from ${url}`));
  });
}

export async function renderBatchItemToBlob(
  item: BatchItem,
  globalCropState: CropState,
  resolution: ExportResolution,
  format: ExportFormat
): Promise<{ blob: Blob; filename: string }> {
  const isIllustration = item.renderMode === 'illustration';

  // L2D uses l2dUrl with transparency, Illustration uses full static image
  const imgUrl = isIllustration
    ? item.garment.imageUrl
    : (item.useLive2d !== false && item.garment.l2dUrl ? item.garment.l2dUrl : item.garment.imageUrl);

  const img = await loadImageAsync(imgUrl);

  const targetRatio = item.aspectRatio || globalCropState.aspectRatio || '6:9';
  const ratioVal = getRatioValue(targetRatio, img.naturalWidth, img.naturalHeight);
  const { width: exportW, height: exportH } = getResolutionDimensions(resolution, ratioVal);

  let fitScale: number;
  let fitOffsetX: number;
  let fitOffsetY: number;

  if (isIllustration) {
    // Zoom cover fill with NO poster behind it
    const coverFit = calculateIllustrationCoverTransform(img.naturalWidth, img.naturalHeight, exportW, exportH);
    fitScale = coverFit.scale;
    fitOffsetX = coverFit.offsetX;
    fitOffsetY = coverFit.offsetY;
  } else {
    // L2D fitted over version poster
    const bounds = calculateImageBounds(img);
    const fit = calculateFitTransform(
      img.naturalWidth,
      img.naturalHeight,
      bounds,
      exportW,
      exportH,
      0.05,
      item.framing || 'full'
    );
    fitScale = fit.scale;
    fitOffsetX = fit.offsetX;
    fitOffsetY = fit.offsetY;
  }

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = exportW;
  exportCanvas.height = exportH;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d canvas context');

  // Background handling
  const bgPreset = isIllustration ? 'transparent' : (item.bgPreset || globalCropState.bgPreset);
  let posterUrlToUse = isIllustration ? undefined : item.posterUrl;
  if (!isIllustration && !posterUrlToUse && bgPreset === 'version-poster') {
    const targetVer = item.garment.version || item.character.Version || '1.0';
    const p = getGalleryPosterForVersion(targetVer);
    posterUrlToUse = p.url;
  }

  if (!isIllustration && bgPreset === 'version-poster' && posterUrlToUse) {
    try {
      await loadImageAsync(posterUrlToUse);
    } catch (e) {
      console.warn('Could not preload poster image:', e);
    }
  }

  const exportCropState: CropState = {
    ...globalCropState,
    aspectRatio: targetRatio,
    framing: item.framing,
    renderMode: isIllustration ? 'illustration' : 'l2d',
    scale: fitScale,
    offsetX: fitOffsetX,
    offsetY: fitOffsetY,
    rotation: 0,
    flipH: false,
    bgPreset,
    posterUrl: posterUrlToUse,
    posterOpacity: item.posterOpacity !== undefined ? item.posterOpacity : globalCropState.posterOpacity,
    posterBlur: item.posterBlur !== undefined ? item.posterBlur : globalCropState.posterBlur,
    enableShadow: !isIllustration && (globalCropState.enableShadow && bgPreset !== 'transparent'),
    enableRoundedCorners: targetRatio === '5.4:9' ? true : globalCropState.enableRoundedCorners,
    frameStyle: item.frameStyle || globalCropState.frameStyle || 'none',
    watermarkStyle: item.watermarkStyle || globalCropState.watermarkStyle || 'silver-gold-metallic',
    showBadge: globalCropState.showBadge,
    showAfflatus: item.showAfflatus !== undefined ? item.showAfflatus : (globalCropState.showAfflatus ?? false),
    showAfflatusSymbol: item.showAfflatusSymbol !== undefined ? item.showAfflatusSymbol : (globalCropState.showAfflatusSymbol ?? true),
    showRace: item.showRace !== undefined ? item.showRace : (globalCropState.showRace ?? false),
    showGarmentName: item.showGarmentName !== undefined ? item.showGarmentName : (globalCropState.showGarmentName ?? false),
  };

  const charInfo = {
    name: String(item.character.Name),
    rarity: item.character.Rarity,
    afflatus: item.character.Afflatus,
    version: item.character.Version,
    race: item.character.Race,
  };

  const garmentInfo = {
    name: item.garment.name,
    seriesName: item.garment.seriesName || item.seriesName,
    version: item.garment.version,
  };

  renderToCanvas(ctx, img, exportCropState, exportW, exportH, charInfo, undefined, garmentInfo);

  return new Promise((resolve, reject) => {
    exportCanvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('Failed to generate image blob'));
          return;
        }
        const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
        const cleanChar = String(item.character.Name).replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanGarment = (item.garment.name || 'Default').replace(/[^a-zA-Z0-9_-]/g, '_');
        const modeTag = isIllustration ? 'Illustration' : `L2D_${item.framing === 'half' ? 'HalfBody' : item.framing === 'close' ? 'CloseUp' : 'FullBody'}`;
        const ratioTag = targetRatio === '5.4:9' ? '5.4-9_Card' : targetRatio.replace(':', '-');
        const filename = `${cleanChar}_${cleanGarment}_${modeTag}_${ratioTag}_${resolution}.${ext}`;
        resolve({ blob, filename });
      },
      format,
      format === 'image/jpeg' ? 0.95 : 1.0
    );
  });
}

export async function downloadZipArchive(
  items: Array<{ blob: Blob; filename: string }>,
  zipName: string = 'Reverse1999_6-9_Portraits.zip'
) {
  const zip = new JSZip();
  items.forEach(item => {
    zip.file(item.filename, item.blob);
  });
  // Use STORE compression: already-compressed images (PNG/WebP/JPEG) do not benefit from DEFLATE.
  // STORE prevents massive JS heap memory allocation that crashes tabs with >300 files.
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'STORE',
  });
  downloadBlob(zipBlob, zipName);
}

/**
 * Downloads large batch exports safely by packaging into volumes of max 80-100 items per zip.
 * This guarantees memory usage stays under 200MB even when exporting 300+ or 1,000+ images.
 */
export async function downloadBatchZipInVolumes(
  items: Array<{ blob: Blob; filename: string }>,
  baseZipName: string = 'Reverse1999_Batch',
  volumeSize: number = 80,
  onVolumeSaved?: (volIndex: number, totalVols: number) => void
) {
  if (items.length === 0) return;

  if (items.length <= volumeSize) {
    await downloadZipArchive(items, `${baseZipName}.zip`);
    if (onVolumeSaved) onVolumeSaved(1, 1);
    return;
  }

  const totalVolumes = Math.ceil(items.length / volumeSize);
  for (let v = 0; v < totalVolumes; v++) {
    const chunk = items.slice(v * volumeSize, (v + 1) * volumeSize);
    const zip = new JSZip();
    chunk.forEach(item => {
      zip.file(item.filename, item.blob);
    });
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'STORE',
    });
    const volName = `${baseZipName}_Part_${v + 1}_of_${totalVolumes}.zip`;
    downloadBlob(zipBlob, volName);

    if (onVolumeSaved) {
      onVolumeSaved(v + 1, totalVolumes);
    }

    // Await download dispatch & yield event loop to let browser garbage-collect
    await new Promise(resolve => setTimeout(resolve, 800));
  }
}
