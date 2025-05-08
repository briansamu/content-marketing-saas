import express from "express";
import trendingTopicController from "../controllers/tendingTopicController";

const router = express.Router();

// Order matters - specific routes should be before parameterized routes
router.get("/fetch", trendingTopicController.fetchAndStoreTrendingTopics);
router.get("/", trendingTopicController.getTrendingTopics);
router.get("/:id", trendingTopicController.getTrendingTopicById);

export default router;
