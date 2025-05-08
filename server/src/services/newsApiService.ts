import axios from "axios";
import TrendingTopic from "../models/TrendingTopic";
import dotenv from "dotenv";

dotenv.config();

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE_URL = process.env.NEWS_API_BASE_URL;

class NewsApiService {
  async fetchTrendingTopics(category = "business", pageSize = 10) {
    try {
      const response = await axios.get(`${NEWS_API_BASE_URL}/v2/top-headlines`, {
        params: {
          category,
          language: 'en',
          pageSize,
          apiKey: NEWS_API_KEY
        }
      });

      const articles = response.data.articles;

      for (const article of articles) {
        await TrendingTopic.create({
          title: article.title,
          description: article.description,
          content: article.content,
          url: article.url,
          source: article.source.name,
          publishedAt: article.publishedAt,
          relevanceScore: Math.random() * 10,
        });
      }
      return articles;
    } catch (error) {
      console.error("Error fetching trending topics:", error);
      throw new Error("Error fetching trending topics");
    }
  }
}

export default new NewsApiService();
