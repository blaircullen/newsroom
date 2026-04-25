import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MINOR_WORDS = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','as']);

export function fixAllCapsHeadline(str: string): string {
  const letters = str.replace(/[^a-zA-Z]/g, '');
  if (!letters.length) return str;
  const upperRatio = (str.match(/[A-Z]/g) || []).length / letters.length;
  if (upperRatio < 0.7) return str;
  return str.toLowerCase().replace(/\b\w+\b/g, (word, offset) =>
    offset === 0 || !MINOR_WORDS.has(word) ? word[0].toUpperCase() + word.slice(1) : word
  );
}
