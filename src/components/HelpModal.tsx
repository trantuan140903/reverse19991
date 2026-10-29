import React from 'react';
import { X, CheckCircle2, Scissors, Download, ShieldCheck, Sparkles, Smartphone, Film, Archive } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#11131c] border border-amber-900/40 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#df6931]/15 text-[#df6931] border border-[#df6931]/30">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                User Guide & Studio Features
              </h2>
              <p className="text-xs text-zinc-400">
                Automated 6:9 full-body cropper, version-matched posters & bulk export studio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-zinc-300">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              1
            </div>
            <div>
              <h4 className="font-semibold text-white">Search or Browse Characters</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Type character names in the search box (Sonetto, Regulus, 37, Tooth Fairy, Lucy...) or click &quot;Browse All&quot; to pick visually from the complete Reverse: 1999 roster.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              2
            </div>
            <div>
              <h4 className="font-semibold text-white">Version-Matched Poster Backgrounds</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                The studio automatically matches official release posters and event CGs according to character or outfit versions (v1.0 to v2.2+). You can freely adjust <strong>poster opacity (from 0% fully transparent to 100%)</strong>, blur, and darken contrast.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              3
            </div>
            <div>
              <h4 className="font-semibold text-white">Clean Watermark & Metallic Typography</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                All exported artwork is clean with third-party watermarks removed. Choose between Art Deco Gold, Silver & Gold Specular chromatic gradient, Cinematic Subtitle, or Gilded Manuscript typography.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              4
            </div>
            <div>
              <h4 className="font-semibold text-white">Bulk Export Studio (Batch ZIP)</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Click <span className="text-[#df6931] font-semibold">&quot;Bulk Export&quot;</span> to select all characters or filter and select specific characters, queue both Live2D and Illustration assets, and download high-res ZIP packages optimized to never crash or run out of memory even with 300+ images.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#df6931] hover:bg-[#c95722] text-white text-xs font-semibold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
