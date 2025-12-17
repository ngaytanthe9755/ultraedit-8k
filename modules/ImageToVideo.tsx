
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Film, Loader2, Play, Download, Trash2, Layers, AlertCircle, Plus, BookOpen, CheckCircle, X, Clapperboard, Video, RefreshCw, Wand2, AlertTriangle, RotateCcw, Settings, FileText, Image, ArrowRightLeft, Users, Zap, Save, Edit2, CheckSquare, Square, ArrowDown, Database, FileJson, ArrowUp, Copy, Clock } from 'lucide-react';
import { generateAdvancedVeoVideo, enhancePrompt, validateImageSafety } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import { LibraryItem, User, ModuleType } from '../types';
import { checkUsageLimit, incrementUsage } from '../services/userService';
import { getAllItems } from '../services/db';

interface ImageToVideoProps {
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    addNotification?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    currentUser?: User;
    onRequireAuth?: () => void;
    isAuthenticated?: boolean;
    isGlobalProcessing?: boolean;
    setGlobalProcessing?: (val: boolean) => void;
}

type JobType = 'text' | 'image' | 'transition' | 'sync';

interface Job {
    id: string;
    type: JobType;
    prompt: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    image?: string; // Base64 
    endImage?: string; // Base64
    videoUrl?: string; // Blob URL
    aspectRatio: string;
    resolution: '720p' | '1080p';
    selectedForMerge?: boolean;
    errorMessage?: string;
    isEditing?: boolean;
    editPromptValue?: string;
}

interface BatchItem {
    id: string;
    preview: string; // Main image (Start or Hero)
    preview2?: string; // End image (For Transition)
    file?: File;
    file2?: File;
    base64?: string;
    base64_2?: string;
    prompt: string;
    isEnhancing?: boolean; // UI state for individual enhancement
}

const MAX_CONCURRENT = 1; 

