import React, { useState } from 'react';
import { DevicePreset } from '../types/converter';
import { DEVICE_PRESETS } from '../constants/presets';
import { X, Copy, Check } from 'lucide-react';

interface TransferGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPreset: DevicePreset;
}

export const TransferGuideModal: React.FC<TransferGuideModalProps> = ({
  isOpen,
  onClose,
  currentPreset,
}) => {
  const [selectedId, setSelectedId] = useState<string>(currentPreset.id);
  const [copiedPath, setCopiedPath] = useState(false);

  if (!isOpen) return null;

  const preset = DEVICE_PRESETS.find((p) => p.id === selectedId) || currentPreset;
  const guide = preset.transferGuide;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(guide.targetPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border-2 border-[#9c9c9c] bg-[#e0e0e0] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#b5b5b5] bg-[#d8d8d8]">
          <div>
            <h3 className="text-xl font-light text-[#1f1f1f]">How to transfer to your device</h3>
            <p className="text-xs font-light text-[#555] mt-0.5">
              Copying converted files to retro media storage
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#555] hover:text-[#111] rounded-lg hover:bg-[#cfcfcf] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Device selection pills */}
        <div className="flex gap-2 px-6 py-2.5 border-b border-[#b5b5b5] bg-[#d4d4d4] overflow-x-auto text-xs">
          {DEVICE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`px-3 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                p.id === preset.id
                  ? 'bg-[#efefef] text-[#111] border border-[#888]'
                  : 'text-[#444] hover:bg-[#dedede]'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm font-light text-[#333]">
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-[#666] mb-1">
              1. Connection
            </h4>
            <p className="leading-relaxed">{guide.connectionMethod}</p>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-[#666] mb-1">
              2. Target Directory
            </h4>
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#efefef] border border-[#b5b5b5] font-mono text-xs text-[#222]">
              <span>{guide.targetPath}</span>
              <button
                onClick={handleCopyPath}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-light bg-[#dfdfdf] hover:bg-[#d4d4d4] border border-[#a0a0a0] rounded cursor-pointer transition-colors text-[#222]"
              >
                {copiedPath ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedPath ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-[#666] mb-1">
              3. Device Notes
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-[#444] leading-relaxed">
              {guide.specialNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#b5b5b5] bg-[#d8d8d8] flex justify-end">
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
