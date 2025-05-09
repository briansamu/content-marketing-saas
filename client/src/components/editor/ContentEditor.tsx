import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateContent, updateTitle, saveDraft } from '../../store/slices/editorSlice';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Save, AlertCircle } from 'lucide-react';
import EditorToolbar from './EditorToolbar';
import { formatDateString, calculateReadingTime } from '../../lib/utils';
import './editor.css';

export function ContentEditor() {
  const dispatch = useAppDispatch();
  const { currentDraft, isSaving, error, isDirty } = useAppSelector((state) => state.editor);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Initialize the editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your content here...',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
    ],
    content: currentDraft.content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      dispatch(updateContent(html));

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

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateTitle(e.target.value));
  };

  const handleSave = () => {
    if (isDirty) {
      dispatch(saveDraft(currentDraft));
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto border shadow-sm">
      <CardHeader className="space-y-1 p-4 pb-0">
        <Input
          placeholder="Enter title..."
          value={currentDraft.title}
          onChange={handleTitleChange}
          className="text-xl font-semibold border-none focus-visible:ring-0 px-0"
        />
      </CardHeader>
      <CardContent className="p-4">
        <EditorToolbar editor={editor} />
        <div className="border rounded-md p-4 min-h-[400px]">
          <EditorContent editor={editor} className="prose dark:prose-invert max-w-none" />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between p-4 pt-0">
        <div className="text-sm text-muted-foreground">
          {currentDraft.wordCount} words • {calculateReadingTime(currentDraft.wordCount)}
          {currentDraft.lastSaved && (
            <> • Last saved: {formatDateString(currentDraft.lastSaved)}</>
          )}
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <div className="text-destructive flex items-center text-sm gap-1">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            size="sm"
            className="gap-1"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default ContentEditor; 