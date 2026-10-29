import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { CharacterSearch } from './components/CharacterSearch';
import { CharacterGalleryModal } from './components/CharacterGalleryModal';
import { GarmentSelector } from './components/GarmentSelector';
import { CropperWorkspace } from './components/CropperWorkspace';
import { ExportToolbar } from './components/ExportToolbar';
import { HelpModal } from './components/HelpModal';
import { BatchExportModal } from './components/BatchExportModal';
import { CharacterItem, Garment, CropState, CharacterProfileResponse } from './types';
import fallbackCharacters from './data/characters.json';
import { getGalleryPosterForVersion } from './data/galleryPosters';
import { Star, ShieldAlert, Sparkles, ExternalLink, Archive, Calendar } from 'lucide-react';

const INITIAL_CROP_STATE: CropState = {
  aspectRatio: '6:9',
  framing: 'full',
  renderMode: 'l2d',
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  flipH: false,
  bgPreset: 'version-poster',
  customBgColor: '#12141d',
  posterOpacity: 0.85,
  posterBlur: 4,
  posterDarken: 0.25,
  enableShadow: true,
  shadowBlur: 14,
  shadowColor: 'rgba(0, 0, 0, 0.55)',
  showBadge: true, // Watermark with character name & stars
  showAfflatus: false, // User requested toggle for Afflatus text
  showAfflatusSymbol: true, // User requested gold Afflatus emblem to left of name
  showRace: false, // User requested optional race display
  showGarmentName: true, // Upper-left garment name badge
  watermarkStyle: 'silver-gold-metallic', // Specular silver-gold chromatic gradient
  frameStyle: 'art-deco-gold',
  enableRoundedCorners: false, // 5.4:9 Photocard bo góc
  cornerRadius: 36, // Standard photocard corner radius in px
  padding: 0.05,
};

