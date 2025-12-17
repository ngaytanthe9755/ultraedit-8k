
// ... (imports remain same)
import React, { useState, useEffect } from 'react';
import { Upload, MonitorPlay, History, ArrowRight, Type, Globe, Sparkles, Download, LayoutTemplate, PenTool, Lightbulb, Image as ImageIcon, Video, Loader2, BookOpen, FileText, ShoppingBag, MousePointerClick, Palette, Monitor, AlignCenter, AlignLeft, AlignRight, CheckCircle2, Zap, Star, Gamepad2, Mic2, Newspaper } from 'lucide-react';
import { generateThumbnail, validateImageSafety, generateThumbnailSuggestions } from '../services/geminiService';
import { saveItem, getAllItems } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
import { LibraryItem, User as AppUser, ModuleType } from '../types';
import { SuggestionModal } from '../components/SuggestionModal';
import { checkUsageLimit, incrementUsage } from '../services/userService';
import { applyWatermark } from '../services/imageUtils';

interface ThumbnailProps {
    addToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    addNotification?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    onRequireAuth: () => void;
    isAuthenticated: boolean;
    currentUser?: AppUser;
    isGlobalProcessing?: boolean;
    setGlobalProcessing?: (val: boolean) => void;
}

// Updated with Visual Previews
const THUMBNAIL_LAYOUTS: Record<string, { id: string, label: string, desc: string, prompt: string, visual: string }[]> = {
    "⛩️ Pháp Phục & Tâm Linh (Best Seller)": [
        { 
            id: 'pp_gold_luxury', 
            label: 'Hoàng Gia (Royal Gold)', 
            desc: 'Chữ thư pháp Vàng Kim 3D, hiệu ứng bụi vàng bay. Sang trọng tuyệt đối.', 
            prompt: 'Style: Asian Royal Luxury. Typography: Vietnamese Calligraphy font ("Thư Pháp") in 3D Realistic Gold texture with shiny reflections. Visuals: Floating golden dust particles, soft glow. Background: Deep red or dark wood texture.',
            visual: 'https://images.unsplash.com/photo-1579762186835-263301a2d909?w=500&q=80'
        },
        { 
            id: 'pp_zen_lotus', 
            label: 'Sen Tỏa Sáng (Glowing Lotus)', 
            desc: 'Hiệu ứng hào quang hoa sen sau lưng. Chữ trắng phát sáng nhẹ nhàng.', 
            prompt: 'Style: Spiritual Zen. Visuals: A glowing lotus flower graphic or halo behind the subject. Soft, ethereal lighting. Text: White Serif font with Outer Glow (Holy vibe). Colors: Pink, White, Soft Gold.',
            visual: 'https://images.unsplash.com/photo-1516205651411-a8551e6358cd?w=500&q=80'
        },
        { 
            id: 'pp_poster', 
            label: 'Poster Phim Cổ Trang', 
            desc: 'Bố cục như poster phim. Text dọc, hiệu ứng khói sương mờ ảo.', 
            prompt: 'Style: Ancient Movie Poster. Visuals: Fog/Mist overlay at the bottom. Text: Vertical layout (Cau Doi style), ancient paper texture background for text box. Color Grading: Cinematic teal and orange or vintage sepia.',
            visual: 'https://images.unsplash.com/photo-1614730341194-75c60740a270?w=500&q=80'
        },
        {
            id: 'pp_nature_zen',
            label: 'Thiền Tự Nhiên (Nature Zen)',
            desc: 'Hòa mình vào thiên nhiên, rừng tre, suối chảy. Text xanh ngọc bích.',
            prompt: 'Style: Nature Meditation. Visuals: Bamboo forest or waterfall background. Subject meditating. Text: Jade stone texture text. Vibe: Fresh, healing, calm.',
            visual: 'https://images.unsplash.com/photo-1541336528065-8f1fdc435835?w=500&q=80'
        },
        {
            id: 'pp_truc_chi',
            label: 'Tranh Trúc Chỉ (Glowing Art)',
            desc: 'Hiệu ứng giấy Trúc Chỉ vàng sáng rực rỡ, họa tiết Mandala.',
            prompt: 'Style: Truc Chi Art (Bamboo Paper Art). Visuals: Background has glowing yellow/orange backlit paper texture with intricate Mandala/Lotus patterns. Subject stands in front. Text: Dark brown calligraphy, clear and bold.',
            visual: 'https://images.unsplash.com/photo-1578923758365-b3df0498a964?w=500&q=80'
        },
        {
            id: 'pp_ink_wash',
            label: 'Thủy Mặc (Ink Wash)',
            desc: 'Phong cách tranh thủy mặc, núi non mờ ảo, nét cọ loang.',
            prompt: 'Style: Traditional Ink Wash Painting. Visuals: Black and white gradient, misty mountains in background, brush stroke effects. Text: Red seal stamp graphic, black brush font.',
            visual: 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?w=500&q=80'
        },
        {
            id: 'pp_lacquer',
            label: 'Sơn Mài (Lacquer Art)',
            desc: 'Nền đen bóng, họa tiết vàng/bạc/đỏ, cẩn trứng.',
            prompt: 'Style: Vietnamese Lacquer Art (Son Mai). Background: Deep glossy black with gold leaf and silver eggshell inlay textures. Text: Gold foil text. Vibe: Extremely expensive, traditional luxury.',
            visual: 'https://images.unsplash.com/photo-1615800098779-1be32e60cca3?w=500&q=80'
        },
        {
            id: 'pp_gate_tamquan',
            label: 'Cổng Tam Quan (Temple Gate)',
            desc: 'Nhân vật đứng giữa cổng chùa cổ kính, rêu phong.',
            prompt: 'Style: Ancient Temple Gate. Visuals: Subject framed by a majestic stone "Tam Quan" gate with moss textures. Sunlight streaming through the gate. Text: Vertical alignment on the pillars.',
            visual: 'https://images.unsplash.com/photo-1627918882069-b39b83b38c20?w=500&q=80'
        },
        {
            id: 'pp_lantern_night',
            label: 'Đêm Hội An (Lanterns)',
            desc: 'Lung linh huyền ảo với hàng trăm đèn lồng phát sáng.',
            prompt: 'Style: Hoi An Night. Visuals: Background filled with glowing colorful silk lanterns (Red, Yellow). Bokeh effect. Subject lit by warm lantern light. Text: Glowing white text with soft shadow.',
            visual: 'https://images.unsplash.com/photo-1535201198650-7798369b7406?w=500&q=80'
        },
        {
            id: 'pp_zen_garden',
            label: 'Vườn Thiền (Zen Garden)',
            desc: 'Cát trắng, đá cuội, bonsai. Không gian tĩnh lặng.',
            prompt: 'Style: Japanese Zen Garden. Visuals: Raked white sand patterns, bonsai trees, peaceful stones. Bright, airy daylight. Text: Minimalist thin sans-serif font, dark grey.',
            visual: 'https://images.unsplash.com/photo-1599423300746-b62533397364?w=500&q=80'
        },
        {
            id: 'pp_royal_court',
            label: 'Cung Đình (Imperial Court)',
            desc: 'Họa tiết rồng phượng, cột gỗ son son thiếp vàng.',
            prompt: 'Style: Imperial Palace. Visuals: Red wooden pillars with gold dragon carvings. majestic roof details. Subject looks royal. Text: Golden serif font with bevel effect.',
            visual: 'https://images.unsplash.com/photo-1606293926075-69a00dbfde81?w=500&q=80'
        },
        {
            id: 'pp_halo_gold',
            label: 'Hào Quang Phật (God Rays)',
            desc: 'Vòng tròn hào quang vàng rực sau đầu, thiêng liêng.',
            prompt: 'Style: Divine Aura. Visuals: A distinct, bright golden ring/halo behind the subject\'s head. Rays of light radiating outward. Text: Placed at the bottom, metallic gold.',
            visual: 'https://images.unsplash.com/photo-1563725627258-5d27b9932e69?w=500&q=80'
        },
        {
            id: 'pp_moon_gate',
            label: 'Cửa Sổ Tròn (Moon Window)',
            desc: 'Nhìn qua khung cửa sổ tròn, hoa mận trắng rơi.',
            prompt: 'Style: Moon Gate Frame. Composition: Subject viewed through a circular traditional window frame. Foreground: Blurred white plum blossom branches. Text: Curved text following the window arc.',
            visual: 'https://images.unsplash.com/photo-1592672728447-3dc82b8c2807?w=500&q=80'
        },
        {
            id: 'pp_incense_smoke',
            label: 'Khói Trầm (Incense Mist)',
            desc: 'Làn khói trầm hương uốn lượn nghệ thuật quanh chữ.',
            prompt: 'Style: Mystical Incense. Visuals: Realistic swirls of white/blue incense smoke weaving around the subject and text. Dark moody background. Text: Silver or White with glow.',
            visual: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=500&q=80'
        },
        {
            id: 'pp_fireflies',
            label: 'Đom Đóm (Fireflies)',
            desc: 'Rừng đêm, đom đóm bay lập lòe, màu xanh ma mị.',
            prompt: 'Style: Enchanted Forest. Visuals: Night time, blue-ish tone, hundreds of small yellow glowing fireflies (bokeh). Text: Neon light style or glowing white.',
            visual: 'https://images.unsplash.com/photo-1507646879007-167332304dfc?w=500&q=80'
        },
        {
            id: 'pp_couplet_red',
            label: 'Câu Đối Đỏ (Red Couplets)',
            desc: 'Hai dải câu đối đỏ chạy dọc hai bên ảnh.',
            prompt: 'Layout: Traditional Couplets. Visuals: Two vertical red paper banners on left and right sides with black calligraphy text. Subject in the center. Background: Tet/New Year vibe.',
            visual: 'https://images.unsplash.com/photo-1612028608077-49774ba4dc2c?w=500&q=80'
        },
        {
            id: 'pp_stone_tablet',
            label: 'Bia Đá Cổ (Stone Engrave)',
            desc: 'Chữ như được khắc chìm vào bia đá rêu phong.',
            prompt: 'Style: Ancient Stone Tablet. Visuals: Text looks engraved/carved into a rough grey stone texture with moss details. Inner shadow on text. Subject lighting matches the stone environment.',
            visual: 'https://images.unsplash.com/photo-1533669955278-68246d79a205?w=500&q=80'
        },
        {
            id: 'pp_silk_ribbon',
            label: 'Lụa Bay (Flying Silk)',
            desc: 'Dải lụa mềm mại bay lượn, chữ nằm trên lụa.',
            prompt: 'Style: Soft Silk. Visuals: Flowing fabrics/ribbons (pastel colors) moving through the air. Text is mapped onto the curve of the silk. Ethereal and soft.',
            visual: 'https://images.unsplash.com/photo-1528459061998-56fd57ad86e3?w=500&q=80'
        },
        {
            id: 'pp_vertical_split',
            label: 'Phân Thân (Mirrored)',
            desc: 'Hiệu ứng phản chiếu hoặc phân thân nghệ thuật.',
            prompt: 'Layout: Mirror/Reflection. Visuals: Subject standing on a reflective water surface (lake/pond). Perfect reflection below. Text: Floating on the water surface (ripple effect).',
            visual: 'https://images.unsplash.com/photo-1519757077083-d92293b91963?w=500&q=80'
        },
        {
            id: 'pp_magazine_vogue',
            label: 'Tạp Chí (Vogue Temple)',
            desc: 'Bìa tạp chí thời trang nhưng bối cảnh chùa chiền.',
            prompt: 'Style: High Fashion Magazine Cover. Composition: Subject centered, "PHÁP PHỤC" title huge behind subject\'s head (depth). Elegant typography overlays. Lighting: Studio fashion lighting.',
            visual: 'https://images.unsplash.com/photo-1549488497-2a2977dc23cb?w=500&q=80'
        },
        {
            id: 'pp_minimalist_white',
            label: 'Bạch Y (Pure White)',
            desc: 'Tone trắng chủ đạo, tinh khiết, thanh cao.',
            prompt: 'Style: High-Key Photography. Visuals: Everything is bright, near white. White outfit, white background, soft shadows. Text: Minimalist black or dark grey thin font. Pure and clean.',
            visual: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?w=500&q=80'
        },
        {
            id: 'pp_vintage_sepia',
            label: 'Hoài Cổ (Sepia Vintage)',
            desc: 'Màu ảnh cũ, xước nhẹ, hoài niệm Đông Dương.',
            prompt: 'Style: Indochine Vintage. Color Grading: Sepia/Brown tone, grain, film scratches, vignetting. Text: Retro serif font, slightly faded.',
            visual: 'https://images.unsplash.com/photo-1533158326339-7f3cf2404354?w=500&q=80'
        },
        {
            id: 'pp_mandala_bg',
            label: 'Họa Tiết Mandala',
            desc: 'Nền họa tiết Mandala xoay tròn đồng tâm.',
            prompt: 'Style: Mandala Background. Visuals: Complex geometric Mandala pattern in background (Gold/Brown). Subject in center. Text: Gold with black outline for contrast.',
            visual: 'https://images.unsplash.com/photo-1598155523122-3842334d6c10?w=500&q=80'
        },
        {
            id: 'pp_3d_popout',
            label: 'Tách Nền 3D (Pop-out)',
            desc: 'Nhân vật tràn ra khỏi khung hình tròn/vuông.',
            prompt: 'Layout: 3D Pop-out. Visuals: A graphical frame (circle or square) behind the subject. Subject\'s head or arm overlaps/breaks the frame boundary. Solid color background behind the frame.',
            visual: 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=500&q=80'
        }
    ],
    "🔥 Viral & Clickbait (MrBeast Style)": [
        { 
            id: 'viral_beast', 
            label: 'The Beast (High Energy)', 
            desc: 'Phong cách MrBeast: Màu sắc rực rỡ, độ bão hòa cao. Viền trắng dày quanh nhân vật. Chữ cực lớn, font Sans-Serif đậm.', 
            prompt: 'Style: MrBeast YouTube Thumbnail. Vibe: High Energy, Shocking, Viral. Visuals: High saturation colors, HDR lighting. Add a thick white outline stroke around the main subject. Text: Massive, impact font, yellow or white color with heavy black drop shadow. Background: Blurry but colorful.',
            visual: 'https://images.unsplash.com/photo-1592663527359-cf6642f54c96?w=500&q=80'
        },
        { 
            id: 'viral_vs', 
            label: 'Đối Kháng (Versus Battle)', 
            desc: 'Chia đôi màn hình bằng tia sét hoặc vệt sáng. So sánh 2 bên (Đắt vs Rẻ, Trước vs Sau).', 
            prompt: 'Style: Versus Split Screen. Composition: Diagonal split with a glowing lightning bolt or neon line in the middle. Left side: Desaturated/Sad tone. Right side: Vibrant/Happy tone. Text: "VS" in the middle, metallic 3D texture.',
            visual: 'https://images.unsplash.com/photo-1550259979-ed79b48d2a30?w=500&q=80'
        },
        { 
            id: 'viral_react', 
            label: 'Reaction (Shock Face)', 
            desc: 'Zoom cận mặt biểu cảm sốc. Background mờ tối. Emoji và mũi tên đỏ chỉ vào điểm nhấn.', 
            prompt: 'Style: Reaction Video. Visuals: Extreme close-up on face with "Shocked" expression. Brighten eyes and teeth. Background: Darkened and blurred. Graphics: Add 3D Red Arrows pointing to the background object. Add expressive Emojis (😱, 🔥) floating.',
            visual: 'https://images.unsplash.com/photo-1589389332212-32b7a4239243?w=500&q=80'
        },
        {
            id: 'viral_challenge',
            label: 'Thử Thách (Challenge)',
            desc: 'Tiền thưởng lớn, đồng hồ đếm ngược, thanh tiến trình.',
            prompt: 'Style: Challenge Video. Visuals: Floating piles of cash/gold. A digital countdown timer graphic. High contrast colors (Green/Red). Subject looks determined. Text: Big bold numbers.',
            visual: 'https://images.unsplash.com/photo-1546519638-68e109498ad0?w=500&q=80'
        },
        {
            id: 'viral_mistake',
            label: 'Sai Lầm (Big Mistake)',
            desc: 'Dấu X đỏ lớn, filter màu xám buồn, mũi tên chỉ lỗi sai.',
            prompt: 'Style: Warning/Mistake. Visuals: Grayscale filter on the background. A large 3D Red "X" mark or "STOP" sign. Subject looks regretful/facepalm. Text: Urgent warning font.',
            visual: 'https://images.unsplash.com/photo-1628717341663-0007b0ee2597?w=500&q=80'
        }
    ],
    "🎮 Gaming & Esports (New)": [
        { 
            id: 'game_tierlist', 
            label: 'Xếp Hạng (Tier List)', 
            desc: 'Bảng xếp hạng S-A-B-C phía sau.', 
            prompt: 'Style: Gaming Tier List. Background: A visible S/A/B/C tier list graphic. Colors: Vibrant RGB.',
            visual: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&q=80'
        },
        { 
            id: 'game_killcount', 
            label: 'Kỷ Lục (High Score)', 
            desc: 'Số điểm/Kill cực lớn phát sáng.', 
            prompt: 'Style: High Score Highlight. Visuals: Glowing eyes effect. Huge neon numbers.',
            visual: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=500&q=80'
        },
        { 
            id: 'game_faceoff', 
            label: 'Đối Đầu (Face Off)', 
            desc: 'Hai nhân vật game đối mặt nhau.', 
            prompt: 'Style: Esports 1v1. Visuals: Two game characters facing each other. Fire vs Ice effect.',
            visual: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?w=500&q=80'
        }
    ],
    "🎙️ Podcast & Talkshow (New)": [
        { 
            id: 'pod_mic_focus', 
            label: 'Tập Trung Micro', 
            desc: 'Cận cảnh Micro chuyên nghiệp.', 
            prompt: 'Style: Professional Podcast. Visuals: Close up on a high-end podcast microphone. Guest blurred in background.',
            visual: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=500&q=80'
        },
        { 
            id: 'pod_split_guest', 
            label: 'Khách Mời (Split)', 
            desc: 'Chia đôi: Host bên trái, Khách mời bên phải.', 
            prompt: 'Style: Interview Split. Visuals: Clean vertical split. Consistent color grading.',
            visual: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=500&q=80'
        },
        { 
            id: 'pod_quote', 
            label: 'Trích Dẫn (Deep Quote)', 
            desc: 'Ảnh đen trắng nghệ thuật, trích dẫn nổi bật.', 
            prompt: 'Style: Deep Conversation. Visuals: Black and white high contrast portrait. Text: Quote in Gold Serif.',
            visual: 'https://images.unsplash.com/photo-1478737270239-2f02b77ac6d5?w=500&q=80'
        }
    ],
    "📰 News & Documentary (New)": [
        { 
            id: 'doc_crime', 
            label: 'Hồ Sơ Vụ Án', 
            desc: 'Ảnh tư liệu cũ, giấy rách.', 
            prompt: 'Style: True Crime. Visuals: Old photo texture, torn paper edges, red string.',
            visual: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?w=500&q=80'
        },
        { 
            id: 'doc_history', 
            label: 'Lịch Sử', 
            desc: 'Bản đồ cổ, hiệu ứng giấy da.', 
            prompt: 'Style: History Channel. Visuals: Vintage map background, golden artifacts.',
            visual: 'https://images.unsplash.com/photo-1461360370896-922641973f72?w=500&q=80'
        },
        { 
            id: 'news_breaking', 
            label: 'Tin Nóng', 
            desc: 'Thanh bar Breaking News đỏ.', 
            prompt: 'Style: News Broadcast. Visuals: Red "BREAKING NEWS" lower third graphic.',
            visual: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=500&q=80'
        }
    ],
    "💎 Luxury & Professional (Business)": [
        { 
            id: 'pro_luxury_dark', 
            label: 'Doanh Nhân', 
            desc: 'Nền tối sang trọng.', 
            prompt: 'Style: High-End Business. Atmosphere: Dark, Moody. Rim lighting. Text: Elegant Serif Gold.',
            visual: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=500&q=80'
        },
        { 
            id: 'pro_glass', 
            label: 'Kính Mờ', 
            desc: 'Text trên tấm kính mờ hiện đại.', 
            prompt: 'Style: Modern Tech. Visuals: Glassmorphism effect. Text inside frosted glass box.',
            visual: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&q=80'
        },
        { 
            id: 'pro_ted', 
            label: 'Diễn Giả', 
            desc: 'Nền đỏ/đen, đứng thuyết trình.', 
            prompt: 'Style: TED Talk. Visuals: Subject on stage. Spotlight. Text: Big bold white questions.',
            visual: 'https://images.unsplash.com/photo-1544531586-fde5298cdd40?w=500&q=80'
        }
    ],
    "🌸 Lifestyle & Vlog (Cinematic)": [
        { 
            id: 'vlog_aesthetic', 
            label: 'Thơ Mộng', 
            desc: 'Màu film, chữ viết tay.', 
            prompt: 'Style: Aesthetic Vlog. Color Grading: Soft pastel film look. Typography: Handwriting font.',
            visual: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500&q=80'
        },
        { 
            id: 'vlog_food', 
            label: 'Ẩm Thực', 
            desc: 'Màu sắc rực rỡ, ngon mắt.', 
            prompt: 'Style: Food Review. Visuals: Food Porn style. Text: Bubble font.',
            visual: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80'
        },
        { 
            id: 'vlog_travel', 
            label: 'Du Lịch', 
            desc: 'Khung Polaroid, bản đồ.', 
            prompt: 'Style: Travel Diary. Visuals: Polaroid frames, map graphics. Bright blue sky.',
            visual: 'https://images.unsplash.com/photo-1503220317375-aaad6143d41b?w=500&q=80'
        }
    ]
};

