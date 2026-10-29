import React, { useState } from 'react';
import { Film, Sliders, Image as ImageIcon, ChevronRight, Sparkles, Eye, Layers, ExternalLink, Shirt } from 'lucide-react';
import { CharacterItem, CropState, Garment } from '../types';
import { GALLERY_POSTERS, getGalleryPosterForVersion, GalleryPoster } from '../data/galleryPosters';
import { renderPurePosterToBlob, downloadBlob } from '../utils/cropUtils';

interface VersionPosterSelectorProps {
  character: CharacterItem | null;
  selectedGarment?: Garment | null;
  cropState: CropState;
  onChangeCropState: (updater: (prev: CropState) => CropState) => void;
}

export const VersionPosterSelector: React.FC<VersionPosterSelectorProps> = ({
  character,
  selectedGarment,
  cropState,
  onChangeCropState,
}) => {
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [selectedLang, setSelectedLang] = useState<'ALL' | 'EN' | 'CN'>('EN');

  const charVersion = character?.Version || '1.0';
  const garmentVersion = selectedGarment?.version || charVersion;

  const charPoster = getGalleryPosterForVersion(charVersion);
  const garmentPoster = getGalleryPosterForVersion(garmentVersion);

  // Posters exclusively from https://uttu.merui.net/gallery/posters/
  const filteredPosters = GALLERY_POSTERS.filter(p => {
    if (selectedLang === 'ALL') return true;
    return p.lang === selectedLang || p.lang === 'EN';
  });

  const isPosterActive = cropState.bgPreset === 'version-poster';

  const handleSelectPoster = (poster: GalleryPoster) => {
    onChangeCropState(prev => ({
      ...prev,
      bgPreset: 'version-poster',
      posterUrl: poster.url,
    }));
  };

  const isUsingGarmentPoster = isPosterActive && cropState.posterUrl === garmentPoster.url;
  const isUsingCharPoster = isPosterActive && cropState.posterUrl === charPoster.url;

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isPosterActive
        ? 'bg-[#151826] border-[#df6931]/60 shadow-lg shadow-[#df6931]/10'
        : 'bg-[#12141e] border-zinc-800/80 hover:border-zinc-700'
    } space-y-3.5`}>
      {/* Top Header & Activation Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-[#df6931]" />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
              Version Poster
              {garmentVersion !== charVersion ? (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Outfit v{garmentVersion} (Base v{charVersion})
                </span>
              ) : (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  v{charVersion}
                </span>
              )}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://uttu.merui.net/gallery/posters/"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-zinc-400 hover:text-amber-300 flex items-center gap-1 hover:underline"
            title="Browse official poster gallery"
          >
            <span>gallery/posters</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>

          <button
            onClick={() => {
              if (!isPosterActive) {
                const targetUrl = cropState.posterUrl || garmentPoster.url || charPoster.url;
                onChangeCropState(prev => ({
                  ...prev,
                  bgPreset: 'version-poster',
                  posterUrl: targetUrl,
                }));
              } else {
                onChangeCropState(prev => ({
                  ...prev,
                  bgPreset: 'transparent',
                }));
              }
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isPosterActive
                ? 'bg-[#df6931] text-white shadow-sm ring-1 ring-white/20'
                : 'bg-[#1a1d2c] border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>{isPosterActive ? 'Poster Enabled' : 'Enable Poster'}</span>
          </button>

          {/* Download Pure Poster 6:9 button */}
          <button
            onClick={async () => {
              const targetUrl = cropState.posterUrl || garmentPoster.url || charPoster.url;
              if (!targetUrl) return;
              try {
                const { blob, filename } = await renderPurePosterToBlob(targetUrl, '2k', 'image/png', cropState.frameStyle);
                downloadBlob(blob, `Poster_v${garmentVersion}_6-9_Pure.png`);
              } catch (err) {
                console.error('Failed to download pure poster:', err);
              }
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-600/40 hover:bg-amber-900/50 flex items-center gap-1 transition-colors"
            title="Download pure 6:9 poster without character"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Download 6:9 Poster</span>
          </button>
        </div>
      </div>

      {/* Featured Posters: Skin Version Poster vs Character Base Version Poster */}
      {garmentVersion !== charVersion && (
        <div className="bg-[#10121d] border border-amber-700/40 rounded-lg p-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Shirt className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-zinc-300 text-[11px]">
              Outfit <strong>{selectedGarment?.name}</strong> released in <strong>v{garmentVersion}</strong>:
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSelectPoster(garmentPoster)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all ${
                isUsingGarmentPoster
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-[#181b29] border border-zinc-700 text-zinc-300 hover:text-white'
              }`}
            >
              <span>Outfit Poster (v{garmentVersion})</span>
              {isUsingGarmentPoster && <span className="text-[10px] text-amber-200">✓</span>}
            </button>

            <button
              onClick={() => handleSelectPoster(charPoster)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all ${
                isUsingCharPoster
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-[#181b29] border border-zinc-700 text-zinc-300 hover:text-white'
              }`}
            >
              <span>Base Character Poster (v{charVersion})</span>
              {isUsingCharPoster && <span className="text-[10px] text-amber-200">✓</span>}
            </button>
          </div>
        </div>
      )}

      {/* Poster Thumbnails Scroll Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Select Poster from <em>gallery/posters</em>:</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">Language:</span>
            <button
              onClick={() => setSelectedLang(selectedLang === 'EN' ? 'CN' : 'EN')}
              className="text-[11px] font-mono text-amber-400 hover:underline px-1 py-0.5 rounded bg-black/40 border border-zinc-700"
            >
              {selectedLang}
            </button>
            <button
              onClick={() => setShowAllVersions(!showAllVersions)}
              className="text-[11px] text-[#df6931] hover:underline"
            >
              {showAllVersions ? 'Collapse' : `All (${filteredPosters.length})`}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {/* 1. Priority: Garment's release poster */}
          {garmentPoster && (
            <button
              onClick={() => handleSelectPoster(garmentPoster)}
              className={`group relative flex-shrink-0 w-28 h-18 rounded-lg overflow-hidden border transition-all text-left ${
                isPosterActive && cropState.posterUrl === garmentPoster.url
                  ? 'border-[#df6931] ring-2 ring-[#df6931]/70 scale-105 shadow-lg'
                  : 'border-amber-600/40 opacity-80 hover:opacity-100 hover:border-amber-500'
              }`}
              title={`${garmentPoster.title} (Poster for garment v${garmentVersion})`}
            >
              <img
                src={garmentPoster.url}
                alt={garmentPoster.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                loading="lazy"
                onError={e => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-1.5">
                <span className="text-[9px] font-bold text-amber-300 truncate w-full flex items-center gap-1">
                  ★ v{garmentVersion} ({selectedGarment?.name || 'Outfit'})
                </span>
              </div>
            </button>
          )}

          {/* 2. Character's base release poster (if different) */}
          {garmentVersion !== charVersion && charPoster && (
            <button
              onClick={() => handleSelectPoster(charPoster)}
              className={`group relative flex-shrink-0 w-28 h-18 rounded-lg overflow-hidden border transition-all text-left ${
                isPosterActive && cropState.posterUrl === charPoster.url
                  ? 'border-[#df6931] ring-2 ring-[#df6931]/70 scale-105 shadow-lg'
                  : 'border-zinc-700 opacity-80 hover:opacity-100 hover:border-zinc-500'
              }`}
              title={`${charPoster.title} (Base poster v${charVersion})`}
            >
              <img
                src={charPoster.url}
                alt={charPoster.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                loading="lazy"
                onError={e => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-1.5">
                <span className="text-[9px] font-bold text-zinc-300 truncate w-full flex items-center gap-1">
                  v{charVersion} (Base {character?.Name})
                </span>
              </div>
            </button>
          )}

          {/* Other posters from gallery */}
          {filteredPosters
            .filter(p => p.url !== garmentPoster?.url && p.url !== charPoster?.url)
            .slice(0, showAllVersions ? 60 : 7)
            .map((poster, idx) => {
              const isSelected = isPosterActive && cropState.posterUrl === poster.url;
              return (
                <button
                  key={poster.url || idx}
                  onClick={() => handleSelectPoster(poster)}
                  className={`group relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border transition-all text-left ${
                    isSelected
                      ? 'border-[#df6931] ring-2 ring-[#df6931]/60 scale-105 shadow-md'
                      : 'border-zinc-800 opacity-70 hover:opacity-100 hover:border-zinc-600'
                  }`}
                  title={poster.title}
                >
                  <img
                    src={poster.url}
                    alt={poster.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                    onError={e => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-1">
                    <span className="text-[9px] font-medium text-white truncate w-full">
                      v{poster.version} ({poster.lang})
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Controls: Opacity & Blur & Darken */}
      {isPosterActive && (
        <div className="pt-3 border-t border-zinc-800/80 space-y-3 bg-[#0d0f17]/60 p-3 rounded-lg">
          {/* Opacity slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                Poster Opacity:
              </span>
              <span className="font-mono text-amber-400 text-xs">
                {Math.round(cropState.posterOpacity * 100)}% {cropState.posterOpacity === 0 ? '(Fully Transparent)' : ''}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={cropState.posterOpacity}
              onChange={e => {
                const val = parseFloat(e.target.value);
                onChangeCropState(prev => ({ ...prev, posterOpacity: val }));
              }}
              className="w-full accent-[#df6931] h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Blur slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                Poster Blur:
              </span>
              <span className="font-mono text-zinc-400 text-xs">
                {cropState.posterBlur}px
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={cropState.posterBlur}
              onChange={e => {
                const val = parseInt(e.target.value);
                onChangeCropState(prev => ({ ...prev, posterBlur: val }));
              }}
              className="w-full accent-sky-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Darken overlay slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Darken Overlay:
              </span>
              <span className="font-mono text-zinc-400 text-xs">
                {Math.round(cropState.posterDarken * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={cropState.posterDarken}
              onChange={e => {
                const val = parseFloat(e.target.value);
                onChangeCropState(prev => ({ ...prev, posterDarken: val }));
              }}
              className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
