
import React, { useState, useEffect } from 'react';
import { Upload, Layout as LayoutIcon, Type, Image as ImageIcon, Wand2, Check, Lightbulb, Download, Loader2, Monitor, Sliders, Palette, Sun, Grid, Layers, Box, ShoppingBag, User as UserIcon, Hexagon, AlignVerticalSpaceAround, AlignCenterVertical, AlignEndVertical, AlignStartVertical, MousePointer2 } from 'lucide-react';
import { generatePoster, generatePosterSuggestions, validateImageSafety, enhancePrompt } from '../services/geminiService';
import { saveItem } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
import { SuggestionModal } from '../components/SuggestionModal';
import { User, ModuleType } from '../types';
import { checkUsageLimit, incrementUsage } from '../services/userService';
import { applyWatermark } from '../services/imageUtils';

// --- CONFIGURATION DATA ---

const CATEGORIES = [
    { id: 'fashion', label: 'Thời Trang & Luxury', icon: ShoppingBag },
    { id: 'tech', label: 'Công Nghệ & Startup', icon: Hexagon },
    { id: 'food', label: 'Ẩm Thực & F&B', icon: Layers },
    { id: 'event', label: 'Sự Kiện & Sale', icon: Box }
];

// Updated Templates with Vietnamese & Visual Previews
const TEMPLATES: Record<string, { id: string, name: string, style: string, visual: string, prompt_en: string }[]> = {
    fashion: [
        { 
            id: 'lux_min', 
            name: 'Sang Trọng Tối Giản', 
            style: 'Tạp chí thời trang cao cấp, nền sạch, ít chi tiết, tập trung chủ thể.', 
            visual: 'https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=400&q=80',
            prompt_en: 'High-end fashion magazine cover, minimalist luxury, serif typography, vast negative space, elegant, beige and gold tones.' 
        },
        { 
            id: 'summer_vibe', 
            name: 'Mùa Hè Rực Rỡ', 
            style: 'Nắng vàng, biển xanh, năng động, màu sắc tươi tắn.', 
            visual: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&q=80',
            prompt_en: 'Bright sunlight, blue sky, beach background, energetic, vivid colors, lifestyle photography, summer sale vibe.' 
        },
        { 
            id: 'studio_glam', 
            name: 'Studio Đẳng Cấp', 
            style: 'Ánh sáng studio chuyên nghiệp, nền tối, phông nền nghệ thuật.', 
            visual: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
            prompt_en: 'Professional studio portrait, rembrandt lighting, dark textured background, spotlight on subject, vogue style.' 
        },
        { 
            id: 'street_style', 
            name: 'Đường Phố (Streetwear)', 
            style: 'Bụi bặm, bê tông, graffiti, ánh sáng tự nhiên gắt.', 
            visual: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&q=80',
            prompt_en: 'Urban streetwear fashion, concrete background, graffiti art, high contrast, edgy, gen-z aesthetic.' 
        },
    ],
    tech: [
        { 
            id: 'cyberpunk', 
            name: 'Tương Lai Neon', 
            style: 'Thành phố tương lai, đèn led xanh hồng, công nghệ cao.', 
            visual: 'https://images.unsplash.com/photo-1515630278258-407f66498911?w=400&q=80',
            prompt_en: 'Futuristic city, neon lights (cyan/magenta), wet asphalt, high contrast, techwear aesthetic, glitch effect.' 
        },
        { 
            id: 'clean_corp', 
            name: 'Văn Phòng Tinh Gọn', 
            style: 'Nền trắng/xám, hình khối 3D, chuyên nghiệp, tin cậy.', 
            visual: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=400&q=80',
            prompt_en: 'White background, abstract geometric shapes (blue/grey), isometric view, trustworthy, professional software vibe.' 
        },
        { 
            id: 'glass_morphism', 
            name: 'Hiệu Ứng Kính (Glass)', 
            style: 'Kính mờ, màu pastel, hiện đại, trend thiết kế UI/UX.', 
            visual: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
            prompt_en: 'Glassmorphism style, frosted glass elements, soft gradients, abstract 3D shapes, modern UI/UX design inspiration.' 
        },
    ],
    food: [
        { 
            id: 'dark_foodie', 
            name: 'Ẩm Thực Huyền Bí', 
            style: 'Nền gỗ tối, ánh sáng cạnh, khói bay, sang trọng.', 
            visual: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80',
            prompt_en: 'Dark rustic wood table, dramatic side lighting, steam rising, macro detail, michelin star plating, cinematic food porn.' 
        },
        { 
            id: 'organic_fresh', 
            name: 'Xanh Tươi Tự Nhiên', 
            style: 'Nắng sáng, lá xanh, giọt nước, cảm giác healthy.', 
            visual: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80',
            prompt_en: 'Bright natural lighting, green leaves background, wooden texture, water droplets, fresh and eco-friendly, organic vibe.' 
        },
        { 
            id: 'pop_art', 
            name: 'Sắc Màu Bùng Nổ', 
            style: 'Nền màu trơn rực rỡ, bóng đổ cứng, vui nhộn.', 
            visual: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&q=80',
            prompt_en: 'Colorful solid background, hard shadows, vibrant contrast, playful, retro comic pop-art style.' 
        },
    ],
    event: [
        { 
            id: 'bold_sale', 
            name: 'Siêu Sale Rực Lửa', 
            style: 'Tông Đỏ-Vàng, chữ lớn, khẩn cấp, năng lượng cao.', 
            visual: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80',
            prompt_en: 'Red and Yellow theme, massive typography, urgency, bursting shapes, confetti, high energy, black friday vibe.' 
        },
        { 
            id: 'concert_glow', 
            name: 'Sự Kiện Ánh Sáng', 
            style: 'Đèn sân khấu, đám đông, khói, tia laser.', 
            visual: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80',
            prompt_en: 'Stage lights, crowd silhouette, smoke/fog, laser beams, atmosphere, music festival poster, night club.' 
        },
        { 
            id: 'elegant_inv', 
            name: 'Dạ Tiệc Hoàng Gia', 
            style: 'Nền lụa đen, bụi vàng, bokeh, thư mời cao cấp.', 
            visual: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400&q=80',
            prompt_en: 'Black silk texture background, golden particles, bokeh lights, cursive typography, premium invitation, gala dinner.' 
        },
    ]
};

