import React from 'react';
import { useEditorStore } from '../../../store/useEditorStore';
import { Card, CardContent, CardFooter, CardHeader } from '../../ui/card';
import { Input } from '../../ui/input';
import { Video } from 'lucide-react';
import { Button } from '../../ui/button';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function VideoEditor({ targetKeyword }: { targetKeyword?: string }) {
  const {
    currentDraft,
    updateTitle,
    saveDraft,
  } = useEditorStore();

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateTitle(e.target.value);
  };

  return (
    <Card className="w-full xs:max-w-2xl mx-auto border shadow-sm gap-0">
      <CardHeader className="space-y-1 px-4 pb-2 gap-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-lg">
            <Video className="h-4 w-4" />
            <span className="text-sm text-muted-foreground">Video Script</span>
          </div>
          <Input
            placeholder="Title..."
            value={currentDraft.title}
            onChange={handleTitleChange}
            className="text-xl font-semibold border-none focus-visible:ring-0 px-3 flex-1"
          />
        </div>
      </CardHeader>
      <CardContent className="p-8 pt-6 pb-8 flex flex-col items-center justify-center text-center">
        <div className="bg-muted/30 rounded-lg p-8 w-full max-w-lg">
          <Video className="w-16 h-16 mx-auto mb-6 text-primary/70" />
          <h3 className="text-2xl font-bold mb-2">Video Editor Coming Soon</h3>
          <p className="text-muted-foreground mb-6">
            We're working hard to bring you a powerful video script editor.
            This feature will be available in an upcoming release.
          </p>
          <div className="flex flex-col gap-2 items-center">
            <p className="text-sm text-muted-foreground">
              Features to expect:
            </p>
            <ul className="text-sm text-left list-disc pl-6 mb-4">
              <li>Script writing with scene segmentation</li>
              <li>Estimated video duration calculator</li>
              <li>AI-powered script enhancement</li>
              <li>Voice-over friendly formatting</li>
              <li>Export to multiple formats</li>
            </ul>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end pt-2 px-4 pb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => saveDraft()}
        >
          Save Title
        </Button>
      </CardFooter>
    </Card>
  );
}

export default VideoEditor; 