// ... (TEXT_MATERIALS, FONTS, CATEGORIES, PLATFORMS, Helper Functions remain same)
const TEXT_MATERIALS = [
    { label: "Vàng Kim 3D (Gold Bullion)", value: "Material: 3D Solid Gold bar, metallic reflection, shiny, luxury, heavy weight" },
    { label: "Bạch Kim (Platinum Chrome)", value: "Material: Polished Chrome/Silver, mirror reflection, futuristic, cold sci-fi look" },
    { label: "Nhựa Bóng (3D Glossy Plastic)", value: "Material: 3D Glossy Plastic (Toy style), high specular highlights, vibrant color, soft edges" },
    { label: "Neon Phát Sáng (Cyberpunk)", value: "Material: Neon Light Tube, strong Outer Glow, vibrant electric colors (Blue/Pink)" },
    { label: "Lửa Cháy (Magma Effect)", value: "Material: Burning Fire/Magma, glowing core, smoke edges, hot temperature" },
    { label: "Phẳng Hiện Đại (Matte Flat)", value: "Material: Solid Matte Color, No gradients, High Contrast against background, Vector Art style" },
    { label: "Kính Mờ (Frosted Glass)", value: "Material: Text on Frosted Glass background, blur effect, semi-transparent white" },
    { label: "Giấy Cũ (Vintage Paper)", value: "Material: Text written on torn vintage parchment paper texture, ink bleed effect" },
    { label: "Đá Khắc (Stone Carving)", value: "Material: Text engraved into stone/rock, inner shadow, depth, ancient feel" },
    { label: "Kim Cương (Diamond)", value: "Material: Faceted Crystal/Diamond, prismatic refraction, sparkles" },
    { label: "Chất Nhầy (Slime/Goo)", value: "Material: Green dripping slime, wet texture, glossy, Halloween vibe" },
    { label: "Hologram (7 Màu)", value: "Material: Iridescent Holographic foil, rainbow gradient reflection, tech vibe" },
    { label: "Rỉ Sét (Rusty Metal)", value: "Material: Corroded rusty iron, grunge texture, industrial apocalypse look" },
    { label: "Gỗ Khắc (Wood)", value: "Material: Dark Oak wood texture, engraved look, natural" },
    { label: "Bánh Kẹo (Candy)", value: "Material: Sugar coated gummy texture, sweet, colorful" },
    { label: "Glitch (Lỗi Kỹ Thuật)", value: "Material: Digital glitch artifact, RGB split, distorted data look" }
];

