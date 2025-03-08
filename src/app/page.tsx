'use client';

import { useState, useCallback, useEffect } from 'react';
import TopicInput from '@/components/topic-input';
import KeywordBank from '@/components/keyword-bank';
import ContentEditor from '@/components/content-editor';
import { Keyword } from '@/types/keyword';
import { FiInfo } from 'react-icons/fi';
import Link from 'next/link';

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

  // Fetch keywords from API based on topic
  const fetchKeywords = async (topicValue: string) => {
    if (!topicValue.trim()) return;
    
    setIsLoadingKeywords(true);
    setSuggestedKeywords([]);
    
    try {
      // Initial AI keywords request - now using Netlify function
      const aiResponse = await fetch('/.netlify/functions/keywords-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicValue }),
      });

      if (!aiResponse.ok) {
        throw new Error('Failed to fetch AI keywords');
      }

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
      
      // Enrich each keyword with metrics
      for (let i = 0; i < keywordsWithLoadingMetrics.length; i++) {
        const keyword = keywordsWithLoadingMetrics[i];
        try {
          const response = await fetch('/.netlify/functions/keywords-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: keyword.keyword }),
          });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.metrics) {
              // Update this keyword with metrics
              setSuggestedKeywords(prevKeywords => {
                const newKeywords = [...prevKeywords];
                const keywordIndex = newKeywords.findIndex(k => k.keyword === keyword.keyword);
                
                if (keywordIndex >= 0) {
                  newKeywords[keywordIndex] = {
                    ...newKeywords[keywordIndex],
                    volume: data.metrics.volume || 0,
                    difficulty: data.metrics.difficulty || 0,
                    cpc: data.metrics.cpc || 0,
                    metricsLoading: false,
                    source: 'similarweb'
                  };
                }
                return newKeywords;
              });
            } else {
              // Mark as loaded but keep OpenAI data
              setSuggestedKeywords(prevKeywords => {
                const newKeywords = [...prevKeywords];
                const keywordIndex = newKeywords.findIndex(k => k.keyword === keyword.keyword);
                
                if (keywordIndex >= 0) {
                  newKeywords[keywordIndex] = {
                    ...newKeywords[keywordIndex],
                    metricsLoading: false
                  };
                }
                return newKeywords;
              });
            }
          }
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
    } catch (error) {
      console.error('Error fetching keywords:', error);
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
    
    try {
      const requestBody = {
        topic,
        keywords: allKeywords,
        existingContent: content,
        isUpdate: content.length > 0
      };

      const response = await fetch('/.netlify/functions/content-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const data = await response.json();
      setContent(data.content);
      
      // Move selected suggested keywords to used keywords
      const newlyUsedKeywords = suggestedKeywords.filter(k => k.selected);
      setUsedKeywords(prev => [...prev, ...newlyUsedKeywords]);
      setSuggestedKeywords(prev => prev.filter(k => !k.selected));
      
      // After content is generated, analyze it to extract more keywords
      await analyzeContent(data.content);
    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setIsGeneratingContent(false);
    }
  };

  // Analyze content to extract used keywords
  const analyzeContent = async (contentText: string) => {
    if (!contentText.trim()) return;
    
    setIsAnalyzingContent(true);
    
    try {
      const response = await fetch('/.netlify/functions/keywords-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentText, topic }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze content');
      }

      const data = await response.json();
      
      // Extract new keywords that aren't already in usedKeywords
      const existingKeywordTexts = usedKeywords.map(k => k.keyword.toLowerCase());
      const newKeywords = data.keywords.filter((k: any) => 
        !existingKeywordTexts.includes(k.keyword.toLowerCase())
      );
      
      // Enrich and add new keywords to usedKeywords
      for (const keyword of newKeywords) {
        setUsedKeywords(prev => [...prev, {
          keyword: keyword.keyword,
          volume: 0,
          difficulty: 0,
          cpc: 0,
          selected: true,
          metricsLoading: true,
          source: 'extracted'
        }]);

        // Enrich keyword with metrics
        try {
          const response = await fetch('/.netlify/functions/keywords-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: keyword.keyword }),
          });
          
          if (response.ok) {
            const data = await response.json();
            
            setUsedKeywords(prev => {
              const newUsedKeywords = [...prev];
              const keywordIndex = newUsedKeywords.findIndex(k => 
                k.keyword.toLowerCase() === keyword.keyword.toLowerCase() && k.source === 'extracted'
              );
              
              if (keywordIndex >= 0 && data.metrics) {
                newUsedKeywords[keywordIndex] = {
                  ...newUsedKeywords[keywordIndex],
                  volume: data.metrics.volume || 0,
                  difficulty: data.metrics.difficulty || 0,
                  cpc: data.metrics.cpc || 0,
                  metricsLoading: false,
                  source: 'similarweb'
                };
              } else if (keywordIndex >= 0) {
                newUsedKeywords[keywordIndex] = {
                  ...newUsedKeywords[keywordIndex],
                  metricsLoading: false
                };
              }
              
              return newUsedKeywords;
            });
          }
        } catch (error) {
          console.error(`Error enriching extracted keyword "${keyword.keyword}":`, error);
        }
      }
      
      // Find more related keywords based on the analyzed content
      fetchMoreKeywords();
    } catch (error) {
      console.error('Error analyzing content:', error);
    } finally {
      setIsAnalyzingContent(false);
    }
  };

  // Function to fetch more keyword suggestions
  const fetchMoreKeywords = async () => {
    if (!topic.trim()) return;
    
    setIsLoadingMoreKeywords(true);
    
    try {
      const usedKeywordsList = usedKeywords.map(k => k.keyword);
      const negativeKeywordsList = negativeKeywords.map(k => k.keyword);
      
      const response = await fetch('/.netlify/functions/keywords-more', {
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

      const data = await response.json();
      
      // Filter out keywords that are already in used or suggested lists
      const existingKeywords = [
        ...suggestedKeywords.map(k => k.keyword.toLowerCase()),
        ...usedKeywords.map(k => k.keyword.toLowerCase()),
        ...negativeKeywords.map(k => k.keyword.toLowerCase())
      ];
      
      const newKeywords = data.keywords
        .filter((k: any) => !existingKeywords.includes(k.keyword.toLowerCase()))
        .map((keyword: any) => ({
          keyword: keyword.keyword,
          volume: 0,
          difficulty: 0,
          cpc: 0,
          selected: false,
          metricsLoading: true,
          source: 'openai'
        }));
      
      if (newKeywords.length > 0) {
        setSuggestedKeywords(prev => [...prev, ...newKeywords]);
        
        // Enrich the new keywords
        for (let i = 0; i < newKeywords.length; i++) {
          const keyword = newKeywords[i];
          try {
            const response = await fetch('/.netlify/functions/keywords-single', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keyword: keyword.keyword }),
            });
            
            if (response.ok) {
              const data = await response.json();
              
              if (data.metrics) {
                // Update the keyword with metrics
                setSuggestedKeywords(prevKeywords => {
                  const newSuggestedKeywords = [...prevKeywords];
                  const keywordIndex = newSuggestedKeywords.findIndex(k => 
                    k.keyword.toLowerCase() === keyword.keyword.toLowerCase()
                  );
                  
                  if (keywordIndex >= 0) {
                    newSuggestedKeywords[keywordIndex] = {
                      ...newSuggestedKeywords[keywordIndex],
                      volume: data.metrics.volume || 0,
                      difficulty: data.metrics.difficulty || 0,
                      cpc: data.metrics.cpc || 0,
                      metricsLoading: false,
                      source: 'similarweb'
                    };
                  }
                  
                  return newSuggestedKeywords;
                });
              } else {
                // Mark as loaded but keep OpenAI data
                setSuggestedKeywords(prevKeywords => {
                  const newSuggestedKeywords = [...prevKeywords];
                  const keywordIndex = newSuggestedKeywords.findIndex(k => 
                    k.keyword.toLowerCase() === keyword.keyword.toLowerCase()
                  );
                  
                  if (keywordIndex >= 0) {
                    newSuggestedKeywords[keywordIndex] = {
                      ...newSuggestedKeywords[keywordIndex],
                      metricsLoading: false
                    };
                  }
                  
                  return newSuggestedKeywords;
                });
              }
            }
          } catch (error) {
            console.error(`Error enriching keyword "${keyword.keyword}":`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching more keywords:', error);
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
    </main>
  );
}
