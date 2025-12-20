
/**
 * Service handling two-way interaction with Google Drive API
 * Uses Google Identity Services (GIS) for Auth and Google API Client (GAPI) for Requests.
 * 
 * UPGRADE NOTES:
 * - Removed brittle 'discoveryDocs' URL which causes "API discovery response missing" errors.
 * - Implemented dynamic script loading.
 * - Used explicit `gapi.client.load` for Drive V3.
 * - Improved Multipart body construction.
 * - Added Smart Sync (syncRemoteToLocal).
 */

const FOLDER_NAME = 'UltraEdit_8K_Data';
// We do NOT use DISCOVERY_DOC in init anymore to prevent the specific error. We load 'drive', 'v3' directly.
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; 

interface DriveConfig {
    clientId: string;
    apiKey: string;
    accessToken?: string;
    tokenExpiry?: number;
    userEmail?: string;
}

class GoogleDriveService {
    private config: DriveConfig | null = null;
    private tokenClient: any = null;
    private gapiInited = false;
    private gisInited = false;
    private appFolderId: string | null = null;

    constructor() {
        this.loadConfig();
    }

    private loadConfig() {
        const saved = localStorage.getItem('ue_drive_config');
        if (saved) {
            this.config = JSON.parse(saved);
        }
    }

    public getConfig() {
        return this.config;
    }

    public isConfigured(): boolean {
        return !!(this.config?.clientId && this.config?.apiKey);
    }

    public isAuthenticated(): boolean {
        if (!this.config?.accessToken) return false;
        // Check if token is expired (giving 1 minute buffer)
        if (this.config.tokenExpiry && Date.now() > (this.config.tokenExpiry - 60000)) {
            console.warn("[Drive] Token expired");
            return false;
        }
        return true; 
    }

    public saveConfig(clientId: string, apiKey: string) {
        this.config = { ...this.config, clientId, apiKey };
        localStorage.setItem('ue_drive_config', JSON.stringify(this.config));
    }

    public clearConfig() {
        this.config = null;
        localStorage.removeItem('ue_drive_config');
        this.tokenClient = null;
        this.gapiInited = false;
        this.gisInited = false;
        this.appFolderId = null;
    }

