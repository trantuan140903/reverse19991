export type AfflatusType = 'Beast' | 'Plant' | 'Star' | 'Mineral' | 'Spirit' | 'Intellect' | 'Intelligence' | string;

export interface CharacterItem {
  ID: number;
  Name: string | number;
  Version?: string;
  Rarity: number;
  Afflatus: AfflatusType;
  Race?: string;
  'DMG Type'?: string;
  Gender?: string;
  Tags?: string[];
  'Other Name'?: string | string[];
  Alpha?: string;
  LocaleName?: {
    en?: string;
    zh?: string;
    tw?: string;
    jp?: string;
    kr?: string;
    vi?: string;
  };
}

export interface Garment {
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
}

export interface CharacterProfileResponse {
  success: boolean;
  slug: string;
  character: CharacterItem | null;
  garments: Garment[];
  storyBgs?: string[];
  profileUrl: string;
  error?: string;
}

export type AspectRatioType = '6:9' | '5.4:9' | '9:16' | '1:1' | '3:4' | '4:3' | '16:9' | 'original';

export type BackgroundPreset = 
  | 'version-poster'
  | 'illustration-backdrop'
  | 'transparent'
  | 'dark-uttu'
  | 'vintage-gold'
  | 'mystic-nebula'
  | 'arcanist-crimson'
  | 'parchment'
  | 'solid';

export type FramingType = 'full' | 'half' | 'close';

export type WatermarkStyle = 
  | 'art-deco-gold'
  | 'silver-gold-metallic'
  | 'cinematic'
  | 'gilded-manuscript'
  | 'none';

export type FrameStyle = 
  | 'none'
  | 'art-deco-gold'
  | 'celestial-astrolabe'
  | 'gothic-arcanum';

export type RenderMode = 'l2d' | 'illustration';
export type GarmentNameOrientation = 'horizontal' | 'vertical';

export interface CropState {
  aspectRatio: AspectRatioType;
  framing: FramingType;
  renderMode: RenderMode;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  flipH: boolean;
  bgPreset: BackgroundPreset;
  customBgColor: string;
  posterUrl?: string;
  posterOpacity: number; // 0 (transparent) to 1 (opaque)
  posterBlur: number; // 0 to 20
  posterDarken: number; // 0 to 1
  enableShadow: boolean;
  shadowBlur: number;
  shadowColor: string;
  showBadge: boolean;
  showAfflatus: boolean;
  showAfflatusSymbol?: boolean;
  showRace: boolean;
  showGarmentName: boolean;
  garmentNameOrientation?: GarmentNameOrientation;
  watermarkStyle: WatermarkStyle;
  frameStyle: FrameStyle;
  enableRoundedCorners: boolean; // Photocard bo góc
  cornerRadius: number; // Radius in pixels (e.g. 36)
  padding: number;
}

export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';
export type ExportResolution = 'standard' | 'hd' | '2k' | '4k';

export interface BatchItem {
  id: string; // unique item id
  character: CharacterItem;
  garment: Garment;
  aspectRatio?: AspectRatioType;
  useLive2d?: boolean;
  renderMode?: RenderMode;
  framing: FramingType;
  bgPreset: BackgroundPreset;
  posterUrl?: string;
  posterOpacity: number;
  posterBlur: number;
  frameStyle?: FrameStyle;
  watermarkStyle?: WatermarkStyle;
  showAfflatus?: boolean;
  showAfflatusSymbol?: boolean;
  showRace?: boolean;
  showGarmentName?: boolean;
  garmentNameOrientation?: GarmentNameOrientation;
  enableRoundedCorners?: boolean;
  cornerRadius?: number;
  seriesId?: string;
  seriesName?: string;
}
