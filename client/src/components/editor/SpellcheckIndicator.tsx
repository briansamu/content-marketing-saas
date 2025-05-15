import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SpellcheckIndicatorProps {
  isChecking: boolean;
}

export function SpellcheckIndicator({ isChecking }: SpellcheckIndicatorProps) {
  if (!isChecking) {
    return null;
  }

  return (
    <div className={cn(
      "absolute bottom-3 right-3 z-10 rounded-md border bg-background text-foreground",
      "text-xs py-1.5 px-3 shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
    )}>
      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      <span className="text-muted-foreground">Checking spelling...</span>
    </div>
  );
}

export default SpellcheckIndicator; 