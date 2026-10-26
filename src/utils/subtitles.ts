import { SubtitleCue } from '../types/converter';

/**
 * Parses timestamp string (00:01:23,456 or 00:01:23.456) to seconds
 */
function parseTimestamp(str: string): number {
  const parts = str.trim().replace(',', '.').split(':');
  if (parts.length === 3) {
    return (
      parseFloat(parts[0]) * 3600 +
      parseFloat(parts[1]) * 60 +
      parseFloat(parts[2])
    );
  } else if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return 0;
}

/**
 * Parses .srt or .vtt raw subtitle file text into an array of SubtitleCues
 */
export function parseSubtitles(raw: string): SubtitleCue[] {
  const clean = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = clean.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIdx = i;
        break;
      }
    }
    if (timeLineIdx === -1) continue;

    const [startStr, endStr] = lines[timeLineIdx].split('-->');
    if (!startStr || !endStr) continue;

    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endStr.trim().split(' ')[0]);

    const textLines = lines
      .slice(timeLineIdx + 1)
      .map((l) => l.replace(/<[^>]*>/g, '').trim())
      .filter(Boolean);
    const text = textLines.join('\n');

    if (text && end > start) {
      cues.push({ start, end, text });
    }
  }

  // Sort cues by start time
  return cues.sort((a, b) => a.start - b.start);
}

/**
 * Word wraps subtitle text to fit within maxWidth
 */
function wrapSubtitleLines(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rawText: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = rawText.split('\n');

  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Burns active subtitles onto canvas frame with high contrast outline
 */
export function renderSubtitlesToCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  currentSeconds: number,
  cues: SubtitleCue[] | undefined,
  targetWidth: number,
  targetHeight: number
): void {
  if (!cues || cues.length === 0) return;

  // Find active cues at current time
  const activeCue = cues.find(
    (c) => currentSeconds >= c.start && currentSeconds <= c.end
  );
  if (!activeCue || !activeCue.text) return;

  ctx.save();

  // Dynamic font sizing proportional to target screen resolution
  const fontSize = Math.max(
    11,
    Math.min(24, Math.round(targetHeight * 0.062))
  );
  const lineHeight = Math.round(fontSize * 1.25);
  const paddingBottom = Math.max(6, Math.round(targetHeight * 0.04));
  const maxTextWidth = Math.round(targetWidth * 0.88);

  ctx.font = `300 ${fontSize}px Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const lines = wrapSubtitleLines(ctx, activeCue.text, maxTextWidth);
  const totalBlockHeight = lines.length * lineHeight;
  const bottomY = targetHeight - paddingBottom;
  const startY = bottomY - totalBlockHeight + lineHeight;

  const outlineWidth = Math.max(2.5, Math.round(fontSize * 0.2));

  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    const x = targetWidth / 2;

    // Outer dark stroke for legibility over both dark and bright scenes
    ctx.lineJoin = 'round';
    ctx.lineWidth = outlineWidth;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.strokeText(line, x, y);

    // Primary bright text fill
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, x, y);
  });

  ctx.restore();
}
