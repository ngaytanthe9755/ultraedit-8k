
import React, { useState, useEffect } from 'react';
import { Upload, Shirt, User, Gem, Wand2, Maximize2, Download, CheckCircle2, ImagePlus, PenTool, Check, Lightbulb, X, Sparkles, Loader2, RefreshCw, History, Package, Sliders, Sun, Cpu } from 'lucide-react';
import { generateCompositeImage, validateImageSafety, generateStudioSuggestions, enhancePrompt } from '../services/geminiService';
import { saveItem, getAllCharacters } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
import { SavedCharacter, User as AppUser, ModuleType } from '../types'; 
import { ImageViewerModal } from '../components/ImageViewerModal';
import { SuggestionModal } from '../components/SuggestionModal';
import { checkUsageLimit, incrementUsage } from '../services/userService';
import { applyWatermark } from '../services/imageUtils';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};

const fileToPreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
    });
}

interface StudioProps {
  addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  addNotification?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  currentUser?: AppUser;
  onRequireAuth: () => void;
  isAuthenticated: boolean;
  isGlobalProcessing?: boolean;
  setGlobalProcessing?: (val: boolean) => void;
}

const BACKGROUNDS = [
    'Studio phông trơn (Clean Studio)',
    'Chùa chiền cổ kính (Ancient Pagoda)',
    'Phố cổ Hội An (Lantern Street)',
    'Biệt thự Châu Âu (Luxury Villa)',
    'Bãi biển Maldives (Tropical Beach)',
    'Cung điện nguy nga (Palace)',
    'Đường phố Cyberpunk (Neon City)',
    'Văn phòng CEO (Modern Office)'
];

const RATIOS = ['3:4', '1:1', '16:9', '9:16'];
const QUALITIES = ['1K', '2K', '4K'];

