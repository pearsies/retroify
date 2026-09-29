import React from 'react';
import { X } from 'lucide-react';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  filename: string;
  presetName: string;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  filename,
  presetName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border-2 border-[#9c9c9c] bg-[#e0e0e0] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#b5b5b5] bg-[#d8d8d8]">
          <div>
            <h3 className="text-lg font-light text-[#1f1f1f]">{filename}</h3>
            <p className="text-xs font-light text-[#555]">Previewing formatted stream ({presetName})</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#555] hover:text-[#111] rounded-lg hover:bg-[#cfcfcf] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="p-6 flex items-center justify-center bg-[#222]">
          <video
            src={videoUrl}
            controls
            autoPlay
            className="max-h-[60vh] max-w-full rounded-lg shadow-md border border-[#444]"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#b5b5b5] bg-[#d8d8d8] flex justify-between items-center text-xs font-light text-[#555]">
          <span>Optimized ISO MP4 with fast-start moov header</span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-sm font-light text-[#222] bg-[#dfdfdf] hover:bg-[#d4d4d4] border border-[#999] rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
