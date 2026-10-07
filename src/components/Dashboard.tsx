import React, { useState } from 'react';
import {
  Layers,
  Split,
  Trash2,
  FileSymlink,
  ArrowUpDown,
  RotateCw,
  Edit3,
  Type,
  Highlighter,
  PenTool,
  CheckSquare,
  Image as ImageIcon,
  FileImage,
  Minimize2,
  Stamp,
  Hash,
  Lock,
  Unlock,
  FileText,
  Search,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe2,
} from 'lucide-react';
import { ToolDefinition, ToolId } from '../types/pdf';
import { TOOLS } from '../data/tools';

interface DashboardProps {
  onSelectTool: (toolId: ToolId) => void;
  onLoadSampleForTool: (toolId: ToolId) => void;
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Layers: <Layers className="w-5 h-5" />,
  Split: <Split className="w-5 h-5" />,
  Trash2: <Trash2 className="w-5 h-5" />,
  FileSymlink: <FileSymlink className="w-5 h-5" />,
  ArrowUpDown: <ArrowUpDown className="w-5 h-5" />,
  RotateCw: <RotateCw className="w-5 h-5" />,
  Edit3: <Edit3 className="w-5 h-5" />,
  Type: <Type className="w-5 h-5" />,
  Highlighter: <Highlighter className="w-5 h-5" />,
  PenTool: <PenTool className="w-5 h-5" />,
  CheckSquare: <CheckSquare className="w-5 h-5" />,
  Image: <ImageIcon className="w-5 h-5" />,
  FileImage: <FileImage className="w-5 h-5" />,
  Minimize2: <Minimize2 className="w-5 h-5" />,
  Stamp: <Stamp className="w-5 h-5" />,
  Hash: <Hash className="w-5 h-5" />,
  Lock: <Lock className="w-5 h-5" />,
  Unlock: <Unlock className="w-5 h-5" />,
  FileText: <FileText className="w-5 h-5" />,
};

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectTool,
  onLoadSampleForTool,
  activeCategory,
  onCategoryChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = TOOLS.filter((tool) => {
    const matchesCategory =
      activeCategory === 'all' || tool.category === activeCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-neutral-900 mb-4">
          All-in-One Free PDF Editor & Toolkit
        </h1>
        <p className="text-base sm:text-lg text-neutral-600 mb-6 text-balance">
          Merge, split, edit, annotate, sign, compress, and convert PDF documents
          directly inside your browser. No registration, no queues, 100% private.
        </p>

        {/* Search Bar & Filter Tabs */}
        <div className="relative max-w-xl mx-auto mb-6">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any tool (e.g., merge, delete pages, sign, watermark)..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-neutral-300 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-sm shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-700 font-medium"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Filter Controls */}
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 p-1 bg-neutral-200/60 rounded-xl">
          {[
            { id: 'all', label: 'All Tools' },
            { id: 'organize', label: 'Organize' },
            { id: 'edit-sign', label: 'Edit & Sign' },
            { id: 'convert', label: 'Convert' },
            { id: 'optimize', label: 'Optimize' },
            { id: 'security', label: 'Security' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeCategory === cat.id
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Tool Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mb-14">
        {filteredTools.map((tool) => (
          <div
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            className="group relative bg-white border border-neutral-200 hover:border-neutral-400 rounded-2xl p-5 transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white text-neutral-800 flex items-center justify-center transition-colors">
                  {ICON_MAP[tool.iconName] || <FileText className="w-5 h-5" />}
                </div>

                {tool.badge && (
                  <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/50">
                    {tool.badge}
                  </span>
                )}
              </div>

              <h3 className="text-base font-semibold text-neutral-900 mb-1 group-hover:text-neutral-950">
                {tool.title}
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                {tool.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-900 group-hover:translate-x-0.5 transition-transform">
                Open Workspace →
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadSampleForTool(tool.id);
                }}
                title="Open this tool immediately with a 3-page sample PDF"
                className="text-[11px] text-neutral-500 hover:text-neutral-900 font-medium px-2 py-1 rounded hover:bg-neutral-100 flex items-center gap-1 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Try sample</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200 max-w-md mx-auto mb-12">
          <p className="text-neutral-500 text-sm mb-3">No tools found matching "{searchQuery}"</p>
          <button
            onClick={() => {
              setSearchQuery('');
              onCategoryChange('all');
            }}
            className="px-4 py-2 text-xs font-semibold text-neutral-900 bg-neutral-100 rounded-lg hover:bg-neutral-200"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Trust & Privacy Section */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="flex gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                Zero Cloud Uploads
              </h4>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Your documents are rendered and processed strictly in your local browser engine. Files never touch any external server.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                Instant Client Execution
              </h4>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Engineered with WebAssembly and client-side PDF.js/PDF-Lib. No server queues or download delays.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
              <Globe2 className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                Completely Free & Account-Free
              </h4>
              <p className="text-xs text-neutral-500 leading-relaxed">
                No credit cards, sign-ups, watermarks, or usage limits. Built to empower everyday users and professionals.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
