declare module 'mp4box' {
  export interface MP4MediaTrack {
    id: number;
    created: Date;
    modified: Date;
    movie_duration: number;
    layer: number;
    alternate_group: number;
    volume: number;
    track_width: number;
    track_height: number;
    timescale: number;
    duration: number;
    bitrate: number;
    codec: string;
    video?: {
      width: number;
      height: number;
    };
    audio?: {
      channel_count: number;
      sample_rate: number;
      sample_size: number;
    };
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    isFragmented: boolean;
    isProgressive: boolean;
    hasIOD: boolean;
    brands: string[];
    created: Date;
    modified: Date;
    tracks: MP4MediaTrack[];
    videoTracks: MP4MediaTrack[];
    audioTracks: MP4MediaTrack[];
  }

  export interface MP4Sample {
    number: number;
    track_id: number;
    description: unknown;
    is_rap: boolean;
    is_sync: boolean;
    timescale: number;
    dts: number;
    cts: number;
    duration: number;
    size: number;
    data: Uint8Array;
  }

  export interface MP4SampleInfo {
    number: number;
    track_id: number;
    timescale: number;
    size: number;
    offset: number;
    dts: number;
    cts: number;
    duration: number;
    is_sync: boolean;
    description: unknown;
  }

  export interface MP4File {
    onReady?: (info: MP4Info) => void;
    onError?: (e: string) => void;
    onSamples?: (id: number, user: unknown, samples: MP4Sample[]) => void;
    appendBuffer(data: ArrayBuffer & { fileStart?: number }): number;
    flush(): void;
    setExtractionOptions(id: number, user?: unknown, options?: { nbSamples?: number; rapAlignment?: boolean }): void;
    start(): void;
    stop(): void;
    getTrackById(id: number): unknown;
    getTrackSamplesInfo(id: number): MP4SampleInfo[];
  }

  export function createFile(): MP4File;

  export class DataStream {
    buffer: ArrayBuffer;
    static readonly BIG_ENDIAN: boolean;
    constructor(buffer?: ArrayBuffer, byteOffset?: number, endianness?: boolean);
  }
}
