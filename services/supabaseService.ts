
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LibraryItem } from '../types';
import { base64ToBlob } from './imageUtils';
import { v4 as uuidv4 } from 'uuid';

interface SupabaseConfig {
    url: string;
    key: string;
}

const TABLE_NAME = 'library_items';
const BUCKET_NAME = 'ultraedit-assets';

class SupabaseService {
    private client: SupabaseClient | null = null;
    private config: SupabaseConfig | null = null;

    constructor() {
        this.loadConfig();
    }

    private loadConfig() {
        const saved = localStorage.getItem('ue_supabase_config');
        if (saved) {
            this.config = JSON.parse(saved);
            this.initializeClient();
        }
    }

    private initializeClient() {
        if (this.config?.url && this.config?.key) {
            try {
                this.client = createClient(this.config.url, this.config.key, {
                    auth: { persistSession: false } // Optimize for API key usage
                });
            } catch (e) {
                console.error("Supabase Init Error", e);
                this.client = null;
            }
        }
    }

    public isConfigured(): boolean {
        return !!this.client;
    }

    public getConfig() {
        return this.config;
    }

    public saveConfig(url: string, key: string) {
        this.config = { url, key };
        localStorage.setItem('ue_supabase_config', JSON.stringify(this.config));
        this.initializeClient();
    }

    public clearConfig() {
        this.config = null;
        this.client = null;
        localStorage.removeItem('ue_supabase_config');
    }

    /**
     * Upload Asset to Supabase Storage
     * Returns the Public URL
     */
    private async uploadAssetToStorage(path: string, base64Data: string): Promise<string | null> {
        if (!this.client) return null;

        try {
            const blob = base64ToBlob(base64Data);
            
            // Upload to 'ultraedit-assets' bucket
            const { data, error } = await this.client.storage
                .from(BUCKET_NAME)
                .upload(path, blob, {
                    upsert: true,
                    contentType: 'image/png'
                });

            if (error) {
                console.warn(`[Supabase Storage] Upload failed for ${path}`, error.message);
                return null;
            }

            // Get Public URL
            const { data: publicUrlData } = this.client.storage
                .from(BUCKET_NAME)
                .getPublicUrl(path);

            return publicUrlData.publicUrl;
        } catch (e) {
            console.error("[Supabase Storage] Exception:", e);
            return null;
        }
    }

    /**
     * Special Handler for Stories:
     * Parses the JSON, finds all Base64 images in scenes/thumbnails,
     * uploads them, and returns the Clean JSON string with URLs.
     */
    private async processStoryImages(storyId: string, jsonContent: string): Promise<string> {
        try {
            const structure = JSON.parse(jsonContent);
            if (!structure.episodes) return jsonContent;

            let hasChanges = false;
            const uploadPromises: Promise<void>[] = [];

            // Helper to queue upload
            const queueUpload = (base64: string, path: string, callback: (url: string) => void) => {
                if (base64 && base64.startsWith('data:')) {
                    uploadPromises.push(
                        this.uploadAssetToStorage(path, base64).then(url => {
                            if (url) {
                                callback(url);
                                hasChanges = true;
                            }
                        })
                    );
                }
            };

            structure.episodes.forEach((ep: any, epIdx: number) => {
                // 1. Process Episode Thumbnail
                if (ep.thumbnail) {
                    queueUpload(ep.thumbnail, `stories/${storyId}/ep${epIdx}_thumb.png`, (url) => ep.thumbnail = url);
                }

                // 2. Process Thumbnail Variants
                if (ep.thumbnailVariants && Array.isArray(ep.thumbnailVariants)) {
                    ep.thumbnailVariants.forEach((variant: string, vIdx: number) => {
                        queueUpload(variant, `stories/${storyId}/ep${epIdx}_var${vIdx}.png`, (url) => ep.thumbnailVariants[vIdx] = url);
                    });
                }

                // 3. Process Scene Images
                if (ep.scenes && Array.isArray(ep.scenes)) {
                    ep.scenes.forEach((scene: any, scIdx: number) => {
                        if (scene.generatedImage) {
                            queueUpload(
                                scene.generatedImage, 
                                `stories/${storyId}/ep${epIdx}_scene${scIdx}_${uuidv4().slice(0,4)}.png`, 
                                (url) => scene.generatedImage = url
                            );
                        }
                    });
                }
                
                // 4. Process Ending Image
                if (ep.endingImage) {
                    queueUpload(ep.endingImage, `stories/${storyId}/ep${epIdx}_ending.png`, (url) => ep.endingImage = url);
                }
            });

            if (uploadPromises.length > 0) {
                console.log(`[Supabase] Offloading ${uploadPromises.length} images from Story Structure...`);
                await Promise.all(uploadPromises);
            }

            return hasChanges ? JSON.stringify(structure) : jsonContent;
        } catch (e) {
            console.error("Story processing error", e);
            return jsonContent; // Fallback to original
        }
    }

