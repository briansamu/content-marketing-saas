import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Link as TiptapLink } from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEditorStore } from '../../../store/useEditorStore';
import { Card, CardContent, CardFooter, CardHeader } from '../../ui/card';
import { Input } from '../../ui/input';
import { Sparkles, Eye, Type, FileText, BarChart, Wand2 } from 'lucide-react';
import EditorToolbar from '../EditorToolbar';
import '../editor.css';
import { useSpellcheck } from '../../../hooks/useSpellcheck';
import SpellcheckMenu from '../SpellcheckMenu';
import SpellcheckIndicator from '../SpellcheckIndicator';
import { SpellcheckExtension } from '../extensions/SpellcheckExtension';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "../../ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/tooltip";
import { Button } from '../../ui/button';

// Create an enhanced Link extension that properly handles exiting links
const CustomLink = TiptapLink.extend({
  // Make links non-inclusive for better editing experience
  // This means new text typed at the end of a link won't inherit link formatting
  inclusive: false,

  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: false,
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        target: '_blank',
        class: 'text-primary underline',
      },
      protocols: ['http', 'https', 'mailto', 'tel'],
      // Ensure we don't auto-convert pasted text to links unless they match our validation
      autolink: false,
      validate: (href: string) => /^https?:\/\/|^mailto:|^tel:|^#/.test(href),
      linkOnPaste: true,
    };
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Space: () => {
        // We run our own space handler to ensure spaces after links don't inherit link formatting
        const { editor } = this;
        const { state } = editor;

        // Check if we're at the end of a link mark
        if (editor.isActive('link')) {
          // Insert a space without link formatting
          const { tr } = state;
          tr.insertText(' ');

          // Get all marks at the current position
          const currentMarks = state.selection.$from.marks();

          // Filter out link mark but keep other marks
          const marksWithoutLink = currentMarks.filter(mark => mark.type.name !== 'link');

          // Apply remaining marks to the space
          if (marksWithoutLink.length > 0) {
            tr.ensureMarks(marksWithoutLink);
          }

          // Dispatch the transaction
          editor.view.dispatch(tr);

          return true;
        }

        return false;
      },
    };
  },

  // Add classes for focused links to improve UX
  addProseMirrorPlugins() {
    const plugins = this.parent?.() || [];
    return plugins;
  },
});

