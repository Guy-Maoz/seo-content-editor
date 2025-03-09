'use client';

import { useState } from 'react';
import TopicInput from '@/components/topic-input';
import KeywordBank from '@/components/keyword-bank';
import ContentEditor from '@/components/content-editor';
import AIActivityPanel from '@/components/AIActivityPanel';
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
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(false);

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
      const keywordsWithLoadingMetrics = aiData.keywords.map((keyword: { keyword: string }) => ({
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
    
    setIsGeneratingContent(true);
    
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
      
      const newKeywords = data.keywords.filter((k: { keyword: string }) => 
        !existingKeywordTexts.includes(k.keyword.toLowerCase())
      );
      
      console.log('New unique keywords:', newKeywords.length);
      
      if (newKeywords.length > 0) {
        // Enrich and add new keywords to used keywords (instead of suggested)
        const enrichedKeywords = newKeywords.map((k: { keyword: string }) => ({
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
      setIsGeneratingContent(false);
    }
  };

  // Function to fetch more keyword suggestions
  const fetchMoreKeywords = async () => {
    if (!topic.trim()) return;
    
    setIsGeneratingContent(true);
    
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
        const newKeywords = data.keywords.map((k: { keyword: string }) => ({
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
      setIsGeneratingContent(false);
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
  const handleAddToNegative = (keyword: Keyword) => {
    // Check if it's from suggested or used keywords
    const inSuggested = suggestedKeywords.some(k => k.keyword === keyword.keyword);
    
    // Remove from original source
    if (inSuggested) {
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
    <main className="container mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">SEO Content Editor</h1>
        <Link href="/test-tools" className="text-blue-600 hover:underline text-sm">Test Tools</Link>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6 flex items-start">
        <FiInfo className="text-blue-500 mt-1 mr-3 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-blue-800">How to use this editor:</p>
          <ol className="list-decimal pl-5 mt-1 text-blue-700">
            <li>Enter a topic and click &quot;Generate Keywords&quot;</li>
            <li>Select keywords you want to include in your content</li>
            <li>Click &quot;Generate Content&quot; to create SEO-optimized content</li>
            <li>Edit the content as needed - keywords will be highlighted</li>
          </ol>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="border rounded-md p-4 bg-white shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Topic & Keywords</h2>
            <TopicInput 
              topic={topic} 
              onTopicChange={setTopic} 
              onSubmit={handleTopicSubmit} 
              isLoading={isLoadingKeywords}
            />
          </div>
          
          <KeywordBank 
            title="Suggested Keywords" 
            keywords={suggestedKeywords} 
            onToggle={handleSuggestedKeywordToggle} 
            onAddToNegative={handleAddToNegative}
            isLoading={isLoadingKeywords}
            showCheckboxes={true}
          />
          
          <KeywordBank 
            title="Used Keywords" 
            keywords={usedKeywords} 
            onToggle={() => {}} 
            onAddToNegative={handleAddToNegative}
            showCheckboxes={false}
          />
          
          <KeywordBank 
            title="Negative Keywords" 
            keywords={negativeKeywords} 
            onToggle={() => {}} 
            onRemove={handleRemoveFromNegative}
            showCheckboxes={false}
            isNegative={true}
          />
        </div>
        
        <div className="md:col-span-2">
          <ContentEditor
            content={content}
            onContentChange={handleContentChange}
            isLoading={isGeneratingContent}
            usedKeywords={usedKeywords}
            negativeKeywords={negativeKeywords}
            onGenerate={generateContent}
            generateButtonLabel={content ? "Regenerate Content" : "Generate Content"}
            isGenerateDisabled={suggestedKeywords.filter(k => k.selected).length === 0 && usedKeywords.length === 0}
          />
        </div>
      </div>
      
      {/* AI Activity Panel - as a side panel */}
      <AIActivityPanel 
        operations={operations} 
        isOpen={isActivityPanelOpen}
        onToggle={() => setIsActivityPanelOpen(!isActivityPanelOpen)}
      />
    </main>
  );
}
