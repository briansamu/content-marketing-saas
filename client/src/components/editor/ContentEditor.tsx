import React from 'react';
import ContentEditorSwitcher from './ContentEditorSwitcher';

export function ContentEditor({ targetKeyword }: { targetKeyword?: string }) {
  // Pass through to the editor switcher which will choose the appropriate editor
  return <ContentEditorSwitcher targetKeyword={targetKeyword} />;
}

export default ContentEditor; 