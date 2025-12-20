import React, { useState, useEffect } from 'react';
import { BookOpen, Users, List, Play, Save, Download, RefreshCw, X, Image as ImageIcon, Video, FileText, CheckCircle2, Loader2, Sparkles, ChevronRight, LayoutTemplate, Copy } from 'lucide-react';
import { generateStoryStructure, generateStoryScenes, generateStoryThumbnail, generateVeoSceneImage, validateImageSafety } from '../services/geminiService';
import { saveItem, getAllItems } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
import { User, ModuleType, StoryStructure, VideoScene, LibraryItem } from '../types';
import { checkUsageLimit, incrementUsage } from '../services/userService';
import { ImageViewerModal } from '../components/ImageViewerModal';

interface StoryCreatorProps {
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    currentUser?: User;
    isGlobalProcessing?: boolean;
    setGlobalProcessing?: (val: boolean) => void;
    // Add props if used for navigation data passing
    initialData?: any; 
}

const MARKETS = ["Vietnam", "US", "Global", "Japan", "Korea"];
const GENRES = ["Drama", "Comedy", "Horror", "Action", "Romance", "Sci-Fi", "Documentary", "Educational"];

const StoryCreator: React.FC<StoryCreatorProps> = ({ addToast, currentUser, isGlobalProcessing, setGlobalProcessing, initialData }) => {
    // Input State
    const [premise, setPremise] = useState('');
    const [market, setMarket] = useState('Vietnam');
    const [genre, setGenre] = useState('Drama');
    const [numEpisodes, setNumEpisodes] = useState(3);
    
    // Character State
    const [availableCharacters, setAvailableCharacters] = useState<LibraryItem[]>([]);
    const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(new Set());

    // Story State
    const [storyStructure, setStoryStructure] = useState<StoryStructure | null>(null);
    const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Preview/Modal State
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [showEpisodeReview, setShowEpisodeReview] = useState(false);

    useEffect(() => {
        loadCharacters();
        const handleUpdate = () => loadCharacters();
        window.addEventListener('library_updated', handleUpdate);
        return () => window.removeEventListener('library_updated', handleUpdate);
    }, []);

    const loadCharacters = async () => {
        const items = await getAllItems();
        const chars = items.filter(i => i.type === 'character' || i.type === 'story_character');
        setAvailableCharacters(chars);
    };

    const toggleCharacter = (id: string) => {
        const newSet = new Set(selectedCharacterIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedCharacterIds(newSet);
    };

    const handleGenerateStructure = async () => {
        if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }
        if (!premise) { addToast("Thiếu thông tin", "Vui lòng nhập cốt truyện.", "warning"); return; }
        
        setIsGenerating(true);
        setGlobalProcessing?.(true);
        try {
            const selectedChars = availableCharacters.filter(c => selectedCharacterIds.has(c.id)).map(c => c.prompt);
            const structure = await generateStoryStructure(selectedChars, premise, numEpisodes, market);
            setStoryStructure(structure);
            setCurrentEpisodeIndex(0);
            addToast("Thành công", "Đã tạo cấu trúc truyện!", "success");
        } catch (e) {
            addToast("Lỗi", "Không thể tạo cấu trúc.", "error");
        } finally {
            setIsGenerating(false);
            setGlobalProcessing?.(false);
        }
    };

    const handleGenerateScenes = async (epIndex: number) => {
        if (!storyStructure) return;
        if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }
        
        // Check Limit
        if (currentUser) {
             const check = checkUsageLimit(currentUser.username, ModuleType.STORY_CREATOR, 5); // Est 5 scenes
             if (!check.allowed) { addToast("Không đủ điểm", check.message || "Hết điểm", "error"); return; }
        }

        setIsGenerating(true);
        setGlobalProcessing?.(true);
        try {
            const episode = storyStructure.episodes[epIndex];
            const selectedChars = availableCharacters.filter(c => selectedCharacterIds.has(c.id)).map(c => ({ name: c.prompt, desc: c.meta?.description }));
            
            // Generate scenes for this episode
            const scenes = await generateStoryScenes(
                episode.summary, 
                60, // duration
                `Genre: ${genre}. Market: ${market}. Premise: ${premise}`, 
                selectedChars, 
                {}, // voiceMap placeholder
                'no', // textMode
                [], // prevScenes
                market === 'Vietnam' ? 'Vietnamese' : 'English',
                5, // sceneCount
                epIndex,
                storyStructure.episodes.length,
                epIndex > 0 ? storyStructure.episodes[epIndex-1].summary : "",
                epIndex < storyStructure.episodes.length - 1 ? storyStructure.episodes[epIndex+1].summary : ""
            );

            // Update state
            const newStructure = { ...storyStructure };
            newStructure.episodes[epIndex].scenes = scenes;
            setStoryStructure(newStructure);
            
            if (currentUser) incrementUsage(currentUser.username, ModuleType.STORY_CREATOR, 5);
            addToast("Thành công", `Đã viết kịch bản cho Tập ${episode.episodeNumber}`, "success");

        } catch (e) {
            addToast("Lỗi", "Không thể tạo cảnh quay.", "error");
        } finally {
            setIsGenerating(false);
            setGlobalProcessing?.(false);
        }
    };

    const handleGenerateImage = async (epIndex: number, sceneIndex: number) => {
        if (!storyStructure?.episodes[epIndex]?.scenes?.[sceneIndex]) return;
        if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }

        setIsGenerating(true);
        setGlobalProcessing?.(true);
        try {
            const scene = storyStructure.episodes[epIndex].scenes![sceneIndex];
            // Simple generation call
            const b64 = await generateVeoSceneImage(
                `${scene.visualPrompt}. Style: Cinematic ${genre}.`, 
                null, null, "16:9", "Story", sceneIndex, null, "2K"
            );
            
            const newStructure = { ...storyStructure };
            newStructure.episodes[epIndex].scenes![sceneIndex].generatedImage = `data:image/png;base64,${b64}`;
            setStoryStructure(newStructure);
            
            if (currentUser) incrementUsage(currentUser.username, ModuleType.STORY_CREATOR, 1);

        } catch (e) {
            addToast("Lỗi", "Không thể tạo ảnh.", "error");
        } finally {
            setIsGenerating(false);
            setGlobalProcessing?.(false);
        }
    };

    const handleSaveStory = async () => {
        if (!storyStructure) return;
        try {
            await saveItem({
                id: uuidv4(),
                type: 'story',
                prompt: `Story: ${storyStructure.title}`,
                createdAt: Date.now(),
                textContent: JSON.stringify(storyStructure),
                meta: { market, genre, sourceModule: ModuleType.STORY_CREATOR }
            });
            addToast("Đã lưu", "Toàn bộ cốt truyện đã được lưu.", "success");
        } catch (e) {
            addToast("Lỗi", "Lưu thất bại.", "error");
        }
    };

    const triggerDownload = (dataUri: string, filename: string) => {
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const copyText = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast("Copied", "Đã sao chép vào clipboard", "info");
    }

    return (
        <div className="flex flex-col lg:flex-row h-full w-full p-4 lg:p-6 gap-6 lg:gap-8">
            {/* LEFT: CONTROLS */}
            <div className="w-full lg:w-[450px] flex flex-col gap-6 shrink-0 h-auto lg:h-full lg:overflow-y-auto custom-scrollbar pb-20 lg:pb-0">
                <div className="pb-4 border-b border-white/5">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 mb-2">Story Architect</h2>
                    <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Xây dựng Series phim & Truyện tranh</p>
                </div>

                {/* Configuration */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm space-y-4 shadow-lg">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Thị trường</label>
                            <select value={market} onChange={e => setMarket(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none focus:border-emerald-500">
                                {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Thể loại</label>
                            <select value={genre} onChange={e => setGenre(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none focus:border-emerald-500">
                                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Số tập (Episodes)</label>
                        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
                            <button onClick={() => setNumEpisodes(Math.max(1, numEpisodes - 1))} className="p-1.5 text-zinc-400 hover:text-white"><ChevronRight size={14} className="rotate-180"/></button>
                            <span className="flex-1 text-center text-sm font-bold text-white">{numEpisodes}</span>
                            <button onClick={() => setNumEpisodes(Math.min(20, numEpisodes + 1))} className="p-1.5 text-zinc-400 hover:text-white"><ChevronRight size={14}/></button>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Cốt truyện / Ý tưởng (Premise)</label>
                        <textarea 
                            value={premise} 
                            onChange={e => setPremise(e.target.value)} 
                            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none resize-none"
                            placeholder="Mô tả ý tưởng chính của câu chuyện..."
                        />
                    </div>

                    {/* Character Selection */}
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block flex justify-between">
                            <span>Nhân vật ({selectedCharacterIds.size})</span>
                            <span className="text-[9px] text-zinc-600">Từ Character Lab</span>
                        </label>
                        {availableCharacters.length > 0 ? (
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x">
                                {availableCharacters.map(char => (
                                    <button 
                                        key={char.id} 
                                        onClick={() => toggleCharacter(char.id)}
                                        className={`relative w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 transition-all snap-start ${selectedCharacterIds.has(char.id) ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-zinc-800 opacity-60 hover:opacity-100'}`}
                                        title={char.prompt}
                                    >
                                        <img src={char.base64Data} className="w-full h-full object-cover" />
                                        {selectedCharacterIds.has(char.id) && <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center"><Users size={16} className="text-white"/></div>}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-zinc-500 italic p-2 border border-dashed border-zinc-800 rounded text-center">Chưa có nhân vật nào. Hãy tạo trong Character Lab.</div>
                        )}
                    </div>

                    <button 
                        onClick={handleGenerateStructure} 
                        disabled={isGenerating || isGlobalProcessing}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 size={18} className="animate-spin"/> : <BookOpen size={18}/>}
                        {storyStructure ? "Tạo lại Cấu trúc" : "Khởi tạo Cấu trúc Truyện"}
                    </button>
                </div>
            </div>

            {/* RIGHT: STORYBOARD VIEW */}
            <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-2xl p-4 lg:p-6 flex flex-col min-h-[400px] overflow-hidden">
                {storyStructure ? (
                    <div className="flex flex-col h-full">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 border-b border-white/5 pb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-white">{storyStructure.title}</h3>
                                <p className="text-xs text-zinc-400 mt-1 max-w-2xl line-clamp-2">{storyStructure.summary}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => setShowEpisodeReview(true)} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold flex items-center gap-2"><List size={14}/> Danh sách Tập</button>
                                <button onClick={handleSaveStory} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2"><Save size={14}/> Lưu Truyện</button>
                            </div>
                        </div>

                        {/* Episode Navigator */}
                        <div className="flex items-center justify-between mb-4 bg-black/20 p-2 rounded-xl">
                            <button 
                                onClick={() => setCurrentEpisodeIndex(Math.max(0, currentEpisodeIndex - 1))}
                                disabled={currentEpisodeIndex === 0}
                                className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white disabled:opacity-20"
                            >
                                <ChevronRight size={20} className="rotate-180"/>
                            </button>
                            <div className="text-center">
                                <div className="text-[10px] text-zinc-500 uppercase font-bold">Đang xem</div>
                                <div className="text-sm font-bold text-white">Tập {storyStructure.episodes[currentEpisodeIndex].episodeNumber}: {storyStructure.episodes[currentEpisodeIndex].title}</div>
                            </div>
                            <button 
                                onClick={() => setCurrentEpisodeIndex(Math.min(storyStructure.episodes.length - 1, currentEpisodeIndex + 1))}
                                disabled={currentEpisodeIndex === storyStructure.episodes.length - 1}
                                className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white disabled:opacity-20"
                            >
                                <ChevronRight size={20}/>
                            </button>
                        </div>

                        {/* Scenes Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                            {storyStructure.episodes[currentEpisodeIndex].scenes ? (
                                storyStructure.episodes[currentEpisodeIndex].scenes!.map((scene, idx) => (
                                    <div key={idx} className="flex gap-4 p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl group hover:border-emerald-500/30 transition-all">
                                        <div className="w-40 aspect-video bg-black rounded-lg border border-zinc-800 shrink-0 relative overflow-hidden flex items-center justify-center">
                                            {scene.generatedImage ? (
                                                <img 
                                                    src={scene.generatedImage} 
                                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" 
                                                    onClick={() => setPreviewImage(scene.generatedImage!)}
                                                />
                                            ) : (
                                                <button onClick={() => handleGenerateImage(currentEpisodeIndex, idx)} disabled={isGenerating || isGlobalProcessing} className="text-zinc-600 hover:text-emerald-400 flex flex-col items-center gap-1 transition-colors">
                                                    {isGenerating ? <Loader2 size={24} className="animate-spin"/> : <ImageIcon size={24}/>}
                                                    <span className="text-[9px] font-bold">Tạo ảnh</span>
                                                </button>
                                            )}
                                            <div className="absolute top-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-white">Scene {idx + 1}</div>
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-xs text-zinc-300 font-medium line-clamp-3">{scene.visualPrompt}</p>
                                                    <button onClick={() => copyText(scene.visualPrompt)} className="text-zinc-600 hover:text-white"><Copy size={12}/></button>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{scene.locationTag || "Location"}</span>
                                                    {scene.character && <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{scene.character}</span>}
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-zinc-800/50">
                                                <p className="text-sm text-emerald-200 italic font-serif">"{scene.dialogue}"</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                                    <FileText size={48} className="opacity-20"/>
                                    <p>Chưa có kịch bản chi tiết cho tập này.</p>
                                    <button 
                                        onClick={() => handleGenerateScenes(currentEpisodeIndex)} 
                                        disabled={isGenerating || isGlobalProcessing}
                                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg"
                                    >
                                        <Sparkles size={18}/> Viết Kịch Bản Chi Tiết
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-60">
                        <BookOpen size={64} className="mb-4 text-emerald-500/50"/>
                        <p className="text-xl font-light">Bắt đầu kiến tạo vũ trụ câu chuyện của bạn</p>
                    </div>
                )}
            </div>

            <ImageViewerModal
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
                imageSrc={previewImage}
                altText="Scene Preview"
            >
                {previewImage && (
                    <button onClick={() => triggerDownload(previewImage!, `Preview-${Date.now()}.png`)} className="bg-white text-black px-6 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
                        <Download size={18}/> Tải ảnh gốc
                    </button>
                )}
            </ImageViewerModal>

            {/* NEW: Episode List Review Modal */}
            {showEpisodeReview && storyStructure && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative animate-in zoom-in-95">
                        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/50 shrink-0">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <List size={20} className="text-emerald-500"/> Danh sách tập phim ({storyStructure.episodes.length})
                            </h3>
                            <button onClick={() => setShowEpisodeReview(false)} className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
                            {storyStructure.episodes.map((ep: any, idx: number) => (
                                <div 
                                    key={idx} 
                                    onClick={() => { setCurrentEpisodeIndex(idx); setShowEpisodeReview(false); }}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex gap-4 hover:border-emerald-500/50 group ${currentEpisodeIndex === idx ? 'bg-emerald-900/20 border-emerald-500' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'}`}
                                >
                                    <div className="w-24 h-24 shrink-0 bg-black rounded-lg overflow-hidden border border-zinc-800 relative group-hover:border-emerald-500/30 transition-colors">
                                        {ep.thumbnail ? (
                                            <img src={ep.thumbnail} className="w-full h-full object-cover"/>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                                <ImageIcon size={24} className="opacity-50"/>
                                            </div>
                                        )}
                                        <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/10">EP {ep.episodeNumber}</div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`font-bold text-sm mb-1 truncate ${currentEpisodeIndex === idx ? 'text-emerald-400' : 'text-white'}`}>{ep.title}</h4>
                                        <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed mb-2">{ep.summary}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700 font-mono">{ep.scenes?.length || 0} scenes</span>
                                            {ep.seoData && <span className="text-[9px] bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 font-bold">SEO Ready</span>}
                                        </div>
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

export default StoryCreator;