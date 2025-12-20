
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LibraryItem } from '../types';

interface SupabaseConfig {
    url: string;
    key: string;
}

const TABLE_NAME = 'library_items';

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
                this.client = createClient(this.config.url, this.config.key);
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
     * Upload or Update an Item in Supabase Table
     */
    public async uploadItem(item: LibraryItem): Promise<void> {
        if (!this.client) return;

        // Flatten data for SQL
        // We use snake_case for DB columns usually, but to map cleanly we'll keep simple structure
        // Table schema expected: id (text), type (text), prompt (text), created_at (int8), meta (jsonb), base64_data (text)
        
        const payload = {
            id: item.id,
            type: item.type,
            prompt: item.prompt,
            created_at: item.createdAt,
            meta: item.meta,
            base64_data: item.base64Data, // Storing base64 directly in DB for simplicity in this implementation
            text_content: item.textContent, // For scripts
            video_data: item.videoData // Blob URLs can't be saved, but if it was base64 it would go here. Veo currently returns Blob URL locally.
                                      // Note: Video Blob URLs are local-only. Syncing videos requires uploading the file blob. 
                                      // For now, we skip video blob sync or assume text/image sync is priority.
        };

        const { error } = await this.client
            .from(TABLE_NAME)
            .upsert(payload, { onConflict: 'id' });

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
            .select('*');

        if (error) {
            console.error("Supabase Fetch Error:", error);
            throw new Error(error.message);
        }

        if (!data) return [];

        // Map back to LibraryItem
        return data.map((row: any) => ({
            id: row.id,
            type: row.type,
            prompt: row.prompt,
            createdAt: row.created_at,
            meta: row.meta,
            base64Data: row.base64_data,
            textContent: row.text_content
            // videoData is skipped as it needs re-generation or separate storage
        }));
    }

    /**
     * Delete an item
     */
    public async deleteItem(id: string): Promise<void> {
        if (!this.client) return;

        const { error } = await this.client
            .from(TABLE_NAME)
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Supabase Delete Error:", error);
        } else {
            console.log(`[Supabase] Deleted ${id}`);
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
