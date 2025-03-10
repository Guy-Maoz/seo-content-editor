'use client';

import { useState, useCallback, useEffect } from 'react';
import TopicInput from '@/components/topic-input';
import KeywordBank from '@/components/keyword-bank';
import ContentEditor from '@/components/content-editor';
import AIPanel from '@/components/AIPanel';
import CustomChatAssistant from '@/components/CustomChatAssistant';
import { Keyword } from '@/types/keyword';
import { FiInfo, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import Link from 'next/link';
import { useAITransparency } from '@/contexts/AITransparencyContext';
import { apiFetch } from '@/utils/api';
import { useThreadContext } from '@/contexts/ThreadContext';

export const maxDuration = 300; // 5 minutes

export default function Home() {
  const [topic, setTopic] = useState('');
  const [suggestedKeywords, setSuggestedKeywords] = useState<Keyword[]>([]);
  const [usedKeywords, setUsedKeywords] = useState<Keyword[]>([]);
  const [negativeKeywords, setNegativeKeywords] = useState<Keyword[]>([]);
  const [content, setContent] = useState('');
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isAnalyzingContent, setIsAnalyzingContent] = useState(false);
  const [isLoadingMoreKeywords, setIsLoadingMoreKeywords] = useState(false);
  const [isTransparencyPanelExpanded, setIsTransparencyPanelExpanded] = useState(false);
  const [isSidePanelVisible, setIsSidePanelVisible] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const { threadId } = useThreadContext();

  // Add effect to handle server-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Access the AI transparency context
  const { 
    operations = [], 
    addOperation, 
    updateOperation,
    updateProgress, 
    completeOperation, 
    failOperation,
    clearOperations
  } = useAITransparency();

  // Function to toggle dev mode
  const toggleDevMode = () => {
    setIsDevMode(!isDevMode);
  };

  // Function to clear operations
  const handleClearOperations = () => {
    // Call the clearOperations function from the AITransparencyContext
    clearOperations();
  };

  // Fetch keywords from API based on topic
  const fetchKeywords = async (topicValue: string) => {
    if (!topicValue.trim()) return;
    
    // Reset state
    setTopic(topicValue);
    setSuggestedKeywords([]);
    setUsedKeywords([]);
    setIsLoadingKeywords(true);
    setContent('');
    
    // Create a new operation in the transparency panel
    const operationId = addOperation({
      type: 'keyword-generation',
      status: 'in-progress',
      message: 'Generating keyword suggestions',
      detail: `Searching related keywords for "${topicValue}"...`,
      progress: 10
    });
    
    try {
      updateProgress(operationId, 30);
      
      // Call the API to get keywords
      const response = await fetch('/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          topic: topicValue,
          count: 10,
          threadId // Include thread ID if available
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch keywords');
      }

      updateProgress(operationId, 50);
      updateOperation(operationId, { 
        detail: 'AI keywords received. Enriching with metrics data...' 
      });
      
      const aiData = await response.json();
      
      // Add placeholders for metrics
      const keywordsWithLoadingMetrics = aiData.keywords.map((keyword: any) => ({
        keyword: keyword.keyword,
        volume: 0,
        difficulty: 0,
        cpc: 0,
        selected: false,
        metricsLoading: true,
        source: 'openai'
      }));

      // Set initial keywords
      setSuggestedKeywords(keywordsWithLoadingMetrics);
      
      updateProgress(operationId, 70);
      updateOperation(operationId, { 
        detail: 'Retrieving search metrics for each keyword...' 
      });
      
      // Enrich each keyword with metrics
      for (let i = 0; i < keywordsWithLoadingMetrics.length; i++) {
        const keyword = keywordsWithLoadingMetrics[i];
        try {
          const response = await apiFetch('/api/keywords/single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: keyword.keyword }),
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch metrics for keyword: ${keyword.keyword}`);
          }

          const data = await response.json();
          
          // Calculate progress based on how many keywords we've processed
          const progressIncrement = 20 / keywordsWithLoadingMetrics.length;
          updateProgress(operationId, 70 + (i + 1) * progressIncrement);
          
          // Update the specific keyword with metrics
          setSuggestedKeywords(prevKeywords => {
            const newKeywords = [...prevKeywords];
            const keywordIndex = newKeywords.findIndex(k => k.keyword === keyword.keyword);
            
            if (keywordIndex >= 0) {
              newKeywords[keywordIndex] = {
                ...newKeywords[keywordIndex],
                volume: data.metrics.volume || 0,
                difficulty: data.metrics.difficulty || 0,
                cpc: data.metrics.cpc || 0,
                isFallback: data.metrics.isFallback || false,
                metricsLoading: false
              };
            }
            return newKeywords;
          });
        } catch (error) {
          console.error(`Error enriching keyword "${keyword.keyword}":`, error);
          
          // Mark as loaded but with error
          setSuggestedKeywords(prevKeywords => {
            const newKeywords = [...prevKeywords];
            const keywordIndex = newKeywords.findIndex(k => k.keyword === keyword.keyword);
            
            if (keywordIndex >= 0) {
              newKeywords[keywordIndex] = {
                ...newKeywords[keywordIndex],
                metricsLoading: false,
                error: true
              };
            }
            return newKeywords;
          });
        }
      }
      
      completeOperation(operationId, `Generated ${keywordsWithLoadingMetrics.length} keywords for "${topicValue}"`);
    } catch (error) {
      console.error('Error fetching keywords:', error);
      failOperation(operationId, `Failed to generate keywords: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingKeywords(false);
    }
  };

  // Generate or update content based on selected keywords
  const generateContent = async () => {
    const selectedKeywords = suggestedKeywords.filter(k => k.selected).map(k => k.keyword);
    const usedKeywordsList = usedKeywords.map(k => k.keyword);
    const allKeywords = [...selectedKeywords, ...usedKeywordsList];
    
    if (allKeywords.length === 0) {
      alert('Please select at least one keyword to generate content');
      return;
    }

    setIsGeneratingContent(true);
    
    // Create a new operation in the transparency panel
    const operationId = addOperation({
      type: 'content-creation',
      status: 'in-progress',
      message: 'Generating SEO-optimized content',
      detail: `Creating content with ${allKeywords.length} selected keywords...`,
      progress: 10
    });
    
    try {
      updateOperation(operationId, {
        detail: 'Preparing content generation request...'
      });
      
      const requestBody = {
        topic,
        keywords: allKeywords,
        existingContent: content,
        isUpdate: content.length > 0,
        threadId
      };

      updateProgress(operationId, 30);
      updateOperation(operationId, {
        detail: 'Processing your request with OpenAI...'
      });
      
      const response = await apiFetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      updateProgress(operationId, 70);
      updateOperation(operationId, {
        detail: 'Content generated! Analyzing and formatting...'
      });
      
      const data = await response.json();
      setContent(data.content);
      
      // Move selected suggested keywords to used keywords
      const newlyUsedKeywords = suggestedKeywords.filter(k => k.selected);
      setUsedKeywords(prev => [...prev, ...newlyUsedKeywords]);
      setSuggestedKeywords(prev => prev.filter(k => !k.selected));
      
      // After content is generated, analyze it to extract more keywords
      await analyzeContent(data.content, operationId);
      
      completeOperation(operationId, `Successfully generated ${data.content.length > 500 ? 'comprehensive' : 'brief'} content with ${allKeywords.length} keywords`);
    } catch (error) {
      console.error('Error generating content:', error);
      failOperation(operationId, `Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingContent(false);
    }
  };

  // Analyze content for keyword usage and SEO
  const analyzeContent = async (contentText: string, parentOperationId?: string) => {
    const selectedKeywords = suggestedKeywords.filter(k => k.selected).map(k => k.keyword);
    const usedKeywordsList = usedKeywords.map(k => k.keyword);
    const allKeywords = [...selectedKeywords, ...usedKeywordsList];
    
    // Create a new operation or reuse the parent
    const operationId = parentOperationId || addOperation({
      type: 'keyword-analysis',
      status: 'in-progress',
      message: 'Analyzing content for SEO',
      detail: `Checking usage of ${allKeywords.length} keywords...`,
      progress: 10
    });
    
    try {
      // Update progress
      updateProgress(operationId, 30);
      
      // Call the API
      const response = await fetch('/api/keywords/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: contentText,
          topic: topic,
          threadId // Include the thread ID if available
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze content');
      }

      updateProgress(operationId, 70);
      updateOperation(operationId, {
        detail: 'Processing extracted keywords...'
      });
      
      const data = await response.json();
      console.log('Keywords extracted:', data.keywords ? data.keywords.length : 0, 'keywords found');
      
      // Extract new keywords that aren't already in usedKeywords or negative keywords
      const existingKeywordTexts = [
        ...usedKeywords.map(k => k.keyword.toLowerCase()),
        ...negativeKeywords.map(k => k.keyword.toLowerCase()),
        ...suggestedKeywords.map(k => k.keyword.toLowerCase())
      ];
      
      const newKeywords = data.keywords.filter((k: any) => 
        !existingKeywordTexts.includes(k.keyword.toLowerCase())
      );
      
      console.log('New unique keywords:', newKeywords.length);
      
      if (newKeywords.length > 0) {
        // Enrich and add new keywords to used keywords (instead of suggested)
        const enrichedKeywords = newKeywords.map((k: any) => ({
          keyword: k.keyword,
          volume: 0,
          difficulty: 0,
          cpc: 0,
          selected: true, // Selected by default since they're used
          metricsLoading: true,
          source: 'extracted'
        }));
        
        // Add to used keywords instead of suggested keywords
        setUsedKeywords(prev => [...prev, ...enrichedKeywords]);
        updateOperation(operationId, {
          detail: `Found ${enrichedKeywords.length} keywords used in content. Fetching metrics data...`
        });
        
        // Enrich these keywords with metrics
        for (let i = 0; i < enrichedKeywords.length; i++) {
          const keyword = enrichedKeywords[i];
          try {
            console.log(`Fetching metrics for extracted keyword: ${keyword.keyword}`);
            const response = await apiFetch('/api/keywords/single', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keyword: keyword.keyword }),
            });
            
            if (!response.ok) {
              console.warn(`Failed to get metrics for ${keyword.keyword}`);
              continue;
            }
            
            const data = await response.json();
            console.log(`Metrics received for ${keyword.keyword}:`, data.metrics);
            
            // Update progress as we process each keyword
            const progressIncrement = 25 / enrichedKeywords.length;
            updateProgress(operationId, 70 + (i + 1) * progressIncrement);
            
            // Update the keyword with metrics
            setUsedKeywords(prev => {
              const updatedKeywords = [...prev];
              const keywordIndex = updatedKeywords.findIndex(k => 
                k.keyword === keyword.keyword && k.source === 'extracted'
              );
              
              if (keywordIndex >= 0) {
                updatedKeywords[keywordIndex] = {
                  ...updatedKeywords[keywordIndex],
                  volume: data.metrics?.volume || 0,
                  difficulty: data.metrics?.difficulty || 0,
                  cpc: data.metrics?.cpc || 0,
                  metricsLoading: false
                };
              }
              return updatedKeywords;
            });
          } catch (error) {
            console.error(`Error enriching extracted keyword "${keyword.keyword}":`, error);
          }
        }
        
        // Find more related keywords based on the analyzed content
        setTimeout(() => {
          console.log('Fetching additional related keywords...');
          fetchMoreKeywords();
        }, 500); // Small delay to ensure UI updates first
        
        completeOperation(operationId, `Added ${newKeywords.length} keywords from your content to the Used Keywords list`);
      } else {
        completeOperation(operationId, 'Content analyzed, no new keywords found');
      }
    } catch (error) {
      console.error('Error analyzing content:', error);
      failOperation(operationId, `Failed to analyze content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzingContent(false);
    }
  };

  // Function to fetch more keyword suggestions
  const fetchMoreKeywords = async () => {
    if (!topic.trim()) return;
    
    setIsLoadingMoreKeywords(true);
    
    // Create a new operation in the transparency panel
    const operationId = addOperation({
      type: 'keyword-generation',
      status: 'in-progress',
      message: 'Finding additional keyword opportunities',
      detail: 'Requesting additional keywords based on your selections...',
      progress: 20
    });
    
    try {
      const usedKeywordsList = usedKeywords.map(k => k.keyword);
      const negativeKeywordsList = negativeKeywords.map(k => k.keyword);
      
      updateProgress(operationId, 40);
      
      const response = await apiFetch('/api/keywords/more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic,
          usedKeywords: usedKeywordsList,
          negativeKeywords: negativeKeywordsList
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch more keywords');
      }

      updateProgress(operationId, 70);
      updateOperation(operationId, {
        detail: 'Processing additional keyword suggestions...'
      });
      
      const data = await response.json();
      
      if (data.keywords && data.keywords.length > 0) {
        // Add the new keywords to the suggested list
        const newKeywords = data.keywords.map((k: any) => ({
          keyword: k.keyword,
          volume: 0,
          difficulty: 0,
          cpc: 0,
          selected: false,
          metricsLoading: true,
          source: 'additional'
        }));
        
        // Append to suggested keywords
        setSuggestedKeywords(prev => [...prev, ...newKeywords]);
        
        // Enrich these keywords with metrics
        for (let i = 0; i < newKeywords.length; i++) {
          const keyword = newKeywords[i];
          try {
            const response = await apiFetch('/api/keywords/single', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keyword: keyword.keyword }),
            });
            
            if (!response.ok) {
              continue;
            }
            
            const data = await response.json();
            
            // Update progress as we process each keyword
            const progressIncrement = 25 / newKeywords.length;
            updateProgress(operationId, 70 + (i + 1) * progressIncrement);
            
            // Update this keyword with metrics
            setSuggestedKeywords(prev => {
              const updatedKeywords = [...prev];
              const keywordIndex = updatedKeywords.findIndex(k => 
                k.keyword === keyword.keyword && k.source === 'additional'
              );
              
              if (keywordIndex >= 0) {
                updatedKeywords[keywordIndex] = {
                  ...updatedKeywords[keywordIndex],
                  volume: data.metrics?.volume || 0,
                  difficulty: data.metrics?.difficulty || 0,
                  cpc: data.metrics?.cpc || 0,
                  metricsLoading: false
                };
              }
              return updatedKeywords;
            });
          } catch (error) {
            console.error(`Error enriching additional keyword "${keyword.keyword}":`, error);
          }
        }
        
        completeOperation(operationId, `Found ${newKeywords.length} additional keyword suggestions`);
      } else {
        completeOperation(operationId, 'No additional keywords found');
      }
    } catch (error) {
      console.error('Error fetching more keywords:', error);
      failOperation(operationId, `Failed to find additional keywords: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingMoreKeywords(false);
    }
  };

  // Handle topic submission
  const handleTopicSubmit = (topicValue: string) => {
    setTopic(topicValue);
    setContent('');
    setUsedKeywords([]);
    setNegativeKeywords([]);
    fetchKeywords(topicValue);
  };

  // Handle selecting/deselecting suggested keywords
  const handleSuggestedKeywordToggle = (keyword: Keyword) => {
    setSuggestedKeywords(prev => 
      prev.map(k => k.keyword === keyword.keyword ? { ...k, selected: !k.selected } : k)
    );
  };

  // Move keyword to negative list
  const handleAddToNegative = (keyword: Keyword, source: 'suggested' | 'used') => {
    // Remove from original source
    if (source === 'suggested') {
      setSuggestedKeywords(prev => prev.filter(k => k.keyword !== keyword.keyword));
    } else {
      setUsedKeywords(prev => prev.filter(k => k.keyword !== keyword.keyword));
    }
    
    // Add to negative keywords
    setNegativeKeywords(prev => [...prev, { ...keyword, selected: false }]);
  };

  // Remove from negative keywords
  const handleRemoveFromNegative = (keyword: Keyword) => {
    setNegativeKeywords(prev => prev.filter(k => k.keyword !== keyword.keyword));
    setSuggestedKeywords(prev => [...prev, { ...keyword, selected: false }]);
  };

  // Handle content changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  // If not client-side yet, render a simplified version of the UI without operations to avoid SSR issues
  if (!isClient) {
    return (
      <main className="container mx-auto px-4 py-8 relative">
        <h1 className="text-3xl font-bold mb-8 text-center">AI-Powered SEO Content Editor</h1>
        <div className="mb-6">
          <TopicInput onSubmit={handleTopicSubmit} isLoading={isLoadingKeywords} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <KeywordBank 
              suggestedKeywords={[]}
              usedKeywords={[]}
              negativeKeywords={[]}
              onSuggestedKeywordToggle={handleSuggestedKeywordToggle}
              onAddToNegative={handleAddToNegative}
              onRemoveFromNegative={handleRemoveFromNegative}
              isLoading={isLoadingKeywords}
            />
          </div>
          <div className="lg:col-span-2">
            <div className="border border-gray-300 rounded-md p-4 mb-4">
              <ContentEditor 
                content={''} 
                onContentChange={handleContentChange}
                isLoading={false}
                usedKeywords={[]}
                negativeKeywords={[]}
                onGenerate={() => {}}
                generateButtonLabel={'Generate Content'}
                isGenerateDisabled={true}
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 relative flex">
      {/* Main content area */}
      <div className={`flex-grow transition-all duration-300 ${isSidePanelVisible ? 'mr-80' : 'mr-0'}`}>
        <h1 className="text-3xl font-bold mb-8 text-center">AI-Powered SEO Content Editor</h1>
        
        <div className="mb-6">
          <TopicInput onSubmit={handleTopicSubmit} isLoading={isLoadingKeywords} />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <KeywordBank 
              suggestedKeywords={suggestedKeywords}
              usedKeywords={usedKeywords}
              negativeKeywords={negativeKeywords}
              onSuggestedKeywordToggle={handleSuggestedKeywordToggle}
              onAddToNegative={handleAddToNegative}
              onRemoveFromNegative={handleRemoveFromNegative}
              isLoading={isLoadingKeywords}
            />
          </div>
          
          <div className="lg:col-span-2">
            <div className="border border-gray-300 rounded-md p-4 mb-4">
              <ContentEditor 
                content={content} 
                onContentChange={handleContentChange}
                isLoading={isGeneratingContent}
                usedKeywords={usedKeywords}
                negativeKeywords={negativeKeywords}
                onGenerate={generateContent}
                generateButtonLabel={content ? "Improve Content" : "Generate Content"}
                isGenerateDisabled={!topic || (suggestedKeywords.filter(k => k.selected).length === 0 && usedKeywords.length === 0)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Toggle button for side panel */}
      <button 
        onClick={() => setIsSidePanelVisible(!isSidePanelVisible)}
        className="fixed right-0 top-1/2 transform -translate-y-1/2 bg-blue-50 border-blue-200 border-l border-t border-b rounded-l-md p-2 z-50 shadow-md"
        aria-label={isSidePanelVisible ? "Hide AI Panel" : "Show AI Panel"}
        title={isSidePanelVisible ? "Hide AI Panel" : "Show AI Panel"}
      >
        {isSidePanelVisible ? <FiChevronRight /> : <FiChevronLeft />}
      </button>
      
      {/* Side panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg z-40 transition-transform duration-300 transform ${isSidePanelVisible ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}
      >
        <div className="p-4 sticky top-0 bg-white border-b border-gray-200 z-10">
          <h2 className="text-xl font-semibold flex items-center">
            <FiInfo className="mr-2 text-blue-500" /> 
            AI Assistant
          </h2>
          <p className="text-sm text-gray-600 mt-1">Ask questions or request SEO assistance</p>
        </div>
        
        {/* Middle scrollable content - CustomChatAssistant */}
        <div className="p-4 flex-1 overflow-hidden">
          <CustomChatAssistant />
        </div>
          
        {/* Developer Tools - Fixed to bottom */}
        <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0">
          <h3 className="text-sm font-medium mb-2">Developer Tools</h3>
          <div className="space-y-2">
            <button 
              onClick={handleClearOperations}
              className="w-full text-xs py-1 px-2 bg-gray-100 hover:bg-gray-200 rounded text-left"
            >
              Clear Operations
            </button>
            <button 
              onClick={toggleDevMode}
              className={`w-full text-xs py-1 px-2 ${isDevMode ? 'bg-blue-100 hover:bg-blue-200' : 'bg-gray-100 hover:bg-gray-200'} rounded text-left`}
            >
              {isDevMode ? 'Disable Dev Mode' : 'Enable Dev Mode'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
