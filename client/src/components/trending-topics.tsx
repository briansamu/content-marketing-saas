import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ExternalLink } from 'lucide-react';

interface TrendingTopic {
  id: number;
  title: string;
  content?: string;
  category: string;
  source: string;
  published_at: string;
  url?: string;
  relevance_score?: number;
}

// API URL from environment variable with fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function TrendingTopics() {
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingTopics = async () => {
      try {
        setIsLoading(true);
        console.log(`Fetching trending topics from ${API_BASE_URL}/api/trending-topics`);

        // Fetch trending topics from API using environment variable
        const response = await fetch(`${API_BASE_URL}/api/trending-topics`);

        if (!response.ok) {
          throw new Error('Failed to fetch trending topics');
        }

        const data = await response.json();
        console.log('Received topics:', data.data);

        // Add some sample topics with URLs for testing if the API returns no URLs
        const processedTopics = data.data || [];

        // Debug each topic's URL
        processedTopics.forEach((topic: TrendingTopic, index: number) => {
          console.log(`Topic ${index} URL:`, topic.url);
        });

        // For testing: If no topics have URLs, add a sample one
        const hasRealUrls = processedTopics.some((topic: TrendingTopic) => topic.url && topic.url !== '#');
        if (!hasRealUrls && processedTopics.length > 0) {
          console.log("No real URLs found in topics, adding sample URL for testing");
          processedTopics[0] = {
            ...processedTopics[0],
            url: "https://www.example.com/article"
          };
        }

        setTopics(processedTopics);
      } catch (err) {
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrendingTopics();
  }, []);

  // Format date properly
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Unknown date';
    }
  };

  // Check if the URL is valid
  const isValidUrl = (url?: string): boolean => {
    if (!url) return false;
    if (url === '#') return false;

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  if (isLoading) {
    return (
      <Card className="col-span-3 md:col-span-2 h-[420px] flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle>Trending Topics</CardTitle>
          <CardDescription>Most popular topics right now</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center pt-0 overflow-hidden">
          <div className="h-8 w-8 animate-spin text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="col-span-3 md:col-span-2 h-[420px] flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle>Trending Topics</CardTitle>
          <CardDescription>Most popular topics right now</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 flex-1 overflow-hidden">
          <p className="text-sm text-red-500">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-3 md:col-span-2 h-[420px] flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle>Trending Topics</CardTitle>
        <CardDescription>Most popular topics right now</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 flex-1 overflow-hidden">
        {topics.length > 0 ? (
          <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
            <div className="divide-y">
              {topics.map((topic) => (
                <div key={topic.id} className="flex items-start py-3 first:pt-0 last:pb-0">
                  <div className="flex-1">
                    <div className="text-sm font-medium line-clamp-2 mb-1">
                      {isValidUrl(topic.url) ? (
                        <a
                          href={topic.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary"
                        >
                          {topic.title}
                        </a>
                      ) : (
                        topic.title
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      <span className="font-medium">{topic.source}</span> • {topic.category} • {formatDate(topic.published_at)}
                    </div>
                    {topic.content && (
                      <div className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {topic.content}
                      </div>
                    )}

                    {isValidUrl(topic.url) && (
                      <div className="mt-1 border-t pt-1 border-muted/30">
                        <a
                          href={topic.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Read full article
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No trending topics available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 