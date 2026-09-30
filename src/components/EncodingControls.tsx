import React from 'react';
import { EncodingOptions, DevicePreset, ScalingMode } from '../types/converter';
import { COMMON_RESOLUTIONS } from '../constants/presets';

interface EncodingControlsProps {
  options: EncodingOptions;
  onChange: (options: EncodingOptions) => void;
  preset: DevicePreset;
  onResetToPreset: () => void;
}

export const EncodingControls: React.FC<EncodingControlsProps> = ({
  options,
  onChange,
  preset,
  onResetToPreset,
}) => {
  const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [w, h] = e.target.value.split('x').map(Number);
    if (!isNaN(w) && !isNaN(h)) {
      onChange({ ...options, width: w, height: h });
    }
  };

  return (
    <div className="mt-4 p-4 rounded-xl border border-[#a3a3a3] dark:border-[#363636] bg-[#d5d5d5] dark:bg-[#222222] text-xs font-light text-[#333] dark:text-[#cccccc] space-y-3.5 animate-in fade-in duration-200 transition-colors">
      <div className="flex items-center justify-between border-b border-[#bababa] dark:border-[#333333] pb-2 transition-colors">
        <span className="text-sm font-normal text-[#222] dark:text-[#f0f0f0]">Advanced Settings</span>
        <button
          onClick={onResetToPreset}
          className="text-[11px] font-light text-[#555] dark:text-[#999999] hover:text-[#111] dark:hover:text-[#ffffff] underline cursor-pointer transition-colors"
        >
          reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Resolution */}
        <div className="col-span-2">
          <label className="block text-[11px] text-[#555] dark:text-[#888888] mb-1">resolution</label>
          <select
            value={`${options.width}x${options.height}`}
            onChange={handleResolutionChange}
            className="w-full bg-[#e3e3e3] dark:bg-[#1a1a1a] border border-[#a0a0a0] dark:border-[#3a3a3a] rounded-lg px-2.5 py-1.5 text-xs text-[#222] dark:text-[#ededed] font-light cursor-pointer outline-none focus:border-[#666] transition-colors"
          >
            {COMMON_RESOLUTIONS.map((r) => (
              <option key={`${r.width}x${r.height}`} value={`${r.width}x${r.height}`}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Framerate */}
        <div>
          <label className="block text-[11px] text-[#555] dark:text-[#888888] mb-1">framerate</label>
          <select
            value={options.fps}
            onChange={(e) => onChange({ ...options, fps: Number(e.target.value) })}
            className="w-full bg-[#e3e3e3] dark:bg-[#1a1a1a] border border-[#a0a0a0] dark:border-[#3a3a3a] rounded-lg px-2.5 py-1.5 text-xs text-[#222] dark:text-[#ededed] font-light cursor-pointer outline-none focus:border-[#666] transition-colors"
          >
            {[15, 20, 24, 25, 30].map((fps) => (
              <option key={fps} value={fps}>
                {fps} FPS {fps === preset.defaultFps ? '(recommended)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Video Bitrate */}
        <div>
          <label className="block text-[11px] text-[#555] dark:text-[#888888] mb-1">video bitrate</label>
          <select
            value={options.videoBitrate}
            onChange={(e) => onChange({ ...options, videoBitrate: Number(e.target.value) })}
            className="w-full bg-[#e3e3e3] dark:bg-[#1a1a1a] border border-[#a0a0a0] dark:border-[#3a3a3a] rounded-lg px-2.5 py-1.5 text-xs text-[#222] dark:text-[#ededed] font-light cursor-pointer outline-none focus:border-[#666] transition-colors"
          >
            {[192, 256, 384, 512, 640, 768, 1000, 1500].map((br) => (
              <option key={br} value={br}>
                {br} kbps {br === preset.defaultVideoBitrate ? '(default)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Audio Bitrate */}
        <div>
          <label className="block text-[11px] text-[#555] dark:text-[#888888] mb-1">audio bitrate</label>
          <select
            value={options.audioBitrate}
            onChange={(e) => onChange({ ...options, audioBitrate: Number(e.target.value) })}
            className="w-full bg-[#e3e3e3] dark:bg-[#1a1a1a] border border-[#a0a0a0] dark:border-[#3a3a3a] rounded-lg px-2.5 py-1.5 text-xs text-[#222] dark:text-[#ededed] font-light cursor-pointer outline-none focus:border-[#666] transition-colors"
          >
            {[64, 96, 128, 160, 192].map((abr) => (
              <option key={abr} value={abr}>
                {abr} kbps {abr === preset.defaultAudioBitrate ? '(default)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Aspect Scaling */}
        <div>
          <label className="block text-[11px] text-[#555] dark:text-[#888888] mb-1">aspect ratio fit</label>
          <select
            value={options.scalingMode}
            onChange={(e) => onChange({ ...options, scalingMode: e.target.value as ScalingMode })}
            className="w-full bg-[#e3e3e3] dark:bg-[#1a1a1a] border border-[#a0a0a0] dark:border-[#3a3a3a] rounded-lg px-2.5 py-1.5 text-xs text-[#222] dark:text-[#ededed] font-light cursor-pointer outline-none focus:border-[#666] transition-colors"
          >
            <option value="fit">Fit / Letterbox (Preserve Ratio)</option>
            <option value="fill">Fill / Crop to Screen</option>
            <option value="stretch">Stretch to Screen</option>
          </select>
        </div>

        {/* Audio Boost */}
        <div className="col-span-2">
          <label className="block text-[11px] text-[#555] dark:text-[#888888] mb-1">audio boost</label>
          <div className="flex gap-2">
            {([0, 3, 6] as const).map((boost) => (
              <button
                key={boost}
                type="button"
                onClick={() => onChange({ ...options, audioBoost: boost })}
                className={`flex-1 py-1 px-2 rounded border text-xs cursor-pointer transition-colors ${
                  options.audioBoost === boost
                    ? 'bg-[#dfdfdf] dark:bg-[#2e2e2e] border-[#777] dark:border-[#555] text-[#111] dark:text-[#f0f0f0] font-normal'
                    : 'bg-[#e7e7e7] dark:bg-[#1a1a1a] border-[#b0b0b0] dark:border-[#333333] text-[#555] dark:text-[#888888] hover:bg-[#dedede] dark:hover:bg-[#242424]'
                }`}
              >
                {boost === 0 ? 'Original (0 dB)' : `+${boost} dB (Louder)`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
