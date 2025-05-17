import { useEffect, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import ContentEditor from '../../components/editor/ContentEditor';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, FileText, Loader2, Save, ArrowRightCircleIcon, Trash, Cloud, Database, BarChart, BarChart2, AlertTriangle, Check, Lightbulb, Hash, TrendingUp, Bug } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";

export function ContentHubPage() {
  const {
    savedDrafts,
    isLoading,
    currentDraft,
    isSaving,
    isDirty,
    textSummary,
    analyzedText,
    contentSuggestions,
    loadDrafts,
    newDraft,
    loadDraft,
    saveDraft,
    deleteDraft,
    clearTextSummary,
    analyzeKeyword
  } = useEditorStore();
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [keywordTarget, setKeywordTarget] = useState('');
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);

  // Log content suggestions when they change
  useEffect(() => {
    console.log('ContentHubPage - Content Suggestions:', contentSuggestions);
  }, [contentSuggestions]);

  // Load saved drafts on initial render
  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  // When changing drafts, clear the text summary
  useEffect(() => {
    clearTextSummary();
  }, [currentDraft.id, clearTextSummary]);

  const handleNewDraft = () => {
    newDraft();
    setFilesDialogOpen(false);
  };

  const handleLoadDraft = (draftId: string) => {
    loadDraft(draftId);
    setFilesDialogOpen(false);
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

  // Helper to render readability level
  const getReadabilityLevel = (score: number) => {
    if (score < 6) return { level: 'Elementary', color: 'text-green-500' };
    if (score < 10) return { level: 'Middle School', color: 'text-blue-500' };
    if (score < 14) return { level: 'High School', color: 'text-yellow-500' };
    if (score < 18) return { level: 'College', color: 'text-orange-500' };
    return { level: 'Professional', color: 'text-red-500' };
  };

  // Get the top 5 keywords
  const getTopKeywords = () => {
    if (!textSummary?.keyword_density) return [];

    return Object.entries(textSummary.keyword_density)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
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

  const handleKeywordAnalysis = (keyword: string) => {
    if (!keyword.trim() || !textSummary) return;

    // If we have analyzed text from a previous analysis, use that,
    // otherwise use the current draft content
    const contentToAnalyze = analyzedText ||
      (currentDraft?.content && stripHtmlTags(currentDraft.content)) || '';

    if (!contentToAnalyze.trim()) {
      console.warn('No content to analyze');
      return;
    }

    // Call the analyzer with the specific keyword
    console.log(`Analyzing content for keyword: "${keyword}"`);
    analyzeKeyword(contentToAnalyze, keyword);
  };

  // Helper function to remove HTML tags from editor content
  const stripHtmlTags = (html: string) => {
    return html.replace(/<[^>]*>/g, ' ').trim();
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
          {/* Files Button with Modal */}
          <Dialog open={filesDialogOpen} onOpenChange={setFilesDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
              >
                <FileText size={16} />
                Files
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl md:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Files</DialogTitle>
                <DialogDescription>
                  View and manage your saved content
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto mt-4">
                <div className="flex justify-end mb-2">
                  <Button size="sm" onClick={handleNewDraft} className="gap-1">
                    <Plus size={16} />
                    New
                  </Button>
                </div>
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
                          <div className={`flex justify-between items-center p-3 py-4 ${currentDraft.id === draft.id ? 'bg-muted' : ''}`}>
                            <Button
                              variant="ghost" className="flex-1 justify-start text-left py-1 h-auto" onClick={() => handleLoadDraft(draft.id!)}                              >                                <div className="flex gap-2 items-start">                                  <FileText size={18} className="mt-0.5 mr-0.5 size-5" />
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
                            </Button>
                            <div className="flex items-center gap-2 ml-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-1 h-8 w-8 rounded-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteDraft(draft.id!);
                                    }}
                                  >
                                    <Trash size={16} className="text-muted-foreground hover:text-destructive" />
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
                                size="sm"
                                className="p-1 h-8 w-8 rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLoadDraft(draft.id!);
                                }}
                              >
                                <ArrowRightCircleIcon size={16} className="text-muted-foreground hover:text-primary" />
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    <p>No drafts yet</p>
                    <p className="text-sm">Create a new draft to get started</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="gap-1"
          >
            <Save size={16} />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDebug(!showDebug)}
            className="gap-1"
            title="Toggle debug information"
          >
            <Bug size={16} />
          </Button>
        </div>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row gap-6 p-4 md:p-6">
        {/* Main editor area */}
        <div className="w-full lg:w-3/5">
          <ContentEditor targetKeyword={keywordTarget} />
        </div>

        {/* Sidebar with insights - expanded to full height */}
        <div className="w-full lg:w-2/5 h-[calc(100vh-8.6rem)]">
          <Card className="h-full flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-xl flex items-center gap-2">
                Insights & Suggestions
                {contentSuggestions.isLoading && (
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-grow">
              {/* Target Keyword Input - Always visible */}
              <div className="flex flex-col gap-1 mb-4">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Lightbulb size={16} className="text-primary" />
                  Target Keyword
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter target keyword..."
                    className="px-2 py-1 text-sm border border-input rounded-md flex-1"
                    value={keywordTarget}
                    onChange={(e) => setKeywordTarget(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs whitespace-nowrap"
                    disabled={!keywordTarget.trim() || contentSuggestions.isLoading}
                    onClick={() => handleKeywordAnalysis(keywordTarget.trim())}
                  >
                    Analyze Keyword
                  </Button>
                </div>
              </div>

              {textSummary ? (
                <div className="space-y-4">
                  <Separator />

                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium flex items-center gap-1.5">
                      <BarChart2 size={16} className="text-primary" />
                      Content Stats
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Words:</span>
                        <span className="font-medium">{textSummary.words}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sentences:</span>
                        <span className="font-medium">{textSummary.sentences}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paragraphs:</span>
                        <span className="font-medium">{textSummary.paragraphs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Characters:</span>
                        <span className="font-medium">{textSummary.characters_with_spaces}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium flex items-center gap-1.5">
                      <Check size={16} className="text-green-500" />
                      Text Quality
                    </h3>
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Reading Level:</span>
                        <span className={`font-medium ${getReadabilityLevel(textSummary.coleman_liau_index).color}`}>
                          {getReadabilityLevel(textSummary.coleman_liau_index).level}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Words per Sentence:</span>
                        <span className="font-medium">{textSummary.words_per_sentence.toFixed(1)}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Errors:</span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <AlertTriangle size={14} className="text-red-500" />
                            <span className="font-medium">{textSummary.spelling_errors + textSummary.grammar_errors}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Analyzed Keywords Section - Always show section even if empty */}
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium flex items-center gap-1.5">
                      <Hash size={16} className="text-primary" />
                      Main Topics {contentSuggestions.analyzedKeywords.length === 0 && "(None found)"}
                    </h3>
                    {contentSuggestions.analyzedKeywords.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {contentSuggestions.analyzedKeywords.map((keyword) => (
                          <div key={keyword} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs flex items-center gap-1">
                            <span>{keyword}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No main topics were identified in your content.</p>
                    )}
                  </div>

                  <Separator />

                  {/* Related Keywords Section - Always show section even if empty */}
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium flex items-center gap-1.5">
                      <Lightbulb size={16} className="text-yellow-500" />
                      Keyword Suggestions {contentSuggestions.relatedKeywords.length === 0 && "(None found)"}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      Consider adding these related keywords to enhance your content.
                    </p>
                    {contentSuggestions.relatedKeywords.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {contentSuggestions.relatedKeywords.map((keyword) => (
                          <div
                            key={keyword.keyword}
                            className="px-2 py-1 bg-muted rounded-md text-xs flex items-center gap-1 group"
                            title={`Competition: ${keyword.competition}, Search volume: ${keyword.search_volume || 'N/A'}`}
                          >
                            <span>{keyword.keyword}</span>
                            {keyword.search_volume > 0 && (
                              <span className="text-muted-foreground text-[10px] flex items-center">
                                <TrendingUp size={10} className={`inline mr-0.5 ${keyword.competition === 'HIGH'
                                  ? 'text-red-500'
                                  : keyword.competition === 'MEDIUM'
                                    ? 'text-yellow-500'
                                    : 'text-green-500'
                                  }`} />
                                {keyword.search_volume > 1000
                                  ? `${(keyword.search_volume / 1000).toFixed(1)}K`
                                  : keyword.search_volume}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No keyword suggestions available. Try analyzing more content.</p>
                    )}
                  </div>

                  <Separator />

                  {/* Top Keywords Section - From the original text summary */}
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium flex items-center gap-1.5">
                      <BarChart size={16} className="text-primary" />
                      Top Keywords
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {getTopKeywords().map(([keyword, count]) => (
                        <div key={keyword} className="px-2 py-1 bg-muted rounded-md text-xs flex items-center gap-1">
                          <span>{keyword}</span>
                          <span className="text-muted-foreground">({count})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Debug Section */}
                  {showDebug && (
                    <>
                      <Separator />
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-medium flex items-center gap-1.5">
                          <Bug size={16} className="text-blue-500" />
                          Debug Info
                        </h3>
                        <div className="text-xs bg-muted p-2 rounded-md max-h-40 overflow-y-auto">
                          <p>Related Keywords Count: {contentSuggestions.relatedKeywords.length}</p>
                          <p>Analyzed Keywords Count: {contentSuggestions.analyzedKeywords.length}</p>
                          <p>Is Loading: {contentSuggestions.isLoading ? 'Yes' : 'No'}</p>
                          <pre className="text-[10px] overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(contentSuggestions, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Click the "Analyze Text" button above the editor to see content insights.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default ContentHubPage; 