import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import multer from "multer";
import { syncDatabase } from "./models/index.js";
import trendingTopicRoutes from "./routes/trendingTopicRoutes.js";

dotenv.config();

const app = express();
const upload = multer();

app.use(cors());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(upload.none());

syncDatabase();

app.use("/api/trending-topics", trendingTopicRoutes);

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

