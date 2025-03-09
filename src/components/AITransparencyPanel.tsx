'use client';

import { useState, useEffect } from 'react';
import { FiInfo, FiCheck, FiLoader, FiAlertCircle } from 'react-icons/fi';

type AIOperation = {
  id: string;
  type: 'keyword-generation' | 'content-creation' | 'keyword-analysis' | 'info';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  message: string;
  detail?: string;
  timestamp: Date;
  progress?: number; // 0-100
};

type AITransparencyPanelProps = {
  operations: AIOperation[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
};

const AITransparencyPanel = ({ 
  operations = [], 
  isExpanded = false, 
  onToggleExpand = () => {} 
}: AITransparencyPanelProps) => {
  const [expanded, setExpanded] = useState(isExpanded);

  useEffect(() => {
    setExpanded(isExpanded);
  }, [isExpanded]);

  const handleToggle = () => {
    setExpanded(!expanded);
    onToggleExpand();
  };

  // Function to determine the icon for each operation type and status
  const getOperationIcon = (operation: AIOperation) => {
    if (operation.status === 'in-progress') {
      return <FiLoader className="animate-spin text-blue-500" />;
    } else if (operation.status === 'completed') {
      return <FiCheck className="text-green-500" />;
    } else if (operation.status === 'failed') {
      return <FiAlertCircle className="text-red-500" />;
    } else {
      return <FiInfo className="text-blue-400" />;
    }
  };

  // Function to get a CSS class based on operation type for visual distinction
  const getOperationClass = (type: AIOperation['type']) => {
    switch (type) {
      case 'keyword-generation':
        return 'border-blue-200 bg-blue-50';
      case 'content-creation':
        return 'border-green-200 bg-green-50';
      case 'keyword-analysis':
        return 'border-purple-200 bg-purple-50';
      case 'info':
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="rounded-md">
      <div 
        className="mb-3 pb-2 border-b border-gray-200 flex justify-between items-center cursor-pointer"
        onClick={handleToggle}
      >
        <span className="text-sm font-medium text-blue-600">Activity Log</span>
        <span className="text-xs text-gray-500">
          {expanded ? 'Hide Details' : 'Show Details'}
        </span>
      </div>

      {expanded ? (
        <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
          {operations.length === 0 ? (
            <p className="text-gray-500 text-center py-6 text-sm">No AI operations recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {operations.map((operation) => (
                <div 
                  key={operation.id} 
                  className={`p-2.5 border rounded-md ${getOperationClass(operation.type)} text-sm`}
                >
                  <div className="flex items-start">
                    <div className="mt-0.5 mr-2">{getOperationIcon(operation)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{operation.message}</div>
                      
                      {operation.detail && (
                        <div className="text-xs text-gray-600 mt-1">{operation.detail}</div>
                      )}
                      
                      {operation.progress !== undefined && operation.status === 'in-progress' && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full" 
                              style={{ width: `${operation.progress}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 text-right">
                            {operation.progress}% complete
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500 mt-1.5">
                        {operation.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-center text-gray-500 py-2">
          {operations.length > 0 ? 
            `${operations.length} operation${operations.length !== 1 ? 's' : ''} in progress or completed` : 
            'No operations recorded'
          }
        </div>
      )}
    </div>
  );
};

export default AITransparencyPanel; 