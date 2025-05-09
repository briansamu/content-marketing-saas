import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Undo,
  Redo,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link
} from 'lucide-react';
import { Separator } from '../ui/separator';
import EditorToolbarButton from './EditorToolbarButton';
import { cn } from '../../lib/utils';

interface EditorToolbarProps {
  editor: Editor | null;
  className?: string;
}

export function EditorToolbar({ editor, className }: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className={cn("flex items-center border border-input rounded-md bg-background p-1 mb-2", className)}>
      <EditorToolbarButton
        icon={<Bold size={18} />}
        label="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
      />
      <EditorToolbarButton
        icon={<Italic size={18} />}
        label="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <EditorToolbarButton
        icon={<Heading1 size={18} />}
        label="Heading 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
      />
      <EditorToolbarButton
        icon={<Heading2 size={18} />}
        label="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
      />
      <EditorToolbarButton
        icon={<Type size={18} />}
        label="Paragraph"
        onClick={() => editor.chain().focus().setParagraph().run()}
        isActive={editor.isActive('paragraph')}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <EditorToolbarButton
        icon={<List size={18} />}
        label="Bullet List"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
      />
      <EditorToolbarButton
        icon={<ListOrdered size={18} />}
        label="Ordered List"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <EditorToolbarButton
        icon={<AlignLeft size={18} />}
        label="Align Left"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive('textAlign', { align: 'left' })}
      />
      <EditorToolbarButton
        icon={<AlignCenter size={18} />}
        label="Align Center"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive('textAlign', { align: 'center' })}
      />
      <EditorToolbarButton
        icon={<AlignRight size={18} />}
        label="Align Right"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive('textAlign', { align: 'right' })}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <EditorToolbarButton
        icon={<Link size={18} />}
        label="Add Link"
        onClick={() => {
          const url = window.prompt('URL');
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        isActive={editor.isActive('link')}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <EditorToolbarButton
        icon={<Undo size={18} />}
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      />
      <EditorToolbarButton
        icon={<Redo size={18} />}
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      />
    </div>
  );
}

export default EditorToolbar; 