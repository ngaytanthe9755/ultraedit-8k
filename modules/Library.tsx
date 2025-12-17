
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { getAllItems, deleteItem, saveItem, deleteItems } from '../services/db';
import { LibraryItem, ModuleType } from '../types';
import { Trash2, Maximize2, Image as ImageIcon, Download, ZoomIn, ZoomOut, RefreshCw, FileText, X, Video, Mic, Edit2, Save, Clock, Copy, Film, CheckSquare, Square, BookOpen, Wand2, RefreshCcw, Search, ArrowUpDown, Calendar, Info, Hash, SlidersHorizontal, MoreVertical, LayoutGrid, List as ListIcon, Filter } from 'lucide-react';
import { generateVeoSceneImage, generateImage } from '../services/geminiService';
import { ImageViewerModal } from '../components/ImageViewerModal';

interface LibraryProps {
    onNavigate?: (module: ModuleType, data?: any) => void;
    addToast?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
    isActive?: boolean;
}

interface GeneratedPrompt {
    title: string;
    visualPrompt: string;
    dialogue: string;
    generatedImage?: string;
    isGeneratingImage?: boolean;
}

const MODULE_LABELS: Record<string, { label: string, color: string }> = {
    [ModuleType.NEW_CREATION]: { label: 'Vision', color: 'bg-indigo-600/90' },
    [ModuleType.STUDIO]: { label: 'Studio', color: 'bg-violet-600/90' },
    [ModuleType.POSTER]: { label: 'Poster', color: 'bg-pink-600/90' },
    [ModuleType.THUMBNAIL]: { label: 'Thumb', color: 'bg-red-600/90' },
    [ModuleType.VEO_IDEAS]: { label: 'Veo Script', color: 'bg-blue-600/90' },
    [ModuleType.IMAGE_TO_VIDEO]: { label: 'Motion', color: 'bg-cyan-600/90' },
    [ModuleType.CHARACTER_CREATOR]: { label: 'Char Lab', color: 'bg-emerald-600/90' },
    [ModuleType.STORY_CREATOR]: { label: 'Story', color: 'bg-teal-600/90' }
};

