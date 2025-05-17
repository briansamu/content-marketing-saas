import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Link as TiptapLink } from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEditorStore } from '../../store/useEditorStore';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Input } from '../ui/input';
import { AlertCircle, Save, BarChart, Sparkles, Check, X, Wand2 } from 'lucide-react';
import EditorToolbar from './EditorToolbar';
import { formatDateString, calculateReadingTime } from '../../lib/utils';
import { Button } from '../ui/button';
import './editor.css';
import { useSpellcheck } from '../../hooks/useSpellcheck';
import SpellcheckMenu from './SpellcheckMenu';
import SpellcheckIndicator from './SpellcheckIndicator';
import { SpellcheckExtension } from './extensions/SpellcheckExtension';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";

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

export function ContentEditor({ targetKeyword }: { targetKeyword?: string }) {
  const {
    currentDraft,
    isSaving,
    error,
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
    applyMultipleRewriteSuggestions
  } = useEditorStore();
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [editorHeight, setEditorHeight] = useState<string>('400px');
  const [isMobile, setIsMobile] = useState(false);
  const [showRewriteDialog, setShowRewriteDialog] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState<string>('');
  const [showAllSuggestions, setShowAllSuggestions] = useState<boolean>(true);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
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
        placeholder: 'Start writing your content here...',
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
      console.log('Applying spellcheck errors to editor:', errors);
      editor.commands.setSpellcheckErrors(errors);
    } else if (editor) {
      console.log('Clearing spellcheck errors');
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

      // Get padding of content area
      const contentPadding = 32; // 16px top + 16px bottom (p-4)

      // Get the padding of the editor container itself
      const editorPadding = 32; // 16px top + 16px bottom (p-4)

      // Get the card's position relative to the viewport
      const cardRect = cardRef.current.getBoundingClientRect();

      // Calculate maximum available height for the viewport
      const viewportHeight = window.innerHeight;

      // Extra offset to account for app layout elements (breadcrumbs, header, etc.)
      const layoutOffset = 35;

      // Add a buffer to prevent scrollbars (70px)
      const buffer = 0;

      // Calculate the available height for the editor
      // viewportHeight - (layoutOffset + cardRect.top + all card elements + padding + buffer)
      const availableHeight = viewportHeight - (layoutOffset + cardRect.top + headerHeight + toolbarHeight + footerHeight + contentPadding + editorPadding + buffer);

      // Set a minimum reasonable height
      const minHeight = 350;
      const height = Math.max(availableHeight, minHeight);

      setEditorHeight(`${height}px`);
    };

    // Initial calculation
    calculateHeight();

    // Use ResizeObserver to watch for changes in the card size
    const resizeObserver = new ResizeObserver(calculateHeight);
    if (cardRef.current) {
      resizeObserver.observe(cardRef.current);
    }

    // Also watch for window resize events
    window.addEventListener('resize', calculateHeight);

    return () => {
      window.removeEventListener('resize', calculateHeight);
      resizeObserver.disconnect();
    };
  }, []);

  // Recalculate height when elements are fully rendered
  useEffect(() => {
    // Wait for a short time to ensure all refs are populated
    const timer = setTimeout(() => {
      const calculateHeight = () => {
        if (!cardRef.current || !editorContainerRef.current) return;

        // Get the height of other elements within the card
        const headerHeight = headerRef.current?.offsetHeight || 0;
        const toolbarHeight = toolbarRef.current?.offsetHeight || 0;
        const footerHeight = footerRef.current?.offsetHeight || 0;

        // Get padding of content area
        const contentPadding = 32; // 16px top + 16px bottom (p-4)

        // Get the padding of the editor container itself
        const editorPadding = 32; // 16px top + 16px bottom (p-4)

        // Get the card's position relative to the viewport
        const cardRect = cardRef.current.getBoundingClientRect();

        // Calculate maximum available height for the viewport
        const viewportHeight = window.innerHeight;

        // Extra offset to account for app layout elements (breadcrumbs, header, etc.)
        const layoutOffset = 35;

        // Add a buffer to prevent scrollbars (70px)
        const buffer = 0;

        // Calculate the available height for the editor
        // viewportHeight - (layoutOffset + cardRect.top + all card elements + padding + buffer)
        const availableHeight = viewportHeight - (layoutOffset + cardRect.top + headerHeight + toolbarHeight + footerHeight + contentPadding + editorPadding + buffer);

        // Set a minimum reasonable height
        const minHeight = 350;
        const height = Math.max(availableHeight, minHeight);

        setEditorHeight(`${height}px`);
      };

      calculateHeight();
    }, 100);

    return () => clearTimeout(timer);
  }, [editor]);

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

  // Manual spellcheck trigger
  const handleManualSpellcheck = () => {
    checkSpelling(true);
  };

  // Function to generate text summary
  const handleGenerateTextSummary = async () => {
    if (!editor) return;

    // Get plain text from editor
    const text = editor.getText();

    if (!text || text.trim().length === 0) {
      console.warn('No text to analyze');
      return;
    }

    // Require a target keyword for any analysis
    if (!targetKeyword || !targetKeyword.trim()) {
      // Show an error using the existing error state
      useEditorStore.setState({
        error: 'A target keyword is required for content analysis.'
      });
      return;
    }

    // Now that we have a target keyword, analyze with it
    console.log(`Using target keyword: "${targetKeyword}"`);
    await analyzeKeyword(text, targetKeyword);
  };

  // New function to handle the unified content optimization flow
  const handleOptimizeContent = async () => {
    if (!editor || !targetKeyword) return;

    // If we already have results, just show the dialog without making API calls again
    if (contentRewrites.suggestions.length > 0 && !contentRewrites.isLoading) {
      setShowRewriteDialog(true);
      return;
    }

    const content = editor.getHTML();

    if (!content || !content.trim()) {
      console.warn('No content to optimize');
      return;
    }

    // Clear any existing results
    clearContentRewrites();

    // Open the dialog to show progress and results
    setShowRewriteDialog(true);

    // Call the unified optimization API
    await optimizeContent(content, targetKeyword);
  };

  // Function to apply a rewrite suggestion
  const handleApplySuggestion = (original: string, improved: string) => {
    applyRewriteSuggestion(original, improved);
    // No need to close the dialog, as the user might want to apply multiple suggestions
  };

  // Function to toggle selection of a suggestion
  const toggleSuggestionSelection = (index: number) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Function to apply all selected suggestions
  const applySelectedSuggestions = () => {
    // Get all selected suggestions
    const suggestionsToApply = Array.from(selectedSuggestions)
      .map(index => contentRewrites.suggestions[index])
      .filter(Boolean)
      .map(suggestion => ({
        original: suggestion.original,
        improved: suggestion.improved
      }));

    if (suggestionsToApply.length > 0) {
      // Use the batch method for better performance
      applyMultipleRewriteSuggestions(suggestionsToApply);

      // Clear selections after applying
      setSelectedSuggestions(new Set());
    }
  };

  // Filter suggestions based on the filter text
  const filteredSuggestions = useMemo(() => {
    if (!suggestionFilter.trim()) {
      // If no filter, use either all suggestions or just the first 5 depending on showAllSuggestions
      return showAllSuggestions
        ? contentRewrites.suggestions
        : contentRewrites.suggestions.slice(0, 5);
    }

    const lowerFilter = suggestionFilter.toLowerCase();

    return contentRewrites.suggestions.filter(suggestion =>
      suggestion.original.toLowerCase().includes(lowerFilter) ||
      suggestion.improved.toLowerCase().includes(lowerFilter) ||
      suggestion.explanation.toLowerCase().includes(lowerFilter)
    );
  }, [contentRewrites.suggestions, suggestionFilter, showAllSuggestions]);

  return (
    <Card ref={cardRef} className="w-full xs:max-w-2xl 2xl:max-w-full mx-auto border shadow-sm gap-0">
      <CardHeader ref={headerRef} className="space-y-1 px-4 pb-2 gap-0">
        <Input
          placeholder="Enter title..."
          value={currentDraft.title}
          onChange={handleTitleChange}
          className="text-xl font-semibold border-none focus-visible:ring-0 px-3"
        />
      </CardHeader>
      <CardContent className="p-4 pt-0 pb-2">
        <div ref={toolbarRef} className="flex flex-col">
          <EditorToolbar
            editor={editor}
            onSave={isMobile ? undefined : handleSave}
            isSaving={isSaving}
            isDirty={isDirty}
            onSpellcheck={handleManualSpellcheck}
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
          className="border rounded-md p-4 overflow-y-auto relative"
          style={{ height: editorHeight }}
        >
          <EditorContent editor={editor} className="prose dark:prose-invert max-w-none" />
          <SpellcheckIndicator isChecking={isChecking} />
          {editor && (
            <SpellcheckMenu
              editor={editor}
              onApplySuggestion={applySuggestion}
              onIgnoreError={addToIgnored}
            />
          )}
        </div>
      </CardContent>
      <CardFooter ref={footerRef} className="flex justify-between p-4 pt-0">
        <div className="text-sm text-muted-foreground">
          {currentDraft.wordCount} words • {calculateReadingTime(currentDraft.wordCount)}
          {currentDraft.lastSaved && (
            <> • Last saved: {formatDateString(currentDraft.lastSaved)}</>
          )}
          {ignoredErrors.length > 0 && (
            <> • {ignoredErrors.length} ignored spelling/grammar issues</>
          )}
        </div>
        {error && (
          <div className="text-destructive flex items-center text-sm gap-1">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </CardFooter>

      {/* Floating save button for mobile */}
      {isMobile && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            size="sm"
            className="shadow-lg rounded-full h-12 w-12 p-0"
          >
            <Save size={18} />
          </Button>
        </div>
      )}

      {/* Content rewrite suggestions dialog */}
      <Dialog open={showRewriteDialog} onOpenChange={setShowRewriteDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              Content Optimization Suggestions for "{targetKeyword}"
            </DialogTitle>
            <DialogDescription>
              These suggestions help optimize your content for the target keyword.
              Click the apply button to replace the original text with the improved version.
            </DialogDescription>
          </DialogHeader>

          {contentRewrites.isLoading ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <div className="flex flex-col items-center gap-2">
                <Sparkles size={24} className="animate-pulse text-primary" />
                <p className="text-sm font-medium">Optimizing your content...</p>
              </div>

              <div className="w-full max-w-md space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Analyzing content</span>
                    <span>{isAnalyzing ? "In progress..." : "Complete ✓"}</span>
                  </div>
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-primary transition-all ${isAnalyzing ? "w-1/2" : "w-full"}`}
                    ></div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Generating suggestions</span>
                    <span>{isAnalyzing ? "Waiting..." : contentRewrites.isLoading ? "In progress..." : "Complete ✓"}</span>
                  </div>
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-primary transition-all ${isAnalyzing ? "w-0" :
                        contentRewrites.isLoading ? "w-1/2" :
                          "w-full"
                        }`}
                    ></div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                This may take a moment as we analyze your content and generate tailored suggestions for "{targetKeyword}"
              </p>
            </div>
          ) : contentRewrites.suggestions.length > 0 ? (
            <div className="space-y-6 pt-2">
              {/* SEO Insights Used (if available) */}
              {contentRewrites.insights && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm">
                  <h4 className="font-medium mb-2 flex items-center gap-1.5">
                    <BarChart size={14} className="text-primary" />
                    Content Insights Used:
                  </h4>
                  <div className="space-y-1 text-muted-foreground">
                    {contentRewrites.insights.readabilityLevel && (
                      <p>• Current readability level: <span className="font-medium">{contentRewrites.insights.readabilityLevel}</span></p>
                    )}

                    {contentRewrites.insights?.analyzedKeywords && contentRewrites.insights.analyzedKeywords.length > 0 && (
                      <p>• Main topics detected: <span className="font-medium">{contentRewrites.insights.analyzedKeywords.join(', ')}</span></p>
                    )}

                    {contentRewrites.insights?.relatedKeywords && contentRewrites.insights.relatedKeywords.length > 0 && (
                      <p>• Related keywords: <span className="font-medium">{contentRewrites.insights.relatedKeywords.join(', ')}</span></p>
                    )}
                  </div>
                </div>
              )}

              {/* Search and filter for suggestions */}
              {contentRewrites.suggestions.length > 5 && (
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search suggestions..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={suggestionFilter}
                    onChange={(e) => setSuggestionFilter(e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground mt-1 px-1 flex justify-between">
                    <span>
                      {filteredSuggestions.length} of {contentRewrites.suggestions.length} suggestions shown
                    </span>
                    <button
                      className="text-primary hover:underline"
                      onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                    >
                      {showAllSuggestions ? "Show important only" : "Show all"}
                    </button>
                  </div>
                </div>
              )}

              {/* Apply selected suggestions button */}
              {selectedSuggestions.size > 0 && (
                <div className="bg-primary/10 p-3 rounded-md flex items-center justify-between">
                  <span className="text-sm">
                    {selectedSuggestions.size} suggestion{selectedSuggestions.size !== 1 ? 's' : ''} selected
                  </span>
                  <Button
                    size="sm"
                    onClick={applySelectedSuggestions}
                    className="gap-1"
                  >
                    <Check size={14} />
                    Apply Selected ({selectedSuggestions.size})
                  </Button>
                </div>
              )}

              {/* Suggestion list */}
              <div className="space-y-6 divide-y">
                {filteredSuggestions.map((suggestion, index) => {
                  const suggestionIndex = contentRewrites.suggestions.indexOf(suggestion);
                  const isSelected = selectedSuggestions.has(suggestionIndex);

                  return (
                    <div
                      key={index}
                      className={`bg-muted/50 rounded-lg p-4 space-y-3 pt-6 ${isSelected ? 'ring-1 ring-primary' : ''}`}
                    >
                      <div className="absolute -mt-6 ml-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSuggestionSelection(suggestionIndex)}
                          className="rounded border-primary text-primary"
                        />
                        <div className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-md">
                          Suggestion {suggestionIndex + 1} of {contentRewrites.suggestions.length}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Original:</h4>
                        <div className="bg-background p-3 rounded border text-sm suggestion-preview"
                          dangerouslySetInnerHTML={{ __html: suggestion.original }} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <h4 className="text-sm font-medium text-primary">Improved:</h4>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 text-xs"
                                onClick={() => handleApplySuggestion(suggestion.original, suggestion.improved)}
                              >
                                <Check size={14} />
                                Apply
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Apply this suggestion to your content</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="bg-primary/10 border-primary/20 border p-3 rounded text-sm suggestion-preview"
                          dangerouslySetInnerHTML={{ __html: suggestion.improved }} />
                      </div>

                      {suggestion.explanation && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">Why this helps:</h4>
                          <p className="text-xs text-muted-foreground p-2">{suggestion.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : contentRewrites.rawSuggestions ? (
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">We couldn't parse the suggestions into a structured format, but here's the raw suggestion:</p>
              <div className="bg-muted/50 p-4 rounded text-sm whitespace-pre-wrap">{contentRewrites.rawSuggestions}</div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No suggestions available. Try with different content or keywords.</p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRewriteDialog(false)}
              className="gap-1"
            >
              <X size={16} />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ContentEditor; 