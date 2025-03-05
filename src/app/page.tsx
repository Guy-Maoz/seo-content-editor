'use client';

import { useState, useCallback, useEffect } from 'react';
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
  const [isEnrichingKeywords, setIsEnrichingKeywords] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const fetchKeywords = async (topic: string) => {
    setIsLoadingKeywords(true);
    try {
      // Get keywords from OpenAI
      const aiResponse = await fetch('/api/keywords/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic }),
      });

      if (!aiResponse.ok) {
        throw new Error('Failed to fetch AI keywords');
      }

      const aiData = await aiResponse.json();
      
      // Add loading state to metrics only (not the entire keyword)
      const keywordsWithLoadingMetrics = aiData.keywords.map((keyword: any) => ({
        ...keyword,
        selected: true,
        metricsLoading: true, // Only metrics are loading
        source: 'openai'
      }));

      // Set these initial keywords immediately
      setKeywords(keywordsWithLoadingMetrics);
      setTopic(topic);
      setIsLoadingKeywords(false);
      
      // Start enriching keywords one by one
      setIsEnrichingKeywords(true);
      
      // Enrich each keyword individually and update the state as each one completes
      for (let i = 0; i < keywordsWithLoadingMetrics.length; i++) {
        const keyword = keywordsWithLoadingMetrics[i];
        try {
          console.log(`Fetching SimilarWeb data for keyword: "${keyword.keyword}"`);
          
          // Fetch data for this specific keyword
          const response = await fetch('/api/keywords/single', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ keyword: keyword.keyword }),
          });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.metrics) {
              console.log(`✅ Got SimilarWeb data for "${keyword.keyword}": volume=${data.metrics.volume}, difficulty=${data.metrics.difficulty}, cpc=${data.metrics.cpc}`);
              
              // Update just this keyword in the state
              setKeywords(prevKeywords => {
                const newKeywords = [...prevKeywords];
                newKeywords[i] = {
                  ...newKeywords[i],
                  volume: data.metrics.volume || newKeywords[i].volume,
                  difficulty: data.metrics.difficulty || newKeywords[i].difficulty,
                  cpc: data.metrics.cpc || newKeywords[i].cpc,
                  metricsLoading: false,
                  source: 'similarweb'
                };
                return newKeywords;
              });
            } else {
              console.log(`❌ No SimilarWeb data for "${keyword.keyword}", using OpenAI estimates`);
              // Mark as loaded but keep OpenAI data
              setKeywords(prevKeywords => {
                const newKeywords = [...prevKeywords];
                newKeywords[i] = {
                  ...newKeywords[i],
                  metricsLoading: false
                };
                return newKeywords;
              });
            }
          } else {
            // Mark as loaded but keep OpenAI data on error
            setKeywords(prevKeywords => {
              const newKeywords = [...prevKeywords];
              newKeywords[i] = {
                ...newKeywords[i],
                metricsLoading: false
              };
              return newKeywords;
            });
          }
          
          // Small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error enriching keyword "${keyword.keyword}":`, error);
          
          // Mark as loaded but keep OpenAI data on error
          setKeywords(prevKeywords => {
            const newKeywords = [...prevKeywords];
            newKeywords[i] = {
              ...newKeywords[i],
              metricsLoading: false
            };
            return newKeywords;
          });
          
          // Still add a delay after an error
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      setIsEnrichingKeywords(false);
    } catch (error) {
      console.error('Error fetching keywords:', error);
      alert('Failed to fetch keywords. Please try again.');
      setIsLoadingKeywords(false);
      setIsEnrichingKeywords(false);
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
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <header className="text-center mb-6">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl mb-3">
            AI-Powered SEO Content Editor
          </h1>
          <p className="text-xl text-gray-900 max-w-3xl mx-auto">
            Create SEO-optimized content with AI assistance
          </p>
        </header>

        {/* Instructions Section */}
        <section className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded-md max-w-4xl mx-auto">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiInfo className="h-6 w-6 text-blue-600 sidebar-icon" />
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

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-7 gap-6 lg:gap-8 lg:min-h-[800px]">
          {/* Left Column - Keywords */}
          <section className="lg:col-span-1 xl:col-span-2 flex flex-col">
            <div className="bg-white p-5 rounded-lg shadow-md h-full flex flex-col stats-card">
              {/* Topic Input */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Topic</h3>
                <TopicInput onSubmit={fetchKeywords} isLoading={isLoadingKeywords} />
              </div>
              
              {/* Keywords */}
              <div className="mt-6 flex-grow">
                <KeywordSelector
                  topic={topic}
                  keywords={keywords}
                  onKeywordsChange={handleKeywordsChange}
                  isLoading={isLoadingKeywords}
                  isEnriching={isEnrichingKeywords}
                />
              </div>
            </div>
          </section>

          {/* Right Column - Editor */}
          <section className="lg:col-span-2 xl:col-span-5 flex flex-col">
            <div className="bg-white p-5 rounded-lg shadow-md h-full flex flex-col stats-card">
              {/* Generate Button */}
              <div className="mb-6">
                <GenerateButton
                  onGenerate={generateContent}
                  isGenerating={isGeneratingContent}
                  isRegenerating={isRegenerating}
                  hasSelectedKeywords={keywords.some(k => k.selected)}
                  hasTopic={!!topic}
                />
              </div>
              
              {/* Content Editor */}
              <div className="flex-grow">
                <ContentEditor
                  content={content}
                  keywords={keywords}
                  onContentChange={handleContentChange}
                  onKeywordRemoved={handleKeywordRemoved}
                  isLoading={isGeneratingContent}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
