import React from 'react';
import { ExternalLink, Sparkles, HelpCircle, Scissors, Layers, Archive } from 'lucide-react';

interface HeaderProps {
  onOpenHelp: () => void;
  onOpenBatchModal: () => void;
  batchCount?: number;
  selectedCharName?: string;
  profileUrl?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHelp,
  onOpenBatchModal,
  batchCount = 0,
  selectedCharName,
  profileUrl,
}) => {
  return (
    <header className="border-b border-amber-900/30 bg-[#0d0f15]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#df6931] to-[#993414] p-0.5 shadow-lg shadow-[#df6931]/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#12141c] rounded-[10px] flex items-center justify-center">
              <Scissors className="w-5 h-5 text-[#df6931]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-lg sm:text-xl tracking-wider text-white">
                UTTU <span className="text-[#df6931]">CROPPER</span>
              </h1>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#df6931]/15 text-[#df6931] border border-[#df6931]/30">
                6:9 FULL
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Reverse: 1999 Character Portrait & Full-Body Studio
            </p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Batch Export Button */}
          <button
            onClick={onOpenBatchModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-amber-600 to-[#df6931] hover:from-amber-500 hover:to-[#e87b46] shadow-sm shadow-[#df6931]/20 transition-all active:scale-[0.98]"
            title="Batch export multiple character portraits"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Bulk Export</span>
            {batchCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-black/40 text-[10px] flex items-center justify-center font-bold">
                {batchCount}
              </span>
            )}
          </button>

          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-200/90 bg-amber-950/40 border border-amber-700/40 hover:bg-amber-900/50 hover:text-white transition-colors"
              title="Open profile on UTTU Merui"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#df6931]" />
              <span className="hidden md:inline">Profile</span>
              <span>UTTU</span>
            </a>
          )}

          <a
            href="https://uttu.merui.net/profiles/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800 transition-colors"
          >
            <span>uttu.merui.net</span>
          </a>

          <button
            onClick={onOpenHelp}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
            title="User Guide & Features"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
