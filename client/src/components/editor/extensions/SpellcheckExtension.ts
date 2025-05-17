import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { DecorationSet, Decoration } from 'prosemirror-view';
import { Node as ProsemirrorNode } from 'prosemirror-model';

export interface SpellcheckOptions {
  spellcheckClass: string;
  menuClass: string;
}

export interface SpellcheckError {
  offset: number;
  token: string;
  type: string;
  suggestions: string[];
  editId?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spellcheck: {
      setSpellcheckErrors: (errors: SpellcheckError[]) => ReturnType;
      clearSpellcheckErrors: () => ReturnType;
    }
  }
}

// Helper function to normalize whitespace for better matching
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export const SpellcheckExtension = Extension.create<SpellcheckOptions>({
  name: 'spellcheck',

  addOptions() {
    return {
      spellcheckClass: 'spellcheck-error',
      menuClass: 'spellcheck-menu',
    };
  },

  addStorage() {
    return {
      errors: [] as SpellcheckError[],
    };
  },

  addCommands() {
    return {
      setSpellcheckErrors: (errors) => ({ editor }) => {
        console.log('Setting spellcheck errors:', errors);
        this.storage.errors = errors;
        editor.view.dispatch(editor.state.tr.setMeta('spellcheck-update', true));
        return true;
      },
      clearSpellcheckErrors: () => ({ editor }) => {
        console.log('Clearing spellcheck errors');
        this.storage.errors = [];
        editor.view.dispatch(editor.state.tr.setMeta('spellcheck-update', true));
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const { spellcheckClass } = this.options;
    const storage = this.storage;

    return [
      new Plugin({
        key: new PluginKey('spellcheck'),

        // Function to update the decorations based on errors
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldDecorations) {
            // DISABLED: Spellchecking is currently disabled
            return DecorationSet.empty;

            /* Original implementation below for future reference
            // Skip if it's not a spellcheck update
            if (!tr.getMeta('spellcheck-update')) {
              return oldDecorations.map(tr.mapping, tr.doc);
            }

            // Create decorations for each error
            const decorations: Decoration[] = [];
            const errors = storage.errors;

            console.log(`Creating decorations for ${errors.length} errors`);

            if (errors.length === 0) {
              return DecorationSet.empty;
            }

            const doc = tr.doc;

            // Build a map of text nodes and their positions for easier searching
            const textNodes: { node: ProsemirrorNode, pos: number, text: string }[] = [];
            doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                textNodes.push({
                  node,
                  pos,
                  text: node.text
                });
              }
              return true;
            });

            // Get the entire document as plain text for context
            const plainText = doc.textContent;
            console.log('Document text for searching:', plainText.substring(0, 200) + '...');

            // Attempt to find each error in the document and create decorations
            for (const error of errors) {
              try {
                const errorText = error.token;
                console.log('Looking for error text in document:', {
                  errorText,
                  errorOffset: error.offset,
                  errorType: error.type
                });

                // Try different approaches to find the text in the document
                let foundDecoration = false;

                // 1. Direct exact match in a text node
                if (!foundDecoration) {
                  for (const { pos, text } of textNodes) {
                    const normalizedNodeText = normalizeWhitespace(text);
                    const normalizedErrorText = normalizeWhitespace(errorText);

                    // Try exact match first
                    const exactIndex = text.indexOf(errorText);
                    if (exactIndex >= 0) {
                      console.log(`Found exact match for "${errorText}" at position ${pos + exactIndex}`);
                      const from = pos + exactIndex;
                      const to = from + errorText.length;
                      decorations.push(
                        Decoration.inline(from, to, {
                          class: spellcheckClass,
                          'data-spellcheck-error': JSON.stringify(error),
                        })
                      );
                      foundDecoration = true;
                      break;
                    }

                    // Try with normalized whitespace
                    const normIndex = normalizedNodeText.indexOf(normalizedErrorText);
                    if (normIndex >= 0) {
                      // For normalized matches, we need to find the actual offsets in the original text
                      let startPos = 0;
                      let count = 0;

                      // Count characters until we reach the normalized index
                      for (let i = 0; i < text.length; i++) {
                        if (count === normIndex) {
                          startPos = i;
                          break;
                        }
                        // Only increment counter for non-multiple whitespace
                        if (text[i] !== ' ' || (i > 0 && text[i - 1] !== ' ')) {
                          count++;
                        }
                      }

                      console.log(`Found normalized match for "${errorText}" at position ${pos + startPos}`);
                      const from = pos + startPos;
                      // Approximate the end position based on token length
                      const to = from + errorText.length;
                      decorations.push(
                        Decoration.inline(from, to, {
                          class: spellcheckClass,
                          'data-spellcheck-error': JSON.stringify(error),
                        })
                      );
                      foundDecoration = true;
                      break;
                    }
                  }
                }

                // 2. Try to find by words (for multi-word errors)
                if (!foundDecoration && errorText.includes(' ')) {
                  const words = errorText.split(/\s+/).filter((w: string) => w.length > 2);
                  if (words.length > 0) {
                    // Find the most distinctive word (longest)
                    const distinctiveWord = words.sort((a: string, b: string) => b.length - a.length)[0];

                    for (const { pos, text } of textNodes) {
                      const wordIndex = text.indexOf(distinctiveWord);
                      if (wordIndex >= 0) {
                        // Found a distinctive word, now try to expand to cover the full error
                        const maxLookBehind = 30;
                        const maxLookAhead = errorText.length + 20;

                        const startOffset = Math.max(0, wordIndex - maxLookBehind);
                        const endOffset = Math.min(text.length, wordIndex + maxLookAhead);

                        console.log(`Found word "${distinctiveWord}" within error phrase, highlighting broader area`);
                        const from = pos + startOffset;
                        const to = pos + endOffset;
                        decorations.push(
                          Decoration.inline(from, to, {
                            class: spellcheckClass,
                            'data-spellcheck-error': JSON.stringify(error),
                          })
                        );
                        foundDecoration = true;
                        break;
                      }
                    }
                  }
                }

                // 3. Word-by-word matching for errors not found as exact phrases
                if (!foundDecoration) {
                  const words = errorText.split(/\s+/).filter((w: string) => w.length > 1);

                  // Try to find at least the individual error words
                  for (const word of words) {
                    let wordFound = false;

                    for (const { pos, text } of textNodes) {
                      const wordIndex = text.indexOf(word);
                      if (wordIndex >= 0) {
                        console.log(`Found individual word "${word}" from error phrase`);
                        const from = pos + wordIndex;
                        const to = from + word.length;
                        decorations.push(
                          Decoration.inline(from, to, {
                            class: spellcheckClass,
                            'data-spellcheck-error': JSON.stringify(error),
                          })
                        );
                        wordFound = true;
                        foundDecoration = true;
                        break;
                      }
                    }

                    if (wordFound) break; // Stop after highlighting one word
                  }
                }

                // 4. Last resort: create a small decoration at the beginning of the document
                if (!foundDecoration && textNodes.length > 0) {
                  console.log('Creating fallback decoration at document start');
                  const { pos, text } = textNodes[0];
                  const length = Math.min(text.length, 5);
                  decorations.push(
                    Decoration.inline(pos, pos + length, {
                      class: spellcheckClass,
                      'data-spellcheck-error': JSON.stringify(error),
                    })
                  );
                }
              } catch (e) {
                console.error('Error creating spellcheck decoration:', e);
              }
            }

            return DecorationSet.create(doc, decorations);
            */
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export default SpellcheckExtension; 