
import React, { useState, useEffect, useRef } from 'react';
import { 
    BookOpen, Users, Film, Wand2, Save, Download, 
    Loader2, Play, Pause, ChevronRight, ChevronLeft, 
    RefreshCw, Edit2, FileText, Share2, Layers, 
    MonitorPlay, Speaker, Globe, Sparkles, LayoutTemplate,
    Clock, Settings, ArrowRight, CheckCircle2, Video as VideoIcon, Mic, Clapperboard, Palette, VolumeX, Volume2, List, MapPin,
    SplitSquareHorizontal, SplitSquareVertical, Grid, Copy, CheckCircle, Folder, Flag, RotateCcw, Type, TrendingUp, Hash, AlignLeft, Send, AlertTriangle, X, BrainCircuit, Timer, ScrollText, MousePointerClick, Camera, ChevronDown, CheckSquare, Square, PlayCircle, Zap, Maximize2
} from 'lucide-react';
import { generateStoryStructure, generateStoryScenes, generateYouTubeSEO, generateImage, enhancePrompt, suggestCharacterVoices, generateDiverseStoryIdeas, generateStoryThumbnail, generateVeoSceneImage } from '../services/geminiService';
import { saveItem, getAllItems } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
import { LibraryItem, User, ModuleType, StoryStructure, VideoScene, SEOData } from '../types';
import { checkUsageLimit, incrementUsage } from '../services/userService';
import { ImageViewerModal } from '../components/ImageViewerModal';

interface StoryCreatorProps {
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    initialStoryId?: string;
    currentUser?: any;
    isGlobalProcessing?: boolean;
    setGlobalProcessing?: (val: boolean) => void;
}

const MARKET_CONFIG: Record<string, { label: string, lang: string, voices: string[] }> = {
    "vn": {
        label: "Vietnam 🇻🇳",
        lang: "Vietnamese",
        voices: [
            "Nam Miền Bắc (Hà Nội - Trầm ấm)", "Nam Miền Bắc (Hà Nội - Sôi động)", "Nam Già (Bắc - Hiền hậu)",
            "Nữ Miền Bắc (Hà Nội - Nhẹ nhàng)", "Nữ Miền Bắc (Hà Nội - Sang trọng)", "Nữ Già (Bắc - Kể chuyện)",
            "Nam Miền Nam (Sài Gòn - Thân thiện)", "Nam Miền Nam (Sài Gòn - Lịch lãm)", "Nam Trung Niên (Sài Gòn)",
            "Nữ Miền Nam (Sài Gòn - Ngọt ngào)", "Nữ Miền Nam (Sài Gòn - Năng động)", "Nữ Trung Niên (Sài Gòn)",
            "Bé trai (Bắc - Nghịch ngợm)", "Bé gái (Bắc - Dễ thương)", "Bé trai (Nam)", "Bé gái (Nam)"
        ]
    },
    "us": {
        label: "United States 🇺🇸",
        lang: "English (US)",
        voices: [
            "Male (US - Deep Narrator)", "Male (US - Casual/Friendly)", "Male (US - Corporate)", 
            "Female (US - Soft/Warm)", "Female (US - Energetic)", "Female (US - Professional)",
            "Kid Boy (US)", "Kid Girl (US)", "Old Man (US - Wise)", "Old Woman (US - Storyteller)"
        ]
    },
    "uk": {
        label: "United Kingdom 🇬🇧",
        lang: "English (UK)",
        voices: [
            "Male (UK - Received Pronunciation)", "Male (UK - Cockney)", "Male (UK - Scottish)",
            "Female (UK - Elegant)", "Female (UK - Modern)", "Kid (UK)"
        ]
    },
    "jp": {
        label: "Japan 🇯🇵",
        lang: "Japanese",
        voices: [
            "Male (Anime Protagonist)", "Male (Samurai/Deep)", "Female (Kawaii/High Pitch)", "Female (Mature/Elegant)"
        ]
    },
    "kr": {
        label: "Korea 🇰🇷",
        lang: "Korean",
        voices: [
            "Male (Drama Lead - Soft)", "Male (News Anchor)", "Female (Idol - Bright)", "Female (Motherly)"
        ]
    },
    "cn": {
        label: "China 🇨🇳",
        lang: "Chinese (Mandarin)",
        voices: [
            "Male (Standard Mandarin)", "Female (Standard Mandarin)", "Male (Cantonese)"
        ]
    },
    "fr": {
        label: "France 🇫🇷",
        lang: "French",
        voices: ["Male (Parisian)", "Female (Soft French)"]
    },
    "de": {
        label: "Germany 🇩🇪",
        lang: "German",
        voices: ["Male (Standard German)", "Female (Standard German)"]
    },
    "es": {
        label: "Spain 🇪🇸",
        lang: "Spanish",
        voices: ["Male (Castilian)", "Female (Castilian)", "Male (Latam)", "Female (Latam)"]
    }
};

const STORY_GENRES = [
    { id: 'fantasy', label: 'Giả tưởng (Fantasy)', icon: '🐉' },
    { id: 'scifi', label: 'Khoa học viễn tưởng (Sci-Fi)', icon: '🚀' },
    { id: 'romance', label: 'Lãng mạn (Romance)', icon: '💕' },
    { id: 'horror', label: 'Kinh dị (Horror)', icon: '👻' },
    { id: 'action', label: 'Hành động (Action)', icon: '💥' },
    { id: 'adventure', label: 'Phiêu lưu (Adventure)', icon: '🗺️' },
    { id: 'sliceoflife', label: 'Đời thường (Slice of Life)', icon: '☕' },
    { id: 'mystery', label: 'Bí ẩn (Mystery)', icon: '🔎' },
    { id: 'thriller', label: 'Giật gân (Thriller)', icon: '🔪' },
    { id: 'history', label: 'Cổ trang/Lịch sử (Historical)', icon: '🏯' },
    { id: 'comedy', label: 'Hài hước (Comedy)', icon: '😂' },
    { id: 'drama', label: 'Tâm lý (Drama)', icon: '🎭' },
    { id: 'fairy_tale', label: 'Cổ tích (Fairy Tale)', icon: '🧚' },
    { id: 'mythology', label: 'Thần thoại (Mythology)', icon: '⚡' },
    { id: 'cyberpunk', label: 'Cyberpunk (Công nghệ cao)', icon: '🤖' },
    { id: 'steampunk', label: 'Steampunk (Hơi nước)', icon: '⚙️' },
    { id: 'post_apocalyptic', label: 'Hậu tận thế (Post-Apoc)', icon: '☢️' },
    { id: 'dystopian', label: 'Phản địa đàng (Dystopian)', icon: '👁️' },
    { id: 'detective', label: 'Trinh thám (Detective)', icon: '🕵️' },
    { id: 'wuxia', label: 'Kiếm hiệp/Tiên hiệp (Wuxia)', icon: '⚔️' },
    { id: 'isekai', label: 'Xuyên không (Isekai)', icon: '🌀' },
    { id: 'mecha', label: 'Người máy (Mecha)', icon: '🦾' },
    { id: 'sports', label: 'Thể thao (Sports)', icon: '⚽' },
    { id: 'musical', label: 'Ca vũ nhạc (Musical)', icon: '🎵' },
    { id: 'educational', label: 'Giáo dục (Educational)', icon: '🎓' },
    { id: 'documentary', label: 'Tài liệu (Documentary)', icon: '📹' },
    { id: 'kids', label: 'Thiếu nhi (Kids)', icon: '🧸' },
    { id: 'espionage', label: 'Điệp viên (Espionage)', icon: '🕶️' },
    { id: 'western', label: 'Viễn Tây (Western)', icon: '🤠' },
    { id: 'superhero', label: 'Siêu anh hùng (Superhero)', icon: '🦸' }
];

const STORY_MOODS = [
    "Hài hước (Funny)", "Cảm động (Touching)", "U tối (Dark)", "Hào hùng (Epic)", 
    "Nhẹ nhàng (Chill)", "Kịch tính (Dramatic)", "Bí ẩn (Mysterious)", "Chữa lành (Healing)"
];

const VISUAL_STYLES = [
    { id: 'cinematic', label: 'Cinematic Movie (8K Realism)', prompt: 'Cinematic lighting, photorealistic, 8k, movie still, arri alexa, color graded' },
    { id: 'pixar', label: '3D Animation (Pixar Style)', prompt: '3D render, disney pixar style, cute, vibrant, volumetric lighting, octane render' },
    { id: 'anime', label: 'Anime Masterpiece (Ghibli/Shinkai)', prompt: 'Anime style, makoto shinkai style, highly detailed, beautiful background, 4k' },
    { id: 'noir', label: 'Film Noir (Black & White)', prompt: 'Film noir, black and white, dramatic shadows, high contrast, vintage movie' },
    { id: 'cyberpunk', label: 'Cyberpunk (Neon Future)', prompt: 'Cyberpunk, neon lights, futuristic city, chrome, high tech, night time' },
    { id: 'watercolor', label: 'Watercolor (Artistic)', prompt: 'Watercolor painting, soft edges, artistic, dreamy, pastel colors' }
];

const OPENING_HOOKS = [
    { id: 'default', label: 'Tự nhiên (Theo cốt truyện)', prompt: 'Start naturally according to the plot flow.' },
    { id: 'in_media_res', label: 'Hành động ngay (In Media Res)', prompt: 'HOOK: Start immediately in the middle of high-stakes action or conflict. No slow buildup. Throw the viewer straight into the fire.' },
    { id: 'mystery_cold_open', label: 'Mở đầu bí ẩn (Cold Open)', prompt: 'HOOK: Start with a puzzling, strange, or terrifying visual that demands an explanation. Create a curiosity gap instantly.' },
    { id: 'emotional_shock', label: 'Cú sốc cảm xúc', prompt: 'HOOK: Start with an intense emotional moment (crying, hysterical laughter, screaming) close-up to trigger immediate empathy.' },
    { id: 'visual_spectacle', label: 'Thị giác choáng ngợp', prompt: 'HOOK: Start with a breathtaking, impossible, or visually stunning wide shot that showcases the world/setting in 8K glory.' },
    { id: 'sound_first', label: 'Âm thanh dẫn dắt', prompt: 'HOOK: Start with a black screen or blurry visual with intense sound effects (breathing, footsteps, sirens) before revealing the scene.' },
    { id: 'breaking_news', label: 'Tin giật gân (Breaking News)', prompt: 'HOOK: Start with a news report style or urgent announcement vibe to create urgency.' },
    { id: 'character_quirk', label: 'Nhân vật kỳ quặc', prompt: 'HOOK: Introduce the main character doing something highly unusual, specific, or eccentric to establish personality immediately.' }
];

