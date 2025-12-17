import React, { useState, useRef, useEffect } from 'react';
import { ImageFile, FilterState, DEFAULT_FILTERS } from '../types';
import { Button } from './ui/Button';
import { Slider } from './ui/Slider';
import { applyFiltersToCanvas, downloadImage } from '../utils/imageUtils';
import { editImageWithGemini } from '../services/geminiService';
import { Sparkles, Download, RotateCcw, Wand2, ArrowLeft } from 'lucide-react';

interface EditorWorkspaceProps {
  image: ImageFile;
  onBack: () => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({ image, onBack }) => {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(image.url);
  const [history, setHistory] = useState<string[]>([image.url]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // We use this key to force re-render of the image when filters change if needed,
  // but CSS filters handle real-time preview efficiently.
  
  const addToHistory = (newUrl: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newUrl);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentImageUrl(newUrl);
    // Reset filters after AI edit because the new image has the effect "baked in"
    setFilters(DEFAULT_FILTERS);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentImageUrl(history[historyIndex - 1]);
      setFilters(DEFAULT_FILTERS);
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) return;
    setIsProcessing(true);
    try {
      // 1. First, apply current CSS filters to get the "base" image for AI
      const baseImage = await applyFiltersToCanvas(currentImageUrl, filters);
      
      // 2. Send to Gemini
      const editedBase64 = await editImageWithGemini(baseImage, aiPrompt);
      
      // 3. Update state
      addToHistory(editedBase64);
      setAiPrompt('');
    } catch (error) {
      alert("AI Editing failed. Please try again.");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    try {
      const finalImage = await applyFiltersToCanvas(currentImageUrl, filters);
      downloadImage(finalImage, `pixelai-edit-${Date.now()}.jpg`);
    } catch (e) {
      console.error(e);
      alert("Failed to download image");
    }
  };

  const filterStyle: React.CSSProperties = {
    filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) blur(${filters.blur}px) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)`,
    transition: 'filter 0.1s ease-out',
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-slate-900">
      {/* Left Sidebar: Controls */}
      <div className="w-80 flex-shrink-0 border-r border-slate-700 bg-slate-800 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-white">Điều chỉnh</h2>
            <Button variant="ghost" size="sm" onClick={onBack} className="!px-2">
                <ArrowLeft size={16} />
            </Button>
        </div>
        
        <div className="p-4 space-y-6">
          {/* Basic Adjustments */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Cơ bản</h3>
            <Slider label="Độ sáng" min={0} max={200} value={filters.brightness} onChange={(v) => handleFilterChange('brightness', v)} unit="%" />
            <Slider label="Độ tương phản" min={0} max={200} value={filters.contrast} onChange={(v) => handleFilterChange('contrast', v)} unit="%" />
            <Slider label="Độ bão hòa" min={0} max={200} value={filters.saturation} onChange={(v) => handleFilterChange('saturation', v)} unit="%" />
            <Slider label="Độ mờ" min={0} max={20} value={filters.blur} onChange={(v) => handleFilterChange('blur', v)} unit="px" />
          </div>

          <div>
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Bộ lọc màu</h3>
             <Slider label="Trắng đen" min={0} max={100} value={filters.grayscale} onChange={(v) => handleFilterChange('grayscale', v)} unit="%" />
             <Slider label="Sepia" min={0} max={100} value={filters.sepia} onChange={(v) => handleFilterChange('sepia', v)} unit="%" />
          </div>

          {/* Reset Filters */}
          <Button 
            variant="secondary" 
            className="w-full" 
            onClick={() => setFilters(DEFAULT_FILTERS)}
            icon={<RotateCcw size={16} />}
          >
            Đặt lại bộ lọc
          </Button>
        </div>
      </div>

      {/* Center: Image Canvas */}
      <div className="flex-1 bg-slate-950 flex flex-col relative">
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          <img 
            src={currentImageUrl} 
            alt="Editing workspace" 
            className="max-w-full max-h-full object-contain shadow-2xl"
            style={filterStyle}
          />
        </div>
        
        {/* Undo Control (Overlay) */}
        {historyIndex > 0 && (
           <div className="absolute top-4 left-4">
              <Button variant="secondary" onClick={undo} icon={<RotateCcw size={14} />}>
                Hoàn tác
              </Button>
           </div>
        )}
      </div>

      {/* Right Sidebar: AI & Export */}
      <div className="w-80 flex-shrink-0 border-l border-slate-700 bg-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-700">
            <h2 className="font-semibold text-white flex items-center gap-2">
                <Sparkles className="text-blue-400" size={18} />
                AI Magic
            </h2>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-4">
            <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                <label className="block text-sm text-slate-300 mb-2">
                    Mô tả thay đổi bạn muốn (Prompt)
                </label>
                <textarea
                    className="w-full bg-slate-900 text-white rounded p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none border border-slate-700 resize-none h-32"
                    placeholder="Ví dụ: Biến ảnh thành tranh sơn dầu, thêm pháo hoa vào bầu trời, làm cho ảnh trong giống phong cách Cyberpunk..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                />
                <div className="mt-3">
                    <Button 
                        variant="primary" 
                        className="w-full" 
                        onClick={handleAiEdit} 
                        isLoading={isProcessing}
                        disabled={!aiPrompt.trim()}
                        icon={<Wand2 size={16} />}
                    >
                        Tạo với Gemini
                    </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    Sử dụng model <span className="font-mono text-blue-400">gemini-2.5-flash-image</span> để chỉnh sửa nhanh.
                </p>
            </div>
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800">
            <Button 
                variant="primary" 
                className="w-full bg-green-600 hover:bg-green-700 focus:ring-green-500" 
                onClick={handleDownload}
                icon={<Download size={16} />}
            >
                Lưu hình ảnh
            </Button>
        </div>
      </div>
    </div>
  );
};
