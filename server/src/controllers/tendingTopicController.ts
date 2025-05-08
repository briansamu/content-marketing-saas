import TrendingTopic from "../models/TrendingTopic";
import newsApiService from "../services/newsApiService";

export const fetchAndStoreTrendingTopics = async (req, res) => {
  try {
    const { category = "business", pageSize = 10 } = req.query;

    const articles = await newsApiService.fetchTrendingTopics(category, pageSize);

    res.status(200).json({
      success: true,
      message: "Trending topics fetched and stored successfully",
      data: articles,
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
    });

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

export default {
  fetchAndStoreTrendingTopics,
  getTrendingTopics,
};

