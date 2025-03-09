'use client';

import { useState, useCallback, useEffect } from 'react';
import TopicInput from '@/components/topic-input';
import KeywordBank from '@/components/keyword-bank';
import ContentEditor from '@/components/content-editor';
import AITransparencyPanel from '@/components/AITransparencyPanel';
import { Keyword } from '@/types/keyword';
import { FiInfo } from 'react-icons/fi';
import Link from 'next/link';
import { useAITransparency } from '@/contexts/AITransparencyContext';
import { apiFetch } from '@/utils/api';

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

  // Access the AI transparency context
  const { 
    operations, 
    addOperation, 
    updateOperation,
    updateProgress, 
    completeOperation, 
    failOperation 
  } = useAITransparency();

  // Fetch keywords from API based on topic
  const fetchKeywords = async (topicValue: string) => {
    if (!topicValue.trim()) return;
    
    setIsLoadingKeywords(true);
    setSuggestedKeywords([]);
    
    // Create a new operation in the transparency panel
    const operationId = addOperation({
      type: 'keyword-generation',
      status: 'in-progress',
      message: `Generating keywords for topic: "${topicValue}"`,
      detail: 'Requesting keyword suggestions from AI...',
      progress: 10
    });
    
    try {
      // Initial AI keywords request
      updateProgress(operationId, 30);
      updateOperation(operationId, { 
        detail: 'Retrieving keyword suggestions from OpenAI...' 
      });
      
      const aiResponse = await apiFetch('/api/keywords/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicValue }),
      });

      if (!aiResponse.ok) {
        throw new Error('Failed to fetch AI keywords');
      }

      updateProgress(operationId, 50);
      updateOperation(operationId, { 
        detail: 'AI keywords received. Enriching with metrics data...' 
      });
      
      const aiData = await aiResponse.json();
      
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
      setTopic(topicValue);
      
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
        isUpdate: content.length > 0
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

  // Analyze content to extract used keywords
  const analyzeContent = async (contentText: string, parentOperationId?: string) => {
    if (!contentText.trim()) return;
    
    setIsAnalyzingContent(true);
    
    // Create a new operation or use a child operation format if part of a parent operation
    const operationId = parentOperationId 
      ? addOperation({
          type: 'keyword-analysis',
          status: 'in-progress',
          message: 'Analyzing generated content',
          detail: 'Extracting keyword opportunities from content...',
          progress: 10
        })
      : addOperation({
          type: 'keyword-analysis',
          status: 'in-progress',
          message: 'Analyzing content for keywords',
          detail: 'Processing content text...',
          progress: 10
        });
    
    try {
      updateProgress(operationId, 30);
      updateOperation(operationId, {
        detail: 'Sending content to AI for keyword extraction...'
      });
      
      console.log(`Analyzing content for keywords: ${contentText.substring(0, 100)}...`);
      
      const response = await apiFetch('/api/keywords/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentText, topic }),
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
        // Enrich and add new keywords to suggested keywords
        const enrichedKeywords = newKeywords.map((k: any) => ({
          keyword: k.keyword,
          volume: 0,
          difficulty: 0,
          cpc: 0,
          selected: false,
          metricsLoading: true,
          source: 'extracted'
        }));
        
        // Add to suggested keywords
        setSuggestedKeywords(prev => [...prev, ...enrichedKeywords]);
        updateOperation(operationId, {
          detail: `Found ${enrichedKeywords.length} new keywords. Fetching metrics data...`
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
            setSuggestedKeywords(prev => {
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
        
        completeOperation(operationId, `Extracted ${newKeywords.length} additional keyword opportunities from content`);
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

  return (
    <main className="container mx-auto px-4 py-8">
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

      <div className="mt-6 text-center">
        <div className="p-4 bg-gray-100 rounded-lg max-w-3xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Developer Tools</h3>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/test-tools" 
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-4 py-2 rounded-md border border-blue-200 transition-colors"
            >
              SEO Assistant Tools
            </Link>
            <Link 
              href="/test-tools/diagnostic" 
              className="text-green-600 hover:text-green-800 hover:bg-green-50 px-4 py-2 rounded-md border border-green-200 transition-colors"
            >
              Assistant Diagnostic Tool
            </Link>
          </div>
        </div>
      </div>

      {/* AI Transparency Panel */}
      <div className="mt-8">
        <AITransparencyPanel 
          operations={operations} 
          isExpanded={isTransparencyPanelExpanded}
          onToggleExpand={() => setIsTransparencyPanelExpanded(!isTransparencyPanelExpanded)}
        />
      </div>
    </main>
  );
}
