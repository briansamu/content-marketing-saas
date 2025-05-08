import TrendingTopic from "../models/trendingTopic";
import newsApiService from "../services/newsApiService";

export const fetchAndStoreTrendingTopics = async (req, res) => {
  try {
    const { category = "business", pageSize = 10 } = req.query;

    const savedArticles = await newsApiService.fetchTrendingTopics(category, pageSize);

    // Log the saved articles to verify URLs
    console.log(`Returning ${savedArticles.length} saved articles to client`);
    console.log('First few articles URLs:', savedArticles.slice(0, 3).map(a => a.url));

    res.status(200).json({
      success: true,
      message: "Trending topics fetched and stored successfully",
      data: savedArticles,
    });
  } catch (error) {
    console.error("Error fetching trending topics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching trending topics",
      error: error.message,
    });
  }
};

export const getTrendingTopics = async (req, res) => {
  try {
    const { category, limit = 10 } = req.query;

    const whereClause = category ? { category } : {};

    const trendingTopics = await TrendingTopic.findAll({
      where: whereClause,
      order: [['published_at', 'DESC']],
      limit: parseInt(limit),
      attributes: ['id', 'title', 'content', 'source', 'category', 'published_at', 'url', 'relevance_score'],
    });

    // Log to verify URLs are being returned
    console.log(`Found ${trendingTopics.length} trending topics`);
    if (trendingTopics.length > 0) {
      console.log('Sample URLs:', trendingTopics.slice(0, 3).map(topic => topic.get('url')));
    }

    res.status(200).json({
      success: true,
      message: "Trending topics fetched successfully",
      data: trendingTopics,
    });
  } catch (error) {
    console.error("Error fetching trending topics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching trending topics",
      error: error.message,
    });
  }
};

export const getTrendingTopicById = async (req, res) => {
  try {
    const { id } = req.params;

    const trendingTopic = await TrendingTopic.findByPk(id, {
      attributes: ['id', 'title', 'content', 'source', 'category', 'published_at', 'url', 'relevance_score'],
    });

    if (!trendingTopic) {
      return res.status(404).json({
        success: false,
        message: "Trending topic not found",
      });
    }

    // Log to verify URL is included
    console.log(`Found trending topic with ID ${id}, URL: ${trendingTopic.get('url')}`);

    res.status(200).json({
      success: true,
      message: "Trending topic fetched successfully",
      data: trendingTopic,
    });
  } catch (error) {
    console.error("Error fetching trending topic:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching trending topic",
      error: error.message,
    });
  }
};

export default {
  fetchAndStoreTrendingTopics,
  getTrendingTopics,
  getTrendingTopicById,
};