export function ArticleEditor({ targetKeyword }: { targetKeyword?: string }) {
  const {
    currentDraft,
    isSaving,
    isDirty,
    isAnalyzing,
    contentRewrites,
    updateContent,
    updateTitle,
    saveDraft,
    analyzeKeyword,
    optimizeContent,
    clearContentRewrites,
    applyRewriteSuggestion,
  } = useEditorStore();
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [editorHeight, setEditorHeight] = useState<string>('400px');
  const [isMobile, setIsMobile] = useState(false);
  const [showRewriteDialog, setShowRewriteDialog] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Check if mobile
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkScreenSize();

    // Add event listener for resize
    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  // Initialize the editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // StarterKit doesn't have a link option to disable in its type definitions
        // but it works at runtime - this removes TS error
        // @ts-expect-error link option exists at runtime but not in types
        link: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing your article here...',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CustomLink, // Use our enhanced link extension
      SpellcheckExtension, // Add spellcheck extension
      Underline, // Add underline extension
    ],
    content: currentDraft.content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      updateContent(html);

      // Reset autosave timer on each content update
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }

      // Set new autosave timer - save after 3 seconds of inactivity
      const timer = setTimeout(() => {
        handleSave();
      }, 3000);

      setAutoSaveTimer(timer);

      // Reset spellcheck timer on content change
      // This automatically triggers the spellcheck after typing pause
      checkSpelling();
    },
    onSelectionUpdate: ({ editor }) => {
      // Update link focus styles when selection changes
      const links = document.querySelectorAll('.ProseMirror a');
      links.forEach(link => {
        try {
          const pos = editor.view.posAtDOM(link, 0);
          if (pos >= editor.state.selection.from &&
            pos <= editor.state.selection.to) {
            link.classList.add('has-focus');
          } else {
            link.classList.remove('has-focus');
          }
        } catch {
          // Ignore DOM position errors
        }
      });
    },
    onBlur: () => {
      // Force spellcheck on editor blur
      checkSpelling(true);
    },
  });

  // Initialize spellcheck hook
  const {
    isChecking,
    errors,
    ignoredErrors,
    checkSpelling,
    applySuggestion,
    addToIgnored,
    removeFromIgnored,
    clearAllIgnored
  } = useSpellcheck(editor);

  // Update editor content when currentDraft changes
  useEffect(() => {
    if (editor && editor.getHTML() !== currentDraft.content) {
      editor.commands.setContent(currentDraft.content);
    }
  }, [editor, currentDraft.id, currentDraft.content]);

  // Update spellcheck errors when they change
  useEffect(() => {
    if (editor && errors.length > 0) {
      editor.commands.setSpellcheckErrors(errors);
    } else if (editor) {
      editor.commands.clearSpellcheckErrors();
    }
  }, [editor, errors]);

  // Calculate and update the editor height
  useEffect(() => {
    const calculateHeight = () => {
      if (!cardRef.current || !editorContainerRef.current) return;

      // Get the height of other elements within the card
      const headerHeight = headerRef.current?.offsetHeight || 0;
      const toolbarHeight = toolbarRef.current?.offsetHeight || 0;
      const footerHeight = footerRef.current?.offsetHeight || 0;

      // Calculate proper height based on window height
      const cardRect = cardRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const layoutOffset = 35;
      const contentPadding = 32;
      const editorPadding = 32;
      const buffer = 0;

      const availableHeight = viewportHeight - (layoutOffset + cardRect.top + headerHeight + toolbarHeight + footerHeight + contentPadding + editorPadding + buffer);
      const minHeight = 350;
      const height = Math.max(availableHeight, minHeight);

      setEditorHeight(`${height}px`);
    };

    calculateHeight();

    const resizeObserver = new ResizeObserver(calculateHeight);
    if (cardRef.current) {
      resizeObserver.observe(cardRef.current);
    }

    window.addEventListener('resize', calculateHeight);

    return () => {
      window.removeEventListener('resize', calculateHeight);
      resizeObserver.disconnect();
    };
  }, []);

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateTitle(e.target.value);
  };

  const handleSave = () => {
    if (isDirty) {
      saveDraft();
    }
  };

  const handleGenerateTextSummary = async () => {
    if (!editor) return;

    const text = editor.getText();

    if (!text || text.trim().length === 0) {
      return;
    }

    if (!targetKeyword || !targetKeyword.trim()) {
      useEditorStore.setState({
        error: 'A target keyword is required for content analysis.'
      });
      return;
    }

    await analyzeKeyword(text, targetKeyword);
  };

  const handleOptimizeContent = async () => {
    if (!editor || !targetKeyword) return;

    // If we already have results, just show the dialog without making API calls again
    if (contentRewrites.suggestions.length > 0 && !contentRewrites.isLoading) {
      setShowRewriteDialog(true);
      return;
    }

    const content = editor.getHTML();

    if (!content || !content.trim()) {
      return;
    }

    // Clear any existing results
    clearContentRewrites();

    // Open the dialog to show progress and results
    setShowRewriteDialog(true);

    // Call the unified optimization API
    await optimizeContent(content, targetKeyword);
  };

  const openPreview = () => {
    console.log('Opening preview for article');
  };

  const optimizeForKeyword = () => {
    if (!targetKeyword) return;
    console.log('Optimizing for keyword:', targetKeyword);
  };

  const handleDiscardChanges = () => {
    setIsConfirmationOpen(false);
    console.log('Discarding changes');
  };

  return (
    <Card ref={cardRef} className="w-full xs:max-w-2xl 2xl:max-w-full mx-auto border shadow-sm gap-0">
      <CardHeader ref={headerRef} className="space-y-1 px-4 pb-2 gap-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-lg">
            {currentDraft.contentType === 'blog' ? (
              <Type className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span className="text-sm text-muted-foreground">
              {currentDraft.contentType === 'blog' ? 'Blog Post' : 'Article'}
            </span>
          </div>
          <Input
            placeholder="Title..."
            value={currentDraft.title}
            onChange={handleTitleChange}
            className="text-xl font-semibold border-none focus-visible:ring-0 px-3 flex-1"
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 pb-2">
        <div ref={toolbarRef} className="flex flex-col">
          <EditorToolbar
            editor={editor}
            onSave={isMobile ? undefined : handleSave}
            isSaving={isSaving}
            isDirty={isDirty}
            isChecking={isChecking}
            ignoredErrors={ignoredErrors}
            onRemoveIgnoredError={removeFromIgnored}
            onClearAllIgnored={clearAllIgnored}
          />
          <div className="flex justify-end mt-1 gap-2">
            {targetKeyword && (
              <>
                <Button
                  onClick={handleOptimizeContent}
                  disabled={(isAnalyzing || contentRewrites.isLoading) || !editor?.getText().trim()}
                  size="sm"
                  variant="default"
                  className="text-xs py-0 h-7 gap-1"
                >
                  {isAnalyzing || contentRewrites.isLoading ? (
                    <>Optimizing Content...</>
                  ) : contentRewrites.suggestions.length > 0 ? (
                    <>
                      <Sparkles size={14} />
                      View Optimization Results
                    </>
                  ) : (
                    <>
                      <Wand2 size={14} />
                      Optimize for "{targetKeyword}"
                    </>
                  )}
                </Button>
              </>
            )}
            <Button
              onClick={handleGenerateTextSummary}
              disabled={isAnalyzing || !editor?.getText().trim()}
              size="sm"
              variant="outline"
              className="text-xs py-0 h-7 gap-1"
            >
              {isAnalyzing ? (
                <>Analyzing...</>
              ) : (
                <>
                  <BarChart size={14} />
                  Analyze Text
                </>
              )}
            </Button>
          </div>
        </div>
        <div
          ref={editorContainerRef}
          className="relative overflow-auto border rounded-md p-4 prose prose-sm max-w-none focus-within:outline-none focus-within:ring-1 focus-within:ring-ring border-input"
          style={{ height: editorHeight }}
        >
          {editor && <EditorContent editor={editor} />}
          {!editor && <p className="text-muted-foreground">Loading editor...</p>}

          {errors.length > 0 && editor && (
            <SpellcheckMenu
              editor={editor}
              onApplySuggestion={applySuggestion}
              onIgnoreError={addToIgnored}
            />
          )}

          <div className="absolute bottom-2 right-2">
            <SpellcheckIndicator isChecking={isChecking} />
          </div>
        </div>
      </CardContent>
      <CardFooter ref={footerRef} className="flex justify-between pt-2 px-4 pb-3">
        <div className="text-xs text-muted-foreground">
          {currentDraft.wordCount} words
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isConfirmationOpen} onOpenChange={setIsConfirmationOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Unsaved Changes</DialogTitle>
                <DialogDescription>
                  You have unsaved changes. Do you want to save them before proceeding?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={handleDiscardChanges}>
                  Discard
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={() => openPreview()}>
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => optimizeForKeyword()}
                disabled={!targetKeyword}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                AI Optimize
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>AI optimize content for keyword</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardFooter>

      <Dialog open={showRewriteDialog} onOpenChange={setShowRewriteDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Content Optimization</DialogTitle>
            <DialogDescription>
              {contentRewrites.isLoading ?
                'Analyzing and optimizing your content...' :
                'Review AI suggestions to improve your content.'}
            </DialogDescription>
          </DialogHeader>

          {contentRewrites.isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-sm text-muted-foreground">This may take a moment...</p>
            </div>
          ) : (
            <>
              <div className="max-h-[50vh] overflow-y-auto border rounded-md p-4">
                {contentRewrites.suggestions.length > 0 ? (
                  <ul className="space-y-4">
                    {contentRewrites.suggestions.map((suggestion, index) => (
                      <li key={index} className="border-b pb-3 last:border-b-0">
                        <div className="mb-1 text-muted-foreground text-xs">Original:</div>
                        <div className="bg-muted/30 p-2 rounded-md mb-2 text-sm">{suggestion.original}</div>
                        <div className="mb-1 text-muted-foreground text-xs">Suggestion:</div>
                        <div className="bg-primary/10 p-2 rounded-md text-sm font-medium">{suggestion.improved}</div>
                        {suggestion.explanation && (
                          <>
                            <div className="mb-1 mt-2 text-muted-foreground text-xs">Why this helps:</div>
                            <div className="text-sm text-muted-foreground italic">{suggestion.explanation}</div>
                          </>
                        )}
                        <Button
                          className="mt-2"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            applyRewriteSuggestion(suggestion.original, suggestion.improved);
                            console.log(`Applied suggestion ${index}`);
                          }}
                        >
                          Apply This Change
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    No optimization suggestions available.
                  </div>
                )}
              </div>

              <DialogFooter className="mt-4">
                <Button variant="secondary" onClick={() => setShowRewriteDialog(false)}>
                  Close
                </Button>
                {contentRewrites.suggestions.length > 0 && (
                  <Button onClick={() => setShowRewriteDialog(false)}>
                    Done
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ArticleEditor; 