const Studio: React.FC<StudioProps> = ({ addToast, currentUser, onRequireAuth, isAuthenticated, isGlobalProcessing, setGlobalProcessing }) => {
  const [subjectFile, setSubjectFile] = useState<File | null>(null);
  const [subjectPreview, setSubjectPreview] = useState<string | null>(null);
  const [outfitFile, setOutfitFile] = useState<File | null>(null);
  const [outfitPreview, setOutfitPreview] = useState<string | null>(null);
  const [accessoryFile, setAccessoryFile] = useState<File | null>(null);
  const [accessoryPreview, setAccessoryPreview] = useState<string | null>(null);
  
  const [checkingSafetyFor, setCheckingSafetyFor] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [background, setBackground] = useState(BACKGROUNDS[0]); 
  const [aspectRatio, setAspectRatio] = useState('3:4');
  const [quality, setQuality] = useState('1K');
  const [batchSize, setBatchSize] = useState(1);
  const [savedChars, setSavedChars] = useState<SavedCharacter[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [preserveIdentity, setPreserveIdentity] = useState(true); 
  const [negativePrompt, setNegativePrompt] = useState('');
  const [useMagicPrompt, setUseMagicPrompt] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{en: string, vi: string}[]>([]);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

  useEffect(() => {
      const loadCharacters = async () => {
          const chars = await getAllCharacters();
          setSavedChars(chars.sort((a, b) => b.createdAt - a.createdAt));
      };
      loadCharacters();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'subject' | 'outfit' | 'acc') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCheckingSafetyFor(type);
      try {
          const b64 = await fileToBase64(file);
          const validation = await validateImageSafety(b64);
          if (!validation.safe) {
              addToast('Cảnh báo', `Hình ảnh vi phạm: ${validation.reason}`, 'error');
              return;
          }
          const preview = await fileToPreview(file);
          if (type === 'subject') { setSubjectFile(file); setSubjectPreview(preview); setSelectedCharId(''); }
          if (type === 'outfit') { setOutfitFile(file); setOutfitPreview(preview); }
          if (type === 'acc') { setAccessoryFile(file); setAccessoryPreview(preview); }
      } catch (err) {
          addToast('Lỗi', 'Không thể kiểm tra an toàn ảnh.', 'error');
      } finally {
          setCheckingSafetyFor(null);
      }
    }
  };

  const handleGenerate = async () => {
    if (!isAuthenticated) { onRequireAuth(); return; }
    if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }
    if (!subjectPreview) { addToast("Thiếu thông tin", "Bắt buộc phải có Nhân vật chính", "error"); return; }

    setIsGenerating(true);
    setGlobalProcessing?.(true);
    setResultImages([]);
    
    try {
        let subB64 = subjectFile ? await fileToBase64(subjectFile) : (selectedCharId ? savedChars.find(c => c.id === selectedCharId)?.base64Data : null);
        if (!subB64) throw new Error("Chưa có ảnh nhân vật");

        const outB64 = outfitFile ? await fileToBase64(outfitFile) : null;
        const accB64 = accessoryFile ? await fileToBase64(accessoryFile) : null;

        let finalPrompt = prompt;
        if (useMagicPrompt) {
            addToast("Gemini 3.0 Pro", "Đang xử lý ghép ảnh đa nguồn...", "info");
            finalPrompt = await enhancePrompt(prompt);
        }

        const promises = Array(batchSize).fill(null).map(() => 
            generateCompositeImage(subB64!, outB64, accB64, finalPrompt, background, aspectRatio, quality, preserveIdentity, negativePrompt)
        );

        const rawResults = await Promise.all(promises);
        const processedResults = await Promise.all(rawResults.map(async (raw) => {
            if (currentUser && !currentUser.isVerified) return await applyWatermark(raw);
            return `data:image/png;base64,${raw}`;
        }));

        setResultImages(processedResults);
        if (currentUser) incrementUsage(currentUser.username, ModuleType.STUDIO, batchSize);
        addToast("Thành công", `Đã ghép ${batchSize} ảnh bằng Gemini 3.0 Pro!`, "success");

    } catch (e: any) {
        addToast("Lỗi", e.message || "Ghép ảnh thất bại.", "error");
    } finally {
        setIsGenerating(false);
        setGlobalProcessing?.(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full p-4 lg:p-6 gap-6 lg:gap-8 relative">
        <div className="w-full lg:w-[420px] flex flex-col gap-6 lg:overflow-y-auto lg:pr-2 custom-scrollbar shrink-0 pb-10 lg:pb-0">
            <div className="pb-4 border-b border-white/5">
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-2">Studio Ghép Ảnh</h2>
                <div className="flex items-center gap-2 text-xs text-indigo-400 font-bold uppercase">
                    <Cpu size={14}/> Engine: Gemini 3.0 Pro Image
                </div>
            </div>
            
            <div className="space-y-6">
                <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3 text-indigo-300 font-bold text-sm uppercase"><User size={16} /> Nhân vật chính *</div>
                    <div className="relative h-40 bg-black/20 rounded-xl border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden cursor-pointer">
                        {subjectPreview ? <img src={subjectPreview} className="w-full h-full object-contain" /> : <Upload size={20} className="text-zinc-600"/>}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'subject')} accept="image/*" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3 text-purple-300 font-bold text-xs uppercase"><Shirt size={14} /> Trang phục</div>
                        <div className="relative h-24 bg-black/20 rounded-xl border border-dashed border-zinc-700 flex items-center justify-center overflow-hidden">
                             <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'outfit')} accept="image/*" />
                             {outfitPreview ? <img src={outfitPreview} className="w-full h-full object-contain"/> : <Upload size={16} className="text-zinc-600"/>}
                        </div>
                    </div>
                    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3 text-pink-300 font-bold text-xs uppercase"><Package size={14} /> Sản phẩm</div>
                        <div className="relative h-24 bg-black/20 rounded-xl border border-dashed border-zinc-700 flex items-center justify-center overflow-hidden">
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'acc')} accept="image/*" />
                            {accessoryPreview ? <img src={accessoryPreview} className="w-full h-full object-contain"/> : <Upload size={16} className="text-zinc-600"/>}
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">Mô tả hành động</label>
                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Nhân vật đang làm gì..." className="w-full h-20 bg-zinc-950/80 border border-zinc-800 text-white text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 resize-none"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                         <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-white text-xs rounded p-2 outline-none">
                            {RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                         </select>
                         <select value={quality} onChange={e => setQuality(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-white text-xs rounded p-2 outline-none">
                            {QUALITIES.map(q => <option key={q} value={q}>{q} Res</option>)}
                         </select>
                    </div>
                </div>

                <button onClick={handleGenerate} disabled={isGenerating || (isGlobalProcessing && !isGenerating)} className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl">
                    {isGenerating ? <Loader2 size={20} className="animate-spin"/> : <><Wand2 size={20}/> Ghép & Tạo Ảnh Studio</>}
                </button>
            </div>
        </div>

        <div className="flex-1 bg-zinc-900/20 rounded-3xl border border-white/5 p-6 flex flex-col relative overflow-hidden backdrop-blur-sm min-h-[400px] lg:h-full">
            {resultImages.length > 0 ? (
                <div className="grid gap-6 h-full lg:overflow-y-auto custom-scrollbar p-2">
                    {resultImages.map((img, idx) => (
                        <div key={idx} className="relative group rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-2xl flex items-center justify-center aspect-[3/4]">
                            <img src={img} className="w-full h-full object-contain" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-60">
                    <ImagePlus size={64} className="mb-4 text-purple-400/50" />
                    <p className="text-lg font-light tracking-wide">Studio đang chờ dữ liệu của bạn</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default Studio;
