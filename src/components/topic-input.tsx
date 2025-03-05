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
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400 h-5 w-5" />
          </div>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., content marketing"
            className="block w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-md leading-normal bg-white text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-300 sm:text-base"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          className="whitespace-nowrap px-8 py-2.5 rounded-md text-white bg-blue-400 hover:bg-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-normal text-base"
          disabled={!topic.trim() || isLoading}
        >
          {isLoading ? 'Loading...' : 'Get Keywords'}
        </button>
      </form>
    </div>
  );
} 