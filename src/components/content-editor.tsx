'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { useEffect, useState } from 'react';
import { Keyword } from './keyword-selector';
import { FiLoader, FiType, FiBold, FiItalic } from 'react-icons/fi';

interface ContentEditorProps {
  content: string;
  keywords: Keyword[];
  onContentChange: (content: string) => void;
  onKeywordRemoved: (keyword: string) => void;
  isLoading: boolean;
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="border-b border-gray-300 pb-3 mb-3 flex flex-wrap gap-2">
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-2">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Heading 1"
        >
          <span className="font-bold text-lg">H1</span>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Heading 2"
        >
          <span className="font-bold">H2</span>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Heading 3"
        >
          <span className="font-semibold text-sm">H3</span>
        </button>
        <button
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('paragraph') ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Paragraph"
        >
          <FiType size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('bold') ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Bold"
        >
          <FiBold size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('italic') ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Italic"
        >
          <FiItalic size={18} />
        </button>
      </div>
    </div>
  );
};

// Helper function to check and fix HTML content
function ensureValidContent(content: string): string {
  // If content is empty, return an empty string
  if (!content) return '';
  
  // Check if content has heading tags but they're not being rendered properly
  const hasH1 = content.includes('<h1>') || content.includes('<h1 ');
  const hasH2 = content.includes('<h2>') || content.includes('<h2 ');
  const hasH3 = content.includes('<h3>') || content.includes('<h3 ');
  
  console.log('Content analysis:', { hasH1, hasH2, hasH3, length: content.length });
  
  // Return the content as is
  return content;
}

// Custom CSS for editor to ensure headings display properly
const editorStyles = `
  .ProseMirror h1 {
    font-size: 2rem !important;
    font-weight: 700 !important;
    margin-top: 1.5rem !important;
    margin-bottom: 1rem !important;
    color: #111827 !important;
  }
  
  .ProseMirror h2 {
    font-size: 1.5rem !important;
    font-weight: 600 !important;
    margin-top: 1.25rem !important;
    margin-bottom: 0.75rem !important;
    color: #1f2937 !important;
  }
  
  .ProseMirror h3 {
    font-size: 1.25rem !important;
    font-weight: 600 !important;
    margin-top: 1rem !important;
    margin-bottom: 0.5rem !important;
    color: #374151 !important;
  }
  
  .ProseMirror p {
    margin-bottom: 0.75rem !important;
  }
`;

export default function ContentEditor({
  content,
  keywords,
  onContentChange,
  onKeywordRemoved,
  isLoading,
}: ContentEditorProps) {
  const [highlightedContent, setHighlightedContent] = useState('');
  const [editorReady, setEditorReady] = useState(false);

  // Highlight keywords in the content
  useEffect(() => {
    if (!content) {
      setHighlightedContent('');
      return;
    }

    // First ensure the content is valid
    const validContent = ensureValidContent(content);
    
    let processedContent = validContent;
    const selectedKeywords = keywords.filter(k => k.selected).map(k => k.keyword);

    // Sort keywords by length (longest first) to avoid partial matches
    selectedKeywords.sort((a, b) => b.length - a.length);

    // Replace keywords with highlighted versions
    selectedKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      processedContent = processedContent.replace(
        regex,
        `<span style="background-color: #e9f5ff; color: #0066cc; padding: 0 2px; border-radius: 2px;">${keyword}</span>`
      );
    });

    setHighlightedContent(processedContent);
  }, [content, keywords]);

  // Check if keywords are removed from content
  useEffect(() => {
    if (!content) return;

    const selectedKeywords = keywords.filter(k => k.selected);
    
    selectedKeywords.forEach(keywordObj => {
      const keyword = keywordObj.keyword;
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      
      if (!regex.test(content)) {
        // Keyword was removed from content
        onKeywordRemoved(keyword);
      }
    });
  }, [content, keywords, onKeywordRemoved]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Highlight,
      TextStyle,
      Color,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none',
      },
    },
    // Fix for SSR hydration issue
    immediatelyRender: false,
    parseOptions: {
      preserveWhitespace: 'full',
    },
  });

  // Set editor ready state once editor is available
  useEffect(() => {
    if (editor) {
      setEditorReady(true);
    }
  }, [editor]);

  // Update content when editor is ready and content changes
  useEffect(() => {
    if (editor && editorReady && highlightedContent) {
      editor.commands.setContent(highlightedContent, false);
    }
  }, [editor, editorReady, highlightedContent]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 relative">
      <style>{editorStyles}</style>
      <div className="border border-gray-400 rounded-md p-4 min-h-[500px]">
        {isLoading ? (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <FiLoader className="animate-spin text-blue-600 text-2xl mb-2" />
              <span className="text-gray-900">Generating content...</span>
            </div>
          </div>
        ) : null}
        <MenuBar editor={editor} />
        <EditorContent 
          editor={editor} 
          className="prose max-w-none text-gray-900 ProseMirror"
        />
      </div>
      <div className="mt-4 text-sm text-gray-900">
        <p>
          <span className="font-medium">Keywords used:</span>{' '}
          {keywords.filter(k => k.selected).length} of {keywords.length}
        </p>
      </div>
    </div>
  );
} 