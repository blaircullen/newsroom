'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  HiOutlineMagnifyingGlass,
  HiOutlinePhoto,
  HiOutlineXMark,
  HiOutlineCheck,
  HiOutlineCloudArrowUp,
  HiOutlineFolder,
} from 'react-icons/hi2';

interface MediaImage {
  id: string;
  name: string;
  mimeType: string;
  thumbnailUrl: string;
  directUrl: string;
  size: string;
  createdTime: string;
  credit?: string | null;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
}

interface ImagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (image: MediaImage) => void;
  selectedImageId?: string | null;
}

type Tab = 'browse' | 'upload';

export default function ImagePicker({ isOpen, onClose, onSelect, selectedImageId }: ImagePickerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [images, setImages] = useState<MediaImage[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadCredit, setUploadCredit] = useState('');
  const [uploadAltText, setUploadAltText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = useCallback(async (query?: string, pageNum: number = 1, signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('page', String(pageNum));
      params.set('limit', '30');

      const res = await fetch(`/api/media?${params}`, { signal });

      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();

      if (pageNum > 1) {
        setImages((prev) => [...prev, ...data.images]);
      } else {
        setImages(data.images);
      }
      setTotalPages(data.pages || 1);
      setPage(pageNum);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to fetch images:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || activeTab !== 'browse') return;

    const controller = new AbortController();
    fetchImages(undefined, 1, controller.signal);

    return () => controller.abort();
  }, [isOpen, activeTab, fetchImages]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'browse') return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchImages(search || undefined, 1, controller.signal);
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, isOpen, activeTab, fetchImages]);

  // Reset upload state when closing or switching tabs
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('browse');
      resetUploadState();
    }
  }, [isOpen]);

  function resetUploadState() {
    setUploadFile(null);
    setUploadPreview(null);
    setUploadError(null);
    setIsUploading(false);
    setUploadCredit('');
    setUploadAltText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileSelect(file: File) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please select a valid image file (JPEG, PNG, GIF, WebP, or SVG)');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File is too large. Maximum size is 20MB.');
      return;
    }

    setUploadError(null);
    setUploadFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setUploadPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }

  async function handleUpload() {
    if (!uploadFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadCredit.trim()) formData.append('credit', uploadCredit.trim());
      if (uploadAltText.trim()) formData.append('altText', uploadAltText.trim());

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Select the uploaded image immediately
      onSelect(data.image);
      resetUploadState();
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-picker-title"
        className="relative bg-white w-full max-w-full md:max-w-4xl max-h-[100dvh] md:max-h-[80vh] flex flex-col overflow-hidden fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto rounded-t-2xl md:rounded-2xl shadow-elevated"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-press-50 flex items-center justify-center">
              <HiOutlinePhoto className="w-5 h-5 text-press-600" />
            </div>
            <div>
              <h3 id="image-picker-title" className="font-display font-semibold text-lg text-ink-900">
                Featured Image
              </h3>
              <p className="text-ink-400 text-xs">
                Browse the media library or upload your own
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-700 transition-colors focus:outline-none focus:ring-2 focus:ring-press-500"
            aria-label="Close image picker"
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 border-b border-ink-100">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                activeTab === 'browse'
                  ? 'border-press-500 text-press-700 bg-press-50/50'
                  : 'border-transparent text-ink-400 hover:text-ink-600 hover:bg-ink-50'
              }`}
            >
              <HiOutlineFolder className="w-4 h-4" />
              Browse Library
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                activeTab === 'upload'
                  ? 'border-press-500 text-press-700 bg-press-50/50'
                  : 'border-transparent text-ink-400 hover:text-ink-600 hover:bg-ink-50'
              }`}
            >
              <HiOutlineCloudArrowUp className="w-4 h-4" />
              Upload Image
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'browse' ? (
          <>
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
                      {search ? 'No images found matching your search' : 'No images in the media library'}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-3">
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
                  {page < totalPages && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => fetchImages(search || undefined, page + 1)}
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
          </>
        ) : (
          /* Upload Tab */
          <div className="flex-1 overflow-y-auto p-5">
            {!uploadFile ? (
              /* Drop zone */
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center py-20 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  isDragging
                    ? 'border-press-500 bg-press-50/50'
                    : 'border-ink-200 hover:border-press-300 hover:bg-ink-50/50'
                }`}
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                  isDragging ? 'bg-press-100' : 'bg-ink-100'
                }`}>
                  <HiOutlineCloudArrowUp className={`w-7 h-7 ${isDragging ? 'text-press-600' : 'text-ink-400'}`} />
                </div>
                <p className="text-ink-700 font-medium text-sm mb-1">
                  {isDragging ? 'Drop your image here' : 'Drag and drop an image here'}
                </p>
                <p className="text-ink-400 text-xs mb-4">
                  or click to browse your files
                </p>
                <p className="text-ink-300 text-xs">
                  JPEG, PNG, GIF, WebP, or SVG — up to 20MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </div>
            ) : (
              /* Preview and confirm */
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-ink-100 bg-ink-50">
                  {uploadPreview && (
                    <img
                      src={uploadPreview}
                      alt="Upload preview"
                      className="w-full max-h-[35vh] object-contain"
                    />
                  )}
                </div>

                {/* File info */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-press-50 flex items-center justify-center flex-shrink-0">
                      <HiOutlinePhoto className="w-4 h-4 text-press-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-800 truncate">
                        {uploadFile.name}
                      </p>
                      <p className="text-xs text-ink-400">
                        {formatFileSize(uploadFile.size)} — {uploadFile.type.split('/')[1].toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetUploadState}
                    className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition-colors flex-shrink-0"
                  >
                    <HiOutlineXMark className="w-4 h-4" />
                  </button>
                </div>

                {/* Credit & Alt Text fields */}
                <div className="space-y-3">
                  <input
                    type="text"
                    value={uploadCredit}
                    onChange={(e) => setUploadCredit(e.target.value)}
                    placeholder="Image credit (e.g. Photo: Getty Images / John Smith)"
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm text-ink-700 placeholder-ink-300 focus:outline-none focus:border-press-500"
                  />
                  <input
                    type="text"
                    value={uploadAltText}
                    onChange={(e) => setUploadAltText(e.target.value)}
                    placeholder="Alt text (describe the image for accessibility)"
                    className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm text-ink-700 placeholder-ink-300 focus:outline-none focus:border-press-500"
                  />
                </div>

                {/* Error */}
                {uploadError && (
                  <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100">
                    <p className="text-sm text-red-700">{uploadError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={resetUploadState}
                    disabled={isUploading}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-ink-700 bg-white border border-ink-200 rounded-lg hover:bg-ink-50 disabled:opacity-50 transition-all"
                  >
                    Choose Different Image
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-paper-100 bg-ink-950 rounded-lg hover:bg-ink-800 disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {isUploading ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-paper-200 border-t-paper-100 rounded-full" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <HiOutlineCloudArrowUp className="w-4 h-4" />
                        Upload &amp; Use Image
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error without file selected */}
            {uploadError && !uploadFile && (
              <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
                <p className="text-sm text-red-700">{uploadError}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
