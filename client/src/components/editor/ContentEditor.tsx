import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Link as TiptapLink } from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEditorStore } from '../../store/useEditorStore';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Input } from '../ui/input';
import { AlertCircle, Save } from 'lucide-react';
import EditorToolbar from './EditorToolbar';
import { formatDateString, calculateReadingTime } from '../../lib/utils';
import { Button } from '../ui/button';
import './editor.css';
import { useSpellcheck } from '../../hooks/useSpellcheck';
import SpellcheckMenu from './SpellcheckMenu';
import SpellcheckIndicator from './SpellcheckIndicator';
import { SpellcheckExtension } from './extensions/SpellcheckExtension';

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

export function ContentEditor() {
  const { currentDraft, isSaving, error, isDirty, updateContent, updateTitle, saveDraft } = useEditorStore();
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [editorHeight, setEditorHeight] = useState<string>('400px');
  const [isMobile, setIsMobile] = useState(false);
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
    </Card>
  );
}

export default ContentEditor; 