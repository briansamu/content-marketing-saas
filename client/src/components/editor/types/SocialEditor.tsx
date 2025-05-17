import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEditorStore } from '../../../store/useEditorStore';
import { Card, CardContent, CardFooter, CardHeader } from '../../ui/card';
import { Input } from '../../ui/input';
import { Sparkles, Share, MessageSquare } from 'lucide-react';
import { Button } from '../../ui/button';
import '../editor.css';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "../../ui/dialog";

// Simple toolbar for social editor
interface SocialToolbarProps {
  editor: Editor | null;
}

const SocialToolbar = ({ editor }: SocialToolbarProps) => {
  if (!editor) return null;

  return (
    <div className="border rounded-md bg-background mb-2 flex flex-col shadow-sm">
      <div className="p-1 flex flex-wrap gap-1 justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
        >
          <span className="font-bold">B</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-muted' : ''}
        >
          <span className="italic">I</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          Undo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          Redo
        </Button>
      </div>
    </div>
  );
};

export function SocialEditor({ targetKeyword }: { targetKeyword?: string }) {
  const {
    currentDraft,
    isDirty,
    updateContent,
    updateTitle,
    saveDraft,
  } = useEditorStore();
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [editorHeight, setEditorHeight] = useState<string>('250px');
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Character limit for social posts
  const characterLimit = 280;

  // Calculate current character count
  const currentCharacterCount = currentDraft.content
    ? currentDraft.content.replace(/<[^>]*>/g, '').length
    : 0;

  const isOverCharacterLimit = currentCharacterCount > characterLimit;

  // Initialize the editor with simpler configuration
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable complex features for social posts
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: 'Write your social media post here...',
      }),
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
    },
  });

  // Update editor content when currentDraft changes
  useEffect(() => {
    if (editor && editor.getHTML() !== currentDraft.content) {
      editor.commands.setContent(currentDraft.content);
    }
  }, [editor, currentDraft.id, currentDraft.content]);

  // Calculate and update the editor height
  useEffect(() => {
    const calculateHeight = () => {
      if (!cardRef.current || !editorContainerRef.current) return;

      // Get the height of other elements within the card
      const headerHeight = headerRef.current?.offsetHeight || 0;
      const toolbarHeight = 48; // Approximate height for the toolbar
      const footerHeight = footerRef.current?.offsetHeight || 0;

      // Calculate proper height based on window height
      const cardRect = cardRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const layoutOffset = 35;
      const contentPadding = 32;
      const editorPadding = 32;
      const buffer = 0;

      const availableHeight = viewportHeight - (layoutOffset + cardRect.top + headerHeight + toolbarHeight + footerHeight + contentPadding + editorPadding + buffer);
      const minHeight = 150;
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

  const openSocialPreview = () => {
    console.log('Opening social preview');
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
    <Card ref={cardRef} className="w-full xs:max-w-xl mx-auto border shadow-sm gap-0">
      <CardHeader ref={headerRef} className="space-y-1 px-4 pb-2 gap-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-lg">
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm text-muted-foreground">Social Post</span>
          </div>
          <Input
            placeholder="Title..."
            value={currentDraft.title}
            onChange={handleTitleChange}
            className="text-xl font-semibold border-none focus-visible:ring-0 px-3 flex-1"
          />
        </div>
        <div className={`text-xs text-right ${isOverCharacterLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
          {currentCharacterCount}/{characterLimit} characters
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 pb-2">
        <SocialToolbar editor={editor} />
        <div
          ref={editorContainerRef}
          className={`relative overflow-auto border rounded-md p-4 prose prose-sm max-w-none focus-within:outline-none focus-within:ring-1 focus-within:ring-ring ${isOverCharacterLimit ? 'border-red-500' : 'border-input'}`}
          style={{ height: editorHeight }}
        >
          {editor && <EditorContent editor={editor} />}
          {!editor && <p className="text-muted-foreground">Loading editor...</p>}
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => openSocialPreview()}
            disabled={isOverCharacterLimit}
          >
            <Share className="h-4 w-4 mr-1" /> Preview Post
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
              <p>AI optimize for social media</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardFooter>
    </Card>
  );
}

export default SocialEditor; 