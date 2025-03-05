'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { useEffect, useState } from 'react';
import { Keyword } from './keyword-selector';
import { FiLoader, FiType, FiBold, FiItalic, FiList } from 'react-icons/fi';

interface ContentEditorProps {
  content: string;
  keywords: Keyword[];
  onContentChange: (content: string) => void;
  onKeywordRemoved: (keyword: string) => void;
  isLoading: boolean;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="border-b border-gray-200 pb-3 mb-3 flex gap-2">
      <div className="flex items-center gap-1 border-r pr-2 mr-2">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 1 }) ? 'bg-blue-50 text-blue-600' : ''
          }`}
        >
          <span className="font-bold text-lg">H1</span>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 2 }) ? 'bg-blue-50 text-blue-600' : ''
          }`}
        >
          <span className="font-bold">H2</span>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 3 }) ? 'bg-blue-50 text-blue-600' : ''
          }`}
        >
          <span className="font-semibold text-sm">H3</span>
        </button>
        <button
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('paragraph') ? 'bg-blue-50 text-blue-600' : ''
          }`}
        >
          <FiType size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('bold') ? 'bg-blue-50 text-blue-600' : ''
          }`}
        >
          <FiBold size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('italic') ? 'bg-blue-50 text-blue-600' : ''
          }`}
        >
          <FiItalic size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1 border-l pl-2 ml-2">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('bulletList') ? 'bg-blue-50 text-blue-600' : ''
          }`}
        >
          <FiList size={18} />
        </button>
      </div>
    </div>
  );
};

export default function ContentEditor({
  content,
  keywords,
  onContentChange,
  onKeywordRemoved,
  isLoading,
}: ContentEditorProps) {
  const [highlightedContent, setHighlightedContent] = useState(content);

  // Highlight keywords in the content
  useEffect(() => {
    if (!content) return;

    let processedContent = content;
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
      StarterKit,
      Highlight,
      TextStyle,
      Color,
    ],
    content: highlightedContent,
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h1:mb-4 prose-h2:mb-3 prose-h3:mb-2 prose-p:mb-2',
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && highlightedContent) {
      // Only update if the content has changed
      if (editor.getHTML() !== highlightedContent) {
        editor.commands.setContent(highlightedContent);
      }
    }
  }, [editor, highlightedContent]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 relative">
      <div className="border rounded-md p-4 min-h-[500px]">
        {isLoading ? (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <FiLoader className="animate-spin text-blue-600 text-2xl mb-2" />
              <span className="text-gray-900">Generating content...</span>
            </div>
          </div>
        ) : null}
        <MenuBar editor={editor} />
        <EditorContent editor={editor} className="prose max-w-none text-gray-900" />
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