const TEXT_LAYOUTS = [
    { id: 'top', label: 'Chữ Ở Trên', icon: AlignStartVertical, desc: 'Chừa trống phần trên', prompt: 'Composition with ample negative space at the TOP for typography.' },
    { id: 'bottom', label: 'Chữ Ở Dưới', icon: AlignEndVertical, desc: 'Chừa trống phần dưới', prompt: 'Composition with ample negative space at the BOTTOM for typography.' },
    { id: 'center', label: 'Chữ Giữa (Đè)', icon: AlignCenterVertical, desc: 'Chữ đè lên hình', prompt: 'Center composition, subject integrated with typography overlays.' },
    { id: 'split', label: 'Chia Đôi', icon: AlignVerticalSpaceAround, desc: 'Hình 1 bên, chữ 1 bên', prompt: 'Split screen composition, subject on one side, clean negative space on the other.' },
];

const LIGHTING_MODES = [
    { id: 'studio', label: 'Studio Softbox', desc: 'Ánh sáng mềm, đều, chuyên nghiệp', prompt: 'Professional studio softbox lighting, even illumination, soft shadows' },
    { id: 'natural', label: 'Nắng Tự Nhiên', desc: 'Giờ vàng, ấm áp, đời thường', prompt: 'Natural sunlight, golden hour, warm tones, lens flare, sun rays' },
    { id: 'dramatic', label: 'Điện Ảnh (Cinematic)', desc: 'Tương phản cao, bí ẩn', prompt: 'Cinematic dramatic lighting, chiaroscuro, rim light, moody shadows, volumetric fog' },
    { id: 'neon', label: 'Neon (Cyberpunk)', desc: 'Hiện đại, công nghệ', prompt: 'Neon strip lighting, cyan and magenta rim lights, glowing atmosphere, dark environment' },
];