const Library: React.FC<LibraryProps> = ({ onNavigate, addToast, isActive }) => {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // --- SEARCH & SORT STATE ---
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'az'>('newest');
    const [filter, setFilter] = useState<'all' | 'image' | 'poster' | 'thumbnail' | 'video_strategy' | 'veo_video' | 'character' | 'story'>('all');

    // Viewer State (Replaces simple image string state)
    const [detailItem, setDetailItem] = useState<LibraryItem | null>(null); // For the new Inspector Modal
    const [isRegeneratingItem, setIsRegeneratingItem] = useState(false);
    
    // Rename State
    const [renameValue, setRenameValue] = useState('');
    
    // Multi-select State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Video Strategy View Modal State
    const [viewingStrategy, setViewingStrategy] = useState<LibraryItem | null>(null);
    const [strategyScenes, setStrategyScenes] = useState<GeneratedPrompt[]>([]);
    const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null); 
    const [editingDialogueIndex, setEditingDialogueIndex] = useState<number | null>(null); 
    
    const isDirty = useRef(false);

    const loadItems = async () => {
        setIsLoading(true);
        try {
            const data = await getAllItems();
            setItems(data);
        } catch (error) {
            console.error("Failed to load library items", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Performance Optimization
    useEffect(() => {
        if (isActive) {
            if (isDirty.current) {
                loadItems();
                isDirty.current = false;
            }
        }
    }, [isActive]);

    useEffect(() => {
        loadItems();
        let debounceTimeout: any;
        const handleUpdate = () => {
            if (!isActive) {
                isDirty.current = true;
                return;
            }
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                loadItems();
            }, 300);
        };
        window.addEventListener('library_updated', handleUpdate);
        return () => {
            window.removeEventListener('library_updated', handleUpdate);
            clearTimeout(debounceTimeout);
        };
    }, [isActive]);

    useEffect(() => {
        if (detailItem) {
            setRenameValue(detailItem.prompt);
        }
    }, [detailItem]);

    // --- FILTER & SORT LOGIC ---
    const processedItems = useMemo(() => {
        let result = items;

        // 1. Filter by Type
        if (filter !== 'all') {
            if (filter === 'character') {
                result = result.filter(i => i.type === 'character' || i.type === 'story_character');
            } else {
                result = result.filter(i => i.type === filter);
            }
        }

        // 2. Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(i => 
                i.prompt.toLowerCase().includes(q) || 
                i.meta?.description?.toLowerCase().includes(q) ||
                i.meta?.folderName?.toLowerCase().includes(q)
            );
        }

        // 3. Sort
        result = [...result].sort((a, b) => {
            if (sortOrder === 'newest') return b.createdAt - a.createdAt;
            if (sortOrder === 'oldest') return a.createdAt - b.createdAt;
            if (sortOrder === 'az') return a.prompt.localeCompare(b.prompt);
            return 0;
        });

        return result;
    }, [items, filter, searchQuery, sortOrder]);

    // --- SELECTION LOGIC ---
    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedIds(new Set());
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`Bạn có chắc muốn xóa ${selectedIds.size} mục đã chọn không?`)) {
            await deleteItems(Array.from(selectedIds));
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            addToast?.("Thành công", "Đã xóa các mục đã chọn", "success");
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

    // Robust video download using Blob URL
    const triggerVideoDownload = async (dataUri: string, filename: string) => {
        try {
            const res = await fetch(dataUri);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Video download failed", e);
            addToast?.("Lỗi", "Không thể tải video", "error");
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("Bạn có chắc muốn xóa vĩnh viễn mục này?")) {
            await deleteItem(id);
            if (viewingStrategy?.id === id) setViewingStrategy(null);
            if (detailItem?.id === id) setDetailItem(null);
            addToast?.("Đã xóa", "Mục đã được xóa khỏi thư viện", "success");
        }
    };

    const handleUseInModule = (item: LibraryItem) => {
        if (!onNavigate) return;

        if (item.type === 'character' || item.type === 'story_character') {
            onNavigate(ModuleType.STORY_CREATOR, { characterId: item.id, folderName: item.meta?.folderName });
            addToast?.("Điều hướng", "Đã chọn nhân vật cho cốt truyện", "info");
        } else if (item.type === 'image') {
            onNavigate(ModuleType.NEW_CREATION, { prompt: item.prompt });
        } else if (item.type === 'poster') {
            onNavigate(ModuleType.POSTER, {}); 
        } else if (item.type === 'thumbnail') {
             onNavigate(ModuleType.THUMBNAIL, {});
        } else if (item.type === 'video_strategy') {
             onNavigate(ModuleType.VEO_IDEAS, {});
        } else if (item.type === 'veo_video') {
             onNavigate(ModuleType.IMAGE_TO_VIDEO, {});
        } else if (item.type === 'story') {
             onNavigate(ModuleType.STORY_CREATOR, { storyId: item.id });
        }
        
        if (item.prompt && item.type !== 'story' && !item.type.includes('character')) {
             navigator.clipboard.writeText(item.prompt);
             addToast?.("Đã sao chép", "Prompt đã được lưu vào clipboard", "info");
        }
    };

    const openStrategyModal = (item: LibraryItem) => {
        if (item.textContent) {
            try {
                const scenes = JSON.parse(item.textContent);
                if (scenes.episodes) {
                    onNavigate?.(ModuleType.STORY_CREATOR, { storyId: item.id });
                } else {
                    setStrategyScenes(scenes);
                    setViewingStrategy(item);
                    setEditingSceneIndex(null);
                    setEditingDialogueIndex(null);
                }
            } catch (e) {
                console.error("Error parsing strategy", e);
            }
        }
    }

    // --- REGENERATION LOGIC (Generic) ---
    const handleRename = async () => {
        if (!detailItem || !renameValue.trim()) return;
        const updatedItem = { ...detailItem, prompt: renameValue.trim() };
        await saveItem(updatedItem);
        setDetailItem(updatedItem);
        addToast?.("Thành công", "Đã đổi tên thành công", "success");
    }

    const handleRegenerateItem = async () => {
        if (!detailItem) return;
        
        // Prevent regeneration for types requiring external files if we don't have them
        if (detailItem.meta?.hasReference || detailItem.type === 'poster' || detailItem.type === 'thumbnail') {
             if (detailItem.type !== 'image') {
                 addToast?.("Lưu ý", "Đang tạo lại dựa trên mô tả văn bản (Không bao gồm ảnh gốc nếu có)", "info");
             }
        }

        setIsRegeneratingItem(true);
        try {
            let prompt = detailItem.prompt;
            const aspectRatio = detailItem.meta?.aspectRatio || '1:1';
            const quality = detailItem.meta?.quality || '4K';

            if (detailItem.type === 'character' || detailItem.type === 'story_character') {
                prompt = detailItem.meta?.originalPrompt || `${detailItem.prompt}. Style: ${detailItem.meta?.style}. STRICT: Single character only. White background.`;
            }

            const b64 = await generateImage(prompt, aspectRatio, quality);
            const fullB64 = `data:image/png;base64,${b64}`;

            const updatedItem: LibraryItem = {
                ...detailItem,
                base64Data: fullB64,
                createdAt: Date.now()
            };

            await saveItem(updatedItem);
            setDetailItem(updatedItem);
            triggerDownload(fullB64, `${detailItem.type}-${Date.now()}.png`);
            addToast?.("Thành công", "Đã tạo lại và tải xuống hình ảnh mới!", "success");

        } catch (e: any) {
            console.error(e);
            addToast?.("Lỗi", e.message || "Không thể tạo lại hình ảnh.", "error");
        } finally {
            setIsRegeneratingItem(false);
        }
    }

    const getSourceBadge = (item: LibraryItem) => {
        const source = item.meta?.sourceModule;
        if (source && MODULE_LABELS[source]) return MODULE_LABELS[source];
        if (item.type === 'poster') return MODULE_LABELS[ModuleType.POSTER];
        if (item.type === 'thumbnail') return MODULE_LABELS[ModuleType.THUMBNAIL];
        if (item.type === 'veo_video') return MODULE_LABELS[ModuleType.IMAGE_TO_VIDEO];
        if (item.type === 'video_strategy') return MODULE_LABELS[ModuleType.VEO_IDEAS];
        if (item.type === 'story') return MODULE_LABELS[ModuleType.STORY_CREATOR];
        if (item.type === 'character' || item.type === 'story_character') return MODULE_LABELS[ModuleType.CHARACTER_CREATOR];
        if (item.meta?.composite) return MODULE_LABELS[ModuleType.STUDIO];
        return MODULE_LABELS[ModuleType.NEW_CREATION];
    }

    const formatTimestamp = (ts: number) => new Date(ts).toLocaleString();

    return (
        <div className="w-full h-full p-4 lg:p-6 flex flex-col bg-zinc-950">
            {/* --- HEADER TOOLBAR --- */}
            <div className="flex flex-col gap-4 mb-6 shrink-0 z-10">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-black text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 tracking-tight">Thư viện Sáng tạo</h2>
                        <p className="text-sm text-zinc-500 mt-1 font-medium">Kho lưu trữ tài sản số & siêu dữ liệu (Metadata).</p>
                    </div>
                    {/* Bulk Actions */}
                    {isSelectionMode ? (
                        <div className="flex items-center gap-2 bg-red-900/30 p-1.5 rounded-xl border border-red-500/30 animate-in fade-in slide-in-from-right-5">
                            <span className="text-xs text-red-200 font-bold px-2">{selectedIds.size} đã chọn</span>
                            <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
                                <Trash2 size={12}/> Xóa
                            </button>
                            <button onClick={toggleSelectionMode} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-colors">
                                Hủy
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={loadItems} className={`p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-white/5 ${isLoading ? 'animate-spin' : ''}`}>
                                <RefreshCcw size={18}/>
                            </button>
                            <button onClick={toggleSelectionMode} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold flex items-center gap-2 border border-white/5 transition-colors">
                                <CheckSquare size={16}/> Chọn nhiều
                            </button>
                        </div>
                    )}
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col md:flex-row gap-3 bg-zinc-900/60 p-2 rounded-2xl border border-white/5 backdrop-blur-md">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-zinc-500" size={16}/>
                        <input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm prompt, tên, ghi chú..." 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>

                    {/* Filters Scrollable */}
                    <div className="flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar flex-1">
                        {(['all', 'image', 'character', 'poster', 'thumbnail', 'video_strategy', 'veo_video', 'story'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-lg' : 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
                            >
                                {f.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    {/* Sort */}
                    <div className="relative shrink-0">
                        <div className="absolute left-3 top-2.5 pointer-events-none text-zinc-500"><ArrowUpDown size={14}/></div>
                        <select 
                            value={sortOrder}
                            onChange={(e: any) => setSortOrder(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500 appearance-none h-full font-bold cursor-pointer hover:bg-zinc-900"
                        >
                            <option value="newest">Mới nhất</option>
                            <option value="oldest">Cũ nhất</option>
                            <option value="az">Tên (A-Z)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* --- MAIN GRID --- */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 pr-2">
                {processedItems.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-64 text-zinc-600 animate-in fade-in">
                        <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                            <Search size={32} className="opacity-50"/>
                        </div>
                        <p className="text-lg font-medium text-zinc-500">Không tìm thấy mục nào</p>
                        <p className="text-xs text-zinc-600 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                     </div>
                ) : (
                    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
                        {processedItems.map(item => {
                            const isSelected = selectedIds.has(item.id);
                            const badge = getSourceBadge(item);
                            return (
                                <div 
                                    key={item.id} 
                                    className={`break-inside-avoid group relative bg-zinc-900 rounded-2xl overflow-hidden border transition-all duration-300 shadow-sm cursor-pointer transform hover:-translate-y-1 hover:shadow-xl
                                    ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-[0.98]' : 'border-white/5 hover:border-indigo-500/30'}`} 
                                    onClick={() => {
                                        if (isSelectionMode) {
                                            toggleSelection(item.id);
                                        } else {
                                            if(item.type === 'video_strategy') {
                                                openStrategyModal(item);
                                            } else if (item.type === 'story') {
                                                onNavigate?.(ModuleType.STORY_CREATOR, { storyId: item.id });
                                            } else {
                                                setDetailItem(item); // Open new Inspector
                                            }
                                        }
                                    }}
                                >
                                    {/* Selection Checkbox */}
                                    {isSelectionMode && (
                                        <div className="absolute top-2 right-2 z-30">
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shadow-lg ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-black/50 border-white/50 backdrop-blur'}`}>
                                                {isSelected && <CheckSquare size={12} className="text-white"/>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Content Rendering */}
                                    {(item.type === 'image' || item.type === 'poster' || item.type === 'thumbnail' || item.type === 'character' || item.type === 'story_character') && item.base64Data ? (
                                        <div className="relative w-full">
                                            <img src={item.base64Data} className="w-full h-auto block" loading="lazy" alt={item.prompt}/>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                                <p className="text-[10px] text-zinc-300 line-clamp-2 mb-1">{item.prompt}</p>
                                                <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                                                    <Clock size={10}/> {new Date(item.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div className="absolute top-3 left-3">
                                                <span className={`text-[9px] font-black px-2 py-1 rounded-md shadow-lg uppercase backdrop-blur-md border border-white/20 tracking-wider ${badge.color} text-white`}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                        </div>
                                    ) : item.type === 'veo_video' && item.videoData ? (
                                        <div className="w-full relative bg-black">
                                             <video src={item.videoData} className="w-full h-auto block object-cover" muted loop onMouseOver={e => (e.target as HTMLVideoElement).play()} onMouseOut={e => (e.target as HTMLVideoElement).pause()}/>
                                             <div className="absolute top-3 left-3">
                                                <span className={`text-[9px] font-black px-2 py-1 rounded-md shadow-lg uppercase backdrop-blur-md border border-white/20 tracking-wider ${badge.color} text-white flex items-center gap-1`}>
                                                    <Film size={10} fill="currentColor"/> {badge.label}
                                                </span>
                                            </div>
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                                                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center"><Film size={20} className="text-white"/></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 h-32 flex flex-col justify-between bg-zinc-900">
                                            <div className="flex justify-between items-start">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${badge.color}`}>
                                                    {item.type === 'story' ? <BookOpen size={16}/> : <FileText size={16}/>}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white line-clamp-2">{item.prompt.replace(/^(Veo|Story): /, '')}</h4>
                                                <span className="text-[9px] text-zinc-500 mt-1 block">{new Date(item.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* --- INSPECTOR MODAL (DETAIL VIEW) --- */}
            {detailItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 lg:p-8 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-6xl h-full max-h-[90vh] flex overflow-hidden shadow-2xl relative">
                        <button onClick={() => setDetailItem(null)} className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-full transition-colors backdrop-blur-md border border-white/10">
                            <X size={24}/>
                        </button>

                        <div className="flex flex-col lg:flex-row w-full h-full">
                            {/* Left: Media Preview */}
                            <div className="lg:w-2/3 bg-black flex items-center justify-center p-4 lg:p-8 relative group">
                                {/* Grid Background */}
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                                
                                {detailItem.type === 'veo_video' && detailItem.videoData ? (
                                    <video src={detailItem.videoData} controls className="max-w-full max-h-full object-contain rounded-lg shadow-2xl z-10" />
                                ) : (
                                    <img src={detailItem.base64Data} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl z-10" alt="Preview" />
                                )}
                                
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 opacity-0 group-hover:opacity-100 transition-all z-20">
                                    <button onClick={() => detailItem.base64Data && triggerDownload(detailItem.base64Data, `Asset-${Date.now()}.png`)} className="bg-white text-black px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-xl hover:scale-105 transition-transform">
                                        <Download size={16}/> Tải xuống
                                    </button>
                                </div>
                            </div>

                            {/* Right: Metadata Inspector */}
                            <div className="lg:w-1/3 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full">
                                <div className="p-6 border-b border-zinc-800">
                                    <h3 className="text-xl font-bold text-white mb-1">Asset Inspector</h3>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                        <span className="font-mono">{detailItem.id.slice(0,8)}</span>
                                        <span>•</span>
                                        <span>{formatTimestamp(detailItem.createdAt)}</span>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                                    {/* Prompt Section */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                                                <FileText size={12}/> Prompt / Name
                                            </label>
                                            <button onClick={() => { navigator.clipboard.writeText(detailItem.prompt); addToast?.("Đã sao chép", "Prompt copy!", "success"); }} className="text-indigo-400 hover:text-indigo-300 text-[10px] flex items-center gap-1">
                                                <Copy size={10}/> Copy
                                            </button>
                                        </div>
                                        {/* Rename Input */}
                                        <div className="relative group">
                                            <textarea 
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-300 focus:text-white focus:border-indigo-500 focus:outline-none resize-none transition-colors min-h-[100px]"
                                            />
                                            {renameValue !== detailItem.prompt && (
                                                <button onClick={handleRename} className="absolute bottom-2 right-2 bg-indigo-600 text-white p-1.5 rounded-lg text-xs font-bold hover:bg-indigo-500 animate-in fade-in">
                                                    Lưu
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tech Specs */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                                            <Hash size={12}/> Metadata
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                                                <div className="text-[10px] text-zinc-500 mb-1">Source Module</div>
                                                <div className="text-xs text-white font-bold">{getSourceBadge(detailItem).label}</div>
                                            </div>
                                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                                                <div className="text-[10px] text-zinc-500 mb-1">Resolution</div>
                                                <div className="text-xs text-white font-bold">{detailItem.meta?.quality || 'Unknown'}</div>
                                            </div>
                                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                                                <div className="text-[10px] text-zinc-500 mb-1">Aspect Ratio</div>
                                                <div className="text-xs text-white font-bold">{detailItem.meta?.aspectRatio || 'Unknown'}</div>
                                            </div>
                                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                                                <div className="text-[10px] text-zinc-500 mb-1">Type</div>
                                                <div className="text-xs text-white font-bold capitalize">{detailItem.type.replace('_', ' ')}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* AI Meta (Example) */}
                                    {detailItem.meta?.style && (
                                        <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-xl">
                                            <label className="text-[10px] font-bold text-indigo-400 uppercase mb-2 block">AI Parameters</label>
                                            <div className="space-y-1 text-xs text-zinc-300">
                                                <div className="flex justify-between"><span>Style:</span> <span className="text-white">{detailItem.meta.style}</span></div>
                                                {detailItem.meta.lighting && <div className="flex justify-between"><span>Lighting:</span> <span className="text-white">{detailItem.meta.lighting}</span></div>}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions Footer */}
                                <div className="p-6 border-t border-zinc-800 bg-zinc-900 space-y-3">
                                    <button 
                                        onClick={() => handleUseInModule(detailItem)} 
                                        className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 border border-white/5 transition-colors"
                                    >
                                        <Edit2 size={16}/> Sử dụng trong Module
                                    </button>
                                    
                                    <div className="flex gap-3">
                                        {(['image', 'character', 'story_character'].includes(detailItem.type) && !detailItem.meta?.hasReference) && (
                                            <button 
                                                onClick={handleRegenerateItem} 
                                                disabled={isRegeneratingItem}
                                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                            >
                                                <RefreshCw size={16} className={isRegeneratingItem ? "animate-spin" : ""}/> Tạo lại (Remix)
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleDelete(detailItem.id)} 
                                            className="flex-1 py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-xl font-bold flex items-center justify-center gap-2 border border-red-900/30 transition-colors"
                                        >
                                            <Trash2 size={16}/> Xóa Vĩnh Viễn
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Player Modal (Simple) */}
            {/* ... Keep the Strategy Modal logic here as well ... */}
            {viewingStrategy && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-[fadeIn_0.2s_ease-out] overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center shrink-0">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Video size={20} className="text-red-500"/> Kịch Bản: {viewingStrategy.prompt}</h2>
                        <button onClick={() => setViewingStrategy(null)}><X size={24} className="text-zinc-400 hover:text-white"/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                        <div className="max-w-4xl mx-auto space-y-6">
                            {strategyScenes.map((scene, idx) => (
                                <div key={idx} className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/50 flex gap-6">
                                    <div className="w-1/3 aspect-video bg-black rounded-xl overflow-hidden relative">
                                        {scene.generatedImage ? <img src={scene.generatedImage} className="w-full h-full object-cover"/> : <div className="flex items-center justify-center h-full text-zinc-600"><ImageIcon/></div>}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <h3 className="font-bold text-white text-lg">Cảnh {idx+1}: {scene.title}</h3>
                                        <p className="text-zinc-300 text-sm">{scene.visualPrompt}</p>
                                        <div className="p-3 bg-indigo-900/20 rounded-lg border border-indigo-500/20 text-indigo-200 text-sm italic">"{scene.dialogue}"</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Library;
