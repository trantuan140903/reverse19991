import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Grid, Star, Sparkles, Filter } from 'lucide-react';
import { CharacterItem } from '../types';
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

interface CharacterSearchProps {
  characters: CharacterItem[];
  selectedCharacter: CharacterItem | null;
  onSelectCharacter: (char: CharacterItem) => void;
  onOpenBrowseModal: () => void;
  isLoading?: boolean;
}

const POPULAR_NAMES = [
  'Sonetto',
  'Regulus',
  '37',
  'Tooth Fairy',
  'Lucy',
  'Windsong',
  'Jiu Niangzi',
  'Voyager',
  '6',
  'Bkornblume',
  'Sotheby'
];

const AFFLATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Beast: { bg: 'bg-red-950/40', text: 'text-red-400', border: 'border-red-800/40' },
  Plant: { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-800/40' },
  Star: { bg: 'bg-sky-950/40', text: 'text-sky-400', border: 'border-sky-800/40' },
  Mineral: { bg: 'bg-amber-950/40', text: 'text-amber-400', border: 'border-amber-800/40' },
  Spirit: { bg: 'bg-purple-950/40', text: 'text-purple-400', border: 'border-purple-800/40' },
  Intellect: { bg: 'bg-indigo-950/40', text: 'text-indigo-400', border: 'border-indigo-800/40' },
  Intelligence: { bg: 'bg-indigo-950/40', text: 'text-indigo-400', border: 'border-indigo-800/40' },
};

export const CharacterSearch: React.FC<CharacterSearchProps> = ({
  characters,
  selectedCharacter,
  onSelectCharacter,
  onOpenBrowseModal,
  isLoading
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered characters
  const trimmed = query.trim().toLowerCase();
  const suggestions = trimmed
    ? characters.filter(c => {
        const name = String(c.Name || '').toLowerCase();
        const id = String(c.ID || '');
        const race = String(c.Race || '').toLowerCase();
        const afflatus = String(c.Afflatus || '').toLowerCase();
        if (name.includes(trimmed) || id === trimmed || race.includes(trimmed) || afflatus.includes(trimmed)) return true;
        if (c.LocaleName) {
          if (Object.values(c.LocaleName).some(
            val => typeof val === 'string' && val.toLowerCase().includes(trimmed)
          )) return true;
        }
        if (c['Other Name']) {
          if (typeof c['Other Name'] === 'string' && c['Other Name'].toLowerCase().includes(trimmed)) return true;
          if (Array.isArray(c['Other Name']) && c['Other Name'].some(n => String(n).toLowerCase().includes(trimmed))) return true;
        }
        // Match garment and series
        const matchGarment = Object.values(garmentsDb).some(
          g => (g.charId === c.ID || (g.charName && g.charName.toLowerCase() === name)) &&
            ((g.name && g.name.toLowerCase().includes(trimmed)) || (g.seriesName && g.seriesName.toLowerCase().includes(trimmed)))
        );
        return matchGarment;
      }).slice(0, 8)
    : [];

  const handleSelect = (char: CharacterItem) => {
    onSelectCharacter(char);
    setQuery(String(char.Name));
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter' && suggestions.length > 0) {
        handleSelect(suggestions[0]);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[activeIndex]) {
        handleSelect(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Search Input Bar */}
      <div ref={containerRef} className="relative w-full">
        <div className="relative flex items-center">
          <div className="absolute left-3.5 sm:left-4 text-zinc-400 pointer-events-none">
            <Search className="w-5 h-5 text-amber-500/70" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(0);
            }}
            onFocus={() => {
              if (query.trim()) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search by character, garment, series (e.g., UTTU, Carnival), or race..."
            className="w-full pl-11 sm:pl-12 pr-28 py-3.5 bg-[#141620] border-2 border-zinc-800 hover:border-zinc-700 focus:border-[#df6931] focus:outline-none rounded-xl text-white placeholder-zinc-500 shadow-lg text-sm sm:text-base transition-colors font-sans"
          />

          {query && (
            <button
              onClick={() => {
                setQuery('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="absolute right-14 p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onOpenBrowseModal}
            className="absolute right-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 border border-zinc-700 transition-colors"
            title="Browse all characters"
          >
            <Grid className="w-3.5 h-3.5 text-[#df6931]" />
            <span className="hidden sm:inline">All ({characters.length})</span>
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {isOpen && trimmed && (
          <div className="absolute left-0 right-0 mt-2 bg-[#171924] border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-zinc-800/80 animate-in fade-in-50 duration-150">
            {suggestions.length > 0 ? (
              suggestions.map((char, index) => {
                const isSelected = index === activeIndex;
                const affColor = AFFLATUS_COLORS[char.Afflatus] || { bg: 'bg-zinc-800', text: 'text-zinc-300', border: 'border-zinc-700' };
                const thumbUrl = `https://assets.merui.net/headicon_small/${String(char.ID).padStart(4, '0')}01.webp`;

                // Find matching garment if query matched garment or series
                const matchedSkin = Object.values(garmentsDb).find(
                  g => (g.charId === char.ID || (g.charName && g.charName.toLowerCase() === String(char.Name).toLowerCase())) &&
                    ((g.name && g.name.toLowerCase().includes(trimmed)) || (g.seriesName && g.seriesName.toLowerCase().includes(trimmed)))
                );

                return (
                  <div
                    key={char.ID}
                    onClick={() => handleSelect(char)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#222533]' : 'hover:bg-[#1e202c]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 border border-zinc-700 flex-shrink-0 flex items-center justify-center">
                        <img
                          src={thumbUrl}
                          alt={String(char.Name)}
                          className="w-full h-full object-cover"
                          onError={e => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm sm:text-base text-white">
                            {char.Name}
                          </span>
                          {char.LocaleName?.zh && (
                            <span className="text-xs text-zinc-400">
                              ({char.LocaleName.zh})
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <div className="flex items-center text-amber-400 text-xs">
                            {Array.from({ length: char.Rarity || 5 }).map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-amber-400" />
                            ))}
                          </div>
                          <span className="text-[11px] text-zinc-400">
                            • ID: {char.ID}
                          </span>
                          {matchedSkin && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Skin: {matchedSkin.name} {matchedSkin.seriesName ? `[${matchedSkin.seriesName}]` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {char.Race && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-cyan-300 border border-cyan-500/30 font-medium hidden sm:inline">
                          {char.Race}
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                        v{char.Version || '1.0'}
                      </span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${affColor.bg} ${affColor.text} ${affColor.border}`}>
                        {char.Afflatus}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-zinc-400 text-sm">
                No characters found matching &quot;{query}&quot;. Try clicking &quot;All&quot; to browse full roster!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Popular Character Quick Picks */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
        <span className="text-zinc-500 flex items-center gap-1 pl-1 pr-1 font-medium whitespace-nowrap">
          <Sparkles className="w-3.5 h-3.5 text-[#df6931]" />
          Popular:
        </span>
        {POPULAR_NAMES.map(name => {
          const char = characters.find(c => String(c.Name).toLowerCase() === name.toLowerCase());
          const isCurrent = selectedCharacter && String(selectedCharacter.Name).toLowerCase() === name.toLowerCase();

          return (
            <button
              key={name}
              onClick={() => {
                if (char) handleSelect(char);
                else {
                  setQuery(name);
                  setIsOpen(true);
                }
              }}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap border transition-all ${
                isCurrent
                  ? 'bg-[#df6931] border-[#df6931] text-white font-medium shadow-sm shadow-[#df6931]/30'
                  : 'bg-[#141620] border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
};
