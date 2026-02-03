'use client';

import { useState, useEffect, useRef } from 'react';
import { HiOutlineXMark, HiOutlineTag } from 'react-icons/hi2';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (input.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let isCancelled = false;

    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`/api/tags?q=${encodeURIComponent(input)}`);
        if (!res.ok) throw new Error('Failed to fetch');

        const data: { id: string; name: string }[] = await res.json();

        if (!isCancelled) {
          const filtered = data.filter((t) => !tags.includes(t.name));
          setSuggestions(filtered);
          setShowSuggestions(filtered.length > 0);
        }
      } catch (error) {
        console.error('Failed to fetch tag suggestions:', error);
        if (!isCancelled) {
          setSuggestions([]);
        }
      }
    };

    const timer = setTimeout(fetchSuggestions, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [input, tags]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const addTag = (tagName: string) => {
    const trimmed = tagName.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="flex items-center gap-1.5 text-sm font-medium text-ink-600 mb-2">
        <HiOutlineTag className="w-4 h-4" />
        Tags
      </label>
      
      <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-ink-200 bg-white focus-within:border-press-500 focus-within:ring-2 focus-within:ring-press-500/10 transition-all min-h-[44px]">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-ink-100 text-ink-700 rounded-md text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="text-ink-400 hover:text-ink-700 transition-colors"
            >
              <HiOutlineXMark className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => input && setShowSuggestions(true)}
          placeholder={tags.length === 0 ? 'Add tags...' : ''}
          className="flex-1 min-w-[120px] text-sm text-ink-800 placeholder-ink-300 focus:outline-none bg-transparent"
        />
      </div>

      <p className="mt-1 text-xs text-ink-400">
        Press Enter or comma to add a tag
      </p>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-card-hover border border-ink-100 py-1 max-h-40 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => addTag(suggestion.name)}
              className="w-full text-left px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 transition-colors"
            >
              {suggestion.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
