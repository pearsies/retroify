/**
 * High-Speed MP4 Demuxer using MP4Box
 * Fast metadata probe with early-break and direct sample index access.
 * Reads samples on-demand without buffering entire long videos into RAM.
 */

import {
  createFile,
  DataStream,
  type MP4File,
  type MP4Info,
  type MP4SampleInfo,
} from 'mp4box';

export interface DemuxedVideoTrack {
  id: number;
  codec: string;
  width: number;
  height: number;
  duration: number;
  timescale: number;
  nbSamples: number;
  description?: Uint8Array;
}

export interface DemuxedAudioTrack {
  id: number;
  codec: string;
  sampleRate: number;
  channels: number;
  duration: number;
  timescale: number;
  isAAC: boolean;
}

export interface MP4ProbeResult {
  info: MP4Info;
  videoTrack: DemuxedVideoTrack | null;
  audioTrack: DemuxedAudioTrack | null;
  videoSamples: MP4SampleInfo[];
  audioSamples: MP4SampleInfo[];
}

export class FastMP4Demuxer {
  private mp4box: MP4File;
  private isCancelled = false;

  constructor() {
    this.mp4box = createFile();
  }

  public cancel() {
    this.isCancelled = true;
    try {
      this.mp4box.stop();
    } catch {
      // Ignore
    }
  }

  /**
   * Parses the MP4 file header using streaming chunks.
   * Breaks immediately as soon as moov atom / onReady is detected.
   */
  public async probe(
    file: File | Blob,
    onProbeProgress?: (pct: number) => void
  ): Promise<MP4ProbeResult> {
    return new Promise(async (resolve, reject) => {
      let isReady = false;
      let finalResult: MP4ProbeResult | null = null;

      this.mp4box.onError = (err) => {
        if (!isReady) {
          reject(new Error(`MP4Box demux error: ${err}`));
        }
      };

      this.mp4box.onReady = (info: MP4Info) => {
        isReady = true;

        let videoTrack: DemuxedVideoTrack | null = null;
        let audioTrack: DemuxedAudioTrack | null = null;

        if (info.videoTracks && info.videoTracks.length > 0) {
          const vt = info.videoTracks[0];
          const description = this.extractTrackDescription(vt.id);
          videoTrack = {
            id: vt.id,
            codec: vt.codec,
            width: vt.video?.width || vt.track_width || 640,
            height: vt.video?.height || vt.track_height || 480,
            duration: vt.duration / vt.timescale,
            timescale: vt.timescale,
            nbSamples:
              (vt as unknown as { nb_samples?: number }).nb_samples ||
              Math.floor((vt.duration / vt.timescale) * 30),
            description,
          };
        }

        if (info.audioTracks && info.audioTracks.length > 0) {
          const at = info.audioTracks[0];
          audioTrack = {
            id: at.id,
            codec: at.codec,
            sampleRate: at.audio?.sample_rate || 44100,
            channels: at.audio?.channel_count || 2,
            duration: at.duration / at.timescale,
            timescale: at.timescale,
            isAAC: at.codec.toLowerCase().startsWith('mp4a'),
          };
        }

        let videoSamples: MP4SampleInfo[] = [];
        let audioSamples: MP4SampleInfo[] = [];

        try {
          if (videoTrack) {
            videoSamples = this.mp4box.getTrackSamplesInfo(videoTrack.id) || [];
          }
        } catch {
          videoSamples = [];
        }

        try {
          if (audioTrack) {
            audioSamples = this.mp4box.getTrackSamplesInfo(audioTrack.id) || [];
          }
        } catch {
          audioSamples = [];
        }

        finalResult = { info, videoTrack, audioTrack, videoSamples, audioSamples };
        if (onProbeProgress) onProbeProgress(100);
        resolve(finalResult);
      };

      const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
      let offset = 0;
      const totalSize = file.size;

      try {
        while (offset < totalSize) {
          if (this.isCancelled) {
            reject(new Error('Demuxing cancelled'));
            return;
          }

          if (isReady) {
            // Header is already parsed and samples indexed, break immediately!
            break;
          }

          const end = Math.min(offset + CHUNK_SIZE, totalSize);
          const slice = file.slice(offset, end);
          const buffer = (await slice.arrayBuffer()) as ArrayBuffer & { fileStart?: number };
          buffer.fileStart = offset;

          const nextOffset = this.mp4box.appendBuffer(buffer);

          if (isReady) {
            break;
          }

          offset = nextOffset > 0 && nextOffset > offset ? nextOffset : end;

          if (onProbeProgress) {
            onProbeProgress(Math.min(99, Math.round((offset / totalSize) * 100)));
          }

          // Yield to event loop
          await new Promise((r) => setTimeout(r, 0));
        }

        if (!isReady) {
          this.mp4box.flush();
          // Give mp4box a brief chance to fire onReady after flush
          await new Promise((r) => setTimeout(r, 50));
        }

        if (!isReady || !finalResult) {
          reject(
            new Error(
              'Could not locate MP4 sample index (moov atom). Switching to universal playback engine.'
            )
          );
        }
      } catch (err) {
        if (!isReady) {
          reject(err);
        }
      }
    });
  }

  /**
   * Extracts SPS/PPS avcC description box for VideoDecoder
   */
  private extractTrackDescription(trackId: number): Uint8Array | undefined {
    try {
      const trak = this.mp4box.getTrackById(trackId) as unknown as {
        mdia?: {
          minf?: {
            stbl?: {
              stsd?: {
                entries?: Array<{
                  avcC?: { write: (s: unknown) => void };
                  hvcC?: { write: (s: unknown) => void };
                  vpcC?: { write: (s: unknown) => void };
                  av1C?: { write: (s: unknown) => void };
                }>;
              };
            };
          };
        };
      };

      const entries = trak?.mdia?.minf?.stbl?.stsd?.entries;
      if (!entries || entries.length === 0) return undefined;

      const entry = entries[0];
      const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
      if (box && typeof box.write === 'function') {
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN ?? true);
        box.write(stream);
        // The avcC box starts after the 8-byte box header [size (4 bytes) + type (4 bytes)]
        return new Uint8Array(stream.buffer, 8);
      }
    } catch {
      // Fallback
    }
    return undefined;
  }

  /**
   * Read raw data for a single sample from the underlying File
   */
  public async readSampleData(
    file: File | Blob,
    sample: MP4SampleInfo
  ): Promise<Uint8Array> {
    const slice = file.slice(sample.offset, sample.offset + sample.size);
    const buf = await slice.arrayBuffer();
    return new Uint8Array(buf);
  }

  /**
   * Read a batch of samples together in a single slice for maximum I/O throughput
   */
  public async readSamplesBatch(
    file: File | Blob,
    samples: MP4SampleInfo[]
  ): Promise<Uint8Array[]> {
    if (samples.length === 0) return [];
    if (samples.length === 1) {
      const data = await this.readSampleData(file, samples[0]);
      return [data];
    }

    const start = samples[0].offset;
    const last = samples[samples.length - 1];
    const end = last.offset + last.size;

    // If batch span is reasonable (< 8MB), slice in one contiguous buffer
    if (end > start && end - start < 8 * 1024 * 1024) {
      const slice = file.slice(start, end);
      const buf = await slice.arrayBuffer();
      // Slice into independent buffers to prevent retaining the 8MB slice in memory
      return samples.map((s) =>
        new Uint8Array(buf.slice(s.offset - start, s.offset - start + s.size))
      );
    }

    // Otherwise read individually in parallel
    return Promise.all(samples.map((s) => this.readSampleData(file, s)));
  }
}