const FONTS = [
    { label: "Mạnh Mẽ (Impact/Bold Sans)", value: "Font: Massive Bold Sans-Serif (Impact style). Characteristic: Thick strokes, easy to read, supports Vietnamese accents perfectly." },
    { label: "Thư Pháp (Calligraphy)", value: "Font: Traditional Vietnamese Calligraphy (Ong Do style). Characteristic: Brush strokes, flowing, artistic, cultural vibe." },
    { label: "Hiện Đại (Montserrat/Geometric)", value: "Font: Geometric Sans-Serif (Montserrat/Roboto). Characteristic: Clean, modern, tech-savvy, minimalist." },
    { label: "Sang Trọng (Serif/Vogue)", value: "Font: Elegant High-Contrast Serif (Playfair Display/Bodoni). Characteristic: Thin and thick strokes, luxury fashion magazine style." },
    { label: "Viết Tay (Handwritten)", value: "Font: Organic Handwriting (Marker/Pen). Characteristic: Personal, vlog style, friendly, casual." },
    { label: "Kinh Dị (Horror/Distorted)", value: "Font: Distorted, scratchy, or dripping font. Characteristic: Scary, mysterious, thriller vibe." },
    { label: "Vui Nhộn (Cartoon/Bubble)", value: "Font: Rounded Bubble font. Characteristic: Playful, kid-friendly, thick outlines." },
    { label: "Graffiti (Đường Phố)", value: "Font: Street Graffiti style, spray paint look, urban, edgy." },
    { label: "Pixel (8-Bit Game)", value: "Font: 8-bit Pixel Art font, retro gaming console style, blocky." },
    { label: "Retro (Thập niên 80)", value: "Font: Retro Synthwave font, chrome effect, italicized, 80s disco vibe." },
    { label: "Báo Chí (Typewriter)", value: "Font: Old Typewriter / Courier font, vintage document look, investigative." }
];

