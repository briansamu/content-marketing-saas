import { useState } from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { AlertTriangle, X, RefreshCw, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog';

interface IgnoredError {
  id: number;
  user_id: number;
  token: string;
  type: string;
  created_at: string;
}

interface SpellcheckSettingsProps {
  ignoredErrors: IgnoredError[];
  onRemoveIgnoredError: (id: number) => Promise<void>;
  onClearAllIgnored: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function SpellcheckSettings({
  ignoredErrors,
  onRemoveIgnoredError,
  onClearAllIgnored,
  onRefresh
}: SpellcheckSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Sort errors by most recent first
  const sortedErrors = [...ignoredErrors].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleRemove = async (id: number) => {
    setIsLoading(true);
    try {
      await onRemoveIgnoredError(id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all ignored errors? This will cause these errors to be flagged again in your content.')) {
      setIsLoading(true);
      try {
        await onClearAllIgnored();
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await onRefresh();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-xs gap-1.5 flex items-center"
        onClick={() => setIsOpen(true)}
      >
        <Settings size={14} />
        <span>Spelling Settings</span>
        {ignoredErrors.length > 0 && (
          <span className="ml-1 bg-muted px-1.5 py-0.5 rounded-full text-[10px]">
            {ignoredErrors.length}
          </span>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ignored Spelling/Grammar Errors</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Errors you've chosen to ignore will not be flagged in any of your content.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                title="Refresh list"
                className="h-7 w-7 p-0 ml-2 flex-shrink-0"
              >
                <RefreshCw size={16} />
              </Button>
            </div>

            {sortedErrors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No ignored errors yet
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {sortedErrors.map((error) => (
                  <div key={error.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        size={14}
                        className={error.type === 'spelling' ? 'text-destructive' : 'text-amber-500'}
                      />
                      <span className="font-medium">{error.token}</span>
                      <span className="text-xs text-muted-foreground">
                        ({error.type === 'spelling' ? 'Spelling' : 'Grammar'})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(error.id)}
                      disabled={isLoading}
                      className="h-6 w-6"
                      title="Remove from ignored list"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <DialogFooter className="flex justify-between gap-2 sm:justify-between mt-4">
            <div className="text-xs text-muted-foreground">
              {sortedErrors.length} {sortedErrors.length === 1 ? 'error' : 'errors'} ignored
            </div>
            <div className="flex gap-2">
              {sortedErrors.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={isLoading}
                >
                  Clear All
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SpellcheckSettings; 