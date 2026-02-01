import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { RiTwitterXLine, RiExternalLinkLine, RiDeleteBinLine } from 'react-icons/ri';

function TweetEmbedView({ node, deleteNode }: { node: any; deleteNode: () => void }) {
  const { tweetId, tweetUrl } = node.attrs;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loaded) setError(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [loaded]);

  return (
    <NodeViewWrapper className="tweet-embed-wrapper" data-tweet-embed>
      <div contentEditable={false} className="tweet-embed-container">
        <div className="tweet-embed-header">
          <div className="tweet-embed-header-left">
            <RiTwitterXLine className="tweet-embed-icon" />
            <span className="tweet-embed-label">Embedded Post</span>
          </div>
          <div className="tweet-embed-actions">
            <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="tweet-embed-link" title="Open on X">
              <RiExternalLinkLine className="tweet-embed-action-icon" />
            </a>
            <button onClick={deleteNode} className="tweet-embed-delete" title="Remove embed" type="button">
              <RiDeleteBinLine className="tweet-embed-action-icon" />
            </button>
          </div>
        </div>
        <div className="tweet-embed-body">
          {!error ? (
            <>
              {!loaded && (
                <div className="tweet-embed-loading">
                  <div className="tweet-embed-spinner" />
                  <span>Loading post...</span>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=light&dnt=true`}
                className={`tweet-embed-iframe ${loaded ? 'tweet-embed-iframe-loaded' : ''}`}
                sandbox="allow-scripts allow-same-origin allow-popups"
                onLoad={() => setLoaded(true)}
                title={`Tweet ${tweetId}`}
              />
            </>
          ) : (
            <div className="tweet-embed-fallback">
              <RiTwitterXLine className="tweet-embed-fallback-icon" />
              <p className="tweet-embed-fallback-text">Post preview unavailable</p>
              <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="tweet-embed-fallback-link">View on X</a>
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const TweetEmbed = Node.create({
  name: 'tweetEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      tweetId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-tweet-id'),
        renderHTML: (attributes: Record<string, any>) => ({ 'data-tweet-id': attributes.tweetId }),
      },
      tweetUrl: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-tweet-url'),
        renderHTML: (attributes: Record<string, any>) => ({ 'data-tweet-url': attributes.tweetUrl }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-tweet-id]' }, { tag: 'div[data-tweet-id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes({ class: 'tweet-embed' }, HTMLAttributes)];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TweetEmbedView);
  },
  addCommands() {
    return {
      insertTweet: (attrs: { tweetId: string; tweetUrl: string }) => ({ chain }: { chain: any }) => {
        return chain().insertContent({ type: 'tweetEmbed', attrs }).insertContent({ type: 'paragraph' }).run();
      },
    } as any;
  },
});

export default TweetEmbed;
