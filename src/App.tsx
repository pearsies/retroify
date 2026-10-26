import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { DEVICE_PRESETS, getDefaultEncodingOptions } from './constants/presets';
import {
  DevicePreset,
  EncodingOptions,
  VideoMetadata,
  ConversionProgress,
  ConvertedOutput,
  SubtitleCue,
  VideoMetadataTags,
} from './types/converter';
import { VideoTranscoder } from './utils/transcoder';
import { generateRetroDemoVideo } from './utils/sampleVideo';
import { parseSubtitles } from './utils/subtitles';
import { EncodingControls } from './components/EncodingControls';
import { TransferGuideModal } from './components/TransferGuideModal';
import { PreviewModal } from './components/PreviewModal';
import { TimelineScrubber } from './components/TimelineScrubber';
import { MetadataEditor } from './components/MetadataEditor';
import {
  RotateCw,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  FileText,
  Download,
  Archive,
  Music,
  SlidersHorizontal,
} from 'lucide-react';

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

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export default function App() {
  const [selectedPreset, setSelectedPreset] = useState<DevicePreset>(() => {
    const ipod = DEVICE_PRESETS.find((p) => p.id === 'apple-ipod-classic');
    return ipod || DEVICE_PRESETS[0];
  });
  const [encodingOptions, setEncodingOptions] = useState<EncodingOptions>(() =>
    getDefaultEncodingOptions(selectedPreset)
  );

  // Multi-file batch queue
  const [videoQueue, setVideoQueue] = useState<VideoMetadata[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // UI accordion toggles
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  // Conversion & Progress states
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    currentIndex: number;
    totalCount: number;
    overallPercent: number;
  }>({ currentIndex: 0, totalCount: 0, overallPercent: 0 });
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [completedOutputs, setCompletedOutputs] = useState<ConvertedOutput[]>([]);

  // Modals
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [previewOutput, setPreviewOutput] = useState<ConvertedOutput | null>(null);

  // Trimming inline text edit states
  const [isEditingStart, setIsEditingStart] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState('00:00:00');
  const [isEditingEnd, setIsEditingEnd] = useState(false);
  const [endTimeInput, setEndTimeInput] = useState('00:00:00');

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const transcoderRef = useRef<VideoTranscoder | null>(null);

  const activeVideo = videoQueue.find((v) => v.id === activeVideoId) || videoQueue[0] || null;

  // Extract thumbnail and metadata from a selected video file
  const processSingleFile = (file: File): Promise<VideoMetadata> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = url;
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const item: VideoMetadata = {
        id: generateId(),
        name: file.name,
        size: file.size,
        duration: 0,
        width: 640,
        height: 480,
        url,
        file,
        type: file.type,
        thumbnailUrl: '',
        status: 'idle',
        encodingOptions: {
          ...getDefaultEncodingOptions(selectedPreset),
          startTime: 0,
          endTime: 0,
        },
      };

      video.onloadedmetadata = () => {
        const dur = video.duration || 0;
        item.duration = dur;
        item.width = video.videoWidth || 640;
        item.height = video.videoHeight || 480;
        if (item.encodingOptions) {
          item.encodingOptions.endTime = dur;
        }
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
            item.thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);
          }
        } catch {
          // ignore canvas read issue
        }
        resolve(item);
      };

      video.onerror = () => {
        resolve(item);
      };
    });
  };

  const handleFilesAdded = async (files: FileList | File[]) => {
    setConversionError(null);
    setCompletedOutputs([]);
    const fileArray = Array.from(files).filter(
      (f) => f.type.startsWith('video/') || f.name.match(/\.(mp4|m4v|mov|mkv|webm|avi|3gp)$/i)
    );
    if (fileArray.length === 0) return;

    const newItems: VideoMetadata[] = [];
    for (const f of fileArray) {
      const meta = await processSingleFile(f);
      newItems.push(meta);
    }

    setVideoQueue((prev) => {
      const merged = [...prev, ...newItems];
      if (!activeVideoId && merged.length > 0) {
        setActiveVideoId(merged[0].id);
      }
      return merged;
    });

    if (!activeVideoId && newItems.length > 0) {
      setActiveVideoId(newItems[0].id);
      setStartTimeInput('00:00:00');
      setEndTimeInput(formatTime(newItems[0].duration));
    }
  };

  // Sync selected video settings when switching active video in queue
  useEffect(() => {
    if (activeVideo) {
      const opts = activeVideo.encodingOptions || getDefaultEncodingOptions(selectedPreset);
      setEncodingOptions(opts);
      setStartTimeInput(formatTime(opts.startTime));
      setEndTimeInput(formatTime(opts.endTime || activeVideo.duration));
    }
  }, [activeVideoId]);

  // Sync preset changes
  const handleSelectPreset = (preset: DevicePreset) => {
    setSelectedPreset(preset);
    const newOptions = getDefaultEncodingOptions(preset);

    setVideoQueue((prev) =>
      prev.map((v) => ({
        ...v,
        preset,
        encodingOptions: {
          ...getDefaultEncodingOptions(preset),
          startTime: v.encodingOptions?.startTime || 0,
          endTime: v.encodingOptions?.endTime || v.duration,
          subtitles: v.subtitles,
          subtitleFileName: v.subtitleFileName,
          tags: v.tags,
        },
      }))
    );

    if (activeVideo) {
      newOptions.startTime = encodingOptions.startTime;
      newOptions.endTime = encodingOptions.endTime;
      newOptions.subtitles = activeVideo.subtitles;
      newOptions.subtitleFileName = activeVideo.subtitleFileName;
      newOptions.tags = activeVideo.tags;
    }
    setEncodingOptions(newOptions);
  };

  const handleResetToPresetDefaults = () => {
    const fresh = getDefaultEncodingOptions(selectedPreset);
    if (activeVideo) {
      fresh.startTime = encodingOptions.startTime;
      fresh.endTime = encodingOptions.endTime;
      fresh.subtitles = activeVideo.subtitles;
      fresh.subtitleFileName = activeVideo.subtitleFileName;
      fresh.tags = activeVideo.tags;
    }
    setEncodingOptions(fresh);
    if (activeVideoId) {
      setVideoQueue((prev) =>
        prev.map((v) => (v.id === activeVideoId ? { ...v, encodingOptions: fresh } : v))
      );
    }
  };

  // Timeline scrubber change
  const handleScrubberChange = (start: number, end: number) => {
    setEncodingOptions((prev) => ({ ...prev, startTime: start, endTime: end }));
    setStartTimeInput(formatTime(start));
    setEndTimeInput(formatTime(end));

    if (activeVideoId) {
      setVideoQueue((prev) =>
        prev.map((v) =>
          v.id === activeVideoId
            ? {
                ...v,
                encodingOptions: {
                  ...(v.encodingOptions || getDefaultEncodingOptions(selectedPreset)),
                  startTime: start,
                  endTime: end,
                },
              }
            : v
        )
      );
    }
  };

  // Seek video thumbnail on scrub
  const handleScrubberSeek = (time: number) => {
    if (!previewVideoRef.current && activeVideo?.url) {
      const v = document.createElement('video');
      v.src = activeVideo.url;
      v.muted = true;
      v.playsInline = true;
      previewVideoRef.current = v;
    }
    const v = previewVideoRef.current;
    if (v && v.src) {
      v.currentTime = time;
      v.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(640, v.videoWidth || 640);
          canvas.height = Math.min(360, v.videoHeight || 360);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setVideoQueue((prev) =>
              prev.map((item) =>
                item.id === activeVideoId ? { ...item, thumbnailUrl: dataUrl } : item
              )
            );
          }
        } catch {
          // ignore seek render
        }
      };
    }
  };

  // Subtitle upload handler
  const handleSubtitleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeVideoId) return;

    try {
      const text = await file.text();
      const cues = parseSubtitles(text);

      setEncodingOptions((prev) => ({
        ...prev,
        subtitles: cues,
        subtitleFileName: file.name,
      }));

      setVideoQueue((prev) =>
        prev.map((v) =>
          v.id === activeVideoId
            ? {
                ...v,
                subtitles: cues,
                subtitleFileName: file.name,
                encodingOptions: {
                  ...(v.encodingOptions || getDefaultEncodingOptions(selectedPreset)),
                  subtitles: cues,
                  subtitleFileName: file.name,
                },
              }
            : v
        )
      );
    } catch (err) {
      console.warn('Subtitle parse error:', err);
    }
  };

  const handleRemoveSubtitles = () => {
    setEncodingOptions((prev) => ({
      ...prev,
      subtitles: undefined,
      subtitleFileName: undefined,
    }));
    if (activeVideoId) {
      setVideoQueue((prev) =>
        prev.map((v) =>
          v.id === activeVideoId
            ? {
                ...v,
                subtitles: undefined,
                subtitleFileName: undefined,
                encodingOptions: {
                  ...(v.encodingOptions || getDefaultEncodingOptions(selectedPreset)),
                  subtitles: undefined,
                  subtitleFileName: undefined,
                },
              }
            : v
        )
      );
    }
    if (subtitleInputRef.current) subtitleInputRef.current.value = '';
  };

  // Metadata tags handler
  const handleTagsChange = (tags: VideoMetadataTags) => {
    setEncodingOptions((prev) => ({ ...prev, tags }));
    if (activeVideoId) {
      setVideoQueue((prev) =>
        prev.map((v) =>
          v.id === activeVideoId
            ? {
                ...v,
                tags,
                encodingOptions: {
                  ...(v.encodingOptions || getDefaultEncodingOptions(selectedPreset)),
                  tags,
                },
              }
            : v
        )
      );
    }
  };

  // Sample demo video generator
  const handleLoadDemo = async () => {
    try {
      setIsGeneratingDemo(true);
      setConversionError(null);
      const demoFile = await generateRetroDemoVideo();
      await handleFilesAdded([demoFile]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate demo clip.';
      setConversionError(message);
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  // Manual timestamp editing
  const handleSaveStartTime = () => {
    const parsed = parseTime(startTimeInput);
    if (parsed !== null && activeVideo) {
      const clamped = Math.min(Math.max(0, parsed), activeVideo.duration);
      handleScrubberChange(clamped, encodingOptions.endTime || activeVideo.duration);
    } else {
      setStartTimeInput(formatTime(encodingOptions.startTime));
    }
    setIsEditingStart(false);
  };

  const handleSaveEndTime = () => {
    const parsed = parseTime(endTimeInput);
    if (parsed !== null && activeVideo) {
      const clamped = Math.min(
        Math.max(encodingOptions.startTime + 0.5, parsed),
        activeVideo.duration
      );
      handleScrubberChange(encodingOptions.startTime, clamped);
    } else {
      setEndTimeInput(formatTime(encodingOptions.endTime || activeVideo?.duration || 0));
    }
    setIsEditingEnd(false);
  };

  // Remove single video from queue
  const handleRemoveFromQueue = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setVideoQueue((prev) => {
      const filtered = prev.filter((v) => v.id !== id);
      if (activeVideoId === id) {
        setActiveVideoId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  // Start conversion (supports both single item and entire batch queue)
  const handleStartConversion = async () => {
    if (videoQueue.length === 0) return;
    setConversionError(null);
    setIsConverting(true);
    setCompletedOutputs([]);

    const outputs: ConvertedOutput[] = [];
    const totalCount = videoQueue.length;

    try {
      for (let i = 0; i < videoQueue.length; i++) {
        const item = videoQueue[i];
        const itemOptions = item.encodingOptions || encodingOptions;
        const itemPreset = item.preset || selectedPreset;

        setActiveVideoId(item.id);
        setBatchProgress({
          currentIndex: i + 1,
          totalCount,
          overallPercent: Math.round((i / totalCount) * 100),
        });

        const transcoder = new VideoTranscoder();
        transcoderRef.current = transcoder;

        const output = await transcoder.transcode(
          item.url,
          item.name,
          itemPreset,
          itemOptions,
          (p) => {
            setProgress({
              ...p,
              batchIndex: i + 1,
              batchTotal: totalCount,
            });
            const subPercent = (p.percentage / 100) * (1 / totalCount);
            setBatchProgress({
              currentIndex: i + 1,
              totalCount,
              overallPercent: Math.round(((i / totalCount) + subPercent) * 100),
            });
          },
          item.file
        );

        outputs.push(output);
        setCompletedOutputs([...outputs]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Conversion failed.';
      if (message !== 'Conversion cancelled.' && message !== 'Conversion cancelled by user.') {
        setConversionError(message);
      }
    } finally {
      setIsConverting(false);
      setProgress(null);
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

  // Download all converted videos as a ZIP file
  const handleDownloadAllZip = async () => {
    if (completedOutputs.length === 0) return;
    const zip = new JSZip();

    for (const item of completedOutputs) {
      zip.file(item.filename, item.blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retroify_${selectedPreset.category}_batch.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  return (
    <div className="min-h-screen bg-[#e4e4e4] dark:bg-[#121212] text-[#222222] dark:text-[#eeeeee] flex flex-col items-center justify-center px-4 py-8 sm:py-12 selection:bg-[#c0c0c0] dark:selection:bg-[#383838] transition-colors duration-200">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
        accept="video/*,.mkv,.webm"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={addMoreInputRef}
        onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
        accept="video/*,.mkv,.webm"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={subtitleInputRef}
        onChange={handleSubtitleUpload}
        accept=".srt,.vtt,text/plain"
        className="hidden"
      />

      {/* Header matching exact mockups */}
      <header className="text-center mb-6 sm:mb-8 select-none">
        <h1 className="text-4xl sm:text-[44px] font-light text-[#1f1f1f] dark:text-[#f2f2f2] tracking-tight transition-colors">
          Retroify
        </h1>
        <p className="text-base sm:text-lg font-light text-[#555555] dark:text-[#8e8e8e] mt-1.5 sm:mt-2 transition-colors">
          Convert your videos into formats playable on retro devices
        </p>
      </header>

      {/* Main Container Frame */}
      <main
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full max-w-5xl aspect-auto min-h-[480px] bg-[#d9d9d9] dark:bg-[#1c1c1c] border-[3px] ${
          isDragging
            ? 'border-[#555] bg-[#d3d3d3] dark:border-[#777] dark:bg-[#252525]'
            : 'border-[#9c9c9c] dark:border-[#333333]'
        } rounded-[28px] sm:rounded-[36px] p-6 sm:p-10 flex flex-col justify-between relative transition-all shadow-none`}
      >
        {/* ================= STATE 1: NO VIDEOS IN QUEUE ================= */}
        {videoQueue.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center my-auto py-12 animate-in fade-in duration-300">
            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-3.5 px-9 py-3.5 bg-[#dfdfdf] dark:bg-[#262626] hover:bg-[#d6d6d6] dark:hover:bg-[#303030] active:bg-[#cecece] dark:active:bg-[#383838] border-2 border-[#969696] dark:border-[#424242] rounded-xl text-xl sm:text-2xl font-light text-[#2a2a2a] dark:text-[#ededed] cursor-pointer transition-colors shadow-none"
            >
              <svg
                className="w-7 h-7 sm:w-8 sm:h-8 text-[#404040] dark:text-[#b8b8b8] fill-current transition-colors"
                viewBox="0 0 24 24"
              >
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
              </svg>
              <span>Upload</span>
            </button>

            <div className="mt-4 space-y-0.5 text-sm sm:text-base font-light text-[#595959] dark:text-[#888888] transition-colors">
              <p>All processing is done in-browser.</p>
              <p>Nothing leaves your device.</p>
            </div>

            <button
              onClick={handleLoadDemo}
              disabled={isGeneratingDemo}
              className="mt-6 text-xs font-light text-[#6e6e6e] dark:text-[#888888] hover:text-[#111] dark:hover:text-[#ffffff] underline underline-offset-4 cursor-pointer transition-colors"
            >
              {isGeneratingDemo ? 'Generating demo video...' : 'or try with a sample demo video'}
            </button>
          </div>
        )}

        {/* ================= STATE 2: VIDEOS IN QUEUE ================= */}
        {videoQueue.length > 0 && activeVideo && (
          <div className="w-full flex flex-col gap-6 my-auto animate-in fade-in duration-300">
            {/* Top Multi-File Queue Strip (shown when files loaded) */}
            <div className="w-full flex items-center justify-between border-b border-[#bababa] dark:border-[#2e2e2e] pb-3 overflow-x-auto text-xs font-light">
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                <span className="text-[#666] dark:text-[#888] font-normal whitespace-nowrap">
                  Queue ({videoQueue.length}):
                </span>
                {videoQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveVideoId(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
                      item.id === activeVideoId
                        ? 'bg-[#dfdfdf] dark:bg-[#2c2c2c] text-[#111] dark:text-[#f0f0f0] border border-[#888] dark:border-[#555]'
                        : 'bg-[#cecece]/60 dark:bg-[#1a1a1a] text-[#555] dark:text-[#888] hover:bg-[#d6d6d6] dark:hover:bg-[#252525]'
                    }`}
                  >
                    <span className="font-mono text-[11px] text-[#777]">{idx + 1}.</span>
                    <span className="max-w-[130px] truncate">{item.name}</span>
                    {videoQueue.length > 1 && !isConverting && (
                      <button
                        onClick={(e) => handleRemoveFromQueue(item.id, e)}
                        className="text-[#888] hover:text-rose-500 ml-0.5 p-0.5 rounded cursor-pointer"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isConverting && (
                <button
                  onClick={() => addMoreInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#333] dark:text-[#ccc] hover:text-[#000] dark:hover:text-[#fff] bg-[#dfdfdf] dark:bg-[#262626] border border-[#999] dark:border-[#444] rounded-lg transition-colors cursor-pointer shrink-0 ml-3"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>add videos</span>
                </button>
              )}
            </div>

            {/* Main Two-Column Layout */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-14 items-start">
              {/* Left Column: Video thumbnail, interactive timeline scrubber, subtitles & trim controls */}
              <div className="flex flex-col items-start w-full">
                {/* Thumbnail */}
                <div className="w-full max-w-[320px] aspect-video rounded-xl overflow-hidden bg-[#242424] border border-[#a0a0a0] dark:border-[#333333] shadow-xs relative transition-colors">
                  {activeVideo.thumbnailUrl ? (
                    <img
                      src={activeVideo.thumbnailUrl}
                      alt={activeVideo.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-light text-[#888]">
                      Video preview
                    </div>
                  )}
                </div>

                {/* Visual Timeline Scrubber */}
                <div className="w-full max-w-[320px] mt-2.5">
                  <TimelineScrubber
                    duration={activeVideo.duration}
                    startTime={encodingOptions.startTime}
                    endTime={encodingOptions.endTime || activeVideo.duration}
                    onChange={handleScrubberChange}
                    onSeek={handleScrubberSeek}
                  />
                </div>

                {/* Video Name & Duration */}
                <div className="mt-1 text-sm sm:text-base font-light text-[#222] dark:text-[#f0f0f0] transition-colors">
                  <span className="font-normal">{activeVideo.name}</span>
                  <span className="mx-1.5 text-[#777] dark:text-[#666]">|</span>
                  <span>{formatDurationHuman(activeVideo.duration)}</span>
                </div>

                {/* Action Links: Change video + Subtitle attach */}
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-light">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[#444] dark:text-[#999999] hover:text-[#111] dark:hover:text-[#ffffff] underline underline-offset-2 cursor-pointer transition-colors"
                  >
                    change video
                  </button>

                  <span className="text-[#888] dark:text-[#555]">·</span>

                  {/* Subtitles Button / Status */}
                  {activeVideo.subtitles && activeVideo.subtitles.length > 0 ? (
                    <div className="inline-flex items-center gap-1.5 text-[#222] dark:text-[#eee]">
                      <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="truncate max-w-[140px]" title={activeVideo.subtitleFileName}>
                        {activeVideo.subtitleFileName} ({activeVideo.subtitles.length} cues)
                      </span>
                      <button
                        onClick={handleRemoveSubtitles}
                        className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer ml-0.5"
                      >
                        (remove)
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => subtitleInputRef.current?.click()}
                      className="text-[#444] dark:text-[#999999] hover:text-[#111] dark:hover:text-[#ffffff] underline underline-offset-2 cursor-pointer transition-colors"
                    >
                      add subtitles (.srt / .vtt)
                    </button>
                  )}
                </div>

                {/* Trim numerical controls with (edit) */}
                <div className="mt-4 space-y-2 text-xs sm:text-sm font-light text-[#444] dark:text-[#aaaaaa] w-full max-w-[320px] transition-colors">
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
                            {formatTime(encodingOptions.endTime || activeVideo.duration)}
                          </span>
                          <button
                            onClick={() => {
                              setEndTimeInput(
                                formatTime(encodingOptions.endTime || activeVideo.duration)
                              );
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

              {/* Right Column: Device selection, advanced settings, metadata & convert action */}
              <div className="flex flex-col items-start justify-center w-full">
                {/* When NOT converting and NO completed batch */}
                {!isConverting && completedOutputs.length === 0 && (
                  <div className="w-full max-w-sm">
                    <label className="block text-base sm:text-lg font-light text-[#222] dark:text-[#f0f0f0] mb-1.5 transition-colors">
                      pick a device:
                    </label>

                    {/* Device Dropdown */}
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
                          <option
                            key={p.id}
                            value={p.id}
                            className="bg-[#e8e8e8] dark:bg-[#222222] text-[#222] dark:text-[#ededed]"
                          >
                            {p.name} ({p.screenWidth}×{p.screenHeight})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#555] dark:text-[#888] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Toggles: Advanced Settings & Metadata Editor */}
                    <div className="mt-2.5 flex items-center gap-4 text-xs sm:text-sm font-light">
                      <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-[#444] dark:text-[#999999] hover:text-[#111] dark:hover:text-[#ffffff] underline underline-offset-2 cursor-pointer transition-colors"
                      >
                        {showAdvanced ? 'hide settings' : 'advanced settings'}
                      </button>

                      <span className="text-[#888] dark:text-[#555]">·</span>

                      <button
                        onClick={() => setShowMetadata(!showMetadata)}
                        className="text-[#444] dark:text-[#999999] hover:text-[#111] dark:hover:text-[#ffffff] underline underline-offset-2 cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <Music className="w-3 h-3 text-[#666] dark:text-[#888]" />
                        <span>{showMetadata ? 'hide track info' : 'track info & artwork'}</span>
                      </button>
                    </div>

                    {/* Collapsible Advanced Settings */}
                    {showAdvanced && (
                      <EncodingControls
                        options={encodingOptions}
                        onChange={setEncodingOptions}
                        preset={selectedPreset}
                        onResetToPreset={handleResetToPresetDefaults}
                      />
                    )}

                    {/* Collapsible Metadata & Artwork Editor */}
                    {showMetadata && (
                      <MetadataEditor
                        tags={activeVideo.tags}
                        onChange={handleTagsChange}
                        defaultTitle={activeVideo.name.replace(/\.[^/.]+$/, '')}
                      />
                    )}

                    {/* Convert Button (Adapts to Single or Multi-File Queue) */}
                    <div className="mt-6 sm:mt-8">
                      <button
                        onClick={handleStartConversion}
                        className="inline-flex items-center gap-2.5 px-8 sm:px-10 py-2.5 sm:py-3 bg-[#dfdfdf] dark:bg-[#262626] hover:bg-[#d6d6d6] dark:hover:bg-[#303030] active:bg-[#cecece] dark:active:bg-[#383838] border-2 border-[#969696] dark:border-[#424242] rounded-xl text-lg sm:text-xl font-light text-[#2a2a2a] dark:text-[#ededed] cursor-pointer transition-colors shadow-none"
                      >
                        <RotateCw className="w-5 h-5 text-[#444] dark:text-[#b8b8b8] transition-colors" />
                        <span>
                          {videoQueue.length > 1
                            ? `Convert All (${videoQueue.length} files)`
                            : 'Convert'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* In-Flight Conversion Progress */}
                {isConverting && progress && (
                  <div className="w-full max-w-sm space-y-4 animate-in fade-in duration-200">
                    <div>
                      <div className="text-base sm:text-lg font-light text-[#222] dark:text-[#f0f0f0] transition-colors">
                        {videoQueue.length > 1
                          ? `Converting ${batchProgress.currentIndex} of ${batchProgress.totalCount}: ${activeVideo.name}`
                          : 'Converting video...'}
                      </div>
                      <div className="text-xs font-light text-[#555] dark:text-[#8e8e8e] mt-0.5 transition-colors">
                        {progress.statusMessage || `Encoding for ${selectedPreset.name}`}
                      </div>
                    </div>

                    {/* Multi-item overall progress (if batch) */}
                    {videoQueue.length > 1 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-[#666] dark:text-[#888]">
                          <span>Batch Queue Progress</span>
                          <span>{batchProgress.overallPercent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#c8c8c8] dark:bg-[#282828] rounded-full overflow-hidden border border-[#a8a8a8] dark:border-[#383838]">
                          <div
                            className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-150"
                            style={{ width: `${Math.max(2, batchProgress.overallPercent)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Current item progress bar */}
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

                {/* Conversion Error */}
                {conversionError && (
                  <div className="w-full max-w-sm p-3.5 rounded-xl border border-rose-400 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/25 text-xs font-light text-rose-800 dark:text-rose-300 flex items-start gap-2.5 mt-4 transition-colors">
                    <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-normal">Conversion error</div>
                      <div>{conversionError}</div>
                    </div>
                  </div>
                )}

                {/* Completed Results State */}
                {completedOutputs.length > 0 && !isConverting && (
                  <div className="w-full max-w-sm space-y-4 animate-in fade-in duration-200">
                    <div>
                      <div className="text-xl sm:text-2xl font-light text-[#1f1f1f] dark:text-[#f0f0f0] transition-colors">
                        Ready for {selectedPreset.name}!
                      </div>
                      <div className="text-xs sm:text-sm font-light text-[#555] dark:text-[#8e8e8e] mt-1 transition-colors">
                        {completedOutputs.length === 1
                          ? `${completedOutputs[0].filename} · ${(
                              completedOutputs[0].sizeBytes /
                              (1024 * 1024)
                            ).toFixed(1)} MB`
                          : `${completedOutputs.length} files successfully converted.`}
                      </div>
                    </div>

                    {/* Single File Download Action */}
                    {completedOutputs.length === 1 && (
                      <div>
                        <a
                          href={completedOutputs[0].url}
                          download={completedOutputs[0].filename}
                          className="inline-flex items-center gap-2 px-8 py-2.5 bg-[#dfdfdf] dark:bg-[#262626] hover:bg-[#d6d6d6] dark:hover:bg-[#303030] active:bg-[#cecece] dark:active:bg-[#383838] border-2 border-[#969696] dark:border-[#424242] rounded-xl text-base sm:text-lg font-light text-[#222] dark:text-[#ededed] cursor-pointer transition-colors shadow-none text-center"
                        >
                          <Download className="w-5 h-5 text-[#444] dark:text-[#b8b8b8] transition-colors" />
                          <span>
                            Download{' '}
                            {completedOutputs[0].filename.endsWith('.3gp') ? '3GP' : 'MP4'}
                          </span>
                        </a>
                      </div>
                    )}

                    {/* Multi-File Download List & ZIP Action */}
                    {completedOutputs.length > 1 && (
                      <div className="space-y-2.5">
                        <button
                          onClick={handleDownloadAllZip}
                          className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#dfdfdf] dark:bg-[#262626] hover:bg-[#d6d6d6] dark:hover:bg-[#303030] border-2 border-[#969696] dark:border-[#424242] rounded-xl text-base font-light text-[#222] dark:text-[#ededed] cursor-pointer transition-colors shadow-none"
                        >
                          <Archive className="w-4 h-4 text-[#444] dark:text-[#b8b8b8]" />
                          <span>Download All ({completedOutputs.length} files as ZIP)</span>
                        </button>

                        <div className="max-h-40 overflow-y-auto space-y-1.5 p-2.5 bg-[#cecece]/40 dark:bg-[#161616] rounded-xl border border-[#b0b0b0] dark:border-[#333] text-xs">
                          {completedOutputs.map((out, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 py-1 px-1.5 border-b border-[#bababa]/50 dark:border-[#282828] last:border-none"
                            >
                              <span className="truncate max-w-[180px] font-mono text-[11px]">
                                {out.filename}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[#666] dark:text-[#888] text-[10px]">
                                  {(out.sizeBytes / (1024 * 1024)).toFixed(1)}MB
                                </span>
                                <a
                                  href={out.url}
                                  download={out.filename}
                                  className="text-[11px] underline text-[#333] dark:text-[#ccc] hover:text-[#000] dark:hover:text-[#fff]"
                                >
                                  save
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Extra Links: Preview & Device Guide */}
                    <div className="pt-2 flex flex-col items-start gap-1.5 text-xs sm:text-sm font-light text-[#444] dark:text-[#999999] transition-colors">
                      <button
                        onClick={() => setPreviewOutput(completedOutputs[0])}
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
                          setCompletedOutputs([]);
                          setProgress(null);
                        }}
                        className="underline underline-offset-2 hover:text-[#111] dark:hover:text-[#ffffff] cursor-pointer text-[#666] dark:text-[#888888] transition-colors"
                      >
                        convert again or change queue
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
      {previewOutput && (
        <PreviewModal
          isOpen={Boolean(previewOutput)}
          onClose={() => setPreviewOutput(null)}
          videoUrl={previewOutput.url}
          filename={previewOutput.filename}
          presetName={selectedPreset.name}
        />
      )}
    </div>
  );
}
