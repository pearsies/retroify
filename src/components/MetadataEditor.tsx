import React, { useRef } from 'react';
import { VideoMetadataTags } from '../types/converter';
import { Image as ImageIcon, X } from 'lucide-react';

interface MetadataEditorProps {
  tags: VideoMetadataTags | undefined;
  onChange: (tags: VideoMetadataTags) => void;
  defaultTitle: string;
}

export const MetadataEditor: React.FC<MetadataEditorProps> = ({
  tags,
  onChange,
  defaultTitle,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTags: VideoMetadataTags = tags || {
    title: defaultTitle,
    artist: '',
    album: '',
    year: '',
    coverImage: null,
    coverImageUrl: '',
  };

  const handleTextChange = (key: keyof VideoMetadataTags, val: string) => {
    onChange({
      ...currentTags,
      [key]: val,
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onChange({
        ...currentTags,
        coverImage: file,
        coverImageUrl: url,
      });
    }
  };

  const handleRemoveImage = () => {
    onChange({
      ...currentTags,
      coverImage: null,
      coverImageUrl: '',
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mt-3 p-4 rounded-xl border border-[#a3a3a3] dark:border-[#363636] bg-[#d5d5d5] dark:bg-[#222222] text-xs font-light text-[#333] dark:text-[#cccccc] space-y-3 animate-in fade-in duration-200 transition-colors">
      <div className="flex items-center justify-between border-b border-[#bababa] dark:border-[#333333] pb-2">
        <span className="text-sm font-normal text-[#222] dark:text-[#f0f0f0]">
          ID3 & Album Artwork (iPod / Walkman / PSP)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Track Title */}
        <div className="col-span-2">
          <label className="block text-[11px] text-[#555] dark:text-[#888888] mb-1">
            track title
          </label>
          <input
            type="text"
            value={currentTags.title ?? defaultTitle}
            onChange={(e) => handleTextChange('title', e.target.value)}
            placeholder="e.g. Bohemian Rhapsody"
            className="w-full bg-[#e3e3e3] dark:bg-[#1a1a1a] border border-[#a0a0a0] dark:border-[#3a3a3a] rounded-lg px-2.5 py-1.5 text-xs text-[#222] dark:text-[#ededed] font-light outline-none focus:border-[#666] transition-colors"
          />
        </div>

        {/* Artist */}
        <div>
          <label className="block text-[11px] text-[#555] dark:text-[#888888] mb-1">
            artist
          </label>
          <input
            type="text"
            value={currentTags.artist ?? ''}
            onChange={(e) => handleTextChange('artist', e.target.value)}
            placeholder="e.g. Queen"
            className="w-full bg-[#e3e3e3] dark:bg-[#1a1a1a] border border-[#a0a0a0] dark:border-[#3a3a3a] rounded-lg px-2.5 py-1.5 text-xs text-[#222] dark:text-[#ededed] font-light outline-none focus:border-[#666] transition-colors"
          />
        </div>

        {/* Album */}
        <div>
          <label className="block text-[11px] text-[#555] dark:text-[#888888] mb-1">
            album
          </label>
          <input
            type="text"
            value={currentTags.album ?? ''}
            onChange={(e) => handleTextChange('album', e.target.value)}
            placeholder="e.g. A Night at the Opera"
            className="w-full bg-[#e3e3e3] dark:bg-[#1a1a1a] border border-[#a0a0a0] dark:border-[#3a3a3a] rounded-lg px-2.5 py-1.5 text-xs text-[#222] dark:text-[#ededed] font-light outline-none focus:border-[#666] transition-colors"
          />
        </div>

        {/* Year */}
        <div>
          <label className="block text-[11px] text-[#555] dark:text-[#888888] mb-1">
            release year
          </label>
          <input
            type="text"
            value={currentTags.year ?? ''}
            onChange={(e) => handleTextChange('year', e.target.value)}
            placeholder="e.g. 1975"
            maxLength={4}
            className="w-full bg-[#e3e3e3] dark:bg-[#1a1a1a] border border-[#a0a0a0] dark:border-[#3a3a3a] rounded-lg px-2.5 py-1.5 text-xs text-[#222] dark:text-[#ededed] font-light outline-none focus:border-[#666] transition-colors"
          />
        </div>

        {/* Cover Artwork */}
        <div>
          <label className="block text-[11px] text-[#555] dark:text-[#888888] mb-1">
            cover art
          </label>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageUpload}
            className="hidden"
          />

          {currentTags.coverImageUrl ? (
            <div className="flex items-center gap-2 mt-0.5">
              <img
                src={currentTags.coverImageUrl}
                alt="Cover"
                className="w-9 h-9 object-cover rounded-md border border-[#888] shadow-xs"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="text-[11px] font-light text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>remove</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-1.5 px-2 bg-[#e3e3e3] dark:bg-[#1a1a1a] hover:bg-[#dadada] dark:hover:bg-[#252525] border border-[#a0a0a0] dark:border-[#3a3a3a] rounded-lg text-xs font-light text-[#444] dark:text-[#aaa] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5 text-[#666] dark:text-[#888]" />
              <span>attach artwork</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
