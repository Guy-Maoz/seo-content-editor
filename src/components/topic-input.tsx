'use client';

import { useState } from 'react';
import { FiSearch } from 'react-icons/fi';

interface TopicInputProps {
  onSubmit: (topic: string) => void;
  isLoading: boolean;
}

export default function TopicInput({ onSubmit, isLoading }: TopicInputProps) {
  const [topic, setTopic] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      onSubmit(topic.trim());
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., content marketing, SEO strategies, digital marketing"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!topic.trim() || isLoading}
        >
          {isLoading ? 'Loading...' : 'Get Keywords'}
        </button>
      </form>
    </div>
  );
} 