
import React, { useState, useEffect, useRef } from 'react';
import { User, Palette, Globe, Layers, Download, CheckCircle, FolderPlus, Save, Edit2, X, RefreshCw, LayoutTemplate, MessageSquareQuote, Users, Sparkles, ArrowRight, Loader2, History, Dice5, Wand2, Monitor } from 'lucide-react';
import { generateImage, generateCharacterNames, generateCharacterConcepts, expandCharacterPrompt } from '../services/geminiService';
import { saveItem, getAllItems } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
import { LibraryItem, User as AppUser, ModuleType } from '../types'; 
import { ImageViewerModal } from '../components/ImageViewerModal';
import { SuggestionModal } from '../components/SuggestionModal';
import { checkUsageLimit, incrementUsage } from '../services/userService';

interface CharacterCreatorProps {
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    addNotification?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    currentUser?: AppUser;
    isGlobalProcessing?: boolean;
    setGlobalProcessing?: (val: boolean) => void;
}

// --- WORLD CLASS STYLES CONFIGURATION (EXPANDED TO 20 STYLES) ---
const CHARACTER_STYLES = [
    { 
        id: '3d_pixar', 
        label: '3D Animation', 
        desc: 'Pixar/Disney Style', 
        prompt: '3D render, Disney Pixar style, cute, expressive, octane render, 8k, volumetric lighting, soft textures, masterpiece',
        color: 'from-blue-500 to-cyan-500'
    },
    { 
        id: 'realistic', 
        label: 'Cinematic Real', 
        desc: 'Người thật 8K', 
        prompt: 'Hyper-realistic, cinematic lighting, 8k resolution, highly detailed skin texture, dslr photography, depth of field, ray tracing',
        color: 'from-emerald-500 to-teal-500'
    },
    { 
        id: 'animal_real', 
        label: 'Real Animal (Thú thật)', 
        desc: 'NatGeo Wildlife', 
        prompt: 'National Geographic wildlife photography, hyper-realistic animal portrait, 8k, intricate fur detail, macro lens, wild nature background, documentary style, expressive eyes',
        color: 'from-orange-600 to-amber-600'
    },
    { 
        id: 'anime_modern', 
        label: 'Anime Premium', 
        desc: 'Nhật Bản (Shinkai)', 
        prompt: 'Anime style, Makoto Shinkai style, vibrant colors, highly detailed, beautiful eyes, dramatic lighting, 4k anime key visual',
        color: 'from-pink-500 to-rose-500'
    },
    { 
        id: 'cyberpunk', 
        label: 'Cyberpunk', 
        desc: 'Tương lai (Sci-Fi)', 
        prompt: 'Cyberpunk character, neon lights, futuristic techwear, chromatic aberration, night city background, high contrast, unreal engine 5',
        color: 'from-purple-500 to-fuchsia-500'
    },
    { 
        id: 'fantasy_rpg', 
        label: 'Fantasy RPG', 
        desc: 'Game nhập vai', 
        prompt: 'Fantasy character concept art, Dungeons and Dragons style, intricate armor, magical aura, digital painting, artstation trend',
        color: 'from-amber-500 to-red-500'
    },
    { 
        id: 'comic_us', 
        label: 'Comic Book (Mỹ)', 
        desc: 'Marvel/DC Style', 
        prompt: 'American comic book style, bold ink lines, halftone patterns, dynamic shading, vibrant colors, superhero aesthetic, Marvel/DC style',
        color: 'from-red-600 to-orange-600'
    },
    { 
        id: 'chibi', 
        label: 'Chibi Cute', 
        desc: 'Dễ thương/Sticker', 
        prompt: 'Chibi style, super deformed, big head small body, kawaii, cute, sticker art, flat shading, simple background, vibrant',
        color: 'from-pink-400 to-pink-300'
    },
    { 
        id: 'claymation', 
        label: 'Đất Sét (Clay)', 
        desc: 'Stop Motion (Aardman)', 
        prompt: 'Claymation style, plasticine texture, stop motion look, Aardman style, handmade feel, fingerprint details, soft studio lighting',
        color: 'from-orange-400 to-yellow-500'
    },
    { 
        id: 'oil_painting', 
        label: 'Tranh Sơn Dầu', 
        desc: 'Cổ điển (Classic Art)', 
        prompt: 'Oil painting style, textured brushstrokes, impasto, classical art, Rembrandt lighting, canvas texture, museum quality',
        color: 'from-yellow-700 to-amber-800'
    },
    { 
        id: 'pixel_art', 
        label: 'Pixel Art', 
        desc: '8-bit Retro Game', 
        prompt: 'Pixel art, 16-bit, retro game sprite, limited color palette, blocky, clean edges, nostalgic gaming aesthetic',
        color: 'from-indigo-600 to-blue-700'
    },
    { 
        id: 'watercolor', 
        label: 'Màu Nước', 
        desc: 'Mơ mộng (Dreamy)', 
        prompt: 'Watercolor painting, soft edges, artistic, dreamy, pastel colors, wet-on-wet technique, paper texture, delicate',
        color: 'from-cyan-400 to-blue-300'
    },
    { 
        id: 'mecha', 
        label: 'Mecha Robot', 
        desc: 'Gundam/Machine', 
        prompt: 'Mecha style, robotic, Gundam aesthetic, mechanical details, metallic surfaces, sci-fi, hard surface modeling, battle worn',
        color: 'from-slate-600 to-slate-800'
    },
    { 
        id: 'horror_dark', 
        label: 'Dark Fantasy', 
        desc: 'Kinh dị (Horror)', 
        prompt: 'Dark fantasy, eldritch horror, grimdark, terrifying, shadowy, H.R. Giger influence, nightmare fuel, high contrast',
        color: 'from-gray-900 to-black'
    },
    { 
        id: 'origami', 
        label: 'Giấy Gấp (Origami)', 
        desc: 'Papercraft Art', 
        prompt: 'Papercraft style, origami, layered paper art, cut paper, depth of field, shadowbox effect, craft texture',
        color: 'from-yellow-200 to-orange-200 text-black'
    },
    { 
        id: 'gothic_tim', 
        label: 'Gothic Cartoon', 
        desc: 'Tim Burton Style', 
        prompt: 'Tim Burton style, gothic cartoon, spindly limbs, dark circles around eyes, creepy cute, twisted, pale, dark atmosphere',
        color: 'from-purple-900 to-gray-800'
    },
    { 
        id: 'low_poly', 
        label: 'Low Poly', 
        desc: 'Indie Game 3D', 
        prompt: 'Low poly art, flat shading, geometric shapes, minimal, indie game aesthetic, sharp edges, vivid colors',
        color: 'from-green-400 to-emerald-500'
    },
    { 
        id: 'vaporwave', 
        label: 'Vaporwave 80s', 
        desc: 'Retro Neon', 
        prompt: 'Vaporwave aesthetic, 80s retro style, neon pink and blue, glitch art effects, nostalgic, synthwave vibe',
        color: 'from-fuchsia-400 to-cyan-400'
    },
    { 
        id: 'ukiyo_e', 
        label: 'Tranh Khắc Gỗ', 
        desc: 'Nhật Bản Cổ Điển', 
        prompt: 'Ukiyo-e style, Japanese woodblock print, Hokusai influence, flat colors, textured paper, traditional ink lines',
        color: 'from-red-800 to-orange-700'
    },
    { 
        id: 'sketch', 
        label: 'Phác Thảo Chì', 
        desc: 'Concept Art', 
        prompt: 'Rough pencil sketch, charcoal drawing, hand drawn, artistic, messy lines, concept art, monochrome, graphite texture',
        color: 'from-gray-500 to-zinc-500'
    }
];

