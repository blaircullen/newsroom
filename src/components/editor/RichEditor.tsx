'use client';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { MediaEmbed, parseMediaUrl, SUPPORTED_PLATFORMS, PlatformType } from './extensions/MediaEmbed';
import { useCallback, useState } from 'react';
import {
  HiOutlineBold,
  HiOutlineItalic,
  HiOutlineStrikethrough,
  HiOutlineLink,
  HiOutlineListBullet,
  HiOutlineCodeBracket,
  HiOutlineMinus,
  HiOutlinePlayCircle,
} from 'react-icons/hi2';
import { RiDoubleQuotesL, RiUnderline, RiListOrdered2 } from 'react-icons/ri';

interface RichEditorProps {
  content: string;
  onChange: (content: string, html: string) => void;
  placeholder?: string;
}

export default function RichEditor({ content, onChange, placeholder }: RichEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showEmbedInput, setShowEmbedInput] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const [embedError, setEmbedError] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-press-600 underline',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full',
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder || 'Start writing your story...',
      }),
      MediaEmbed,
    ],
    content,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const html = editor.getHTML();
      onChange(text, html);
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor min-h-[400px] focus:outline-none px-1 py-2',
      },
    },
  });

  const setLink = useCallback(() => {
    if (!editor || !linkUrl) return;

    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl })
        .run();
    }

    setLinkUrl('');
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const insertEmbed = useCallback(() => {
    if (!editor || !embedUrl) return;
    setEmbedError('');

    const parsed = parseMediaUrl(embedUrl);
    if (!parsed) {
      const supportedList = Object.values(SUPPORTED_PLATFORMS)
        .map((p) => p.name)
        .join(', ');
      setEmbedError(`Unsupported URL. Supported platforms: ${supportedList}`);
      return;
    }

    (editor.commands as any).insertMediaEmbed({
      platform: parsed.platform,
      mediaId: parsed.id,
      originalUrl: parsed.url,
    });

    setEmbedUrl('');
    setShowEmbedInput(false);
  }, [editor, embedUrl]);

  if (!editor) return null;

  const ToolbarButton = ({
    onClick,
    isActive = false,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-md transition-all duration-100 ${
        isActive
          ? 'bg-ink-950 text-paper-100 dark:bg-ink-100 dark:text-ink-900'
          : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-700 dark:hover:text-ink-100'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-ink-900/95 backdrop-blur-sm border-b border-ink-100 dark:border-ink-700 px-3 py-2">
        <div className="flex items-center gap-0.5 flex-wrap">
          {/* Text formatting */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold (Ctrl+B)"
          >
            <HiOutlineBold className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic (Ctrl+I)"
          >
            <HiOutlineItalic className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Underline (Ctrl+U)"
          >
            <RiUnderline className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="Strikethrough"
          >
            <HiOutlineStrikethrough className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-ink-200 dark:bg-ink-600 mx-1.5" />

          {/* Headings */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <span className="text-xs font-bold">H2</span>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <span className="text-xs font-bold">H3</span>
          </ToolbarButton>

          <div className="w-px h-5 bg-ink-200 dark:bg-ink-600 mx-1.5" />

          {/* Lists */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <HiOutlineListBullet className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <RiListOrdered2 className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="Blockquote"
          >
            <RiDoubleQuotesL className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive('codeBlock')}
            title="Code Block"
          >
            <HiOutlineCodeBracket className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal Rule"
          >
            <HiOutlineMinus className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-ink-200 dark:bg-ink-600 mx-1.5" />

          {/* Links */}
          <ToolbarButton
            onClick={() => {
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run();
              } else {
                setShowLinkInput(!showLinkInput);
                setShowEmbedInput(false);
              }
            }}
            isActive={editor.isActive('link')}
            title="Insert Link"
          >
            <HiOutlineLink className="w-4 h-4" />
          </ToolbarButton>

          {/* Media embed */}
          <ToolbarButton
            onClick={() => {
              setShowEmbedInput(!showEmbedInput);
              setShowLinkInput(false);
              setEmbedError('');
            }}
            title="Embed Media (YouTube, X, TikTok, Facebook, Rumble)"
          >
            <HiOutlinePlayCircle className="w-4 h-4" />
          </ToolbarButton>
        </div>

        {/* Link input bar */}
        {showLinkInput && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-ink-50 dark:bg-ink-800 rounded-lg">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-3 py-1.5 text-sm rounded-md border border-ink-200 dark:border-ink-600 bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 focus:outline-none focus:border-press-500"
              onKeyDown={(e) => e.key === 'Enter' && setLink()}
              autoFocus
            />
            <button
              type="button"
              onClick={setLink}
              className="px-3 py-1.5 text-sm bg-ink-950 text-paper-100 rounded-md hover:bg-ink-800"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowLinkInput(false)}
              className="px-3 py-1.5 text-sm text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Embed input bar */}
        {showEmbedInput && (
          <div className="mt-2 p-3 bg-ink-50 dark:bg-ink-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="url"
                value={embedUrl}
                onChange={(e) => {
                  setEmbedUrl(e.target.value);
                  setEmbedError('');
                }}
                placeholder="Paste video or post URL..."
                className="flex-1 px-3 py-2 text-sm rounded-md border border-ink-200 dark:border-ink-600 bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 focus:outline-none focus:border-press-500"
                onKeyDown={(e) => e.key === 'Enter' && insertEmbed()}
                autoFocus
              />
              <button
                type="button"
                onClick={insertEmbed}
                className="px-4 py-2 text-sm bg-ink-950 text-paper-100 rounded-md hover:bg-ink-800 font-medium"
              >
                Embed
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEmbedInput(false);
                  setEmbedError('');
                }}
                className="px-3 py-2 text-sm text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
              >
                Cancel
              </button>
            </div>

            {/* Supported platforms hint */}
            <div className="flex items-center gap-3 text-xs text-ink-400">
              <span>Supported:</span>
              {Object.entries(SUPPORTED_PLATFORMS).map(([key, platform]) => {
                const Icon = platform.icon;
                return (
                  <span key={key} className="flex items-center gap-1">
                    <Icon className={`w-3.5 h-3.5 ${platform.color}`} />
                    {platform.name}
                  </span>
                );
              })}
            </div>

            {embedError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{embedError}</p>
            )}
          </div>
        )}
      </div>

      {/* Bubble menu for selected text */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="bg-ink-950 rounded-lg shadow-elevated flex items-center gap-0.5 px-1 py-1"
        >
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded ${editor.isActive('bold') ? 'bg-ink-700 text-press-400' : 'text-ink-300 hover:text-paper-100'}`}
          >
            <HiOutlineBold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded ${editor.isActive('italic') ? 'bg-ink-700 text-press-400' : 'text-ink-300 hover:text-paper-100'}`}
          >
            <HiOutlineItalic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const url = window.prompt('Enter URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            className={`p-1.5 rounded ${editor.isActive('link') ? 'bg-ink-700 text-press-400' : 'text-ink-300 hover:text-paper-100'}`}
          >
            <HiOutlineLink className="w-3.5 h-3.5" />
          </button>
        </BubbleMenu>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