export default function App() {
  const [characters, setCharacters] = useState<CharacterItem[]>(fallbackCharacters as CharacterItem[]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterItem | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [storyBgs, setStoryBgs] = useState<string[]>([]);
  const [selectedGarment, setSelectedGarment] = useState<Garment | null>(null);
  const [useLive2d, setUseLive2d] = useState(false);
  const [cropState, setCropState] = useState<CropState>(INITIAL_CROP_STATE);
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [profileUrl, setProfileUrl] = useState<string>('');

  // 1. Fetch character list on mount
  useEffect(() => {
    async function loadCharacters() {
      try {
        const res = await fetch('/api/characters');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.characters?.length > 0) {
            setCharacters(json.characters);
          }
        }
      } catch (err) {
        console.warn('Using bundled characters data');
      }
    }
    loadCharacters();
  }, []);

  // 2. Select initial character (Sonetto if available, else first character)
  useEffect(() => {
    if (characters.length > 0 && !selectedCharacter) {
      const sonetto = characters.find(c => String(c.Name).toLowerCase() === 'sonetto');
      const initial = sonetto || characters[0];
      handleSelectCharacter(initial);
    }
  }, [characters]);

  // 3. Load character garments, story bgs & artwork from UTTU Merui profile
  const handleSelectCharacter = async (char: CharacterItem) => {
    setSelectedCharacter(char);
    setIsLoadingProfile(true);

    const versionPoster = getGalleryPosterForVersion(char.Version);

    try {
      const res = await fetch(`/api/character/${encodeURIComponent(String(char.Name))}`);
      if (res.ok) {
        const data: CharacterProfileResponse = await res.json();
        if (data.success && data.garments?.length > 0) {
          setGarments(data.garments);
          setSelectedGarment(data.garments[0]);
          const bgs = data.storyBgs || [];
          setStoryBgs(bgs);
          setProfileUrl(data.profileUrl || `https://uttu.merui.net/profiles/${data.slug}`);

          // Set default poster background strictly from gallery/posters for this version
          setCropState(prev => ({
            ...prev,
            posterUrl: versionPoster.url,
          }));

          setIsLoadingProfile(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to load profile garments, using fallback', err);
    }

    // Fallback garment generation using Reverse: 1999 ID structure
    const defId = `${String(char.ID).padStart(4, '0')}01`;
    const fallbackList: Garment[] = [
      {
        garmentId: defId,
        kind: 'img',
        name: 'Default',
        imageUrl: `https://assets.merui.net/headicon_img/${defId}.webp`,
        l2dUrl: `https://assets.merui.net/headicon_img_l2d/${defId}.webp`,
        thumbUrl: `https://assets.merui.net/headicon_small/${defId}.webp`,
      },
    ];

    if (char.Rarity >= 4) {
      const i2Id = `${String(char.ID).padStart(4, '0')}02`;
      fallbackList.push({
        garmentId: i2Id,
        kind: 'img',
        name: 'Insight II',
        imageUrl: `https://assets.merui.net/headicon_img/${i2Id}.webp`,
        l2dUrl: `https://assets.merui.net/headicon_img_l2d/${i2Id}.webp`,
        thumbUrl: `https://assets.merui.net/headicon_small/${i2Id}.webp`,
      });
    }

    setGarments(fallbackList);
    setSelectedGarment(fallbackList[0]);
    setStoryBgs([]);
    setProfileUrl(`https://uttu.merui.net/profiles/${String(char.Name).toLowerCase().replace(/\s+/g, '_')}`);
    setCropState(prev => ({
      ...prev,
      posterUrl: versionPoster.url,
    }));
    setIsLoadingProfile(false);
  };

  const isL2D = cropState.renderMode === 'l2d';
  const currentImageUrl = selectedGarment
    ? isL2D && selectedGarment.l2dUrl
      ? selectedGarment.l2dUrl
      : selectedGarment.imageUrl
    : '';

  const handleSelectRenderMode = (mode: 'l2d' | 'illustration') => {
    if (mode === 'illustration') {
      setCropState(prev => ({
        ...prev,
        renderMode: 'illustration',
        bgPreset: 'transparent',
        enableShadow: false,
      }));
    } else {
      const targetVer = selectedGarment?.version || selectedCharacter?.Version || '1.0';
      const garmentPoster = getGalleryPosterForVersion(targetVer);
      setCropState(prev => ({
        ...prev,
        renderMode: 'l2d',
        bgPreset: 'version-poster',
        enableShadow: true,
        posterUrl: garmentPoster.url,
      }));
    }
  };

  const handleSelectGarment = (garment: Garment) => {
    setSelectedGarment(garment);
    // User request: Ngoài default ngoại hình đi vs poster gốc thì phần trang phục tự động đi theo poster của phiên bản mà trang phục đó được ra mắt
    const targetVer = garment.version || selectedCharacter?.Version || '1.0';
    const garmentPoster = getGalleryPosterForVersion(targetVer);
    setCropState(prev => ({
      ...prev,
      posterUrl: garmentPoster.url,
    }));
  };

  const handleCanvasReady = useCallback((_canvas: HTMLCanvasElement, img: HTMLImageElement) => {
    setLoadedImg(img);
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0c12] text-[#e0e2ec] flex flex-col font-sans">
      {/* Top Navigation */}
      <Header
        onOpenHelp={() => setIsHelpModalOpen(true)}
        onOpenBatchModal={() => setIsBatchModalOpen(true)}
        selectedCharName={selectedCharacter ? String(selectedCharacter.Name) : undefined}
        profileUrl={profileUrl}
      />

      {/* Main Studio Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Search & Character Selector Bar */}
        <div className="bg-[#10121b] border border-amber-900/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
                Character Search & Portrait Studio
              </h2>
              <p className="text-xs text-zinc-400">
                Search or browse characters to crop full-body portraits from{' '}
                <a
                  href="https://uttu.merui.net/profiles/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#df6931] hover:underline inline-flex items-center gap-1 font-mono"
                >
                  uttu.merui.net/profiles <ExternalLink className="w-2.5 h-2.5 inline" />
                </a>
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => setIsBatchModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Configure and download multiple images simultaneously"
              >
                <Archive className="w-3.5 h-3.5 text-amber-400" />
                <span>Bulk Export</span>
              </button>

              {selectedCharacter && (
                <div className="flex items-center gap-2.5 bg-[#141624] px-3.5 py-2 rounded-xl border border-amber-600/40 shadow-sm">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white tracking-wide">{selectedCharacter.Name}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-gradient-to-r from-[#df6931] to-amber-600 text-white shadow-xs">
                        v{selectedCharacter.Version || '1.0'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center text-amber-400 text-xs">
                        {Array.from({ length: selectedCharacter.Rarity || 5 }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400" />
                        ))}
                      </div>
                      <span className="text-[11px] text-zinc-400 font-medium">
                        • {selectedCharacter.Afflatus} • {selectedCharacter.Race || 'Arcanist'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <CharacterSearch
            characters={characters}
            selectedCharacter={selectedCharacter}
            onSelectCharacter={handleSelectCharacter}
            onOpenBrowseModal={() => setIsBrowseModalOpen(true)}
            isLoading={isLoadingProfile}
          />

          {/* Garments & Skins selector */}
          {garments.length > 0 && (
            <GarmentSelector
              garments={garments}
              selectedGarment={selectedGarment}
              onSelectGarment={handleSelectGarment}
              renderMode={cropState.renderMode}
              onSelectRenderMode={handleSelectRenderMode}
            />
          )}
        </div>

        {/* The Cropper Workspace */}
        {currentImageUrl ? (
          <div className="bg-[#10121b] border border-amber-900/30 rounded-2xl p-4 sm:p-6 shadow-xl">
            <CropperWorkspace
              imageUrl={currentImageUrl}
              character={selectedCharacter}
              selectedGarment={selectedGarment}
              storyBgs={storyBgs}
              cropState={cropState}
              onChangeCropState={setCropState}
              onCanvasReady={handleCanvasReady}
              isLoadingImage={isLoadingProfile}
            />
          </div>
        ) : (
          <div className="bg-[#10121b] border border-zinc-800 rounded-2xl p-12 text-center text-zinc-400 space-y-2">
            <Sparkles className="w-8 h-8 text-[#df6931] mx-auto animate-pulse" />
            <p className="text-sm font-medium">Please select a character to begin cropping and styling.</p>
          </div>
        )}

        {/* Export & Download Section */}
        {currentImageUrl && (
          <ExportToolbar
            cropState={cropState}
            character={selectedCharacter}
            selectedGarment={selectedGarment}
            loadedImg={loadedImg}
            onOpenBatchModal={() => setIsBatchModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#0a0b10] py-6 px-4 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            Character data and artwork belong to{' '}
            <a
              href="https://uttu.merui.net/profiles/"
              target="_blank"
              rel="noreferrer"
              className="text-amber-500 hover:underline"
            >
              UTTU Merui
            </a>{' '}
            & Bluepoch (Reverse: 1999). Exported artwork is clean without watermarks.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="text-amber-400 hover:underline flex items-center gap-1"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Bulk Export (ZIP)</span>
            </button>
            <span>•</span>
            <button
              onClick={() => setIsHelpModalOpen(true)}
              className="hover:text-zinc-300 transition-colors"
            >
              User Guide
            </button>
            <span>•</span>
            <span className="font-mono text-[11px] text-[#df6931]">
              Standard 6:9 Portrait Ratio
            </span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CharacterGalleryModal
        isOpen={isBrowseModalOpen}
        onClose={() => setIsBrowseModalOpen(false)}
        characters={characters}
        selectedCharacter={selectedCharacter}
        onSelectCharacter={handleSelectCharacter}
      />

      <BatchExportModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        currentCharacter={selectedCharacter}
        currentGarments={garments}
        allCharacters={characters}
        defaultCropState={cropState}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
}