const QUALITIES = ['1K', '2K', '4K', '8K'];

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
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

interface PosterProps {
    addToast?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    addNotification?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    onRequireAuth?: () => void;
    isAuthenticated?: boolean;
    currentUser?: User;
    isGlobalProcessing?: boolean;
    setGlobalProcessing?: (val: boolean) => void;
}

const Poster: React.FC<PosterProps> = ({ addToast, addNotification, onRequireAuth, isAuthenticated, currentUser, isGlobalProcessing, setGlobalProcessing }) => {
    // --- STATE ---
    const [activeCategory, setActiveCategory] = useState<string>('fashion');
    const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES['fashion'][0]);
    
    // Art Director Controls
    const [lighting, setLighting] = useState(LIGHTING_MODES[0]);
    const [textLayout, setTextLayout] = useState(TEXT_LAYOUTS[0]);
    
    // Files
    const [modelFile, setModelFile] = useState<File | null>(null);
    const [modelPreview, setModelPreview] = useState<string | null>(null);
    const [productFile, setProductFile] = useState<File | null>(null);
    const [productPreview, setProductPreview] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [checkingSafetyFor, setCheckingSafetyFor] = useState<string | null>(null);

    // Text & Settings
    const [headline, setHeadline] = useState('');
    const [purpose, setPurpose] = useState('');
    const [quality, setQuality] = useState('4K');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [negativePrompt, setNegativePrompt] = useState('');
    const [suggestionContext, setSuggestionContext] = useState('');

    // Process
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

    // --- EFFECTS ---
    // Reset template when category changes
    useEffect(() => {
        if (TEMPLATES[activeCategory]) {
            setSelectedTemplate(TEMPLATES[activeCategory][0]);
        }
    }, [activeCategory]);

    // --- HANDLERS ---

    const handleFile = async (file: File, type: 'model' | 'product' | 'logo') => {
        setCheckingSafetyFor(type);
        try {
            const b64 = await fileToBase64(file);
            const validation = await validateImageSafety(b64);
            
            if (!validation.safe) {
                const msg = `Hình ảnh vi phạm chính sách: ${validation.reason}`;
                addToast?.('Cảnh báo', msg, 'error');
                return;
            }

            const preview = await fileToPreview(file);
            if (type === 'model') { setModelFile(file); setModelPreview(preview); }
            if (type === 'product') { setProductFile(file); setProductPreview(preview); }
            if (type === 'logo') { setLogoFile(file); setLogoPreview(preview); }
        } catch (e) {
            addToast?.('Lỗi', 'Không thể xử lý ảnh.', 'error');
        } finally {
            setCheckingSafetyFor(null);
        }
    }

    const handleAutoIdea = async () => {
        if (!productFile && !modelFile && !suggestionContext.trim()) {
            addToast?.("Thiếu thông tin", "Cần có ảnh hoặc mô tả ý tưởng để AI gợi ý.", "info");
            return;
        }
        setIsThinking(true);
        try {
            const modelB64 = modelFile ? await fileToBase64(modelFile) : null;
            const productB64 = productFile ? await fileToBase64(productFile) : null;
            const logoB64 = logoFile ? await fileToBase64(logoFile) : null;

            const results = await generatePosterSuggestions(modelB64, productB64, logoB64, suggestionContext || selectedTemplate.style);
            setSuggestions(results);
            setShowSuggestionsModal(true);
        } catch (e) {
            addToast?.("Lỗi", "Không thể tạo ý tưởng.", "error");
        } finally {
            setIsThinking(false);
        }
    }

    const handleGenerate = async () => {
        if (!isAuthenticated) { onRequireAuth?.(); return; }
        if (isGlobalProcessing) { addToast?.("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }

        if (currentUser) {
            const check = checkUsageLimit(currentUser.username, ModuleType.POSTER, 1);
            if (!check.allowed) { addToast?.("Hết điểm", check.message || "Hết điểm", "error"); return; }
        }

        if (!headline && !purpose) {
            addToast?.("Thiếu thông tin", "Nhập tiêu đề hoặc mô tả.", "info");
        }

        setIsGenerating(true);
        setGlobalProcessing?.(true);
        
        try {
            const modelB64 = modelFile ? await fileToBase64(modelFile) : null;
            const productB64 = productFile ? await fileToBase64(productFile) : null;
            const logoB64 = logoFile ? await fileToBase64(logoFile) : null;

            // --- SMART PROMPT CONSTRUCTION ---
            const baseDescription = `Advertising Poster. Headline Text: "${headline}". Product/Service Context: ${purpose}.`;
            const styleInstructions = `Visual Style: ${selectedTemplate.prompt_en}.`;
            const artDirectorInstructions = `
                Lighting: ${lighting.prompt}.
                Composition: ${textLayout.prompt}.
                Quality: 8K, Masterpiece, Ultra-detailed textures, Commercial Photography.
            `;
            
            addToast?.("Deep Thinking", "AI đang tối ưu hóa ánh sáng và bố cục...", "info");
            const finalPrompt = await enhancePrompt(`${baseDescription} ${styleInstructions} ${artDirectorInstructions}`);

            const base64 = await generatePoster(
                modelB64, 
                productB64, 
                logoB64, 
                headline, 
                finalPrompt, 
                selectedTemplate.prompt_en,
                quality,
                negativePrompt
            );

            let fullB64 = `data:image/png;base64,${base64}`;
            if (currentUser && !currentUser.isVerified) {
                fullB64 = await applyWatermark(base64);
            }

            setResultImage(fullB64);
            
            await saveItem({
                id: uuidv4(),
                type: 'poster', 
                prompt: `Poster: ${headline || 'Untitled'}`,
                createdAt: Date.now(),
                base64Data: fullB64,
                meta: { 
                    template: selectedTemplate.name, 
                    lighting: lighting.label,
                    layout: textLayout.label,
                    quality, 
                    sourceModule: ModuleType.POSTER 
                }
            });
            
            if (currentUser) incrementUsage(currentUser.username, ModuleType.POSTER, 1);
            addToast?.("Thành công", "Poster đã hoàn thành!", "success");

        } catch (error: any) {
            const msg = error.message || String(error);
            addToast?.(msg.includes('safety') ? 'Vi phạm chính sách' : 'Lỗi', msg, 'error');
        } finally {
            setIsGenerating(false);
            setGlobalProcessing?.(false);
        }
    };

    const triggerDownload = () => {
        if (!resultImage) return;
        const link = document.createElement('a');
        link.href = resultImage;
        link.download = `Poster-${headline.replace(/\s+/g, '-')}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col lg:flex-row h-full w-full p-4 lg:p-6 gap-6 lg:gap-8">
            
            {/* LEFT: CONTROLS */}
            <div className="w-full lg:w-[480px] flex flex-col gap-6 lg:overflow-y-auto custom-scrollbar shrink-0 pb-20 lg:pb-0">
                <div className="pb-4 border-b border-white/5">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-500 mb-2 tracking-tight">Pro Poster Studio</h2>
                    <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Trợ lý Art Director & Thiết kế AI</p>
                </div>

                {/* 1. ASSETS UPLOAD */}
                <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-5 backdrop-blur-sm shadow-sm">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <ImageIcon size={14} className="text-pink-500"/> Tài nguyên hình ảnh (Assets)
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { id: 'model', label: 'Người mẫu', prev: modelPreview, set: (f:File) => handleFile(f, 'model'), icon: UserIcon },
                            { id: 'product', label: 'Sản phẩm', prev: productPreview, set: (f:File) => handleFile(f, 'product'), icon: ShoppingBag },
                            { id: 'logo', label: 'Logo/Icon', prev: logoPreview, set: (f:File) => handleFile(f, 'logo'), icon: Hexagon }
                        ].map((item) => (
                            <div key={item.id} className="relative aspect-square bg-zinc-950/80 border border-zinc-800 rounded-xl hover:border-pink-500/50 transition-all overflow-hidden group cursor-pointer">
                                {checkingSafetyFor === item.id && (
                                    <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-1">
                                        <Loader2 size={16} className="text-pink-500 animate-spin"/>
                                    </div>
                                )}
                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => e.target.files && item.set(e.target.files[0])} disabled={checkingSafetyFor !== null} />
                                {item.prev ? (
                                    <>
                                        <img src={item.prev} className="w-full h-full object-contain p-1" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Upload size={16} className="text-white"/>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-1 group-hover:text-pink-400 transition-colors">
                                        <item.icon size={18} />
                                        <span className="text-[9px] font-bold">{item.label}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. TEMPLATE SELECTOR (VISUAL) */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <LayoutIcon size={12}/> Phong cách chủ đạo
                        </label>
                    </div>
                    
                    {/* Categories Tabs */}
                    <div className="flex p-1 bg-zinc-900/50 rounded-xl border border-white/5 gap-1 overflow-x-auto no-scrollbar">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`flex-1 min-w-[80px] py-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${activeCategory === cat.id ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                            >
                                <cat.icon size={14} className={activeCategory === cat.id ? 'text-pink-400' : ''}/>
                                <span className="text-[8px] font-bold uppercase">{cat.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Template Visual Grid */}
                    <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                        {TEMPLATES[activeCategory].map(t => (
                            <div 
                                key={t.id}
                                onClick={() => setSelectedTemplate(t)}
                                className={`group relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all aspect-[3/4] ${selectedTemplate.id === t.id ? 'border-pink-500 ring-2 ring-pink-500/30' : 'border-zinc-800 hover:border-zinc-600'}`}
                            >
                                <img src={t.visual} alt={t.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-100" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-3">
                                    <div className="text-xs font-bold text-white mb-0.5">{t.name}</div>
                                    <div className="text-[9px] text-zinc-300 line-clamp-2">{t.style}</div>
                                </div>
                                {selectedTemplate.id === t.id && (
                                    <div className="absolute top-2 right-2 bg-pink-500 text-white p-1 rounded-full shadow-lg">
                                        <Check size={10} strokeWidth={4}/>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. ART DIRECTOR CONTROLS */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm space-y-4">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2 mb-2">
                        <Sliders size={12}/> Thiết lập Art Director
                    </h3>
                    
                    <div className="space-y-4">
                        {/* Text Layout */}
                        <div>
                            <label className="text-[10px] text-zinc-400 font-bold mb-1.5 flex items-center gap-1.5"><Grid size={10}/> Bố cục chữ (Typography Layout)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {TEXT_LAYOUTS.map(l => (
                                    <button 
                                        key={l.id} 
                                        onClick={() => setTextLayout(l)}
                                        className={`px-2 py-2 rounded-lg border text-left transition-all flex items-center gap-2 ${textLayout.id === l.id ? 'bg-zinc-800 border-pink-500/50 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-900'}`}
                                        title={l.desc}
                                    >
                                        <l.icon size={14} className={textLayout.id === l.id ? 'text-pink-400' : ''}/>
                                        <span className="text-[10px] font-bold">{l.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Lighting */}
                        <div>
                            <label className="text-[10px] text-zinc-400 font-bold mb-1.5 flex items-center gap-1.5"><Sun size={10}/> Ánh sáng (Lighting)</label>
                            <select 
                                value={lighting.id} 
                                onChange={e => setLighting(LIGHTING_MODES.find(l => l.id === e.target.value) || LIGHTING_MODES[0])}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none focus:border-pink-500"
                            >
                                {LIGHTING_MODES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 4. CONTENT & ACTION */}
                <div className="space-y-3">
                    <div className="flex justify-between items-end">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <Type size={12}/> Nội dung chính
                        </label>
                        <button onClick={handleAutoIdea} disabled={isThinking} className="text-[10px] text-yellow-500 hover:text-yellow-400 flex items-center gap-1 font-bold">
                            {isThinking ? <Loader2 size={10} className="animate-spin"/> : <Lightbulb size={10}/>} Gợi ý Copywriting
                        </button>
                    </div>
                    
                    <input 
                        value={headline} 
                        onChange={e => setHeadline(e.target.value)} 
                        placeholder="Tiêu đề chính (VD: SUMMER SALE)..." 
                        className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-pink-500 font-bold"
                    />
                    <textarea 
                        value={purpose} 
                        onChange={e => setPurpose(e.target.value)} 
                        placeholder="Mô tả bối cảnh, chi tiết sản phẩm mong muốn..." 
                        className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-pink-500 resize-none h-20"
                    />

                    {/* Advanced Toggle */}
                    <div className="border-t border-white/5 pt-2">
                        <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-[10px] text-zinc-500 flex items-center gap-1 hover:text-white w-full justify-between">
                            <span>Cài đặt nâng cao (Chất lượng & Negative)</span>
                            <span>{showAdvanced ? '-' : '+'}</span>
                        </button>
                        {showAdvanced && (
                            <div className="mt-2 space-y-2 animate-in fade-in">
                                <div>
                                    <label className="text-[10px] text-zinc-500">Quality</label>
                                    <select value={quality} onChange={e => setQuality(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white mt-1">
                                        {QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-red-400">Negative Prompt</label>
                                    <textarea value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white h-16 mt-1" placeholder="Low quality, bad hands..."/>
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={handleGenerate} 
                        disabled={isGenerating || (isGlobalProcessing && !isGenerating)} 
                        className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:to-pink-500 text-white rounded-xl font-bold shadow-lg shadow-pink-900/20 disabled:opacity-50 flex items-center justify-center gap-2 group transition-all hover:scale-[1.02] sticky bottom-0 z-10"
                    >
                        {isGenerating ? <><Loader2 size={18} className="animate-spin"/> AI Rendering...</> : (isGlobalProcessing && !isGenerating) ? "Hệ thống bận..." : <><Wand2 size={18} className="group-hover:rotate-12 transition-transform"/> Thiết Kế Poster (-1 Credit)</>}
                    </button>
                </div>
            </div>

            {/* RIGHT: PREVIEW */}
            <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center relative backdrop-blur-sm min-h-[400px] lg:h-full lg:min-h-0 overflow-hidden">
                {resultImage ? (
                    <div className="relative h-full w-full flex items-center justify-center animate-in zoom-in duration-500">
                        <img src={resultImage} className="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-white/10" alt="Generated Poster" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm rounded-xl">
                            <button onClick={triggerDownload} className="bg-white text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-xl">
                                <Download size={20}/> Tải xuống (PNG)
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-zinc-600 flex flex-col items-center gap-4 opacity-60">
                        <div className="w-24 h-32 border-2 border-dashed border-zinc-700 rounded-xl flex items-center justify-center">
                            <LayoutIcon size={32}/>
                        </div>
                        <div>
                            <p className="text-lg font-light">Poster Preview</p>
                            <p className="text-xs">Thiết kế sẽ hiển thị tại đây</p>
                        </div>
                    </div>
                )}
            </div>

            <SuggestionModal
                isOpen={showSuggestionsModal}
                onClose={() => setShowSuggestionsModal(false)}
                title="Gợi ý Concept Quảng Cáo"
                suggestions={suggestions}
                onSelect={(item) => {
                    setHeadline(item.data?.headline || "");
                    setPurpose(item.data?.purpose || "");
                    setShowSuggestionsModal(false);
                }}
                isLoading={isThinking}
            />
        </div>
    );
};

export default Poster;
