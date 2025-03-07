'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import { useEffect } from 'react';
import { FiLoader, FiType, FiBold, FiItalic, FiList, FiLink, FiCode } from 'react-icons/fi';

interface ContentEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  isLoading: boolean;
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="border-b border-gray-300 pb-3 mb-3 flex flex-wrap gap-2 menu-bar">
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-2">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 1 }) ? 'bg-blue-50 text-blue-600 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Heading 1"
        >
          <span className="font-bold text-lg">H1</span>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 2 }) ? 'bg-blue-50 text-blue-600 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Heading 2"
        >
          <span className="font-bold">H2</span>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 3 }) ? 'bg-blue-50 text-blue-600 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Heading 3"
        >
          <span className="font-semibold text-sm">H3</span>
        </button>
        <button
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('paragraph') ? 'bg-blue-50 text-blue-600 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Paragraph"
        >
          <FiType size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-2">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('bold') ? 'bg-blue-50 text-blue-600 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Bold"
        >
          <FiBold size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('italic') ? 'bg-blue-50 text-blue-600 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Italic"
        >
          <FiItalic size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('bulletList') ? 'bg-blue-50 text-blue-600 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Bullet List"
        >
          <FiList size={18} />
        </button>
        <button
          onClick={() => {
            const url = window.prompt('Enter URL');
            if (url) {
              editor.commands.setLink({ href: url });
            }
          }}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('link') ? 'bg-blue-50 text-blue-600 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Add Link"
        >
          <FiLink size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${
            editor.isActive('codeBlock') ? 'bg-blue-50 text-blue-600 border border-blue-300' : 'border border-gray-300 text-gray-700'
          }`}
          title="Code Block"
        >
          <FiCode size={18} />
        </button>
      </div>
    </div>
  );
};

export default function ContentEditor({
  content,
  onContentChange,
  isLoading,
}: ContentEditorProps) {
  // Configure the editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: content || '<p>Your content will appear here after generation</p>',
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'outline-none prose prose-sm sm:prose lg:prose-lg prose-slate prose-h1:text-xl prose-h2:text-lg prose-h3:text-base mx-auto focus:outline-none min-h-[300px] max-w-none',
      },
    },
  });

  // Update content when it changes from props
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Make editor read-only when loading
  useEffect(() => {
    if (editor) {
      editor.setEditable(!isLoading);
    }
  }, [isLoading, editor]);

  return (
    <div className="content-editor-container">
      <h3 className="font-medium text-gray-800 mb-4 text-lg">Content Editor</h3>
      
      {editor && <MenuBar editor={editor} />}
      
      <div className={`relative ${isLoading ? 'opacity-70' : ''}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 z-10">
            <div className="bg-white p-4 rounded-lg shadow-md flex items-center">
              <FiLoader className="animate-spin text-blue-500 mr-3" size={24} />
              <span className="text-blue-600 font-medium">Generating content...</span>
            </div>
          </div>
        )}
        
        <div className="border border-gray-200 rounded-md p-4 min-h-[500px] bg-white">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
} 