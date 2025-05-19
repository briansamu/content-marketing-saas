import { useEditorStore } from '../../store/useEditorStore';
import ArticleEditor from './types/ArticleEditor';
import SocialEditor from './types/SocialEditor';
import VideoEditor from './types/VideoEditor';

export function ContentEditorSwitcher({ targetKeyword }: { targetKeyword?: string }) {
  const { currentDraft } = useEditorStore();

  // Render the appropriate editor based on content type
  const renderEditor = () => {
    switch (currentDraft.contentType) {
      case 'social':
        return <SocialEditor targetKeyword={targetKeyword} />;
      case 'video':
        return <VideoEditor />;
      case 'blog':
      case 'article':
        return <ArticleEditor targetKeyword={targetKeyword} />;
      default:
        // Default to article editor
        return <ArticleEditor targetKeyword={targetKeyword} />;
    }
  };

  return renderEditor();
}

export default ContentEditorSwitcher; 