const LANGUAGES = [
    "Việt Nam", "Anh (English)", "Nhật Bản (Japanese)", "Hàn Quốc (Korean)", "Trung Quốc (Chinese)",
    "Nga (Russian)", "Pháp (French)", "Đức (German)", "Mỹ (USA)"
];

const RATIOS = [
    { label: '3:4', icon: 'Portrait', desc: 'Chân dung (Chuẩn)' },
    { label: '1:1', icon: 'Square', desc: 'Avatar' },
    { label: '16:9', icon: 'Landscape', desc: 'Điện ảnh' },
    { label: '9:16', icon: 'Tall', desc: 'TikTok/Phone' }
];

const QUALITIES = ['1K', '2K', '4K'];

interface CharacterInput {
    id: string;
    description: string;
    name: string; 
}

const CharacterCreator: React.FC<CharacterCreatorProps> = ({ addToast, currentUser, isGlobalProcessing, setGlobalProcessing }) => {
    // State
    const [selectedStyleId, setSelectedStyleId] = useState(() => localStorage.getItem('ue_cc_style_id') || '3d_pixar');
    const [quantity, setQuantity] = useState(() => parseInt(localStorage.getItem('ue_cc_qty') || '1')); 
    const [language, setLanguage] = useState(() => localStorage.getItem('ue_cc_lang') || LANGUAGES[0]);
    const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('ue_cc_aspect') || '3:4');
    const [quality, setQuality] = useState('2K');
    
    const [charInputs, setCharInputs] = useState<CharacterInput[]>([
        { id: '1', description: '', name: '' }
    ]);
    
    const [suggestionTheme, setSuggestionTheme] = useState('');
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

    const [folders, setFolders] = useState<string[]>(['Mặc định']);
    const [selectedFolder, setSelectedFolder] = useState(() => localStorage.getItem('ue_cc_folder') || 'Mặc định');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [generatedCharacters, setGeneratedCharacters] = useState<LibraryItem[]>([]);
    const [selectedCharacter, setSelectedCharacter] = useState<LibraryItem | null>(null);
    
    const renameInputRef = useRef<HTMLInputElement>(null);

    // Persistence
    useEffect(() => { loadFolders(); }, []);
    useEffect(() => {
        // Auto adjust inputs based on quantity
        setCharInputs(prev => {
            if (quantity > prev.length) {
                return [...prev, ...Array.from({ length: quantity - prev.length }).map(() => ({ id: uuidv4(), description: '', name: '' }))];
            } else if (quantity < prev.length) {
                return prev.slice(0, quantity);
            }
            return prev;
        });
        localStorage.setItem('ue_cc_qty', quantity.toString());
    }, [quantity]);
    
    useEffect(() => localStorage.setItem('ue_cc_style_id', selectedStyleId), [selectedStyleId]);
    useEffect(() => localStorage.setItem('ue_cc_lang', language), [language]);
    useEffect(() => localStorage.setItem('ue_cc_aspect', aspectRatio), [aspectRatio]);
    useEffect(() => localStorage.setItem('ue_cc_folder', selectedFolder), [selectedFolder]);

    const loadFolders = async () => {
        const items = await getAllItems();
        const charItems = items.filter(i => i.type === 'character' || i.type === 'story_character');
        const uniqueFolders = new Set<string>(['Mặc định']);
        charItems.forEach(i => { if (i.meta?.folderName) uniqueFolders.add(i.meta.folderName); });
        setFolders(Array.from(uniqueFolders));
    };

    const handleCreateFolder = () => {
        if (newFolderName.trim()) {
            setFolders(prev => [...prev, newFolderName]);
            setSelectedFolder(newFolderName);
            setNewFolderName('');
            setIsCreatingFolder(false);
            addToast("Thành công", `Đã tạo folder: ${newFolderName}`, "success");
        }
    };

    const triggerDownload = (base64Data: string, filename: string) => {
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRandomDescription = (idx: number) => {
        const adjectives = ["Cool", "Cute", "Mysterious", "Strong", "Elegant", "Funny", "Dark", "Holy"];
        const roles = ["Warrior", "Mage", "Student", "Cyberpunk Hacker", "Princess", "Detective", "Robot"];
        const details = ["Blue eyes", "Red hair", "Golden armor", "Neon jacket", "Cat ears", "Dragon wings"];
        
        const randomDesc = `${adjectives[Math.floor(Math.random()*adjectives.length)]} ${roles[Math.floor(Math.random()*roles.length)]}, ${details[Math.floor(Math.random()*details.length)]}`;
        
        const newInputs = [...charInputs];
        newInputs[idx].description = randomDesc;
        setCharInputs(newInputs);
    }

    const handleSuggestConcepts = async () => {
        if (!suggestionTheme.trim()) {
            addToast("Cần thông tin", "Nhập chủ đề chung (VD: Biệt đội siêu anh hùng)", "info");
            return;
        }
        setIsSuggesting(true);
        setSuggestions([]);
        setShowSuggestionsModal(true);
        try {
            const currentStyle = CHARACTER_STYLES.find(s => s.id === selectedStyleId)?.label || "Mixed";
            const concepts = await generateCharacterConcepts(quantity, suggestionTheme, currentStyle, language);
            const formatted = concepts.map(c => ({
                vi: c.setName,
                en: `Characters: ${c.characters.map((x:any) => x.name).join(', ')}`,
                data: c
            }));
            setSuggestions(formatted);
        } catch (e) {
            addToast("Lỗi", "Không thể tạo gợi ý.", "error");
            setShowSuggestionsModal(false);
        } finally {
            setIsSuggesting(false);
        }
    };

    const applySuggestion = (suggestion: any) => {
        const concept = suggestion.data;
        const newInputs = concept.characters.slice(0, quantity).map((c: any) => ({
            id: uuidv4(),
            name: c.name,
            description: c.description
        }));
        
        if (newInputs.length < quantity) {
             const remaining = quantity - newInputs.length;
             for(let i=0; i<remaining; i++) newInputs.push({ id: uuidv4(), name: '', description: '' });
        }

        setCharInputs(newInputs);
        addToast("Đã áp dụng", `Đã điền thông tin cho bộ: ${concept.setName}`, "success");
    };

    const handleGenerate = async () => {
        if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }

        if (currentUser) {
            const check = checkUsageLimit(currentUser.username, ModuleType.CHARACTER_CREATOR, quantity);
            if (!check.allowed) { addToast("Không đủ điểm", check.message || `Cần ${quantity} điểm.`, "error"); return; }
        }

        const emptyInputs = charInputs.filter(c => !c.description.trim());
        if (emptyInputs.length > 0) {
            addToast("Thiếu thông tin", "Vui lòng nhập mô tả cho tất cả các nhân vật.", "error");
            return;
        }

        setIsGenerating(true);
        setGlobalProcessing?.(true);
        setGeneratedCharacters([]);

        try {
            const newChars: LibraryItem[] = [];
            const selectedStyleConfig = CHARACTER_STYLES.find(s => s.id === selectedStyleId);
            const stylePrompt = selectedStyleConfig?.prompt || "";
            
            // Generate names if missing
            let names: string[] = [];
            const needsNames = charInputs.filter(c => !c.name.trim()).length;
            if (needsNames > 0) {
                names = await generateCharacterNames(needsNames, language, "mixed", selectedStyleConfig?.label || "Artistic");
            }
            let nameIndex = 0;

            for (let i = 0; i < charInputs.length; i++) {
                const input = charInputs[i];
                const charName = input.name.trim() || names[nameIndex++] || `Character ${i + 1}`;
                
                // 1. Expand Prompt with Gemini (Contextual Understanding)
                if(addToast) addToast("Deep Thinking", `Đang phân tích và tối ưu hóa nhân vật: ${charName}...`, "info");
                const expandedDesc = await expandCharacterPrompt(charName, input.description, selectedStyleConfig?.label || "Artistic");
                
                // 2. Inject Style DNA (Hardcore formatting)
                const finalPrompt = `
                    (Best Quality, 8K, Masterpiece:1.2).
                    Character Name: ${charName}.
                    Visual Description: ${expandedDesc}.
                    Art Style: ${stylePrompt}.
                    Context: White background or simple studio background to focus on character design.
                    Constraint: Single character view, full body or portrait based on aspect ratio.
                `;
                
                const b64 = await generateImage(finalPrompt, aspectRatio, quality);
                const fullB64 = `data:image/png;base64,${b64}`;
                const uniqueId = uuidv4();
                
                const item: LibraryItem = {
                    id: uniqueId,
                    type: 'story_character',
                    prompt: charName, 
                    createdAt: Date.now(),
                    base64Data: fullB64,
                    meta: {
                        description: input.description,
                        style: selectedStyleConfig?.label,
                        language,
                        folderName: selectedFolder,
                        originalPrompt: finalPrompt, 
                        aspectRatio,
                        quality
                    }
                };
                
                await saveItem(item);
                newChars.push(item);
                triggerDownload(fullB64, `${charName}.png`);
            }

            setGeneratedCharacters(newChars);
            if (currentUser) incrementUsage(currentUser.username, ModuleType.CHARACTER_CREATOR, quantity);
            addToast("Thành công", `Đã tạo ${quantity} nhân vật!`, "success");
            loadFolders();

        } catch (error: any) {
            console.error(error);
            addToast("Lỗi", error.message || "Tạo nhân vật thất bại.", "error");
        } finally {
            setIsGenerating(false);
            setGlobalProcessing?.(false);
        }
    };

    const handleRename = async () => {
        const newName = renameInputRef.current?.value;
        if (!selectedCharacter || !newName?.trim()) return;
        const updated = { ...selectedCharacter, prompt: newName };
        await saveItem(updated);
        setGeneratedCharacters(prev => prev.map(c => c.id === selectedCharacter.id ? updated : c));
        setSelectedCharacter(updated);
        addToast("Thành công", "Đã đổi tên nhân vật", "success");
    };

    const handleRegenerate = async (item: LibraryItem) => {
        if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }
        
        if (currentUser) {
            const check = checkUsageLimit(currentUser.username, ModuleType.CHARACTER_CREATOR, 1);
            if (!check.allowed) { addToast("Hết điểm", check.message || "Hết điểm", "error"); return; }
        }

        setIsRegenerating(true);
        setGlobalProcessing?.(true);
        try {
            // Re-use original prompt logic but trigger new seed
            const prompt = item.meta?.originalPrompt || item.prompt;
            const ratio = item.meta?.aspectRatio || aspectRatio;
            const q = item.meta?.quality || quality;

            const b64 = await generateImage(prompt + " . Variation, detailed.", ratio, q);
            const fullB64 = `data:image/png;base64,${b64}`;

            const updatedItem: LibraryItem = {
                ...item,
                base64Data: fullB64,
                createdAt: Date.now()
            };

            await saveItem(updatedItem);
            setGeneratedCharacters(prev => prev.map(c => c.id === item.id ? updatedItem : c));
            setSelectedCharacter(updatedItem);
            triggerDownload(fullB64, `${item.prompt}-V2.png`);
            
            if (currentUser) incrementUsage(currentUser.username, ModuleType.CHARACTER_CREATOR, 1);
            addToast("Thành công", "Đã vẽ lại nhân vật!", "success");

        } catch (e: any) {
            addToast("Lỗi", "Không thể tạo lại.", "error");
        } finally {
            setIsRegenerating(false);
            setGlobalProcessing?.(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-full w-full p-4 lg:p-6 gap-6 lg:gap-8">
            {/* LEFT: CONFIGURATION PANEL */}
            <div className="w-full lg:w-[480px] flex flex-col gap-5 shrink-0 h-auto lg:h-full lg:overflow-y-auto custom-scrollbar pb-20 lg:pb-0">
                <div className="pb-4 border-b border-white/5">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 mb-1 tracking-tight">Character Lab</h2>
                    <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Thiết kế nhân vật định danh cho phim & truyện</p>
                </div>

                {/* 1. IDENTITY & FOLDER */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <FolderPlus size={12}/> Folder lưu trữ
                        </label>
                        <button onClick={() => setIsCreatingFolder(true)} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold">
                            + Tạo mới
                        </button>
                    </div>
                    
                    {isCreatingFolder ? (
                        <div className="flex gap-2 animate-in fade-in">
                            <input 
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                placeholder="Tên dự án..."
                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                autoFocus
                            />
                            <button onClick={handleCreateFolder} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-500"><CheckCircle size={16}/></button>
                            <button onClick={() => setIsCreatingFolder(false)} className="bg-zinc-800 text-white p-2 rounded-lg hover:bg-zinc-700"><X size={16}/></button>
                        </div>
                    ) : (
                        <select 
                            value={selectedFolder} 
                            onChange={e => setSelectedFolder(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 text-white p-2.5 rounded-lg text-sm focus:border-emerald-500 outline-none"
                        >
                            {folders.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    )}
                </div>

                {/* 2. STYLE DNA SELECTOR (VISUAL) */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2 px-1">
                        <Palette size={12}/> Visual DNA (Phong cách)
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto custom-scrollbar p-1">
                        {CHARACTER_STYLES.map(style => (
                            <div 
                                key={style.id}
                                onClick={() => setSelectedStyleId(style.id)}
                                className={`relative p-3 rounded-xl border cursor-pointer transition-all overflow-hidden group ${selectedStyleId === style.id ? `bg-gradient-to-br ${style.color} border-transparent shadow-lg` : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'}`}
                            >
                                <div className={`text-xs font-bold mb-0.5 ${selectedStyleId === style.id ? 'text-white' : 'text-zinc-300'}`}>{style.label}</div>
                                <div className={`text-[9px] ${selectedStyleId === style.id ? 'text-white/80' : 'text-zinc-500'}`}>{style.desc}</div>
                                {selectedStyleId === style.id && <div className="absolute top-2 right-2 text-white"><CheckCircle size={12}/></div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. GENERATION CONFIG */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Quốc tịch / Tên</label>
                            <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white p-2 rounded-lg text-xs outline-none">
                                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Số lượng</label>
                            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
                                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-1 hover:text-white text-zinc-500"><ArrowRight size={12} className="rotate-180"/></button>
                                <span className="flex-1 text-center text-sm font-bold text-white">{quantity}</span>
                                <button onClick={() => setQuantity(Math.min(10, quantity + 1))} className="p-1 hover:text-white text-zinc-500"><ArrowRight size={12}/></button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Tỷ lệ khung hình</label>
                            <div className="flex gap-2">
                                {RATIOS.map(r => (
                                    <button 
                                        key={r.label}
                                        onClick={() => setAspectRatio(r.label)}
                                        className={`flex-1 py-2 rounded-lg border text-[10px] font-bold transition-all ${aspectRatio === r.label ? 'bg-zinc-800 text-white border-white/20' : 'bg-transparent text-zinc-500 border-zinc-800 hover:bg-zinc-900'}`}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Monitor size={12}/> Chất lượng</label>
                            <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white p-2 rounded-lg text-xs outline-none focus:border-emerald-500 appearance-none">
                                {QUALITIES.map(q => <option key={q} value={q}>{q} Ultra HD</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 4. CHARACTER DETAILS */}
                <div className="flex-1 min-h-[300px] flex flex-col gap-3">
                    <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <Edit2 size={12}/> Chi tiết nhân vật ({quantity})
                        </label>
                        
                        {/* Brainstorm Bar */}
                        <div className="flex gap-2">
                            <input 
                                value={suggestionTheme} 
                                onChange={e => setSuggestionTheme(e.target.value)} 
                                placeholder="Chủ đề (VD: Fantasy)..." 
                                className="w-32 bg-transparent border-b border-zinc-700 text-xs text-white focus:border-emerald-500 outline-none"
                            />
                            <button onClick={handleSuggestConcepts} disabled={isSuggesting} className="text-emerald-400 hover:text-emerald-300">
                                {isSuggesting ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                        {charInputs.map((input, idx) => (
                            <div key={input.id} className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase">Nhân vật {idx + 1}</span>
                                    <div className="flex gap-2">
                                        <input 
                                            value={input.name} 
                                            onChange={e => {
                                                const newInputs = [...charInputs];
                                                newInputs[idx].name = e.target.value;
                                                setCharInputs(newInputs);
                                            }}
                                            placeholder="Tên (Tùy chọn)"
                                            className="bg-transparent text-right text-xs text-zinc-400 focus:text-white outline-none w-24 placeholder-zinc-700"
                                        />
                                        <button onClick={() => handleRandomDescription(idx)} className="text-zinc-600 hover:text-white" title="Ngẫu nhiên hóa"><Dice5 size={12}/></button>
                                    </div>
                                </div>
                                <textarea 
                                    value={input.description}
                                    onChange={e => {
                                        const newInputs = [...charInputs];
                                        newInputs[idx].description = e.target.value;
                                        setCharInputs(newInputs);
                                    }}
                                    placeholder="Mô tả ngoại hình, trang phục, đặc điểm khuôn mặt..."
                                    className="w-full h-20 bg-black/20 border border-zinc-800 rounded-lg p-2.5 text-xs text-white placeholder-zinc-600 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none leading-relaxed"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={handleGenerate} 
                    disabled={isGenerating || (isGlobalProcessing && !isGenerating)}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:to-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex items-center justify-center gap-2 sticky bottom-0 z-20 group border border-white/10"
                >
                    {isGenerating ? <><Loader2 size={18} className="animate-spin"/> System Processing...</> : 
                     (isGlobalProcessing && !isGenerating) ? "Hệ thống đang bận..." : 
                     <><Wand2 size={18} className="group-hover:rotate-12 transition-transform"/> Khởi tạo ({quantity} Credits)</>}
                </button>
            </div>

            {/* RIGHT: RESULTS GALLERY */}
            <div className="flex-1 bg-zinc-900/20 rounded-3xl border border-white/5 p-6 flex flex-col backdrop-blur-sm min-h-[400px] lg:h-full lg:min-h-0 relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Users size={20} className="text-emerald-400"/>
                        Kết quả ({generatedCharacters.length})
                    </h3>
                    <div className="text-[10px] text-zinc-500 font-mono">Rendered by Gemini Pro Vision</div>
                </div>
                
                {generatedCharacters.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar pr-2 pb-10">
                        {generatedCharacters.map((char) => (
                            <div key={char.id} className="group relative rounded-xl overflow-hidden border border-white/10 bg-black shadow-lg cursor-pointer" onClick={() => setSelectedCharacter(char)}>
                                <div className={`overflow-hidden relative ${char.meta?.aspectRatio === '1:1' ? 'aspect-square' : char.meta?.aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[3/4]'}`}>
                                    <img src={char.base64Data} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                                </div>
                                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                                    <p className="text-sm font-bold text-white truncate">{char.prompt}</p>
                                    <p className="text-[10px] text-zinc-400 truncate">{char.meta?.style}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50 space-y-4">
                        <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                            <User size={48} className="opacity-50"/>
                        </div>
                        <p className="text-lg font-light tracking-wide">Waiting for identity data...</p>
                    </div>
                )}
            </div>

            {/* MODALS */}
            <ImageViewerModal
                isOpen={!!selectedCharacter}
                onClose={() => setSelectedCharacter(null)}
                imageSrc={selectedCharacter?.base64Data || null}
                altText={selectedCharacter?.prompt}
            >
                <div className="flex flex-col items-center gap-4 w-full max-w-lg">
                    <div className="flex gap-2 w-full">
                        <input 
                            defaultValue={selectedCharacter?.prompt}
                            ref={renameInputRef}
                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                            placeholder="Tên nhân vật..."
                        />
                        <button onClick={handleRename} className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap">Đổi tên</button>
                    </div>
                    <div className="flex gap-2 w-full">
                         <button 
                            onClick={() => selectedCharacter && handleRegenerate(selectedCharacter)}
                            disabled={isRegenerating || isGlobalProcessing}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg"
                        >
                            <RefreshCw size={16} className={isRegenerating ? "animate-spin" : ""}/>
                            {isRegenerating ? "Đang vẽ lại..." : "Vẽ lại (Biến thể)"}
                        </button>
                        <button 
                            onClick={() => selectedCharacter && triggerDownload(selectedCharacter.base64Data!, `${selectedCharacter.prompt}.png`)}
                            className="flex-1 bg-white text-black px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all shadow-lg"
                        >
                            <Download size={16}/> Tải xuống
                        </button>
                    </div>
                </div>
            </ImageViewerModal>

            <SuggestionModal
                isOpen={showSuggestionsModal}
                onClose={() => setShowSuggestionsModal(false)}
                title="AI Concept Lab"
                suggestions={suggestions}
                onSelect={(item) => {
                    applySuggestion(item);
                    setShowSuggestionsModal(false);
                }}
                isLoading={isSuggesting}
            />
        </div>
    );
};

export default CharacterCreator;