const CAMERA_ANGLES = [
    { id: 'default', label: 'Mặc định (AI Tự quyết định)', prompt: 'Professional cinematic camera selection.' },
    { id: 'wide', label: 'Góc Rộng (Wide Shot)', prompt: 'Wide shot (WS). The character is shown from head to toe, balanced within the frame, showing enough of the surrounding environment.' },
    { id: 'closeup', label: 'Cận Cảnh (Close-up)', prompt: 'Close-up shot (CU). The character fills most of the frame, showing detail and emotion clearly.' },
    { id: 'extreme_wide', label: 'Toàn Cảnh (Extreme Wide)', prompt: 'Extreme wide shot (EWS). Massive scale showing the entire environment with characters as tiny dots.' },
    { id: 'medium', label: 'Trung Cảnh (Medium Shot)', prompt: 'Medium shot (MS). Characters from the waist up, focusing on interaction and body language.' },
    { id: 'low_angle', label: 'Góc Thấp (Low Angle)', prompt: 'Low angle shot. Camera is below eye level looking up, making the character appear powerful and heroic.' },
    { id: 'high_angle', label: 'Góc Cao (High Angle)', prompt: 'High angle shot. Camera is above looking down, making characters appear small or vulnerable.' },
    { id: 'dutch_angle', label: 'Góc Nghiêng (Dutch Angle)', prompt: 'Dutch angle (Canted shot). The camera is tilted for dramatic tension or unease.' },
    { id: 'birds_eye', label: 'Nhìn từ trên đỉnh (Bird\'s Eye)', prompt: 'Bird\'s eye view. Shot from directly overhead, focusing on floor patterns and macro positioning.' },
    { id: 'worms_eye', label: 'Góc nhìn sâu bọ (Worm\'s Eye)', prompt: 'Worm\'s eye view. Shot from the ground looking up, dramatic perspective.' },
    { id: 'over_the_shoulder', label: 'Qua vai (Over the Shoulder)', prompt: 'Over the shoulder shot (OTS). Focusing on one character from behind another, ideal for dialogue.' },
    { id: 'pov', label: 'Góc nhìn thứ nhất (POV)', prompt: 'Point of View (POV). The camera acts as the character\'s eyes.' },
    { id: 'side_profile', label: 'Góc Nghiêng (Side Profile)', prompt: 'Side profile shot. Showing the character from the side.' },
    { id: 'back_view', label: 'Sau lưng (Back View)', prompt: 'Back view. Mystery and intrigue, character looking into the distance.' },
    { id: 'extreme_closeup', label: 'Đặc Tả (Extreme Close-up)', prompt: 'Extreme close-up (ECU). Focusing on a single eye, lips, or a tiny object detail.' },
    { id: 'tracking_shot', label: 'Quay đuổi (Tracking Shot)', prompt: 'Dynamic tracking shot, sense of motion and following the subject.' },
    { id: 'two_shot', label: 'Cảnh đôi (Two-Shot)', prompt: 'Two-shot. Two characters framed equally to show their relationship.' },
    { id: 'cowboy_shot', label: 'Góc Viễn Tây (Cowboy Shot)', prompt: 'Cowboy shot (American shot). Mid-thigh up, classic hero framing.' },
    { id: 'eye_level', label: 'Ngang mắt (Eye Level)', prompt: 'Eye level shot. Neutral, relatable, and direct connection.' },
    { id: 'fisheye', label: 'Mắt Cá (Fisheye)', prompt: 'Fisheye lens effect. Wide distorted field of view, 180 degrees.' },
    { id: 'silhouette', label: 'Ngược sáng (Silhouette)', prompt: 'Silhouette lighting. Character as a dark shape against a bright background.' },
    { id: 'macro', label: 'Siêu Cận (Macro Shot)', prompt: 'Macro photography style. Focusing on textures and micro details.' }
];

const RETENTION_STRATEGIES = [
    { id: 'none', label: 'Mặc định (Không áp dụng)', prompt: 'Standard storytelling pacing.' },
    { id: 'loop_16s', label: '16s Curiosity Loop (Giữ chân cao)', prompt: 'STRATEGY: "16-Second Curiosity Loop". Every 16 seconds (approx every 2 scenes), create a curiosity gap (a question, mystery, or unexpected visual). In the next 16 seconds, answer it but immediately open a new gap. Keep this rhythm strictly.' },
    { id: 'loop_32s', label: '32s Mystery Reveal (Kể chuyện)', prompt: 'STRATEGY: "32-Second Mystery". Build tension and mystery for 32 seconds, then provide a satisfying reveal or plot twist. Then start building the next mystery.' },
    { id: 'fast_cut', label: 'TikTok Fast Pacing (Dồn dập)', prompt: 'STRATEGY: "Dopamine Rush". Extremely fast pacing. Every scene must introduce a new visual element. Change camera angles every single scene. No lingering shots. High energy.' },
    { id: 'emotional_rollercoaster', label: 'Tàu lượn cảm xúc (Cao trào)', prompt: 'STRATEGY: "Emotional Rollercoaster". Alternate between high-energy/happy scenes and low-energy/tense/sad scenes every 3-4 scenes to keep the viewer emotionally engaged.' },
    { id: 'cliffhanger_micro', label: 'Micro Cliffhangers (Mỗi cảnh)', prompt: 'STRATEGY: "Micro Cliffhangers". Ensure EVERY single scene ends with a mini-cliffhanger or an unfinished action that forces the viewer to watch the next scene.' },
    { id: 'visual_asmr', label: 'Visual ASMR (Thỏa mãn thị giác)', prompt: 'STRATEGY: "Visual Satisfying". Focus heavily on textures, smooth movements, and symmetrical compositions. Make the visual experience calming and oddly satisfying.' },
    { id: 'contrasting', label: 'Tương phản đối lập (Contrast)', prompt: 'STRATEGY: "Visual Contrast". Alternate between Wide shots and Extreme Close-ups. Alternate between Dark scenes and Bright scenes to prevent visual fatigue.' },
    { id: 'mystery_box', label: 'Chiếc hộp bí ẩn (J.J. Abrams)', prompt: 'STRATEGY: "Mystery Box". Introduce a central object or question in Scene 1 that is NOT explained until the very last scene of the episode. Keep hinting at it.' },
    { id: 'silent_tension', label: 'Sự im lặng kịch tính (Ít thoại)', prompt: 'STRATEGY: "Silent Tension". Minimize dialogue. Rely on visual storytelling, facial expressions, and atmospheric descriptions to build tension.' },
    { id: 'breaking_fourth_wall', label: 'Phá vỡ bức tường thứ 4', prompt: 'STRATEGY: "Fourth Wall Break". Have the character look directly at the camera or address the audience subtly every few scenes to create a connection.' },
    { id: 'rule_of_three', label: 'Quy tắc số 3 (Hài hước/Kịch tính)', prompt: 'STRATEGY: "Rule of Three". Establish a pattern in two scenes, then break/subvert it in the third scene for comedic or dramatic effect.' },
    { id: 'slow_burn', label: 'Slow Burn (Tăng dần)', prompt: 'STRATEGY: "Slow Burn". Start very slow and quiet. Gradually increase the pace, complexity, and visual intensity with every scene until the climax at the end.' },
    { id: 'flashback_intercut', label: 'Đan xen quá khứ (Flashback)', prompt: 'STRATEGY: "Parallel Timeline". Intercut between the present action and a relevant flashback every 2-3 scenes.' },
    { id: 'pov_immersive', label: 'Góc nhìn thứ nhất (Immersive)', prompt: 'STRATEGY: "POV Immersion". Write the visual prompts primarily from a First-Person Point of View (POV) to make the viewer feel like they are the character.' },
    { id: 'color_emotion', label: 'Tâm lý học màu sắc', prompt: 'STRATEGY: "Color Psychology". Shift the color palette based on the emotion of the scene (e.g., Blue for sad, Red for anger). Specify color tones in visual prompts.' },
    { id: 'details_focus', label: 'Chi tiết ẩn (Hidden Details)', prompt: 'STRATEGY: "Easter Eggs". Include subtle background details in early scenes that become important later. Encourage re-watching.' },
    { id: 'hero_journey_micro', label: 'Hành trình anh hùng (Micro)', prompt: 'STRATEGY: "Micro Hero\'s Journey". Even within this single episode, ensure the character goes through: Call to Action -> Struggle -> Victory/Failure.' },
    { id: 'dialogue_driven', label: 'Dẫn dắt bởi hội thoại (Sorkin)', prompt: 'STRATEGY: "Dialogue Driven". Fast-paced, witty dialogue (Sorkin style). Characters moving while talking ("Walk and Talk"). Visuals emphasize reaction shots.' },
    { id: 'surreal_dream', label: 'Giấc mơ siêu thực', prompt: 'STRATEGY: "Surrealism". Incorporate dream-like logic, physics-defying visuals, and exaggerated elements to keep the viewer questioning reality.' }
];

const NARRATIVE_FRAMEWORKS = [
    { id: 'standard', label: 'Cấu trúc tiêu chuẩn (Standard)', prompt: 'Standard linear storytelling.' },
    { id: 'kishotenketsu', label: 'Ki-Sho-Ten-Ketsu (Nhật Bản)', prompt: 'STRUCTURE: Kishōtenketsu (Introduction -> Development -> Twist -> Conclusion). Do not rely on conflict, rely on the Twist (Ten) to recontextualize the story.' },
    { id: 'save_the_cat', label: 'Save the Cat (Blake Snyder)', prompt: 'STRUCTURE: Save the Cat beat sheet elements. Ensure the protagonist does something likeable early on. Clear "All is Lost" moment before the climax.' },
    { id: 'harmon_circle', label: 'Vòng tròn cốt truyện (Dan Harmon)', prompt: 'STRUCTURE: Dan Harmon\'s Story Circle: 1. You (Comfort Zone) -> 2. Need -> 3. Go -> 4. Search -> 5. Find -> 6. Take -> 7. Return -> 8. Change.' },
    { id: 'fabula_syuzhet', label: 'Fabula & Syuzhet (Phi tuyến tính)', prompt: 'STRUCTURE: Non-linear narrative. Present the events out of chronological order to maximize mystery and impact.' },
    { id: 'interactive', label: 'Kịch bản tương tác (Game)', prompt: 'STRUCTURE: Write scenes that feel like an interactive game or choices. Engage the audience by presenting clear dilemmas.' }
];

const CTA_STRATEGIES = [
    { id: 'none', label: 'Không chọn (Mặc định)', prompt: 'No specific visual CTA instructions.' },
    { id: 'mouse_16s', label: '16s Chuột Máy Tính (Classic)', prompt: 'Every 16 seconds, a standard white computer mouse cursor (arrow) slides into the frame. It moves to a floating Red "SUBSCRIBE" button, clicks it (adding a ripple effect), then moves to a Bell icon and clicks it, changing it to an active ringing state. The buttons then subtly fade out.' },
    { id: 'glove_32s', label: '32s Bao Tay 3D Nhỏ', prompt: 'Every 32 seconds, a small, cute 3D white cartoon glove (Mickey style) enters. It points its index finger at the "SUBSCRIBE" button, presses it down, then taps the Bell icon. Both icons glow when touched. The interaction is playful and fast.' },
    { id: 'finger_56s', label: '56s Ngón Tay Người', prompt: 'Every 56 seconds, a realistic human index finger (independent of characters) enters the frame. It performs a firm "tap" on a glossy Subscribe button and a "ring" gesture on the Bell icon. The buttons react with a realistic 3D depth press animation.' },
    { id: 'pixel_24s', label: '24s Bàn Tay Pixel (8-bit)', prompt: 'Every 24 seconds, a retro 8-bit pixelated hand cursor appears. It clicks the Subscribe button with a "Select" sound-wave visual effect. This is perfect for gaming or retro styles.' },
    { id: 'neon_40s', label: '40s Ngón Tay Neon Hologram', prompt: 'Every 40 seconds, a futuristic blue neon hologram finger appears. It touches the Subscribe and Bell icons, causing a digital data-stream burst effect. Icons turn from outlines to solid neon when "clicked".' },
    { id: 'robot_48s', label: '48s Cánh Tay Robot', prompt: 'Every 48 seconds, a sleek, small metallic robotic arm reaches in. It mechanically presses the Subscribe button and activates the Bell with a subtle "ping" visual light. Very high-tech look.' },
    { id: 'wand_60s', label: '60s Đũa Thần Kỳ', prompt: 'Every 60 seconds, a sparkling magical wand taps the Subscribe button, turning it from Red to Gold (Subscribed) with a burst of stars. It then taps the Bell to make it shake and ring visually.' },
    { id: 'rocket_20s', label: '20s Tên Lửa Nhỏ', prompt: 'Every 20 seconds, a tiny stylized rocket flies across the bottom. It "hits" the Subscribe button to activate it, then loops around to hit the Bell, causing it to vibrate with speed lines.' },
    { id: 'pencil_15s', label: '15s Ngòi Bút Chì', prompt: 'Every 15 seconds, a pencil tip quickly draws a "Checkmark" (V) over a Subscribe button, causing it to turn gray/Subscribed. It then taps the Bell icon.' },
    { id: 'cat_paw_30s', label: '30s Bàn Chân Mèo (Paw)', prompt: 'Every 30 seconds, a fluffy cat paw reaches in and "pats" the Subscribe button and the Bell icon. Icons react with a "squishy" animation.' },
    { id: 'ghost_50s', label: '50s Bàn Tay Mờ Ảo', prompt: 'Every 50 seconds, a translucent, ghostly hand fades in, gently presses the buttons, and fades out. Very subtle and non-intrusive.' },
    { id: 'sleek_12s', label: '12s Con Trỏ Đen Hiện Đại', prompt: 'Every 12 seconds, a professional black sleek cursor (Mac style) moves precisely and double-clicks the buttons with a sharp modern ripple.' },
    { id: 'golden_45s', label: '45s Ngón Tay Vàng Kim', prompt: 'Every 45 seconds, a luxurious golden finger enters. When it touches the buttons, they emit a premium gold sparkle and glow.' },
    { id: 'sketch_28s', label: '28s Tay Vẽ Tay (Doodle)', prompt: 'Every 28 seconds, a hand-drawn sketchy finger appears and "taps" the buttons. The buttons themselves turn into hand-drawn versions briefly when clicked.' },
    { id: 'laser_38s', label: '38s Tia Laser Point', prompt: 'Every 38 seconds, a red laser dot aims at the Subscribe button and "triggers" it. The button explodes into a "SUBSCRIBED" label.' },
    { id: 'magnify_42s', label: '42s Kính Lúp Soi', prompt: 'Every 42 seconds, a magnifying glass moves over the buttons, enlarging them, then a cursor clicks through the glass.' },
    { id: 'compass_52s', label: '52s Kim Chỉ Nam', prompt: 'Every 52 seconds, a compass needle swings around to point at the Subscribe button, then taps it like a drumstick.' },
    { id: 'double_10s', label: '10s Bấm Đúp Cực Nhanh', prompt: 'Every 10 seconds, a cursor performs a super-fast double click on the icons to create a high-energy "Dopamine" visual pop.' },
    { id: 'feather_64s', label: '64s Lông Vũ Chạm', prompt: 'Every 64 seconds, a soft feather floats down and touches the buttons, causing them to activate with a gentle cloud-puff effect.' },
    { id: 'hammer_25s', label: '25s Búa Gỗ Nhỏ', prompt: 'Every 25 seconds, a small wooden judge’s gavel taps the Subscribe button "Approved!" and then the Bell.' }
];