    /**
     * Helper to dynamically load scripts if they are missing from index.html
     */
    private loadScript(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = (err) => reject(err);
            document.body.appendChild(script);
        });
    }

    /**
     * Initialize GAPI and GIS scripts robustly
     */
    public async initialize(): Promise<void> {
        if (!this.isConfigured()) throw new Error("Missing Client ID or API Key");

        // Ensure scripts are loaded
        await Promise.all([
            this.loadScript('https://apis.google.com/js/api.js'),
            this.loadScript('https://accounts.google.com/gsi/client')
        ]);

        return new Promise((resolve, reject) => {
            const gapi = (window as any).gapi;
            const google = (window as any).google;

            if (!gapi || !google) {
                reject(new Error("Google API scripts failed to load."));
                return;
            }

            if (this.gapiInited && this.gisInited) {
                resolve();
                return;
            }

            // 1. Init GAPI Client
            gapi.load('client', async () => {
                try {
                    // Initialize client WITHOUT discoveryDocs to avoid the "missing required fields" error
                    // Explicitly set discoveryDocs to empty array to be safe
                    await gapi.client.init({
                        apiKey: this.config!.apiKey,
                        discoveryDocs: [],
                    });

                    // Explicitly load Drive V3 using REST URL to bypass potential short-name discovery issues
                    // This is more robust than gapi.client.load('drive', 'v3')
                    try {
                        await gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
                    } catch (loadErr) {
                        console.warn("Failed to load Drive V3 via URL, trying short name...", loadErr);
                        await gapi.client.load('drive', 'v3');
                    }
                    
                    this.gapiInited = true;

                    // 2. Init GIS Token Client
                    this.tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: this.config!.clientId,
                        scope: SCOPES,
                        callback: (resp: any) => {
                            if (resp.error !== undefined) {
                                throw (resp);
                            }
                            // Save token
                            this.config = {
                                ...this.config!,
                                accessToken: resp.access_token,
                                tokenExpiry: Date.now() + (resp.expires_in * 1000)
                            };
                            localStorage.setItem('ue_drive_config', JSON.stringify(this.config));
                        },
                    });
                    this.gisInited = true;

                    // Restore token if exists and valid
                    if (this.config?.accessToken && this.isAuthenticated()) {
                        gapi.client.setToken({ access_token: this.config.accessToken });
                    }

                    resolve();
                } catch (e) {
                    console.error("GAPI/GIS Init Error", e);
                    reject(e);
                }
            });
        });
    }

    /**
     * Trigger OAuth Flow Popup
     */
    public async login(): Promise<void> {
        if (!this.gisInited || !this.tokenClient) await this.initialize();
        
        return new Promise((resolve, reject) => {
            try {
                // Override callback to capture resolution
                this.tokenClient.callback = (resp: any) => {
                    if (resp.error) {
                        reject(resp);
                    } else {
                        this.config = {
                            ...this.config!,
                            accessToken: resp.access_token,
                            tokenExpiry: Date.now() + (resp.expires_in * 1000)
                        };
                        localStorage.setItem('ue_drive_config', JSON.stringify(this.config));
                        // Set token for GAPI immediately
                        (window as any).gapi.client.setToken(resp);
                        resolve();
                    }
                };
                
                // Request access
                // If we already have a valid token, we might skip this, but login() implies user action
                this.tokenClient.requestAccessToken({ prompt: 'consent' });
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Ensure we have the dedicated App Folder
     */
    private async getAppFolderId(): Promise<string> {
        if (this.appFolderId) return this.appFolderId;
        const gapi = (window as any).gapi;

        try {
            // Check if folder exists
            const response = await gapi.client.drive.files.list({
                q: `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id)',
            });

            if (response.result.files && response.result.files.length > 0) {
                this.appFolderId = response.result.files[0].id;
            } else {
                // Create folder
                const folderMetadata = {
                    name: FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder',
                };
                const folder = await gapi.client.drive.files.create({
                    resource: folderMetadata,
                    fields: 'id',
                });
                this.appFolderId = folder.result.id;
            }
            return this.appFolderId!;
        } catch (e: any) {
            console.error("Error managing folder on Drive", e);
            if (e.status === 401) {
                throw new Error("Token expired. Please reconnect Drive.");
            }
            throw e;
        }
    }

    /**
     * Upload or Update a file (JSON or Image)
     */
    public async uploadItem(item: any): Promise<void> {
        if (!this.isAuthenticated()) {
            console.warn("[Drive] Not authenticated or token expired.");
            return;
        }
        
        const gapi = (window as any).gapi;
        
        try {
            // Ensure init if called directly
            if (!this.gapiInited) await this.initialize();

            const folderId = await this.getAppFolderId();
            const fileName = `${item.id}.json`;

            // Check if file exists to update or create
            const listResp = await gapi.client.drive.files.list({
                q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
                fields: 'files(id)',
            });

            const fileContent = JSON.stringify(item, null, 2); 
            const contentType = 'application/json';
            
            // Metadata part
            const metadata: any = {
                name: fileName,
                mimeType: contentType
            };

            const existingFileId = listResp.result.files.length > 0 ? listResp.result.files[0].id : null;

            if (!existingFileId) {
                metadata.parents = [folderId];
            }

            // Correctly construct Multipart body
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n\r\n' +
                fileContent +
                close_delim;

            const requestPath = existingFileId 
                ? `/upload/drive/v3/files/${existingFileId}`
                : '/upload/drive/v3/files';
                
            const method = existingFileId ? 'PATCH' : 'POST';

            await gapi.client.request({
                path: requestPath,
                method: method,
                params: { uploadType: 'multipart' },
                headers: { 
                    'Content-Type': 'multipart/related; boundary="' + boundary + '"' 
                },
                body: multipartRequestBody,
            });

            console.log(`[Drive] Synced item ${item.id} (${method})`);

        } catch (e: any) {
            console.error(`[Drive] Upload failed for ${item.id}`, e);
            if (e.status === 401 || e.status === 403) {
                // Token likely invalid
                this.config!.accessToken = undefined; // Force re-login next time
                localStorage.setItem('ue_drive_config', JSON.stringify(this.config));
            }
        }
    }

    /**
     * Download all JSON files from the app folder
     */
    public async fetchAllItems(): Promise<any[]> {
        if (!this.isAuthenticated()) throw new Error("Not authenticated or token expired");
        
        if (!this.gapiInited) await this.initialize();

        const gapi = (window as any).gapi;
        let folderId;
        try {
            folderId = await this.getAppFolderId();
        } catch (e) {
            throw new Error("Could not access App Folder. Please reconnect.");
        }
        
        const items: any[] = [];
        let pageToken = null;

        try {
            do {
                const response: any = await gapi.client.drive.files.list({
                    q: `'${folderId}' in parents and mimeType = 'application/json' and trashed = false`,
                    fields: 'nextPageToken, files(id, name)',
                    pageToken: pageToken,
                    pageSize: 100 
                });

                const files = response.result.files;
                
                // Fetch content in parallel chunks
                const batchSize = 5; 
                for (let i = 0; i < files.length; i += batchSize) {
                    const batch = files.slice(i, i + batchSize);
                    const contents = await Promise.all(batch.map((f: any) => 
                        gapi.client.drive.files.get({
                            fileId: f.id,
                            alt: 'media'
                        }).then((res: any) => res.result)
                    ));
                    items.push(...contents);
                }

                pageToken = response.result.nextPageToken;
            } while (pageToken);

            return items;
        } catch (e: any) {
            console.error("Fetch all failed", e);
            if (e.status === 401) throw new Error("Token expired. Please reconnect.");
            throw e;
        }
    }

    /**
     * Smart Sync: Downloads only missing items from Remote to Local
     */
    public async syncRemoteToLocal(): Promise<number> {
        if (!this.isAuthenticated()) return 0;
        if (!this.gapiInited) await this.initialize();

        const gapi = (window as any).gapi;
        let downloadedCount = 0;

        try {
            const folderId = await this.getAppFolderId();
            
            // Dynamic import to avoid circular dependency loop at file level
            const { hasItem, saveItem } = await import('./db');

            // 1. List all files in Drive Folder
            let pageToken = null;
            const remoteFiles: any[] = [];

            do {
                const response: any = await gapi.client.drive.files.list({
                    q: `'${folderId}' in parents and mimeType = 'application/json' and trashed = false`,
                    fields: 'nextPageToken, files(id, name)', // name is usually "UUID.json"
                    pageToken: pageToken,
                    pageSize: 100 
                });
                if (response.result.files) {
                    remoteFiles.push(...response.result.files);
                }
                pageToken = response.result.nextPageToken;
            } while (pageToken);

            // 2. Filter files that are missing locally
            const missingFiles = [];
            for (const file of remoteFiles) {
                // Assuming name is "UUID.json", remove extension to get ID
                const itemId = file.name.replace('.json', '');
                const exists = await hasItem(itemId);
                if (!exists) {
                    missingFiles.push(file);
                }
            }

            if (missingFiles.length === 0) {
                console.log("[Drive] Local DB is up to date.");
                return 0;
            }

            console.log(`[Drive] Found ${missingFiles.length} missing items. Syncing down...`);

            // 3. Download missing files in chunks
            const batchSize = 3; // Conservative batch for downloads
            for (let i = 0; i < missingFiles.length; i += batchSize) {
                const batch = missingFiles.slice(i, i + batchSize);
                
                await Promise.all(batch.map(async (f: any) => {
                    try {
                        const content = await gapi.client.drive.files.get({
                            fileId: f.id,
                            alt: 'media'
                        }).then((res: any) => res.result);
                        
                        // Save to local DB, but SKIP sync-up loop
                        if (content && content.id) {
                            await saveItem(content, true); 
                            downloadedCount++;
                        }
                    } catch (err) {
                        console.error(`[Drive] Failed to download ${f.name}`, err);
                    }
                }));
            }
            
            // Trigger UI update once
            if (downloadedCount > 0) {
                window.dispatchEvent(new Event('library_updated'));
            }

            return downloadedCount;

        } catch (e: any) {
            console.error("[Drive] Smart Sync Error", e);
            return 0;
        }
    }

    /**
     * Delete file from Drive
     */
    public async deleteItem(id: string): Promise<void> {
        if (!this.isAuthenticated()) return;
        const gapi = (window as any).gapi;
        
        try {
            // Ensure init if called directly
            if (!this.gapiInited) await this.initialize();

            const folderId = await this.getAppFolderId();
            const fileName = `${id}.json`;
            const listResp = await gapi.client.drive.files.list({
                q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
                fields: 'files(id)',
            });

            if (listResp.result.files.length > 0) {
                await gapi.client.drive.files.delete({ fileId: listResp.result.files[0].id });
                console.log(`[Drive] Deleted ${id}`);
            }
        } catch (e) {
            console.error("Delete failed", e);
        }
    }
}

export const driveService = new GoogleDriveService();
