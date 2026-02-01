'use client';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useState } from 'react';
import {
  HiOutlineBold,
  HiOutlineItalic,
  HiOutlineStrikethrough,
  HiOutlineLink,
  HiOutlinePhoto,
  HiOutlineListBullet,
  HiOutlineCodeBracket,
  HiOutlineBars3BottomLeft,
  HiOutlineMinus,
} from 'react-icons/hi2';
import { RiDoubleQuotesL, RiTwitterXLine, RiUnderline, RiListOrdered2 } from 'react-icons/ri';

interface RichEditorProps {
  content: string;
  onChange: (content: string, html: string) => void;
  placeholder?: string;
}

export default function RichEditor({ content, onChange, placeholder }: RichEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showTweetInput, setShowTweetInput] = useState(false);
  const [tweetUrl, setTweetUrl] = useState('');

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

  const insertTweet = useCallback(() => {
    if (!editor || !tweetUrl) return;

    // Extract tweet ID from URL
    const tweetMatch = tweetUrl.match(/status\/(\d+)/);
    if (tweetMatch) {
      const tweetId = tweetMatch[1];
      // Insert tweet embed as HTML block
      editor
        .chain()
        .focus()
        .insertContent(
          `<div class="tweet-embed" data-tweet-id="${tweetId}">
            <blockquote>
              <p>🐦 Embedded Tweet</p>
              <a href="${tweetUrl}" target="_blank" rel="noopener noreferrer">${tweetUrl}</a>
            </blockquote>
          </div><p></p>`
        )
        .run();
    }

    setTweetUrl('');
    setShowTweetInput(false);
  }, [editor, tweetUrl]);

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
          ? 'bg-ink-950 text-paper-100'
          : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-ink-100 px-3 py-2">
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

          <div className="w-px h-5 bg-ink-200 mx-1.5" />

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

          <div className="w-px h-5 bg-ink-200 mx-1.5" />

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

          <div className="w-px h-5 bg-ink-200 mx-1.5" />

          {/* Links */}
          <ToolbarButton
            onClick={() => {
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run();
              } else {
                setShowLinkInput(!showLinkInput);
                setShowTweetInput(false);
              }
            }}
            isActive={editor.isActive('link')}
            title="Insert Link"
          >
            <HiOutlineLink className="w-4 h-4" />
          </ToolbarButton>

          {/* Tweet embed */}
          <ToolbarButton
            onClick={() => {
              setShowTweetInput(!showTweetInput);
              setShowLinkInput(false);
            }}
            title="Embed Tweet"
          >
            <RiTwitterXLine className="w-4 h-4" />
          </ToolbarButton>
        </div>

        {/* Link input bar */}
        {showLinkInput && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-ink-50 rounded-lg">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-3 py-1.5 text-sm rounded-md border border-ink-200 focus:outline-none focus:border-press-500"
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
              className="px-3 py-1.5 text-sm text-ink-500 hover:text-ink-700"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Tweet input bar */}
        {showTweetInput && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-ink-50 rounded-lg">
            <input
              type="url"
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              placeholder="https://x.com/user/status/123456789"
              className="flex-1 px-3 py-1.5 text-sm rounded-md border border-ink-200 focus:outline-none focus:border-press-500"
              onKeyDown={(e) => e.key === 'Enter' && insertTweet()}
              autoFocus
            />
            <button
              type="button"
              onClick={insertTweet}
              className="px-3 py-1.5 text-sm bg-ink-950 text-paper-100 rounded-md hover:bg-ink-800"
            >
              Embed
            </button>
            <button
              type="button"
              onClick={() => setShowTweetInput(false)}
              className="px-3 py-1.5 text-sm text-ink-500 hover:text-ink-700"
            >
              Cancel
            </button>
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
