import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loadDrafts, newDraft, loadDraft } from '../../store/slices/editorSlice';
import ContentEditor from '../../components/editor/ContentEditor';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, FileText, Loader2 } from 'lucide-react';
import { formatDateString, truncateString } from '../../lib/utils';
import { Breadcrumb, BreadcrumbLink } from "../../components/ui/breadcrumb";
import { BreadcrumbSeparator } from "../../components/ui/breadcrumb";
import { BreadcrumbList, BreadcrumbPage } from "../../components/ui/breadcrumb";
import { BreadcrumbItem } from "../../components/ui/breadcrumb";
import { Separator } from "../../components/ui/separator";
import { SidebarTrigger } from "../../components/ui/sidebar";

export function ContentHubPage() {
  const dispatch = useAppDispatch();
  const { savedDrafts, isLoading, currentDraft } = useAppSelector((state) => state.editor);

  // Load saved drafts on initial render
  useEffect(() => {
    dispatch(loadDrafts());
  }, [dispatch]);

  const handleNewDraft = () => {
    dispatch(newDraft());
  };

  const handleLoadDraft = (draftId: string) => {
    dispatch(loadDraft(draftId));
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
      </header>
      <div className="container mx-auto p-4 md:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar with drafts list */}
          <div className="w-full lg:w-1/3 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Your Content</CardTitle>
                  <Button size="sm" onClick={handleNewDraft} className="gap-1">
                    <Plus size={16} />
                    New
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : savedDrafts.length > 0 ? (
                  <ul className="divide-y">
                    {savedDrafts.map((draft) => (
                      <li key={draft.id} className="p-0">
                        <Button
                          variant="ghost"
                          className={`w-full justify-start text-left p-3 rounded-none ${currentDraft.id === draft.id ? 'bg-muted' : ''
                            }`}
                          onClick={() => handleLoadDraft(draft.id!)}
                        >
                          <div className="flex gap-2 items-start">
                            <FileText size={18} className="mt-0.5" />
                            <div>
                              <p className="font-medium">
                                {truncateString(draft.title || "Untitled", 24)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateString(draft.lastSaved)}
                              </p>
                            </div>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Content Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Analytics features coming soon.
                </p>
                {/* Future feature: Basic analytics about your content */}
              </CardContent>
            </Card>
          </div>

          {/* Main editor area */}
          <div className="w-full lg:w-3/4">
            <ContentEditor />
          </div>
        </div>
      </div>
    </>
  );
}

export default ContentHubPage; 