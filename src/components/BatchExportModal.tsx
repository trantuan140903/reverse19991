import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Layers,
  Download,
  Trash2,
  Plus,
  Sparkles,
  Check,
  Loader2,
  Film,
  Archive,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Eye,
  Camera,
  ChevronDown,
  Settings2,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Palette,
  Star,
  Search,
  UserCheck,
  ChevronUp,
  CheckCheck,
  AlertCircle,
  Filter
} from 'lucide-react';
import JSZip from 'jszip';
import {
  BatchItem,
  CharacterItem,
  CropState,
  ExportFormat,
  ExportResolution,
  Garment,
  FramingType,
  BackgroundPreset,
  FrameStyle,
  WatermarkStyle,
  AspectRatioType,
  GarmentNameOrientation
} from '../types';
import {
  downloadZipArchive,
  renderBatchItemToBlob,
  downloadBlob,
  renderPurePosterToBlob
} from '../utils/cropUtils';
import { GALLERY_POSTERS, getGalleryPosterForVersion } from '../data/galleryPosters';
import garmentsDbRaw from '../data/garments.json';

const garmentsDb = garmentsDbRaw as Record<string, {
  garmentId: string;
  name: string;
  category: string;
  version: string;
  seriesId?: string;
  seriesName?: string;
  charId: number;
  charName: string;
  charVersion: string;
}>;

export interface GarmentBatchConfig {
  selected: boolean;
  l2d: boolean;
  illustration: boolean;
  full: boolean;
  half: boolean;
  close: boolean;
}

interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCharacter: CharacterItem | null;
  currentGarments: Garment[];
  allCharacters: CharacterItem[];
  defaultCropState: CropState;
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
  isOpen,
  onClose,
  currentCharacter,
  currentGarments,
  allCharacters,
  defaultCropState,
}) => {
  const [queue, setQueue] = useState<BatchItem[]>([]);
  const resolution: ExportResolution = '4k'; // Permanently locked to 4K Ultra Max
  const [format, setFormat] = useState<ExportFormat>('image/png');
  const [globalAspectRatio, setGlobalAspectRatio] = useState<AspectRatioType>('6:9');
  const [globalFraming, setGlobalFraming] = useState<FramingType>('full');
  const [globalBg, setGlobalBg] = useState<BackgroundPreset>('version-poster');
  const [globalPosterOpacity, setGlobalPosterOpacity] = useState(0.85);
  const [globalFrameStyle, setGlobalFrameStyle] = useState<FrameStyle>('art-deco-gold');
  const [globalWatermarkStyle, setGlobalWatermarkStyle] = useState<WatermarkStyle>('silver-gold-metallic');
  const [globalShowAfflatus, setGlobalShowAfflatus] = useState<boolean>(defaultCropState.showAfflatus ?? false);
  const [globalShowAfflatusSymbol, setGlobalShowAfflatusSymbol] = useState<boolean>(true);
  const [globalShowRace, setGlobalShowRace] = useState<boolean>(defaultCropState.showRace ?? false);
  const [globalShowGarmentName, setGlobalShowGarmentName] = useState<boolean>(true);
  const [globalGarmentNameOrientation, setGlobalGarmentNameOrientation] = useState<GarmentNameOrientation>(defaultCropState.garmentNameOrientation || 'horizontal');

  // Series selection filter
  const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string>('ALL');

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; currentName: string }>({
    current: 0,
    total: 0,
    currentName: '',
  });

  // Character selection hierarchy
  const [selectedRarityFilter, setSelectedRarityFilter] = useState<number | 'ALL'>('ALL');
  const [charSearch, setCharSearch] = useState('');
  const [activeChar, setActiveChar] = useState<CharacterItem | null>(currentCharacter || allCharacters[0] || null);

  // Multi-character checkbox selection
  const [selectedCharIds, setSelectedCharIds] = useState<Set<number>>(new Set());

  // Bulk assets configuration for selected/all characters
  const [bulkIncludeL2D, setBulkIncludeL2D] = useState(true);
  const [bulkIncludeIllu, setBulkIncludeIllu] = useState(true);
  const [bulkGarmentScope, setBulkGarmentScope] = useState<'all' | 'default_only' | 'skins_only'>('all');

  // Per-active-character outfit framing builder with arbitrary selection
  const [charFramingOptions, setCharFramingOptions] = useState<Record<string, GarmentBatchConfig>>({});

  // Active item poster picker modal/popover
  const [activeItemForPoster, setActiveItemForPoster] = useState<string | null>(null);

  // Pure poster downloader modal inside batch
  const [showPurePosterModal, setShowPurePosterModal] = useState(false);
  const [isDownloadingPurePoster, setIsDownloadingPurePoster] = useState(false);

  // Individual Image Preview state
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewRendering, setIsPreviewRendering] = useState(false);
  const [isDownloadingSingle, setIsDownloadingSingle] = useState(false);

  // Set initial active char if empty
  useEffect(() => {
    if (!activeChar && currentCharacter) {
      setActiveChar(currentCharacter);
    } else if (!activeChar && allCharacters.length > 0) {
      setActiveChar(allCharacters[0]);
    }
  }, [currentCharacter, allCharacters]);

  // Retrieve garments for active character: combine live garments + garments.json database
  const activeCharGarments = useMemo<Garment[]>(() => {
    if (!activeChar) return [];
    const list: Garment[] = [];
    const seenIds = new Set<string>();

    // 1. If activeChar is the currently opened character in main workspace, include its garments
    if (currentCharacter && currentCharacter.ID === activeChar.ID && currentGarments.length > 0) {
      currentGarments.forEach(g => {
        list.push(g);
        seenIds.add(String(g.garmentId));
      });
    }

    // 2. From garments.json database (contains all 422 skins across versions)
    const dbSkins = Object.values(garmentsDb).filter(
      item => item.charId === activeChar.ID || (item.charName && item.charName.toLowerCase() === String(activeChar.Name).toLowerCase())
    );

    dbSkins.forEach(skin => {
      if (!seenIds.has(skin.garmentId)) {
        list.push({
          garmentId: skin.garmentId,
          kind: 'img',
          name: skin.name,
          version: skin.version,
          category: skin.category,
          seriesId: skin.seriesId,
          seriesName: skin.seriesName,
          imageUrl: `https://assets.merui.net/headicon_img/${skin.garmentId}.webp`,
          l2dUrl: `https://assets.merui.net/headicon_img_l2d/${skin.garmentId}.webp`,
          thumbUrl: `https://assets.merui.net/headicon_small/${skin.garmentId}.webp`,
        });
        seenIds.add(skin.garmentId);
      }
    });

    // 3. Fallback default & insight II if database had none
    if (list.length === 0) {
      const defId = `${String(activeChar.ID).padStart(4, '0')}01`;
      list.push({
        garmentId: defId,
        kind: 'img',
        name: 'Default',
        version: activeChar.Version || '1.0',
        category: 'default',
        imageUrl: `https://assets.merui.net/headicon_img/${defId}.webp`,
        l2dUrl: `https://assets.merui.net/headicon_img_l2d/${defId}.webp`,
        thumbUrl: `https://assets.merui.net/headicon_small/${defId}.webp`,
      });
      if (activeChar.Rarity >= 4) {
        const i2Id = `${String(activeChar.ID).padStart(4, '0')}02`;
        list.push({
          garmentId: i2Id,
          kind: 'img',
          name: 'Insight II',
          version: activeChar.Version || '1.0',
          category: 'insight',
          imageUrl: `https://assets.merui.net/headicon_img/${i2Id}.webp`,
          l2dUrl: `https://assets.merui.net/headicon_img_l2d/${i2Id}.webp`,
          thumbUrl: `https://assets.merui.net/headicon_small/${i2Id}.webp`,
        });
      }
    }

    return list;
  }, [activeChar, currentCharacter, currentGarments]);

  // Helper: check if a garment is the default base outfit
  const isDefaultGarment = (g: Garment) => {
    return (
      g.category === 'default' ||
      g.name.toLowerCase() === 'default' ||
      g.garmentId.endsWith('01')
    );
  };

  // Initialize framing options for active character garments
  useEffect(() => {
    if (activeCharGarments.length === 0) return;
    setCharFramingOptions(prev => {
      const next = { ...prev };
      activeCharGarments.forEach((g) => {
        if (!next[g.garmentId]) {
          const isDef = isDefaultGarment(g);
          next[g.garmentId] = {
            selected: true,
            l2d: true,
            // Per requirements: Remove Illu download option from default garment
            illustration: !isDef,
            full: true,
            half: false,
            close: false,
          };
        }
      });
      return next;
    });
  }, [activeCharGarments]);

  const previewItem = previewIndex !== null && queue[previewIndex] ? queue[previewIndex] : null;

  // Render preview whenever previewIndex changes or previewItem changes
  useEffect(() => {
    if (!previewItem) {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      return;
    }

    let isMounted = true;
    setIsPreviewRendering(true);

    const generatePreview = async () => {
      try {
        const itemCropState: CropState = {
          ...defaultCropState,
          aspectRatio: previewItem.aspectRatio || globalAspectRatio,
          renderMode: previewItem.renderMode || 'l2d',
          framing: previewItem.framing,
          bgPreset: previewItem.bgPreset,
          posterUrl: previewItem.posterUrl,
          posterOpacity: previewItem.posterOpacity,
          posterBlur: previewItem.posterBlur,
          frameStyle: previewItem.frameStyle || globalFrameStyle,
          watermarkStyle: previewItem.watermarkStyle || globalWatermarkStyle,
          showBadge: (previewItem.watermarkStyle || globalWatermarkStyle) !== 'none',
          showAfflatus: previewItem.showAfflatus !== undefined ? previewItem.showAfflatus : globalShowAfflatus,
          showRace: previewItem.showRace !== undefined ? previewItem.showRace : globalShowRace,
          showGarmentName: previewItem.showGarmentName !== undefined ? previewItem.showGarmentName : globalShowGarmentName,
          garmentNameOrientation: previewItem.garmentNameOrientation || globalGarmentNameOrientation,
        };

        const res = await renderBatchItemToBlob(previewItem, itemCropState, 'standard', 'image/png');
        if (isMounted) {
          const newUrl = URL.createObjectURL(res.blob);
          setPreviewBlobUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return newUrl;
          });
        }
      } catch (err) {
        console.warn('Failed to render batch preview:', err);
      } finally {
        if (isMounted) {
          setIsPreviewRendering(false);
        }
      }
    };

    generatePreview();

    return () => {
      isMounted = false;
    };
  }, [
    previewIndex,
    previewItem?.renderMode,
    previewItem?.framing,
    previewItem?.bgPreset,
    previewItem?.posterUrl,
    previewItem?.frameStyle,
    previewItem?.watermarkStyle,
    previewItem?.showAfflatus,
    previewItem?.showRace,
    previewItem?.showGarmentName,
    previewItem?.aspectRatio,
    previewItem?.garmentNameOrientation,
    globalAspectRatio,
    globalFrameStyle,
    globalWatermarkStyle,
    globalShowAfflatus,
    globalShowRace,
    globalShowGarmentName,
    globalGarmentNameOrientation
  ]);

  // Extract all unique garment series from database
  const allSeriesNames = useMemo(() => {
    const s = new Set<string>();
    Object.values(garmentsDb).forEach(g => {
      if (g.seriesName) s.add(g.seriesName);
    });
    return Array.from(s).sort();
  }, []);

  // Filtered characters list by Rarity Stars & Search & Series Filter
  const filteredChars = allCharacters.filter(c => {
    if (selectedRarityFilter !== 'ALL' && c.Rarity !== selectedRarityFilter) {
      return false;
    }
    if (selectedSeriesFilter !== 'ALL') {
      const hasSeries = Object.values(garmentsDb).some(
        g => (g.charId === c.ID || (g.charName && g.charName.toLowerCase() === String(c.Name).toLowerCase())) &&
          g.seriesName === selectedSeriesFilter
      );
      if (!hasSeries) return false;
    }
    if (charSearch) {
      const q = charSearch.toLowerCase().trim();
      const matchName = String(c.Name).toLowerCase().includes(q);
      const matchVer = String(c.Version || '').toLowerCase().includes(q);
      const matchRace = String(c.Race || '').toLowerCase().includes(q);
      const matchAfflatus = String(c.Afflatus || '').toLowerCase().includes(q);

      // Match across garments and series from garmentsDb
      const matchGarment = Object.values(garmentsDb).some(
        g => (g.charId === c.ID || (g.charName && g.charName.toLowerCase() === String(c.Name).toLowerCase())) &&
          ((g.name && g.name.toLowerCase().includes(q)) || (g.seriesName && g.seriesName.toLowerCase().includes(q)))
      );

      return matchName || matchVer || matchRace || matchAfflatus || matchGarment;
    }
    return true;
  });

  // Select all garments for active character
  const handleSelectAllGarments = () => {
    setCharFramingOptions(prev => {
      const next = { ...prev };
      activeCharGarments.forEach(g => {
        const isDef = isDefaultGarment(g);
        next[g.garmentId] = {
          ...(next[g.garmentId] || { l2d: true, illustration: !isDef, full: true, half: false, close: false }),
          selected: true,
        };
      });
      return next;
    });
  };

  // Deselect all garments for active character
  const handleDeselectAllGarments = () => {
    setCharFramingOptions(prev => {
      const next = { ...prev };
      activeCharGarments.forEach(g => {
        next[g.garmentId] = {
          ...(next[g.garmentId] || { l2d: true, illustration: false, full: true, half: false, close: false }),
          selected: false,
        };
      });
      return next;
    });
  };

  // Toggle selecting all currently filtered characters
  const handleToggleSelectFilteredChars = () => {
    const allFilteredSelected = filteredChars.length > 0 && filteredChars.every(c => selectedCharIds.has(c.ID));
    const next = new Set(selectedCharIds);
    if (allFilteredSelected) {
      filteredChars.forEach(c => next.delete(c.ID));
    } else {
      filteredChars.forEach(c => next.add(c.ID));
    }
    setSelectedCharIds(next);
  };

  // Add arbitrary selected photos for active character
  const handleAddPhotosForActiveChar = () => {
    if (!activeChar) return;
    const newItems: BatchItem[] = [];

    activeCharGarments.forEach(g => {
      const isDef = isDefaultGarment(g);
      const opt = charFramingOptions[g.garmentId] || {
        selected: true,
        l2d: true,
        illustration: !isDef,
        full: true,
        half: false,
        close: false,
      };

      if (!opt.selected) return;

      const gVer = g.version || activeChar.Version || '1.0';
      const poster = getGalleryPosterForVersion(gVer);

      // Option 1: L2D mode (with poster and framing)
      if (opt.l2d) {
        const framings: FramingType[] = [];
        if (opt.full) framings.push('full');
        if (opt.half) framings.push('half');
        if (opt.close) framings.push('close');
        if (framings.length === 0) framings.push('full');

        framings.forEach(f => {
          newItems.push({
            id: `${activeChar.ID}_${g.garmentId}_${f}_l2d_${Date.now()}_${Math.random()}`,
            character: activeChar,
            garment: g,
            aspectRatio: globalAspectRatio,
            renderMode: 'l2d',
            useLive2d: true,
            framing: f,
            bgPreset: globalBg,
            posterUrl: poster.url,
            posterOpacity: globalPosterOpacity,
            posterBlur: 4,
            frameStyle: globalFrameStyle,
            watermarkStyle: globalWatermarkStyle,
            showAfflatus: globalShowAfflatus,
            showRace: globalShowRace,
            showGarmentName: globalShowGarmentName,
            garmentNameOrientation: globalGarmentNameOrientation,
          });
        });
      }

      // Option 2: Illustration mode (zoomed cover full bleed, shared backdrop)
      // Per requirements: Remove Illu download option from default garment!
      if (!isDef && opt.illustration) {
        newItems.push({
          id: `${activeChar.ID}_${g.garmentId}_full_illustration_${Date.now()}_${Math.random()}`,
          character: activeChar,
          garment: g,
          aspectRatio: globalAspectRatio,
          renderMode: 'illustration',
          useLive2d: false,
          framing: 'full',
          bgPreset: 'transparent',
          posterUrl: undefined,
          posterOpacity: globalPosterOpacity,
          posterBlur: 0,
          frameStyle: globalFrameStyle,
          watermarkStyle: globalWatermarkStyle,
          showAfflatus: globalShowAfflatus,
          showRace: globalShowRace,
          showGarmentName: globalShowGarmentName,
          garmentNameOrientation: globalGarmentNameOrientation,
        });
      }
    });

    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems]);
    }
  };

  // Helper to fetch garments for any character item
  const getGarmentsForChar = (c: CharacterItem): Garment[] => {
    const charSkins = Object.values(garmentsDb).filter(
      g => g.charId === c.ID || (g.charName && g.charName.toLowerCase() === String(c.Name).toLowerCase())
    );

    let list: Garment[] = [];
    if (charSkins.length > 0) {
      list = charSkins.map(s => ({
        garmentId: s.garmentId,
        kind: 'img',
        name: s.name,
        version: s.version,
        category: s.category,
        seriesId: s.seriesId,
        seriesName: s.seriesName,
        imageUrl: `https://assets.merui.net/headicon_img/${s.garmentId}.webp`,
        l2dUrl: `https://assets.merui.net/headicon_img_l2d/${s.garmentId}.webp`,
        thumbUrl: `https://assets.merui.net/headicon_small/${s.garmentId}.webp`,
      }));
    } else {
      const defId = `${String(c.ID).padStart(4, '0')}01`;
      list.push({
        garmentId: defId,
        kind: 'img',
        name: 'Default',
        version: c.Version || '1.0',
        category: 'default',
        imageUrl: `https://assets.merui.net/headicon_img/${defId}.webp`,
        l2dUrl: `https://assets.merui.net/headicon_img_l2d/${defId}.webp`,
        thumbUrl: `https://assets.merui.net/headicon_small/${defId}.webp`,
      });
      if (c.Rarity >= 4) {
        const i2Id = `${String(c.ID).padStart(4, '0')}02`;
        list.push({
          garmentId: i2Id,
          kind: 'img',
          name: 'Insight II',
          version: c.Version || '1.0',
          category: 'insight',
          imageUrl: `https://assets.merui.net/headicon_img/${i2Id}.webp`,
          l2dUrl: `https://assets.merui.net/headicon_img_l2d/${i2Id}.webp`,
          thumbUrl: `https://assets.merui.net/headicon_small/${i2Id}.webp`,
        });
      }
    }

    if (bulkGarmentScope === 'default_only') {
      return list.filter(isDefaultGarment);
    }
    if (bulkGarmentScope === 'skins_only') {
      return list.filter(g => !isDefaultGarment(g));
    }
    return list;
  };

  // Bulk queueing generator for an arbitrary list of characters
  const queueCharactersList = (targetChars: CharacterItem[]) => {
    if (targetChars.length === 0) return;
    const newItems: BatchItem[] = [];

    targetChars.forEach(c => {
      const garmentsList = getGarmentsForChar(c);

      garmentsList.forEach(g => {
        const isDef = isDefaultGarment(g);
        const gVer = g.version || c.Version || '1.0';
        const poster = getGalleryPosterForVersion(gVer);

        // 1. Live2D asset (available for all garments)
        if (bulkIncludeL2D) {
          newItems.push({
            id: `${c.ID}_${g.garmentId}_${globalFraming}_l2d_${Date.now()}_${Math.random()}`,
            character: c,
            garment: g,
            aspectRatio: globalAspectRatio,
            renderMode: 'l2d',
            useLive2d: true,
            framing: globalFraming,
            bgPreset: globalBg,
            posterUrl: poster.url,
            posterOpacity: globalPosterOpacity,
            posterBlur: 4,
            frameStyle: globalFrameStyle,
            watermarkStyle: globalWatermarkStyle,
            showAfflatus: globalShowAfflatus,
            showAfflatusSymbol: globalShowAfflatusSymbol,
            showRace: globalShowRace,
            showGarmentName: globalShowGarmentName,
            garmentNameOrientation: globalGarmentNameOrientation,
          });
        }

        // 2. Illustration asset (CRITICAL: default garment NEVER has Illu option; retain for other garments)
        if (bulkIncludeIllu && !isDef) {
          newItems.push({
            id: `${c.ID}_${g.garmentId}_full_illustration_${Date.now()}_${Math.random()}`,
            character: c,
            garment: g,
            aspectRatio: globalAspectRatio,
            renderMode: 'illustration',
            useLive2d: false,
            framing: 'full',
            bgPreset: 'transparent',
            posterUrl: undefined,
            posterOpacity: globalPosterOpacity,
            posterBlur: 0,
            frameStyle: globalFrameStyle,
            watermarkStyle: globalWatermarkStyle,
            showAfflatus: globalShowAfflatus,
            showAfflatusSymbol: globalShowAfflatusSymbol,
            showRace: globalShowRace,
            showGarmentName: globalShowGarmentName,
            garmentNameOrientation: globalGarmentNameOrientation,
          });
        }
      });
    });

    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems]);
    }
  };

  // Queue all garments belonging to a specific series
  const handleQueueSeries = (seriesName: string) => {
    const matchingGarments = Object.values(garmentsDb).filter(g => g.seriesName === seriesName);
    if (matchingGarments.length === 0) return;

    const newItems: BatchItem[] = [];
    matchingGarments.forEach(g => {
      const char = allCharacters.find(c => c.ID === g.charId || (c.Name && String(c.Name).toLowerCase() === g.charName.toLowerCase()));
      if (!char) return;

      const gVer = g.version || char.Version || '1.0';
      const poster = getGalleryPosterForVersion(gVer);
      const garmentObj: Garment = {
        garmentId: g.garmentId,
        kind: 'img',
        name: g.name,
        version: g.version,
        seriesId: g.seriesId,
        seriesName: g.seriesName,
        category: g.category || 'skin',
        imageUrl: `https://assets.merui.net/headicon_img/${g.garmentId}.webp`,
        l2dUrl: `https://assets.merui.net/headicon_img_l2d/${g.garmentId}.webp`,
        thumbUrl: `https://assets.merui.net/headicon_small/${g.garmentId}.webp`,
      };

      if (bulkIncludeL2D) {
        newItems.push({
          id: `${char.ID}_${g.garmentId}_${globalFraming}_l2d_${Date.now()}_${Math.random()}`,
          character: char,
          garment: garmentObj,
          aspectRatio: globalAspectRatio,
          renderMode: 'l2d',
          useLive2d: true,
          framing: globalFraming,
          bgPreset: globalBg,
          posterUrl: poster.url,
          posterOpacity: globalPosterOpacity,
          posterBlur: 4,
          frameStyle: globalFrameStyle,
          watermarkStyle: globalWatermarkStyle,
          showAfflatus: globalShowAfflatus,
          showAfflatusSymbol: globalShowAfflatusSymbol,
          showRace: globalShowRace,
          showGarmentName: globalShowGarmentName,
        });
      }

      if (bulkIncludeIllu) {
        newItems.push({
          id: `${char.ID}_${g.garmentId}_full_illustration_${Date.now()}_${Math.random()}`,
          character: char,
          garment: garmentObj,
          aspectRatio: globalAspectRatio,
          renderMode: 'illustration',
          useLive2d: false,
          framing: 'full',
          bgPreset: 'transparent',
          posterUrl: undefined,
          posterOpacity: globalPosterOpacity,
          posterBlur: 0,
          frameStyle: globalFrameStyle,
          watermarkStyle: globalWatermarkStyle,
          showAfflatus: globalShowAfflatus,
          showAfflatusSymbol: globalShowAfflatusSymbol,
          showRace: globalShowRace,
          showGarmentName: globalShowGarmentName,
        });
      }
    });

    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems]);
    }
  };

  // Add selected characters from checkboxes
  const handleAddSelectedCharacters = () => {
    const chars = allCharacters.filter(c => selectedCharIds.has(c.ID));
    queueCharactersList(chars);
    setSelectedCharIds(new Set());
  };

  // Add ALL characters in current filter
  const handleAddFilteredCharacters = () => {
    queueCharactersList(filteredChars);
  };

  // Add ALL roster characters across the game
  const handleAddAllCharacters = () => {
    queueCharactersList(allCharacters);
  };

  const handleUpdateItemFraming = (id: string, framing: FramingType) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, framing } : item));
  };

  const handleUpdateItemBg = (id: string, bgPreset: BackgroundPreset) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, bgPreset } : item));
  };

  const handleUpdateItemRenderMode = (id: string, renderMode: 'l2d' | 'illustration') => {
    setQueue(prev => prev.map(item => {
      if (item.id !== id) return item;
      // Safety check: default garment can never be illustration
      if (renderMode === 'illustration' && isDefaultGarment(item.garment)) {
        return item;
      }
      const isIll = renderMode === 'illustration';
      return {
        ...item,
        renderMode,
        useLive2d: !isIll,
        bgPreset: isIll ? 'transparent' : (item.bgPreset === 'transparent' ? 'version-poster' : item.bgPreset),
      };
    }));
  };

  const handleUpdateItemAfflatus = (id: string, showAfflatus: boolean) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, showAfflatus } : item));
  };

  const handleUpdateItemGarmentName = (id: string, showGarmentName: boolean) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, showGarmentName } : item));
  };

  const handleUpdateItemPoster = (id: string, posterUrl: string) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, bgPreset: 'version-poster', posterUrl } : item));
    setActiveItemForPoster(null);
  };

  const handleUpdateItemFrame = (id: string, frameStyle: FrameStyle) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, frameStyle } : item));
  };

  const handleUpdateItemWatermark = (id: string, watermarkStyle: WatermarkStyle) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, watermarkStyle } : item));
  };

  const handleRemoveItem = (id: string) => {
    setQueue(prev => {
      const next = prev.filter(item => item.id !== id);
      if (previewIndex !== null && previewIndex >= next.length) {
        setPreviewIndex(next.length > 0 ? next.length - 1 : null);
      }
      return next;
    });
  };

  const handleClearQueue = () => {
    setQueue([]);
    setPreviewIndex(null);
  };

  // Apply global framing to all items in queue
  const handleApplyGlobalFraming = (framing: FramingType) => {
    setGlobalFraming(framing);
    setQueue(prev => prev.map(item => ({ ...item, framing })));
  };

  // Apply global bg to all items in queue
  const handleApplyGlobalBg = (bgPreset: BackgroundPreset) => {
    setGlobalBg(bgPreset);
    setQueue(prev => prev.map(item => {
      const gVer = item.garment.version || item.character.Version || '1.0';
      const p = getGalleryPosterForVersion(gVer);
      return {
        ...item,
        bgPreset,
        posterUrl: p.url,
      };
    }));
  };

  // Apply global frame style to all items in queue
  const handleApplyGlobalFrame = (frameStyle: FrameStyle) => {
    setGlobalFrameStyle(frameStyle);
    setQueue(prev => prev.map(item => ({ ...item, frameStyle })));
  };

  // Apply global watermark style to all items in queue
  const handleApplyGlobalWatermark = (watermarkStyle: WatermarkStyle) => {
    setGlobalWatermarkStyle(watermarkStyle);
    setQueue(prev => prev.map(item => ({ ...item, watermarkStyle })));
  };

  // Apply global Afflatus toggle to all items in queue
  const handleApplyGlobalShowAfflatus = (showAfflatus: boolean) => {
    setGlobalShowAfflatus(showAfflatus);
    setQueue(prev => prev.map(item => ({ ...item, showAfflatus })));
  };

  // Apply global aspect ratio to all items in queue
  const handleApplyGlobalAspectRatio = (aspectRatio: AspectRatioType) => {
    setGlobalAspectRatio(aspectRatio);
    setQueue(prev => prev.map(item => ({ ...item, aspectRatio })));
  };

  // Apply global garment name badge toggle to all items in queue
  const handleApplyGlobalShowGarmentName = (showGarmentName: boolean) => {
    setGlobalShowGarmentName(showGarmentName);
    setQueue(prev => prev.map(item => ({ ...item, showGarmentName })));
  };

  // Apply global race toggle to all items in queue
  const handleApplyGlobalShowRace = (showRace: boolean) => {
    setGlobalShowRace(showRace);
    setQueue(prev => prev.map(item => ({ ...item, showRace })));
  };

  // Apply global Afflatus Symbol toggle to all items in queue
  const handleApplyGlobalShowAfflatusSymbol = (showAfflatusSymbol: boolean) => {
    setGlobalShowAfflatusSymbol(showAfflatusSymbol);
    setQueue(prev => prev.map(item => ({ ...item, showAfflatusSymbol })));
  };

  // Apply global garment name orientation to all items in queue
  const handleApplyGlobalGarmentNameOrientation = (garmentNameOrientation: GarmentNameOrientation) => {
    setGlobalGarmentNameOrientation(garmentNameOrientation);
    setQueue(prev => prev.map(item => ({ ...item, garmentNameOrientation })));
  };

  // Single Item Download directly from Preview
  const handleDownloadPreviewItem = async () => {
    if (!previewItem) return;
    setIsDownloadingSingle(true);
    try {
      const itemCropState: CropState = {
        ...defaultCropState,
        aspectRatio: previewItem.aspectRatio || globalAspectRatio,
        renderMode: previewItem.renderMode || 'l2d',
        framing: previewItem.framing,
        bgPreset: previewItem.bgPreset,
        posterUrl: previewItem.posterUrl,
        posterOpacity: previewItem.posterOpacity,
        posterBlur: previewItem.posterBlur,
        frameStyle: previewItem.frameStyle || globalFrameStyle,
        watermarkStyle: previewItem.watermarkStyle || globalWatermarkStyle,
        showBadge: (previewItem.watermarkStyle || globalWatermarkStyle) !== 'none',
        showAfflatus: previewItem.showAfflatus !== undefined ? previewItem.showAfflatus : globalShowAfflatus,
        showAfflatusSymbol: previewItem.showAfflatusSymbol !== undefined ? previewItem.showAfflatusSymbol : globalShowAfflatusSymbol,
        showRace: previewItem.showRace !== undefined ? previewItem.showRace : globalShowRace,
        showGarmentName: previewItem.showGarmentName !== undefined ? previewItem.showGarmentName : globalShowGarmentName,
        garmentNameOrientation: previewItem.garmentNameOrientation || globalGarmentNameOrientation,
        enableRoundedCorners: (previewItem.aspectRatio || globalAspectRatio) === '5.4:9',
      };

      const res = await renderBatchItemToBlob(previewItem, itemCropState, resolution, format);
      downloadBlob(res.blob, res.filename);
    } catch (err: any) {
      alert('Error downloading portrait: ' + err.message);
    } finally {
      setIsDownloadingSingle(false);
    }
  };

  // Download pure 6:9 poster from gallery
  const handleDownloadPurePoster = async (posterUrl: string, ver: string) => {
    setIsDownloadingPurePoster(true);
    try {
      const { blob } = await renderPurePosterToBlob(posterUrl, resolution, format, globalFrameStyle);
      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
      downloadBlob(blob, `Reverse1999_Poster_v${ver}_6-9_Pure.${ext}`);
      setShowPurePosterModal(false);
    } catch (err: any) {
      alert('Error downloading pure poster: ' + err.message);
    } finally {
      setIsDownloadingPurePoster(false);
    }
  };

  /**
   * High-capacity, leak-free ZIP Export:
   * When handling >300 images, storing 300-1000 uncompressed canvas blobs simultaneously in browser RAM
   * crashes Chrome/Firefox with Out-of-Memory (OOM).
   * Solution:
   * 1. Process queue in consecutive chunks/volumes of max 75 images.
   * 2. For each volume, render blobs, construct a STORE-compressed zip file, trigger download,
   *    and immediately clear the blobs from RAM.
   * 3. Yield to the JavaScript event loop so Garbage Collector releases the heap.
   */
  const handleExportZip = async () => {
    if (queue.length === 0) return;
    setIsExporting(true);

    const VOLUME_SIZE = 75;
    const totalItems = queue.length;
    const totalVolumes = Math.ceil(totalItems / VOLUME_SIZE);

    try {
      for (let vol = 0; vol < totalVolumes; vol++) {
        const startIndex = vol * VOLUME_SIZE;
        const endIndex = Math.min(startIndex + VOLUME_SIZE, totalItems);
        const chunk = queue.slice(startIndex, endIndex);

        const volBlobs: Array<{ blob: Blob; filename: string }> = [];

        for (let i = 0; i < chunk.length; i++) {
          const globalIdx = startIndex + i;
          const item = chunk[i];
          const modeLabel = item.renderMode === 'illustration'
            ? 'Illustration (Full Bleed)'
            : `L2D (${item.framing === 'half' ? 'Half' : item.framing === 'close' ? 'Close' : 'Full'})`;
          const name = `${item.character.Name} - ${item.garment.name} [${modeLabel}]`;

          setProgress({
            current: globalIdx + 1,
            total: totalItems,
            currentName: `[Volume ${vol + 1}/${totalVolumes}] ${name}`
          });

          const batchCropState: CropState = {
            ...defaultCropState,
            aspectRatio: item.aspectRatio || globalAspectRatio,
            renderMode: item.renderMode || 'l2d',
            framing: item.framing,
            bgPreset: item.bgPreset,
            posterUrl: item.posterUrl,
            posterOpacity: item.posterOpacity,
            posterBlur: item.posterBlur,
            frameStyle: item.frameStyle || globalFrameStyle,
            watermarkStyle: item.watermarkStyle || globalWatermarkStyle,
            showBadge: (item.watermarkStyle || globalWatermarkStyle) !== 'none',
            showAfflatus: item.showAfflatus !== undefined ? item.showAfflatus : globalShowAfflatus,
            showRace: item.showRace !== undefined ? item.showRace : globalShowRace,
            showGarmentName: item.showGarmentName !== undefined ? item.showGarmentName : globalShowGarmentName,
            garmentNameOrientation: item.garmentNameOrientation || globalGarmentNameOrientation,
            enableRoundedCorners: (item.aspectRatio || globalAspectRatio) === '5.4:9',
          };

          try {
            const res = await renderBatchItemToBlob(item, batchCropState, resolution, format);
            volBlobs.push(res);
          } catch (itemErr) {
            console.warn(`Error rendering item ${name}:`, itemErr);
          }
        }

        if (volBlobs.length > 0) {
          setProgress(prev => ({
            ...prev,
            currentName: `Packaging ZIP Volume ${vol + 1} of ${totalVolumes}...`
          }));

          const zip = new JSZip();
          volBlobs.forEach(b => {
            zip.file(b.filename, b.blob);
          });

          // STORE compression: images are already encoded (PNG/WebP), DEFLATE produces 0% savings but causes heap crash
          const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'STORE',
          });

          const ratioTag = globalAspectRatio === '5.4:9' ? '5.4-9_Card' : globalAspectRatio.replace(':', '-');
          const zipName = totalVolumes === 1
            ? `Reverse1999_Batch_${ratioTag}_${resolution}.zip`
            : `Reverse1999_Batch_${ratioTag}_${resolution}_Part_${vol + 1}_of_${totalVolumes}.zip`;

          downloadBlob(zipBlob, zipName);

          // Clear array references to immediately free RAM
          volBlobs.length = 0;
          await new Promise(r => setTimeout(r, 600));
        }
      }
    } catch (err: any) {
      console.error('Batch export failed:', err);
      alert('Error during bulk download: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Sequential individual downloads
  const handleExportSequential = async () => {
    if (queue.length === 0) return;
    setIsExporting(true);
    setProgress({ current: 0, total: queue.length, currentName: 'Starting sequential download...' });

    try {
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        const framingLabel = item.framing === 'half' ? 'Half' : item.framing === 'close' ? 'Close' : 'Full';
        const name = `${item.character.Name} - ${item.garment.name} (${framingLabel})`;
        setProgress({ current: i + 1, total: queue.length, currentName: name });

        const batchCropState: CropState = {
          ...defaultCropState,
          aspectRatio: item.aspectRatio || globalAspectRatio,
          renderMode: item.renderMode || 'l2d',
          framing: item.framing,
          bgPreset: item.bgPreset,
          posterUrl: item.posterUrl,
          posterOpacity: item.posterOpacity,
          posterBlur: item.posterBlur,
          frameStyle: item.frameStyle || globalFrameStyle,
          watermarkStyle: item.watermarkStyle || globalWatermarkStyle,
          showBadge: (item.watermarkStyle || globalWatermarkStyle) !== 'none',
          showAfflatus: item.showAfflatus !== undefined ? item.showAfflatus : globalShowAfflatus,
          showRace: item.showRace !== undefined ? item.showRace : globalShowRace,
          showGarmentName: item.showGarmentName !== undefined ? item.showGarmentName : globalShowGarmentName,
          garmentNameOrientation: item.garmentNameOrientation || globalGarmentNameOrientation,
          enableRoundedCorners: (item.aspectRatio || globalAspectRatio) === '5.4:9',
        };

        try {
          const res = await renderBatchItemToBlob(item, batchCropState, resolution, format);
          downloadBlob(res.blob, res.filename);
          await new Promise(r => setTimeout(r, 500));
        } catch (itemErr) {
          console.warn(`Error rendering item ${name}:`, itemErr);
        }
      }
    } catch (err: any) {
      console.error('Sequential export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const allFilteredSelected = filteredChars.length > 0 && filteredChars.every(c => selectedCharIds.has(c.ID));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[95vh] bg-[#10121b] border border-amber-900/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#df6931]/15 text-[#df6931] border border-[#df6931]/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base md:text-lg font-serif font-bold text-white tracking-wide flex items-center gap-2">
                Bulk Export Studio
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {queue.length} images queued
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Characters are the top-level selection • Queue any garments • Download Live2D & Illustrations simultaneously
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Button to Download Pure 6:9 Poster */}
            <button
              onClick={() => setShowPurePosterModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-[#1a1d2c] hover:bg-[#22263a] border border-amber-600/40 text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Download pure version posters without character"
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Pure Posters</span>
            </button>

            <button
              onClick={onClose}
              disabled={isExporting}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {/* ========================================================================= */}
          {/* 1. TOP-LEVEL SELECTION: CHARACTER BROWSER WITH STAR FILTER & MULTI-SELECT */}
          {/* ========================================================================= */}
          <div className="bg-[#151724] border border-zinc-800 rounded-xl p-3 sm:p-4 space-y-3.5">
            {/* Star Filters + Search Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-300 mr-1 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  Rarity Filter:
                </span>
                {(['ALL', 6, 5, 4, 3, 2] as const).map(star => (
                  <button
                    key={String(star)}
                    onClick={() => setSelectedRarityFilter(star)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      selectedRarityFilter === star
                        ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                        : 'bg-[#1b1e2e] border border-zinc-700/80 text-zinc-400 hover:text-white hover:border-zinc-600'
                    }`}
                  >
                    {star === 'ALL' ? 'All Stars' : `${star}★`}
                  </button>
                ))}
              </div>

              {/* Series Filter & Search Bar Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                {/* Series Dropdown */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedSeriesFilter}
                    onChange={e => setSelectedSeriesFilter(e.target.value)}
                    className="py-1.5 px-2 text-xs bg-[#12141f] border border-zinc-700 rounded-lg text-amber-300 focus:outline-none focus:border-amber-500 font-medium"
                    title="Filter garments and characters by outfit series"
                  >
                    <option value="ALL">All Series</option>
                    {allSeriesNames.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  {selectedSeriesFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => handleQueueSeries(selectedSeriesFilter)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#df6931] hover:bg-[#e35c20] text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm flex-shrink-0"
                      title={`Queue all garments in series "${selectedSeriesFilter}"`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Queue Series</span>
                    </button>
                  )}
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search character, garment, race..."
                    value={charSearch}
                    onChange={e => setCharSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#12141f] border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Bulk Selection Actions Row */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#10121d] p-2.5 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSelectFilteredChars}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                    allFilteredSelected
                      ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                      : 'bg-[#181a28] border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500'
                  }`}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{allFilteredSelected ? 'Deselect Filtered' : `Select Filtered (${filteredChars.length})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const allSet = new Set(allCharacters.map(c => c.ID));
                    setSelectedCharIds(allSet);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#181a28] hover:bg-[#202438] border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
                >
                  Select All Characters ({allCharacters.length})
                </button>

                {selectedCharIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCharIds(new Set())}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-red-400 transition-colors"
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              {/* Bulk Asset Config Controls */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-zinc-400 font-medium">Bulk Assets:</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-amber-300 font-semibold">
                  <input
                    type="checkbox"
                    checked={bulkIncludeL2D}
                    onChange={e => setBulkIncludeL2D(e.target.checked)}
                    className="rounded accent-[#df6931]"
                  />
                  <span>Live2D (With Poster)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-purple-300 font-semibold" title="Default garment will automatically omit illustration as required">
                  <input
                    type="checkbox"
                    checked={bulkIncludeIllu}
                    onChange={e => setBulkIncludeIllu(e.target.checked)}
                    className="rounded accent-purple-500"
                  />
                  <span>Illustration (Full Bleed)</span>
                </label>

                <select
                  value={bulkGarmentScope}
                  onChange={e => setBulkGarmentScope(e.target.value as any)}
                  className="px-2 py-1 rounded bg-[#181b28] border border-zinc-700 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="all">All Outfits (Default + Skins)</option>
                  <option value="skins_only">Skins & Insight II Only</option>
                  <option value="default_only">Default Outfit Only</option>
                </select>
              </div>
            </div>

            {/* Character Carousel / Horizontal Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Select character (click card to view/configure garments):</span>
                <span>{filteredChars.length} characters matched</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-44 overflow-y-auto p-1 bg-[#0d0f17] rounded-xl border border-zinc-800">
                {filteredChars.map(c => {
                  const isActive = activeChar?.ID === c.ID;
                  const isChecked = selectedCharIds.has(c.ID);
                  const defId = `${String(c.ID).padStart(4, '0')}01`;
                  const thumb = `https://assets.merui.net/headicon_small/${defId}.webp`;

                  return (
                    <div
                      key={c.ID}
                      className={`group relative rounded-xl border p-1.5 flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                        isActive
                          ? 'bg-[#df6931]/20 border-[#df6931] ring-2 ring-[#df6931]/60 shadow-lg'
                          : isChecked
                          ? 'bg-amber-600/15 border-amber-500/80'
                          : 'bg-[#161826] border-zinc-800 hover:border-zinc-600'
                      }`}
                      onClick={() => setActiveChar(c)}
                    >
                      {/* Top Checkbox for multi-character selection */}
                      <div
                        onClick={e => {
                          e.stopPropagation();
                          const next = new Set(selectedCharIds);
                          if (isChecked) next.delete(c.ID);
                          else next.add(c.ID);
                          setSelectedCharIds(next);
                        }}
                        className="absolute top-1 right-1 z-10 p-0.5 rounded hover:bg-black/40"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
                        )}
                      </div>

                      {/* Character Avatar */}
                      <div className="w-11 h-11 rounded-lg overflow-hidden bg-black/60 border border-zinc-700 flex-shrink-0 relative">
                        <img
                          src={thumb}
                          alt={String(c.Name)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={e => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>

                      <div className="w-full text-center min-w-0">
                        <p className="text-[11px] font-bold text-white truncate w-full" title={String(c.Name)}>
                          {c.Name}
                        </p>
                        <div className="flex items-center justify-center gap-1 text-[9px] text-amber-400 font-mono">
                          <span>{'★'.repeat(c.Rarity || 5)}</span>
                          <span className="text-zinc-500 font-sans">v{c.Version || '1.0'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Multi-Character Quick Add Banner */}
              {selectedCharIds.size > 0 && (
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#191c2c] p-2.5 rounded-lg border border-amber-600/40">
                  <span className="text-xs text-amber-300 font-medium">
                    Selected <strong>{selectedCharIds.size}</strong> characters
                    <span className="text-zinc-400 ml-1">
                      (Includes: {bulkIncludeL2D ? 'Live2D' : ''}{bulkIncludeL2D && bulkIncludeIllu ? ' & ' : ''}{bulkIncludeIllu ? 'Illustration' : ''})
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddSelectedCharacters}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Queue Selected ({selectedCharIds.size} Characters)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Active Character Outfits & Photos Setup Panel */}
            {activeChar && (
              <div className="mt-3 p-3.5 rounded-xl bg-[#0e101a] border border-amber-700/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-zinc-800 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/60 border border-amber-500 flex-shrink-0">
                      <img
                        src={`https://assets.merui.net/headicon_small/${String(activeChar.ID).padStart(4, '0')}01.webp`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-serif font-bold text-white flex items-center gap-2">
                        {activeChar.Name}
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          v{activeChar.Version || '1.0'}
                        </span>
                        <span className="text-amber-400 text-xs font-mono">
                          {'★'.repeat(activeChar.Rarity || 5)}
                        </span>
                        {activeChar.Afflatus && (
                          <span className="text-[10px] text-zinc-400 font-mono">
                            • {activeChar.Afflatus}
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Select any garments • Live2D (with poster) & Illustration (full bleed) • Default garment features L2D with release poster
                      </p>
                    </div>
                  </div>

                  {/* Actions for active character outfits */}
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={handleSelectAllGarments}
                      className="px-2 py-1 rounded-lg bg-[#181b28] hover:bg-[#202538] border border-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                      title="Select all garments of this character"
                    >
                      Select All ({activeCharGarments.length})
                    </button>

                    <button
                      type="button"
                      onClick={handleDeselectAllGarments}
                      className="px-2 py-1 rounded-lg bg-[#181b28] hover:bg-[#202538] border border-zinc-700 text-zinc-400 text-xs font-medium transition-colors"
                      title="Deselect all garments"
                    >
                      Deselect
                    </button>

                    <button
                      type="button"
                      onClick={handleAddPhotosForActiveChar}
                      className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#df6931] to-[#e87b46] hover:from-[#e35c20] hover:to-[#df6931] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#df6931]/20 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Queue Selected Garments</span>
                    </button>
                  </div>
                </div>

                {/* Garments of this character with Arbitrary Checkbox selection and separate modes */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {activeCharGarments.map(g => {
                    const isDef = isDefaultGarment(g);
                    const opt = charFramingOptions[g.garmentId] || {
                      selected: true,
                      l2d: true,
                      illustration: !isDef,
                      full: true,
                      half: false,
                      close: false,
                    };
                    const isSelected = opt.selected !== false;
                    const gVer = g.version || activeChar.Version || '1.0';
                    const poster = getGalleryPosterForVersion(gVer);

                    const toggleOption = (key: keyof GarmentBatchConfig) => {
                      setCharFramingOptions(prev => ({
                        ...prev,
                        [g.garmentId]: {
                          ...opt,
                          [key]: !opt[key],
                        },
                      }));
                    };

                    return (
                      <div
                        key={g.garmentId}
                        className={`p-2.5 rounded-xl border transition-all space-y-2 flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#141624] border-amber-600/50 shadow-sm'
                            : 'bg-[#10121b]/60 border-zinc-800 opacity-60 hover:opacity-90'
                        }`}
                      >
                        {/* Top: Checkbox, Skin Name, Version & Poster Preview */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Arbitrary selection checkbox */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOption('selected')}
                              className="w-4 h-4 accent-[#df6931] rounded cursor-pointer flex-shrink-0"
                              title="Toggle this garment"
                            />

                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/60 border border-zinc-700 flex-shrink-0">
                              <img
                                src={g.thumbUrl || g.imageUrl}
                                alt={g.name}
                                className="w-full h-full object-cover"
                                onError={e => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate" title={g.name}>
                                {g.name}
                              </p>
                              <div className="flex items-center gap-1 text-[10px] font-mono">
                                <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  v{gVer}
                                </span>
                                <span className="text-zinc-500">
                                  {isDef ? 'Default' : g.category === 'insight' ? 'Insight II' : (g.seriesName || 'Skin')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Matched Poster Tag from gallery/posters */}
                          <div
                            className="group relative w-12 h-8 rounded overflow-hidden border border-amber-700/50 flex-shrink-0"
                            title={`Release poster v${gVer}: ${poster.title}`}
                          >
                            <img src={poster.url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <span className="text-[8px] font-mono font-bold text-white">v{gVer}</span>
                            </div>
                          </div>
                        </div>

                        {/* Options for this garment: L2D vs Illustration */}
                        {isSelected && (
                          <div className="pt-2 border-t border-zinc-800 space-y-1.5 text-[11px]">
                            {/* Option 1: L2D with Poster */}
                            <div className="p-1.5 rounded-lg bg-black/30 border border-zinc-800/80 space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-amber-200">
                                  <input
                                    type="checkbox"
                                    checked={opt.l2d}
                                    onChange={() => toggleOption('l2d')}
                                    className="accent-[#df6931] rounded"
                                  />
                                  <span>🎭 Live2D (With Poster)</span>
                                </label>
                                <span className="text-[9px] font-mono text-zinc-400">
                                  Poster v{gVer}
                                </span>
                              </div>

                              {opt.l2d && (
                                <div className="flex items-center gap-1 pt-1 border-t border-zinc-800 text-[10px]">
                                  <span className="text-zinc-500 mr-0.5">Crop:</span>
                                  <label className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${opt.full ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-zinc-400 hover:text-white'}`}>
                                    <input type="checkbox" checked={opt.full} onChange={() => toggleOption('full')} className="sr-only" />
                                    <span>Full</span>
                                  </label>
                                  <label className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${opt.half ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-zinc-400 hover:text-white'}`}>
                                    <input type="checkbox" checked={opt.half} onChange={() => toggleOption('half')} className="sr-only" />
                                    <span>Half</span>
                                  </label>
                                  <label className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${opt.close ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-zinc-400 hover:text-white'}`}>
                                    <input type="checkbox" checked={opt.close} onChange={() => toggleOption('close')} className="sr-only" />
                                    <span>Close</span>
                                  </label>
                                </div>
                              )}
                            </div>

                            {/* Option 2: Illustration Cover (zoomed cover, no poster) */}
                            {/* CRITICAL: Per requirements, default garment NEVER offers Illustration; retain for other garments */}
                            {!isDef ? (
                              <div className="p-1.5 rounded-lg bg-black/30 border border-zinc-800/80">
                                <label className="flex items-center justify-between cursor-pointer">
                                  <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                                    <input
                                      type="checkbox"
                                      checked={opt.illustration}
                                      onChange={() => toggleOption('illustration')}
                                      className="accent-purple-500 rounded"
                                    />
                                    <span className={opt.illustration ? 'font-bold text-purple-300' : ''}>
                                      🖼️ Illustration (Full Bleed)
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-zinc-500">
                                    Studio Backdrop
                                  </span>
                                </label>
                              </div>
                            ) : (
                              <div className="p-1 px-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[10px] text-zinc-500 italic">
                                Default garment is Live2D only (pairs with base poster)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 2. GLOBAL BATCH CONTROLS (Framing, Background, Frame, Watermark)          */}
          {/* ========================================================================= */}
          <div className="bg-[#12141e] border border-zinc-800/80 rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-[#df6931]" />
                Global Batch Presets (Applies to all items in queue)
              </h3>
              <span className="text-[11px] text-zinc-400">
                Click Preview <Eye className="w-3 h-3 inline text-amber-400" /> on any item to view high-resolution render
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
              {/* Global Aspect Ratio */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-medium">Aspect Ratio:</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: '6:9' as AspectRatioType, label: '6:9' },
                    { id: '5.4:9' as AspectRatioType, label: '5.4:9' },
                    { id: '9:16' as AspectRatioType, label: '9:16' },
                    { id: '3:4' as AspectRatioType, label: '3:4' },
                    { id: '1:1' as AspectRatioType, label: '1:1' },
                    { id: '16:9' as AspectRatioType, label: '16:9' },
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleApplyGlobalAspectRatio(r.id)}
                      className={`py-1 rounded border text-[10px] text-center font-medium transition-all ${
                        globalAspectRatio === r.id
                          ? 'bg-[#df6931] border-[#df6931] text-white font-bold shadow-sm'
                          : 'bg-[#181a26] border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title={r.id === '5.4:9' ? '5.4:9 Photocard Bo Góc' : r.id}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Global Framing */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-medium">Framing:</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['full', 'half', 'close'] as FramingType[]).map(f => (
                    <button
                      key={f}
                      onClick={() => handleApplyGlobalFraming(f)}
                      className={`py-1 rounded border text-[11px] text-center transition-all ${
                        globalFraming === f
                          ? 'bg-[#df6931] border-[#df6931] text-white font-bold'
                          : 'bg-[#181a26] border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {f === 'full' ? 'Full' : f === 'half' ? 'Half' : 'Close'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Global Background */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-medium">Background:</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'version-poster' as BackgroundPreset, label: 'Poster v' },
                    { id: 'transparent' as BackgroundPreset, label: 'Clear' },
                    { id: 'dark-uttu' as BackgroundPreset, label: 'Studio' },
                  ].map(b => (
                    <button
                      key={b.id}
                      onClick={() => handleApplyGlobalBg(b.id)}
                      className={`py-1 rounded border text-[11px] text-center transition-all ${
                        globalBg === b.id
                          ? 'bg-amber-600 border-amber-500 text-white font-bold'
                          : 'bg-[#181a26] border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Global Frame Style */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-medium">Border Frame:</label>
                <select
                  value={globalFrameStyle}
                  onChange={e => handleApplyGlobalFrame(e.target.value as FrameStyle)}
                  className="w-full py-1 px-1.5 rounded bg-[#181a26] border border-zinc-700 text-xs text-amber-300 focus:outline-none"
                >
                  <option value="art-deco-gold">Art Deco Gold</option>
                  <option value="celestial-astrolabe">Celestial Astrolabe</option>
                  <option value="gothic-arcanum">Gothic Arcanum</option>
                  <option value="none">No Border</option>
                </select>
              </div>

              {/* Global Watermark Style & Afflatus/Race/Plaque Toggle */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-zinc-400 font-medium">Typography:</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleApplyGlobalShowAfflatus(!globalShowAfflatus)}
                      className={`text-[9px] px-1 py-0.2 rounded font-mono border transition-all ${
                        globalShowAfflatus
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                          : 'bg-[#181a26] border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                      title="Toggle Afflatus display on watermark"
                    >
                      Aff
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyGlobalShowAfflatusSymbol(!globalShowAfflatusSymbol)}
                      className={`text-[9px] px-1 py-0.2 rounded font-mono border transition-all ${
                        globalShowAfflatusSymbol
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                          : 'bg-[#181a26] border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                      title="Toggle Gold Afflatus Emblem (left of name)"
                    >
                      Emblem
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyGlobalShowRace(!globalShowRace)}
                      className={`text-[9px] px-1 py-0.2 rounded font-mono border transition-all ${
                        globalShowRace
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                          : 'bg-[#181a26] border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                      title="Toggle Character Race display on watermark"
                    >
                      Race
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyGlobalShowGarmentName(!globalShowGarmentName)}
                      className={`text-[9px] px-1 py-0.2 rounded font-mono border transition-all ${
                        globalShowGarmentName
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                          : 'bg-[#181a26] border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                      title="Toggle Garment Name plaque on upper left"
                    >
                      Plaque
                    </button>
                  </div>
                </div>
                <select
                  value={globalWatermarkStyle}
                  onChange={e => handleApplyGlobalWatermark(e.target.value as WatermarkStyle)}
                  className="w-full py-1 px-1.5 rounded bg-[#181a26] border border-zinc-700 text-xs text-amber-300 focus:outline-none"
                >
                  <option value="silver-gold-metallic">Silver & Gold Specular</option>
                  <option value="art-deco-gold">Art Deco Gold</option>
                  <option value="cinematic">Cinematic Subtitle</option>
                  <option value="gilded-manuscript">Gilded Manuscript</option>
                  <option value="none">No Watermark</option>
                </select>
              </div>

              {/* Resolution: Locked to 4K Max */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-medium">Export Quality:</label>
                <div className="py-1 px-2 rounded border border-[#df6931]/40 bg-[#161825] flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#df6931]" />
                    4K Max (3600px)
                  </span>
                  <span className="text-[9px] font-mono font-bold text-amber-400">4K ONLY</span>
                </div>
              </div>

              {/* Format */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-medium">Export Format:</label>
                <div className="grid grid-cols-3 gap-0.5">
                  {(['image/png', 'image/webp', 'image/jpeg'] as ExportFormat[]).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setFormat(fmt)}
                      className={`py-1 rounded border text-[10px] text-center uppercase transition-all ${
                        format === fmt
                          ? 'bg-amber-600 border-amber-500 text-white font-bold'
                          : 'bg-[#181a26] border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {fmt.replace('image/', '')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. DETAILED QUEUE WITH PER-ITEM SETTINGS & INDIVIDUAL PREVIEW BUTTON      */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                Export Queue ({queue.length} items)
                <span className="text-[11px] font-normal text-amber-400">
                  (Click Preview to view 6:9 high-res render or customize individually)
                </span>
              </h3>

              {queue.length > 0 && (
                <button
                  onClick={handleClearQueue}
                  className="px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-[11px] text-red-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Queue</span>
                </button>
              )}
            </div>

            {queue.length > 0 ? (
              <div className="divide-y divide-zinc-800/80 max-h-72 overflow-y-auto bg-[#0c0e15] border border-zinc-800/80 rounded-xl">
                {queue.map((item, index) => {
                  const gVer = item.garment.version || item.character.Version || '1.0';
                  const isItemAfflatus = item.showAfflatus !== undefined ? item.showAfflatus : globalShowAfflatus;
                  const isItemDefault = isDefaultGarment(item.garment);

                  return (
                    <div
                      key={item.id}
                      className="p-2 sm:p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 hover:bg-[#141622] transition-colors"
                    >
                      {/* Left: Thumbnail & Name & Version info */}
                      <div className="flex items-center gap-2.5 min-w-[220px]">
                        <span className="text-xs font-mono text-zinc-500 w-5">#{index + 1}</span>

                        {/* Clickable thumbnail to preview */}
                        <div
                          onClick={() => setPreviewIndex(index)}
                          className="group relative w-10 h-10 rounded-lg overflow-hidden bg-black/50 border border-zinc-700 flex-shrink-0 cursor-pointer hover:border-amber-500 transition-colors"
                          title="Click to preview this portrait"
                        >
                          <img
                            src={item.garment.thumbUrl || item.garment.imageUrl}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            onError={e => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">
                              {item.character.Name}
                            </span>
                            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              v{gVer}
                            </span>
                            <span className="text-[10px] text-amber-400 font-mono">
                              {'★'.repeat(item.character.Rarity || 5)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-zinc-300 truncate max-w-[130px]">
                              {item.garment.name}
                            </span>
                            {item.renderMode === 'illustration' ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                                🖼️ Full Bleed
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                🎭 Live2D
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleUpdateItemAfflatus(item.id, !isItemAfflatus)}
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono border transition-all ${
                                isItemAfflatus
                                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                                  : 'bg-zinc-800/80 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                              }`}
                              title="Toggle Afflatus watermark display"
                            >
                              {isItemAfflatus ? 'Afflatus: On' : 'Afflatus: Off'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: Controls & Preview Trigger */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Eye Preview Button */}
                        <button
                          onClick={() => setPreviewIndex(index)}
                          className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                          title="Open 6:9 preview dialog"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>Preview</span>
                        </button>

                        {/* Mode Switcher per item (only if not default garment) */}
                        {!isItemDefault ? (
                          <div className="flex items-center gap-0.5 bg-[#1a1d2c] p-0.5 rounded-lg border border-zinc-700/60">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemRenderMode(item.id, 'l2d')}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                item.renderMode !== 'illustration'
                                  ? 'bg-amber-600 text-white font-bold'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                              title="Live2D mode with version poster"
                            >
                              L2D
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemRenderMode(item.id, 'illustration')}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                item.renderMode === 'illustration'
                                  ? 'bg-purple-600 text-white font-bold'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                              title="Illustration mode with studio backdrop"
                            >
                              Illu
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono">
                            Live2D
                          </span>
                        )}

                        {/* Framing selector (Full, Half, Close) for L2D mode */}
                        {item.renderMode !== 'illustration' && (
                          <div className="flex items-center gap-1 bg-[#1a1d2c] p-1 rounded-lg border border-zinc-700/60">
                            <span className="text-[10px] text-zinc-400 px-1">Crop:</span>
                            {(['full', 'half', 'close'] as FramingType[]).map(f => (
                              <button
                                key={f}
                                onClick={() => handleUpdateItemFraming(item.id, f)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                  item.framing === f
                                    ? 'bg-[#df6931] text-white shadow-xs'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                {f === 'full' ? 'Full' : f === 'half' ? 'Half' : 'Close'}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Background selector per item (only if L2D) */}
                        {item.renderMode !== 'illustration' && (
                          <div className="flex items-center gap-1 bg-[#1a1d2c] p-1 rounded-lg border border-zinc-700/60">
                            <span className="text-[10px] text-zinc-400 px-1">BG:</span>
                            {[
                              { id: 'version-poster' as BackgroundPreset, label: 'Poster' },
                              { id: 'transparent' as BackgroundPreset, label: 'Clear' },
                              { id: 'dark-uttu' as BackgroundPreset, label: 'Studio' },
                            ].map(bg => (
                              <button
                                key={bg.id}
                                onClick={() => handleUpdateItemBg(item.id, bg.id)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                  item.bgPreset === bg.id
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                {bg.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Pick specific poster from gallery/posters if version-poster */}
                        {item.renderMode !== 'illustration' && item.bgPreset === 'version-poster' && (
                          <button
                            onClick={() => setActiveItemForPoster(item.id)}
                            className="px-2 py-1 rounded bg-[#1e2233] hover:bg-[#282d44] border border-amber-600/40 text-[10px] text-amber-300 flex items-center gap-1"
                            title="Select a different poster from gallery/posters"
                          >
                            <Film className="w-3 h-3 text-amber-400" />
                            <span>Poster</span>
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors ml-0.5"
                          title="Remove item from queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl space-y-1">
                <p>The export queue is currently empty.</p>
                <p className="text-zinc-400">Select characters above and click &quot;+ Queue Selected&quot; or configure garments to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions & Export Progress */}
        <div className="p-3 sm:p-4 border-t border-zinc-800 bg-[#0d0f17] space-y-3">
          {isExporting && (
            <div className="space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-400 font-medium flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {progress.currentName}
                </span>
                <span className="font-mono text-zinc-400">
                  {progress.current}/{progress.total} (
                  {Math.round((progress.current / Math.max(1, progress.total)) * 100)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#df6931] to-amber-500 transition-all duration-200"
                  style={{
                    width: `${Math.round((progress.current / Math.max(1, progress.total)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-zinc-400">
              Total to export: <strong className="text-white">{queue.length}</strong> images (4K Max, {globalAspectRatio})
            </span>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleExportSequential}
                disabled={queue.length === 0 || isExporting}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#1b1e2c] hover:bg-[#232739] border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors disabled:opacity-50"
              >
                Download One by One
              </button>

              <button
                onClick={handleExportZip}
                disabled={queue.length === 0 || isExporting}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#df6931] to-[#e87b46] hover:from-[#e35c20] hover:to-[#df6931] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#df6931]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing {progress.current}/{progress.total}...</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    <span>Export to ZIP ({queue.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INDIVIDUAL IMAGE PREVIEW MODAL LIGHTBOX                                   */}
        {/* ========================================================================= */}
        {previewItem && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#12141f] border border-amber-600/50 rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
              {/* Close Button Top Right */}
              <button
                onClick={() => setPreviewIndex(null)}
                className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/70 hover:bg-black text-zinc-300 hover:text-white border border-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Left Column: Canvas Preview Display (Fully responsive on mobile without cropping) */}
              <div className="relative flex-1 bg-[#090a10] flex items-center justify-center p-3 sm:p-5 min-h-[280px] md:min-h-[480px]">
                {isPreviewRendering ? (
                  <div className="flex flex-col items-center gap-2 text-amber-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-medium">Rendering 4K preview...</span>
                  </div>
                ) : previewBlobUrl ? (
                  <div className="relative max-h-[48vh] md:max-h-[76vh] w-auto max-w-full rounded-xl overflow-hidden shadow-2xl border border-amber-900/40 bg-black flex items-center justify-center">
                    <img
                      src={previewBlobUrl}
                      alt="Preview"
                      className="max-h-[48vh] md:max-h-[76vh] w-auto max-w-full object-contain"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/40">
                      {previewItem.aspectRatio || globalAspectRatio} 4K MAX
                    </div>
                  </div>
                ) : (
                  <div className="text-zinc-500 text-xs">Unable to generate preview image</div>
                )}

                {/* Queue navigation controls */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none">
                  <button
                    onClick={() => setPreviewIndex(prev => (prev !== null && prev > 0 ? prev - 1 : queue.length - 1))}
                    className="pointer-events-auto px-2.5 py-1.5 rounded-lg bg-black/70 hover:bg-black border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1 shadow-lg"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <span className="px-3 py-1 rounded-full bg-black/80 text-[11px] font-mono text-amber-300 border border-zinc-800">
                    {previewIndex! + 1} / {queue.length}
                  </span>

                  <button
                    onClick={() => setPreviewIndex(prev => (prev !== null && prev < queue.length - 1 ? prev + 1 : 0))}
                    className="pointer-events-auto px-2.5 py-1.5 rounded-lg bg-black/70 hover:bg-black border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1 shadow-lg"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Column: Live Tweaks & Download Single Item */}
              <div className="w-full md:w-80 lg:w-96 p-4 sm:p-5 bg-[#141724] border-t md:border-t-0 md:border-l border-zinc-800 flex flex-col justify-between overflow-y-auto space-y-4">
                <div className="space-y-3.5">
                  {/* Item Info Banner */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-xs font-mono font-bold border border-amber-500/30">
                        v{previewItem.garment.version || previewItem.character.Version || '1.0'}
                      </span>
                      <span className="text-amber-400 font-mono text-xs">
                        {'★'.repeat(previewItem.character.Rarity || 5)}
                      </span>
                    </div>
                    <h3 className="text-base font-serif font-bold text-white">
                      {previewItem.character.Name}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Outfit: <strong className="text-zinc-200">{previewItem.garment.name}</strong> {previewItem.useLive2d ? '(Live2D)' : ''}
                    </p>
                  </div>

                  {/* Render Mode (L2D vs Illustration) */}
                  {!isDefaultGarment(previewItem.garment) && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Asset Mode:
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemRenderMode(previewItem.id, 'l2d')}
                          className={`py-1.5 px-2 rounded-lg border text-xs font-semibold text-center transition-all ${
                            previewItem.renderMode !== 'illustration'
                              ? 'bg-amber-600 border-amber-500 text-white font-bold'
                              : 'bg-[#1b1e2c] border-zinc-700 text-zinc-400 hover:text-white'
                          }`}
                        >
                          🎭 Live2D (With Poster)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemRenderMode(previewItem.id, 'illustration')}
                          className={`py-1.5 px-2 rounded-lg border text-xs font-semibold text-center transition-all ${
                            previewItem.renderMode === 'illustration'
                              ? 'bg-purple-600 border-purple-500 text-white font-bold'
                              : 'bg-[#1b1e2c] border-zinc-700 text-zinc-400 hover:text-white'
                          }`}
                        >
                          🖼️ Illustration (Full Bleed)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 1. Framing Adjust (Only for L2D mode) */}
                  {previewItem.renderMode !== 'illustration' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-[#df6931]" />
                        Framing:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'full' as FramingType, label: 'Full Body', sub: 'Full' },
                          { id: 'half' as FramingType, label: 'Half Body', sub: 'Half' },
                          { id: 'close' as FramingType, label: 'Close-Up', sub: 'Close' },
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => handleUpdateItemFraming(previewItem.id, f.id)}
                            className={`p-1.5 rounded-lg border text-center transition-all ${
                              previewItem.framing === f.id
                                ? 'bg-[#df6931] border-[#df6931] text-white font-bold'
                                : 'bg-[#1b1e2c] border-zinc-700 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <div className="text-xs">{f.label}</div>
                            <span className="text-[10px] opacity-75">{f.sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Background Selector (Only for L2D mode) */}
                  {previewItem.renderMode !== 'illustration' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                        <Palette className="w-3.5 h-3.5 text-amber-400" />
                        Background:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'version-poster' as BackgroundPreset, label: 'Poster' },
                          { id: 'transparent' as BackgroundPreset, label: 'Clear' },
                          { id: 'dark-uttu' as BackgroundPreset, label: 'Studio' },
                        ].map(b => (
                          <button
                            key={b.id}
                            onClick={() => handleUpdateItemBg(previewItem.id, b.id)}
                            className={`py-1.5 rounded-lg border text-xs text-center transition-all ${
                              previewItem.bgPreset === b.id
                                ? 'bg-amber-600 border-amber-500 text-white font-bold'
                                : 'bg-[#1b1e2c] border-zinc-700 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>

                      {previewItem.bgPreset === 'version-poster' && (
                        <button
                          onClick={() => setActiveItemForPoster(previewItem.id)}
                          className="w-full mt-1 py-1.5 px-2 rounded-lg bg-[#202538] hover:bg-[#282f48] border border-amber-600/40 text-xs text-amber-300 flex items-center justify-center gap-1.5"
                        >
                          <Film className="w-3.5 h-3.5 text-amber-400" />
                          <span>Change Version Poster</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* 3. Frame Style */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Border Frame:
                    </label>
                    <select
                      value={previewItem.frameStyle || globalFrameStyle}
                      onChange={e => handleUpdateItemFrame(previewItem.id, e.target.value as FrameStyle)}
                      className="w-full py-1.5 px-2 rounded-lg bg-[#1b1e2c] border border-zinc-700 text-xs text-amber-300 focus:outline-none"
                    >
                      <option value="art-deco-gold">Art Deco Gold (Engraved Gold Filigree)</option>
                      <option value="celestial-astrolabe">Celestial Astrolabe (Time Mechanism)</option>
                      <option value="gothic-arcanum">Gothic Arcanum (Palace of Arcanum)</option>
                      <option value="none">No Border (Full Edge to Edge)</option>
                    </select>
                  </div>

                  {/* 4. Watermark Typography Style */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      Name & Stars Typography:
                    </label>
                    <select
                      value={previewItem.watermarkStyle || globalWatermarkStyle}
                      onChange={e => handleUpdateItemWatermark(previewItem.id, e.target.value as WatermarkStyle)}
                      className="w-full py-1.5 px-2 rounded-lg bg-[#1b1e2c] border border-zinc-700 text-xs text-amber-300 focus:outline-none"
                    >
                      <option value="silver-gold-metallic">Silver & Gold Specular (Chromatic Shift)</option>
                      <option value="art-deco-gold">Art Deco Gold Plaque (Right Corner)</option>
                      <option value="cinematic">Cinematic Subtitle (Center Bottom)</option>
                      <option value="gilded-manuscript">Gilded Manuscript (Medieval Bookplate)</option>
                      <option value="none">No Watermark</option>
                    </select>
                  </div>

                  {/* 5. Afflatus on/off toggle */}
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none">
                      <input
                        type="checkbox"
                        checked={previewItem.showAfflatus !== undefined ? previewItem.showAfflatus : globalShowAfflatus}
                        onChange={e => handleUpdateItemAfflatus(previewItem.id, e.target.checked)}
                        className="rounded accent-[#df6931]"
                      />
                      <span className="flex items-center gap-1.5">
                        <span>Display Afflatus</span>
                        {previewItem.character.Afflatus && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {previewItem.character.Afflatus}
                          </span>
                        )}
                      </span>
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {(previewItem.showAfflatus !== undefined ? previewItem.showAfflatus : globalShowAfflatus) ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  {/* 6. Garment Name Plaque on/off toggle */}
                  <div className="pt-1.5 border-t border-zinc-800 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none">
                      <input
                        type="checkbox"
                        checked={previewItem.showGarmentName !== undefined ? previewItem.showGarmentName : globalShowGarmentName}
                        onChange={e => handleUpdateItemGarmentName(previewItem.id, e.target.checked)}
                        className="rounded accent-[#df6931]"
                      />
                      <span>Top-Left Outfit Name Plaque</span>
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {(previewItem.showGarmentName !== undefined ? previewItem.showGarmentName : globalShowGarmentName) ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Bottom Action: Download Single Item Now */}
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <button
                    onClick={handleDownloadPreviewItem}
                    disabled={isDownloadingSingle}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#df6931] to-[#e87b46] hover:from-[#e35c20] hover:to-[#df6931] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#df6931]/30 transition-all disabled:opacity-50"
                  >
                    {isDownloadingSingle ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Rendering 4K ({previewItem.aspectRatio || globalAspectRatio})...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Download 4K Portrait</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setPreviewIndex(null)}
                    className="w-full py-1.5 rounded-lg bg-[#1a1d2c] hover:bg-[#22263a] border border-zinc-700 text-xs text-zinc-300"
                  >
                    Return to Queue
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* POSTER PICKER SUB-MODAL                                                   */}
        {/* ========================================================================= */}
        {activeItemForPoster && (
          <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#141624] border border-amber-600/50 rounded-2xl max-w-2xl w-full p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-[#df6931]" />
                  Select Version Poster from gallery/posters
                </h4>
                <button
                  onClick={() => setActiveItemForPoster(null)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto p-1">
                {GALLERY_POSTERS.map(p => (
                  <button
                    key={p.url}
                    onClick={() => handleUpdateItemPoster(activeItemForPoster, p.url)}
                    className="group relative rounded-lg overflow-hidden border border-zinc-700 hover:border-amber-500 text-left transition-all"
                  >
                    <img src={p.url} alt="" className="w-full h-20 object-cover" />
                    <div className="p-1 bg-black/80">
                      <p className="text-[10px] font-bold text-white truncate">{p.title}</p>
                      <span className="text-[9px] text-zinc-400">v{p.version} ({p.lang})</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PURE POSTER 6:9 DOWNLOAD MODAL (NO CHARACTER)                             */}
        {/* ========================================================================= */}
        {showPurePosterModal && (
          <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#141624] border border-amber-600/50 rounded-2xl max-w-3xl w-full p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Download Pure Version Posters (Standard 6:9 - No Character)
                    </h4>
                    <p className="text-xs text-zinc-400">
                      All posters are sourced directly from{' '}
                      <span className="text-amber-400 font-mono">https://uttu.merui.net/gallery/posters/</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPurePosterModal(false)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-96 overflow-y-auto p-1">
                {GALLERY_POSTERS.map(p => (
                  <div
                    key={p.url}
                    className="group relative rounded-xl overflow-hidden border border-zinc-700 hover:border-amber-500 bg-[#0e101a] transition-all flex flex-col"
                  >
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
                      <img
                        src={p.url}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded bg-black/75 text-[9px] font-mono text-amber-300">
                        v{p.version}
                      </span>
                    </div>

                    <div className="p-2 flex-1 flex flex-col justify-between gap-1.5">
                      <div>
                        <p className="text-xs font-bold text-white truncate" title={p.title}>
                          {p.title}
                        </p>
                        <span className="text-[10px] text-zinc-400">
                          Version v{p.version} ({p.lang})
                        </span>
                      </div>

                      <button
                        onClick={() => handleDownloadPurePoster(p.url, p.version)}
                        disabled={isDownloadingPurePoster}
                        className="w-full py-1.5 px-2 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-[11px] font-semibold text-amber-200 flex items-center justify-center gap-1 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download 6:9 ({resolution.toUpperCase()})</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
