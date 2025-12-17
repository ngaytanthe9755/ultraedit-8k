
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Shirt, User, Gem, Wand2, Download, X, Sparkles, 
  Loader2, Package, ShieldCheck, Cpu, Watch, Info, Layers, 
  MousePointer2, Sliders, Scan, Target, CheckCircle2, Lock, Unlock, 
  Aperture, Camera, RefreshCw, Monitor
} from 'lucide-react';
import { generateCompositeImage, validateImageSafety, generateStudioSuggestions, enhancePrompt } from '../services/geminiService';
import { saveItem, getAllCharacters } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
import { SavedCharacter, User as AppUser, ModuleType } from '../types'; 
import { SuggestionModal } from '../components/SuggestionModal';
import { applyWatermark } from '../services/imageUtils';
import { checkUsageLimit, incrementUsage } from '../services/userService';

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
    'Văn phòng CEO (Modern Office)',
    'Tuyết trắng Sapa (Snowy Forest)',
    'Sảnh khách sạn 5 sao (Luxury Lobby)',
    'Thư viện cổ (Classic Library)'
];

const RATIOS = ['3:4', '1:1', '16:9', '9:16'];
const QUALITIES = ['1K', '2K', '4K', '8K'];

const Studio: React.FC<StudioProps> = ({ addToast, addNotification, currentUser, onRequireAuth, isAuthenticated, isGlobalProcessing, setGlobalProcessing }) => {
  const [subjectFile, setSubjectFile] = useState<File | null>(null);
  const [subjectPreview, setSubjectPreview] = useState<string | null>(null);
  const [outfitFile, setOutfitFile] = useState<File | null>(null);
  const [outfitPreview, setOutfitPreview] = useState<string | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [accessoryFile, setAccessoryFile] = useState<File | null>(null);
  const [accessoryPreview, setAccessoryPreview] = useState<string | null>(null);
  const [checkingSafetyFor, setCheckingSafetyFor] = useState<string | null>(null);
  
  const [prompt, setPrompt] = useState('');
  const [background, setBackground] = useState(BACKGROUNDS[0]); 
  const [aspectRatio, setAspectRatio] = useState('3:4');
  const [quality, setQuality] = useState('2K');
  const [batchSize, setBatchSize] = useState(1);
  const [savedChars, setSavedChars] = useState<SavedCharacter[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  
  const [lockFace, setLockFace] = useState(true);
  const [lockBody, setLockBody] = useState(true);
  const [lockTexture, setLockTexture] = useState(true);
  const [negativePrompt, setNegativePrompt] = useState('blurry, lowres, distorted face, warped limbs, cartoon, illustration, noisy, low quality textures');
  const [useMagicPrompt, setUseMagicPrompt] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [renderStep, setRenderStep] = useState('');
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

  useEffect(() => {
      const loadCharacters = async () => {
          const chars = await getAllCharacters();
          setSavedChars(chars.sort((a, b) => b.createdAt - a.createdAt));
      };
      loadCharacters();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'subject' | 'outfit' | 'product' | 'acc') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCheckingSafetyFor(type);
      try {
          const b64 = await fileToBase64(file);
          const validation = await validateImageSafety(b64);
          if (!validation.safe) {
              addToast('Cảnh báo an toàn', `Hình ảnh không hợp lệ: ${validation.reason}`, 'error');
              return;
          }
          const preview = await fileToPreview(file);
          if (type === 'subject') { setSubjectFile(file); setSubjectPreview(preview); setSelectedCharId(''); }
          if (type === 'outfit') { setOutfitFile(file); setOutfitPreview(preview); }
          if (type === 'product') { setProductFile(file); setProductPreview(preview); }
          if (type === 'acc') { setAccessoryFile(file); setAccessoryPreview(preview); }
      } catch (err) {
          addToast('Lỗi', 'Không thể xử lý hình ảnh.', 'error');
      } finally {
          setCheckingSafetyFor(null);
      }
    }
  };

  const clearAsset = (type: 'subject' | 'outfit' | 'product' | 'acc') => {
      if (type === 'subject') { setSubjectFile(null); setSubjectPreview(null); }
      if (type === 'outfit') { setOutfitFile(null); setOutfitPreview(null); }
      if (type === 'product') { setProductFile(null); setProductPreview(null); }
      if (type === 'acc') { setAccessoryFile(null); setAccessoryPreview(null); }
  };

  const handleGenerate = async () => {
    if (!isAuthenticated) { onRequireAuth(); return; }
    if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }
    
    if (currentUser) {
        const check = checkUsageLimit(currentUser.username, ModuleType.STUDIO, batchSize);
        if (!check.allowed) { addToast("Không đủ điểm", check.message || "Hết điểm", "error"); return; }
    }

    let subB64 = subjectFile ? await fileToBase64(subjectFile) : (selectedCharId ? savedChars.find(c => c.id === selectedCharId)?.base64Data : null);
    if (!subB64) { addToast("Thiếu dữ liệu", "Cần tải ảnh Nhân vật chính làm định danh.", "error"); return; }

    setIsGenerating(true);
    setGlobalProcessing?.(true);
    setResultImages([]);
    
    try {
        const outB64 = outfitFile ? await fileToBase64(outfitFile) : null;
        const prodB64 = productFile ? await fileToBase64(productFile) : null;
        const accB64 = accessoryFile ? await fileToBase64(accessoryFile) : null;

        let finalPrompt = prompt;
        if (useMagicPrompt) {
            setRenderStep("Phân tích cấu trúc pixel & ánh sáng vật thể...");
            finalPrompt = await enhancePrompt(`${prompt || "Commercial fashion photography, model interacting with product"}. Ensure 100% texture consistency.`);
        }

        setRenderStep("Đang tổng hợp các tham chiếu hình ảnh (Composite Phase)...");
        
        const promises = Array(batchSize).fill(null).map(() => 
            generateCompositeImage(subB64!, outB64, prodB64, accB64, finalPrompt, background, aspectRatio, quality, lockFace, negativePrompt)
        );

        const rawResults = await Promise.all(promises);
        
        setRenderStep("Hoàn thiện xử lý hậu kỳ (Post-processing)...");
        const processedResults = await Promise.all(rawResults.map(async (raw) => {
            if (currentUser && !currentUser.isVerified) return await applyWatermark(raw);
            return `data:image/png;base64,${raw}`;
        }));

        setResultImages(processedResults);
        
        for (const img of processedResults) {
            await saveItem({
                id: uuidv4(),
                type: 'image',
                prompt: `Studio Composite: ${prompt.substring(0, 30)}...`,
                createdAt: Date.now(),
                base64Data: img,
                meta: { composite: true, sourceModule: ModuleType.STUDIO, quality, aspectRatio }
            });
        }

        incrementUsage(currentUser!.username, ModuleType.STUDIO, batchSize);
        addToast("Thành công", `Đã ghép xong ${batchSize} ảnh với độ chính xác cao!`, "success");

    } catch (e: any) {
        addToast("Lỗi Render", e.message || "Không thể thực hiện ghép ảnh.", "error");
    } finally {
        setIsGenerating(false);
        setRenderStep('');
        setGlobalProcessing?.(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full p-4 lg:p-6 gap-6 lg:gap-8 relative overflow-hidden bg-zinc-950">
        {/* Sidebar Controls */}
        <div className="w-full lg:w-[460px] flex flex-col gap-6 lg:overflow-y-auto lg:pr-3 custom-scrollbar shrink-0 pb-24 lg:pb-0 z-10">
            <div className="pb-4 border-b border-white/5">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                        <Aperture size={24} className="animate-spin-slow"/>
                    </div>
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-500 tracking-tight">Composition Studio</h2>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest bg-zinc-900/50 p-2 rounded-lg border border-white/5">
                    <Cpu size={14} className="text-indigo-500"/> Authorized Tier: {currentUser?.modelTier || '1.5-free'}
                </div>
            </div>
            
            <div className="space-y-6">
                {/* Visual Assets Mapping */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 bg-zinc-900/60 border border-indigo-500/30 rounded-2xl p-4 shadow-xl relative group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-tighter">
                                <User size={16} /> Identity Source (Nhân vật chính) *
                            </div>
                            {subjectPreview && <button onClick={() => clearAsset('subject')} className="text-zinc-500 hover:text-red-400 transition-colors"><X size={14}/></button>}
                        </div>
                        <div className="relative h-44 bg-black/40 rounded-xl border-2 border-dashed border-indigo-500/20 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-500/50 transition-all shadow-inner">
                            {checkingSafetyFor === 'subject' ? <Loader2 className="animate-spin text-indigo-500"/> : subjectPreview ? <img src={subjectPreview} className="w-full h-full object-contain" /> : (
                                <div className="text-center space-y-2">
                                    <Upload size={24} className="text-zinc-600 mx-auto"/>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Tải ảnh định danh</p>
                                </div>
                            )}
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'subject')} accept="image/*" />
                        </div>
                    </div>

                    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-2 hover:border-orange-500/30 transition-all">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-orange-300 uppercase tracking-tighter flex items-center gap-1"><Package size={14}/> Product Map (Sản phẩm)</span>
                            {productPreview && <button onClick={() => clearAsset('product')} className="text-zinc-600 hover:text-red-400"><X size={12}/></button>}
                        </div>
                        <div className="relative aspect-square bg-black/20 rounded-xl border border-dashed border-zinc-800 flex items-center justify-center overflow-hidden hover:border-orange-500/40 transition-all cursor-pointer group">
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileChange(e, 'product')} accept="image/*" />
                            {checkingSafetyFor === 'product' ? <Loader2 size={16} className="animate-spin text-orange-500"/> : productPreview ? <img src={productPreview} className="w-full h-full object-contain"/> : <Upload size={18} className="text-zinc-700"/>}
                        </div>
                    </div>

                    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-2 hover:border-purple-500/30 transition-all">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-tighter flex items-center gap-1"><Shirt size={14}/> Outfit / Style</span>
                            {outfitPreview && <button onClick={() => clearAsset('outfit')} className="text-zinc-600 hover:text-red-400"><X size={12}/></button>}
                        </div>
                        <div className="relative aspect-square bg-black/20 rounded-xl border border-dashed border-zinc-800 flex items-center justify-center overflow-hidden hover:border-purple-500/40 transition-all cursor-pointer group">
                             <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileChange(e, 'outfit')} accept="image/*" />
                             {checkingSafetyFor === 'outfit' ? <Loader2 size={16} className="animate-spin text-purple-500"/> : outfitPreview ? <img src={outfitPreview} className="w-full h-full object-contain"/> : <Upload size={18} className="text-zinc-700"/>}
                        </div>
                    </div>

                    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter flex items-center gap-1"><Monitor size={14}/> Render Quality</div>
                        <select value={quality} onChange={e => setQuality(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white text-[10px] font-bold rounded-lg p-2 outline-none focus:border-indigo-500 transition-colors">
                            {QUALITIES.map(q => <option key={q} value={q}>{q} UHD</option>)}
                        </select>
                    </div>

                    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter flex items-center gap-1"><Layers size={14}/> Batch rendering</div>
                        <div className="flex gap-2 h-full items-center">
                            {[1, 2, 3].map(n => (
                                <button key={n} onClick={() => setBatchSize(n)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${batchSize === n ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-900'}`}>{n}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/80 border border-emerald-500/30 rounded-2xl p-5 shadow-lg space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
                        <ShieldCheck size={18}/> Precision Mapping Locks
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <button onClick={() => setLockFace(!lockFace)} className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all ${lockFace ? 'bg-emerald-600/20 border-emerald-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-600'}`}>
                            {lockFace ? <Lock size={16}/> : <Unlock size={16}/>}
                            <span className="text-[9px] font-bold uppercase">Lock Identity</span>
                        </button>
                        <button onClick={() => setLockBody(!lockBody)} className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all ${lockBody ? 'bg-emerald-600/20 border-emerald-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-600'}`}>
                            {lockBody ? <Lock size={16}/> : <Unlock size={16}/>}
                            <span className="text-[9px] font-bold uppercase">Lock Body</span>
                        </button>
                        <button onClick={() => setLockTexture(!lockTexture)} className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all ${lockTexture ? 'bg-emerald-600/20 border-emerald-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-600'}`}>
                            {lockTexture ? <Lock size={16}/> : <Unlock size={16}/>}
                            <span className="text-[9px] font-bold uppercase">Lock Texture</span>
                        </button>
                    </div>
                    <p className="text-[9px] text-zinc-500 italic leading-relaxed">
                        * Ghi chú: Hệ thống sẽ cưỡng chế AI sao chép 100% đặc điểm từ ảnh tham chiếu. Thích hợp để ghép người cầm sản phẩm cụ thể.
                    </p>
                </div>

                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 space-y-5">
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Mô tả hành động (VD: Nhân vật đang cầm túi xách mỉm cười)..." className="w-full h-28 bg-zinc-950/80 border border-zinc-800 text-white text-sm rounded-xl p-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none leading-relaxed"/>
                    <select value={background} onChange={e => setBackground(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs rounded-xl p-3 outline-none focus:border-indigo-500">
                        {BACKGROUNDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>

                <button onClick={handleGenerate} disabled={isGenerating || (isGlobalProcessing && !isGenerating)} className="w-full py-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white font-black text-sm uppercase tracking-widest disabled:opacity-50 flex flex-col items-center justify-center gap-1 shadow-2xl border border-white/10 group transition-all">
                    {isGenerating ? (
                        <>
                            <Loader2 size={24} className="animate-spin mb-1"/>
                            <span className="text-[10px] animate-pulse">{renderStep}</span>
                        </>
                    ) : (
                        <span className="flex items-center gap-3"><Wand2 size={20} className="group-hover:rotate-12 transition-transform"/> Start Precise Mapping</span>
                    )}
                </button>
            </div>
        </div>

        {/* Preview Panel */}
        <div className="flex-1 bg-zinc-900/30 rounded-[2.5rem] border border-white/5 p-6 flex flex-col relative overflow-hidden backdrop-blur-xl min-h-[550px] lg:h-full shadow-2xl">
            <div className="absolute top-6 left-8 flex items-center gap-4 text-zinc-500 z-10">
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Studio Live Monitor</span>
                </div>
            </div>

            {resultImages.length > 0 ? (
                <div className="flex-1 flex flex-col gap-8 lg:overflow-y-auto custom-scrollbar p-2 mt-12 relative z-10">
                    {resultImages.map((img, idx) => (
                        <div key={idx} className="relative group rounded-3xl overflow-hidden border border-white/10 bg-black/60 shadow-2xl flex items-center justify-center animate-in zoom-in duration-700">
                            <img src={img} className="max-w-full max-h-[75vh] object-contain" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center gap-6 backdrop-blur-md">
                                <button onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = img;
                                    link.download = `Studio-Master-${idx+1}.png`;
                                    link.click();
                                }} className="p-5 bg-white text-black hover:bg-indigo-500 hover:text-white rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95">
                                    <Download size={32}/>
                                </button>
                            </div>
                            <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-indigo-600/90 backdrop-blur px-4 py-2 rounded-xl border border-white/20 shadow-lg">
                                <Sparkles size={14} className="text-white"/>
                                <span className="text-[10px] font-black text-white uppercase tracking-wider">Fidelity Verified • {quality} Ultra</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-8 animate-in fade-in duration-1000 relative z-0">
                    <div className="relative p-12 rounded-full border border-zinc-800 bg-zinc-900/20 backdrop-blur-sm">
                        <MousePointer2 size={80} className="text-zinc-800 animate-bounce" />
                    </div>
                    <div className="text-center space-y-4 max-w-sm">
                        <p className="text-2xl font-black tracking-widest uppercase text-zinc-800">Studio Ready</p>
                        <p className="text-xs text-zinc-600 font-medium leading-relaxed uppercase tracking-tighter">
                            Tải ảnh nhân vật và sản phẩm tham chiếu để bắt đầu quá trình ghép ảnh chính xác cao. Đảm bảo độ phân giải 8K cho tài khoản Pro.
                        </p>
                    </div>
                </div>
            )}
        </div>
        
        <SuggestionModal 
            isOpen={showSuggestionsModal} 
            onClose={() => setShowSuggestionsModal(false)} 
            title="Gợi ý Studio Concept" 
            suggestions={suggestions} 
            onSelect={(item) => { 
                setPrompt(item.en); 
                setShowSuggestionsModal(false); 
            }} 
            isLoading={isSuggesting}
        />
    </div>
  );
};

export default Studio;
