import axios from "axios";
import TrendingTopic from "../models/TrendingTopic";
import dotenv from "dotenv";

dotenv.config();

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE_URL = process.env.NEWS_API_BASE_URL;

interface SavedArticle {
  id: number;
  title: string;
  content?: string;
  url: string;
  source: string;
  category: string;
  published_at: string;
  relevance_score: number;
}

class NewsApiService {
  async fetchTrendingTopics(category = "business", pageSize = 10) {
    try {
      console.log(`Fetching trending topics from ${NEWS_API_BASE_URL}/v2/top-headlines with category ${category}`);

      const response = await axios.get(`${NEWS_API_BASE_URL}/v2/top-headlines`, {
        params: {
          category,
          language: 'en',
          pageSize,
          apiKey: NEWS_API_KEY
        }
      });

      console.log(`Received ${response.data.articles?.length || 0} articles from News API`);

      const articles = response.data.articles;
      const savedArticles: any[] = [];

      for (const article of articles) {
        // Log the article data to verify URL is present
        console.log('Processing article:', {
          title: article.title,
          url: article.url,
          source: article.source?.name,
        });

        // Make sure the URL is properly saved
        if (!article.url) {
          console.log('Warning: Article has no URL, skipping');
          continue;
        }

        try {
          const savedArticle = await TrendingTopic.create({
            title: article.title,
            content: article.content,
            url: article.url, // Ensure URL is saved
            source: article.source?.name || 'Unknown',
            category: category,
            published_at: article.publishedAt,
            relevance_score: Math.random() * 10,
          });

          console.log(`Saved article with ID ${savedArticle.get('id')}, URL: ${savedArticle.get('url')}`);
          savedArticles.push(savedArticle.toJSON());
        } catch (err) {
          console.error('Error saving article:', err.message);
        }
      }

      return savedArticles; // Return the saved articles, not the raw API response
    } catch (error) {
      console.error("Error fetching trending topics:", error);
      throw new Error("Error fetching trending topics");
    }
  }
}

export default new NewsApiService();
