import React, { useRef, useState, useCallback, useEffect } from 'react';

interface TimelineScrubberProps {
  duration: number;
  startTime: number;
  endTime: number;
  onChange: (start: number, end: number) => void;
  onSeek?: (time: number) => void;
}

function formatScrubberTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  duration,
  startTime,
  endTime,
  onChange,
  onSeek,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeDrag, setActiveDrag] = useState<'start' | 'end' | 'playhead' | null>(null);

  const safeDuration = Math.max(0.1, duration);
  const startPercent = Math.min(100, Math.max(0, (startTime / safeDuration) * 100));
  const endPercent = Math.min(
    100,
    Math.max(startPercent + 0.5, ((endTime || duration) / safeDuration) * 100)
  );

  const calculateTimeFromX = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = x / rect.width;
      return Math.round(ratio * safeDuration * 10) / 10;
    },
    [safeDuration]
  );

  const handlePointerDown = (type: 'start' | 'end', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveDrag(type);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDrag) return;
    const time = calculateTimeFromX(e.clientX);

    if (activeDrag === 'start') {
      const newStart = Math.min(time, (endTime || duration) - 0.5);
      const clamped = Math.max(0, newStart);
      onChange(clamped, endTime || duration);
      onSeek?.(clamped);
    } else if (activeDrag === 'end') {
      const newEnd = Math.max(time, startTime + 0.5);
      const clamped = Math.min(safeDuration, newEnd);
      onChange(startTime, clamped);
      onSeek?.(clamped);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeDrag) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture already released
      }
      setActiveDrag(null);
    }
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (activeDrag) return;
    const clickedTime = calculateTimeFromX(e.clientX);
    onSeek?.(clickedTime);

    // Adjust nearest boundary if clicked outside active range
    const distToStart = Math.abs(clickedTime - startTime);
    const distToEnd = Math.abs(clickedTime - (endTime || duration));

    if (distToStart < distToEnd) {
      const newStart = Math.min(clickedTime, (endTime || duration) - 0.5);
      onChange(Math.max(0, newStart), endTime || duration);
    } else {
      const newEnd = Math.max(clickedTime, startTime + 0.5);
      onChange(startTime, Math.min(safeDuration, newEnd));
    }
  };

  return (
    <div className="w-full select-none pt-1 pb-2">
      {/* Visual Track Area */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative h-4 flex items-center cursor-pointer group"
      >
        {/* Full Timeline Background Track */}
        <div className="w-full h-2 bg-[#bebebe] dark:bg-[#282828] rounded-full border border-[#9c9c9c] dark:border-[#383838] transition-colors overflow-hidden" />

        {/* Selected Range Highlight Fill */}
        <div
          className="absolute h-2 bg-[#555555] dark:bg-[#777777] rounded-full pointer-events-none transition-colors"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(1, endPercent - startPercent)}%`,
          }}
        />

        {/* Start Trim Handle */}
        <div
          onPointerDown={(e) => handlePointerDown('start', e)}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-6 bg-[#dfdfdf] dark:bg-[#282828] border-2 border-[#555] dark:border-[#888] rounded-md cursor-ew-resize shadow-xs hover:scale-110 active:scale-95 transition-transform flex items-center justify-center z-10"
          style={{ left: `${startPercent}%` }}
          title={`Trim Start: ${formatScrubberTime(startTime)}`}
        >
          <div className="w-0.5 h-2.5 bg-[#666] dark:bg-[#999] rounded-full" />
        </div>

        {/* End Trim Handle */}
        <div
          onPointerDown={(e) => handlePointerDown('end', e)}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-6 bg-[#dfdfdf] dark:bg-[#282828] border-2 border-[#555] dark:border-[#888] rounded-md cursor-ew-resize shadow-xs hover:scale-110 active:scale-95 transition-transform flex items-center justify-center z-10"
          style={{ left: `${endPercent}%` }}
          title={`Trim End: ${formatScrubberTime(endTime || duration)}`}
        >
          <div className="w-0.5 h-2.5 bg-[#666] dark:bg-[#999] rounded-full" />
        </div>
      </div>

      {/* Track time range legend */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[#666] dark:text-[#888] px-0.5 mt-0.5">
        <span>0:00</span>
        <span className="text-[#333] dark:text-[#ccc]">
          clip: {formatScrubberTime(Math.max(0, (endTime || duration) - startTime))}
        </span>
        <span>{formatScrubberTime(duration)}</span>
      </div>
    </div>
  );
};
