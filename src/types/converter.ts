/**
 * Type definitions for RetroVid / Retroify Converter
 */

export type DeviceCategory = 'walkman' | 'nokia' | 'ipod' | 'psp' | 'nintendo' | 'custom';

export type ScalingMode = 'fit' | 'fill' | 'stretch';

export type RetroFilterMode = 'none' | 'lcd-grid' | 'scanlines' | 'dither-16bit' | 'sepia-lcd';

export type AvcProfile = 'baseline-1.3' | 'baseline-2.1' | 'baseline-3.0' | 'main-3.0';

export interface DevicePreset {
  id: string;
  name: string;
  category: DeviceCategory;
  brand: string;
  model: string;
  year: number;
  tagline: string;
  description: string;
  screenWidth: number;
  screenHeight: number;
  aspectRatioLabel: string;
  orientation: 'landscape' | 'portrait';
  defaultFps: number;
  supportedFps: number[];
  defaultVideoBitrate: number; // in kbps
  supportedVideoBitrates: number[]; // in kbps
  defaultAudioBitrate: number; // in kbps
  audioSampleRate: number; // in Hz
  audioChannels: 1 | 2;
  avcProfile: AvcProfile;
  container: 'mp4' | '3gp';
  usbFolder: string;
  filenamePattern: string;
  transferGuide: {
    connectionMethod: string;
    targetPath: string;
    supportedFormats: string[];
    specialNotes: string[];
  };
  chassisColorDefault: string;
}

export type PerformanceEngine = 'turbo' | 'standard';
export type AudioTranscodeMode = 'passthrough' | 'transcode';

export interface SubtitleCue {
  start: number; // in seconds
  end: number; // in seconds
  text: string;
}

export interface VideoMetadataTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  coverImage?: Blob | Uint8Array | null;
  coverImageUrl?: string;
}

export interface EncodingOptions {
  width: number;
  height: number;
  fps: number;
  videoBitrate: number; // in kbps
  audioBitrate: number; // in kbps
  audioSampleRate: number; // in Hz
  audioChannels: 1 | 2;
  audioBoost: 0 | 3 | 6; // dB boost for quiet vintage phone speakers
  scalingMode: ScalingMode;
  retroFilter: RetroFilterMode;
  container: 'mp4' | '3gp';
  avcProfile: AvcProfile;
  outputFilename: string;
  // Performance & Trimming for long videos
  startTime: number; // in seconds
  endTime: number; // in seconds (0 = full video)
  engineMode: PerformanceEngine;
  audioMode: AudioTranscodeMode;
  smartCadenceSkip: boolean; // skip non-cadence source frames
  hardwareAcceleration: 'prefer-hardware' | 'prefer-software';
  // Subtitles & Metadata
  subtitles?: SubtitleCue[];
  subtitleFileName?: string;
  tags?: VideoMetadataTags;
}

export interface VideoMetadata {
  id: string;
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  url: string;
  file?: File;
  type: string;
  thumbnailUrl?: string;
  subtitles?: SubtitleCue[];
  subtitleFileName?: string;
  tags?: VideoMetadataTags;
  preset?: DevicePreset;
  encodingOptions?: EncodingOptions;
  status?: 'idle' | 'converting' | 'done' | 'error';
  output?: ConvertedOutput;
  error?: string;
}

export interface ConversionProgress {
  currentFrame: number;
  totalFrames: number;
  percentage: number;
  currentFps: number;
  speedMultiplier: number; // e.g. 15.2x realtime speed
  elapsedSeconds: number;
  remainingSeconds: number;
  estimatedSizeBytes: number;
  status:
    | 'idle'
    | 'preparing'
    | 'demuxing'
    | 'extracting-audio'
    | 'encoding-video'
    | 'muxing'
    | 'completed'
    | 'error'
    | 'cancelled';
  statusMessage: string;
  engineName: string;
  batchIndex?: number;
  batchTotal?: number;
}

export interface ConvertedOutput {
  blob: Blob;
  url: string;
  filename: string;
  sizeBytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  preset: DevicePreset;
  encodingOptions: EncodingOptions;
  createdAt: Date;
}
