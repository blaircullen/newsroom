import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface SlashMenuItem {
  id: string;
  label: string;
  description: string;
  icon?: string;
  command: (editor: any, from: number, to: number) => void;
}

export interface SlashMenuState {
  active: boolean;
  query: string;
  items: SlashMenuItem[];
  selectedIndex: number;
  x: number;
  y: number;
}

export interface SlashCommandOptions {
  items: SlashMenuItem[];
  onMenuChange: (state: SlashMenuState | null) => void;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      items: [],
      onMenuChange: () => {},
    };
  },

  addStorage(): { state: SlashMenuState | null } {
    return { state: null };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const st = this.storage.state;
        if (!st?.active) return false;

        const item = st.items[st.selectedIndex];
        if (item) {
          const { $from } = editor.state.selection;
          if ($from.depth < 1) return false;
          const from = $from.before($from.depth);
          const to = $from.after($from.depth);
          item.command(editor, from, to);
        }

        this.storage.state = null;
        this.options.onMenuChange(null);
        return true;
      },

      Escape: () => {
        if (!this.storage.state?.active) return false;
        this.storage.state = null;
        this.options.onMenuChange(null);
        return true;
      },

      ArrowDown: () => {
        const st = this.storage.state;
        if (!st?.active) return false;
        st.selectedIndex = Math.min(st.selectedIndex + 1, st.items.length - 1);
        this.options.onMenuChange({ ...st });
        return true;
      },

      ArrowUp: () => {
        const st = this.storage.state;
        if (!st?.active) return false;
        st.selectedIndex = Math.max(st.selectedIndex - 1, 0);
        this.options.onMenuChange({ ...st });
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey('slashCommand'),

        view() {
          return {
            update(view) {
              const { state } = view;
              const { selection } = state;
              const { $from } = selection;

              // Only trigger in paragraphs
              if ($from.parent.type.name !== 'paragraph') {
                if (extension.storage.state?.active) {
                  extension.storage.state = null;
                  extension.options.onMenuChange(null);
                }
                return;
              }

              const text = $from.parent.textContent;
              const atEnd = $from.parentOffset === text.length;

              // Detect /command pattern (cursor must be at end, text must start with /, max 20 chars)
              if (text.startsWith('/') && atEnd && text.length <= 20) {
                const query = text.slice(1).toLowerCase();
                const filtered = extension.options.items.filter(
                  (item) =>
                    item.label.toLowerCase().includes(query) ||
                    item.id.includes(query)
                );

                if (filtered.length > 0) {
                  const coords = view.coordsAtPos($from.start());
                  const newState: SlashMenuState = {
                    active: true,
                    query,
                    items: filtered,
                    selectedIndex: Math.min(
                      extension.storage.state?.selectedIndex || 0,
                      filtered.length - 1
                    ),
                    x: coords.left,
                    y: coords.bottom + 4,
                  };
                  extension.storage.state = newState;
                  extension.options.onMenuChange(newState);
                  return;
                }
              }

              // Deactivate if no match
              if (extension.storage.state?.active) {
                extension.storage.state = null;
                extension.options.onMenuChange(null);
              }
            },
          };
        },
      }),
    ];
  },
});

export default SlashCommand;
