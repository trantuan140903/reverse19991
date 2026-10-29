import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FlipHorizontal,
  Maximize2,
  Grid,
  Move,
  Palette,
  Sparkles,
  Sun,
  Shield,
  Layers,
  Check,
  RefreshCw,
  Camera,
  Film,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair
} from 'lucide-react';
import { AspectRatioType, BackgroundPreset, CharacterItem, CropState, Garment } from '../types';
import {
  calculateFitTransform,
  calculateIllustrationCoverTransform,
  calculateImageBounds,
  getProxyImageUrl,
  getRatioValue,
  renderToCanvas,
  BoundingBox
} from '../utils/cropUtils';
import { VersionPosterSelector } from './VersionPosterSelector';

interface CropperWorkspaceProps {
  imageUrl: string;
  character: CharacterItem | null;
  selectedGarment?: Garment | null;
  storyBgs?: string[];
  cropState: CropState;
  onChangeCropState: (updater: (prev: CropState) => CropState) => void;
  onCanvasReady: (canvas: HTMLCanvasElement, img: HTMLImageElement) => void;
  isLoadingImage?: boolean;
}

const ASPECT_RATIOS: { id: AspectRatioType; label: string; desc: string }[] = [
  { id: '6:9', label: '6:9', desc: 'Standard 6:9 (Full Body)' },
  { id: '5.4:9', label: '5.4:9 Card', desc: '5.4:9 Photocard Bo Góc (54×90mm)' },
  { id: '9:16', label: '9:16', desc: '9:16 Phone Wallpaper' },
  { id: '3:4', label: '3:4', desc: 'Classic 3:4 Portrait' },
  { id: '1:1', label: '1:1', desc: '1:1 Square Avatar' },
  { id: 'original', label: 'Original', desc: 'Original image ratio' },
];

const BACKGROUND_OPTIONS: { id: BackgroundPreset; label: string; previewClass: string }[] = [
  { id: 'transparent', label: 'Transparent (PNG)', previewClass: 'bg-[radial-gradient(#444_1px,transparent_1px)] [background-size:8px_8px] bg-zinc-900' },
  { id: 'illustration-backdrop', label: 'Obsidian Studio', previewClass: 'bg-gradient-to-br from-[#1c1f2e] via-[#12141d] to-[#08090d]' },
  { id: 'vintage-gold', label: 'Arcanist Amber', previewClass: 'bg-gradient-to-br from-[#2b1e15] to-[#0e0b07]' },
];

