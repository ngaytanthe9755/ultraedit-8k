
import React, { useState, useEffect } from 'react';
import { Upload, Shirt, User, Gem, Wand2, Maximize2, Download, CheckCircle2, ImagePlus, PenTool, Check, Lightbulb, X, Sparkles, Loader2, RefreshCw, History, Package, Sliders, Sun } from 'lucide-react';
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
    reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
    };
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
    'None (Giữ nguyên hoặc Tách nền)', 
    'Studio phông trơn (Clean Studio)',
    'Chùa chiền cổ kính (Ancient Pagoda)',
    'Đồng quê Việt Nam (Rice Field)', 
    'Phố cổ Hội An (Lantern Street)',
    'Đường phố Hà Nội (Old Quarter)',
    'Rừng thông Đà Lạt (Pine Forest)',
    'Ruộng bậc thang Tây Bắc',
    'Sân vườn Nhật Bản (Zen Garden)',
    'Biệt thự Châu Âu (Luxury Villa)',
    'Thư viện Hoàng gia (Royal Library)',
    'Quán Cafe Vintage (Chill Vibe)',
    'Phòng trà ấm cúng (Cozy Tea Room)',
    'Hồ bơi vô cực (Infinity Pool)',
    'Bãi biển Maldives (Tropical Beach)',
    'Sa mạc nắng cháy (Desert)',
    'Khu rừng phép thuật (Fantasy Forest)',
    'Cung điện nguy nga (Palace)',
    'Đường phố Cyberpunk (Neon City)',
    'Sân khấu ánh sáng (Stage Light)',
    'Văn phòng CEO (Modern Office)',
    'Sự kiện thảm đỏ (Red Carpet)',
    'Tàu vũ trụ (Sci-Fi)',
    'Phòng Gym hiện đại',
    'Nhà bếp Luxury'
];

const RATIOS = ['3:4', '1:1', '16:9', '9:16'];
const QUALITIES = ['1K', '2K', '4K', '8K'];

const LIGHTING_PRESETS = [
    { label: "Mặc định", value: "" },
    { label: "Softbox (Studio)", value: "Professional softbox studio lighting, even illumination, gentle shadows" },
    { label: "Nắng tự nhiên", value: "Natural sunlight, warm golden hour, lens flare, outdoor atmosphere" },
    { label: "Điện ảnh (Cinematic)", value: "Cinematic lighting, dramatic shadows, rim light, volumetric fog, moody" },
    { label: "Neon (Cyberpunk)", value: "Neon lighting, pink and blue rim lights, high contrast, futuristic glow" },
    { label: "U tối (Dark/Horror)", value: "Low key lighting, deep shadows, mysterious atmosphere, thriller vibe" }
];

