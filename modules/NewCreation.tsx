
import React, { useState, useEffect } from 'react';
import { Wand2, Download, Zap, Layers, Maximize2, Save, Sparkles, Box, Upload, X, Image as ImageIcon, Loader2, Lightbulb, RefreshCw, History, Palette, Monitor, Scan, MousePointer2, Sliders } from 'lucide-react';
import { enhancePrompt, generateImage, validateImageSafety, generateNewCreationSuggestions } from '../services/geminiService';
import { saveItem, saveCharacter } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
import { ImageViewerModal } from '../components/ImageViewerModal';
import { SuggestionModal } from '../components/SuggestionModal';
import { User, ModuleType } from '../types';
import { checkUsageLimit, incrementUsage } from '../services/userService';
import { applyWatermark } from '../services/imageUtils';

interface NewCreationProps {
  addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  addNotification?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  currentUser?: User;
  onRequireAuth: () => void;
  isAuthenticated: boolean;
  isGlobalProcessing?: boolean;
  setGlobalProcessing?: (val: boolean) => void;
}

// --- CONFIGURATION DATA ---

const ART_STYLES = [
    { id: 'none', label: 'Tự do (None)', prompt: '', color: 'bg-zinc-800' },
    { id: 'cinematic', label: 'Điện ảnh (Cinematic)', prompt: 'Cinematic lighting, movie still, 8k, highly detailed, atmospheric, depth of field, color graded', color: 'bg-indigo-900' },
    { id: '3d-render', label: '3D Siêu thực', prompt: 'Unreal Engine 5 render, octane render, ray tracing, 8k, hyper-realistic, volumetric lighting', color: 'bg-blue-900' },
    { id: 'anime', label: 'Anime/Manga', prompt: 'Anime style, Studio Ghibli inspired, vibrant colors, detailed background, cell shading', color: 'bg-pink-900' },
    { id: 'cyberpunk', label: 'Cyberpunk', prompt: 'Cyberpunk city, neon lights, futuristic, high tech, rain, reflections, night time', color: 'bg-fuchsia-900' },
    { id: 'fantasy', label: 'Fantasy Art', prompt: 'Fantasy art, ethereal, magical, intricate details, oil painting style, masterpiece', color: 'bg-emerald-900' },
    { id: 'product', label: 'Quảng cáo (Product)', prompt: 'Professional product photography, studio lighting, clean background, 8k, sharp focus, commercial', color: 'bg-orange-900' },
];

const RATIOS = [
    { label: '1:1', icon: SquareIcon, desc: 'Instagram/Avatar' },
    { label: '16:9', icon: RectHIcon, desc: 'Youtube/PC' },
    { label: '9:16', icon: RectVIcon, desc: 'TikTok/Phone' },
    { label: '4:3', icon: RectHIcon, desc: 'TV Standard' },
    { label: '3:4', icon: RectVIcon, desc: 'Portrait' },
];

// Helper Icons for Ratios
function SquareIcon({className}: {className?: string}) { return <div className={`w-4 h-4 border-2 border-current rounded-sm ${className}`}></div> }
function RectHIcon({className}: {className?: string}) { return <div className={`w-5 h-3 border-2 border-current rounded-sm ${className}`}></div> }
function RectVIcon({className}: {className?: string}) { return <div className={`w-3 h-5 border-2 border-current rounded-sm ${className}`}></div> }

