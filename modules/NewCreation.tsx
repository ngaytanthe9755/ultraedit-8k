
import React, { useState, useEffect } from 'react';
import { Wand2, Download, Zap, Layers, Maximize2, Save, Sparkles, Box, Upload, X, Image as ImageIcon, Loader2, Lightbulb, RefreshCw, History, Palette, Monitor, Scan, MousePointer2, Sliders, Cpu } from 'lucide-react';
import { enhancePrompt, generateImage, validateImageSafety, generateNewCreationSuggestions, ImageEngine } from '../services/geminiService';
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
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [quality, setQuality] = useState('1K');
  const [batchSize, setBatchSize] = useState(1);
  const [useMagicPrompt, setUseMagicPrompt] = useState(true);
  const [selectedStyleId, setSelectedStyleId] = useState('none');
  const [engine, setEngine] = useState<ImageEngine>('imagen');
  
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [isCheckingSafety, setIsCheckingSafety] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsCheckingSafety(true);
      try {
          const b64 = await fileToBase64(file);
          const validation = await validateImageSafety(b64);
          if (!validation.safe) {
              addToast('Cảnh báo', `Hình ảnh vi phạm: ${validation.reason}`, 'error');
              e.target.value = '';
              return;
          }
          setRefFile(file);
          const reader = new FileReader();
          reader.onload = (ev) => setRefPreview(ev.target?.result as string);
          reader.readAsDataURL(file);
          setEngine('gemini-pro');
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

  const handleGenerate = async () => {
    if (!isAuthenticated) { onRequireAuth(); return; }
    if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng đợi.", "warning"); return; }

    if (currentUser) {
        const check = checkUsageLimit(currentUser.username, ModuleType.NEW_CREATION, batchSize);
        if (!check.allowed) { addToast("Không đủ điểm", check.message, "error"); return; }
    }

    setIsGenerating(true);
    setGlobalProcessing?.(true);
    setGeneratedImages([]); 

    try {
      const selectedStyle = ART_STYLES.find(s => s.id === selectedStyleId);
      let fullPrompt = prompt;
      if (selectedStyle && selectedStyle.id !== 'none') {
          fullPrompt = `${prompt}. Style: ${selectedStyle.prompt}`;
      }

      let finalPrompt = fullPrompt;
      if (useMagicPrompt && prompt.trim()) {
        addToast('Gemini Pro', 'Đang tối ưu hóa kịch bản hình ảnh...', 'info');
        finalPrompt = await enhancePrompt(fullPrompt);
      }

      const refB64 = refFile ? await fileToBase64(refFile) : undefined;
      const promises = Array(batchSize).fill(null).map(() => 
        generateImage(finalPrompt, aspectRatio, quality, refB64, negativePrompt, engine)
      );

      const rawResults = await Promise.all(promises);
      const processedResults = await Promise.all(rawResults.map(async (rawB64) => {
          if (currentUser && !currentUser.isVerified) return await applyWatermark(rawB64);
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
            meta: { aspectRatio, quality, engine, sourceModule: ModuleType.NEW_CREATION }
        });
      }));

      if (currentUser) incrementUsage(currentUser.username, ModuleType.NEW_CREATION, batchSize);
      addToast('Thành công', `Đã hoàn thành!`, 'success');

    } catch (error: any) {
      addToast('Thất bại', error.message || 'Có lỗi xảy ra.', 'error');
    } finally {
      setIsGenerating(false);
      setGlobalProcessing?.(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full p-4 lg:p-6 gap-6 lg:gap-8 bg-zinc-950">
      <div className="w-full lg:w-[420px] flex flex-col gap-6 lg:overflow-y-auto lg:pr-2 custom-scrollbar shrink-0 order-2 lg:order-1 pb-20 lg:pb-0">
        <div className="pb-4 border-b border-white/5">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-400 mb-1 tracking-tight">Vision Generator</h2>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Authorized Tier: {currentUser?.modelTier || '1.5-free'}</p>
        </div>

        <div className="bg-zinc-900/60 border border-white/5 p-4 rounded-2xl space-y-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <Cpu size={12} className="text-indigo-400"/> AI Image Engine
            </label>
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                <button onClick={() => setEngine('imagen')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${engine === 'imagen' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500'}`}>Imagen 4</button>
                <button onClick={() => setEngine('gemini-pro')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${engine === 'gemini-pro' ? 'bg-purple-600 text-white shadow-lg' : 'text-zinc-500'}`}>Gemini 3 Pro</button>
            </div>
        </div>

        <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Palette size={12} className="text-fuchsia-500"/> Art Style DNA</label>
            <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto custom-scrollbar p-1">
                {ART_STYLES.map(style => (
                    <button key={style.id} onClick={() => setSelectedStyleId(style.id)} className={`text-left p-2.5 rounded-xl border transition-all relative overflow-hidden group ${selectedStyleId === style.id ? 'border-fuchsia-500 ring-1 ring-fuchsia-500/50' : 'border-zinc-800 bg-zinc-900/50'}`}>
                        <div className={`absolute inset-0 opacity-20 ${style.color}`}></div>
                        <span className="relative z-10 text-xs font-bold text-white block truncate">{style.label}</span>
                    </button>
                ))}
            </div>
        </div>

        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-1 backdrop-blur-sm shadow-xl">
             <div className="relative group">
                 <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-fuchsia-500 transition-all resize-none" placeholder="Visualize your idea..."/>
                 <div className="flex justify-between items-center p-2 mt-1">
                     <label className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all border border-white/5 cursor-pointer ${refPreview ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/50' : 'bg-zinc-800 text-zinc-300'}`}>
                        {isCheckingSafety ? <Loader2 size={12} className="animate-spin"/> : <ImageIcon size={12}/>} 
                        {refPreview ? 'Reference active' : 'Edit Image'}
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={isCheckingSafety}/>
                    </label>
                    {refPreview && (
                         <div className="relative w-8 h-8 rounded overflow-hidden border border-emerald-500/50 group/preview">
                             <img src={refPreview} className="w-full h-full object-cover"/>
                             <button onClick={removeRefImage} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/preview:opacity-100"><X size={12} className="text-white"/></button>
                         </div>
                     )}
                 </div>
             </div>
        </div>

        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 space-y-4">
            <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-2"><Scan size={12}/> Aspect Ratio</label>
                <div className="flex gap-2">
                    {RATIOS.map(r => (
                        <button key={r.label} onClick={() => setAspectRatio(r.label)} className={`flex-1 py-2 rounded-lg border text-[10px] font-bold transition-all ${aspectRatio === r.label ? 'bg-zinc-800 border-white/20 text-white' : 'bg-transparent border-zinc-800 text-zinc-600'}`}>{r.label}</button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-2"><Monitor size={12}/> Render Quality</label>
                    <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-bold rounded-lg p-2.5 outline-none">
                        {QUALITIES.map(q => <option key={q} value={q}>{q} UHD</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-2"><Layers size={12}/> Batch Size</label>
                    <div className="flex gap-1">
                        {[1, 2, 3, 4].map(n => (
                            <button key={n} onClick={() => setBatchSize(n)} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${batchSize === n ? 'bg-fuchsia-900/30 border-fuchsia-500 text-fuchsia-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}>{n}</button>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        <button onClick={handleGenerate} disabled={isGenerating || (isGlobalProcessing && !isGenerating)} className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg group border border-white/10">
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <><Wand2 size={18}/> Generate Vision</>}
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-4 min-h-[500px] lg:min-h-0 order-1 lg:order-2">
          <div className="flex-1 bg-zinc-900/30 border border-white/5 rounded-3xl relative overflow-hidden backdrop-blur-sm flex items-center justify-center group/main">
                {selectedPreview ? (
                    <div className="relative w-full h-full p-4 md:p-8 flex items-center justify-center animate-in fade-in zoom-in">
                        <img src={selectedPreview} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 opacity-0 group-hover/main:opacity-100 transition-opacity">
                             <a href={selectedPreview} download={`Vision-${Date.now()}.png`} className="p-3 bg-white text-black hover:bg-zinc-200 rounded-full shadow-lg transition-all"><Download size={20}/></a>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-zinc-700/50">
                        <MousePointer2 size={32} className="opacity-50 mx-auto mb-4"/>
                        <p className="text-lg font-light tracking-wide text-zinc-500">Ready to visualize</p>
                    </div>
                )}
          </div>
      </div>
    </div>
  );
};

export default NewCreation;
