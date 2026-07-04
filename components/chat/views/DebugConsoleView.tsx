import React, { useRef, useEffect } from 'react';
import { useChatStore } from '@/lib/store/chat-store';
import { Terminal, Trash2, Info, AlertTriangle, Bug } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const DebugConsoleView = () => {
  const { debugLogs, clearDebugLogs } = useChatStore();
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [debugLogs]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />;
      case 'warning': return <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" />;
      default: return <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />;
    }
  };

  const getTextColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0f0a1e]">
      <div className="border-b border-white/10 p-4 flex items-center justify-between flex-shrink-0 bg-[#0f0a1e] backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Terminal size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Debug Console
            </h1>
            <p className="text-xs text-gray-400">
              Live orchestration and API event stream logs.
            </p>
          </div>
        </div>
        
        <button
          onClick={clearDebugLogs}
          disabled={debugLogs.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 hover:text-white transition-colors disabled:opacity-50"
        >
          <Trash2 size={14} />
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar font-mono text-[13px]">
        {debugLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
            <Bug size={32} className="mb-3" />
            <p>No debug logs yet.</p>
            <p className="text-xs mt-1">Start a conversation to see real-time events.</p>
          </div>
        ) : (
          <div className="space-y-1.5 pb-8">
            {debugLogs.map((log, index) => (
              <div 
                key={index} 
                className={`flex gap-3 px-3 py-2 rounded-md hover:bg-white/5 transition-colors border-l-2 ${
                  log.type === 'error' ? 'border-red-500 bg-red-500/5' :
                  log.type === 'warning' ? 'border-yellow-500 bg-yellow-500/5' :
                  'border-blue-500/30'
                }`}
              >
                <div className="text-gray-500 flex-shrink-0 whitespace-nowrap opacity-70">
                  {log.timestamp ? formatDate(log.timestamp) : new Date().toLocaleTimeString()}
                </div>
                {getIcon(log.type)}
                <div className={`${getTextColor(log.type)} break-words leading-relaxed`}>
                  {log.message}
                </div>
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};
