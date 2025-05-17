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
import { Sparkles, Eye, Share, MessageSquare, Type, Video, FileText, BarChart, Wand2 } from 'lucide-react';
import EditorToolbar from './EditorToolbar';
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
} from "../ui/dialog";
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
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showSpellcheckSettings, setShowSpellcheckSettings] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

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
        placeholder: getPlaceholderForContentType(currentDraft.contentType),
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
    // DISABLED: Spellchecking is currently disabled
    // checkSpelling(true);
    console.log('Spellchecking is currently disabled');
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

  // Get the appropriate placeholder for the content type
  function getPlaceholderForContentType(contentType: string): string {
    switch (contentType) {
      case 'social':
        return 'Write your social media post here...';
      case 'blog':
        return 'Start writing your blog post here...';
      case 'video':
        return 'Write your video script here...';
      default:
        return 'Start writing your content here...';
    }
  }

  // Get the appropriate character limit for the content type
  function getCharacterLimitForContentType(contentType: string): number | null {
    switch (contentType) {
      case 'social':
        return 280; // Twitter character limit
      default:
        return null; // No limit for other content types
    }
  }

  // Check if the content exceeds the character limit
  const characterLimit = getCharacterLimitForContentType(currentDraft.contentType);
  const currentCharacterCount = currentDraft.content
    ? currentDraft.content.replace(/<[^>]*>/g, '').length
    : 0;
  const isOverCharacterLimit = characterLimit ? currentCharacterCount > characterLimit : false;

  // Define functions for preview and social preview
  const openPreview = () => {
    // In a real implementation this would open a preview of the content
    console.log('Opening preview for', currentDraft.contentType);
    // Show a preview modal with rendered content
  };

  const openSocialPreview = () => {
    // In a real implementation this would show a social media post preview
    console.log('Opening social preview');
    // Show a social media preview with character count
  };

  const optimizeForKeyword = () => {
    // In a real implementation this would trigger AI optimization
    if (!targetKeyword) return;
    console.log('Optimizing for keyword:', targetKeyword);
    // Call the optimization function from the store
  };

  const handleDiscardChanges = () => {
    // In a real implementation, this would discard unsaved changes
    setIsConfirmationOpen(false);
    console.log('Discarding changes');
  };

  return (
    <Card ref={cardRef} className="w-full xs:max-w-2xl 2xl:max-w-full mx-auto border shadow-sm gap-0">
      <CardHeader ref={headerRef} className="space-y-1 px-4 pb-2 gap-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-lg">
            {getContentTypeIcon(currentDraft.contentType)}
            <span className="text-sm text-muted-foreground">{getContentTypeName(currentDraft.contentType)}</span>
          </div>
          <Input
            placeholder="Title..."
            value={currentDraft.title}
            onChange={handleTitleChange}
            className="text-xl font-semibold border-none focus-visible:ring-0 px-3 flex-1"
          />
        </div>
        {currentDraft.contentType === 'social' && (
          <div className={`text-xs text-right ${isOverCharacterLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
            {currentCharacterCount}/{characterLimit} characters
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0 pb-2">
        <div ref={toolbarRef} className="flex flex-col">
          <EditorToolbar
            editor={editor}
            onSave={isMobile ? undefined : handleSave}
            isSaving={isSaving}
            isDirty={isDirty}
            onSpellcheck={undefined}
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
          className={`relative overflow-auto border rounded-md p-4 prose prose-sm max-w-none focus-within:outline-none focus-within:ring-1 focus-within:ring-ring ${isOverCharacterLimit ? 'border-red-500' : 'border-input'}`}
          style={{ height: editorHeight }}
        >
          {editor && <EditorContent editor={editor} />}
          {!editor && <p className="text-muted-foreground">Loading editor...</p>}

          {errors.length > 0 && editor && (
            <SpellcheckMenu
              editor={editor}
              errors={errors}
              onApplySuggestion={applySuggestion}
              onAddToIgnored={addToIgnored}
            />
          )}

          <div className="absolute bottom-2 right-2">
            <SpellcheckIndicator isChecking={isChecking} errorCount={errors.length} />
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

          {(currentDraft.contentType === 'blog' || currentDraft.contentType === 'article') && (
            <Button variant="outline" size="sm" onClick={() => openPreview()}>
              <Eye className="h-4 w-4 mr-1" /> Preview
            </Button>
          )}

          {currentDraft.contentType === 'social' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openSocialPreview()}
              disabled={isOverCharacterLimit}
            >
              <Share className="h-4 w-4 mr-1" /> Preview Post
            </Button>
          )}

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
    </Card>
  );
}

// Helper functions to render content type information
function getContentTypeName(contentType: string): string {
  switch (contentType) {
    case 'social':
      return 'Social Post';
    case 'blog':
      return 'Blog Post';
    case 'video':
      return 'Video Script';
    case 'article':
      return 'Article';
    default:
      return 'Content';
  }
}

function getContentTypeIcon(contentType: string) {
  switch (contentType) {
    case 'social':
      return <MessageSquare className="h-4 w-4" />;
    case 'blog':
      return <Type className="h-4 w-4" />;
    case 'video':
      return <Video className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

export default ContentEditor; 