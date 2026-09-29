/**
 * Generates an instant retro tech demo video in-browser
 * Features an authentic 2000s wireframe grid, bouncing Walkman/Nokia silhouette,
 * audio visualizer bars, and synthesized chiptune/synth chords.
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export async function generateRetroDemoVideo(
  onProgress?: (progress: number) => void
): Promise<File> {
  const width = 640;
  const height = 480;
  const fps = 30;
  const durationSec = 6;
  const totalFrames = fps * durationSec;
  const sampleRate = 44100;

  // 1. Synthesize audio buffer
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
    sampleRate,
  });
  
  const audioBuffer = audioCtx.createBuffer(2, sampleRate * durationSec, sampleRate);
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);

  // Classic 2000s synthwave chord progression (Am - F - C - G)
  const chordNotes = [
    [220, 261.63, 329.63], // A minor
    [174.61, 220, 261.63], // F major
    [261.63, 329.63, 392], // C major
    [196, 246.94, 293.66], // G major
  ];

  for (let i = 0; i < audioBuffer.length; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.floor((t / 1.5) % 4);
    const chord = chordNotes[chordIndex];

    // Arpeggio & bass
    const arpNote = chord[Math.floor((t * 8) % 3)];
    const bassNote = chord[0] / 2;

    const synth = (Math.sin(2 * Math.PI * arpNote * t) * 0.15) +
                  ((t * 8 % 1 < 0.5 ? 1 : -1) * 0.05); // square overtone
    const bass = Math.sin(2 * Math.PI * bassNote * t) * 0.2;
    // Drum click every 0.5s
    const beatPhase = (t % 0.5);
    const kick = beatPhase < 0.05 ? Math.sin(2 * Math.PI * (120 - beatPhase * 1800) * beatPhase) * 0.3 : 0;

    const sample = Math.max(-0.9, Math.min(0.9, (synth + bass + kick) * 0.7));
    left[i] = sample;
    right[i] = sample;
  }

  // 2. Prepare canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // 3. Check if VideoEncoder is supported
  const hasWebCodecs = typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';

  if (hasWebCodecs) {
    try {
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width,
          height,
        },
        firstTimestampBehavior: 'offset',
        fastStart: 'in-memory',
      });

      let videoEncoderError: Error | null = null;
      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          videoEncoderError = e;
        },
      });

      videoEncoder.configure({
        codec: 'avc1.42001e',
        width,
        height,
        bitrate: 1500000,
        framerate: fps,
        avc: { format: 'avc' },
      });

      for (let frame = 0; frame < totalFrames; frame++) {
        if (videoEncoderError) throw videoEncoderError;
        renderDemoFrame(ctx, width, height, frame, totalFrames);

        const timestampUs = Math.round((frame / fps) * 1_000_000);
        const videoFrame = new VideoFrame(canvas, { timestamp: timestampUs });
        const keyFrame = frame % (fps * 2) === 0;
        videoEncoder.encode(videoFrame, { keyFrame });
        videoFrame.close();

        if (frame % 15 === 0 && onProgress) {
          onProgress(Math.round((frame / totalFrames) * 90));
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      await videoEncoder.flush();
      muxer.finalize();

      const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
      return new File([blob], 'retro_demo_sample.mp4', { type: 'video/mp4' });
    } catch {
      // Fallback to MediaRecorder below if VideoEncoder failed
    }
  }

  // Fallback: Real-time canvas stream via MediaRecorder
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(fps);
    const audioDest = audioCtx.createMediaStreamDestination();
    const sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(audioDest);
    sourceNode.connect(audioCtx.destination);

    const combinedTracks = [...stream.getVideoTracks(), ...audioDest.stream.getAudioTracks()];
    const combinedStream = new MediaStream(combinedTracks);

    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const recorder = new MediaRecorder(combinedStream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      audioCtx.close();
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([new Blob(chunks, { type: mimeType })], `retro_demo_sample.${ext}`, {
        type: mimeType,
      });
      resolve(file);
    };

    recorder.start();
    sourceNode.start(0);

    let frame = 0;
    const interval = setInterval(() => {
      renderDemoFrame(ctx, width, height, frame, totalFrames);
      frame++;
      if (onProgress) {
        onProgress(Math.round((frame / totalFrames) * 100));
      }
      if (frame >= totalFrames) {
        clearInterval(interval);
        recorder.stop();
        sourceNode.stop();
      }
    }, 1000 / fps);

    recorder.onerror = (err) => {
      clearInterval(interval);
      reject(err);
    };
  });
}

function renderDemoFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  totalFrames: number
) {
  const t = frame / 30;

  // Background deep retro dark indigo
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#090714');
  grad.addColorStop(0.5, '#1e1136');
  grad.addColorStop(1, '#05020c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Glowing Retro Sun
  const sunY = height * 0.45;
  const sunRadius = 70;
  const sunGrad = ctx.createLinearGradient(width / 2, sunY - sunRadius, width / 2, sunY + sunRadius);
  sunGrad.addColorStop(0, '#ffdf00');
  sunGrad.addColorStop(0.6, '#ff0077');
  sunGrad.addColorStop(1, '#7700ff');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(width / 2, sunY, sunRadius, 0, Math.PI * 2);
  ctx.fill();

  // Horizontal blind stripes through sun
  ctx.fillStyle = '#090714';
  for (let s = 0; s < 6; s++) {
    const stripeY = sunY + 10 + s * 10;
    const stripeH = 2 + s * 1.2;
    ctx.fillRect(width / 2 - sunRadius, stripeY, sunRadius * 2, stripeH);
  }

  // Perspective 3D grid
  const horizon = height * 0.55;
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 1.5;

  // Vanishing lines
  for (let x = -width; x <= width * 2; x += 60) {
    ctx.beginPath();
    ctx.moveTo(width / 2, horizon);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Moving horizontal grid lines
  const speed = (t * 80) % 35;
  for (let y = horizon; y < height; y += 30) {
    const curY = horizon + Math.pow((y - horizon) / (height - horizon), 1.6) * (height - horizon) + speed;
    if (curY < height) {
      ctx.beginPath();
      ctx.moveTo(0, curY);
      ctx.lineTo(width, curY);
      ctx.stroke();
    }
  }

  // Horizon glow bar
  ctx.fillStyle = '#ff00aa';
  ctx.fillRect(0, horizon - 2, width, 4);

  // Audio spectrum visualizer bars
  const bars = 24;
  const barWidth = 10;
  const spacing = 4;
  const startX = (width - bars * (barWidth + spacing)) / 2;
  for (let b = 0; b < bars; b++) {
    const barHeight = 15 + Math.abs(Math.sin(t * 5 + b * 0.4)) * 55;
    const bx = startX + b * (barWidth + spacing);
    const by = height - 30 - barHeight;
    ctx.fillStyle = b % 2 === 0 ? '#00ffcc' : '#ff00aa';
    ctx.fillRect(bx, by, barWidth, barHeight);
  }

  // Retro Floating Badges & Typography
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 12;
  ctx.fillText('RETROVID CONVERTER', width / 2, 70);
  ctx.restore();

  ctx.fillStyle = '#ffcc00';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NOKIA · SONY WALKMAN NW-A25 · IPOD · PSP', width / 2, 100);

  // Timecode badge in corner
  const currentSec = Math.floor(frame / 30);
  const currentFrames = frame % 30;
  const timecode = `00:00:0${currentSec}:${currentFrames < 10 ? '0' : ''}${currentFrames}`;
  ctx.fillStyle = '#00ff66';
  ctx.font = '16px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`REC ● ${timecode}`, width - 30, 40);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px monospace';
  ctx.fillText(`FRAME: ${frame + 1} / ${totalFrames} | 640x480 @ 30FPS`, 30, 40);
}
