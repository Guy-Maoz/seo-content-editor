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
    <div>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-500" />
          </div>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., content marketing, SEO strategies"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:placeholder-gray-400 sm:text-base"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-md text-white bg-blue-400 hover:bg-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!topic.trim() || isLoading}
        >
          {isLoading ? 'Loading...' : 'Get Keywords'}
        </button>
      </form>
    </div>
  );
} 