    /**
     * Upload or Update an Item in Supabase Table
     * OPTIMIZED: Automatically offloads Base64 to Storage Bucket
     */
    public async uploadItem(item: LibraryItem): Promise<void> {
        if (!this.client) return;

        // Clone item to avoid mutating local state reference
        const payloadItem = { ...item };

        // 1. Handle Single Image Items
        let storagePath = null;
        if (payloadItem.type !== 'story' && payloadItem.base64Data && payloadItem.base64Data.length > 500 && !payloadItem.base64Data.startsWith('http')) {
            const fileName = `${payloadItem.id}.png`;
            const publicUrl = await this.uploadAssetToStorage(fileName, payloadItem.base64Data);
            if (publicUrl) {
                payloadItem.base64Data = publicUrl; // Replace with URL
                storagePath = fileName;
            }
        }

        // 2. Handle Complex Story Structures (Recursive Image Offloading)
        if (payloadItem.type === 'story' && payloadItem.textContent) {
            payloadItem.textContent = await this.processStoryImages(payloadItem.id, payloadItem.textContent);
        }

        // Prepare payload for DB
        const dbPayload = {
            id: payloadItem.id,
            type: payloadItem.type,
            prompt: payloadItem.prompt,
            created_at: payloadItem.createdAt,
            meta: { ...payloadItem.meta, storagePath }, 
            base64_data: payloadItem.base64Data, 
            text_content: payloadItem.textContent,
        };

        const { error } = await this.client
            .from(TABLE_NAME)
            .upsert(dbPayload, { onConflict: 'id' });

        if (error) {
            console.error("Supabase Upload Error:", error);
            throw new Error(error.message);
        }
        
        console.log(`[Supabase] Synced item ${item.id}`);
    }

    /**
     * Download all items from Supabase
     */
    public async fetchAllItems(): Promise<LibraryItem[]> {
        if (!this.client) throw new Error("Supabase not configured");

        const { data, error } = await this.client
            .from(TABLE_NAME)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase Fetch Error:", error);
            throw new Error(error.message);
        }

        if (!data) return [];

        return data.map((row: any) => ({
            id: row.id,
            type: row.type,
            prompt: row.prompt,
            createdAt: row.created_at,
            meta: row.meta,
            base64Data: row.base64_data, 
            textContent: row.text_content
        }));
    }

    /**
     * Delete an item and its associated Storage file
     */
    public async deleteItem(id: string): Promise<void> {
        if (!this.client) return;

        // 1. Try to clean up storage based on type
        // Note: For stories, we'd theoretically need to list all files in 'stories/{id}/' and delete them.
        // Supabase Storage doesn't support recursive delete easily without listing first.
        // For simplicity, we delete the main record. Advanced cleanup can be a cron job.
        
        // 2. Delete DB Record
        const { error } = await this.client
            .from(TABLE_NAME)
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Supabase Delete Error:", error);
        } else {
            console.log(`[Supabase] Deleted record ${id}`);
        }
    }
    
    /**
     * Test Connection
     */
    public async testConnection(): Promise<boolean> {
        if (!this.client) return false;
        try {
            const { count, error } = await this.client
                .from(TABLE_NAME)
                .select('*', { count: 'exact', head: true });
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("Supabase Test Failed", e);
            return false;
        }
    }
}

export const supabaseService = new SupabaseService();
