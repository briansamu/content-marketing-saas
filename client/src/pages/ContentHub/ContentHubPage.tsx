import { useEffect, useState } from 'react';
import React from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import ContentEditor from '../../components/editor/ContentEditor';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, FileText, Loader2, Save, ArrowRightCircleIcon, Trash, Cloud, Database, BarChart, BarChart2, AlertTriangle, Check, Lightbulb, Hash, TrendingUp, Type, MessageSquare, Video, Info } from 'lucide-react';
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
  DialogFooter,
} from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";

// Helper function to get current draft from localStorage directly
const getCurrentDraftFromStorage = () => {
  try {
    const currentDraftJson = localStorage.getItem('current_draft');
    return currentDraftJson ? JSON.parse(currentDraftJson) : null;
  } catch (e) {
    console.error('Failed to parse current draft from localStorage', e);
    return null;
  }
};

export function ContentHubPage() {
  const {
    savedDrafts,
    isLoading,
    currentDraft,
    isSaving,
    isDirty,
    textSummary,
    contentSuggestions,
    loadDrafts,
    newDraft,
    loadDraft,
    saveDraft,
    deleteDraft,
    clearTextSummary,
    updateTitle,
    updateContent,
    setContentType,
    clearCurrentDraftFromStorage
  } = useEditorStore();
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [keywordTarget, setKeywordTarget] = useState('');
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [newDraftDialogOpen, setNewDraftDialogOpen] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [initialTitle, setInitialTitle] = useState('');

  // Check both store and localStorage to determine if editor should be visible
  const storedDraft = getCurrentDraftFromStorage();
  const hasContent = currentDraft.content !== '' || currentDraft.title !== '';
  const hasStoredContent = storedDraft && (storedDraft.content !== '' || storedDraft.title !== '');
  // Also check if a content type was set, which indicates user wants to create a new document
  const hasContentType = currentDraft.contentType !== '';
  const [editorVisible, setEditorVisible] = useState(hasContent || hasStoredContent || hasContentType);

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

    // Show editor if there's content, a title, or a content type is set
    if (currentDraft.content !== '' || currentDraft.title !== '' || currentDraft.contentType !== '') {
      setEditorVisible(true);
    }
  }, [currentDraft.id, clearTextSummary, currentDraft.content, currentDraft.title, currentDraft.contentType]);

  const handleNewDraft = (contentType: string) => {
    clearCurrentDraftFromStorage();
    newDraft();
    setContentType(contentType);
    setNewDraftDialogOpen(false);
    setEditorVisible(true);
  };

  const handleNewDraftWithPrompt = (contentType: string) => {
    if (!promptInput.trim() && !initialTitle.trim()) {
      handleNewDraft(contentType);
      return;
    }

    clearCurrentDraftFromStorage();
    newDraft();
    setContentType(contentType);

    if (initialTitle.trim()) {
      updateTitle(initialTitle);
    }

    if (promptInput.trim()) {
      // In a real implementation, this would call an AI endpoint
      // For now just add the prompt as initial content
      updateContent(`<p><strong>Generated from prompt:</strong> ${promptInput}</p><p>Start writing your content here...</p>`);
    }

    setPromptInput('');
    setInitialTitle('');
    setNewDraftDialogOpen(false);
    setEditorVisible(true);
  };

  const handleLoadDraft = (draftId: string) => {
    loadDraft(draftId);
    setFilesDialogOpen(false);
    setEditorVisible(true);
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
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/app/content/documents">
                  Documents
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

          {/* New Draft Dialog */}
          <Dialog open={newDraftDialogOpen} onOpenChange={setNewDraftDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="default"
                className="gap-1"
              >
                <Plus size={16} />
                New
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Content</DialogTitle>
                <DialogDescription>
                  Select the type of content you want to create
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="options" className="mt-4">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="options">Create</TabsTrigger>
                  <TabsTrigger value="ai-prompt">AI Prompt</TabsTrigger>
                </TabsList>

                <TabsContent value="options" className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col gap-2 justify-center items-center"
                      onClick={() => handleNewDraft('social')}
                    >
                      <MessageSquare className="h-8 w-8 text-primary" />
                      <span>Social Post</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-24 flex flex-col gap-2 justify-center items-center"
                      onClick={() => handleNewDraft('blog')}
                    >
                      <Type className="h-8 w-8 text-primary" />
                      <span>Blog Post</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-24 flex flex-col gap-2 justify-center items-center"
                      onClick={() => handleNewDraft('video')}
                    >
                      <Video className="h-8 w-8 text-primary" />
                      <span>Video Script</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-24 flex flex-col gap-2 justify-center items-center"
                      onClick={() => handleNewDraft('article')}
                    >
                      <FileText className="h-8 w-8 text-primary" />
                      <span>Article</span>
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="ai-prompt" className="space-y-4 py-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title (optional)</Label>
                      <Input
                        id="title"
                        placeholder="Enter a title for your content"
                        value={initialTitle}
                        onChange={(e) => setInitialTitle(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prompt">AI Prompt</Label>
                      <Textarea
                        id="prompt"
                        placeholder="Describe what content you want to create..."
                        rows={4}
                        value={promptInput}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPromptInput(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        className="justify-center items-center"
                        onClick={() => handleNewDraftWithPrompt('social')}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        <span>Social Post</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="justify-center items-center"
                        onClick={() => handleNewDraftWithPrompt('blog')}
                      >
                        <Type className="h-4 w-4 mr-2" />
                        <span>Blog Post</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="justify-center items-center"
                        onClick={() => handleNewDraftWithPrompt('video')}
                      >
                        <Video className="h-4 w-4 mr-2" />
                        <span>Video Script</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="justify-center items-center"
                        onClick={() => handleNewDraftWithPrompt('article')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        <span>Article</span>
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-4">
                <Button variant="secondary" onClick={() => setNewDraftDialogOpen(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                  <Button size="sm" onClick={() => {
                    setFilesDialogOpen(false);
                    setNewDraftDialogOpen(true);
                  }} className="gap-1">
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
                              variant="ghost" className="flex-1 justify-start text-left py-1 h-auto" onClick={() => handleLoadDraft(draft.id!)}
                            >
                              <div className="flex gap-2 items-start">
                                {getContentTypeIcon(draft.contentType || 'article')}
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
        </div>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row gap-6 p-4 md:p-6">
        {/* Welcome message when no editor is visible */}
        {!editorVisible ? (
          <div className="w-full flex items-center justify-center">
            <Card className="w-full max-w-2xl p-6">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl">Welcome to the Content Editor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-center text-muted-foreground">
                  Create new content or continue working on an existing draft
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-24 flex flex-col gap-2 justify-center items-center"
                    onClick={() => setNewDraftDialogOpen(true)}
                  >
                    <Plus className="h-8 w-8 text-primary" />
                    <span>Create New Content</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-24 flex flex-col gap-2 justify-center items-center"
                    onClick={() => window.location.href = '/app/content/documents'}
                  >
                    <FileText className="h-8 w-8 text-primary" />
                    <span>Open Existing Draft</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
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
                      Target Keyword(s)
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info size={16} className="text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Enter one or more target keywords separated by commas.
                        </TooltipContent>
                      </Tooltip>
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter one or more keywords separated by commas..."
                        className="px-2 py-1 text-sm border border-input rounded-md flex-1"
                        value={keywordTarget}
                        onChange={(e) => setKeywordTarget(e.target.value)}
                      />
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
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Click the "Analyze Text" button above the editor to see content insights.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default ContentHubPage; 