const QUALITIES = ['1K', '2K', '4K', '8K'];

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const NewCreation: React.FC<NewCreationProps> = ({ addToast, addNotification, currentUser, onRequireAuth, isAuthenticated, isGlobalProcessing, setGlobalProcessing }) => {
  // State
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [quality, setQuality] = useState('4K');
  const [batchSize, setBatchSize] = useState(1);
  const [useMagicPrompt, setUseMagicPrompt] = useState(true);
  const [selectedStyleId, setSelectedStyleId] = useState('none');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [isCheckingSafety, setIsCheckingSafety] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false);
  
  const [charName, setCharName] = useState('');
  const [showSaveChar, setShowSaveChar] = useState(false);

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionHistory, setSuggestionHistory] = useState<any[][]>([]);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsCheckingSafety(true);
      try {
          const b64 = await fileToBase64(file);
          const validation = await validateImageSafety(b64);
          if (!validation.safe) {
              const msg = `Hình ảnh vi phạm: ${validation.reason}`;
              addToast('Cảnh báo Chính sách', msg, 'error');
              e.target.value = '';
              setRefFile(null);
              setRefPreview(null);
              return;
          }
          setRefFile(file);
          const reader = new FileReader();
          reader.onload = (ev) => setRefPreview(ev.target?.result as string);
          reader.readAsDataURL(file);
      } catch (err) {
          addToast('Lỗi', 'Không thể kiểm tra an toàn hình ảnh', 'error');
      } finally {
          setIsCheckingSafety(false);
      }
    }
  };

  const removeRefImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRefFile(null);
    setRefPreview(null);
  };

  const triggerDownload = (base64Data: string, index: number) => {
      const link = document.createElement('a');
      link.href = base64Data;
      link.download = `UltraEdit-Gen-${Date.now()}-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleGetSuggestions = async () => {
      if (!prompt.trim() && !refFile) {
          addToast("Thiếu thông tin", "Vui lòng nhập ý tưởng sơ bộ hoặc tải ảnh mẫu.", "info");
          return;
      }
      setIsSuggesting(true);
      setSuggestions([]);
      setShowSuggestionsModal(true);
      try {
          const refB64 = refFile ? await fileToBase64(refFile) : null;
          const results = await generateNewCreationSuggestions(refB64, prompt);
          setSuggestions(results);
          if (results && results.length > 0) setSuggestionHistory(prev => [results, ...prev]);
      } catch (e) {
          addToast("Lỗi", "Không thể tạo gợi ý.", "error");
          setShowSuggestionsModal(false);
      } finally {
          setIsSuggesting(false);
      }
  };

  const openHistory = () => {
      if (suggestionHistory.length > 0) {
          setSuggestions(suggestionHistory[0]);
          setShowSuggestionsModal(true);
      } else {
          addToast("Trống", "Chưa có lịch sử gợi ý.", "info");
      }
  }

  const handleGenerate = async () => {
    if (!isAuthenticated) { onRequireAuth(); return; }

    if (isGlobalProcessing) {
        addToast("Hệ thống bận", "Một tác vụ khác đang chạy. Vui lòng đợi.", "warning");
        return;
    }

    if (currentUser) {
        const check = checkUsageLimit(currentUser.username, ModuleType.NEW_CREATION, batchSize);
        if (!check.allowed) {
            addToast("Không đủ điểm", check.message || `Cần ${batchSize} điểm để tạo.`, "error");
            return;
        }
    }

    if (!prompt.trim() && !refFile) {
      addToast('Lỗi', 'Vui lòng nhập mô tả hoặc tải lên ảnh', 'error');
      return;
    }

    setIsGenerating(true);
    setGlobalProcessing?.(true);
    setGeneratedImages([]); 
    setSelectedPreview(null);

    try {
      // 1. Combine Style Prompt
      const selectedStyle = ART_STYLES.find(s => s.id === selectedStyleId);
      let fullPrompt = prompt;
      
      if (selectedStyle && selectedStyle.id !== 'none') {
          if (!useMagicPrompt) {
              fullPrompt = `${prompt}. Style: ${selectedStyle.prompt}`;
          } else {
              fullPrompt = `${prompt}. Desired Style: ${selectedStyle.label} (${selectedStyle.prompt})`;
          }
      }

      // 2. Magic Prompt Enhancement
      let finalPrompt = fullPrompt;
      if (useMagicPrompt && prompt.trim()) {
        addToast('Magic Prompt', 'AI đang tối ưu hóa ánh sáng và chi tiết...', 'info');
        finalPrompt = await enhancePrompt(fullPrompt);
      }

      const refB64 = refFile ? await fileToBase64(refFile) : undefined;

      // Call Generate with Negative Prompt
      const promises = Array(batchSize).fill(null).map(() => 
        generateImage(finalPrompt, aspectRatio, quality === 'Fast' ? '1K' : quality, refB64, negativePrompt)
      );

      const rawResults = await Promise.all(promises);
      
      const processedResults = await Promise.all(rawResults.map(async (rawB64) => {
          if (currentUser && !currentUser.isVerified) {
              return await applyWatermark(rawB64);
          }
          return `data:image/png;base64,${rawB64}`;
      }));
      
      setGeneratedImages(processedResults);
      if (processedResults.length > 0) setSelectedPreview(processedResults[0]);

      await Promise.all(processedResults.map(async (imgData, idx) => {
          await saveItem({
            id: uuidv4(),
            type: 'image',
            prompt: finalPrompt,
            createdAt: Date.now() + idx,
            base64Data: imgData,
            meta: { aspectRatio, quality, hasReference: !!refB64, style: selectedStyleId, negativePrompt, sourceModule: ModuleType.NEW_CREATION } // Added sourceModule
        });
      }));

      if (currentUser) incrementUsage(currentUser.username, ModuleType.NEW_CREATION, batchSize);

      addToast('Thành công', `Đã hoàn thành ${batchSize} tác phẩm!`, 'success');

    } catch (error: any) {
      const msg = error.message || 'Có lỗi xảy ra.';
      if (msg.includes('safety')) {
          addToast('Vi phạm chính sách', 'Prompt tạo ra hình ảnh vi phạm chính sách an toàn.', 'error');
      } else {
          addToast('Thất bại', 'Có lỗi xảy ra. Hãy thử giảm chất lượng hoặc số lượng.', 'error');
      }
    } finally {
      setIsGenerating(false);
      setGlobalProcessing?.(false);
    }
  };

  const handleRegenerateSingle = async () => {
      if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ tiến trình hiện tại hoàn tất.", "warning"); return; }
      if (currentUser) {
        const check = checkUsageLimit(currentUser.username, ModuleType.NEW_CREATION, 1);
        if (!check.allowed) { addToast("Hết điểm", check.message || "Hết điểm", "error"); return; }
      }

      setIsRegeneratingSingle(true);
      setGlobalProcessing?.(true);
      try {
          const refB64 = refFile ? await fileToBase64(refFile) : undefined;
          const selectedStyle = ART_STYLES.find(s => s.id === selectedStyleId);
          let promptToUse = prompt;
          if (selectedStyle && selectedStyle.id !== 'none') {
              promptToUse = `${prompt}. Style: ${selectedStyle.prompt}`;
          }
          const finalPrompt = useMagicPrompt ? await enhancePrompt(promptToUse) : promptToUse;
          
          const rawB64 = await generateImage(finalPrompt, aspectRatio, quality === 'Fast' ? '1K' : quality, refB64, negativePrompt);
          
          let fullImg = `data:image/png;base64,${rawB64}`;
          if (currentUser && !currentUser.isVerified) {
              fullImg = await applyWatermark(rawB64);
          }
          
          setGeneratedImages(prev => [fullImg, ...prev]);
          setSelectedPreview(fullImg);
          
          await saveItem({
            id: uuidv4(),
            type: 'image',
            prompt: finalPrompt,
            createdAt: Date.now(),
            base64Data: fullImg,
            meta: { aspectRatio, quality, hasReference: !!refB64, style: selectedStyleId, negativePrompt, sourceModule: ModuleType.NEW_CREATION } // Added sourceModule
          });
          
          if (currentUser) incrementUsage(currentUser.username, ModuleType.NEW_CREATION, 1);
          addToast('Thành công', 'Đã vẽ lại một biến thể mới!', 'success');
      } catch (error: any) {
          addToast('Lỗi', 'Không thể tạo lại ảnh', 'error');
      } finally {
          setIsRegeneratingSingle(false);
          setGlobalProcessing?.(false);
      }
  }

  const handleSaveCharacter = async () => {
      if (!charName || !selectedPreview) return;
      try {
          const base64 = selectedPreview.split(',')[1];
          await saveCharacter({
              id: uuidv4(),
              name: charName,
              base64Data: base64,
              createdAt: Date.now()
          });
          await saveItem({
              id: uuidv4(),
              type: 'character',
              prompt: charName,
              createdAt: Date.now(),
              base64Data: selectedPreview,
              meta: { style: selectedStyleId, language: 'Vietnamese', sourceModule: ModuleType.NEW_CREATION } // Added sourceModule
          });
          addToast("Thành công", `Đã lưu nhân vật: ${charName}`, "success");
          setShowSaveChar(false);
          setCharName('');
      } catch (e) {
          addToast("Lỗi", "Không thể lưu nhân vật", "error");
      }
  }

  return (
    <div className="flex flex-col lg:flex-row w-full h-full p-4 lg:p-6 gap-6 lg:gap-8">
      {/* LEFT PANEL: CONTROL CENTER */}
      <div className="w-full lg:w-[420px] flex flex-col gap-6 lg:overflow-y-auto lg:pr-2 custom-scrollbar shrink-0 order-2 lg:order-1 pb-20 lg:pb-0">
        
        {/* Header */}
        <div className="pb-4 border-b border-white/5">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-400 mb-1 tracking-tight">Vision Generator</h2>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Powered by Gemini 3.0 Pro & Imagen</p>
        </div>

        {/* 1. Visual Style Selector */}
        <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <Palette size={12} className="text-fuchsia-500"/> Phong cách nghệ thuật
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto custom-scrollbar p-1">
                {ART_STYLES.map(style => (
                    <button
                        key={style.id}
                        onClick={() => setSelectedStyleId(style.id)}
                        className={`text-left p-2.5 rounded-xl border transition-all duration-300 relative overflow-hidden group ${selectedStyleId === style.id ? 'border-fuchsia-500 ring-1 ring-fuchsia-500/50' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'}`}
                    >
                        <div className={`absolute inset-0 opacity-20 ${style.color}`}></div>
                        <span className="relative z-10 text-xs font-bold text-white block truncate">{style.label}</span>
                        {selectedStyleId === style.id && <div className="absolute top-1 right-1 w-2 h-2 bg-fuchsia-500 rounded-full animate-pulse"></div>}
                    </button>
                ))}
            </div>
        </div>

        {/* 2. Main Input & Image Ref */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-1 backdrop-blur-sm shadow-xl">
             <div className="relative group">
                 {/* Magic Toggle */}
                 <div className="absolute top-3 right-3 z-20 flex gap-2">
                    <button onClick={openHistory} className="p-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors backdrop-blur"><History size={14}/></button>
                    <button onClick={() => setUseMagicPrompt(!useMagicPrompt)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border backdrop-blur ${useMagicPrompt ? 'bg-indigo-600/80 border-indigo-500 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]' : 'bg-zinc-800/80 border-zinc-700 text-zinc-500'}`}>
                        <Sparkles size={12} fill={useMagicPrompt ? "currentColor" : "none"}/> Magic
                    </button>
                 </div>

                 {/* Textarea */}
                 <textarea 
                    value={prompt} 
                    onChange={(e) => setPrompt(e.target.value)} 
                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50 transition-all resize-none leading-relaxed"
                    placeholder="Mô tả ý tưởng của bạn thật chi tiết..."
                 />

                 {/* Action Bar inside Input */}
                 <div className="flex justify-between items-center p-2 mt-1">
                     <div className="flex gap-2">
                        {/* Suggestion Button */}
                        <button onClick={handleGetSuggestions} disabled={isSuggesting} className="flex items-center gap-1.5 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors border border-white/5">
                            {isSuggesting ? <Loader2 size={12} className="animate-spin"/> : <Lightbulb size={12} className="text-yellow-500"/>} Gợi ý AI
                        </button>
                        
                        {/* Upload Trigger */}
                        <label className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all border border-white/5 cursor-pointer ${refPreview ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/50' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}>
                            {isCheckingSafety ? <Loader2 size={12} className="animate-spin"/> : <ImageIcon size={12}/>} 
                            {refPreview ? 'Đã có ảnh mẫu' : 'Ảnh mẫu'}
                            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={isCheckingSafety}/>
                        </label>
                     </div>
                     {refPreview && (
                         <div className="relative w-8 h-8 rounded overflow-hidden border border-emerald-500/50 group/preview">
                             <img src={refPreview} className="w-full h-full object-cover"/>
                             <button onClick={removeRefImage} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity">
                                 <X size={12} className="text-white"/>
                             </button>
                         </div>
                     )}
                 </div>
             </div>
        </div>

        {/* 3. Advanced Configuration (Negative Prompt) */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 backdrop-blur-sm space-y-4">
            
            {/* Aspect Ratio */}
            <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Scan size={12}/> Tỷ lệ khung hình</label>
                <div className="flex gap-2">
                    {RATIOS.map(r => (
                        <button
                            key={r.label}
                            onClick={() => setAspectRatio(r.label)}
                            className={`flex-1 py-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all group ${aspectRatio === r.label ? 'bg-zinc-800 border-white/20 text-white shadow-md' : 'bg-transparent border-zinc-800 text-zinc-600 hover:bg-zinc-800/50 hover:text-zinc-400'}`}
                            title={r.desc}
                        >
                            <r.icon className={aspectRatio === r.label ? 'text-fuchsia-400' : 'text-current'}/>
                            <span className="text-[9px] font-bold">{r.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Quality & Batch */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Monitor size={12}/> Chất lượng</label>
                    <div className="relative">
                        <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-bold rounded-lg p-2.5 outline-none focus:border-fuchsia-500 appearance-none">
                            {QUALITIES.map(q => <option key={q} value={q}>{q} Ultra HD</option>)}
                        </select>
                        <div className="absolute right-3 top-3 pointer-events-none text-zinc-500"><Monitor size={12}/></div>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Layers size={12}/> Số lượng ({batchSize})</label>
                    <div className="flex gap-1">
                        {[1, 2, 3, 4].map(n => (
                            <button 
                                key={n} 
                                onClick={() => setBatchSize(n)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${batchSize === n ? 'bg-fuchsia-900/30 border-fuchsia-500 text-fuchsia-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-900'}`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Advanced Toggle */}
            <div className="pt-2 border-t border-white/5">
                <button 
                    onClick={() => setShowAdvanced(!showAdvanced)} 
                    className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-wider w-full justify-between"
                >
                    <span className="flex items-center gap-2"><Sliders size={12}/> Cài đặt nâng cao (Pro)</span>
                    <span className="text-lg">{showAdvanced ? '-' : '+'}</span>
                </button>
                
                {showAdvanced && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                        <label className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2 block">Negative Prompt (Loại bỏ chi tiết)</label>
                        <textarea 
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder="VD: bad hands, text, watermark, blur, low quality..."
                            className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-red-500/50 resize-none"
                        />
                    </div>
                )}
            </div>
        </div>

        <button 
            onClick={handleGenerate} 
            disabled={isGenerating || (isGlobalProcessing && !isGenerating)} 
            className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-600 bg-[length:200%_auto] hover:bg-right transition-all duration-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-fuchsia-900/20 group sticky bottom-0 lg:static z-10 border border-white/10"
        >
            {isGenerating ? <><Loader2 size={18} className="animate-spin" /> System Processing...</> : 
             (isGlobalProcessing && !isGenerating) ? "Hệ thống đang bận..." : 
             <><Wand2 size={18} className="group-hover:rotate-12 transition-transform"/> Generate Visuals (-{batchSize})</>}
        </button>
      </div>

      {/* RIGHT PANEL: GALLERY & PREVIEW */}
      <div className="flex-1 flex flex-col gap-4 min-h-[500px] lg:min-h-0 order-1 lg:order-2">
          {/* Main Preview Area */}
          <div className="flex-1 bg-zinc-900/30 border border-white/5 rounded-3xl relative overflow-hidden backdrop-blur-sm flex items-center justify-center group/main">
                {selectedPreview ? (
                    <div className="relative w-full h-full p-4 md:p-8 flex items-center justify-center animate-in fade-in zoom-in duration-300">
                        <img 
                            src={selectedPreview} 
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-black/50" 
                            alt="Main Preview"
                        />
                        {/* Overlay Actions */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/main:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-[2px]">
                            <button onClick={() => setShowSaveChar(!showSaveChar)} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur border border-white/10 transition-all hover:scale-110" title="Lưu nhân vật"><Save size={20}/></button>
                            <button onClick={handleRegenerateSingle} disabled={isRegeneratingSingle || isGlobalProcessing} className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg transition-all hover:scale-110 disabled:opacity-50" title="Vẽ lại"><RefreshCw size={20} className={isRegeneratingSingle ? "animate-spin" : ""}/></button>
                            <button onClick={() => triggerDownload(selectedPreview, Date.now())} className="p-3 bg-white text-black hover:bg-zinc-200 rounded-full shadow-lg transition-all hover:scale-110" title="Tải xuống"><Download size={20}/></button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-zinc-700/50">
                        <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                            <MousePointer2 size={32} className="opacity-50"/>
                        </div>
                        <p className="text-lg font-light tracking-wide text-zinc-500">Ready to visualize</p>
                        <p className="text-xs text-zinc-600 mt-2">Select a style and enter prompt to begin</p>
                    </div>
                )}
          </div>

          {/* Film Strip (History) */}
          {generatedImages.length > 0 && (
              <div className="h-24 bg-zinc-900/40 border-t border-white/5 p-3 flex gap-3 overflow-x-auto custom-scrollbar rounded-xl">
                  {generatedImages.map((img, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedPreview(img)}
                        className={`relative aspect-square h-full rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedPreview === img ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/30' : 'border-transparent hover:border-white/20'}`}
                      >
                          <img src={img} className="w-full h-full object-cover"/>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* Modals */}
      <ImageViewerModal isOpen={!!selectedPreview} onClose={() => setSelectedPreview(null)} imageSrc={selectedPreview} altText="Generated Image">
          <div className="flex flex-col lg:flex-row gap-4 w-full max-w-2xl items-center justify-center">
              <button onClick={() => setShowSaveChar(!showSaveChar)} className="bg-zinc-800 hover:bg-zinc-700 px-6 py-2.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all border border-white/10"><Save size={18}/> Lưu nhân vật</button>
              <button onClick={handleRegenerateSingle} disabled={isRegeneratingSingle || isGlobalProcessing} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50"><RefreshCw size={18} className={isRegeneratingSingle ? "animate-spin" : ""}/> Vẽ lại</button>
              <button onClick={() => selectedPreview && triggerDownload(selectedPreview, 0)} className="bg-white text-black px-6 py-2.5 rounded-xl font-bold hover:bg-zinc-200 flex items-center justify-center gap-2 transition-all shadow-lg"><Download size={18}/> Tải về</button>
              {showSaveChar && (
                  <div className="flex items-center gap-2 animate-[slideUp_0.2s_ease-out] w-full lg:w-auto">
                      <input value={charName} onChange={e => setCharName(e.target.value)} placeholder="Tên nhân vật..." className="bg-zinc-900 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 w-full" autoFocus/>
                      <button onClick={handleSaveCharacter} className="bg-green-600 hover:bg-green-500 px-4 py-2.5 rounded-lg text-white font-bold whitespace-nowrap">Lưu</button>
                  </div>
              )}
          </div>
      </ImageViewerModal>

      <SuggestionModal isOpen={showSuggestionsModal} onClose={() => setShowSuggestionsModal(false)} title="Gợi ý Sáng tạo" suggestions={suggestions} onSelect={(item) => { setPrompt(item.en); setShowSuggestionsModal(false); }} isLoading={isSuggesting}/>
    </div>
  );
};

export default NewCreation;
