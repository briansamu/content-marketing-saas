import { Editor } from '@tiptap/react';

// Helper to safely add links to the editor
export const addLink = (editor: Editor, url: string, text?: string): void => {
  if (!editor || !url) return;

  const { state } = editor;
  const { selection } = state;
  const { empty } = selection;

  // If there's no selection and text is provided, insert the text with a link
  if (empty && text) {
    editor.commands.insertContent({
      type: 'text',
      text: text,
      marks: [
        {
          type: 'link',
          attrs: {
            href: url
          }
        }
      ]
    });
  }
  // If there's no selection and no text, insert the URL as a link
  else if (empty) {
    editor.commands.insertContent({
      type: 'text',
      text: url,
      marks: [
        {
          type: 'link',
          attrs: {
            href: url
          }
        }
      ]
    });
  }
  // If there's a selection and custom text, replace selection with the text as a link
  else if (text) {
    editor.commands.deleteSelection();
    editor.commands.insertContent({
      type: 'text',
      text: text,
      marks: [
        {
          type: 'link',
          attrs: {
            href: url
          }
        }
      ]
    });
  }
  // If there's just a selection, apply the link to it
  else {
    editor.commands.setLink({ href: url });
  }
}; 