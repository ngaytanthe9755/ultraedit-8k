
import React, { useEffect, useState } from 'react';
import { 
    Wand2, Layers, Film, Video, MonitorPlay, Users, BookOpen, Image as ImageIcon, 
    ArrowRight, Rocket, Activity, Database, Clock, Zap, Cpu, Command, Sparkles, Globe, Crown, TrendingUp,
    Play, Star, BarChart3, Fingerprint, Aperture
} from 'lucide-react';
import { ModuleType, User } from '../types';
import { getAllItems } from '../services/db';

interface HomeProps {
    onNavigate: (module: ModuleType) => void;
    currentUser: User;
}

// --- CONFIGURATION ---

const QUICK_STATS = [
    { label: "Assets Created", key: "totalItems", icon: Database, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { label: "Characters", key: "characters", icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { label: "Videos Rendered", key: "videos", icon: Film, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { label: "Storage Used", key: "storageUsage", icon: HardDrive, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" }
];

const FEATURES = [
    {
        id: ModuleType.CHANNEL_BUILDER,
        title: "Channel Architect",
        tag: "Strategy",
        desc: "Xây dựng chiến lược kênh triệu view & tối ưu doanh thu.",
        icon: TrendingUp,
        gradient: "from-amber-500 to-orange-600",
        size: "col-span-1 md:col-span-1",
        delay: "delay-0"
    },
    {
        id: ModuleType.NEW_CREATION,
        title: "Vision Generator",
        tag: "Core AI",
        desc: "Tạo ảnh Cinematic 8K với Gemini 3.0 Pro. Tối ưu ánh sáng & bố cục tự động.",
        icon: Wand2,
        gradient: "from-indigo-500 to-purple-600",
        size: "col-span-1 md:col-span-2 row-span-2", // Hero Card
        highlight: true,
        image: "https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&q=80&w=1000",
        delay: "delay-75"
    },
    {
        id: ModuleType.STORY_CREATOR,
        title: "Story Architect",
        tag: "Writing",
        desc: "Đạo diễn cốt truyện, phân cảnh & phát triển nhân vật.",
        icon: BookOpen,
        gradient: "from-emerald-500 to-teal-600",
        size: "col-span-1 md:col-span-1 row-span-2", // Tall Card
        delay: "delay-100"
    },
    {
        id: ModuleType.VEO_IDEAS,
        title: "Veo Scriptwriter",
        tag: "Video",
        desc: "Kịch bản video Veo/Sora chuẩn Hollywood.",
        icon: Video,
        gradient: "from-blue-500 to-cyan-600",
        size: "col-span-1 md:col-span-1",
        delay: "delay-150"
    },
    {
        id: ModuleType.IMAGE_TO_VIDEO,
        title: "Motion Studio",
        tag: "Video",
        desc: "Biến ảnh tĩnh thành thước phim chuyển động.",
        icon: Film,
        gradient: "from-cyan-500 to-sky-600",
        size: "col-span-1 md:col-span-1",
        delay: "delay-200"
    },
    {
        id: ModuleType.CHARACTER_CREATOR,
        title: "Character Lab",
        tag: "Assets",
        desc: "Thiết kế nhân vật nhất quán.",
        icon: Users,
        gradient: "from-rose-500 to-pink-600",
        size: "col-span-1 md:col-span-1",
        delay: "delay-300"
    },
    {
        id: ModuleType.STUDIO,
        title: "Composition Studio",
        tag: "Tools",
        desc: "Ghép ảnh & Hậu kỳ chuyên nghiệp.",
        icon: Layers,
        gradient: "from-violet-500 to-fuchsia-600",
        size: "col-span-1 md:col-span-1",
        delay: "delay-400"
    },
    {
        id: ModuleType.THUMBNAIL,
        title: "Viral Thumbnail",
        tag: "Marketing",
        desc: "Tối ưu CTR với thiết kế gây sốc.",
        icon: MonitorPlay,
        gradient: "from-red-500 to-orange-600",
        size: "col-span-1 md:col-span-1",
        delay: "delay-500"
    },
    {
        id: ModuleType.POSTER,
        title: "Pro Poster",
        tag: "Marketing",
        desc: "Ấn phẩm quảng cáo 3D.",
        icon: ImageIcon,
        gradient: "from-pink-500 to-rose-600",
        size: "col-span-1 md:col-span-1",
        delay: "delay-600"
    }
];

const Home: React.FC<HomeProps> = ({ onNavigate, currentUser }) => {
    const [stats, setStats] = useState<any>({
        totalItems: 0, characters: 0, videos: 0, storageUsage: '0 MB'
    });
    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Chào buổi sáng');
        else if (hour < 18) setGreeting('Chào buổi chiều');
        else setGreeting('Chào buổi tối');

        const fetchStats = async () => {
            const items = await getAllItems();
            const chars = items.filter(i => i.type.includes('character')).length;
            const videos = items.filter(i => i.type.includes('video')).length;
            const mb = (JSON.stringify(items).length / (1024 * 1024)).toFixed(1);
            setStats({ totalItems: items.length, characters: chars, videos: videos, storageUsage: `${mb} MB` });
        };
        fetchStats();
        const interval = setInterval(fetchStats, 15000);
        return () => clearInterval(interval);
    }, []);

    const visibleFeatures = FEATURES.filter(f => currentUser.role === 'admin' || currentUser.permissions?.[f.id] !== false);

    return (
        <div className="w-full min-h-full bg-[#09090b] text-white font-sans relative overflow-hidden pb-20">
            
            {/* --- 1. AMBIENT BACKGROUND --- */}
            <div className="fixed inset-0 pointer-events-none z-0">
                {/* Gradient Orbs */}
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse-glow" style={{animationDuration: '8s'}}></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[100px] animate-pulse-glow" style={{animationDuration: '10s', animationDelay: '2s'}}></div>
                <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[150px]"></div>
                
                {/* Mesh Grid */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)]"></div>
            </div>

            <div className="relative z-10 max-w-[1440px] mx-auto p-6 lg:p-10 space-y-10">
                
                {/* --- 2. HEADER & HUD --- */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8 animate-in slide-in-from-top-5 duration-700">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
                            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span>System Operational</span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-indigo-400 font-mono text-xs border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 rounded">v2.5 Pro</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
                            {greeting}, <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500">{currentUser.username}</span>
                        </h1>
                        <p className="text-zinc-400 max-w-lg text-sm md:text-base leading-relaxed">
                            Chào mừng trở lại trung tâm sáng tạo. Mọi công cụ AI mạnh mẽ nhất đã sẵn sàng để hiện thực hóa ý tưởng của bạn.
                        </p>
                        
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => onNavigate(ModuleType.NEW_CREATION)} className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 group">
                                <Zap size={18} className="fill-black group-hover:text-indigo-600 transition-colors"/> Tạo Tác Phẩm Mới
                            </button>
                            <button onClick={() => onNavigate(ModuleType.LIBRARY)} className="px-6 py-3 bg-zinc-800/50 text-white border border-white/10 rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all flex items-center gap-2 backdrop-blur-md">
                                <Database size={18}/> Thư Viện
                            </button>
                        </div>
                    </div>

                    {/* Stats HUD (Glass Cards) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full xl:w-auto">
                        {QUICK_STATS.map((stat) => (
                            <div key={stat.key} className={`relative p-4 rounded-2xl bg-zinc-900/40 border ${stat.border} backdrop-blur-md group hover:bg-zinc-800/60 transition-all duration-300 xl:min-w-[140px]`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                                        <stat.icon size={18} />
                                    </div>
                                    <ArrowRight size={14} className="text-zinc-600 group-hover:text-white -rotate-45 group-hover:rotate-0 transition-transform duration-300"/>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-white font-mono tracking-tight">{stats[stat.key]}</div>
                                    <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mt-1">{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- 3. BENTO GRID MODULES --- */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            <Aperture className="text-indigo-500" size={24}/> 
                            Creative Modules
                        </h2>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-zinc-800 to-transparent ml-6"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5 auto-rows-[minmax(180px,auto)]">
                        {visibleFeatures.map((feature) => (
                            <div 
                                key={feature.id}
                                onClick={() => onNavigate(feature.id)}
                                className={`
                                    ${feature.size} 
                                    relative group rounded-3xl overflow-hidden cursor-pointer
                                    bg-zinc-900/40 border border-white/5 
                                    hover:border-white/20 transition-all duration-500 
                                    hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:-translate-y-1
                                    ${feature.delay} animate-in fade-in fill-mode-backwards
                                `}
                            >
                                {/* Hover Gradient Bloom */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-xl`}></div>
                                
                                {/* Background Image (If Hero) */}
                                {feature.image && (
                                    <>
                                        <div className="absolute inset-0 z-0">
                                            <img src={feature.image} className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700 grayscale group-hover:grayscale-0" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent"></div>
                                        </div>
                                    </>
                                )}

                                {/* Card Content */}
                                <div className="relative z-10 h-full p-6 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className={`
                                            p-3.5 rounded-2xl backdrop-blur-xl border border-white/10
                                            bg-gradient-to-br ${feature.gradient} 
                                            text-white shadow-lg group-hover:scale-110 transition-transform duration-300
                                        `}>
                                            <feature.icon size={24} fill="currentColor" className="opacity-90"/>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {feature.highlight && (
                                                <span className="px-2 py-1 rounded-md bg-white/10 backdrop-blur border border-white/10 text-[10px] font-bold text-white uppercase animate-pulse">
                                                    Popular
                                                </span>
                                            )}
                                            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                <ArrowRight size={14} className="text-white"/>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px] font-medium text-zinc-400 uppercase tracking-wider group-hover:bg-white/10 group-hover:text-white transition-colors">
                                            {feature.tag}
                                        </div>
                                        <h3 className="text-2xl font-bold text-white leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 transition-all">
                                            {feature.title}
                                        </h3>
                                        <p className="text-sm text-zinc-400 line-clamp-2 font-medium leading-relaxed group-hover:text-zinc-300">
                                            {feature.desc}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- 4. FOOTER --- */}
                <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-500 text-xs">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Globe size={14} className="text-zinc-600"/>
                            <span>Global CDN Ready</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Shield size={14} className="text-zinc-600"/>
                            <span>Enterprise Security</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Cpu size={14} className="text-zinc-600"/>
                            <span>Gemini 2.5/3.0 Inference</span>
                        </div>
                    </div>
                    <div className="font-mono uppercase tracking-widest opacity-60">
                        UltraEdit 8K © 2025 • JacyGM
                    </div>
                </div>

            </div>
        </div>
    );
};

// Helper Icon
function Shield(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}

function HardDrive(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/></svg>;
}

export default Home;
