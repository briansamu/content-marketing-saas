# Content Creation Hub

The Content Creation Hub is a feature of our Content Marketing Intelligence Platform that allows users to create, edit, and manage their content in a rich text editor.

## Features

- Rich text editing with TipTap
- Real-time word count
- Autosave drafts to localStorage
- Draft management (create, edit, save)
- Responsive design with Tailwind CSS and shadcn/ui
- Redux integration for state management

## Components

1. **ContentHubPage** - Main page component that hosts the editor and sidebar
2. **ContentEditor** - The core editor component with TipTap integration
3. **EditorToolbar** - Toolbar with formatting controls
4. **EditorToolbarButton** - Individual button component for the toolbar

## Redux Integration

The editor uses Redux for state management with the following features:
- Content draft state management
- Autosave functionality
- Loading and saving drafts to localStorage

## Future Integrations

This editor is designed to be backend-ready. Here's what to do when the backend is ready:

1. Update the `contentService.ts` file to use real API endpoints
2. Uncomment the API call sections in the `editorSlice.ts` file
3. Add user permissions and collaborative editing features

## Dependencies

To use this feature, you need to install the following dependencies:

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-text-align @tiptap/extension-link
```

## Development Notes

- The editor currently saves to localStorage until the backend is ready
- Word count is calculated by stripping HTML tags and counting words
- Autosave triggers after 3 seconds of inactivity
- Editor state is maintained in Redux for persistence 