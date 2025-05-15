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
  Underline,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link,
  Code,
  Quote,
  Strikethrough,
  RemoveFormatting,
  TextIcon,
  ListFilter,
  AlignHorizontalDistributeCenter,
  History
} from 'lucide-react';
import { Separator } from '../ui/separator';
import EditorToolbarButton from './EditorToolbarButton';
import { cn } from '../../lib/utils';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import LinkDialog from './LinkDialog';

interface EditorToolbarProps {
  editor: Editor | null;
  className?: string;
  onSave?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
}

type TabType = 'text' | 'heading' | 'lists' | 'align' | 'other';

export function EditorToolbar({ editor, className, onSave, isSaving, isDirty }: EditorToolbarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

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

  if (!editor) {
    return null;
  }

  // Text formatting controls
  const textControls = (
    <div className="flex gap-1 flex-wrap">
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
      <EditorToolbarButton
        icon={<Underline size={18} />}
        label="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
      />
      <EditorToolbarButton
        icon={<Strikethrough size={18} />}
        label="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
      />
      <EditorToolbarButton
        icon={<Code size={18} />}
        label="Code"
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
      />
      <EditorToolbarButton
        icon={<RemoveFormatting size={18} />}
        label="Clear Formatting"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      />
    </div>
  );

  // Paragraph controls
  const paragraphControls = (
    <div className="flex gap-1 flex-wrap">
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
      <EditorToolbarButton
        icon={<Quote size={18} />}
        label="Blockquote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
      />
    </div>
  );

  // List controls
  const listControls = (
    <div className="flex gap-1 flex-wrap">
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
    </div>
  );

  // Alignment controls
  const alignmentControls = (
    <div className="flex gap-1 flex-wrap">
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
    </div>
  );

  // Other tools
  const otherControls = (
    <div className="flex gap-1 flex-wrap">
      <EditorToolbarButton
        icon={
          <div className="relative">
            <Link size={18} />
            {editor.isActive('link') && (
              <span className="absolute -top-1 -right-1 bg-primary w-2 h-2 rounded-full" />
            )}
          </div>
        }
        label="Add Link"
        onClick={() => setIsLinkDialogOpen(true)}
        isActive={editor.isActive('link')}
      />
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

  // Full toolbar for desktop
  const desktopToolbar = (
    <div className="grid grid-cols-1 gap-0 py-1 px-1">
      <div className="flex flex-wrap items-center justify-between w-full">
        <div className="flex flex-wrap gap-1 items-center">
          {textControls}
        </div>

        {onSave && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 shrink-0 ml-1 mr-0"
            onClick={onSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      <Separator className="my-1" />

      <div className="flex flex-wrap gap-1">
        {paragraphControls}
        <Separator orientation="vertical" className="mx-1 h-6 hidden xs:block" />
        {listControls}
        <Separator orientation="vertical" className="mx-1 h-6 hidden xs:block" />
        {alignmentControls}
        <Separator orientation="vertical" className="mx-1 h-6 hidden xs:block" />
        {otherControls}
      </div>
    </div>
  );

  // Get the content for the current tab
  const getTabContent = () => {
    switch (activeTab) {
      case 'text':
        return textControls;
      case 'heading':
        return paragraphControls;
      case 'lists':
        return listControls;
      case 'align':
        return alignmentControls;
      case 'other':
        return otherControls;
      default:
        return textControls;
    }
  };

  // Compact toolbar tabs
  const tabIcons = {
    text: <TextIcon size={16} />,
    heading: <Type size={16} />,
    lists: <ListFilter size={16} />,
    align: <AlignHorizontalDistributeCenter size={16} />,
    other: <History size={16} />
  };

  // Custom tabbed toolbar for mobile
  const mobileToolbar = (
    <div className="w-full flex flex-col">
      <div className="flex bg-background border-b">
        <div className="grid grid-cols-5 w-full">
          {(['text', 'heading', 'lists', 'align', 'other'] as const).map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              className={cn(
                "h-8 rounded-none px-1 py-0 relative",
                activeTab === tab
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              onClick={() => setActiveTab(tab)}
            >
              <div className="flex flex-col items-center justify-center">
                {tabIcons[tab]}
              </div>
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />
              )}
            </Button>
          ))}
        </div>
      </div>
      <div className="p-1 border-b flex justify-center">
        <div className="flex flex-wrap justify-center gap-1">
          {getTabContent()}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className={cn("border rounded-md bg-background mb-2 flex flex-col shadow-sm", className)}>
        <div className="flex flex-col w-full">
          {isMobile ? mobileToolbar : desktopToolbar}
        </div>
      </div>

      {editor && (
        <LinkDialog
          editor={editor}
          isOpen={isLinkDialogOpen}
          onClose={() => setIsLinkDialogOpen(false)}
        />
      )}
    </>
  );
}

export default EditorToolbar; 