import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import multer from "multer";
import passport from "passport";
import { syncDatabase } from "./models/index.js";
import logger from "./utils/logger";
import sessionMiddleware from "./middleware/sessionMiddleware";
import "./config/auth";

// Routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import trendingTopicRoutes from "./routes/trendingTopicRoutes.js";
import contentRoutes from "./routes/contentRoutes.js";

dotenv.config();

const app = express();
const upload = multer();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(upload.none());

// Session and authentication middleware
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Sync database
syncDatabase();

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/trending-topics", trendingTopicRoutes);
app.use("/api/content", contentRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API is running",
    version: process.env.npm_package_version || "1.0.0"
  });
});

const port = process.env.PORT || 8080;

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});