const ImageToVideo: React.FC<ImageToVideoProps> = ({ addToast, addNotification, currentUser, onRequireAuth, isAuthenticated, isGlobalProcessing, setGlobalProcessing }) => {
    // Tab State
    const [activeTab, setActiveTab] = useState<JobType>('text');

    // Unified Batch State
    const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
    const [bulkPrompts, setBulkPrompts] = useState(''); // Shared bulk input

    // Global Settings
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
    const [autoDownload, setAutoDownload] = useState(true);
    
    // Safety Check State
    const [isCheckingSafety, setIsCheckingSafety] = useState(false);
    
    // Queue State
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isMerging, setIsMerging] = useState(false);

    // Script Import State
    const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
    const [availableScripts, setAvailableScripts] = useState<LibraryItem[]>([]);

    // --- EFFECT: SYNC BULK PROMPTS TO ITEMS ---
    useEffect(() => {
        if (!bulkPrompts.trim()) return;
        
        const lines = bulkPrompts.split('\n').filter(line => line.trim() !== '');
        
        if (activeTab === 'text') return; // Text mode handles lines directly in submit

        // Only auto-fill if prompts are currently empty to avoid overwriting user edits
        setBatchItems(prev => prev.map((item, index) => {
            if (index < lines.length && !item.prompt) {
                return { ...item, prompt: lines[index] };
            }
            return item;
        }));
    }, [bulkPrompts, activeTab]);

    // --- HELPER FUNCTIONS ---
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(file);
        });
    };

    const triggerBrowserDownload = (url: string, filename: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const loadScripts = async () => {
        const allItems = await getAllItems();
        const scripts = allItems.filter(i => i.type === 'video_strategy' || i.type === 'story');
        setAvailableScripts(scripts);
    };

    // --- QUEUE PROCESSOR ---
    useEffect(() => {
        // Pausing queue processing if global lock is active from ANOTHER module.
        // We assume if jobs are 'processing' in local state, then we own the lock.
        const localProcessingCount = jobs.filter(j => j.status === 'processing').length;
        
        if (isGlobalProcessing && localProcessingCount === 0) {
            // Global lock is held by someone else, do not pick up jobs
            return;
        }

        const processQueue = async () => {
            if (localProcessingCount < MAX_CONCURRENT) {
                const nextJob = jobs.find(j => j.status === 'pending');
                if (nextJob) startJob(nextJob.id);
            }
        };
        processQueue();
    }, [jobs, isGlobalProcessing]);

    const startJob = async (id: string) => {
        // Double check global lock before starting
        const localProcessingCount = jobs.filter(j => j.status === 'processing').length;
        if (isGlobalProcessing && localProcessingCount === 0) return;

        setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'processing', errorMessage: undefined } : j));
        setGlobalProcessing?.(true);

        try {
            const job = jobs.find(j => j.id === id);
            if (!job) return;

            const videoBlobUrl = await generateAdvancedVeoVideo({
                prompt: job.prompt,
                aspectRatio: job.aspectRatio,
                resolution: job.resolution,
                image: job.image, 
                endImage: job.endImage
            });
            
            if (autoDownload) {
                triggerBrowserDownload(videoBlobUrl, `Veo-${id.slice(0,4)}.mp4`);
                addToast("Tải xuống", `Video ${id.slice(0,4)} đang tự động tải về...`, "info");
            }

            if (currentUser) incrementUsage(currentUser.username, ModuleType.IMAGE_TO_VIDEO, 1);

            setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'completed', videoUrl: videoBlobUrl, selectedForMerge: true } : j));

        } catch (error: any) {
            const errStr = String(error).toLowerCase();
            const friendlyError = errStr.includes("safety") ? "Vi phạm chính sách an toàn." : 
                                  errStr.includes("quota") ? "Hệ thống quá tải." : 
                                  "Lỗi xử lý.";
            
            setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'error', errorMessage: friendlyError } : j));
        } finally {
            // Only release global lock if this was the last running job locally
            // We need to check the updated state which isn't available immediately in this closure.
            // However, we know we just finished one job.
            // A safer bet: The useEffect queue processor will check again.
            // But we must signal completion.
            
            // Hack: We can temporarily release, and let the queue grab it back if needed, 
            // OR check if other jobs are processing.
            // Since we updated state via setJobs, let's assume one less job is processing.
            
            // To be safe against race conditions with React state updates, we can wrap the release
            // in a small timeout or check against the *previous* known state count.
            // Or simpler: Always release here. If another job starts immediately via useEffect, it will re-acquire.
            setGlobalProcessing?.(false); 
        }
    };

    // --- BATCH ITEM MANAGEMENT ---
    const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'secondary') => {
        if (!e.target.files?.length) return;
        setIsCheckingSafety(true);
        
        const files = Array.from(e.target.files) as File[];
        const newItems: BatchItem[] = [];

        for (const file of files) {
            try {
                const b64 = await fileToBase64(file);
                const validation = await validateImageSafety(b64);
                
                if (validation.safe) {
                    newItems.push({
                        id: uuidv4(),
                        file,
                        preview: URL.createObjectURL(file),
                        base64: b64,
                        prompt: ''
                    });
                } else {
                    addToast('Ảnh bị chặn', `Ảnh ${file.name}: ${validation.reason}`, 'error');
                }
            } catch (err) {}
        }

        setIsCheckingSafety(false);
        e.target.value = '';

        setBatchItems(prev => {
            if (type === 'main') {
                return [...prev, ...newItems];
            } else {
                const updated = [...prev];
                let fileIdx = 0;
                for (let i = 0; i < updated.length; i++) {
                    if (!updated[i].base64_2 && fileIdx < newItems.length) {
                        updated[i].base64_2 = newItems[fileIdx].base64;
                        updated[i].preview2 = newItems[fileIdx].preview;
                        fileIdx++;
                    }
                }
                return updated;
            }
        });
    };

    const handleImportScript = (script: LibraryItem) => {
        try {
            const scenes = JSON.parse(script.textContent || '[]');
            let sceneList: any[] = [];
            if (Array.isArray(scenes)) sceneList = scenes;
            else if (scenes.episodes) sceneList = scenes.episodes.flatMap((ep: any) => ep.scenes || []);

            if (sceneList.length === 0) {
                addToast("Lỗi", "Kịch bản không có cảnh nào.", "warning");
                return;
            }

            const voice = script.meta?.voice || "Mặc định";
            const newItems: BatchItem[] = [];

            sceneList.forEach((scene: any) => {
                if (scene.generatedImage) {
                    const b64 = scene.generatedImage.split(',')[1];
                    const visual = scene.visualPrompt.replace(/[\r\n]+/g, ' ').trim();
                    const dialogue = scene.dialogue ? scene.dialogue.replace(/[\r\n]+/g, ' ').trim() : "";
                    const charName = scene.character || "";
                    const combinedPrompt = `Prompt: ${visual}. Lời thoại (${voice}${charName ? ' - ' + charName : ''}): ${dialogue}`;

                    newItems.push({
                        id: uuidv4(),
                        preview: scene.generatedImage,
                        base64: b64,
                        prompt: combinedPrompt
                    });
                }
            });

            if (newItems.length === 0) {
                addToast("Không có ảnh", "Kịch bản này chưa được tạo hình ảnh minh họa (Scene Images).", "warning");
                return;
            }

            setBatchItems(prev => [...prev, ...newItems]);
            setActiveTab('image');
            setIsScriptModalOpen(false);
            addToast("Thành công", `Đã nhập ${newItems.length} cảnh từ kịch bản.`, "success");

        } catch (e) {
            addToast("Lỗi", "Không thể đọc nội dung kịch bản.", "error");
        }
    };

    const updateItemPrompt = (id: string, val: string) => {
        setBatchItems(prev => prev.map(i => i.id === id ? { ...i, prompt: val } : i));
    };

    const removeItem = (id: string) => {
        setBatchItems(prev => prev.filter(i => i.id !== id));
    };

    // --- NEW: ADVANCED TIMELINE CONTROLS ---
    const moveItem = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === batchItems.length - 1) return;
        
        const newItems = [...batchItems];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
        setBatchItems(newItems);
    };

    const duplicateItem = (index: number) => {
        const itemToClone = batchItems[index];
        const newItem = {
            ...itemToClone,
            id: uuidv4(), // New ID
            prompt: itemToClone.prompt + " (Copy)"
        };
        const newItems = [...batchItems];
        newItems.splice(index + 1, 0, newItem);
        setBatchItems(newItems);
    };

    const enhanceItemPrompt = async (index: number) => {
        const item = batchItems[index];
        if (!item.prompt.trim()) return;

        setBatchItems(prev => prev.map((it, i) => i === index ? { ...it, isEnhancing: true } : it));
        try {
            // Enhance visual description for video
            const enhanced = await enhancePrompt(`Optimize this prompt for cinematic video generation (Veo model). Keep dialogue if any. Prompt: ${item.prompt}`);
            setBatchItems(prev => prev.map((it, i) => i === index ? { ...it, prompt: enhanced, isEnhancing: false } : it));
            addToast("Đã tối ưu", "Prompt đã được nâng cấp cho video.", "success");
        } catch (e) {
            addToast("Lỗi", "Không thể tối ưu prompt.", "error");
            setBatchItems(prev => prev.map((it, i) => i === index ? { ...it, isEnhancing: false } : it));
        }
    };

    // --- MAIN ACTION ---
    const handleAddToQueue = () => {
        if (!isAuthenticated) { onRequireAuth?.(); return; }
        
        // Only block adding if strictly necessary, but usually adding to queue is safe.
        // Processing is what needs to be blocked.
        // However, if we want strict mode:
        // if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }
        
        let newJobs: Job[] = [];

        if (activeTab === 'text') {
            const lines = bulkPrompts.split('\n').filter(l => l.trim());
            if (lines.length === 0) { addToast("Thiếu Prompt", "Nhập ít nhất 1 dòng.", "error"); return; }
            newJobs = lines.map(line => ({
                id: uuidv4(), type: 'text', prompt: line.trim(),
                status: 'pending', aspectRatio, resolution
            }));
        } else {
            if (batchItems.length === 0) { addToast("Thiếu ảnh", "Vui lòng tải ảnh lên.", "error"); return; }
            
            if (activeTab === 'transition') {
                const invalid = batchItems.filter(i => !i.base64 || !i.base64_2);
                if (invalid.length > 0) {
                    addToast("Thiếu cặp ảnh", `${invalid.length} mục thiếu ảnh đầu hoặc cuối.`, "warning");
                    return;
                }
            }

            const lines = bulkPrompts.split('\n').filter(l => l.trim());
            
            newJobs = batchItems.map((item, idx) => ({
                id: uuidv4(),
                type: activeTab,
                prompt: item.prompt || lines[idx] || (activeTab === 'transition' ? "Smooth transition" : "Cinematic motion"),
                status: 'pending',
                aspectRatio,
                resolution,
                image: item.base64,
                endImage: item.base64_2
            }));
        }

        if (currentUser) {
            const check = checkUsageLimit(currentUser.username, ModuleType.IMAGE_TO_VIDEO, newJobs.length);
            if (!check.allowed) { addToast("Không đủ điểm", check.message || "Hết điểm", "error"); return; }
        }

        setJobs(prev => [...prev, ...newJobs]);
        addToast("Đã thêm hàng chờ", `${newJobs.length} video đang chờ xử lý`, "success");
    };

    const handleMergeVideos = async () => {
        const selected = jobs.filter(j => j.status === 'completed' && j.selectedForMerge && j.videoUrl);
        if (selected.length < 2) { addToast("Chọn ít nhất 2", "Cần 2 video trở lên.", "info"); return; }
        
        if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ tiến trình khác.", "warning"); return; }

        setIsMerging(true);
        setGlobalProcessing?.(true);
        addToast("Đang gộp", "Đang xử lý ghép video...", "info");
        
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous'; video.muted = true;
            
            if (selected[0].aspectRatio === '9:16') { canvas.width = 720; canvas.height = 1280; } 
            else { canvas.width = 1280; canvas.height = 720; }

            const stream = canvas.captureStream(30);
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
            const chunks: Blob[] = [];
            recorder.ondataavailable = e => { if(e.data.size > 0) chunks.push(e.data); };
            recorder.start();

            for(const job of selected) {
                if(!job.videoUrl) continue;
                await new Promise<void>(resolve => {
                    video.src = job.videoUrl!;
                    video.onloadedmetadata = () => video.play();
                    const draw = () => {
                        if(video.paused || video.ended) return;
                        ctx?.drawImage(video,0,0,canvas.width,canvas.height);
                        requestAnimationFrame(draw);
                    };
                    video.onplay = () => draw();
                    video.onended = () => resolve();
                    video.onerror = () => resolve();
                });
            }
            recorder.stop();
            await new Promise<void>(r => { recorder.onstop = () => r(); });
            const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
            triggerBrowserDownload(url, `Merged-${Date.now()}.webm`);
            addToast("Thành công", "Đã tải video gộp.", "success");
        } catch (e) { addToast("Lỗi", "Gộp thất bại.", "error"); } 
        finally { setIsMerging(false); setGlobalProcessing?.(false); }
    };

    const handleRegenerateJob = (jobId: string) => {
        if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }
        
        setJobs(prev => prev.map(j => {
            if (j.id !== jobId) return j;
            return {
                ...j,
                status: 'pending',
                videoUrl: undefined,
                errorMessage: undefined,
                prompt: j.isEditing && j.editPromptValue ? j.editPromptValue : j.prompt,
                isEditing: false
            };
        }));
    };

    return (
        <div className="flex flex-col lg:flex-row h-full w-full p-4 lg:p-6 gap-6 lg:gap-8">
            {/* LEFT PANEL */}
            <div className="w-full lg:w-[480px] flex flex-col gap-5 shrink-0 h-auto lg:h-full lg:overflow-y-auto custom-scrollbar pb-10 lg:pb-0">
                <div className="pb-4 border-b border-white/5">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">Veo Production</h2>
                    <p className="text-sm text-zinc-400 font-light">Batch Processing & Timeline Management</p>
                </div>

                {/* TABS */}
                <div className="flex bg-zinc-900/60 p-1 rounded-xl border border-white/5">
                    {[
                        { id: 'text', label: 'Text Motion', icon: FileText },
                        { id: 'image', label: 'Image Motion', icon: Image },
                        { id: 'transition', label: 'Transition', icon: ArrowRightLeft },
                        { id: 'sync', label: 'Char Sync', icon: Users }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => { setActiveTab(t.id as JobType); setBatchItems([]); setBulkPrompts(''); }}
                            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${activeTab === t.id ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <t.icon size={16} className="mb-1"/> {t.label}
                        </button>
                    ))}
                </div>

                {/* INPUT AREA */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm flex-1 flex flex-col space-y-4 shadow-lg">
                    
                    {/* 1. BULK PROMPT INPUT */}
                    <div className="space-y-2 animate-in fade-in">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase flex justify-between">
                            <span>Nhập Prompt Hàng Loạt (Tự động điền)</span>
                            <span className="text-cyan-500">{bulkPrompts ? bulkPrompts.split('\n').filter(x=>x.trim()).length : 0} Lines</span>
                        </label>
                        <textarea 
                            value={bulkPrompts} 
                            onChange={e => setBulkPrompts(e.target.value)} 
                            className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-cyan-500 outline-none resize-none custom-scrollbar font-mono leading-relaxed"
                            placeholder={activeTab === 'text' ? "Mỗi dòng sẽ tạo ra 1 video riêng biệt..." : "Dòng 1 -> Ảnh 1\nDòng 2 -> Ảnh 2..."}
                        />
                    </div>

                    <div className="h-px bg-white/5"></div>

                    {/* 2. ADVANCED STORYBOARD LIST */}
                    {activeTab !== 'text' && (
                        <div className="space-y-4 animate-in fade-in flex-1 flex flex-col">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                                    <Clapperboard size={12}/> Storyboard Timeline ({batchItems.length})
                                </label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { loadScripts(); setIsScriptModalOpen(true); }}
                                        className="text-[10px] bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 px-2 py-1.5 rounded flex items-center gap-1 border border-indigo-500/30 transition-colors font-bold"
                                    >
                                        <FileJson size={12}/> Import Kịch bản
                                    </button>

                                    <label className={`text-[10px] text-white px-2 py-1.5 rounded cursor-pointer flex items-center gap-1 border transition-all ${isCheckingSafety ? 'bg-zinc-800 border-zinc-600 cursor-not-allowed opacity-70' : 'bg-zinc-800 hover:bg-zinc-700 border-white/10'}`}>
                                        {isCheckingSafety ? <Loader2 size={12} className="animate-spin"/> : <Plus size={12}/>} 
                                        {isCheckingSafety ? 'Đang kiểm tra...' : 'Thêm Ảnh'}
                                        <input type="file" multiple accept="image/*" onChange={(e) => handleFiles(e, 'main')} className="hidden" disabled={isCheckingSafety}/>
                                    </label>

                                    {activeTab === 'transition' && (
                                        <>
                                            <input type="file" multiple accept="image/*" onChange={(e) => handleFiles(e, 'secondary')} className="hidden" id="upload-end" disabled={isCheckingSafety}/>
                                            <label htmlFor="upload-end" className={`text-[10px] text-white px-2 py-1.5 rounded cursor-pointer flex items-center gap-1 border transition-all ${isCheckingSafety ? 'bg-zinc-800 border-zinc-600 cursor-not-allowed opacity-70' : 'bg-zinc-800 hover:bg-zinc-700 border-white/10'}`}>
                                                <ArrowDown size={12}/> Ảnh Cuối
                                            </label>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-[300px] border border-zinc-800/50 rounded-xl p-2 bg-zinc-950/30">
                                {batchItems.length > 0 ? batchItems.map((item, i) => (
                                    <div key={item.id} className="flex gap-3 bg-zinc-900 border border-zinc-800 p-2 rounded-xl group hover:border-cyan-500/30 transition-all relative">
                                        {/* Order Controls */}
                                        <div className="flex flex-col justify-center gap-1 border-r border-zinc-800 pr-2 mr-1">
                                            <button onClick={() => moveItem(i, 'up')} disabled={i === 0} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white disabled:opacity-20"><ArrowUp size={10}/></button>
                                            <span className="text-[8px] font-bold text-center text-zinc-600">{i+1}</span>
                                            <button onClick={() => moveItem(i, 'down')} disabled={i === batchItems.length - 1} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white disabled:opacity-20 rotate-180"><ArrowUp size={10}/></button>
                                        </div>

                                        {/* Thumbnail */}
                                        <div className="relative flex flex-col gap-1 shrink-0">
                                            <div className="w-20 h-20 rounded-lg overflow-hidden border border-zinc-800 relative bg-black">
                                                <img src={item.preview} className="w-full h-full object-contain"/>
                                            </div>
                                            {activeTab === 'transition' && (
                                                <div className="w-20 h-20 rounded-lg overflow-hidden border border-zinc-800 relative bg-black/50 flex items-center justify-center">
                                                    {item.preview2 ? (
                                                        <img src={item.preview2} className="w-full h-full object-contain"/>
                                                    ) : (
                                                        <div className="text-[8px] text-zinc-500 text-center px-1">Thiếu ảnh cuối</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Prompt & Controls */}
                                        <div className="flex-1 flex flex-col gap-2 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-1">Prompt / Action</span>
                                                <div className="flex gap-1">
                                                    <button onClick={() => duplicateItem(i)} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="Nhân bản"><Copy size={12}/></button>
                                                    <button onClick={() => enhanceItemPrompt(i)} disabled={item.isEnhancing} className="p-1.5 bg-indigo-900/30 hover:bg-indigo-900/50 rounded text-indigo-400 hover:text-indigo-300" title="AI Viết lại Prompt">
                                                        {item.isEnhancing ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>}
                                                    </button>
                                                    <button onClick={() => removeItem(item.id)} className="p-1.5 bg-red-900/20 hover:bg-red-900/40 rounded text-red-400 hover:text-red-300" title="Xóa"><Trash2 size={12}/></button>
                                                </div>
                                            </div>
                                            <textarea 
                                                value={item.prompt}
                                                onChange={(e) => updateItemPrompt(item.id, e.target.value)}
                                                placeholder={activeTab === 'sync' ? "Hành động cho nhân vật này..." : "Mô tả chuyển động... (Prompt + Dialogue)"}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none resize-none h-full focus:border-cyan-500 transition-colors placeholder-zinc-700"
                                            />
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center text-zinc-600 text-xs py-20 flex flex-col items-center gap-2">
                                        <Film size={32} className="opacity-20"/>
                                        Danh sách trống. Tải ảnh hoặc nhập kịch bản để bắt đầu.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* GLOBAL SETTINGS & ACTION */}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Tỷ lệ</label>
                            <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs rounded-lg p-2 outline-none">
                                <option value="16:9">16:9 (Landscape)</option>
                                <option value="9:16">9:16 (Portrait)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Tùy chọn</label>
                            <label className="flex items-center gap-2 cursor-pointer bg-zinc-950 border border-zinc-800 rounded-lg p-2 h-[34px]">
                                <input type="checkbox" checked={autoDownload} onChange={e => setAutoDownload(e.target.checked)} className="rounded bg-zinc-800 border-zinc-700 text-cyan-500"/>
                                <span className="text-xs text-white">Auto Download</span>
                            </label>
                        </div>
                    </div>

                    {/* Total Duration Estimator */}
                    {activeTab !== 'text' && batchItems.length > 0 && (
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
                            <span>Số lượng: <strong className="text-white">{batchItems.length}</strong> clip</span>
                            <span className="flex items-center gap-1"><Clock size={10}/> Thời lượng ước tính: <strong className="text-cyan-400">~{batchItems.length * 5}s</strong></span>
                        </div>
                    )}

                    <button 
                        onClick={handleAddToQueue} 
                        className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/20"
                    >
                        <Layers size={18}/> Thêm vào hàng chờ ({activeTab === 'text' ? bulkPrompts.split('\n').filter(x=>x.trim()).length : batchItems.length})
                    </button>
                </div>
            </div>

            {/* RIGHT PANEL: QUEUE & RESULTS */}
            <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-2xl p-6 flex flex-col overflow-hidden min-h-[400px] lg:min-h-0">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-white">Production Queue</h3>
                        <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400 border border-zinc-700">
                            {jobs.filter(j => j.status === 'processing').length} Processing
                        </span>
                        <span className="text-xs text-zinc-500">|</span>
                        <span className="text-xs text-zinc-500">
                            {jobs.length} Total
                        </span>
                    </div>
                    {jobs.some(j => j.status === 'completed' && j.selectedForMerge) && (
                        <button onClick={handleMergeVideos} disabled={isMerging || isGlobalProcessing} className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-200 flex items-center gap-2 transition-all shadow-lg animate-in fade-in">
                            {isMerging ? <Loader2 size={14} className="animate-spin"/> : <Clapperboard size={14}/>} 
                            Gộp {jobs.filter(j => j.selectedForMerge).length} Video
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {jobs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50">
                            <Film size={64} className="mb-4"/>
                            <p>Hàng chờ trống</p>
                        </div>
                    ) : (
                        jobs.map((job, idx) => (
                            <div key={job.id} className={`flex gap-4 p-4 rounded-xl border transition-all relative group ${job.status === 'processing' ? 'bg-cyan-900/10 border-cyan-500/30' : job.status === 'error' ? 'bg-red-900/10 border-red-500/30' : 'bg-black/40 border-white/5 hover:border-white/10'}`}>
                                <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r ${job.status === 'completed' ? 'bg-green-500' : job.status === 'processing' ? 'bg-cyan-500 animate-pulse' : job.status === 'error' ? 'bg-red-500' : 'bg-zinc-700'}`}></div>

                                <div className="w-32 aspect-video bg-black rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center border border-zinc-800 ml-2">
                                    {job.videoUrl ? (
                                        <video src={job.videoUrl} className="w-full h-full object-cover" muted loop onMouseOver={e => (e.target as HTMLVideoElement).play()} onMouseOut={e => (e.target as HTMLVideoElement).pause()} />
                                    ) : (
                                        <div className="text-zinc-600 flex flex-col items-center">
                                            {job.status === 'processing' ? <Loader2 size={24} className="animate-spin text-cyan-500"/> : <Video size={24}/>}
                                        </div>
                                    )}
                                    {job.image && !job.videoUrl && <img src={`data:image/png;base64,${job.image}`} className="absolute inset-0 w-full h-full object-cover opacity-40"/>}
                                    <div className="absolute top-1 left-1 bg-black/60 px-1 rounded text-[8px] font-bold text-white uppercase backdrop-blur-sm border border-white/10">{job.type}</div>
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-start">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${job.status === 'completed' ? 'text-green-400' : job.status === 'error' ? 'text-red-400' : job.status === 'processing' ? 'text-cyan-400' : 'text-zinc-500'}`}>
                                                {job.status === 'error' ? job.errorMessage : job.status === 'processing' ? 'Đang tạo...' : job.status}
                                            </span>
                                            
                                            <div className="flex gap-1">
                                                {(job.status === 'pending' || job.status === 'error' || job.status === 'completed') && (
                                                    <button 
                                                        onClick={() => setJobs(prev => prev.map(j => j.id === job.id ? { ...j, isEditing: !j.isEditing, editPromptValue: j.prompt } : j))} 
                                                        className={`p-1.5 rounded hover:bg-zinc-700 transition-colors ${job.isEditing ? 'text-cyan-400 bg-cyan-900/20' : 'text-zinc-500 hover:text-white'}`}
                                                    >
                                                        {job.isEditing ? <CheckCircle size={14}/> : <Edit2 size={14}/>}
                                                    </button>
                                                )}
                                                
                                                <button onClick={() => handleRegenerateJob(job.id)} disabled={isGlobalProcessing} className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-cyan-400 transition-colors disabled:opacity-30">
                                                    <RefreshCw size={14}/>
                                                </button>

                                                <button onClick={() => setJobs(prev => prev.filter(j => j.id !== job.id))} className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-500 transition-colors">
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        </div>

                                        {job.isEditing ? (
                                            <textarea 
                                                value={job.editPromptValue}
                                                onChange={e => setJobs(prev => prev.map(j => j.id === job.id ? { ...j, editPromptValue: e.target.value } : j))}
                                                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white outline-none focus:border-cyan-500 h-16 resize-none"
                                                autoFocus
                                            />
                                        ) : (
                                            <p className="text-xs text-zinc-300 line-clamp-2 hover:line-clamp-none transition-all cursor-help" title={job.prompt}>
                                                {job.prompt}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                        <div className="flex items-center gap-2">
                                            {job.status === 'completed' && (
                                                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 hover:text-white select-none">
                                                    <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${job.selectedForMerge ? 'bg-cyan-600 border-cyan-600' : 'border-zinc-600 bg-transparent'}`}>
                                                        {job.selectedForMerge && <CheckCircle size={10} className="text-white"/>}
                                                    </div>
                                                    <input type="checkbox" checked={job.selectedForMerge} onChange={() => setJobs(prev => prev.map(j => j.id === job.id ? { ...j, selectedForMerge: !j.selectedForMerge } : j))} className="hidden"/>
                                                    Chọn gộp
                                                </label>
                                            )}
                                        </div>
                                        {job.videoUrl && (
                                            <button onClick={() => triggerBrowserDownload(job.videoUrl!, `Veo-${job.id.slice(0,4)}.mp4`)} className="text-xs bg-zinc-800 px-3 py-1.5 rounded text-white flex items-center gap-1.5 hover:bg-zinc-700 border border-white/5 transition-all shadow-sm">
                                                <Download size={12}/> Tải Lại
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Script Selection Modal */}
            {isScriptModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-4 border-b border-zinc-700 flex justify-between items-center bg-zinc-800/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Database size={20} className="text-indigo-400"/> Chọn Kịch bản
                            </h3>
                            <button onClick={() => setIsScriptModalOpen(false)} className="text-zinc-400 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2">
                            {availableScripts.length > 0 ? availableScripts.map(script => (
                                <button 
                                    key={script.id}
                                    onClick={() => handleImportScript(script)}
                                    className="w-full text-left p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-indigo-500 hover:bg-zinc-900 transition-all group flex flex-col gap-1"
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-white text-sm flex items-center gap-2">
                                            {script.type === 'story' ? <BookOpen size={14} className="text-emerald-500"/> : <Video size={14} className="text-blue-500"/>}
                                            {script.prompt.replace(/^(Veo|Story): /, '')}
                                        </span>
                                        <span className="text-[10px] text-zinc-500">{new Date(script.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 line-clamp-2">{script.meta?.purpose || script.meta?.summary || "No description"}</p>
                                </button>
                            )) : (
                                <div className="text-center text-zinc-500 py-10">Chưa có kịch bản nào trong thư viện.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageToVideo;
