import { useEffect, useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { SpellcheckError } from './extensions/SpellcheckExtension';
import { X, Check, AlertCircle } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface SpellcheckMenuProps {
  editor: Editor;
  onApplySuggestion: (offset: number, suggestion: string) => void;
  onRejectSuggestion?: (offset: number) => void;
}

export function SpellcheckMenu({ editor, onApplySuggestion, onRejectSuggestion }: SpellcheckMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedError, setSelectedError] = useState<SpellcheckError | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust the menu position to avoid going off-screen
  const adjustMenuPosition = (target: HTMLElement) => {
    // Get the target rect (the highlighted error word/phrase)
    const rect = target.getBoundingClientRect();

    // Since we're using fixed positioning, we'll use viewport coordinates directly
    let x = rect.left;
    let y = rect.bottom + 5; // 5px gap

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check if we have the menu element dimensions
    if (menuRef.current) {
      const menuWidth = menuRef.current.offsetWidth || 190; // Default width
      const menuHeight = menuRef.current.offsetHeight; // Actual height - will be based on content

      // Adjust horizontal position if menu would go off-screen
      if (x + menuWidth > viewportWidth - 20) {
        x = Math.max(20, viewportWidth - menuWidth - 20);
      }

      // Make sure we don't go off left edge
      x = Math.max(20, x);

      // Adjust vertical position if menu would go off bottom of viewport
      if (y + menuHeight > viewportHeight - 20) {
        // Position menu above the error instead of below it
        y = rect.top - menuHeight - 5;
      }

      // If it would now go off the top, put it back below but force it to fit
      if (y < 20) {
        y = rect.bottom + 5;

        // If the menu is too tall for the viewport, position it at the top and let it scroll
        if (y + menuHeight > viewportHeight - 20) {
          y = 20;
        }
      }
    }

    console.log('Menu position calculation:', {
      targetRect: {
        left: rect.left,
        top: rect.top,
        bottom: rect.bottom
      },
      viewportDimensions: {
        width: viewportWidth,
        height: viewportHeight
      },
      result: { x, y }
    });

    return { x, y };
  };

  useEffect(() => {
    // Set up click handlers for spellcheck error markers
    const handleSpellcheckClick = (event: Event) => {
      const target = event.target as HTMLElement;

      // Check if we clicked on a spellcheck error element
      if (target.classList.contains('spellcheck-error')) {
        event.preventDefault();
        event.stopPropagation();

        try {
          // Get the error data from the element
          const errorData = target.getAttribute('data-spellcheck-error');
          if (errorData) {
            const error = JSON.parse(errorData) as SpellcheckError;
            setSelectedError(error);

            // Calculate position for the menu
            const position = adjustMenuPosition(target);
            setMenuPosition(position);

            setIsOpen(true);
          }
        } catch (e) {
          console.error('Error parsing spellcheck data:', e);
        }
      }
    };

    // Handle clicks outside the menu to close it
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Don't close if clicking on a spellcheck error or inside the menu
      if (target.classList.contains('spellcheck-error') ||
        (menuRef.current && menuRef.current.contains(target))) {
        return;
      }

      // Close the menu for other clicks
      setIsOpen(false);
    };

    // Add event listener to the editor element for error clicks
    const editorElement = editor?.options.element;
    if (editorElement) {
      editorElement.addEventListener('click', handleSpellcheckClick);
    }

    // Add global document listener for outside clicks
    document.addEventListener('click', handleDocumentClick);

    return () => {
      if (editorElement) {
        editorElement.removeEventListener('click', handleSpellcheckClick);
      }
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [editor]);

  // Handle applying a suggestion
  const handleSuggestionClick = (suggestion: string) => {
    if (selectedError) {
      onApplySuggestion(selectedError.offset, suggestion);
      setIsOpen(false);
    }
  };

  // Handle rejecting a suggestion
  const handleRejectClick = () => {
    if (selectedError && onRejectSuggestion) {
      onRejectSuggestion(selectedError.offset);
      setIsOpen(false);
    }
  };

  if (!isOpen || !selectedError) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 w-[190px] opacity-0 transition-opacity duration-200",
        isOpen && "opacity-100"
      )}
      style={{
        left: `${menuPosition.x}px`,
        top: `${menuPosition.y}px`,
      }}
    >
      <Card className="shadow-md border-border overflow-hidden p-0 flex flex-col h-auto gap-0">
        <div className={cn(
          "py-1 px-3 flex flex-row justify-between items-center",
          selectedError.suggestions.length <= 1 ? "border-b border-border" : "bg-muted/60"
        )}>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <AlertCircle size={12} className={cn(
              selectedError.type === 'spelling' ? 'text-destructive' : 'text-warning'
            )} />
            <span>
              {selectedError.type === 'spelling' ? 'Spelling Error' : 'Grammar Error'}
            </span>
          </div>
          {onRejectSuggestion && (
            <Button
              onClick={handleRejectClick}
              variant="ghost"
              size="icon"
              className="h-5 w-5 -mr-1 p-0"
              title="Ignore suggestion"
            >
              <X size={12} />
            </Button>
          )}
        </div>

        {selectedError.suggestions.length > 0 ? (
          <ul className={cn(
            "text-xs divide-y divide-border",
            selectedError.suggestions.length <= 1 && "border-b-0"
          )}>
            {selectedError.suggestions.slice(0, selectedError.suggestions.length > 3 ? 5 : selectedError.suggestions.length).map((suggestion, index) => (
              <li
                key={index}
                className="px-3 py-1 cursor-pointer hover:bg-accent group flex items-center justify-between"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <span className="truncate pr-1.5">{suggestion}</span>
                <Check size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs px-3 py-1.5 text-muted-foreground italic border-t border-border">
            No suggestions available
          </div>
        )}

        {selectedError.suggestions.length > 1 && (
          <div className="px-3 py-1 text-[10px] text-muted-foreground bg-muted/30 text-center">
            Click a suggestion to apply
          </div>
        )}
      </Card>
    </div>
  );
}

export default SpellcheckMenu; 