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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border-2 border-[#9c9c9c] dark:border-[#383838] bg-[#e0e0e0] dark:bg-[#1a1a1a] shadow-xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#b5b5b5] dark:border-[#2c2c2c] bg-[#d8d8d8] dark:bg-[#222222] transition-colors">
          <div>
            <h3 className="text-xl font-light text-[#1f1f1f] dark:text-[#f0f0f0]">How to transfer to your device</h3>
            <p className="text-xs font-light text-[#555] dark:text-[#888888] mt-0.5">
              Copying converted files to retro media storage
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#555] dark:text-[#888888] hover:text-[#111] dark:hover:text-[#ffffff] rounded-lg hover:bg-[#cfcfcf] dark:hover:bg-[#2c2c2c] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Device selection pills */}
        <div className="flex gap-2 px-6 py-2.5 border-b border-[#b5b5b5] dark:border-[#2c2c2c] bg-[#d4d4d4] dark:bg-[#161616] overflow-x-auto text-xs transition-colors">
          {DEVICE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`px-3 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                p.id === preset.id
                  ? 'bg-[#efefef] dark:bg-[#2e2e2e] text-[#111] dark:text-[#f0f0f0] border border-[#888] dark:border-[#555]'
                  : 'text-[#444] dark:text-[#888888] hover:bg-[#dedede] dark:hover:bg-[#222222] hover:text-[#111] dark:hover:text-[#ffffff]'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm font-light text-[#333] dark:text-[#cccccc] transition-colors">
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-[#666] dark:text-[#888888] mb-1">
              1. Connection
            </h4>
            <p className="leading-relaxed">{guide.connectionMethod}</p>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-[#666] dark:text-[#888888] mb-1">
              2. Target Directory
            </h4>
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#efefef] dark:bg-[#121212] border border-[#b5b5b5] dark:border-[#2e2e2e] font-mono text-xs text-[#222] dark:text-[#ededed] transition-colors">
              <span className="truncate">{guide.targetPath}</span>
              <button
                onClick={handleCopyPath}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-light bg-[#dfdfdf] dark:bg-[#262626] hover:bg-[#d4d4d4] dark:hover:bg-[#303030] border border-[#a0a0a0] dark:border-[#404040] rounded cursor-pointer transition-colors text-[#222] dark:text-[#ededed]"
              >
                {copiedPath ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedPath ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-[#666] dark:text-[#888888] mb-1">
              3. Device Notes
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-[#444] dark:text-[#aaaaaa] leading-relaxed">
              {guide.specialNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#b5b5b5] dark:border-[#2c2c2c] bg-[#d8d8d8] dark:bg-[#222222] flex justify-end transition-colors">
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-sm font-light text-[#222] dark:text-[#ededed] bg-[#dfdfdf] dark:bg-[#262626] hover:bg-[#d4d4d4] dark:hover:bg-[#303030] border border-[#999] dark:border-[#444] rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