const RATIOS = ['16:9', '9:16', '1:1', '4:3', '21:9'];
const QUALITIES = ['1K', '2K', '4K'];

const THUMB_LAYOUTS = [
    { id: 'Cinematic Single', label: 'Đơn (Poster Phim)', icon: <Layers size={14}/> },
    { id: 'Split Diagonal', label: 'Ghép Chéo (Vs)', icon: <SplitSquareHorizontal size={14} className="rotate-45"/> },
    { id: 'Split Vertical', label: 'Ghép Dọc (Split)', icon: <SplitSquareVertical size={14}/> },
    { id: 'Grid Collage', label: 'Lưới (Truyện tranh)', icon: <Grid size={14}/> },
    { id: 'Double Exposure', label: 'Lồng Ghép (Art)', icon: <Wand2 size={14}/> }
];

const YT_EMOTIONS = [
    { label: "Shocked/Surprised", value: "Shocked, mouth open, eyes wide, intense emotion" },
    { label: "Crying/Sad", value: "Tears, sad expression, rainy background, emotional" },
    { label: "Angry/Intense", value: "Angry, shouting, fire in eyes, intense stare, dramatic shadows" },
    { label: "Happy/Excited", value: "Laughing, huge smile, sparkling eyes, bright lighting" },
    { label: "Mysterious/Scared", value: "Fearful, looking behind, dark shadows, silhouette" },
    { label: "Normal/Neutral", value: "Calm, professional portrait, confident look" }
];

const YT_STYLES = [
    { label: "MrBeast / Viral", value: "High saturation, high contrast, vibrant colors, thick white outline around subject, exaggerated expression" },
    { label: "Netflix / Cinematic", value: "Cinematic color grading, dramatic lighting, movie poster composition, realistic texture" },
    { label: "Anime / Ghibli", value: "High quality Anime art style, vibrant colors, detailed background, emotional" },
    { label: "Minimalist / Apple", value: "Clean background, ample negative space, soft lighting, modern typography" },
    { label: "Horror / Dark", value: "Dark moody lighting, scary atmosphere, red and black tones, grain effect" }
];

const THUMB_LANGUAGES = [
    "Vietnamese", "English", "Japanese", "Korean", "Chinese", "French", "Spanish", "Russian", "German"
];

