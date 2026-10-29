import React, { useState, useMemo } from 'react';
import { X, Search, Star, Filter } from 'lucide-react';
import { CharacterItem, AfflatusType } from '../types';

interface CharacterGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: CharacterItem[];
  selectedCharacter: CharacterItem | null;
  onSelectCharacter: (char: CharacterItem) => void;
}

const AFFLATUS_LIST: { id: string; label: string; color: string }[] = [
  { id: 'ALL', label: 'All Afflatus', color: 'bg-zinc-800' },
  { id: 'Mineral', label: 'Mineral', color: 'text-amber-400' },
  { id: 'Beast', label: 'Beast', color: 'text-red-400' },
  { id: 'Plant', label: 'Plant', color: 'text-emerald-400' },
  { id: 'Star', label: 'Star', color: 'text-sky-400' },
  { id: 'Spirit', label: 'Spirit', color: 'text-purple-400' },
  { id: 'Intellect', label: 'Intellect', color: 'text-indigo-400' },
];

export const CharacterGalleryModal: React.FC<CharacterGalleryModalProps> = ({
  isOpen,
  onClose,
  characters,
  selectedCharacter,
  onSelectCharacter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [rarityFilter, setRarityFilter] = useState<number | 'ALL'>('ALL');
  const [afflatusFilter, setAfflatusFilter] = useState<string>('ALL');

  const filteredCharacters = useMemo(() => {
    return characters.filter(c => {
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const name = String(c.Name || '').toLowerCase();
        const matchesName = name.includes(query);
        const matchesZh = c.LocaleName?.zh?.toLowerCase().includes(query);
        const matchesEn = c.LocaleName?.en?.toLowerCase().includes(query);
        const matchesId = String(c.ID) === query;
        if (!matchesName && !matchesZh && !matchesEn && !matchesId) return false;
      }

      // Rarity
      if (rarityFilter !== 'ALL' && c.Rarity !== rarityFilter) return false;

      // Afflatus
      if (afflatusFilter !== 'ALL') {
        const charAff = (c.Afflatus === 'Intelligence' ? 'Intellect' : c.Afflatus) || '';
        const filterAff = afflatusFilter === 'Intelligence' ? 'Intellect' : afflatusFilter;
        if (charAff.toLowerCase() !== filterAff.toLowerCase()) return false;
      }

      return true;
    });
  }, [characters, searchTerm, rarityFilter, afflatusFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#10121b] border border-amber-900/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-serif font-bold text-white tracking-wide">
              Reverse: 1999 Character Gallery
            </h2>
            <p className="text-xs text-zinc-400">
              Select a character to crop and style 6:9 full-body portrait ({filteredCharacters.length}/{characters.length} characters)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter controls */}
        <div className="p-4 border-b border-zinc-800/80 bg-[#141622] space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name (Sonetto, 37, Regulus, Lucy...)"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#1b1e2e] border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#df6931]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Rarity filter */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              <span className="text-zinc-400 text-xs px-1">Rarity:</span>
              <button
                onClick={() => setRarityFilter('ALL')}
                className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                  rarityFilter === 'ALL'
                    ? 'bg-[#df6931] border-[#df6931] text-white font-medium'
                    : 'bg-[#1b1e2e] border-zinc-700 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                All
              </button>
              {[6, 5, 4, 3, 2].map(stars => (
                <button
                  key={stars}
                  onClick={() => setRarityFilter(stars)}
                  className={`px-2 py-1.5 rounded-md border flex items-center gap-0.5 text-xs transition-colors ${
                    rarityFilter === stars
                      ? 'bg-amber-600 border-amber-500 text-white font-bold'
                      : 'bg-[#1b1e2e] border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <span>{stars}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Afflatus buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 scrollbar-none">
            <span className="text-zinc-400 text-xs px-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Afflatus:
            </span>
            {AFFLATUS_LIST.map(aff => {
              const isSelected = afflatusFilter === aff.id;
              return (
                <button
                  key={aff.id}
                  onClick={() => setAfflatusFilter(aff.id)}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap border text-xs transition-colors ${
                    isSelected
                      ? 'bg-zinc-100 text-black border-white font-semibold'
                      : 'bg-[#1b1e2e] border-zinc-700/80 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {aff.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Characters Grid */}
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredCharacters.map(char => {
            const isSelected = selectedCharacter?.ID === char.ID;
            const thumbUrl = `https://assets.merui.net/headicon_small/${String(char.ID).padStart(4, '0')}01.webp`;

            return (
              <div
                key={char.ID}
                onClick={() => {
                  onSelectCharacter(char);
                  onClose();
                }}
                className={`group relative flex flex-col items-center p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#25283a] border-[#df6931] shadow-lg shadow-[#df6931]/20 ring-1 ring-[#df6931]'
                    : 'bg-[#151724] border-zinc-800 hover:border-zinc-600 hover:bg-[#1a1c2c] hover:scale-[1.02]'
                }`}
              >
                {/* Rarity stars top badge */}
                <div className="absolute top-2 left-2 flex items-center text-amber-400">
                  {Array.from({ length: char.Rarity || 5 }).map((_, i) => (
                    <Star key={i} className="w-2.5 h-2.5 fill-amber-400" />
                  ))}
                </div>

                {/* Afflatus badge top right */}
                <span className="absolute top-2 right-2 text-[10px] font-mono text-zinc-400 px-1 py-0.5 rounded bg-black/40">
                  {char.Afflatus}
                </span>

                {/* Avatar */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 my-2 rounded-xl overflow-hidden bg-black/40 border border-zinc-700/80 group-hover:border-zinc-500 transition-colors flex items-center justify-center">
                  <img
                    src={thumbUrl}
                    alt={String(char.Name)}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                    onError={e => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Name & Version */}
                <div className="text-center w-full space-y-0.5">
                  <h3 className="font-semibold text-xs sm:text-sm text-zinc-100 truncate w-full" title={String(char.Name)}>
                    {char.Name}
                  </h3>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      v{char.Version || '1.0'}
                    </span>
                    {char.LocaleName?.zh && (
                      <span className="text-[10px] text-zinc-500 truncate max-w-[60px]">
                        {char.LocaleName.zh}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredCharacters.length === 0 && (
            <div className="col-span-full py-16 text-center text-zinc-400 space-y-2">
              <p>No characters found matching your filters.</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setRarityFilter('ALL');
                  setAfflatusFilter('ALL');
                }}
                className="text-xs text-[#df6931] hover:underline"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
