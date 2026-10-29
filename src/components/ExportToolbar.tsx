import React, { useState } from 'react';
import { Download, Copy, Check, Sparkles, Loader2 } from 'lucide-react';
import { CropState, ExportFormat, CharacterItem, Garment } from '../types';
import { downloadBlob, getResolutionDimensions, getRatioValue, renderToCanvas } from '../utils/cropUtils';

interface ExportToolbarProps {
  cropState: CropState;
  character: CharacterItem | null;
  selectedGarment: Garment | null;
  loadedImg: HTMLImageElement | null;
  onOpenBatchModal?: () => void;
}

export const ExportToolbar: React.FC<ExportToolbarProps> = ({
  cropState,
  character,
  selectedGarment,
  loadedImg,
  onOpenBatchModal,
}) => {
  const resolution = '4k'; // Permanently locked to 4K Ultra Max
  const [format, setFormat] = useState<ExportFormat>('image/png');
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const charName = character ? String(character.Name) : 'Character';
  const garmentName = selectedGarment?.name || 'Default';

  // Compute final dimensions
  const ratioVal = getRatioValue(
    cropState.aspectRatio,
    loadedImg?.naturalWidth || 6,
    loadedImg?.naturalHeight || 9
  );
  const { width: exportW, height: exportH } = getResolutionDimensions(resolution, ratioVal);

  const handleExport = async () => {
    if (!loadedImg) return;
    setIsExporting(true);

    try {
      // Offscreen high-resolution canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportW;
      exportCanvas.height = exportH;

      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Re-scale offsets and scales proportionately from preview canvas (height 1080)
      const scaleMultiplier = exportH / 1080;
      const exportCropState: CropState = {
        ...cropState,
        scale: cropState.scale * scaleMultiplier,
        offsetX: cropState.offsetX * scaleMultiplier,
        offsetY: cropState.offsetY * scaleMultiplier,
      };

      const charInfo = character
        ? {
            name: charName,
            rarity: character.Rarity,
            afflatus: character.Afflatus,
            version: character.Version,
            race: character.Race,
          }
        : undefined;

      const garmentInfo = {
        name: garmentName,
        seriesName: selectedGarment?.seriesName,
        version: selectedGarment?.version,
      };

      renderToCanvas(ctx, loadedImg, exportCropState, exportW, exportH, charInfo, undefined, garmentInfo);

      // Convert to blob and download
      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
      const cleanName = charName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanGarment = garmentName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const ratioTag = cropState.aspectRatio === '5.4:9' ? '5.4-9_Card' : cropState.aspectRatio.replace(':', '-');
      const cornerTag = cropState.enableRoundedCorners ? '_Rounded' : '';
      const filename = `${cleanName}_${cleanGarment}_${ratioTag}${cornerTag}_${resolution}.${ext}`;

      exportCanvas.toBlob(
        blob => {
          if (blob) {
            downloadBlob(blob, filename);
          }
          setIsExporting(false);
        },
        format,
        format === 'image/jpeg' ? 0.95 : 1.0
      );
    } catch (err: any) {
      console.error('Export error:', err);
      setIsExporting(false);
    }
  };

  const handleCopyClipboard = async () => {
    if (!loadedImg) return;
    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportW;
      exportCanvas.height = exportH;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      const scaleMultiplier = exportH / 1080;
      const exportCropState: CropState = {
        ...cropState,
        scale: cropState.scale * scaleMultiplier,
        offsetX: cropState.offsetX * scaleMultiplier,
        offsetY: cropState.offsetY * scaleMultiplier,
      };

      const charInfo = character
        ? {
            name: charName,
            rarity: character.Rarity,
            afflatus: character.Afflatus,
            version: character.Version,
            race: character.Race,
          }
        : undefined;

      const garmentInfo = {
        name: garmentName,
        seriesName: selectedGarment?.seriesName,
        version: selectedGarment?.version,
      };

      renderToCanvas(ctx, loadedImg, exportCropState, exportW, exportH, charInfo, undefined, garmentInfo);

      exportCanvas.toBlob(async blob => {
        if (!blob) return;
        try {
          // Clipboard API requires image/png
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch (copyErr) {
          console.warn('Clipboard write error:', copyErr);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
    }
  };

  return (
    <div className="bg-[#0f111a] border border-amber-900/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-serif font-bold text-base sm:text-lg text-white tracking-wide flex items-center gap-2">
            <Download className="w-5 h-5 text-[#df6931]" />
            High-Resolution Portrait Export (4K Max)
          </h3>
          <p className="text-xs text-zinc-400">
            Export {cropState.aspectRatio} portrait at master 4K studio resolution ({exportW} × {exportH} px)
          </p>
        </div>

        {/* Dimension indicator badge */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-black/50 border border-amber-500/30 text-xs font-mono text-amber-300 font-bold">
            4K MAX • {exportW} × {exportH}
          </span>
          <span className="text-xs text-zinc-400 font-mono uppercase bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
            {format.replace('image/', '')}
          </span>
        </div>
      </div>

      {/* Options Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
        {/* Fixed 4K Max Quality Indicator */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Master Studio Resolution:</label>
          <div className="p-2.5 rounded-xl border border-[#df6931]/40 bg-[#141624] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#df6931]/20 border border-[#df6931]/40 flex items-center justify-center text-[#df6931]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>4K Ultra Max ({exportW} × {exportH})</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">3600px studio fidelity archival export</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#df6931]/20 border border-[#df6931]/40 text-[10px] font-mono font-bold text-amber-300">
              4K ONLY
            </span>
          </div>
        </div>

        {/* Format selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">File Format:</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'image/png' as ExportFormat, label: 'PNG', note: 'Lossless & Alpha' },
              { id: 'image/webp' as ExportFormat, label: 'WebP', note: 'Light & Crisp' },
              { id: 'image/jpeg' as ExportFormat, label: 'JPEG', note: 'Universal' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setFormat(item.id)}
                className={`py-2 px-1 rounded-lg border text-center transition-all ${
                  format === item.id
                    ? 'bg-amber-600/20 border-amber-500 text-white shadow-sm ring-1 ring-amber-500'
                    : 'bg-[#151724] border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                <div className="text-xs font-bold">{item.label}</div>
                <div className="text-[10px] text-zinc-500">{item.note}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
        {/* Main 4K Download Button */}
        <button
          onClick={handleExport}
          disabled={!loadedImg || isExporting}
          className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#df6931] to-[#e87b46] hover:from-[#e35c20] hover:to-[#df6931] text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-[#df6931]/30 hover:shadow-[#df6931]/40 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Rendering 4K ({exportW}×{exportH})...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>Download 4K Portrait</span>
            </>
          )}
        </button>

        {/* Batch Export Modal Trigger */}
        {onOpenBatchModal && (
          <button
            onClick={onOpenBatchModal}
            className="w-full sm:w-auto py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-600/30 to-amber-700/30 hover:bg-amber-600/40 border border-amber-600/50 text-amber-200 font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            title="Batch export multiple character outfits & portraits (ZIP)"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Bulk Export Studio</span>
          </button>
        )}

        {/* Copy to Clipboard Button */}
        <button
          onClick={handleCopyClipboard}
          disabled={!loadedImg || isExporting}
          className="w-full sm:w-auto py-3.5 px-5 rounded-xl bg-[#1b1e2c] hover:bg-[#232739] border border-zinc-700 hover:border-zinc-600 text-zinc-200 font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
          title="Copy image to clipboard (Paste directly into Discord, Photoshop, etc.)"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-zinc-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

