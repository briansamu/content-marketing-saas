import { AuthRequest } from "../middleware/authMiddleware";
import { Content, User } from "../models";

const createContent = async (req, res) => {
  try {
    const { title, textContent, category, source, published_at, url, relevance_score } = req.body;

    const content = await Content.create({
      user_id: req.user.id,
      title,
      content: textContent,
      status: 'draft',
      content_type: 'article',
      seo_score: 0
    });

    return res.status(201).json({
      success: true,
      message: 'Content created successfully',
      data: content
    });
  } catch (error) {
    console.error('Error creating content:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating content',
      error: error.message
    });
  }
};

export default {
  createContent
} as Record<string, (req: AuthRequest, res: Response) => Promise<any>>;