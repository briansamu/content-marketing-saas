import { useEffect, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import ContentEditor from '../../components/editor/ContentEditor';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, FileText, Loader2, Save, ArrowRightCircleIcon, Trash, Cloud, Database } from 'lucide-react';
import { formatDateString, truncateString } from '../../lib/utils';
import { Breadcrumb, BreadcrumbLink } from "../../components/ui/breadcrumb";
import { BreadcrumbSeparator } from "../../components/ui/breadcrumb";
import { BreadcrumbList, BreadcrumbPage } from "../../components/ui/breadcrumb";
import { BreadcrumbItem } from "../../components/ui/breadcrumb";
import { Separator } from "../../components/ui/separator";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";

export function ContentHubPage() {
  const {
    savedDrafts,
    isLoading,
    currentDraft,
    isSaving,
    isDirty,
    loadDrafts,
    newDraft,
    loadDraft,
    saveDraft,
    deleteDraft
  } = useEditorStore();
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);

  // Load saved drafts on initial render
  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleNewDraft = () => {
    newDraft();
  };

  const handleLoadDraft = (draftId: string) => {
    loadDraft(draftId);
  };

  const handleSave = () => {
    saveDraft();
  };

  const handleDeleteDraft = (draftId: string) => {
    setDraftToDelete(draftId);
  };

  const confirmDeleteDraft = () => {
    if (draftToDelete) {
      deleteDraft(draftToDelete);
      setDraftToDelete(null);
    }
  };

  const getStorageIcon = (storageLocation: 'local' | 'cloud' | 'both') => {
    switch (storageLocation) {
      case 'cloud':
        return (
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <Cloud size={16} className="text-primary ml-2" />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Saved in cloud</p>
            </TooltipContent>
          </Tooltip>
        );
      case 'local':
        return (
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <Database size={16} className="text-muted-foreground ml-2" />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Saved in browser</p>
            </TooltipContent>
          </Tooltip>
        );
      case 'both':
        return (
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <div className="flex">
                <Cloud size={16} className="text-primary ml-2" />
                <Database size={16} className="text-muted-foreground ml-2" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Saved in cloud and in browser</p>
            </TooltipContent>
          </Tooltip>
        );
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
                <BreadcrumbPage>Editor</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto mr-4 flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {currentDraft.storageLocation === 'cloud' || currentDraft.storageLocation === 'both'
                    ? 'Changes will auto-save to cloud'
                    : 'Changes will auto-save locally'}
                </>
              )}
            </span>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="gap-1"
          >
            <Save size={16} />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row gap-6 p-4 md:p-6">
        {/* Main editor area */}
        <div className="w-full lg:w-3/5">
          <ContentEditor />
        </div>

        {/* Sidebar with drafts list - simplified to 3 cards */}
        <div className="w-full lg:w-2/5 space-y-4 grid grid-rows-3 gap-4 h-[calc(100vh-8.6rem)]">
          <Card className="row-span-1 flex flex-col overflow-hidden">
            <CardHeader className="pb flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Files</CardTitle>
                <Button size="sm" onClick={handleNewDraft} className="gap-1">
                  <Plus size={16} />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-grow">
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : savedDrafts.length > 0 ? (
                <ul className="divide-y">
                  {savedDrafts
                    .slice()
                    .sort((a, b) => new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime())
                    .map((draft) => (
                      <li key={draft.id} className="py-2">
                        <Button
                          variant="ghost"
                          className={`w-full justify-between align-middle text-left p-3 py-5 rounded-none ${currentDraft.id === draft.id ? 'bg-muted' : ''
                            }`}
                          onClick={() => handleLoadDraft(draft.id!)}
                        >
                          <div className="flex gap-2 items-start">
                            <FileText size={18} className="mt-2 mr-0.5 size-5" />
                            <div>
                              <div className="flex items-center">
                                <p className="font-medium">
                                  {truncateString(draft.title || "Untitled", 40)}
                                </p>
                                <span className="cursor-help">
                                  {getStorageIcon(draft.storageLocation)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDateString(draft.lastSaved)}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="p-0 h-auto hover:bg-transparent"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDraft(draft.id!);
                                  }}
                                >
                                  <Trash size={18} className="text-muted-foreground hover:text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your
                                    draft "{draft.title || "Untitled"}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      confirmDeleteDraft();
                                    }}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <Button
                              variant="ghost"
                              className="p-0 h-auto hover:bg-transparent"
                            >
                              <ArrowRightCircleIcon size={18} className="text-muted-foreground hover:text-primary" />
                            </Button>
                          </div>
                        </Button>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  <p>No drafts yet</p>
                  <p className="text-sm">Create a new draft to get started</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="row-span-1 flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-xl">Insights & Suggestions</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-grow">
              <p className="text-muted-foreground text-sm">
                Content analytics and AI-powered suggestions will be available soon.
              </p>
            </CardContent>
          </Card>

          <Card className="row-span-1 flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-xl">Preview</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-grow">
              <p className="text-muted-foreground text-sm">
                Live content preview will be available soon.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default ContentHubPage; 