const CATEGORIES = Object.keys(THUMBNAIL_LAYOUTS);
const PLATFORMS = ['Youtube', 'Tiktok', 'Facebook', 'Shopee/Lazada'];

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
};

const base64ToFile = (base64Data: string, filename: string): File => {
    const arr = base64Data.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

const Thumbnail: React.FC<ThumbnailProps> = ({ addToast, addNotification, onRequireAuth, isAuthenticated, currentUser, isGlobalProcessing, setGlobalProcessing }) => {
    // ... (State declarations remain same)
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isCheckingSafety, setIsCheckingSafety] = useState(false);
    
    // Config
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    const [selectedLayoutId, setSelectedLayoutId] = useState(THUMBNAIL_LAYOUTS[CATEGORIES[0]][0].id);
    const [selectedPlatform, setSelectedPlatform] = useState(PLATFORMS[0]);
    
    const [selectedFont, setSelectedFont] = useState(FONTS[0].value); 
    const [selectedMaterial, setSelectedMaterial] = useState(TEXT_MATERIALS[0].value);

    const [studioImages, setStudioImages] = useState<LibraryItem[]>([]);
    const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);

    const [availableScripts, setAvailableScripts] = useState<LibraryItem[]>([]);
    const [selectedScriptId, setSelectedScriptId] = useState<string>("");

    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [quality, setQuality] = useState('4K');
    
    const [textOverlay, setTextOverlay] = useState(''); // Main Title
    const [subText, setSubText] = useState(''); // Subtitle
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentResult, setCurrentResult] = useState<string | null>(null);
    
    const [isThinking, setIsThinking] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

    // NEW: Thumbnail history
    const [historyThumbnails, setHistoryThumbnails] = useState<LibraryItem[]>([]);

    // Derived selected Layout object
    const selectedLayout = THUMBNAIL_LAYOUTS[selectedCategory].find(l => l.id === selectedLayoutId);

    // ... (useEffects remain same)
    useEffect(() => {
        if(THUMBNAIL_LAYOUTS[selectedCategory]) {
            setSelectedLayoutId(THUMBNAIL_LAYOUTS[selectedCategory][0].id);
        }
    }, [selectedCategory]);

    useEffect(() => {
        loadData();
        const handleUpdate = () => {
            console.log("Refreshing Thumbnail assets...");
            loadData();
        };
        window.addEventListener('library_updated', handleUpdate);
        return () => window.removeEventListener('library_updated', handleUpdate);
    }, []);

    const loadData = async () => {
        const allItems = await getAllItems();
        const studios = allItems
            .filter(item => 
                (item.type === 'image' && item.meta?.sourceModule === ModuleType.STUDIO) || 
                (item.type === 'image' && item.meta?.composite === true)
            )
            .sort((a, b) => b.createdAt - a.createdAt);
        setStudioImages(studios);

        const scripts = allItems
            .filter(item => item.type === 'video_strategy')
            .sort((a, b) => b.createdAt - a.createdAt);
        setAvailableScripts(scripts);

        // NEW: Load thumbnail history sorted by date
        const thumbs = allItems
            .filter(item => item.type === 'thumbnail')
            .sort((a, b) => b.createdAt - a.createdAt);
        setHistoryThumbnails(thumbs);
    }

    useEffect(() => {
        switch (selectedPlatform) {
            case 'Tiktok': setAspectRatio('9:16'); break;
            case 'Youtube': setAspectRatio('16:9'); break;
            case 'Facebook': setAspectRatio('4:5'); break;
            default: setAspectRatio('1:1');
        }
    }, [selectedPlatform]);

    // DETERMINE ACTIVE PREVIEW
    const latestGenerated = selectedLayout ? historyThumbnails.find(t => t.meta?.layout === selectedLayout.label) : null;
    const activePreviewImage = latestGenerated?.base64Data 
        ? (latestGenerated.base64Data.startsWith('data:') ? latestGenerated.base64Data : `data:image/png;base64,${latestGenerated.base64Data}`)
        : selectedLayout?.visual;

    // ... (handleFileChange, handleSelectStudioImage, triggerDownload remain same)
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setIsCheckingSafety(true);
            try {
                const b64 = await fileToBase64(f);
                const validation = await validateImageSafety(b64);
                if (!validation.safe) {
                    const msg = `Hình ảnh vi phạm: ${validation.reason}`;
                    addToast('Cảnh báo', msg, 'error');
                    return;
                }
                setFile(f);
                setPreview(URL.createObjectURL(f));
                setSelectedStudioId(null);
            } catch (err) {
                addToast('Lỗi', 'Không thể kiểm tra an toàn ảnh.', 'error');
            } finally {
                setIsCheckingSafety(false);
            }
        }
    };

    const handleSelectStudioImage = (item: LibraryItem) => {
        if (!item.base64Data) return;
        setSelectedStudioId(item.id);
        const fullBase64 = item.base64Data.startsWith('data:') ? item.base64Data : `data:image/png;base64,${item.base64Data}`;
        setPreview(fullBase64);
        const fileObj = base64ToFile(fullBase64, `Studio-${item.id}.png`);
        setFile(fileObj);
    }

    const triggerDownload = (base64Data: string, filename: string) => {
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGenerate = async () => {
        if (!isAuthenticated) { onRequireAuth(); return; }
        if (isGlobalProcessing) { addToast("Hệ thống bận", "Vui lòng chờ.", "warning"); return; }

        if (currentUser) {
            const check = checkUsageLimit(currentUser.username, ModuleType.THUMBNAIL, 1);
            if (!check.allowed) { addToast("Không đủ điểm", check.message || "Hết điểm", "error"); return; }
        }

        if (!file || !textOverlay) {
            addToast("Thiếu thông tin", "Vui lòng tải ảnh và nhập text hiển thị.", "error");
            return;
        }

        setIsGenerating(true);
        setGlobalProcessing?.(true);
        try {
            const b64 = await fileToBase64(file);
            const layout = THUMBNAIL_LAYOUTS[selectedCategory].find(l => l.id === selectedLayoutId);
            
            let scriptContext = "";
            if (selectedScriptId) {
                const script = availableScripts.find(s => s.id === selectedScriptId);
                if (script) {
                    scriptContext = `Derived from Script: "${script.prompt}". Context: ${script.meta?.purpose || ""}.`;
                }
            }

            const context = `
                **TASK: Create a World-Class Viral YouTube Thumbnail (Award-Winning Quality).**
                
                **1. CORE VISUALS:**
                - Platform: ${selectedPlatform}.
                - Layout Style: ${layout?.prompt}.
                - **Enhancement:** Apply professional color grading (High Contrast, Vibrance, Sharpness). Make the subject pop out (3D depth effect/Rim Light).
                
                **2. TYPOGRAPHY (DUAL LAYER):**
                - **MAIN TITLE (Priority 1):** "${textOverlay}".
                  - Size: HUGE, Bold, Dominant.
                  - Position: Top or Center (depending on layout).
                  - Font: ${selectedFont}. **MUST SUPPORT VIETNAMESE ACCENTS.**
                  - Material: ${selectedMaterial}.
                
                ${subText ? `
                - **SUBTITLE / TAGLINE (Priority 2):** "${subText}".
                  - Size: Medium/Small.
                  - Position: Bottom or anchored to a corner.
                  - Style: Contrast color to Main Title, readable background box or stroke.
                ` : ''}

                - Readability: Ensure ALL text has strong Drop Shadow, Outline, or Background Box to be 100% readable on any background.
                
                **3. VIRAL ELEMENTS:**
                - Add subtle visual triggers if appropriate for the style (e.g., Arrows, Speed lines, Glow, Sparkles).
                - Ensure the final image looks like it was designed by a top-tier graphic designer for a channel with 10M+ subs.
                
                ${scriptContext}
            `;

            const resultB64 = await generateThumbnail(b64, layout?.label || "Custom", aspectRatio, quality, "Vietnamese", context);
            let fullB64 = `data:image/png;base64,${resultB64}`;
            
            if (currentUser && !currentUser.isVerified) {
                fullB64 = await applyWatermark(resultB64);
            }

            setCurrentResult(fullB64);
            
            setIsGenerating(false);
            setGlobalProcessing?.(false);
            
            triggerDownload(fullB64, `Thumbnail-${Date.now()}.png`);
            
            saveItem({
                id: uuidv4(),
                type: 'thumbnail',
                prompt: `Thumbnail: ${textOverlay} - ${subText}`,
                createdAt: Date.now(),
                base64Data: fullB64,
                meta: { platform: selectedPlatform, category: selectedCategory, layout: layout?.label, quality, sourceModule: ModuleType.THUMBNAIL, scriptId: selectedScriptId }
            }).catch(err => console.error("Auto-save failed:", err));

            if (currentUser) incrementUsage(currentUser.username, ModuleType.THUMBNAIL, 1);
            addToast("Thành công", "Đã tạo Thumbnail đẳng cấp!", "success");

        } catch (e: any) {
            addToast("Lỗi", e.message || "Tạo thumbnail thất bại.", "error");
            setIsGenerating(false);
            setGlobalProcessing?.(false);
        }
    };

    const handleSuggest = async () => {
        if (!file) { addToast("Cần ảnh", "Vui lòng tải ảnh lên trước để AI phân tích.", "info"); return; }
        
        setIsThinking(true);
        try {
            const b64 = await fileToBase64(file);
            
            let scriptContext = "";
            if (selectedScriptId) {
                const script = availableScripts.find(s => s.id === selectedScriptId);
                if (script) {
                    scriptContext = `Script Title: ${script.prompt}. Purpose: ${script.meta?.purpose || "N/A"}.`;
                }
            }

            const layoutInfo = THUMBNAIL_LAYOUTS[selectedCategory].find(l => l.id === selectedLayoutId)?.label || "Default Layout";
            const fontInfo = FONTS.find(f => f.value === selectedFont)?.label || "Default Font";
            const materialInfo = TEXT_MATERIALS.find(m => m.value === selectedMaterial)?.label || "Default Material";

            const fullContext = `
                ${scriptContext}
                Layout: ${layoutInfo}.
                Font Style: ${fontInfo}.
                Material: ${materialInfo}.
                User Input: ${textOverlay}.
            `;

            const res = await generateThumbnailSuggestions(b64, selectedPlatform, selectedCategory, "Viral", textOverlay, fullContext);
            setSuggestions(res);
            setShowSuggestionsModal(true);
        } catch (e) {
            addToast("Lỗi", "Không thể tạo gợi ý.", "error");
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-full w-full p-4 lg:p-6 gap-6 lg:gap-8">
            {/* LEFT PANEL */}
            <div className="w-full lg:w-[420px] flex flex-col gap-6 shrink-0 h-auto lg:h-full lg:overflow-y-auto custom-scrollbar pb-20 lg:pb-0">
                <div className="pb-4 border-b border-white/5">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-500 mb-2">Viral Thumbnail 8K</h2>
                    <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Thiết kế ảnh bìa chuẩn YouTube Pro</p>
                </div>

                {/* Upload */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm space-y-4">
                    <div className="relative h-48 bg-black/20 rounded-xl border-2 border-dashed border-zinc-700 hover:border-red-500/50 flex items-center justify-center cursor-pointer group overflow-hidden transition-colors">
                        {isCheckingSafety ? <Loader2 className="animate-spin text-red-500"/> : preview ? <img src={preview} className="w-full h-full object-contain"/> : (
                            <div className="text-center text-zinc-500">
                                <Upload size={24} className="mx-auto mb-2 opacity-50"/>
                                <span className="text-xs font-bold uppercase">Tải ảnh gốc (Source)</span>
                            </div>
                        )}
                        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isCheckingSafety}/>
                    </div>

                    {/* Studio Images Selection */}
                    {studioImages.length > 0 && (
                        <div>
                            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Từ Composition Studio ({studioImages.length})</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x">
                                {studioImages.map(img => (
                                    <button 
                                        key={img.id} 
                                        onClick={() => handleSelectStudioImage(img)}
                                        className={`relative w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 transition-all snap-start ${selectedStudioId === img.id ? 'border-red-500 ring-2 ring-red-500/30' : 'border-zinc-800 opacity-70 hover:opacity-100'}`}
                                    >
                                        <img src={img.base64Data?.startsWith('data:') ? img.base64Data : `data:image/png;base64,${img.base64Data}`} className="w-full h-full object-cover" />
                                        {selectedStudioId === img.id && <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center"><CheckCircle2 size={20} className="text-white"/></div>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Config */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Nền tảng</label>
                            <select value={selectedPlatform} onChange={e => setSelectedPlatform(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white">
                                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Phong cách chủ đạo</label>
                            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-1">
                            <LayoutTemplate size={10}/> Layout (Bố cục Pro)
                        </label>
                        <select 
                            value={selectedLayoutId} 
                            onChange={(e) => setSelectedLayoutId(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-red-500 custom-scrollbar"
                        >
                            {THUMBNAIL_LAYOUTS[selectedCategory]?.map(l => (
                                <option key={l.id} value={l.id}>
                                    {l.label}
                                </option>
                            ))}
                        </select>
                        
                        {/* VISUAL PREVIEW OF SELECTED LAYOUT */}
                        {activePreviewImage && (
                            <div className="mt-2 relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 group cursor-help bg-black/50">
                                <img 
                                    src={activePreviewImage} 
                                    alt={selectedLayout?.label} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                                />
                                {latestGenerated && (
                                    <div className="absolute top-2 right-2 bg-indigo-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg border border-white/20 z-10 flex items-center gap-1 animate-in fade-in">
                                        <History size={10} /> Ảnh của bạn
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-3 pointer-events-none">
                                    <p className="text-[10px] text-white/90 font-medium leading-tight">
                                        {selectedLayout?.desc}
                                    </p>
                                </div>
                            </div>
                        )}
                        {!activePreviewImage && (
                            <p className="text-[9px] text-zinc-500 mt-1 italic line-clamp-2 leading-relaxed bg-black/20 p-2 rounded border border-white/5">
                                {selectedLayout?.desc}
                            </p>
                        )}
                    </div>

                    <div className="h-px bg-white/5 my-2"></div>

                    {/* Script Selection */}
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 flex items-center gap-1">
                            <BookOpen size={10}/> Kịch bản mẫu (Cinematic Scripts)
                        </label>
                        <select 
                            value={selectedScriptId} 
                            onChange={(e) => setSelectedScriptId(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white outline-none focus:border-red-500"
                        >
                            <option value="">-- Không sử dụng kịch bản --</option>
                            {availableScripts.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.prompt.replace(/^(Veo|Story): /, '')}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* DUAL TEXT INPUT */}
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Tiêu đề chính (Main Title)</label>
                            <button onClick={handleSuggest} disabled={isThinking} className="text-[10px] text-yellow-500 hover:text-yellow-400 flex items-center gap-1 transition-colors">
                                {isThinking ? <Loader2 size={10} className="animate-spin"/> : <Lightbulb size={10}/>} Gợi ý Viral
                            </button>
                        </div>
                        <input value={textOverlay} onChange={e => setTextOverlay(e.target.value)} placeholder="VD: SỰ THẬT SỐC!..." className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white font-bold focus:border-red-500 outline-none mb-2"/>
                        
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Phụ đề / Tagline (Sub Text)</label>
                        <input value={subText} onChange={e => setSubText(e.target.value)} placeholder="VD: Đừng bỏ lỡ..." className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white focus:border-blue-500 outline-none"/>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Font Chữ (Việt Hóa)</label>
                            <select value={selectedFont} onChange={e => setSelectedFont(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-[10px] text-white">
                                {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Hiệu ứng chữ (VFX)</label>
                            <select value={selectedMaterial} onChange={e => setSelectedMaterial(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-[10px] text-white">
                                {TEXT_MATERIALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <button onClick={handleGenerate} disabled={isGenerating || (isGlobalProcessing && !isGenerating)} className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:to-red-500 text-white font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                    {isGenerating ? <Loader2 size={20} className="animate-spin"/> : <Zap size={20} fill="currentColor"/>}
                    {isGenerating ? "AI Rendering..." : "Tạo Thumbnail Pro (-1 Credit)"}
                </button>
            </div>

            {/* Right Panel */}
            <div className="flex-1 bg-zinc-900/20 rounded-3xl border border-white/5 p-6 flex flex-col items-center justify-center relative min-h-[400px]">
                {currentResult ? (
                    <div className="relative max-w-full max-h-full shadow-2xl rounded-xl overflow-hidden group">
                        <img src={currentResult} className="max-w-full max-h-full object-contain rounded-xl"/>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <a href={currentResult} download={`Thumbnail-${Date.now()}.png`} className="bg-white text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-xl">
                                <Download size={20}/> Tải về (PNG High-Res)
                            </a>
                        </div>
                        <div className="absolute top-4 right-4 bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded shadow animate-pulse">
                            PREMIUM QUALITY
                        </div>
                    </div>
                ) : (
                    <div className="text-zinc-600 flex flex-col items-center gap-3">
                        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                            <MonitorPlay size={48} className="opacity-50 text-red-500"/>
                        </div>
                        <p className="text-lg font-light tracking-wide">YouTube Thumbnail Studio</p>
                        <p className="text-xs">Sẵn sàng thiết kế ảnh bìa triệu views</p>
                    </div>
                )}
            </div>

            <SuggestionModal 
                isOpen={showSuggestionsModal} 
                onClose={() => setShowSuggestionsModal(false)} 
                title="Ý tưởng Viral (Main + Sub)" 
                suggestions={suggestions} 
                onSelect={(item) => { 
                    setTextOverlay(item.vi); 
                    if (item.data?.sub) setSubText(item.data.sub);
                    setShowSuggestionsModal(false); 
                }}
            />
        </div>
    );
};

export default Thumbnail;
