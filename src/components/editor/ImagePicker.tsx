'use client';

import { useState, useEffect, useCallback } from 'react';
import { HiOutlineMagnifyingGlass, HiOutlinePhoto, HiOutlineXMark, HiOutlineCheck } from 'react-icons/hi2';

interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
  thumbnailUrl: string;
  directUrl: string;
  size: string;
  createdTime: string;
}

interface ImagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (image: DriveImage) => void;
  selectedImageId?: string | null;
}

export default function ImagePicker({ isOpen, onClose, onSelect, selectedImageId }: ImagePickerProps) {
  const [images, setImages] = useState<DriveImage[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const fetchImages = useCallback(async (query?: string, pageToken?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(`/api/drive-images?${params}`);
      const data = await res.json();

      if (pageToken) {
        setImages((prev) => [...prev, ...data.images]);
      } else {
        setImages(data.images);
      }
      setNextPageToken(data.nextPageToken || null);
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [isOpen, fetchImages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        fetchImages(search || undefined);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, isOpen, fetchImages]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-press-50 flex items-center justify-center">
              <HiOutlinePhoto className="w-5 h-5 text-press-600" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg text-ink-900">
                Image Library
              </h3>
              <p className="text-ink-400 text-xs">
                Select a featured image from the shared drive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-700 transition-colors"
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-ink-50">
          <div className="relative">
            <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search images by name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 focus:ring-2 focus:ring-press-500/10"
            />
          </div>
        </div>

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && images.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-ink-200 border-t-press-500 rounded-full mx-auto mb-3" />
                <p className="text-ink-400 text-sm">Loading images...</p>
              </div>
            </div>
          ) : images.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <HiOutlinePhoto className="w-12 h-12 text-ink-200 mx-auto mb-3" />
                <p className="text-ink-500 text-sm">
                  {search ? 'No images found matching your search' : 'No images in the shared drive'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                {images.map((image) => (
                  <button
                    key={image.id}
                    onClick={() => onSelect(image)}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all duration-150 aspect-[4/3]
                      ${selectedImageId === image.id
                        ? 'border-press-500 ring-2 ring-press-500/20'
                        : 'border-transparent hover:border-ink-200'
                      }`}
                  >
                    <img
                      src={image.thumbnailUrl || image.directUrl}
                      alt={image.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-ink-950/0 group-hover:bg-ink-950/40 transition-all duration-150 flex items-end">
                      <div className="w-full p-2 bg-gradient-to-t from-ink-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-paper-100 text-xs truncate">
                          {image.name}
                        </p>
                      </div>
                    </div>
                    {/* Selected indicator */}
                    {selectedImageId === image.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-press-500 rounded-full flex items-center justify-center">
                        <HiOutlineCheck className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Load more */}
              {nextPageToken && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => fetchImages(search || undefined, nextPageToken)}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm text-press-600 hover:text-press-700 font-medium"
                  >
                    {isLoading ? 'Loading...' : 'Load more images'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
