import { useEffect, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, FileText, Trash, MessageSquare, Type, Video } from 'lucide-react';
import { formatDateString, truncateString } from '../../lib/utils';
import { Breadcrumb, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbList, BreadcrumbPage, BreadcrumbItem } from "../../components/ui/breadcrumb";
import { Separator } from "../../components/ui/separator";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { useNavigate } from 'react-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { ContentDraft } from '../../store/useEditorStore';

export function DocumentsPage() {
  const {
    savedDrafts,
    loadDraft,
    deleteDraft,
    newDraft,
    clearCurrentDraftFromStorage,
    setContentType
  } = useEditorStore();
  const navigate = useNavigate();
  const [sortedDrafts, setSortedDrafts] = useState<ContentDraft[]>([...savedDrafts]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newDraftDialogOpen, setNewDraftDialogOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);

  useEffect(() => {
    // Sort drafts by modified date (most recent first)
    const sorted = [...savedDrafts].sort((a, b) => {
      return new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime();
    });
    setSortedDrafts(sorted);
  }, [savedDrafts]);

  const handleLoadDraft = (draftId: string) => {
    loadDraft(draftId);
    navigate('/app/content/editor');
  };

  const handleOpenNewDraftDialog = () => {
    setNewDraftDialogOpen(true);
  };

  const handleCreateNewDraft = (contentType: string) => {
    // Clear any current draft first to ensure we start fresh
    clearCurrentDraftFromStorage();
    // Create a new empty draft
    newDraft();
    // Set the content type
    setContentType(contentType);
    // Close the dialog
    setNewDraftDialogOpen(false);
    // Navigate to the editor
    navigate('/app/content/editor');
  };

  const handleDeleteDraft = (draftId: string) => {
    setDraftToDelete(draftId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteDraft = () => {
    if (draftToDelete) {
      deleteDraft(draftToDelete);
      setDraftToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  // Helper to get content type icon
  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case 'social':
        return <MessageSquare size={16} />;
      case 'blog':
        return <Type size={16} />;
      case 'video':
        return <Video size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/app/content">
                  Creation Hub
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Documents</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto mr-4 flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            className="gap-1"
            onClick={handleOpenNewDraftDialog}
          >
            <Plus size={16} />
            New Document
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Content Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedDrafts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">You don't have any content documents yet</p>
                <Button onClick={handleOpenNewDraftDialog}>
                  <Plus className="mr-2 h-4 w-4" /> Create Your First Document
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => draft.id && handleLoadDraft(draft.id)}
                    >
                      <div className="flex items-center gap-2">
                        {getContentTypeIcon(draft.contentType || 'article')}
                        <span className="font-medium">
                          {draft.title || "Untitled"}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {draft.contentType ? draft.contentType.charAt(0).toUpperCase() + draft.contentType.slice(1) : 'Document'}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {truncateString(draft.content ? draft.content.replace(/<[^>]*>/g, ' ').trim() : "", 100)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Last modified: {formatDateString(draft.lastSaved)}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => draft.id && handleDeleteDraft(draft.id)}
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* New Content Type Dialog */}
      <Dialog open={newDraftDialogOpen} onOpenChange={setNewDraftDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Content</DialogTitle>
            <DialogDescription>
              Select the type of content you want to create
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 justify-center items-center"
              onClick={() => handleCreateNewDraft('social')}
            >
              <MessageSquare className="h-8 w-8 text-primary" />
              <span>Social Post</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 justify-center items-center"
              onClick={() => handleCreateNewDraft('blog')}
            >
              <Type className="h-8 w-8 text-primary" />
              <span>Blog Post</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 justify-center items-center"
              onClick={() => handleCreateNewDraft('video')}
            >
              <Video className="h-8 w-8 text-primary" />
              <span>Video Script</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 justify-center items-center"
              onClick={() => handleCreateNewDraft('article')}
            >
              <FileText className="h-8 w-8 text-primary" />
              <span>Article</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDraft}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 