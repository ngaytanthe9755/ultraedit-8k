
export interface VideoScene {
  sceneNumber: number;
  visualPrompt: string;
  voiceover: string;
  character?: string; // The character speaking this line
  generatedImage?: string;
  isGeneratingImage?: boolean;
  locationTag?: string; // NEW: Tag for location consistency (e.g., "BEDROOM_1", "KITCHEN")
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
  type: 'success' | 'error' | 'info' | 'warning'; // Added warning support
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
  seoData?: SEOData; // Added SEO Data
  thumbnail?: string; // Existing thumbnail field
}

export interface StorySettings {
    duration: number;
    durationUnit: 'sec' | 'min';
    aspectRatio: string;
    voiceMap: Record<string, string>; // Maps Character Name -> Voice Name
    background: string;
    textMode: 'yes' | 'no' | 'custom';
}

export interface StoryStructure {
  title: string;
  summary: string;
  episodes: StoryEpisode[];
  settings?: StorySettings; // Persist settings here
}

// --- NEW TYPES ---

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
  CHANNEL_BUILDER = 'channel_builder', // NEW
  LIBRARY = 'library',
  ADMIN_PANEL = 'admin_panel'
}

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
}

export interface RegisteredUser {
  username: string;
  email: string;
  password?: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  permissions: Record<string, boolean>;
  credits: number;
  createdAt: number;
  deviceId?: string;
  currentSessionId?: string;
  telegramChatId?: string;
  notifications?: AppNotification[];
  systemConfig?: SystemConfig; // For admin
}

export interface User extends RegisteredUser {
  isAuthenticated: boolean;
  sessionId?: string; // Mapped from currentSessionId for app state
}

export interface LibraryItem {
  id: string;
  type: 'image' | 'video_strategy' | 'veo_video' | 'character' | 'story_character' | 'story' | 'poster' | 'thumbnail' | 'channel_plan';
  prompt: string;
  createdAt: number;
  base64Data?: string; // For images
  videoData?: string; // For videos (blob url or base64)
  textContent?: string; // For scripts/stories (JSON string)
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
