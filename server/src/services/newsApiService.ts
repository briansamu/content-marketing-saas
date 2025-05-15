import axios from "axios";
import TrendingTopic from "../models/trendingTopic";
import dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config();

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE_URL = process.env.NEWS_API_BASE_URL;

class NewsApiService {
  async fetchTrendingTopics(category = "business", pageSize = 10) {
    try {
      logger.info(`Fetching trending topics from ${NEWS_API_BASE_URL}/v2/top-headlines with category ${category}`);

      const response = await axios.get(`${NEWS_API_BASE_URL}/v2/top-headlines`, {
        params: {
          category,
          language: 'en',
          pageSize,
          apiKey: NEWS_API_KEY
        }
      });

      logger.info(`Received ${response.data.articles?.length || 0} articles from News API`);

      const articles = response.data.articles;
      const savedArticles: any[] = [];

      for (const article of articles) {
        // Make sure the URL is properly saved
        if (!article.url) {
          logger.warn('Warning: Article has no URL, skipping');
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

          logger.debug(`Saved article with ID ${savedArticle.get('id')}, URL: ${savedArticle.get('url')}`);
          savedArticles.push(savedArticle.toJSON());
        } catch (err) {
          logger.error('Error saving article:', err.message);
        }
      }

      return savedArticles; // Return the saved articles, not the raw API response
    } catch (error) {
      logger.error("Error fetching trending topics:", error);
      throw new Error("Error fetching trending topics");
    }
  }
}

export default new NewsApiService();