export const CropperWorkspace: React.FC<CropperWorkspaceProps> = ({
  imageUrl,
  character,
  selectedGarment,
  storyBgs,
  cropState,
  onChangeCropState,
  onCanvasReady,
  isLoadingImage = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [imageBounds, setImageBounds] = useState<BoundingBox | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; origOffsetX: number; origOffsetY: number }>({
    x: 0,
    y: 0,
    origOffsetX: 0,
    origOffsetY: 0,
  });
  const [showGrid, setShowGrid] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [posterTick, setPosterTick] = useState(0);

  // Load image with proxy URL to guarantee CORS is allowed
  useEffect(() => {
    if (!imageUrl) return;

    setLoadingError(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const proxiedUrl = getProxyImageUrl(imageUrl);
    img.src = proxiedUrl;

    img.onload = () => {
      setLoadedImg(img);
      try {
        const bounds = calculateImageBounds(img);
        setImageBounds(bounds);

        // Auto-fit immediately on first load
        const targetH = 1080;
        const ratioVal = getRatioValue(cropState.aspectRatio, img.naturalWidth, img.naturalHeight);
        const targetW = Math.round(targetH * ratioVal);

        const fit = cropState.renderMode === 'illustration'
          ? calculateIllustrationCoverTransform(img.naturalWidth, img.naturalHeight, targetW, targetH)
          : calculateFitTransform(img.naturalWidth, img.naturalHeight, bounds, targetW, targetH, 0.05);

        onChangeCropState(prev => ({
          ...prev,
          scale: fit.scale,
          offsetX: fit.offsetX,
          offsetY: fit.offsetY,
          rotation: 0,
        }));
      } catch (err: any) {
        console.warn('Error calculating image bounds:', err);
      }
    };

    img.onerror = () => {
      setLoadingError('Failed to load image. Please check your network connection or try another asset.');
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, cropState.renderMode]);

  const ratioVal = getRatioValue(
    cropState.aspectRatio,
    loadedImg?.naturalWidth || 6,
    loadedImg?.naturalHeight || 9
  );
  const previewCanvasHeight = 1080;
  const previewCanvasWidth = Math.round(previewCanvasHeight * ratioVal);

  // Redraw canvas whenever parameters change or poster loads
  useEffect(() => {
    if (!canvasRef.current || !loadedImg) return;
    const canvas = canvasRef.current;
    canvas.width = previewCanvasWidth;
    canvas.height = previewCanvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const charInfo = character
      ? {
          name: String(character.Name),
          rarity: character.Rarity,
          afflatus: character.Afflatus,
          race: character.Race,
        }
      : undefined;

    const garmentInfo = selectedGarment
      ? {
          name: selectedGarment.name,
          seriesName: selectedGarment.seriesName,
          version: selectedGarment.version,
        }
      : undefined;

    renderToCanvas(
      ctx,
      loadedImg,
      cropState,
      previewCanvasWidth,
      previewCanvasHeight,
      charInfo,
      () => setPosterTick(t => t + 1),
      garmentInfo
    );

    onCanvasReady(canvas, loadedImg);
  }, [loadedImg, cropState, previewCanvasWidth, previewCanvasHeight, character, selectedGarment, posterTick]);

  // Auto-fit Full Body action (or Cover fill in illustration mode)
  const handleAutoFitFullBody = useCallback(() => {
    if (!loadedImg) return;

    if (cropState.renderMode === 'illustration') {
      const coverFit = calculateIllustrationCoverTransform(
        loadedImg.naturalWidth,
        loadedImg.naturalHeight,
        previewCanvasWidth,
        previewCanvasHeight
      );
      onChangeCropState(prev => ({
        ...prev,
        scale: coverFit.scale,
        offsetX: coverFit.offsetX,
        offsetY: coverFit.offsetY,
        rotation: 0,
      }));
      return;
    }

    const bounds = imageBounds || calculateImageBounds(loadedImg);
    const fit = calculateFitTransform(
      loadedImg.naturalWidth,
      loadedImg.naturalHeight,
      bounds,
      previewCanvasWidth,
      previewCanvasHeight,
      0.05
    );

    onChangeCropState(prev => ({
      ...prev,
      scale: fit.scale,
      offsetX: fit.offsetX,
      offsetY: fit.offsetY,
      rotation: 0,
    }));
  }, [loadedImg, imageBounds, previewCanvasWidth, previewCanvasHeight, cropState.renderMode, onChangeCropState]);

  // Re-fit automatically when switching between L2D and Illustration
  useEffect(() => {
    if (loadedImg) {
      handleAutoFitFullBody();
    }
  }, [cropState.renderMode]);

  // Quick framing presets
  const handleSetFramingPreset = (preset: 'full' | 'head' | 'torso') => {
    if (!loadedImg) return;
    const bounds = imageBounds || calculateImageBounds(loadedImg);

    if (preset === 'full') {
      handleAutoFitFullBody();
      return;
    }

    const baseFit = calculateFitTransform(
      loadedImg.naturalWidth,
      loadedImg.naturalHeight,
      bounds,
      previewCanvasWidth,
      previewCanvasHeight,
      0.05
    );

    if (preset === 'head') {
      const zoomScale = baseFit.scale * 2.2;
      const headCenterY = bounds.minY + bounds.height * 0.2;
      const headCenterX = bounds.minX + bounds.width * 0.5;

      onChangeCropState(prev => ({
        ...prev,
        scale: zoomScale,
        offsetX: previewCanvasWidth / 2 - headCenterX * zoomScale,
        offsetY: previewCanvasHeight * 0.4 - headCenterY * zoomScale,
      }));
    } else if (preset === 'torso') {
      const zoomScale = baseFit.scale * 1.5;
      const torsoCenterY = bounds.minY + bounds.height * 0.35;
      const torsoCenterX = bounds.minX + bounds.width * 0.5;

      onChangeCropState(prev => ({
        ...prev,
        scale: zoomScale,
        offsetX: previewCanvasWidth / 2 - torsoCenterX * zoomScale,
        offsetY: previewCanvasHeight * 0.45 - torsoCenterY * zoomScale,
      }));
    }
  };

  // Mouse & Touch Dragging Handlers
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number; origOffsetX: number; origOffsetY: number } | null>(null);
  const [pinchDist, setPinchDist] = useState<number | null>(null);
  const [pinchScale, setPinchScale] = useState<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      origOffsetX: cropState.offsetX,
      origOffsetY: cropState.offsetY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleFactor = previewCanvasHeight / rect.height;

    const deltaX = (e.clientX - dragStart.x) * scaleFactor;
    const deltaY = (e.clientY - dragStart.y) * scaleFactor;

    onChangeCropState(prev => ({
      ...prev,
      offsetX: dragStart.origOffsetX + deltaX,
      offsetY: dragStart.origOffsetY + deltaY,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mobile Touch handlers: 1-finger pan, 2-finger pinch to zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      setTouchStartPos({
        x: t.clientX,
        y: t.clientY,
        origOffsetX: cropState.offsetX,
        origOffsetY: cropState.offsetY,
      });
      setPinchDist(null);
      setIsDragging(true);
    } else if (e.touches.length >= 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      setPinchDist(dist);
      setPinchScale(cropState.scale);
      setTouchStartPos(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleFactor = previewCanvasHeight / rect.height;

    if (e.touches.length === 1 && touchStartPos) {
      const t = e.touches[0];
      const deltaX = (t.clientX - touchStartPos.x) * scaleFactor;
      const deltaY = (t.clientY - touchStartPos.y) * scaleFactor;

      onChangeCropState(prev => ({
        ...prev,
        offsetX: touchStartPos.origOffsetX + deltaX,
        offsetY: touchStartPos.origOffsetY + deltaY,
      }));
    } else if (e.touches.length >= 2 && pinchDist && pinchScale) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = dist / pinchDist;
      const newScale = Math.max(0.1, Math.min(8, pinchScale * ratio));

      onChangeCropState(prev => ({
        ...prev,
        scale: newScale,
      }));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchStartPos(null);
    setPinchDist(null);
    setPinchScale(null);
  };

  // Directional Nudge handlers for easy mobile & precision positioning
  const handleNudge = (dx: number, dy: number) => {
    onChangeCropState(prev => ({
      ...prev,
      offsetX: prev.offsetX + dx,
      offsetY: prev.offsetY + dy,
    }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
    onChangeCropState(prev => {
      const newScale = Math.max(0.1, Math.min(10, prev.scale * zoomFactor));
      const centerX = previewCanvasWidth / 2;
      const centerY = previewCanvasHeight / 2;
      const newOffsetX = centerX - (centerX - prev.offsetX) * (newScale / prev.scale);
      const newOffsetY = centerY - (centerY - prev.offsetY) * (newScale / prev.scale);

      return {
        ...prev,
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      };
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Visual Canvas Display Area */}
      <div className="w-full lg:w-7/12 flex flex-col items-center">
        {/* Aspect Ratio Selector Tabs */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 font-medium mr-1 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-[#df6931]" />
              Ratio:
            </span>
            {ASPECT_RATIOS.map(ratio => {
              const isSelected = cropState.aspectRatio === ratio.id;
              return (
                <button
                  key={ratio.id}
                  onClick={() => {
                    onChangeCropState(prev => ({
                      ...prev,
                      aspectRatio: ratio.id,
                      enableRoundedCorners: ratio.id === '5.4:9' ? true : prev.enableRoundedCorners,
                    }));
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#df6931] text-white shadow-md shadow-[#df6931]/30 ring-1 ring-white/20'
                      : 'bg-[#151724] border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                  title={ratio.desc}
                >
                  {ratio.label}
                </button>
              );
            })}
          </div>

          {/* Quick Framing Presets */}
          <div className="flex items-center gap-1 pl-2">
            <button
              onClick={() => handleSetFramingPreset('full')}
              className="px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-[#df6931] border border-[#df6931]/30 text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Fit full body portrait into frame"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Full Body</span>
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded-md border text-xs transition-colors ${
                showGrid
                  ? 'bg-zinc-700 border-zinc-600 text-white'
                  : 'bg-[#151724] border-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title="Toggle Rule-of-Thirds Composition Grid"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Viewport Frame Container */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{
            aspectRatio: `${previewCanvasWidth} / ${previewCanvasHeight}`,
            borderRadius: cropState.enableRoundedCorners
              ? `${Math.round((cropState.cornerRadius || 36) * 0.55)}px`
              : '16px',
            touchAction: 'none',
          }}
          className={`relative w-full max-w-[420px] sm:max-w-[480px] max-h-[68vh] overflow-hidden border-2 shadow-2xl bg-[#090a10] select-none cursor-grab touch-none transition-all ${
            cropState.enableRoundedCorners
              ? 'border-amber-500/80 shadow-amber-500/20 ring-2 ring-amber-500/30'
              : 'border-amber-900/40'
          } ${isDragging ? 'cursor-grabbing' : ''}`}
        >
          {/* Loading Indicator */}
          {isLoadingImage && (
            <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-amber-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium">Loading character artwork...</p>
            </div>
          )}

          {/* Error Message */}
          {loadingError && (
            <div className="absolute inset-0 z-30 bg-red-950/80 p-6 flex flex-col items-center justify-center text-center text-red-200 gap-2">
              <p className="text-sm font-semibold">{loadingError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-3 py-1.5 rounded bg-red-800 text-white text-xs"
              >
                Reload Page
              </button>
            </div>
          )}

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* Rule of Thirds Grid */}
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3 border border-amber-500/20">
              <div className="border-r border-b border-amber-500/20" />
              <div className="border-r border-b border-amber-500/20" />
              <div className="border-b border-amber-500/20" />
              <div className="border-r border-b border-amber-500/20" />
              <div className="border-r border-b border-amber-500/20" />
              <div className="border-b border-amber-500/20" />
              <div className="border-r border-b border-amber-500/20" />
              <div className="border-r border-b border-amber-500/20" />
              <div />
            </div>
          )}

          {/* Ratio Indicator Badge */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono font-medium text-amber-400 border border-amber-500/40 flex items-center gap-1.5 shadow-md">
            <span>
              {cropState.aspectRatio === '5.4:9'
                ? '5.4:9 CARD'
                : cropState.aspectRatio === '6:9'
                ? '6:9 FULL BODY'
                : cropState.aspectRatio}
            </span>
            {cropState.enableRoundedCorners && (
              <span className="text-amber-300 font-bold">• ROUNDED CARD ({cropState.cornerRadius || 36}px)</span>
            )}
          </div>

          {/* Drag to move hint */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] text-zinc-400 flex items-center gap-1 border border-zinc-700/60 opacity-80 hover:opacity-100 transition-opacity">
            <Move className="w-3 h-3 text-[#df6931]" />
            <span>Drag / Touch to pan • Pinch to zoom</span>
          </div>
        </div>

        {/* Interactive Character Positioning & Zoom Pad */}
        <div className="w-full max-w-[480px] mt-3 space-y-2 px-1">
          {/* Zoom Slider + Direct Zoom Buttons */}
          <div className="flex items-center justify-between gap-2.5 bg-[#12141f] border border-zinc-800/80 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2 flex-1">
              <button
                type="button"
                onClick={() => {
                  onChangeCropState(prev => ({
                    ...prev,
                    scale: Math.max(0.1, prev.scale * 0.9),
                  }));
                }}
                className="p-1.5 rounded-lg bg-[#181a26] border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 active:scale-95 transition-all"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <input
                type="range"
                min="0.1"
                max="5"
                step="0.05"
                value={cropState.scale}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  onChangeCropState(prev => ({ ...prev, scale: val }));
                }}
                className="flex-1 accent-[#df6931] h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />

              <button
                type="button"
                onClick={() => {
                  onChangeCropState(prev => ({
                    ...prev,
                    scale: Math.min(5, prev.scale * 1.1),
                  }));
                }}
                className="p-1.5 rounded-lg bg-[#181a26] border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 active:scale-95 transition-all"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAutoFitFullBody}
              className="px-2.5 py-1.5 rounded-lg bg-[#181a26] border border-zinc-800 text-[11px] font-semibold text-amber-300 hover:text-white hover:border-amber-600/50 flex items-center gap-1 active:scale-95 transition-all"
              title="Auto-fit full character body"
            >
              <RotateCcw className="w-3 h-3 text-amber-500" />
              <span>Fit</span>
            </button>
          </div>

          {/* On-Screen Mobile & Precision Position Nudge Pad */}
          <div className="flex items-center justify-between gap-2 bg-[#12141f] border border-zinc-800/80 rounded-xl px-3 py-2 text-xs">
            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
              <Crosshair className="w-3.5 h-3.5 text-[#df6931]" />
              <span>Position:</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleNudge(-30, 0)}
                className="p-1.5 rounded-lg bg-[#181a26] border border-zinc-800 text-zinc-300 hover:text-white hover:border-amber-600/40 active:bg-amber-600/20 active:scale-90 transition-all"
                title="Pan Left (30px)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleNudge(0, -30)}
                className="p-1.5 rounded-lg bg-[#181a26] border border-zinc-800 text-zinc-300 hover:text-white hover:border-amber-600/40 active:bg-amber-600/20 active:scale-90 transition-all"
                title="Pan Up (30px)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleNudge(0, 30)}
                className="p-1.5 rounded-lg bg-[#181a26] border border-zinc-800 text-zinc-300 hover:text-white hover:border-amber-600/40 active:bg-amber-600/20 active:scale-90 transition-all"
                title="Pan Down (30px)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleNudge(30, 0)}
                className="p-1.5 rounded-lg bg-[#181a26] border border-zinc-800 text-zinc-300 hover:text-white hover:border-amber-600/40 active:bg-amber-600/20 active:scale-90 transition-all"
                title="Pan Right (30px)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
              <span className="px-1.5 py-0.5 rounded bg-black/40 border border-zinc-800">
                X:{Math.round(cropState.offsetX)}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-black/40 border border-zinc-800">
                Y:{Math.round(cropState.offsetY)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls & Fine-Tuning Sidebar */}
      <div className="w-full lg:w-5/12 space-y-4">
        {/* 1. Version Poster Background Selector (exclusively from gallery/posters) */}
        <VersionPosterSelector
          character={character}
          selectedGarment={selectedGarment}
          cropState={cropState}
          onChangeCropState={onChangeCropState}
        />

        {/* 2. Framing Presets Panel */}
        <div className="bg-[#12141e] border border-zinc-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#df6931]" />
              Camera Framing & Orientation
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleSetFramingPreset('full')}
              className="px-3 py-2 rounded-lg bg-[#181a26] hover:bg-[#202333] border border-zinc-800 hover:border-amber-600/50 text-left transition-all"
            >
              <p className="text-xs font-semibold text-white">Full Body</p>
              <span className="text-[10px] text-zinc-400">Head-to-toe portrait</span>
            </button>

            <button
              onClick={() => handleSetFramingPreset('torso')}
              className="px-3 py-2 rounded-lg bg-[#181a26] hover:bg-[#202333] border border-zinc-800 hover:border-amber-600/50 text-left transition-all"
            >
              <p className="text-xs font-semibold text-white">Half Body</p>
              <span className="text-[10px] text-zinc-400">Torso & waist view</span>
            </button>

            <button
              onClick={() => handleSetFramingPreset('head')}
              className="px-3 py-2 rounded-lg bg-[#181a26] hover:bg-[#202333] border border-zinc-800 hover:border-amber-600/50 text-left transition-all"
            >
              <p className="text-xs font-semibold text-white">Close-Up</p>
              <span className="text-[10px] text-zinc-400">Portrait & facial focus</span>
            </button>
          </div>

          {/* Flip & Rotation */}
          <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-4">
            <button
              onClick={() => onChangeCropState(prev => ({ ...prev, flipH: !prev.flipH }))}
              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                cropState.flipH
                  ? 'bg-[#df6931]/20 border-[#df6931] text-white'
                  : 'bg-[#181a26] border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <FlipHorizontal className="w-4 h-4 text-amber-500" />
              <span>Mirror Horizontal</span>
            </button>

            <div className="flex-1 flex items-center gap-2">
              <span className="text-[11px] text-zinc-400 whitespace-nowrap">Rotate:</span>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={cropState.rotation}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  onChangeCropState(prev => ({ ...prev, rotation: val }));
                }}
                className="w-full accent-[#df6931] h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] font-mono text-zinc-400 w-7 text-right">
                {cropState.rotation}°
              </span>
            </div>
          </div>
        </div>

        {/* 3. Background Styles Palette */}
        <div className="bg-[#12141e] border border-zinc-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[#df6931]" />
              Alternative Studio Backdrops
            </h3>
            <span className="text-[11px] text-zinc-500 capitalize">
              {cropState.bgPreset.replace('-', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BACKGROUND_OPTIONS.map(bg => {
              const isSelected = cropState.bgPreset === bg.id;
              return (
                <button
                  key={bg.id}
                  onClick={() => onChangeCropState(prev => ({ ...prev, bgPreset: bg.id }))}
                  className={`flex items-center gap-1.5 p-2 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-[#df6931] bg-[#df6931]/10 text-white ring-1 ring-[#df6931]/40'
                      : 'border-zinc-800 bg-[#181a26] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border border-white/20 flex-shrink-0 ${bg.previewClass}`} />
                  <span className="text-xs font-medium truncate">{bg.label}</span>
                </button>
              );
            })}
          </div>

          {cropState.bgPreset === 'solid' && (
            <div className="pt-2 border-t border-zinc-800/60 flex items-center gap-3">
              <span className="text-xs text-zinc-400">Custom Color:</span>
              <input
                type="color"
                value={cropState.customBgColor}
                onChange={e => {
                  const color = e.target.value;
                  onChangeCropState(prev => ({ ...prev, customBgColor: color }));
                }}
                className="w-8 h-8 rounded border border-zinc-700 bg-transparent cursor-pointer"
              />
              <span className="text-xs font-mono text-zinc-300">
                {cropState.customBgColor}
              </span>
            </div>
          )}

          {/* Shadow toggle */}
          <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none hover:text-white">
              <input
                type="checkbox"
                checked={cropState.enableShadow}
                disabled={cropState.bgPreset === 'transparent'}
                onChange={e => onChangeCropState(prev => ({ ...prev, enableShadow: e.target.checked }))}
                className="rounded accent-[#df6931] cursor-pointer"
              />
              <span className={cropState.bgPreset === 'transparent' ? 'text-zinc-600' : ''}>
                Character Drop Shadow (Silhouette Depth)
              </span>
            </label>
          </div>
        </div>

        {/* 4. Luxury Reverse: 1999 Frame Style Selector */}
        <div className="bg-[#12141e] border border-zinc-800/80 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Luxury Frame Style
            </h3>
            <span className="text-[11px] font-mono text-amber-400">
              {cropState.frameStyle || 'none'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'art-deco-gold', label: 'Art Deco Gold', desc: 'Gilded corner accents' },
              { id: 'celestial-astrolabe', label: 'Celestial Astrolabe', desc: 'Clockwork & dial motif' },
              { id: 'gothic-arcanum', label: 'Gothic Arcanum', desc: 'Cathedral gothic arches' },
              { id: 'none', label: 'No Frame', desc: 'Clean full-bleed edge' },
            ].map(f => {
              const isSelected = (cropState.frameStyle || 'none') === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => onChangeCropState(prev => ({ ...prev, frameStyle: f.id as any }))}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-[#df6931] bg-[#df6931]/15 text-white ring-1 ring-[#df6931]'
                      : 'border-zinc-800 bg-[#181a26] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  <p className="text-xs font-bold">{f.label}</p>
                  <span className="text-[10px] text-zinc-500">{f.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Creative Watermark Typography (Name & Stars) */}
        <div className="bg-[#12141e] border border-zinc-800/80 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                Watermark Typography & Badge
              </h3>
              <p className="text-[11px] text-zinc-400">
                Luxury metallic typography displaying character name, stars & affinity
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={cropState.showBadge && cropState.watermarkStyle !== 'none'}
                onChange={e => onChangeCropState(prev => ({
                  ...prev,
                  showBadge: e.target.checked,
                  watermarkStyle: e.target.checked ? (prev.watermarkStyle === 'none' ? 'silver-gold-metallic' : prev.watermarkStyle) : 'none'
                }))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#df6931]"></div>
            </label>
          </div>

          {cropState.showBadge && cropState.watermarkStyle !== 'none' && (
            <div className="space-y-2.5 pt-1 border-t border-zinc-800/60">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'silver-gold-metallic', label: 'Silver & Gold', note: 'Specular Chromatic' },
                  { id: 'art-deco-gold', label: 'Art Deco Gold', note: 'Warm Gold Plaque' },
                  { id: 'cinematic', label: 'Cinematic Sub', note: 'Centered Letterbox' },
                  { id: 'gilded-manuscript', label: 'Gilded Script', note: 'Illuminated Serif' },
                ].map(w => {
                  const isSelected = cropState.watermarkStyle === w.id;
                  return (
                    <button
                      key={w.id}
                      onClick={() => onChangeCropState(prev => ({ ...prev, watermarkStyle: w.id as any }))}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/15 text-white ring-1 ring-amber-500'
                          : 'border-zinc-800 bg-[#181a26] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <p className="text-xs font-bold truncate">{w.label}</p>
                      <span className="text-[10px] text-zinc-500 block truncate">{w.note}</span>
                    </button>
                  );
                })}
              </div>

              {/* Display Afflatus Toggle */}
              <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none hover:text-white">
                  <input
                    type="checkbox"
                    checked={cropState.showAfflatus}
                    onChange={e => onChangeCropState(prev => ({ ...prev, showAfflatus: e.target.checked }))}
                    className="rounded accent-[#df6931] cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <span>Display Afflatus (Affinity)</span>
                    {character?.Afflatus && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {character.Afflatus}
                      </span>
                    )}
                  </span>
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {cropState.showAfflatus ? 'Active' : 'Off'}
                </span>
              </div>

              {/* Display Gold Afflatus Symbol (matching text color, left of character name) */}
              <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none hover:text-white">
                  <input
                    type="checkbox"
                    checked={cropState.showAfflatusSymbol ?? true}
                    onChange={e => onChangeCropState(prev => ({ ...prev, showAfflatusSymbol: e.target.checked }))}
                    className="rounded accent-[#df6931] cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <span>Gold Afflatus Emblem (Left of Name)</span>
                    {character?.Afflatus && (
                      <span className="text-[10px] text-amber-400 font-serif italic">
                        ✦ {character.Afflatus}
                      </span>
                    )}
                  </span>
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {(cropState.showAfflatusSymbol ?? true) ? 'Active' : 'Off'}
                </span>
              </div>

              {/* Display Character Race Toggle */}
              <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none hover:text-white">
                  <input
                    type="checkbox"
                    checked={cropState.showRace}
                    onChange={e => onChangeCropState(prev => ({ ...prev, showRace: e.target.checked }))}
                    className="rounded accent-[#df6931] cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <span>Display Character Race</span>
                    {character?.Race && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-cyan-300 border border-cyan-500/30">
                        {character.Race}
                      </span>
                    )}
                  </span>
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {cropState.showRace ? 'Active' : 'Off'}
                </span>
              </div>

              {/* Display Garment Name in top-left corner */}
              <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none hover:text-white">
                  <input
                    type="checkbox"
                    checked={cropState.showGarmentName}
                    onChange={e => onChangeCropState(prev => ({ ...prev, showGarmentName: e.target.checked }))}
                    className="rounded accent-[#df6931] cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <span>Display Garment Plaque (Top-Left Badge)</span>
                    {selectedGarment?.name && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-amber-300 bg-amber-500/20 border border-amber-500/30 truncate max-w-[140px]">
                        {selectedGarment.name}
                      </span>
                    )}
                  </span>
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {cropState.showGarmentName ? 'Active' : 'Off'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
