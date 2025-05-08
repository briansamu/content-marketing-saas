import express from "express";
import trendingTopicController from "../controllers/tendingTopicController";

const router = express.Router();

router.get("/fetch", trendingTopicController.fetchAndStoreTrendingTopics);
router.get("/", trendingTopicController.getTrendingTopics);

export default router;
