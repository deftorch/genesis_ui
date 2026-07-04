import React from 'react';
import { useChatStore } from '@/lib/store/chat-store';
import { LineChart, Zap, Clock, Hash, Activity } from 'lucide-react';

export const AnalysisView = () => {
  const { currentMetrics } = useChatStore();

  return (
    <div className="flex-1 overflow-y-auto bg-transparent p-6 relative">
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <LineChart className="text-[#1a6adf] dark:text-[#60aaff]" />
              Stream Analysis
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Real-time performance metrics and AI generation statistics.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-[#1e468c]/12 dark:border-white/10 flex flex-col items-center justify-center text-center">
            <Clock className="w-8 h-8 text-blue-500 mb-3" />
            <div className="text-3xl font-bold text-slate-800 dark:text-white">
              {currentMetrics?.ttft ? `${currentMetrics.ttft}ms` : '--'}
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">
              Time to First Token
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-[#1e468c]/12 dark:border-white/10 flex flex-col items-center justify-center text-center">
            <Zap className="w-8 h-8 text-yellow-500 mb-3" />
            <div className="text-3xl font-bold text-slate-800 dark:text-white">
              {currentMetrics?.duration ? `${currentMetrics.duration}ms` : '--'}
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">
              Total Duration
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-[#1e468c]/12 dark:border-white/10 flex flex-col items-center justify-center text-center">
            <Hash className="w-8 h-8 text-purple-500 mb-3" />
            <div className="text-3xl font-bold text-slate-800 dark:text-white">
              {currentMetrics?.totalTokens || '--'}
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">
              Total Tokens
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-[#1e468c]/12 dark:border-white/10 flex flex-col items-center justify-center text-center">
            <Activity className="w-8 h-8 text-green-500 mb-3" />
            <div className="text-3xl font-bold text-slate-800 dark:text-white">
              {currentMetrics?.duration && currentMetrics?.totalTokens
                ? (currentMetrics.totalTokens / (currentMetrics.duration / 1000)).toFixed(1)
                : '--'}
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">
              Tokens per Second
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-[#1e468c]/12 dark:border-white/10 p-6 mt-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Detailed Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-white/5">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Prompt Tokens</span>
              <span className="font-mono text-slate-800 dark:text-white font-medium">{currentMetrics?.promptTokens || 0}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-white/5">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Completion Tokens</span>
              <span className="font-mono text-slate-800 dark:text-white font-medium">{currentMetrics?.completionTokens || 0}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Estimated Cost</span>
              <span className="font-mono text-slate-800 dark:text-white font-medium">Free (Local/Preview)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
