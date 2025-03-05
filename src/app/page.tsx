'use client';

import { useState, useCallback } from 'react';
import TopicInput from '@/components/topic-input';
import KeywordSelector, { Keyword } from '@/components/keyword-selector';
import GenerateButton from '@/components/generate-button';
import ContentEditor from '@/components/content-editor';
import { FiInfo } from 'react-icons/fi';

export default function Home() {
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [content, setContent] = useState('');
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const fetchKeywords = async (topic: string) => {
    setIsLoadingKeywords(true);
    try {
      const response = await fetch('/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch keywords');
      }

      const data = await response.json();
      
      // Add selected property to each keyword
      const keywordsWithSelection = data.keywords.map((keyword: any) => ({
        ...keyword,
        selected: true, // Default all keywords to selected
      }));

      setKeywords(keywordsWithSelection);
      setTopic(topic);
    } catch (error) {
      console.error('Error fetching keywords:', error);
      alert('Failed to fetch keywords. Please try again.');
    } finally {
      setIsLoadingKeywords(false);
    }
  };

  const generateContent = async () => {
    const selectedKeywords = keywords.filter(k => k.selected);
    
    if (selectedKeywords.length === 0 || !topic) {
      return;
    }

    setIsGeneratingContent(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          keywords: selectedKeywords,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const data = await response.json();
      setContent(data.content);
      setIsRegenerating(true);
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Failed to generate content. Please try again.');
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const handleKeywordRemoved = useCallback((removedKeyword: string) => {
    setKeywords(prevKeywords => 
      prevKeywords.map(keyword => 
        keyword.keyword.toLowerCase() === removedKeyword.toLowerCase()
          ? { ...keyword, selected: false }
          : keyword
      )
    );
  }, []);

  const handleKeywordsChange = (updatedKeywords: Keyword[]) => {
    setKeywords(updatedKeywords);
  };

  const handleContentChange = (updatedContent: string) => {
    setContent(updatedContent);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl mb-4">
            AI-Powered SEO Content Editor
          </h1>
          <p className="text-xl text-gray-900 max-w-2xl mx-auto">
            Create SEO-optimized content with AI assistance
          </p>
        </header>

        {/* Instructions Section */}
        <section className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-12 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiInfo className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">How it works</h2>
              <p className="text-base text-gray-900">
                Enter a topic to get keyword suggestions, select the keywords you want to include,
                and generate SEO-optimized content. You can edit the generated content and the
                keywords will stay highlighted.
              </p>
            </div>
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Controls */}
          <section className="lg:col-span-1 space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Topic Selection</h2>
              <TopicInput onSubmit={fetchKeywords} isLoading={isLoadingKeywords} />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Content Generation</h2>
              <GenerateButton
                onGenerate={generateContent}
                isGenerating={isGeneratingContent}
                isRegenerating={isRegenerating}
                hasSelectedKeywords={keywords.some(k => k.selected)}
                hasTopic={!!topic}
              />
            </div>
          </section>

          {/* Right Column - Editor */}
          <section className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Keyword Selection</h2>
              <KeywordSelector
                topic={topic}
                keywords={keywords}
                onKeywordsChange={handleKeywordsChange}
                isLoading={isLoadingKeywords}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Content Editor</h2>
              <ContentEditor
                content={content}
                keywords={keywords}
                onContentChange={handleContentChange}
                onKeywordRemoved={handleKeywordRemoved}
                isLoading={isGeneratingContent}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