const StoryCreator: React.FC<StoryCreatorProps> = ({ addToast, initialStoryId, currentUser, isGlobalProcessing, setGlobalProcessing }) => {
    const [step, setStep] = useState<1|2|3|4>(1);
    const [availableChars, setAvailableChars] = useState<LibraryItem[]>([]);
    const [filteredChars, setFilteredChars] = useState<LibraryItem[]>([]);
    const [savedStories, setSavedStories] = useState<LibraryItem[]>([]); 
    const [selectedCharIds, setSelectedCharIds] = useState<Set<string>>(new Set());
    const [folders, setFolders] = useState<string[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>('Tất cả');

    const [selectedGenre, setSelectedGenre] = useState(STORY_GENRES[0]);
    const [selectedMood, setSelectedMood] = useState(STORY_MOODS[0]);
    const [ideaContext, setIdeaContext] = useState(''); 

    const [ideas, setIdeas] = useState<any[]>([]);
    const [selectedIdea, setSelectedIdea] = useState<any>(null); 
    const [isThinking, setIsThinking] = useState(false);
    
    const [storyStructure, setStoryStructure] = useState<any>(null); 
    const [episodeCount, setEpisodeCount] = useState(3);
    
    const [durationValue, setDurationValue] = useState<number>(60);
    const [durationUnit, setDurationUnit] = useState<'seconds'|'minutes'>('seconds');

    const [textMode, setTextMode] = useState<'yes' | 'no' | 'custom'>('no');
    const [isSilentMode, setIsSilentMode] = useState(false);
    const [visualStyle, setVisualStyle] = useState(VISUAL_STYLES[0]); 
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [quality, setQuality] = useState('2K');
    
    const [selectedCameraIds, setSelectedCameraIds] = useState<Set<string>>(new Set(['default']));
    const [isCameraDropdownOpen, setIsCameraDropdownOpen] = useState(false);

    const [autoEnhance, setAutoEnhance] = useState(false);
    const [targetMarket, setTargetMarket] = useState('vn');
    
    const [retentionStrategy, setRetentionStrategy] = useState(RETENTION_STRATEGIES[0].id);
    const [narrativeFramework, setNarrativeFramework] = useState(NARRATIVE_FRAMEWORKS[0].id);
    const [ctaStrategy, setCtaStrategy] = useState(CTA_STRATEGIES[0].id);
    const [openingHook, setOpeningHook] = useState(OPENING_HOOKS[0].id);

    const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
    const [scenes, setScenes] = useState<VideoScene[]>([]);
    const [voiceMap, setVoiceMap] = useState<Record<string, string>>({});
    const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
    const [storyId, setStoryId] = useState<string | null>(null);
    
    const [isProcessingPaused, setIsProcessingPaused] = useState(false);
    const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(0);
    
    const [showEpisodeReview, setShowEpisodeReview] = useState(false);
    const [seoData, setSeoData] = useState<SEOData | null>(null);
    
    const [thumbLayout, setThumbLayout] = useState(THUMB_LAYOUTS[0].id);
    const [thumbTextLang, setThumbTextLang] = useState('Vietnamese');
    const [showThumbConfig, setShowThumbConfig] = useState(false);
    const [thumbHookText, setThumbHookText] = useState('');
    const [thumbEmotion, setThumbEmotion] = useState(YT_EMOTIONS[0].value);
    const [thumbStyle, setThumbStyle] = useState(YT_STYLES[0].value);
    const [thumbRefSceneIndex, setThumbRefSceneIndex] = useState<number>(-1); 
    
    const [isGeneratingEnding, setIsGeneratingEnding] = useState(false);

    const isPausedRef = useRef(false);
    const wakeLockRef = useRef<any>(null);
    const scenesRef = useRef<VideoScene[]>([]); 
    const scrollRef = useRef<HTMLDivElement>(null); 
    const cameraRef = useRef<HTMLDivElement>(null);

    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const triggerDownload = (base64Data: string, filename: string) => {
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const loadData = async () => {
        const items = await getAllItems();
        const chars = items.filter(i => i.type === 'story_character' || i.type === 'character');
        chars.sort((a, b) => b.createdAt - a.createdAt);
        setAvailableChars(chars);
        
        const stories = items.filter(i => i.type === 'story');
        setSavedStories(stories);
        
        const uniqueFolders = new Set<string>(['Tất cả']);
        chars.forEach(c => { if (c.meta?.folderName) uniqueFolders.add(c.meta.folderName); });
        setFolders(Array.from(uniqueFolders));
    };

    useEffect(() => { 
        loadData();
        const handleUpdate = () => loadData();
        window.addEventListener('library_updated', handleUpdate);
        
        const handleClickOutside = (event: MouseEvent) => {
            if (cameraRef.current && !cameraRef.current.contains(event.target as Node)) {
                setIsCameraDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('library_updated', handleUpdate);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (selectedFolder === 'Tất cả') {
            setFilteredChars(availableChars);
        } else {
            setFilteredChars(availableChars.filter(c => c.meta?.folderName === selectedFolder));
        }
    }, [availableChars, selectedFolder]);

    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            }
        } catch (err) { console.warn(err); }
    };

    const findStrictMatchCharacter = (charNameInScript: string, selectedIds: Set<string>, allChars: LibraryItem[]) => {
        const selected = allChars.filter(c => selectedIds.has(c.id));
        if (selected.length === 0) return null;
        const scriptName = charNameInScript.toLowerCase();
        let match = selected.find(c => scriptName.includes(c.prompt.toLowerCase()));
        if (!match && selected.length > 0) { match = selected[0]; }
        return match || null;
    };

    const toggleCharSelection = (id: string) => {
        const newSet = new Set(selectedCharIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedCharIds(newSet);
    };

    const toggleCameraId = (id: string) => {
        const newSet = new Set(selectedCameraIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        if (newSet.size === 0) newSet.add('default');
        setSelectedCameraIds(newSet);
    };

    const handleLoadStory = (story: LibraryItem) => {
        if (!story.textContent) return;
        try {
            const structure = JSON.parse(story.textContent);
            setStoryStructure(structure);
            setStoryId(story.id);
            
            // Restore Meta
            if (story.meta) {
                if(story.meta.episodeIndex !== undefined) setCurrentEpisodeIndex(story.meta.episodeIndex);
                if(story.meta.voiceMap) setVoiceMap(story.meta.voiceMap);
                if(story.meta.aspectRatio) setAspectRatio(story.meta.aspectRatio);
                if(story.meta.textMode) setTextMode(story.meta.textMode);
                if(story.meta.isSilentMode !== undefined) setIsSilentMode(story.meta.isSilentMode);
                if(story.meta.visualStyleId) {
                    const style = VISUAL_STYLES.find(s => s.id === story.meta.visualStyleId);
                    if(style) setVisualStyle(style);
                }
                if(story.meta.quality) setQuality(story.meta.quality);
                if(story.meta.targetMarket) setTargetMarket(story.meta.targetMarket);
                if(story.meta.durationValue) setDurationValue(story.meta.durationValue);
                if(story.meta.durationUnit) setDurationUnit(story.meta.durationUnit);
                if(story.meta.retentionStrategy) setRetentionStrategy(story.meta.retentionStrategy);
                if(story.meta.narrativeFramework) setNarrativeFramework(story.meta.narrativeFramework);
                if(story.meta.ctaStrategy) setCtaStrategy(story.meta.ctaStrategy);
                if(story.meta.selectedCameraIds) setSelectedCameraIds(new Set(story.meta.selectedCameraIds));
                if(story.meta.openingHook) setOpeningHook(story.meta.openingHook);
                
                // RESTORE GENRE & MOOD
                if (story.meta.genreId) {
                    const g = STORY_GENRES.find(genre => genre.id === story.meta.genreId);
                    if (g) setSelectedGenre(g);
                }
                if (story.meta.mood) setSelectedMood(story.meta.mood);
                if (story.meta.ideaContext) setIdeaContext(story.meta.ideaContext);
            }

            // Restore Scenes if available in current episode
            if (structure.episodes && structure.episodes[currentEpisodeIndex || 0]?.scenes) {
                const loadedScenes = structure.episodes[currentEpisodeIndex || 0].scenes;
                setScenes(loadedScenes);
                scenesRef.current = loadedScenes;
                setStep(4);
            } else {
                setStep(3);
            }
            addToast("Thành công", "Đã tải dự án.", "success");
        } catch (e) {
            console.error(e);
            addToast("Lỗi", "Không thể tải dự án.", "error");
        }
    };

    const handleGenerateIdeas = async () => {
        if (selectedCharIds.size === 0 && !ideaContext) {
            addToast("Thiếu thông tin", "Chọn ít nhất 1 nhân vật hoặc nhập ý tưởng.", "warning");
            return;
        }
        setIsThinking(true);
        setIdeas([]);
        try {
            const charData = Array.from(selectedCharIds).map(id => {
                const c = availableChars.find(char => char.id === id);
                return c ? { name: c.prompt, description: c.meta?.description } : null;
            }).filter(c => c);

            const results = await generateDiverseStoryIdeas(charData, selectedMood, ideaContext, MARKET_CONFIG[targetMarket].label);
            setIdeas(results);
            setStep(2);
        } catch (e) {
            addToast("Lỗi", "Không thể tạo ý tưởng.", "error");
        } finally {
            setIsThinking(false);
        }
    };

    const handleGenerateStructure = async () => {
        if (!selectedIdea) return;
        setIsThinking(true);
        try {
            const charNames = Array.from(selectedCharIds).map(id => availableChars.find(c => c.id === id)?.prompt).filter(n => n) as string[];
            const structure = await generateStoryStructure(charNames, selectedIdea.premise, episodeCount, MARKET_CONFIG[targetMarket].label);
            setStoryStructure(structure);
            
            // Create initial save to persist genre/mood
            const newStoryId = uuidv4();
            setStoryId(newStoryId);
            
            await saveItem({
                id: newStoryId,
                type: 'story',
                prompt: `Story: ${structure.title}`,
                createdAt: Date.now(),
                textContent: JSON.stringify(structure),
                meta: {
                    genreId: selectedGenre.id,
                    mood: selectedMood,
                    ideaContext: ideaContext,
                    targetMarket,
                    sourceModule: ModuleType.STORY_CREATOR,
                    episodeIndex: 0
                }
            });
            
            setStep(3);
        } catch (e) {
            addToast("Lỗi", "Không thể tạo cấu trúc.", "error");
        } finally {
            setIsThinking(false);
        }
    };

    const handleAutoCastVoices = async () => {
        if (selectedCharIds.size === 0) return;
        setIsThinking(true);
        try {
            const charData = Array.from(selectedCharIds).map(id => {
                const c = availableChars.find(char => char.id === id);
                return c ? { name: c.prompt, description: c.meta?.description, gender: 'unknown' } : null;
            }).filter(c => c);
            
            const marketVoices = MARKET_CONFIG[targetMarket].voices;
            const suggestion = await suggestCharacterVoices(charData, marketVoices, MARKET_CONFIG[targetMarket].label);
            setVoiceMap(suggestion);
            addToast("Thành công", "Đã phân vai tự động!", "success");
        } catch (e) {
            addToast("Lỗi", "Không thể phân vai.", "error");
        } finally {
            setIsThinking(false);
        }
    };

    const handleGenerateScenes = async () => {
        if (!storyStructure) return;
        if (currentUser) {
            const check = checkUsageLimit(currentUser.username, ModuleType.STORY_CREATOR);
            if (!check.allowed) { addToast("Hết điểm", check.message || "Hết điểm", "error"); return; }
        }

        setIsGeneratingScenes(true);
        setGlobalProcessing?.(true);
        try {
            const ep = storyStructure.episodes[currentEpisodeIndex];
            const charData = Array.from(selectedCharIds).map(id => {
                const c = availableChars.find(char => char.id === id);
                return c ? { name: c.prompt, description: c.meta?.description } : null;
            }).filter(c => c);

            let prevSummary = "", nextSummary = "";
            if (currentEpisodeIndex > 0) prevSummary = storyStructure.episodes[currentEpisodeIndex-1].summary;
            if (currentEpisodeIndex < storyStructure.episodes.length - 1) nextSummary = storyStructure.episodes[currentEpisodeIndex+1].summary;

            const targetSceneCount = durationUnit === 'minutes' ? (durationValue * 60 / 10) : (durationValue / 10);
            
            // --- CONSTRUCTION OF PRODUCTION MANIFEST (CONTEXT) ---
            const cameraPrompts = Array.from(selectedCameraIds).map(id => CAMERA_ANGLES.find(c => c.id === id)?.prompt).join(' ');
            const retentionPrompt = RETENTION_STRATEGIES.find(s => s.id === retentionStrategy)?.prompt || '';
            const ctaPrompt = CTA_STRATEGIES.find(s => s.id === ctaStrategy)?.prompt || '';
            const frameworkPrompt = NARRATIVE_FRAMEWORKS.find(s => s.id === narrativeFramework)?.prompt || '';
            const hookPrompt = OPENING_HOOKS.find(h => h.id === openingHook)?.prompt || '';
            
            // Casting info inclusion for script
            const castingInfo = !isSilentMode ? `Voice Cast: ${JSON.stringify(voiceMap)}` : 'Silent Mode (Ambient)';

            // --- STRICT PRODUCTION MANIFEST WITH CONCEPT ADHERENCE ---
            const productionManifest = `
                **PRODUCTION BIBLE (STRICT ADHERENCE REQUIRED)**
                
                1. **CORE IDENTITY (CONCEPT):**
                   - TITLE: ${storyStructure.title}
                   - GENRE: ${selectedGenre.label}
                   - MOOD: ${selectedMood}
                   - PREMISE: ${ideaContext || storyStructure.summary}
                   - **ASPECT RATIO:** ${aspectRatio} (Visual composition MUST fit this frame).

                2. **VISUAL & CAMERA (PLAN):**
                   - VISUAL STYLE: ${visualStyle.prompt}
                   - CAMERA ANGLES: ${cameraPrompts || 'Dynamic Cinematic Angles'} (Use these angles explicitly).
                   - ENHANCEMENT: ${autoEnhance ? 'Detailed, rich environmental descriptions' : 'Standard descriptions'}.

                3. **AUDIO & PACING (PLAN):**
                   - AUDIO MODE: ${isSilentMode ? 'SILENT/AMBIENT (Minimal dialogue, heavy SFX focus)' : 'DIALOGUE-DRIVEN'}.
                   - VOICE CAST: ${castingInfo}.
                   - RETENTION STRATEGY: ${retentionPrompt} (Apply this pacing logic to scene durations and cuts).
                
                4. **STRUCTURE & ENGAGEMENT (PLAN):**
                   - OPENING HOOK: ${hookPrompt} (Scene 1 MUST follow this).
                   - NARRATIVE FRAMEWORK: ${frameworkPrompt}.
                   - CTA STRATEGY: ${ctaPrompt} (Integrate naturally).

                **INSTRUCTION:** Generate scenes that strictly follow the Aspect Ratio composition from CONCEPT and the chosen PLAN settings. Visual prompts must be optimized for AI Video generation in ${aspectRatio} format.
            `;

            const generatedScenes = await generateStoryScenes(
                ep.summary, 
                durationUnit === 'minutes' ? durationValue * 60 : durationValue,
                productionManifest, // Pass the comprehensive manifest here
                charData,
                voiceMap,
                textMode,
                [], 
                MARKET_CONFIG[targetMarket].lang,
                Math.round(targetSceneCount),
                currentEpisodeIndex,
                storyStructure.episodes.length,
                prevSummary,
                nextSummary
            );

            const updatedStructure = { ...storyStructure };
            updatedStructure.episodes[currentEpisodeIndex].scenes = generatedScenes;
            setStoryStructure(updatedStructure);
            setScenes(generatedScenes);
            scenesRef.current = generatedScenes;
            
            const newStoryId = storyId || uuidv4();
            setStoryId(newStoryId);

            await saveItem({
                id: newStoryId,
                type: 'story',
                prompt: `Story: ${updatedStructure.title}`,
                createdAt: Date.now(),
                textContent: JSON.stringify(updatedStructure),
                meta: {
                    episodeIndex: currentEpisodeIndex,
                    voiceMap,
                    aspectRatio,
                    textMode,
                    isSilentMode,
                    visualStyleId: visualStyle.id,
                    quality,
                    sourceModule: ModuleType.STORY_CREATOR,
                    targetMarket,
                    durationValue, durationUnit, retentionStrategy, narrativeFramework, ctaStrategy, openingHook,
                    selectedCameraIds: Array.from(selectedCameraIds),
                    // SAVE GENRE & MOOD
                    genreId: selectedGenre.id,
                    mood: selectedMood,
                    ideaContext: ideaContext
                }
            });

            if (currentUser) incrementUsage(currentUser.username, ModuleType.STORY_CREATOR);
            setStep(4);
            addToast("Thành công", "Đã viết kịch bản chi tiết theo PLAN & CONCEPT!", "success");

        } catch (e) {
            console.error(e);
            addToast("Lỗi", "Không thể tạo kịch bản.", "error");
        } finally {
            setIsGeneratingScenes(false);
            setGlobalProcessing?.(false);
        }
    };

    // ... (rest of methods unchanged: handleGenerateImageForScene, processSequentialGeneration, handleResumeSequence, etc.)
    const handleGenerateImageForScene = async (index: number) => {
        if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }
        if (currentUser) {
            const check = checkUsageLimit(currentUser.username, ModuleType.STORY_CREATOR);
            if (!check.allowed) { addToast("Hết điểm", check.message, "error"); return; }
        }
        
        const newScenes = [...scenesRef.current];
        newScenes[index].isGeneratingImage = true; 
        setScenes(newScenes);
        setGlobalProcessing?.(true);
        try {
            const scene = newScenes[index];
            let visualPrompt = scene.visualPrompt.replace(/[\r\n]+/g, ' ').trim(); 
            const charName = scene.character;
            
            // --- STRICT CHARACTER MATCHING ---
            let matchedCharacterItem = findStrictMatchCharacter(charName || "", selectedCharIds, availableChars);
            if (!matchedCharacterItem && selectedCharIds.size > 0) {
                 const foundId = Array.from(selectedCharIds).find(id => {
                     const c = availableChars.find(char => char.id === id);
                     return c && visualPrompt.toLowerCase().includes(c.prompt.toLowerCase());
                 });
                 if (foundId) matchedCharacterItem = availableChars.find(c => c.id === foundId) || null;
            }
            if (!matchedCharacterItem && selectedCharIds.size > 0) {
                 // Fallback to first selected character if strict match fails but user selected casting
                 const firstId = Array.from(selectedCharIds)[0];
                 matchedCharacterItem = availableChars.find(c => c.id === firstId) || null;
            }

            const charB64 = matchedCharacterItem?.base64Data ? matchedCharacterItem.base64Data.split(',')[1] : null;
            if (matchedCharacterItem) {
                visualPrompt = `[Character Reference: ${matchedCharacterItem.prompt}]. Maintain strict facial features and outfit from reference. ${visualPrompt}`;
            }

            // --- STRICT CONTEXT / BACKGROUND FROM PREVIOUS SCENE ---
            let prevImageB64 = null;
            let contextContext = "";
            
            if (index > 0) {
                const prevScene = newScenes[index - 1];
                if (prevScene.generatedImage) {
                    prevImageB64 = prevScene.generatedImage.split(',')[1];
                    contextContext = ` [CONTINUITY]: This is the next scene. The previous scene showed: "${prevScene.visualPrompt}". Maintain the same background environment, lighting, and art style.`;
                    
                    // Enforce location tag logic
                    if (scene.locationTag && prevScene.locationTag === scene.locationTag) {
                        contextContext += ` STRICTLY maintain the location '${scene.locationTag}'. Use previous image as background reference.`;
                    } else if (!scene.locationTag) {
                        // If no explicit new location, assume continuity
                        contextContext += ` If no new location is described, continue in the same setting.`;
                    }
                }
            }

            // --- PHYSICAL CONSISTENCY CONSTRAINT ---
            const physicsConstraint = `
                [IMPORTANT CONSTRAINT: PHYSICAL CONSISTENCY]
                1. Maintain absolute character height, weight, and body proportions relative to the environment.
                2. Objects must strictly adhere to real-world physics scaling (e.g., a table must be waist-height, not tiny).
                3. Do not morph, shrink, or grow the character between scenes.
                4. Keep facial features identical to the reference.
                5. Aspect Ratio Target: ${aspectRatio}.
            `;

            // Append context to visual prompt text for AI to understand logic
            const finalFullPrompt = `${visualPrompt}. ${contextContext}. ${physicsConstraint}`;

            // Pass to API
            const b64 = await generateVeoSceneImage(
                finalFullPrompt, 
                charB64, 
                null, 
                aspectRatio, 
                'Story Scene', 
                index, 
                prevImageB64, 
                quality
            );
            const fullImg = `data:image/png;base64,${b64}`;
            
            const updatedScenes = [...scenesRef.current];
            updatedScenes[index] = { ...updatedScenes[index], generatedImage: fullImg, visualPrompt: visualPrompt, isGeneratingImage: false };
            scenesRef.current = updatedScenes;
            setScenes(updatedScenes);
            triggerDownload(fullImg, `Ep${String(currentEpisodeIndex+1).padStart(3, '0')}-S${String(index+1).padStart(3, '0')}-Regen.png`); 
            if (currentUser) incrementUsage(currentUser.username, ModuleType.STORY_CREATOR);
            
            if (storyStructure && storyId) {
                const updatedStructure = { ...storyStructure, episodes: storyStructure.episodes.map((ep: any, idx: number) => idx === currentEpisodeIndex ? { ...ep, scenes: updatedScenes } : ep) };
                setStoryStructure(updatedStructure);
                await saveItem({ 
                    id: storyId, 
                    type: 'story', 
                    prompt: `Story: ${updatedStructure.title}`, 
                    createdAt: Date.now(), 
                    textContent: JSON.stringify(updatedStructure), 
                    meta: { 
                        episodeIndex: currentEpisodeIndex, 
                        voiceMap, 
                        aspectRatio, 
                        textMode, 
                        isSilentMode, 
                        visualStyleId: visualStyle.id, 
                        quality, 
                        sourceModule: ModuleType.STORY_CREATOR, 
                        targetMarket, 
                        durationValue, durationUnit, retentionStrategy, narrativeFramework, ctaStrategy, openingHook,
                        selectedCameraIds: Array.from(selectedCameraIds),
                        genreId: selectedGenre.id,
                        mood: selectedMood,
                        ideaContext: ideaContext
                    } 
                }); 
            }
        } catch (e) {
            addToast("Lỗi", `Không thể vẽ cảnh ${index + 1}`, "error");
            const failedScenes = [...scenesRef.current];
            failedScenes[index].isGeneratingImage = false;
            setScenes(failedScenes);
        } finally { setGlobalProcessing?.(false); }
    };

    const processSequentialGeneration = async (startIndex: number, currentScenes: VideoScene[], structure: StoryStructure) => {
        let previousGeneratedImageB64: string | null = null;
        let retryCount = 0;
        const locationAnchors: Record<string, string> = {}; // Store first image of each location to maintain consistency
        const totalScenes = scenesRef.current.length; 
        
        setIsGeneratingScenes(true); // Ensure global generation state

        for (let i = startIndex; i < totalScenes; i++) {
            if (isPausedRef.current) { setCurrentProcessingIndex(i); setIsProcessingPaused(true); break; }
            
            const latestScene = scenesRef.current[i];
            
            // Skip already generated, but update context for next
            if (latestScene.generatedImage) {
                previousGeneratedImageB64 = latestScene.generatedImage.split(',')[1];
                if (latestScene.locationTag && !locationAnchors[latestScene.locationTag]) { locationAnchors[latestScene.locationTag] = previousGeneratedImageB64; }
                continue;
            }
            
            // Mark current as generating
            const uiScenes = [...scenesRef.current];
            uiScenes[i].isGeneratingImage = true;
            setScenes(uiScenes); 
            setCurrentProcessingIndex(i);
            
            try {
                let visualPrompt = latestScene.visualPrompt.replace(/[\r\n]+/g, ' ').trim();
                const charNameInScript = latestScene.character;
                const locationTag = latestScene.locationTag;
                
                // --- CONTEXT & BACKGROUND LOGIC ---
                let refImageForGeneration = previousGeneratedImageB64;
                let narrativeContext = "";

                // Strategy 1: Use specific location anchor if available
                if (locationTag && locationAnchors[locationTag]) { 
                    refImageForGeneration = locationAnchors[locationTag]; 
                    narrativeContext += ` [LOCATION CONSISTENCY]: Return to the exact same location '${locationTag}' as seen in the reference image.`;
                } else if (previousGeneratedImageB64) {
                    // Strategy 2: Use direct previous image for continuity
                    refImageForGeneration = previousGeneratedImageB64;
                    // Look back at previous scene details
                    if (i > 0) {
                        const prevScene = scenesRef.current[i-1];
                        narrativeContext += ` [CONTINUITY]: This scene follows immediately after the previous one. Previous action was: "${prevScene.visualPrompt}". Maintain consistent lighting, art style, and background environment.`;
                        if (locationTag && prevScene.locationTag === locationTag) {
                             narrativeContext += ` Keep strictly in the same '${locationTag}' setting.`;
                        }
                    }
                } else {
                    refImageForGeneration = null; // Start fresh if no history
                }
                
                // --- CHARACTER LOGIC ---
                let matchedCharacterItem = findStrictMatchCharacter(charNameInScript || "", selectedCharIds, availableChars);
                if (!matchedCharacterItem && selectedCharIds.size > 0) {
                     // Attempt fuzzy match
                     const foundId = Array.from(selectedCharIds).find(id => { const c = availableChars.find(char => char.id === id); return c && visualPrompt.toLowerCase().includes(c.prompt.toLowerCase()); });
                     if (foundId) matchedCharacterItem = availableChars.find(c => c.id === foundId) || null;
                     // Fallback to first cast member if user selected casting but script name doesn't match
                     if (!matchedCharacterItem) { const firstId = Array.from(selectedCharIds)[0]; matchedCharacterItem = availableChars.find(c => c.id === firstId) || null; }
                }
                
                const charB64 = matchedCharacterItem?.base64Data ? matchedCharacterItem.base64Data.split(',')[1] : null;
                if (matchedCharacterItem) { 
                    visualPrompt = `[Character Reference: ${matchedCharacterItem.prompt}]. Maintain strict facial features and outfit from reference. ${visualPrompt}`; 
                }
                
                // --- PHYSICAL CONSISTENCY CONSTRAINT ---
                const physicsConstraint = `
                    [IMPORTANT CONSTRAINT: PHYSICAL CONSISTENCY]
                    1. Maintain absolute character height, weight, and body proportions relative to the environment.
                    2. Objects must strictly adhere to real-world physics scaling (e.g., a table must be waist-height, not tiny).
                    3. Do not morph, shrink, or grow the character between scenes.
                    4. Keep facial features identical to the reference.
                    5. Aspect Ratio Target: ${aspectRatio}.
                `;

                // Combine prompt
                const finalFullPrompt = `${visualPrompt}. ${narrativeContext}. ${physicsConstraint}`;

                const b64 = await generateVeoSceneImage(
                    finalFullPrompt, 
                    charB64, 
                    null, 
                    aspectRatio, 
                    'Story Scene', 
                    i, 
                    refImageForGeneration, 
                    quality
                );
                const fullImg = `data:image/png;base64,${b64}`;
                
                const updatedScenes = [...scenesRef.current];
                updatedScenes[i] = { ...updatedScenes[i], visualPrompt: visualPrompt, generatedImage: fullImg, isGeneratingImage: false };
                scenesRef.current = updatedScenes;
                setScenes(updatedScenes); 
                
                previousGeneratedImageB64 = b64;
                // Save anchor if new location
                if (locationTag && !locationAnchors[locationTag]) { locationAnchors[locationTag] = b64; }
                
                retryCount = 0; 
                triggerDownload(fullImg, `Ep${String(currentEpisodeIndex+1).padStart(3, '0')}-S${String(i+1).padStart(3, '0')}.png`); 
                
                const newStruct = { ...structure, episodes: structure.episodes.map((ep, idx) => idx === currentEpisodeIndex ? { ...ep, scenes: updatedScenes } : ep) };
                setStoryStructure(newStruct);
                
                if (storyId) { await saveItem({ 
                    id: storyId, 
                    type: 'story', 
                    prompt: `Story: ${newStruct.title}`, 
                    createdAt: Date.now(), 
                    textContent: JSON.stringify(newStruct), 
                    meta: { 
                        episodeIndex: currentEpisodeIndex, 
                        voiceMap, aspectRatio, textMode, isSilentMode, visualStyleId: visualStyle.id, quality, sourceModule: ModuleType.STORY_CREATOR, targetMarket, durationValue, durationUnit, retentionStrategy, narrativeFramework, ctaStrategy, openingHook, selectedCameraIds: Array.from(selectedCameraIds),
                        genreId: selectedGenre.id,
                        mood: selectedMood,
                        ideaContext: ideaContext
                    } 
                }); }
            
            } catch (e: any) {
                if (isPausedRef.current) { const pausedScenes = [...scenesRef.current]; pausedScenes[i].isGeneratingImage = false; setScenes(pausedScenes); return; }
                retryCount++;
                if (retryCount > 3) {
                    addToast("Bỏ qua", `Cảnh ${i+1} lỗi.`, "error");
                    const skipScenes = [...scenesRef.current]; skipScenes[i].isGeneratingImage = false; scenesRef.current = skipScenes; setScenes(skipScenes); retryCount = 0; continue; 
                }
                addToast("Thử lại", `Cảnh ${i+1} (Lần ${retryCount}/3)...`, "warning");
                await new Promise(r => setTimeout(r, 4000)); i--; continue; 
            }
        }
        if (!isPausedRef.current && previousGeneratedImageB64) { setIsGeneratingEnding(true); await handleGenerateEnding(previousGeneratedImageB64); }
        if (!isPausedRef.current) { setIsGeneratingScenes(false); setGlobalProcessing?.(false); addToast("Hoàn tất", "Xong tập phim!", "success"); }
    };

    const handleResumeSequence = (startIndex: number) => {
        if (isGlobalProcessing && !isGeneratingScenes) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }
        if (!storyStructure) return;
        
        isPausedRef.current = false;
        setIsProcessingPaused(false);
        setGlobalProcessing?.(true);
        addToast("Resume Auto-Film", `Tiếp tục tự động quay từ cảnh ${startIndex + 1}...`, "info");
        
        processSequentialGeneration(startIndex, scenes, storyStructure);
    }

    const handleGenerateSEO = async () => { if (!storyStructure) return; if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; } setGlobalProcessing?.(true); try { const ep = storyStructure.episodes[currentEpisodeIndex]; const res = await generateYouTubeSEO(ep.title, ep.summary, MARKET_CONFIG[targetMarket].lang, MARKET_CONFIG[targetMarket].label); setSeoData(res); const updatedStructure = { ...storyStructure }; updatedStructure.episodes[currentEpisodeIndex].seoData = res; setStoryStructure(updatedStructure); if (storyId) { await saveItem({ id: storyId, type: 'story', prompt: `Story: ${updatedStructure.title}`, createdAt: Date.now(), textContent: JSON.stringify(updatedStructure), meta: { episodeIndex: currentEpisodeIndex, voiceMap, aspectRatio, textMode, isSilentMode, visualStyleId: visualStyle.id, quality, sourceModule: ModuleType.STORY_CREATOR, targetMarket, durationValue, durationUnit, retentionStrategy, narrativeFramework, ctaStrategy, openingHook, selectedCameraIds: Array.from(selectedCameraIds), genreId: selectedGenre.id, mood: selectedMood, ideaContext: ideaContext } }); } } catch (e) { addToast("Lỗi SEO", "Thất bại.", "error"); } finally { setGlobalProcessing?.(false); } };
    const handleGenerateEnding = async (prevImageRef?: string) => { if (isGlobalProcessing && !isGeneratingEnding) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; } if (currentUser) { const check = checkUsageLimit(currentUser.username, ModuleType.STORY_CREATOR); if (!check.allowed) { addToast("Hết điểm", check.message, "error"); return; } } setIsGeneratingEnding(true); setGlobalProcessing?.(true); try { let matchedCharacterItem = null; if (selectedCharIds.size > 0) { const firstId = Array.from(selectedCharIds)[0]; matchedCharacterItem = availableChars.find(c => c.id === firstId) || null; } let endingPrompt = `YouTube Outro Screen: A large, glossy Red 'SUBSCRIBE' button and a Golden 'Notification Bell' icon in the center. High-quality 3D render, 8k resolution. Background: Cinematic atmosphere matching ${visualStyle.prompt}`; if (matchedCharacterItem) { endingPrompt = `[Character Reference: ${matchedCharacterItem.prompt}]. The character stands next to a large 'SUBSCRIBE' button and a 'Bell' icon. ${endingPrompt}. Maintain facial features.`; } const charB64 = matchedCharacterItem?.base64Data ? matchedCharacterItem.base64Data.split(',')[1] : null; let refImage = prevImageRef; if (!refImage && scenes.length > 0) { const lastScene = scenes[scenes.length - 1]; if (lastScene.generatedImage) refImage = lastScene.generatedImage.split(',')[1]; } const b64 = await generateVeoSceneImage(endingPrompt, charB64, null, aspectRatio, 'Ending Scene', 999, refImage || null, quality); const fullImg = `data:image/png;base64,${b64}`; const updatedStructure = { ...storyStructure }; updatedStructure.episodes = [...updatedStructure.episodes]; updatedStructure.episodes[currentEpisodeIndex] = { ...updatedStructure.episodes[currentEpisodeIndex], endingImage: fullImg }; setStoryStructure(updatedStructure); if (storyId) { await saveItem({ id: storyId, type: 'story', prompt: `Story: ${updatedStructure.title}`, createdAt: Date.now(), textContent: JSON.stringify(updatedStructure), meta: { episodeIndex: currentEpisodeIndex, voiceMap, aspectRatio, textMode, isSilentMode, visualStyleId: visualStyle.id, quality, sourceModule: ModuleType.STORY_CREATOR, targetMarket, durationValue, durationUnit, retentionStrategy, narrativeFramework, ctaStrategy, openingHook, selectedCameraIds: Array.from(selectedCameraIds), genreId: selectedGenre.id, mood: selectedMood, ideaContext: ideaContext } }); } triggerDownload(fullImg, `Ep${String(currentEpisodeIndex+1).padStart(3, '0')}-Ending.png`); if (currentUser) incrementUsage(currentUser.username, ModuleType.STORY_CREATOR); addToast("Thành công", "Đã tạo cảnh kết thúc!", "success"); } catch (e) { addToast("Lỗi", "Thất bại.", "error"); } finally { setIsGeneratingEnding(false); setGlobalProcessing?.(false); } };
    const handleResumeGeneration = () => { if (storyStructure && scenes.length > 0) { setIsProcessingPaused(false); const nextIndex = scenes.findIndex(s => !s.generatedImage); if (nextIndex !== -1) { processSequentialGeneration(nextIndex, scenes, storyStructure); } else { addToast("Thông báo", "Đã xong toàn bộ.", "info"); } } };
    const handleAutoFilm = async () => { if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; } if (!storyStructure || scenes.length === 0) return; isPausedRef.current = false; setIsProcessingPaused(false); const startIndex = scenes.findIndex(s => !s.generatedImage); if (startIndex === -1) { const ep = storyStructure.episodes[currentEpisodeIndex] as any; if (!ep.endingImage) { handleGenerateEnding(); return; } addToast("Hoàn tất", "Xong toàn bộ.", "success"); return; } const count = scenes.length - startIndex; if (currentUser) { const check = checkUsageLimit(currentUser.username, ModuleType.STORY_CREATOR, count); if (!check.allowed) { addToast("Hết điểm", check.message, "error"); return; } } processSequentialGeneration(startIndex, scenes, storyStructure); };
    const copyScriptToClipboard = () => { const text = scenes.map((s, i) => { const cleanVisual = s.visualPrompt.replace(/[\r\n]+/g, ' ').trim(); const cleanDialogue = s.voiceover ? s.voiceover.replace(/[\r\n]+/g, ' ').trim() : "..."; const charName = s.character || "Narrator"; const voiceInfo = voiceMap[charName] || "Default Voice"; return `Scene ${i+1}: Visual: ${cleanVisual}. Audio: (${charName}): "${cleanDialogue}"`; }).join('\n'); navigator.clipboard.writeText(text); addToast("Copy", "Đã copy vào clipboard.", "success"); };
    const handleManualSave = async () => { if (storyId && storyStructure) { await saveItem({ id: storyId, type: 'story', prompt: `Story: ${storyStructure.title}`, createdAt: Date.now(), textContent: JSON.stringify(storyStructure), meta: { episodeIndex: currentEpisodeIndex, voiceMap, aspectRatio, textMode, isSilentMode, visualStyleId: visualStyle.id, quality, sourceModule: ModuleType.STORY_CREATOR, targetMarket, durationValue, durationUnit, retentionStrategy, narrativeFramework, ctaStrategy, openingHook, selectedCameraIds: Array.from(selectedCameraIds), genreId: selectedGenre.id, mood: selectedMood, ideaContext: ideaContext } }); addToast("Đã lưu", "Tiến độ đã lưu.", "success"); } };
    const handleGenerateEpisodeThumbnail = async () => { if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; } if (currentUser) { const check = checkUsageLimit(currentUser.username, ModuleType.THUMBNAIL); if (!check.allowed) { addToast("Hết điểm", check.message, "error"); return; } } setGlobalProcessing?.(true); try { const ep = storyStructure.episodes[currentEpisodeIndex]; let refImageB64 = undefined; if (thumbRefSceneIndex >= 0 && scenes[thumbRefSceneIndex]?.generatedImage) { refImageB64 = scenes[thumbRefSceneIndex].generatedImage!.split(',')[1]; } else if (thumbRefSceneIndex === -1 && selectedCharIds.size > 0) { const charId = Array.from(selectedCharIds)[0]; const char = availableChars.find(c => c.id === charId); if (char?.base64Data) refImageB64 = char.base64Data.split(',')[1]; } const styleDesc = `Style: ${thumbStyle}. Emotion: ${thumbEmotion}.`; const b64 = await generateStoryThumbnail(storyStructure.title, ep.episodeNumber, ep.title, ep.summary, thumbLayout, MARKET_CONFIG[targetMarket].lang, aspectRatio, thumbHookText, styleDesc, refImageB64); const fullImg = `data:image/png;base64,${b64}`; const updatedStructure = { ...storyStructure }; updatedStructure.episodes[currentEpisodeIndex].thumbnail = fullImg; setStoryStructure(updatedStructure); if (storyId) { await saveItem({ id: storyId, type: 'story', prompt: `Story: ${updatedStructure.title}`, createdAt: Date.now(), textContent: JSON.stringify(updatedStructure), meta: { episodeIndex: currentEpisodeIndex, voiceMap, aspectRatio, textMode, isSilentMode, visualStyleId: visualStyle.id, quality, sourceModule: ModuleType.STORY_CREATOR, targetMarket, durationValue, durationUnit, retentionStrategy, narrativeFramework, ctaStrategy, openingHook, selectedCameraIds: Array.from(selectedCameraIds), genreId: selectedGenre.id, mood: selectedMood, ideaContext: ideaContext } }); } triggerDownload(fullImg, `Thumbnail-Ep${String(ep.episodeNumber).padStart(3, '0')}.png`); if (currentUser) incrementUsage(currentUser.username, ModuleType.THUMBNAIL); addToast("Thành công", "Đã tạo Thumbnail!", "success"); } catch (e: any) { addToast("Lỗi", "Thất bại.", "error"); } finally { setGlobalProcessing?.(false); } };
    const handleUpdateSceneText = (index: number, field: keyof VideoScene, value: string) => { const updatedScenes = [...scenes]; updatedScenes[index] = { ...updatedScenes[index], [field]: value }; setScenes(updatedScenes); scenesRef.current = updatedScenes; };
    const renderSEOCard = (title: string, content: string | string[], icon: React.ReactNode, textColor: string) => ( <div className="bg-zinc-950/50 p-3 rounded-xl border border-white/10 relative group hover:border-emerald-500/30 transition-colors"> <div className="flex justify-between mb-1"> <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${textColor}`}>{icon} {title}</span> <button onClick={() => { const text = Array.isArray(content) ? content.join(' ') : content; navigator.clipboard.writeText(text); addToast("Copy", "Đã sao chép", "info"); }} className="text-zinc-500 hover:text-white"><Copy size={10}/></button> </div> {Array.isArray(content) ? ( <div className="flex flex-wrap gap-1">{content.map((tag, i) => (<span key={i} className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700">{tag}</span>))}</div> ) : ( <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{content}</p> )} </div> );

    return (
        <div className="flex flex-col lg:flex-row h-full w-full p-4 lg:p-6 gap-6 lg:gap-8">
            <div className="w-full lg:w-[420px] flex flex-col gap-6 shrink-0 h-auto lg:h-full lg:overflow-y-auto custom-scrollbar pb-20 lg:pb-0">
                {/* ... (Existing Char Panel Code) ... */}
                <div className="bg-zinc-900/60 border border-emerald-500/20 rounded-2xl p-4 shadow-lg">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-2"><Users size={12}/> Diễn viên Chính (Casting)</h3>
                        <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-[10px] text-white rounded px-2 py-1 outline-none">
                            {folders.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x">
                        {filteredChars.length > 0 ? filteredChars.map(char => (
                            <div key={char.id} onClick={() => toggleCharSelection(char.id)} className={`relative w-14 h-14 shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-all group snap-start ${selectedCharIds.has(char.id) ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-zinc-800 hover:border-zinc-600 grayscale hover:grayscale-0'}`} title={char.prompt}>
                                <img src={char.base64Data?.startsWith('data:') ? char.base64Data : `data:image/png;base64,${char.base64Data}`} className="w-full h-full object-cover"/>
                                {selectedCharIds.has(char.id) && <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center"><CheckCircle size={12} className="text-white drop-shadow"/></div>}
                            </div>
                        )) : <div className="text-zinc-600 text-[10px] italic py-2">Chưa có nhân vật nào trong thư viện.</div>}
                    </div>
                </div>

                {/* ... (Existing Step Indicator) ... */}
                <div className="space-y-4">
                    <div className="pb-2 border-b border-white/5">
                        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 mb-1 tracking-tight">Story Architect</h2>
                        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Writers' Room & Production Studio</p>
                    </div>
                    <div className="bg-zinc-900/50 p-1 rounded-full flex relative">
                        <div className="absolute top-1 bottom-1 left-1 bg-emerald-600 rounded-full transition-all duration-500 opacity-20" style={{ width: `${(step / 4) * 100}%` }}></div>
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} onClick={() => s < step && setStep(s as any)} className={`flex-1 text-center py-2 text-[10px] font-bold uppercase tracking-wider relative z-10 cursor-pointer transition-colors ${step === s ? 'text-white' : step > s ? 'text-emerald-400' : 'text-zinc-600'}`}>
                                {s === 1 && "Idea"} {s === 2 && "Concept"} {s === 3 && "Plan"} {s === 4 && "Film"}
                            </div>
                        ))}
                    </div>
                </div>

                {step !== 4 && (
                    <div className="space-y-5 animate-in fade-in">
                        {step === 1 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-left-4">
                                {savedStories.length > 0 && (
                                    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4">
                                        <h3 className="text-[10px] font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2"><Folder size={12}/> Dự án đã lưu</h3>
                                        <div className="max-h-[100px] overflow-y-auto custom-scrollbar space-y-2">
                                            {savedStories.map(story => (
                                                <button key={story.id} onClick={() => handleLoadStory(story)} className="w-full text-left p-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 transition-colors text-xs text-white truncate flex items-center gap-2">
                                                    <BookOpen size={12} className="text-emerald-500 shrink-0"/>{story.prompt.replace('Story: ', '')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Thị trường mục tiêu</label>
                                        <select value={targetMarket} onChange={e => setTargetMarket(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white mb-2">
                                            {Object.entries(MARKET_CONFIG).map(([key, config]) => ( <option key={key} value={key}>{config.label}</option> ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Thể loại (Genre)</label>
                                        <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                                            {STORY_GENRES.map(g => ( <button key={g.id} onClick={() => setSelectedGenre(g)} className={`text-[10px] p-2 rounded border text-left transition-all ${selectedGenre.id === g.id ? 'bg-emerald-900/30 border-emerald-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'}`}>{g.icon} {g.label}</button> ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Mood & Idea</label>
                                        <select value={selectedMood} onChange={e => setSelectedMood(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white mb-2">
                                            {STORY_MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <input type="text" value={ideaContext} onChange={e => setIdeaContext(e.target.value)} placeholder="Nhập ý tưởng sơ bộ..." className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white"/>
                                    </div>
                                </div>
                                <button onClick={handleGenerateIdeas} disabled={isThinking} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                                    {isThinking ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>} Brainstorm Ideas
                                </button>
                            </div>
                        )}
                        {/* ... Step 2 unchanged ... */}
                        {step === 2 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                                    <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Chọn Kịch Bản</h3>
                                    <div className="space-y-3">
                                        {ideas.map((idea, idx) => (
                                            <div key={idx} onClick={() => setSelectedIdea(idea)} className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedIdea === idea ? 'bg-emerald-900/30 border-emerald-500' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'}`}>
                                                <div className="flex justify-between mb-1">
                                                    <span className="font-bold text-white text-sm">{idea.title}</span>
                                                    <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded text-zinc-300">{idea.mood}</span>
                                                </div>
                                                <p className="text-xs text-zinc-400 leading-relaxed">{idea.premise}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Số tập</label>
                                        <input type="number" value={episodeCount} onChange={e => setEpisodeCount(parseInt(e.target.value)||1)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white"/>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Tỷ lệ</label>
                                        <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white">
                                            {RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button onClick={handleGenerateStructure} disabled={isThinking || !selectedIdea} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                                    {isThinking ? <Loader2 size={18} className="animate-spin"/> : <LayoutTemplate size={18}/>} Lên Khung Kịch Bản
                                </button>
                            </div>
                        )}
                        {step === 3 && storyStructure && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5">
                                    {/* ... Existing Story Title/Summary ... */}
                                    <h3 className="text-lg font-bold text-white mb-1">{storyStructure.title}</h3>
                                    <p className="text-xs text-zinc-400 mb-2 line-clamp-2">{storyStructure.summary}</p>
                                    
                                    {/* NEW: CONCEPT SUMMARY BADGES */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        <span className="text-[9px] font-bold bg-zinc-800 text-zinc-300 px-2 py-1 rounded border border-zinc-700 uppercase">Aspect Ratio: {aspectRatio}</span>
                                        <span className="text-[9px] font-bold bg-zinc-800 text-zinc-300 px-2 py-1 rounded border border-zinc-700 uppercase">Genre: {selectedGenre.label.split('(')[0]}</span>
                                        <span className="text-[9px] font-bold bg-zinc-800 text-zinc-300 px-2 py-1 rounded border border-zinc-700 uppercase">Mood: {selectedMood.split('(')[0]}</span>
                                    </div>
                                    
                                    <div className="mb-4 space-y-2">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1"><Palette size={10}/> Visual Style (Quan trọng)</label>
                                        <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                                            {VISUAL_STYLES.map(style => ( <button key={style.id} onClick={() => setVisualStyle(style)} className={`text-[9px] p-2 rounded border text-left ${visualStyle.id === style.id ? 'bg-indigo-900/30 border-indigo-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}>{style.label}</button> ))}
                                        </div>
                                    </div>

                                    {/* CINEMATIC CAMERA DROPDOWN */}
                                    <div className="mb-4 relative" ref={cameraRef}>
                                        <label className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1 mb-1.5"><Camera size={12}/> Thiết lập Góc quay (Camera Angles)</label>
                                        <button 
                                            onClick={() => setIsCameraDropdownOpen(!isCameraDropdownOpen)}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white flex justify-between items-center hover:border-indigo-500 transition-colors"
                                        >
                                            <span className="truncate">
                                                {selectedCameraIds.has('default') 
                                                    ? 'Mặc định (AI Tự quyết định)' 
                                                    : `Đã chọn ${selectedCameraIds.size} góc quay`}
                                            </span>
                                            <ChevronDown size={14} className={`transition-transform ${isCameraDropdownOpen ? 'rotate-180' : ''}`}/>
                                        </button>
                                        
                                        {isCameraDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 max-h-[250px] overflow-y-auto custom-scrollbar p-2 animate-in slide-in-from-top-2">
                                                <div className="grid grid-cols-1 gap-1">
                                                    {CAMERA_ANGLES.map(angle => (
                                                        <div 
                                                            key={angle.id}
                                                            onClick={() => toggleCameraId(angle.id)}
                                                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedCameraIds.has(angle.id) ? 'bg-indigo-600/20 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}
                                                        >
                                                            {selectedCameraIds.has(angle.id) ? <CheckSquare size={14} className="text-indigo-400"/> : <Square size={14} className="text-zinc-600"/>}
                                                            <div className="min-w-0">
                                                                <div className="text-[10px] font-bold">{angle.label}</div>
                                                                <div className="text-[8px] opacity-60 truncate">{angle.prompt.split('.')[0]}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mb-4 p-3 bg-indigo-900/10 border border-indigo-500/20 rounded-xl space-y-2">
                                        <label className="text-[10px] font-bold text-indigo-400 uppercase flex items-center gap-1"><Clapperboard size={12}/> Director Settings</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            <label className="flex items-center gap-2 px-2 py-2 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors">
                                                <input type="checkbox" checked={autoEnhance} onChange={e => setAutoEnhance(e.target.checked)} className="rounded bg-zinc-800 text-indigo-500 border-zinc-700"/>
                                                <span className="text-[10px] text-white flex items-center gap-1 font-bold"><Wand2 size={12} className="text-indigo-400"/> Auto-Enhance Prompts & Transitions</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-900">
                                            <input type="checkbox" checked={isSilentMode} onChange={e => setIsSilentMode(e.target.checked)} className="rounded bg-zinc-800 border-zinc-600 text-emerald-500"/>
                                            <span className="flex-1 text-xs text-white font-bold flex items-center gap-2">
                                                {isSilentMode ? <VolumeX size={14} className="text-orange-400"/> : <Volume2 size={14} className="text-emerald-400"/>} Chế độ Không Lời Thoại (Ambient/Silent)
                                            </span>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Thời lượng/Tập (Max 120m)</label>
                                            <div className="flex gap-1">
                                                <input type="number" value={durationValue} onChange={e => setDurationValue(Math.max(1, parseInt(e.target.value)))} className="w-16 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white text-center"/>
                                                <select value={durationUnit} onChange={e => setDurationUnit(e.target.value as any)} className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white">
                                                    <option value="seconds">Giây (Sec)</option>
                                                    <option value="minutes">Phút (Min)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Chất lượng ảnh</label>
                                            <select value={quality} onChange={e => setQuality(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white">
                                                {QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mb-4 space-y-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                                        {/* NEW: OPENING HOOK SELECTION */}
                                        <div>
                                            <label className="text-[10px] font-bold text-emerald-400 uppercase block mb-1 flex items-center gap-1"><Zap size={10}/> Mở đầu lôi cuốn (Hook - Cảnh 1)</label>
                                            <select value={openingHook} onChange={e => setOpeningHook(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white outline-none focus:border-emerald-500">
                                                {OPENING_HOOKS.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-amber-500 uppercase block mb-1 flex items-center gap-1"><Timer size={10}/> Nhịp điệu & Giữ chân (Retention)</label>
                                            <select value={retentionStrategy} onChange={e => setRetentionStrategy(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white outline-none focus:border-amber-500">
                                                {RETENTION_STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                            </select>
                                        </div>
                                        
                                        <div>
                                            <label className="text-[10px] font-bold text-red-400 uppercase block mb-1 flex items-center gap-1"><MousePointerClick size={10}/> Tương tác Bấm nút (CTA Interaction)</label>
                                            <select value={ctaStrategy} onChange={e => setCtaStrategy(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white outline-none focus:border-red-500">
                                                {CTA_STRATEGIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-purple-400 uppercase block mb-1 flex items-center gap-1"><BrainCircuit size={10}/> Khung Cấu trúc Kể chuyện</label>
                                            <select value={narrativeFramework} onChange={e => setNarrativeFramework(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white outline-none focus:border-purple-500">
                                                {NARRATIVE_FRAMEWORKS.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* ... Existing Episode Selector ... */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center"><label className="text-[10px] font-bold text-zinc-500 uppercase">Chọn Tập</label>
                                            <button onClick={() => setShowEpisodeReview(true)} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-white px-2 py-1 rounded flex items-center gap-1 border border-zinc-700"><List size={12}/> Danh sách tập</button>
                                        </div>
                                        <select value={currentEpisodeIndex} onChange={e => setCurrentEpisodeIndex(parseInt(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white">
                                            {storyStructure.episodes.map((ep: any, idx: number) => <option key={idx} value={idx}>Tập {ep.episodeNumber}: {ep.title}</option>)}
                                        </select>
                                    </div>
                                </div>
                                
                                {/* ... Existing Casting Box ... */}
                                {!isSilentMode && (
                                    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2"><Globe size={12}/> Casting Giọng ({MARKET_CONFIG[targetMarket].label})</label>
                                            <button onClick={handleAutoCastVoices} disabled={isThinking} className="text-[10px] text-emerald-400 hover:text-emerald-300">Auto AI</button>
                                        </div>
                                        <div className="space-y-2 max-h-[100px] overflow-y-auto custom-scrollbar">
                                            {Array.from(selectedCharIds).map(id => {
                                                const char = availableChars.find(c => c.id === id);
                                                if(!char) return null;
                                                return (
                                                    <div key={id} className="flex items-center gap-2">
                                                        <img src={char.base64Data?.startsWith('data:') ? char.base64Data : `data:image/png;base64,${char.base64Data}`} className="w-5 h-5 rounded-full object-cover"/>
                                                        <span className="text-[10px] text-zinc-300 w-16 truncate">{char.prompt}</span>
                                                        <select value={voiceMap[char.prompt]||''} onChange={e => setVoiceMap({...voiceMap, [char.prompt]: e.target.value})} className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-1 text-[9px] text-white">
                                                            <option value="">Chọn giọng...</option>
                                                            {MARKET_CONFIG[targetMarket].voices.map(v => <option key={v} value={v}>{v}</option>)}
                                                        </select>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                                {isProcessingPaused ? (
                                    <button onClick={handleResumeSequence} className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg animate-pulse"><Play size={18}/> Tiếp tục (Resume)</button>
                                ) : (
                                    <button onClick={handleGenerateScenes} disabled={isGeneratingScenes || (isGlobalProcessing && !isGeneratingScenes)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                                        {isGeneratingScenes ? "Đang sản xuất..." : (isGlobalProcessing && !isGeneratingScenes) ? "Hệ thống đang bận..." : <><Clapperboard size={18}/> Sản Xuất Tập Phim</>}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {step === 4 && (
                    <button onClick={() => setStep(3)} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold flex items-center justify-center gap-2"><ChevronLeft size={16}/> Quay lại Cấu trúc</button>
                )}
            </div>

            {/* ... Rest of Main Content & Modals (unchanged) ... */}
            <div className="flex-1 bg-zinc-900/20 rounded-3xl border border-white/5 p-4 lg:p-6 flex flex-col backdrop-blur-sm min-h-[400px] lg:h-full lg:min-h-0 overflow-hidden">
                {step === 4 && scenes.length > 0 ? (
                    <div className="flex flex-col h-full">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 pb-4 border-b border-white/5 gap-3">
                            <div>
                                <h3 className="text-xl font-bold text-white">Tập {storyStructure?.episodes[currentEpisodeIndex]?.episodeNumber}: {storyStructure?.episodes[currentEpisodeIndex]?.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-zinc-500">Style: <span className="text-indigo-400">{visualStyle.label}</span></p>
                                    <div className="h-3 w-px bg-zinc-800"></div>
                                    <span className="text-xs text-zinc-500">
                                        Camera: <span className="text-white">
                                            {selectedCameraIds.has('default') ? 'Mặc định' : `${selectedCameraIds.size} Angles Selected`}
                                        </span>
                                    </span>
                                </div>
                            </div>
                            {/* ... Buttons ... */}
                            <div className="flex gap-2 items-center flex-wrap">
                                <button onClick={() => setShowThumbConfig(!showThumbConfig)} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all ${showThumbConfig ? 'bg-zinc-800 border-red-500 text-white border' : 'bg-red-600 hover:bg-red-500 text-white'}`} title="Mở cấu hình Thumbnail Viral">
                                    <MonitorPlay size={14}/> Thumbnail Studio
                                </button>
                                <button onClick={handleAutoFilm} disabled={isGlobalProcessing || isGeneratingScenes} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition-all" title="Tự động tạo ảnh"><VideoIcon size={14}/> Quay toàn bộ (Auto-Film)</button>
                                <button onClick={() => handleGenerateEnding()} disabled={isGlobalProcessing} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition-all" title="Tạo ảnh kết thúc"><Flag size={14}/> Ending Shot</button>
                                <button onClick={copyScriptToClipboard} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 border border-white/5"><Copy size={14}/> Copy Script</button>
                                <button onClick={handleManualSave} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg"><Save size={14}/> Lưu</button>
                            </div>
                        </div>

                        {/* ... Rest of Scene Rendering ... */}
                        {showThumbConfig && (
                            <div className="mb-4 bg-zinc-950/80 border border-red-900/30 rounded-xl p-4 animate-in slide-in-from-top-4 space-y-4">
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 w-full space-y-3">
                                        <div className="flex items-center gap-2 mb-1"><MonitorPlay size={16} className="text-red-500"/><h4 className="text-sm font-bold text-white uppercase tracking-wider">Viral Thumbnail Studio</h4></div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <div><label className="text-[10px] text-zinc-500 font-bold block mb-1">Layout</label><select value={thumbLayout} onChange={(e) => setThumbLayout(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white outline-none">{THUMB_LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></div>
                                            <div><label className="text-[10px] text-zinc-500 font-bold block mb-1">Style (Viral)</label><select value={thumbStyle} onChange={(e) => setThumbStyle(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white outline-none">{YT_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                                            <div><label className="text-[10px] text-zinc-500 font-bold block mb-1">Cảm xúc</label><select value={thumbEmotion} onChange={(e) => setThumbEmotion(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white outline-none">{YT_EMOTIONS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}</select></div>
                                            <div><label className="text-[10px] text-zinc-500 font-bold block mb-1">Ngôn ngữ Text</label><select value={thumbTextLang} onChange={(e) => setThumbTextLang(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white outline-none">{THUMB_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                                        </div>
                                        <div><label className="text-[10px] text-zinc-500 font-bold block mb-1">Hook Text (Clickbait)</label><div className="relative"><Type size={14} className="absolute left-3 top-2.5 text-zinc-500"/><input type="text" value={thumbHookText} onChange={e => setThumbHookText(e.target.value)} placeholder="VD: SỰ THẬT SỐC!..." className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white font-bold placeholder-zinc-600 focus:border-red-500 outline-none"/></div></div>
                                    </div>
                                    <div className="w-full md:w-auto"><button onClick={handleGenerateEpisodeThumbnail} disabled={isGlobalProcessing} className="w-full md:w-auto h-[40px] px-6 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 transition-all hover:scale-105 whitespace-nowrap">{isGlobalProcessing ? <Loader2 size={18} className="animate-spin"/> : <Wand2 size={18}/>}Tạo Thumbnail Viral</button></div>
                                </div>

                                {(storyStructure?.episodes[currentEpisodeIndex] as any)?.thumbnail && (
                                    <div className="pt-4 border-t border-red-900/30 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2 mb-3">
                                            <CheckCircle2 size={14} className="text-green-500"/>
                                            <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Kết quả Thumbnail</span>
                                        </div>
                                        <div className="relative w-full max-w-sm aspect-video rounded-xl overflow-hidden border border-zinc-700 shadow-xl group bg-black/50">
                                            <img 
                                                src={(storyStructure.episodes[currentEpisodeIndex] as any).thumbnail} 
                                                className="w-full h-full object-cover" 
                                                onClick={() => setPreviewImage((storyStructure.episodes[currentEpisodeIndex] as any).thumbnail)}
                                            />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                                                <button 
                                                    onClick={() => triggerDownload((storyStructure.episodes[currentEpisodeIndex] as any).thumbnail, `Thumbnail-Ep${String((storyStructure.episodes[currentEpisodeIndex] as any).episodeNumber).padStart(3, '0')}.png`)} 
                                                    className="p-2 bg-white text-black rounded-full hover:bg-zinc-200 transition-transform hover:scale-110 shadow-lg"
                                                    title="Tải xuống"
                                                >
                                                    <Download size={18}/>
                                                </button>
                                                <button 
                                                    onClick={() => setPreviewImage((storyStructure.episodes[currentEpisodeIndex] as any).thumbnail)} 
                                                    className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition-transform hover:scale-110 shadow-lg"
                                                    title="Xem chi tiết"
                                                >
                                                    <Maximize2 size={18}/>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2 scroll-smooth">
                            {seoData ? (
                                <div className="mb-6 animate-in slide-in-from-top-4">
                                    <div className="p-1.5 bg-gradient-to-r from-red-600/20 to-orange-600/20 rounded-xl border border-red-500/20">
                                        <div className="flex justify-between items-center px-2 py-1 mb-2">
                                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5"><TrendingUp size={12}/> YouTube SEO Optimization</span>
                                            <button onClick={handleGenerateSEO} className="text-[9px] text-zinc-400 hover:text-white flex items-center gap-1 bg-black/40 px-2 py-1 rounded hover:bg-black/60 transition-colors"><RefreshCw size={10}/> Làm mới SEO</button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {renderSEOCard("Tiêu đề Video", seoData.optimizedTitle, <LayoutTemplate size={12}/>, "text-white")}
                                            {renderSEOCard("Hashtags", seoData.hashtags.join(' '), <Hash size={12}/>, "text-blue-400")}
                                            {renderSEOCard("Mô tả Video", seoData.description, <AlignLeft size={12}/>, "text-zinc-300")}
                                            {renderSEOCard("Chiến lược Đăng bài", seoData.postingStrategy, <Send size={12}/>, "text-green-400")}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-6 flex justify-center">
                                    <button onClick={handleGenerateSEO} disabled={isGlobalProcessing} className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-red-900/20 transition-all hover:scale-105"><TrendingUp size={18}/> Tạo Bộ SEO & Chiến Lược Đăng Bài</button>
                                </div>
                            )}

                            {scenes.map((scene, idx) => (
                                <div key={idx} id={`scene-card-${idx}`} className={`bg-black/30 border rounded-2xl p-4 flex flex-col md:flex-row gap-4 transition-all duration-300 ${currentProcessingIndex === idx && isGeneratingScenes ? 'border-emerald-500/50 ring-1 ring-emerald-500/20 bg-emerald-900/5' : 'border-white/10 hover:border-white/20'}`}>
                                    <div className="w-full md:w-1/3 shrink-0">
                                        <div 
                                            className={`bg-black rounded-xl overflow-hidden border border-zinc-800 relative group flex items-center justify-center cursor-pointer ${aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'}`}
                                            onClick={() => {
                                                if (!scene.generatedImage && !isGeneratingScenes && !isGlobalProcessing) {
                                                    handleResumeSequence(idx);
                                                }
                                            }}
                                        >
                                            {scene.generatedImage ? (
                                                <>
                                                    <img src={scene.generatedImage} className="w-full h-full object-cover" onClick={() => setPreviewImage(scene.generatedImage!)} />
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); triggerDownload(scene.generatedImage!, `Ep${currentEpisodeIndex+1}-S${idx+1}.png`) }} 
                                                            className="p-2 bg-white text-black rounded-full hover:bg-zinc-200 transition-transform hover:scale-110 shadow-xl" 
                                                            title="Tải ảnh về"
                                                        >
                                                            <Download size={20}/>
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleGenerateImageForScene(idx) }} 
                                                            className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition-transform hover:scale-110 shadow-xl" 
                                                            title="Tạo lại (Regenerate)"
                                                        >
                                                            <RefreshCw size={20}/>
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-zinc-500 hover:text-emerald-400 transition-colors w-full h-full group/empty">
                                                    {(scene as any).isGeneratingImage ? 
                                                        <><RefreshCw size={32} className="animate-spin mb-2 text-emerald-500"/><span className="text-xs font-bold text-emerald-500">Đang vẽ...</span></> 
                                                        : 
                                                        <div className="flex flex-col items-center">
                                                            <PlayCircle size={40} className="mb-2 opacity-50 group-hover/empty:opacity-100 group-hover/empty:scale-110 transition-all"/>
                                                            <span className="text-xs font-bold uppercase tracking-wider">Tiếp tục tạo tự động</span>
                                                        </div>
                                                    }
                                                </div>
                                            )}
                                            <span className={`absolute top-2 left-2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded ${currentProcessingIndex === idx && isGeneratingScenes ? 'bg-emerald-600' : 'bg-black/60'}`}>SCENE {scene.sceneNumber}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1"><MapPin size={10}/> Bối cảnh (Location Tag)</span>
                                            <input value={scene.locationTag || ''} onChange={(e) => handleUpdateSceneText(idx, 'locationTag', e.target.value)} className="bg-zinc-950 border border-zinc-800 text-[10px] text-white px-2 py-1 rounded w-32 focus:border-blue-500 outline-none" placeholder="VD: BEDROOM"/>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1"><VideoIcon size={10}/> Visual Prompt (English)</span>
                                                {autoEnhance && !scene.generatedImage && <span className="text-[9px] text-indigo-400 flex items-center gap-1 font-bold"><Sparkles size={8}/> Enhanced Transitions</span>}
                                            </div>
                                            <textarea value={scene.visualPrompt} onChange={(e) => handleUpdateSceneText(idx, 'visualPrompt', e.target.value)} className="w-full bg-black/20 border border-white/5 rounded p-2 text-sm text-zinc-300 font-light leading-relaxed focus:border-blue-500 focus:outline-none resize-none h-20"/>
                                        </div>
                                        {!isSilentMode && (
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-bold text-green-400 uppercase flex items-center gap-1"><Mic size={10}/> Audio / Dialogue</span>
                                                    <span className="text-[10px] text-zinc-500">{scene.character || "Narrator"} • {voiceMap[scene.character || ""] || "Default"}</span>
                                                </div>
                                                <textarea value={scene.voiceover} onChange={(e) => handleUpdateSceneText(idx, 'voiceover', e.target.value)} className="w-full bg-emerald-900/5 border border-emerald-500/10 rounded p-2 text-sm text-white italic focus:border-emerald-500 focus:outline-none resize-none h-16"/>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            <div className="pt-6 border-t border-white/5">
                                <div className={`bg-black/30 border rounded-2xl p-4 flex flex-col md:flex-row gap-4 transition-all hover:border-white/20 relative group ${isGeneratingEnding ? 'border-indigo-500/50 bg-indigo-900/10' : 'border-white/10'}`}>
                                    <div className="w-full md:w-1/3 shrink-0">
                                        <div className={`bg-black rounded-xl overflow-hidden border border-zinc-800 relative group flex items-center justify-center ${aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'}`}>
                                            {(storyStructure?.episodes[currentEpisodeIndex] as any)?.endingImage ? (
                                                <>
                                                    <img src={(storyStructure.episodes[currentEpisodeIndex] as any).endingImage} className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewImage((storyStructure.episodes[currentEpisodeIndex] as any).endingImage)} />
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); triggerDownload((storyStructure.episodes[currentEpisodeIndex] as any).endingImage, `Ep${currentEpisodeIndex+1}-Ending.png`) }} 
                                                            className="p-2 bg-white text-black rounded-full hover:bg-zinc-200 transition-transform hover:scale-110 shadow-xl"
                                                        >
                                                            <Download size={20}/>
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <button onClick={() => handleGenerateEnding()} disabled={isGeneratingEnding || isGlobalProcessing} className="flex flex-col items-center justify-center text-zinc-500 hover:text-indigo-400 transition-colors">
                                                    {isGeneratingEnding ? <Loader2 size={24} className="animate-spin mb-2 text-indigo-500"/> : <Flag size={24} className="mb-2"/>}
                                                    <span className="text-xs font-bold">{isGeneratingEnding ? "Đang vẽ Ending..." : "Tạo Ending Shot"}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <h4 className="text-sm font-bold text-white uppercase flex items-center gap-2"><Flag size={14} className="text-indigo-500"/> Ending Shot (Subscribe & Bell)</h4>
                                        <p className="text-xs text-zinc-400 leading-relaxed">Hình ảnh kết thúc với nút Subscribe và Chuông để mời gọi hành động.</p>
                                    </div>
                                </div>
                            </div>
                            <div ref={scrollRef}></div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50">
                        <BookOpen size={64} className="mb-4"/>
                        <p className="text-lg font-light">Virtual Writers' Room</p>
                        <p className="text-sm">Hoàn thành các bước bên trái để bắt đầu</p>
                    </div>
                )}
            </div>

            <ImageViewerModal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} imageSrc={previewImage} />

            {showEpisodeReview && storyStructure && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 shrink-0">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><LayoutTemplate size={20} className="text-emerald-500"/> Danh sách tập phim</h3>
                            <button onClick={() => setShowEpisodeReview(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            {storyStructure.episodes.map((ep: any, idx: number) => {
                                const isScripted = ep.scenes && ep.scenes.length > 0;
                                const isFilmed = isScripted && ep.scenes.every((s: any) => s.generatedImage);
                                return (
                                    <div key={idx} className={`p-4 rounded-xl border flex flex-col gap-3 transition-colors ${currentEpisodeIndex === idx ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'}`}>
                                        <div className="flex justify-between items-start">
                                            <div><h4 className="text-lg font-bold text-white mb-1">Tập {ep.episodeNumber}: {ep.title}</h4><p className="text-xs text-zinc-400 line-clamp-2">{ep.summary}</p></div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${isFilmed ? 'bg-green-500/20 text-green-400 border border-green-500/30' : isScripted ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>{isFilmed ? 'Hoàn Thành' : isScripted ? 'Đang Sản Xuất' : 'Chưa Có Kịch Bản'}</span>
                                                <button onClick={() => { setCurrentEpisodeIndex(idx); setShowEpisodeReview(false); if(isScripted) { setScenes(ep.scenes); scenesRef.current = ep.scenes; setStep(4); } else { setStep(3); } }} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-lg font-bold flex items-center gap-1 transition-colors"><Edit2 size={12}/> Chọn Tập</button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoryCreator;
