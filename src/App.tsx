import React, { useState, useRef } from 'react';
import { DEVICE_PRESETS, getDefaultEncodingOptions } from './constants/presets';
import { DevicePreset, EncodingOptions, VideoMetadata, ConversionProgress, ConvertedOutput } from './types/converter';
import { VideoTranscoder } from './utils/transcoder';
import { generateRetroDemoVideo } from './utils/sampleVideo';
import { EncodingControls } from './components/EncodingControls';
import { TransferGuideModal } from './components/TransferGuideModal';
import { PreviewModal } from './components/PreviewModal';
import { RotateCw, Check, AlertCircle } from 'lucide-react';

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function parseTime(timeStr: string): number | null {
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.some((n) => isNaN(n) || n < 0)) return null;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return null;
}

function formatDurationHuman(seconds: number): string {
  const s = Math.round(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export default function App() {
  const [selectedPreset, setSelectedPreset] = useState<DevicePreset>(() => {
    const ipod = DEVICE_PRESETS.find((p) => p.id === 'apple-ipod-classic');
    return ipod || DEVICE_PRESETS[0];
  });
  const [encodingOptions, setEncodingOptions] = useState<EncodingOptions>(() =>
    getDefaultEncodingOptions(selectedPreset)
  );

  const [sourceVideo, setSourceVideo] = useState<VideoMetadata | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [latestOutput, setLatestOutput] = useState<ConvertedOutput | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Trimming inline edit states
  const [isEditingStart, setIsEditingStart] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState('00:00:00');
  const [isEditingEnd, setIsEditingEnd] = useState(false);
  const [endTimeInput, setEndTimeInput] = useState('00:00:00');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcoderRef = useRef<VideoTranscoder | null>(null);

  // Sync preset changes with encoding options
  const handleSelectPreset = (preset: DevicePreset) => {
    setSelectedPreset(preset);
    const newOptions = getDefaultEncodingOptions(preset);
    if (sourceVideo) {
      newOptions.startTime = encodingOptions.startTime;
      newOptions.endTime = encodingOptions.endTime;
    }
    setEncodingOptions(newOptions);
  };

  const handleResetToPresetDefaults = () => {
    const fresh = getDefaultEncodingOptions(selectedPreset);
    if (sourceVideo) {
      fresh.startTime = encodingOptions.startTime;
      fresh.endTime = encodingOptions.endTime;
    }
    setEncodingOptions(fresh);
  };

  // Extract thumbnail and metadata from a selected video file
  const processVideoFile = (file: File) => {
    setConversionError(null);
    setLatestOutput(null);
    setProgress(null);

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const dur = video.duration || 0;
      setSourceVideo({
        name: file.name,
        size: file.size,
        duration: dur,
        width: video.videoWidth || 640,
        height: video.videoHeight || 480,
        url,
        file,
        type: file.type,
      });

      setEncodingOptions((prev) => ({
        ...prev,
        startTime: 0,
        endTime: dur,
      }));
      setStartTimeInput('00:00:00');
      setEndTimeInput(formatTime(dur));

      // Seek to capture real thumbnail
      video.currentTime = Math.min(1.0, dur > 2 ? 1.0 : dur / 2);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(640, video.videoWidth || 640);
        canvas.height = Math.min(360, video.videoHeight || 360);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumbnailUrl(canvas.toDataURL('image/jpeg', 0.85));
        }
      } catch {
        setThumbnailUrl(null);
      }
    };

    video.onerror = () => {
      setConversionError('Could not load video metadata. The format may not be supported by your browser.');
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processVideoFile(file);
    }
  };

  // Sample demo clip generator
  const handleLoadDemo = async () => {
    try {
      setIsGeneratingDemo(true);
      setConversionError(null);
      const demoFile = await generateRetroDemoVideo();
      processVideoFile(demoFile);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate demo clip.';
      setConversionError(message);
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  // Save start time edit
  const handleSaveStartTime = () => {
    const parsed = parseTime(startTimeInput);
    if (parsed !== null && sourceVideo) {
      const clamped = Math.min(Math.max(0, parsed), sourceVideo.duration);
      setEncodingOptions((prev) => ({ ...prev, startTime: clamped }));
      setStartTimeInput(formatTime(clamped));
    } else {
      setStartTimeInput(formatTime(encodingOptions.startTime));
    }
    setIsEditingStart(false);
  };

  // Save end time edit
  const handleSaveEndTime = () => {
    const parsed = parseTime(endTimeInput);
    if (parsed !== null && sourceVideo) {
      const clamped = Math.min(Math.max(encodingOptions.startTime + 0.5, parsed), sourceVideo.duration);
      setEncodingOptions((prev) => ({ ...prev, endTime: clamped }));
      setEndTimeInput(formatTime(clamped));
    } else {
      setEndTimeInput(formatTime(encodingOptions.endTime || sourceVideo?.duration || 0));
    }
    setIsEditingEnd(false);
  };

  // Start transcoding
  const handleStartConversion = async () => {
    if (!sourceVideo) return;
    setConversionError(null);
    setIsConverting(true);
    setLatestOutput(null);

    const transcoder = new VideoTranscoder();
    transcoderRef.current = transcoder;

    try {
      const output = await transcoder.transcode(
        sourceVideo.url,
        sourceVideo.name,
        selectedPreset,
        encodingOptions,
        (p) => setProgress(p),
        sourceVideo.file
      );
      setLatestOutput(output);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Conversion failed.';
      if (message !== 'Conversion cancelled.' && message !== 'Conversion cancelled by user.') {
        setConversionError(message);
      }
    } finally {
      setIsConverting(false);
      transcoderRef.current = null;
    }
  };

  const handleCancelConversion = () => {
    if (transcoderRef.current) {
      transcoderRef.current.cancel();
      setIsConverting(false);
      setProgress(null);
    }
  };

  // Drag and drop support
  const [isDragging, setIsDragging] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processVideoFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#e4e4e4] dark:bg-[#121212] text-[#222222] dark:text-[#eeeeee] flex flex-col items-center justify-center px-4 py-8 sm:py-12 selection:bg-[#c0c0c0] dark:selection:bg-[#383838] transition-colors duration-200">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/*"
        className="hidden"
      />

      {/* Header matching image 1 & 2 */}
      <header className="text-center mb-6 sm:mb-8 select-none">
        <h1 className="text-4xl sm:text-[44px] font-light text-[#1f1f1f] dark:text-[#f2f2f2] tracking-tight transition-colors">
          Retroify
        </h1>
        <p className="text-base sm:text-lg font-light text-[#555555] dark:text-[#8e8e8e] mt-1.5 sm:mt-2 transition-colors">
          Convert your videos into formats playable on retro devices
        </p>
      </header>

      {/* Main Container Frame matching the screenshot's rounded border and silver canvas */}
      <main
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full max-w-5xl aspect-auto md:aspect-[16/9] min-h-[460px] md:min-h-[520px] bg-[#d9d9d9] dark:bg-[#1c1c1c] border-[3px] ${
          isDragging
            ? 'border-[#555] bg-[#d3d3d3] dark:border-[#777] dark:bg-[#252525]'
            : 'border-[#9c9c9c] dark:border-[#333333]'
        } rounded-[28px] sm:rounded-[36px] p-6 sm:p-12 flex flex-col justify-center items-center relative transition-all shadow-none`}
      >
        {/* ================= STATE 1: NO VIDEO UPLOADED ================= */}
        {!sourceVideo && (
          <div className="flex flex-col items-center justify-center text-center my-auto animate-in fade-in duration-300">
            {/* Upload Button matching mockup 1 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-3.5 px-9 py-3.5 bg-[#dfdfdf] dark:bg-[#262626] hover:bg-[#d6d6d6] dark:hover:bg-[#303030] active:bg-[#cecece] dark:active:bg-[#383838] border-2 border-[#969696] dark:border-[#424242] rounded-xl text-xl sm:text-2xl font-light text-[#2a2a2a] dark:text-[#ededed] cursor-pointer transition-colors shadow-none"
            >
              {/* Cloud upload icon */}
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#404040] dark:text-[#b8b8b8] fill-current transition-colors" viewBox="0 0 24 24">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
              </svg>
              <span>Upload</span>
            </button>

            {/* Subtext matching mockup 1 */}
            <div className="mt-4 space-y-0.5 text-sm sm:text-base font-light text-[#595959] dark:text-[#888888] transition-colors">
              <p>All processing is done in-browser.</p>
              <p>Nothing leaves your device.</p>
            </div>

            {/* Quick test sample video trigger */}
            <button
              onClick={handleLoadDemo}
              disabled={isGeneratingDemo}
              className="mt-6 text-xs font-light text-[#6e6e6e] dark:text-[#888888] hover:text-[#111] dark:hover:text-[#ffffff] underline underline-offset-4 cursor-pointer transition-colors"
            >
              {isGeneratingDemo ? 'Generating demo video...' : 'or try with a sample demo video'}
            </button>
          </div>
        )}

        {/* ================= STATE 2: VIDEO UPLOADED ================= */}
        {sourceVideo && (
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-14 items-start md:items-center my-auto animate-in fade-in duration-300">
            {/* Left Column: Video preview, title, duration, trimming */}
            <div className="flex flex-col items-start">
              {/* Thumbnail matching mockup 2 */}
              <div className="w-full max-w-[320px] aspect-video rounded-xl overflow-hidden bg-[#242424] border border-[#a0a0a0] dark:border-[#333333] shadow-xs relative transition-colors">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={sourceVideo.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-light text-[#888] dark:text-[#666]">
                    Video preview
                  </div>
                )}
              </div>

              {/* Video name & duration matching mockup 2 */}
              <div className="mt-3 text-sm sm:text-base font-light text-[#222] dark:text-[#f0f0f0] transition-colors">
                <span>{sourceVideo.name}</span>
                <span className="mx-1.5 text-[#777] dark:text-[#666]">|</span>
                <span>{formatDurationHuman(sourceVideo.duration)}</span>
              </div>

              {/* Change video link */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-0.5 text-xs font-light text-[#444] dark:text-[#999999] hover:text-[#111] dark:hover:text-[#ffffff] underline underline-offset-2 cursor-pointer transition-colors"
              >
                change video
              </button>

              {/* Trim controls matching mockup 2 */}
              <div className="mt-6 space-y-2 text-xs sm:text-sm font-light text-[#444] dark:text-[#aaaaaa] w-full max-w-[320px] transition-colors">
                <div>
                  <div className="text-[#666] dark:text-[#888888] text-xs">convert from:</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isEditingStart ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={startTimeInput}
                          onChange={(e) => setStartTimeInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveStartTime()}
                          className="w-24 px-1.5 py-0.5 bg-[#efefef] dark:bg-[#222222] border border-[#999] dark:border-[#444] rounded text-xs text-[#111] dark:text-[#f0f0f0] font-mono outline-none"
                          placeholder="00:00:00"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveStartTime}
                          className="p-1 text-[#222] dark:text-[#eee] hover:bg-[#cfcfcf] dark:hover:bg-[#333333] rounded cursor-pointer transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-normal text-[#222] dark:text-[#f0f0f0] font-mono">
                          {formatTime(encodingOptions.startTime)}
                        </span>
                        <button
                          onClick={() => {
                            setStartTimeInput(formatTime(encodingOptions.startTime));
                            setIsEditingStart(true);
                          }}
                          className="underline underline-offset-2 text-[#555] dark:text-[#999999] hover:text-[#111] dark:hover:text-[#ffffff] cursor-pointer transition-colors"
                        >
                          (edit)
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[#666] dark:text-[#888888] text-xs">to</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isEditingEnd ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={endTimeInput}
                          onChange={(e) => setEndTimeInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEndTime()}
                          className="w-24 px-1.5 py-0.5 bg-[#efefef] dark:bg-[#222222] border border-[#999] dark:border-[#444] rounded text-xs text-[#111] dark:text-[#f0f0f0] font-mono outline-none"
                          placeholder="00:00:00"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveEndTime}
                          className="p-1 text-[#222] dark:text-[#eee] hover:bg-[#cfcfcf] dark:hover:bg-[#333333] rounded cursor-pointer transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-normal text-[#222] dark:text-[#f0f0f0] font-mono">
                          {formatTime(encodingOptions.endTime || sourceVideo.duration)}
                        </span>
                        <button
                          onClick={() => {
                            setEndTimeInput(formatTime(encodingOptions.endTime || sourceVideo.duration));
                            setIsEditingEnd(true);
                          }}
                          className="underline underline-offset-2 text-[#555] dark:text-[#999999] hover:text-[#111] dark:hover:text-[#ffffff] cursor-pointer transition-colors"
                        >
                          (edit)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Device dropdown, advanced settings, convert button */}
            <div className="flex flex-col items-start justify-center">
              {/* If NOT converting and NO finished output */}
              {!isConverting && !latestOutput && (
                <div className="w-full max-w-sm">
                  {/* Pick a device header matching mockup 2 */}
                  <label className="block text-base sm:text-lg font-light text-[#222] dark:text-[#f0f0f0] mb-1.5 transition-colors">
                    pick a device:
                  </label>

                  {/* Device Dropdown matching user prompt "(put a dropdown here gemini)" */}
                  <div className="relative">
                    <select
                      value={selectedPreset.id}
                      onChange={(e) => {
                        const preset = DEVICE_PRESETS.find((p) => p.id === e.target.value);
                        if (preset) handleSelectPreset(preset);
                      }}
                      className="w-full bg-[#dfdfdf] dark:bg-[#262626] hover:bg-[#d8d8d8] dark:hover:bg-[#2c2c2c] border border-[#999999] dark:border-[#404040] rounded-lg px-3.5 py-2 text-sm sm:text-base font-light text-[#222] dark:text-[#ededed] cursor-pointer outline-none focus:border-[#555] dark:focus:border-[#666] transition-colors appearance-none pr-9"
                    >
                      {DEVICE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#e8e8e8] dark:bg-[#222222] text-[#222] dark:text-[#ededed]">
                          {p.name} ({p.screenWidth}×{p.screenHeight})
                        </option>
                      ))}
                    </select>
                    {/* Down arrow icon */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#555] dark:text-[#888] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Advanced settings toggle matching mockup 2 */}
                  <div className="mt-2">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-xs sm:text-sm font-light text-[#444] dark:text-[#999999] hover:text-[#111] dark:hover:text-[#ffffff] underline underline-offset-2 cursor-pointer transition-colors"
                    >
                      advanced settings
                    </button>
                  </div>

                  {/* Collapsible advanced settings */}
                  {showAdvanced && (
                    <EncodingControls
                      options={encodingOptions}
                      onChange={setEncodingOptions}
                      preset={selectedPreset}
                      onResetToPreset={handleResetToPresetDefaults}
                    />
                  )}

                  {/* Convert Button matching mockup 2 */}
                  <div className="mt-6 sm:mt-8">
                    <button
                      onClick={handleStartConversion}
                      className="inline-flex items-center gap-2.5 px-8 sm:px-10 py-2.5 sm:py-3 bg-[#dfdfdf] dark:bg-[#262626] hover:bg-[#d6d6d6] dark:hover:bg-[#303030] active:bg-[#cecece] dark:active:bg-[#383838] border-2 border-[#969696] dark:border-[#424242] rounded-xl text-lg sm:text-xl font-light text-[#2a2a2a] dark:text-[#ededed] cursor-pointer transition-colors shadow-none"
                    >
                      <RotateCw className="w-5 h-5 text-[#444] dark:text-[#b8b8b8] transition-colors" />
                      <span>Convert</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Conversion In Progress */}
              {isConverting && progress && (
                <div className="w-full max-w-sm space-y-4 animate-in fade-in duration-200">
                  <div>
                    <div className="text-base sm:text-lg font-light text-[#222] dark:text-[#f0f0f0] transition-colors">
                      Converting video...
                    </div>
                    <div className="text-xs font-light text-[#555] dark:text-[#8e8e8e] mt-0.5 transition-colors">
                      {progress.statusMessage || `Encoding for ${selectedPreset.name}`}
                    </div>
                  </div>

                  {/* Minimal progress bar */}
                  <div className="w-full h-2.5 bg-[#c8c8c8] dark:bg-[#282828] rounded-full overflow-hidden border border-[#a8a8a8] dark:border-[#383838] transition-colors">
                    <div
                      className="h-full bg-[#444] dark:bg-[#d4d4d4] transition-all duration-150"
                      style={{ width: `${Math.max(2, progress.percentage)}%` }}
                    />
                  </div>

                  {/* Progress stats */}
                  <div className="flex items-center justify-between text-xs font-light text-[#555] dark:text-[#8e8e8e] transition-colors">
                    <span>{progress.percentage}%</span>
                    <span>
                      {progress.currentFps > 0 ? `${progress.currentFps} FPS` : ''}
                      {progress.speedMultiplier > 0 ? ` · ${progress.speedMultiplier}x` : ''}
                    </span>
                    <span>
                      {progress.remainingSeconds > 0 ? `~${progress.remainingSeconds}s left` : ''}
                    </span>
                  </div>

                  <button
                    onClick={handleCancelConversion}
                    className="mt-2 text-xs font-light text-[#555] dark:text-[#999999] hover:text-[#111] dark:hover:text-[#ffffff] underline underline-offset-2 cursor-pointer transition-colors"
                  >
                    cancel conversion
                  </button>
                </div>
              )}

              {/* Error Message */}
              {conversionError && (
                <div className="w-full max-w-sm p-3.5 rounded-xl border border-rose-400 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/25 text-xs font-light text-rose-800 dark:text-rose-300 flex items-start gap-2.5 mt-4 transition-colors">
                  <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-normal">Conversion error</div>
                    <div>{conversionError}</div>
                  </div>
                </div>
              )}

              {/* Conversion Complete Result */}
              {latestOutput && (
                <div className="w-full max-w-sm space-y-4 animate-in fade-in duration-200">
                  <div>
                    <div className="text-xl sm:text-2xl font-light text-[#1f1f1f] dark:text-[#f0f0f0] transition-colors">
                      Ready for {selectedPreset.name}!
                    </div>
                    <div className="text-xs sm:text-sm font-light text-[#555] dark:text-[#8e8e8e] mt-1 transition-colors">
                      {latestOutput.filename} · {latestOutput.width}×{latestOutput.height} ·{' '}
                      {(latestOutput.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                    </div>
                  </div>

                  {/* Download Button matching style */}
                  <div>
                    <a
                      href={latestOutput.url}
                      download={latestOutput.filename}
                      className="inline-flex items-center gap-2 px-8 py-2.5 bg-[#dfdfdf] dark:bg-[#262626] hover:bg-[#d6d6d6] dark:hover:bg-[#303030] active:bg-[#cecece] dark:active:bg-[#383838] border-2 border-[#969696] dark:border-[#424242] rounded-xl text-base sm:text-lg font-light text-[#222] dark:text-[#ededed] cursor-pointer transition-colors shadow-none text-center"
                    >
                      <svg className="w-5 h-5 text-[#444] dark:text-[#b8b8b8] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download {latestOutput.filename.endsWith('.3gp') ? '3GP' : 'MP4'}</span>
                    </a>
                  </div>

                  {/* Actions: Preview & Transfer Guide */}
                  <div className="pt-2 flex flex-col items-start gap-1.5 text-xs sm:text-sm font-light text-[#444] dark:text-[#999999] transition-colors">
                    <button
                      onClick={() => setIsPreviewOpen(true)}
                      className="underline underline-offset-2 hover:text-[#111] dark:hover:text-[#ffffff] cursor-pointer transition-colors"
                    >
                      preview converted video
                    </button>
                    <button
                      onClick={() => setIsGuideOpen(true)}
                      className="underline underline-offset-2 hover:text-[#111] dark:hover:text-[#ffffff] cursor-pointer transition-colors"
                    >
                      how to transfer to {selectedPreset.brand} {selectedPreset.model}
                    </button>
                    <button
                      onClick={() => {
                        setLatestOutput(null);
                        setProgress(null);
                      }}
                      className="underline underline-offset-2 hover:text-[#111] dark:hover:text-[#ffffff] cursor-pointer text-[#666] dark:text-[#888888] transition-colors"
                    >
                      convert again with different settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Transfer Guide Modal */}
      <TransferGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        currentPreset={selectedPreset}
      />

      {/* Video Preview Modal */}
      {latestOutput && (
        <PreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          videoUrl={latestOutput.url}
          filename={latestOutput.filename}
          presetName={selectedPreset.name}
        />
      )}
    </div>
  );
}
