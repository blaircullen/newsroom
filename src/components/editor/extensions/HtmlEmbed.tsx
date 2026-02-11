import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { RiCodeLine, RiDeleteBinLine, RiEdit2Line } from 'react-icons/ri';

function buildSrcdoc(html: string, embedId: string): string {
  const safeId = embedId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}</style>
</head><body data-embed-id="${safeId}">${html}<script>(function(){var id=document.body.getAttribute("data-embed-id");function h(){var height=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);window.parent.postMessage({type:"html-embed-resize",id:id,height:height},"*")}window.addEventListener("load",h);window.addEventListener("resize",h);new MutationObserver(h).observe(document.body,{childList:true,subtree:true,attributes:true});setTimeout(h,100);setTimeout(h,500);setTimeout(h,1500);setTimeout(h,3000)})()</script></body></html>`;
}

function HtmlEmbedView({ node, updateAttributes, deleteNode }: { node: any; updateAttributes: any; deleteNode: () => void }) {
  const { htmlContent } = node.attrs;
  const [editing, setEditing] = useState(!htmlContent);
  const [code, setCode] = useState(htmlContent || '');
  const [height, setHeight] = useState(200);
  const embedId = useRef(`he-${crypto.randomUUID()}`);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'html-embed-resize' && e.data.id === embedId.current) {
        const h = Number(e.data.height);
        if (Number.isFinite(h)) {
          setHeight(Math.min(Math.max(80, h), 5000));
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Re-generate embed ID when content changes to force iframe refresh
  useEffect(() => {
    if (htmlContent) {
      embedId.current = `he-${crypto.randomUUID()}`;
    }
  }, [htmlContent]);

  const handleSave = useCallback(() => {
    const trimmed = code.trim();
    if (trimmed) {
      updateAttributes({ htmlContent: trimmed });
      setEditing(false);
    }
  }, [code, updateAttributes]);

  if (editing) {
    return (
      <NodeViewWrapper className="html-embed-wrapper my-4">
        <div contentEditable={false} className="border border-ink-200 dark:border-ink-700 rounded-xl overflow-hidden bg-white dark:bg-ink-900">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/50">
            <div className="p-1.5 rounded-md bg-violet-500/10">
              <RiCodeLine className="w-4 h-4 text-violet-500" />
            </div>
            <span className="text-sm font-medium text-ink-700 dark:text-ink-300">HTML Embed</span>
          </div>
          <div className="p-3">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={'Paste your HTML embed code here...\n\nExamples: Twitter/X embeds, YouTube iframes, ad code, widgets'}
              className="w-full h-40 px-3 py-2 text-sm font-mono bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-lg resize-y focus:outline-none focus:border-press-500 text-ink-800 dark:text-ink-200 placeholder:text-ink-400"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              {htmlContent ? (
                <button
                  type="button"
                  onClick={() => { setCode(htmlContent); setEditing(false); }}
                  className="px-3 py-1.5 text-sm text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={deleteNode}
                  className="px-3 py-1.5 text-sm text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={!code.trim()}
                className="px-4 py-1.5 text-sm bg-ink-950 text-paper-100 rounded-md hover:bg-ink-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {htmlContent ? 'Update' : 'Insert Embed'}
              </button>
            </div>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="html-embed-wrapper my-4">
      <div contentEditable={false} className="border border-ink-200 dark:border-ink-700 rounded-xl overflow-hidden bg-white dark:bg-ink-900">
        <div className="flex items-center justify-between px-4 py-2 border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-violet-500/10">
              <RiCodeLine className="w-4 h-4 text-violet-500" />
            </div>
            <span className="text-sm font-medium text-ink-700 dark:text-ink-300">HTML Embed</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-md text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors"
              title="Edit embed code"
              type="button"
            >
              <RiEdit2Line className="w-4 h-4" />
            </button>
            <button
              onClick={deleteNode}
              className="p-1.5 rounded-md text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Remove embed"
              type="button"
            >
              <RiDeleteBinLine className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="bg-white dark:bg-ink-900">
          {/* Sandbox without allow-same-origin: scripts run but cannot access parent page */}
          <iframe
            srcDoc={buildSrcdoc(htmlContent, embedId.current)}
            sandbox="allow-scripts allow-popups allow-presentation"
            style={{ width: '100%', height: `${height}px`, border: 'none', display: 'block' }}
            title="HTML embed"
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const HtmlEmbed = Node.create({
  name: 'htmlEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      htmlContent: {
        default: '',
        parseHTML: (element: HTMLElement) => {
          return element.getAttribute('data-content') || '';
        },
        renderHTML: (attributes: Record<string, string>) => ({
          'data-content': attributes.htmlContent,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-html-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-html-embed': 'true', class: 'html-embed' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HtmlEmbedView);
  },

  addCommands() {
    return {
      insertHtmlEmbed:
        (attrs?: { htmlContent?: string }) =>
        ({ chain }: { chain: any }) => {
          return chain()
            .insertContent({ type: 'htmlEmbed', attrs: attrs || {} })
            .insertContent({ type: 'paragraph' })
            .run();
        },
    } as any;
  },
});

export default HtmlEmbed;
