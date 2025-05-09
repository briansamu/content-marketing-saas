import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ExternalLink, Link2 } from 'lucide-react';
import { addLink } from './ContentEditor';

interface LinkDialogProps {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
}

export function LinkDialog({ editor, isOpen, onClose }: LinkDialogProps) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(true);

  // Initialize with selected text when opened
  React.useEffect(() => {
    if (isOpen && editor.isActive('link')) {
      // If a link is selected, get its attributes
      const attributes = editor.getAttributes('link');
      setUrl(attributes.href || '');
      setIsValidUrl(validateUrl(attributes.href || ''));
    } else if (isOpen) {
      // Get any selected text
      const selectedText = editor.state.doc.textBetween(
        editor.state.selection.from,
        editor.state.selection.to,
        ' '
      );
      setText(selectedText || '');
      setUrl('');
      setIsValidUrl(true);
    }
  }, [isOpen, editor]);

  const validateUrl = (value: string): boolean => {
    if (!value) return true; // Empty value doesn't show error

    // Add protocol if missing
    let urlToCheck = value;
    if (!/^https?:\/\//.test(value) &&
      !/^mailto:/.test(value) &&
      !/^tel:/.test(value) &&
      value !== '#') {
      urlToCheck = `https://${value}`;
    }

    try {
      new URL(urlToCheck);
      return true;
    } catch {
      return false;
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setIsValidUrl(validateUrl(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // If no URL is provided or invalid URL, do nothing
    if (!url.trim() || !isValidUrl) {
      if (!url.trim()) onClose();
      return;
    }

    // Add protocol if missing
    let finalUrl = url;
    if (!/^https?:\/\//.test(url) &&
      !/^mailto:/.test(url) &&
      !/^tel:/.test(url) &&
      url !== '#') {
      finalUrl = `https://${url}`;
    }

    // Use the dedicated addLink helper which handles all cases correctly
    addLink(editor, finalUrl, text.trim() || undefined);

    onClose();
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    onClose();
  };

  const openLink = () => {
    if (url && isValidUrl) {
      // Add protocol if missing
      let finalUrl = url;
      if (!/^https?:\/\//.test(url) &&
        !/^mailto:/.test(url) &&
        !/^tel:/.test(url) &&
        url !== '#') {
        finalUrl = `https://${url}`;
      }
      window.open(finalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-md px-6">
        <SheetHeader>
          <SheetTitle>Insert Link</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="url" className="flex items-center gap-1">
              <Link2 size={14} />
              URL
            </Label>
            <Input
              id="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://example.com"
              autoFocus
              className={!isValidUrl ? 'border-destructive' : ''}
            />
            {!isValidUrl && (
              <p className="text-sm text-destructive">
                Please enter a valid URL
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Tip: URLs without http:// or https:// will automatically have https:// added
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="text">Text (optional)</Label>
            <Input
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Link text"
            />
            <p className="text-sm text-muted-foreground">
              Leave empty to use the selected text or URL
            </p>
          </div>

          <SheetFooter className="pt-2">
            <div className="flex justify-between w-full flex-wrap gap-2">
              <div className="flex gap-2">
                {editor.isActive('link') && (
                  <>
                    <Button
                      variant="destructive"
                      type="button"
                      onClick={removeLink}
                    >
                      Remove Link
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={openLink}
                      disabled={!isValidUrl || !url}
                      className="gap-1"
                    >
                      <ExternalLink size={14} />
                      Open
                    </Button>
                  </>
                )}
              </div>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!isValidUrl}>Apply</Button>
              </div>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default LinkDialog; 