
export interface VideoScene {
  sceneNumber: number;
  visualPrompt: string;
  voiceover: string;
  character?: string; 
  generatedImage?: string;
  isGeneratingImage?: boolean;
  locationTag?: string; 
}

export interface VideoStrategy {
  title: string;
  platform: string;
  scenes: VideoScene[];
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning'; 
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  mode: string;
}

export interface SEOData {
    optimizedTitle: string;
    hashtags: string[];
    description: string;
    postingStrategy: string;
}

export interface StoryEpisode {
  episodeNumber: number;
  title: string;
  summary: string;
  scenes?: VideoScene[];
  seoData?: SEOData; 
  thumbnail?: string; 
}

export interface StorySettings {
    duration: number;
    durationUnit: 'sec' | 'min';
    aspectRatio: string;
    voiceMap: Record<string, string>; 
    background: string;
    textMode: 'yes' | 'no' | 'custom';
}

export interface StoryStructure {
  title: string;
  summary: string;
  episodes: StoryEpisode[];
  settings?: StorySettings; 
}

export enum ModuleType {
  HOME = 'home',
  NEW_CREATION = 'new_creation',
  STUDIO = 'studio',
  VEO_IDEAS = 'veo_ideas',
  IMAGE_TO_VIDEO = 'image_to_video',
  POSTER = 'poster',
  THUMBNAIL = 'thumbnail',
  CHARACTER_CREATOR = 'character_creator',
  STORY_CREATOR = 'story_creator',
  CHANNEL_BUILDER = 'channel_builder',
  LIBRARY = 'library',
  ADMIN_PANEL = 'admin_panel'
}

// --- NEW MODEL TIER TYPES ---
export type ModelTier = '1.5-free' | '2.5-verified' | '3.0-pro';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: number;
  read: boolean;
}

export interface SystemConfig {
    maintenanceMode: boolean;
    maintenanceEndTime: number;
    defaultAdminModel?: ModelTier; // Thêm cấu hình model mặc định cho Admin
}

export interface RegisteredUser {
  username: string;
  email: string;
  password?: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  modelTier: ModelTier; // Cấp độ mô hình
  permissions: Record<string, boolean>;
  credits: number;
  createdAt: number;
  deviceId?: string;
  currentSessionId?: string;
  telegramChatId?: string;
  notifications?: AppNotification[];
  systemConfig?: SystemConfig; 
}

export interface User extends RegisteredUser {
  isAuthenticated: boolean;
  sessionId?: string; 
}

export interface LibraryItem {
  id: string;
  type: 'image' | 'video_strategy' | 'veo_video' | 'character' | 'story_character' | 'story' | 'poster' | 'thumbnail' | 'channel_plan';
  prompt: string;
  createdAt: number;
  base64Data?: string; 
  videoData?: string; 
  textContent?: string; 
  meta?: any;
}

export interface SavedCharacter {
  id: string;
  name: string;
  base64Data: string;
  createdAt: number;
}

export interface ImageFile {
  id: string;
  url: string;
  file?: File;
}

export interface FilterState {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
}

export const DEFAULT_FILTERS: FilterState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: 0,
  sepia: 0
};