const Studio: React.FC<StudioProps> = ({ addToast, addNotification, currentUser, onRequireAuth, isAuthenticated, isGlobalProcessing, setGlobalProcessing }) => {
  const [subjectFile, setSubjectFile] = useState<File | null>(null);
  const [subjectPreview, setSubjectPreview] = useState<string | null>(null);
  const [outfitFile, setOutfitFile] = useState<File | null>(null);
  const [outfitPreview, setOutfitPreview] = useState<string | null>(null);
  const [accessoryFile, setAccessoryFile] = useState<File | null>(null);
  const [accessoryPreview, setAccessoryPreview] = useState<string | null>(null);
  
  const [checkingSafetyFor, setCheckingSafetyFor] = useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  
  const [background, setBackground] = useState(BACKGROUNDS[1]); 
  const [aspectRatio, setAspectRatio] = useState('3:4');
  const [quality, setQuality] = useState('4K');
  const [batchSize, setBatchSize] = useState(1);
  const [savedChars, setSavedChars] = useState<SavedCharacter[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [preserveIdentity, setPreserveIdentity] = useState(true); 
  
  // Advanced Settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [useMagicPrompt, setUseMagicPrompt] = useState(true);
  const [lighting, setLighting] = useState(LIGHTING_PRESETS[0].value);

  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false);

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{en: string, vi: string}[]>([]);
  const [suggestionHistory, setSuggestionHistory] = useState<any[][]>([]); 
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

  // Load characters on mount and listen for updates
  useEffect(() => {
      const loadCharacters = async () => {
          const chars = await getAllCharacters();
          // Sort characters by newest first
          setSavedChars(chars.sort((a, b) => b.createdAt - a.createdAt));
      };

      loadCharacters();

      // Listen for updates from other modules (e.g. Vision Generator/NewCreation)
      const handleUpdate = () => {
          console.log("[Studio] Refreshing character list...");
          loadCharacters();
      };
      
      window.addEventListener('library_updated', handleUpdate);
      return () => window.removeEventListener('library_updated', handleUpdate);
  }, []);

  const handleSelectCharacter = (char: SavedCharacter) => {
      setSelectedCharId(char.id);
      setSubjectFile(null); 
      setSubjectPreview(`data:image/png;base64,${char.base64Data}`);
  }

  // ... (handleFileChange, handleGetSuggestions, openHistory, triggerDownload unchanged) ...
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'subject' | 'outfit' | 'acc') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCheckingSafetyFor(type);
      try {
          const b64 = await fileToBase64(file);
          const validation = await validateImageSafety(b64);
          if (!validation.safe) {
              const msg = `Hình ảnh vi phạm: ${validation.reason}`;
              addToast('Cảnh báo', msg, 'error');
              e.target.value = ''; 
              return;
          }
          const preview = await fileToPreview(file);
          if (type === 'subject') {
            setSubjectFile(file);
            setSubjectPreview(preview);
            setSelectedCharId(''); // Clear saved character selection if manual upload
          }
          if (type === 'outfit') { setOutfitFile(file); setOutfitPreview(preview); }
          if (type === 'acc') { setAccessoryFile(file); setAccessoryPreview(preview); }
      } catch (err) {
          addToast('Lỗi', 'Không thể kiểm tra an toàn ảnh.', 'error');
      } finally {
          setCheckingSafetyFor(null);
      }
    }
  };

  const handleGetSuggestions = async () => {
      setIsSuggesting(true);
      setSuggestions([]);
      setShowSuggestionsModal(true);
      try {
          let b64 = null;
          if (subjectFile) b64 = await fileToBase64(subjectFile);
          else if (selectedCharId) {
              const char = savedChars.find(c => c.id === selectedCharId);
              if (char) b64 = char.base64Data;
          }
          let outfitB64 = outfitFile ? await fileToBase64(outfitFile) : null;
          let accessoryB64 = accessoryFile ? await fileToBase64(accessoryFile) : null;
          
          const results = await generateStudioSuggestions(b64, outfitB64, accessoryB64, background);
          setSuggestions(results);
          if(results && results.length > 0) setSuggestionHistory(prev => [results, ...prev]);
      } catch (e) {
          addToast("Lỗi", "Không thể tạo gợi ý lúc này", "error");
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

  const triggerDownload = (base64Data: string, index: number) => {
      const link = document.createElement('a');
      link.href = base64Data;
      link.download = `Studio-Composite-${Date.now()}-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleGenerate = async () => {
    if (!isAuthenticated) { onRequireAuth(); return; }

    if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }

    // Rate Limit - Cost is batchSize
    if (currentUser) {
        const check = checkUsageLimit(currentUser.username, ModuleType.STUDIO, batchSize);
        if (!check.allowed) {
            addToast("Không đủ điểm", check.message || `Cần ${batchSize} điểm để tạo.`, "error");
            return;
        }
    }

    if (!subjectPreview) {
        addToast("Thiếu thông tin", "Bắt buộc phải có Nhân vật chính (Main Subject)", "error");
        return;
    }
    setIsGenerating(true);
    setGlobalProcessing?.(true);
    setResultImages([]);
    
    try {
        let subB64 = '';
        if (subjectFile) {
            subB64 = await fileToBase64(subjectFile);
        } else if (selectedCharId) {
            const char = savedChars.find(c => c.id === selectedCharId);
            if (char) subB64 = char.base64Data;
        }

        const outB64 = outfitFile ? await fileToBase64(outfitFile) : null;
        const accB64 = accessoryFile ? await fileToBase64(accessoryFile) : null;

        // Apply Magic Prompt and Lighting
        let finalPrompt = `${prompt}`;
        if (lighting) finalPrompt += `. Lighting: ${lighting}`;
        if (useMagicPrompt) {
            addToast("Magic Prompt", "Đang tối ưu hóa ánh sáng và chi tiết...", "info");
            finalPrompt = await enhancePrompt(finalPrompt);
        }

        const promises = Array(batchSize).fill(null).map(() => 
            generateCompositeImage(subB64, outB64, accB64, finalPrompt, background, aspectRatio, quality, preserveIdentity, negativePrompt)
        );

        const rawResults = await Promise.all(promises);
        
        // Post-process Watermark
        const processedResults = await Promise.all(rawResults.map(async (raw) => {
            if (currentUser && !currentUser.isVerified) {
                return await applyWatermark(raw);
            }
            return `data:image/png;base64,${raw}`;
        }));

        setResultImages(processedResults);

        for (let i = 0; i < processedResults.length; i++) {
            const img = processedResults[i];
            triggerDownload(img, i);
            await saveItem({
                id: uuidv4(),
                type: 'image',
                prompt: `Studio: ${background}. ${finalPrompt}`,
                createdAt: Date.now() + i,
                base64Data: img,
                meta: { composite: true, quality, background, lighting, negativePrompt, sourceModule: ModuleType.STUDIO } // ADDED sourceModule
            });
        }
        
        if (currentUser) incrementUsage(currentUser.username, ModuleType.STUDIO, batchSize);
        addToast("Thành công", `Đã ghép ${batchSize} ảnh và lưu vào Thư viện!`, "success");

    } catch (e: any) {
        const msg = e.message || String(e);
        if (msg.includes('safety')) {
             addToast("Vi phạm chính sách", "Ảnh tạo ra vi phạm chính sách an toàn.", "error");
        } else {
             addToast("Lỗi", msg, "error");
        }
    } finally {
        setIsGenerating(false);
        setGlobalProcessing?.(false);
    }
  };

  const handleRegenerateSingle = async () => {
      if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }
      // Re-check Limit - Cost 1
      if (currentUser) {
        const check = checkUsageLimit(currentUser.username, ModuleType.STUDIO, 1);
        if (!check.allowed) {
            addToast("Hết điểm", check.message || "Hết điểm", "error");
            return;
        }
      }

      setIsRegeneratingSingle(true);
      setGlobalProcessing?.(true);
      try {
        let subB64 = '';
        if (subjectFile) {
            subB64 = await fileToBase64(subjectFile);
        } else if (selectedCharId) {
            const char = savedChars.find(c => c.id === selectedCharId);
            if (char) subB64 = char.base64Data;
        } else if (subjectPreview) {
            subB64 = subjectPreview.split(',')[1];
        }

        const outB64 = outfitFile ? await fileToBase64(outfitFile) : null;
        const accB64 = accessoryFile ? await fileToBase64(accessoryFile) : null;

        let finalPrompt = `${prompt} . Lighting: ${lighting}`;
        if (useMagicPrompt) finalPrompt = await enhancePrompt(finalPrompt);

        const rawB64 = await generateCompositeImage(subB64, outB64, accB64, finalPrompt, background, aspectRatio, quality, preserveIdentity, negativePrompt);
        
        let fullB64 = `data:image/png;base64,${rawB64}`;
        if (currentUser && !currentUser.isVerified) {
            fullB64 = await applyWatermark(rawB64);
        }
        
        setResultImages(prev => [fullB64, ...prev]);
        setSelectedPreview(fullB64);
        triggerDownload(fullB64, 0);

        await saveItem({
            id: uuidv4(),
            type: 'image',
            prompt: `Studio: ${background}. ${finalPrompt}`,
            createdAt: Date.now(),
            base64Data: fullB64,
            meta: { composite: true, quality, background, lighting, negativePrompt, sourceModule: ModuleType.STUDIO } // ADDED sourceModule
        });
        
        if (currentUser) incrementUsage(currentUser.username, ModuleType.STUDIO, 1);
        addToast("Thành công", "Đã tạo lại và lưu ảnh mới!", "success");

      } catch (e) {
          addToast("Lỗi", "Không thể tạo lại ảnh.", "error");
      } finally {
          setIsRegeneratingSingle(false);
          setGlobalProcessing?.(false);
      }
  }

  return (
    <div className="flex flex-col lg:flex-row h-full w-full p-4 lg:p-6 gap-6 lg:gap-8 relative">
        {/* ... (Existing Layout) ... */}
        <div className="w-full lg:w-[420px] flex flex-col gap-6 lg:overflow-y-auto lg:pr-2 custom-scrollbar shrink-0 pb-10 lg:pb-0">
            <div className="pb-4 border-b border-white/5">
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-2">Studio Ảo</h2>
                <p className="text-sm text-zinc-400 font-light">Ghép nhân vật, trang phục và phụ kiện bằng AI.</p>
            </div>
            
            <div className="space-y-6">
                {/* Saved Chars Strip */}
                {savedChars.length > 0 && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex justify-between items-center">
                            <span>Nhân vật đã lưu ({savedChars.length})</span>
                            <span className="text-[8px] text-zinc-600">Vision Generator</span>
                        </label>
                        <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar snap-x">
                            {savedChars.map(char => (
                                <div key={char.id} className={`relative min-w-[70px] h-[70px] rounded-full overflow-hidden cursor-pointer border-2 transition-all shadow-lg snap-start group ${selectedCharId === char.id ? 'border-indigo-500 ring-2 ring-indigo-500/30 grayscale-0' : 'border-zinc-800 grayscale hover:grayscale-0'}`} onClick={() => handleSelectCharacter(char)} title={char.name}>
                                    <img src={`data:image/png;base64,${char.base64Data}`} className="w-full h-full object-cover" />
                                    {selectedCharId === char.id && (
                                        <div className="absolute inset-0 bg-indigo-500/40 flex items-center justify-center animate-in fade-in"><CheckCircle2 className="text-white drop-shadow-md" size={24} /></div>
                                    )}
                                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white text-center py-0.5 truncate px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {char.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main Subject */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl opacity-10 group-hover:opacity-30 transition duration-500 blur"></div>
                    <div className="relative bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 transition-all">
                        <div className="flex items-center gap-2 mb-3 text-indigo-300 font-bold text-sm uppercase tracking-wide">
                            <User size={16} /> Nhân vật chính <span className="text-red-500">*</span>
                        </div>
                        <div className="relative h-48 bg-black/20 rounded-xl border-2 border-dashed border-zinc-700 hover:border-indigo-500/50 transition-colors flex items-center justify-center overflow-hidden cursor-pointer">
                            {checkingSafetyFor === 'subject' && (
                                <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center text-center p-2"><Loader2 size={24} className="text-indigo-500 animate-spin mb-1"/><p className="text-[10px] text-zinc-300">Đang kiểm tra...</p></div>
                            )}
                            {subjectPreview ? <img src={subjectPreview} className="w-full h-full object-contain" alt="Subject" /> : <div className="text-zinc-500 text-sm flex flex-col items-center gap-2"><div className="p-3 bg-zinc-800/50 rounded-full"><Upload size={20} /></div><span className="font-medium">Tải ảnh lên hoặc chọn ở trên</span></div>}
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileChange(e, 'subject')} accept="image/*" disabled={checkingSafetyFor !== null} />
                        </div>
                    </div>
                </div>

                {/* Accessories & Outfit */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 hover:bg-zinc-900/60 transition-colors">
                        <div className="flex items-center gap-2 mb-3 text-purple-300 font-bold text-xs uppercase tracking-wide"><Shirt size={14} /> Trang phục</div>
                        <div className="relative h-28 bg-black/20 rounded-xl border border-dashed border-zinc-700 hover:border-purple-500/50 flex items-center justify-center overflow-hidden">
                             {checkingSafetyFor === 'outfit' && <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center text-center p-1"><Loader2 size={16} className="text-purple-500 animate-spin mb-1"/><p className="text-[8px] text-zinc-300 leading-tight">Checking...</p></div>}
                             <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileChange(e, 'outfit')} accept="image/*" disabled={checkingSafetyFor !== null} />
                             {outfitPreview ? <img src={outfitPreview} className="w-full h-full object-contain"/> : <Upload size={16} className="text-zinc-600 opacity-50"/>}
                        </div>
                    </div>
                    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 hover:bg-zinc-900/60 transition-colors">
                        <div className="flex items-center gap-2 mb-3 text-pink-300 font-bold text-xs uppercase tracking-wide"><Package size={14} /> Sản phẩm (Cầm/Đeo)</div>
                        <div className="relative h-28 bg-black/20 rounded-xl border border-dashed border-zinc-700 hover:border-pink-500/50 flex items-center justify-center overflow-hidden">
                            {checkingSafetyFor === 'acc' && <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center text-center p-1"><Loader2 size={16} className="text-pink-500 animate-spin mb-1"/><p className="text-[8px] text-zinc-300 leading-tight">Checking...</p></div>}
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileChange(e, 'acc')} accept="image/*" disabled={checkingSafetyFor !== null} />
                            {accessoryPreview ? <img src={accessoryPreview} className="w-full h-full object-contain"/> : <Upload size={16} className="text-zinc-600 opacity-50"/>}
                        </div>
                    </div>
                </div>

                {/* Config */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 space-y-4">
                     <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">Chọn Bối cảnh mẫu</label>
                        <select value={background} onChange={e => setBackground(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800 text-white text-sm rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 custom-scrollbar">
                            {BACKGROUNDS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                     </div>

                     <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1"><PenTool size={10}/> Mô tả Hành động & Tư thế (Action & Pose)</label>
                            <div className="flex gap-2">
                                <button onClick={() => setUseMagicPrompt(!useMagicPrompt)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${useMagicPrompt ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                                    <Sparkles size={8}/> Magic
                                </button>
                                <button onClick={openHistory} className="text-[10px] text-zinc-500 hover:text-white"><History size={12}/></button>
                                <button onClick={handleGetSuggestions} disabled={isSuggesting} className="flex items-center gap-1 text-[10px] bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 px-2 py-1 rounded transition-colors disabled:opacity-50">
                                    {isSuggesting ? <Loader2 size={10} className="animate-spin"/> : <Lightbulb size={10}/>} Gợi ý
                                </button>
                            </div>
                        </div>
                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="VD: Nhân vật đang đi bộ về phía trước, tay cầm sản phẩm, ánh mắt nhìn thẳng..." className="w-full h-20 bg-zinc-950/80 border border-zinc-800 text-white text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 resize-none placeholder-zinc-600"/>
                     </div>

                     <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">Tỷ lệ</label>
                            <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800 text-white text-sm rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500">
                                {RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                         </div>
                         <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">Chất lượng</label>
                            <select value={quality} onChange={e => setQuality(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800 text-white text-sm rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500">
                                {QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
                            </select>
                         </div>
                     </div>
                     
                     {/* Advanced Settings Toggle */}
                     <div className="pt-2 border-t border-white/5">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)} 
                            className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-wider w-full justify-between"
                        >
                            <span className="flex items-center gap-2"><Sliders size={12}/> Cài đặt nâng cao (Pro)</span>
                            <span className="text-lg">{showAdvanced ? '-' : '+'}</span>
                        </button>
                        
                        {showAdvanced && (
                            <div className="mt-3 animate-in fade-in slide-in-from-top-2 space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Sun size={10}/> Ánh sáng (Lighting)</label>
                                    <select value={lighting} onChange={e => setLighting(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800 text-white text-xs rounded-lg p-2 outline-none">
                                        {LIGHTING_PRESETS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1.5 block">Negative Prompt</label>
                                    <textarea 
                                        value={negativePrompt}
                                        onChange={(e) => setNegativePrompt(e.target.value)}
                                        placeholder="VD: bad face, extra fingers, watermark..."
                                        className="w-full h-16 bg-zinc-950/80 border border-zinc-800 rounded-lg p-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-red-500/50 resize-none"
                                    />
                                </div>
                            </div>
                        )}
                     </div>

                     <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">Số lượng ({batchSize})</label>
                        <input type="range" min="1" max="4" value={batchSize} onChange={(e) => setBatchSize(parseInt(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
                     </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20 transition-colors" onClick={() => setPreserveIdentity(!preserveIdentity)}>
                    <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${preserveIdentity ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600'}`}>
                        {preserveIdentity && <Check size={14} className="text-white" />}
                    </div>
                    <p className="text-xs text-indigo-200 font-medium leading-relaxed select-none">
                        Chú ý cần lấy vóc dáng và khuôn mặt của nhân vật chính, phần trang phục sẽ mặc trang phục cho nhân vật chính.
                    </p>
                </div>

                <button onClick={handleGenerate} disabled={isGenerating || (isGlobalProcessing && !isGenerating)} className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-[length:200%_auto] hover:bg-right transition-all duration-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-purple-900/20 sticky bottom-0 lg:static z-10">
                    {isGenerating ? "Đang xử lý..." : (isGlobalProcessing && !isGenerating) ? "Hệ thống đang bận..." : <><Wand2 size={20}/> Ghép & Tạo Ảnh {batchSize > 1 && `(${batchSize})`} (-{batchSize} Điểm)</>}
                </button>
            </div>
        </div>

        {/* Right: Result Grid */}
        <div className="flex-1 bg-zinc-900/20 rounded-3xl border border-white/5 p-6 flex flex-col relative overflow-hidden backdrop-blur-sm min-h-[400px] lg:h-full lg:min-h-0">
            {resultImages.length > 0 ? (
                <div className={`grid gap-6 h-full w-full lg:overflow-y-auto custom-scrollbar p-2 ${resultImages.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {resultImages.map((img, idx) => (
                        <div key={idx} className="relative group rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-2xl flex items-center justify-center aspect-[3/4] cursor-pointer" onClick={() => setSelectedPreview(img)}>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 flex flex-col justify-end p-6">
                                <button onClick={(e) => { e.stopPropagation(); triggerDownload(img, idx); }} className="w-full py-3 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 shadow-lg">
                                    <Download size={18}/> Tải ảnh về
                                </button>
                            </div>
                            <img src={img} alt={`Composite ${idx}`} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"/>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-60 min-h-[300px]">
                    <ImagePlus size={64} className="mb-4 text-purple-400/50" strokeWidth={1}/>
                    <p className="text-lg font-light tracking-wide">Studio đang chờ bạn thiết lập</p>
                </div>
            )}
        </div>

        {/* Modals (unchanged logic) */}
        <SuggestionModal isOpen={showSuggestionsModal} onClose={() => setShowSuggestionsModal(false)} title="Gợi ý Bối cảnh & Ánh sáng" suggestions={suggestions} onSelect={(item) => { setPrompt(item.en); setShowSuggestionsModal(false); }} isLoading={isSuggesting}/>
        <ImageViewerModal isOpen={!!selectedPreview} onClose={() => setSelectedPreview(null)} imageSrc={selectedPreview} altText="Studio Result">
             <div className="flex gap-3 w-full max-w-lg justify-center">
                 <button onClick={handleRegenerateSingle} disabled={isRegeneratingSingle || isGlobalProcessing} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50">
                    <RefreshCw size={18} className={isRegeneratingSingle ? "animate-spin" : ""}/> {isRegeneratingSingle ? "Đang tạo lại..." : "Tạo lại (-1 Điểm)"}
                </button>
                 <button onClick={() => selectedPreview && triggerDownload(selectedPreview, Date.now())} className="flex-1 bg-white text-black px-6 py-2 rounded-lg font-bold hover:bg-zinc-200 flex items-center justify-center gap-2">
                    <Download size={18}/> Tải xuống
                </button>
             </div>
        </ImageViewerModal>
    </div>
  );
};

export default Studio;
