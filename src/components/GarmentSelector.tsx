import React, { useState, useMemo } from 'react';
import { Shirt, Sparkles, Image as ImageIcon, Filter } from 'lucide-react';
import { Garment, RenderMode } from '../types';

interface GarmentSelectorProps {
  garments: Garment[];
  selectedGarment: Garment | null;
  onSelectGarment: (garment: Garment) => void;
  renderMode: RenderMode;
  onSelectRenderMode: (mode: RenderMode) => void;
}

export const GarmentSelector: React.FC<GarmentSelectorProps> = ({
  garments,
  selectedGarment,
  onSelectGarment,
  renderMode,
  onSelectRenderMode,
}) => {
  const [selectedSeries, setSelectedSeries] = useState<string>('ALL');

  const availableSeries = useMemo(() => {
    const seriesSet = new Set<string>();
    garments.forEach(g => {
      if (g.seriesName) {
        seriesSet.add(g.seriesName);
      } else if (g.category === 'insight' || g.name.includes('Insight')) {
        seriesSet.add('Insight II');
      } else {
        seriesSet.add('Default Base');
      }
    });
    return Array.from(seriesSet);
  }, [garments]);

  const filteredGarments = useMemo(() => {
    if (selectedSeries === 'ALL') return garments;
    return garments.filter(g => {
      if (selectedSeries === 'Default Base') {
        return g.category === 'default' || g.name === 'Default' || g.garmentId.endsWith('01');
      }
      if (selectedSeries === 'Insight II') {
        return g.category === 'insight' || g.name.includes('Insight');
      }
      return g.seriesName === selectedSeries;
    });
  }, [garments, selectedSeries]);

  const isDefaultGarment = selectedGarment
    ? selectedGarment.category === 'default' ||
      selectedGarment.name === 'Default' ||
      selectedGarment.garmentId.endsWith('01')
    : false;

  // If user selected default outfit while in illustration mode, automatically reset to l2d
  React.useEffect(() => {
    if (isDefaultGarment && renderMode === 'illustration') {
      onSelectRenderMode('l2d');
    }
  }, [isDefaultGarment, renderMode, onSelectRenderMode]);

  if (garments.length === 0) return null;

  return (
    <div className="bg-[#12141e] border border-zinc-800/80 rounded-xl p-3 sm:p-3.5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Shirt className="w-4 h-4 text-[#df6931]" />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              Outfits & Garments ({garments.length})
              <span className="text-[10px] text-amber-400 font-normal lowercase hidden md:inline">
                (Posters auto-match release version)
              </span>
            </h3>
          </div>
        </div>

        {/* Render Mode Toggle: L2D (with poster) vs Illustration (full bleed). Default garment only allows L2D */}
        <div className="inline-flex p-0.5 rounded-lg bg-[#0d0e16] border border-zinc-800 self-start sm:self-auto items-center">
          <button
            type="button"
            onClick={() => onSelectRenderMode('l2d')}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              renderMode === 'l2d'
                ? 'bg-gradient-to-r from-[#df6931] to-amber-600 text-white shadow-sm shadow-[#df6931]/30 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Live2D full body paired with version poster"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Live2D (With Poster)</span>
          </button>

          {!isDefaultGarment ? (
            <button
              type="button"
              onClick={() => onSelectRenderMode('illustration')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                renderMode === 'illustration'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Full-bleed illustration cover with atmospheric backdrop"
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-200" />
              <span>Illustration (Full Bleed)</span>
            </button>
          ) : (
            <span
              className="px-2.5 py-1 text-[11px] text-zinc-500 italic select-none"
              title="Illustration mode is available for Insight II and special Garments"
            >
              (Illu available for Insight II & Skins)
            </span>
          )}
        </div>
      </div>

      {/* Series Filter Chips (when character has multiple garment series) */}
      {availableSeries.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1 mr-1 flex-shrink-0">
            <Filter className="w-3 h-3 text-[#df6931]" />
            Series:
          </span>
          <button
            type="button"
            onClick={() => setSelectedSeries('ALL')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all flex-shrink-0 ${
              selectedSeries === 'ALL'
                ? 'bg-[#df6931] text-white font-bold shadow-sm'
                : 'bg-[#181a26] text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            All Outfits
          </button>
          {availableSeries.map(series => (
            <button
              key={series}
              type="button"
              onClick={() => setSelectedSeries(series)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all flex-shrink-0 ${
                selectedSeries === series
                  ? 'bg-[#df6931] text-white font-bold shadow-sm'
                  : 'bg-[#181a26] text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {series}
            </button>
          ))}
        </div>
      )}

      {/* Garments horizontal list */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filteredGarments.map((garment, idx) => {
          const isSelected = selectedGarment?.garmentId === garment.garmentId;
          const thumb = garment.thumbUrl || `https://assets.merui.net/headicon_small/${garment.garmentId}.webp`;
          const verLabel = garment.version ? `v${garment.version}` : 'v1.0';
          const isBase = garment.category === 'default' || garment.name === 'Default';
          const isInsight = garment.category === 'insight' || garment.name.includes('Insight');
          const categoryTag = isBase ? 'Base' : isInsight ? 'Insight II' : (garment.seriesName || 'Skin');

          return (
            <button
              key={garment.garmentId || idx}
              onClick={() => onSelectGarment(garment)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all flex-shrink-0 ${
                isSelected
                  ? 'bg-[#df6931]/15 border-[#df6931] text-white shadow-sm ring-1 ring-[#df6931]/40'
                  : 'bg-[#181a26] border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
              }`}
            >
              <div className="w-8 h-8 rounded-md overflow-hidden bg-black/50 border border-zinc-700 flex-shrink-0 flex items-center justify-center relative">
                <img
                  src={thumb}
                  alt={garment.name}
                  className="w-full h-full object-cover"
                  onError={e => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              <div className="max-w-[160px]">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold truncate" title={garment.name}>
                    {garment.name || `Skin #${idx + 1}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                  <span className="px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {verLabel}
                  </span>
                  <span className="truncate text-zinc-400 font-sans" title={categoryTag}>
                    {categoryTag}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
