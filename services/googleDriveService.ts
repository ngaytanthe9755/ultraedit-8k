
/**
 * Service handling two-way interaction with Google Drive API
 * Uses Google Identity Services (GIS) for Auth and Google API Client (GAPI) for Requests.
 */

// Name of the folder in Google Drive where app data will be stored
const FOLDER_NAME = 'UltraEdit_8K_Data';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; // Only access files created by this app

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
        // Check rudimentary expiry if available, otherwise assume valid until 401
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
    }

    /**
     * Initialize GAPI and GIS scripts
     */
    public async initialize(): Promise<void> {
        if (!this.isConfigured()) throw new Error("Missing Client ID or API Key");

        return new Promise((resolve, reject) => {
            const gapi = (window as any).gapi;
            const google = (window as any).google;

            if (!gapi || !google) {
                reject(new Error("Google API scripts not loaded. Check internet connection."));
                return;
            }

            // 1. Init GAPI Client
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: this.config!.apiKey,
                        discoveryDocs: [DISCOVERY_DOC],
                    });
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

                    // Restore token if exists
                    if (this.config?.accessToken) {
                        gapi.client.setToken({ access_token: this.config.accessToken });
                    }

                    resolve();
                } catch (e) {
                    console.error("GAPI Init Error", e);
                    reject(e);
                }
            });
        });
    }

    /**
     * Trigger OAuth Flow Popup
     */
    public async login(): Promise<void> {
        if (!this.gisInited) await this.initialize();
        
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
                        (window as any).gapi.client.setToken(resp);
                        resolve();
                    }
                };
                
                // Request access
                if ((window as any).gapi.client.getToken() === null) {
                    this.tokenClient.requestAccessToken({ prompt: 'consent' });
                } else {
                    this.tokenClient.requestAccessToken({ prompt: '' });
                }
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
            const response = await gapi.client.drive.files.list({
                q: `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id)',
            });

            if (response.result.files.length > 0) {
                this.appFolderId = response.result.files[0].id;
            } else {
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
        } catch (e) {
            console.error("Error managing folder on Drive", e);
            throw e;
        }
    }

    /**
     * Upload or Update a file (JSON or Image)
     */
    public async uploadItem(item: any): Promise<void> {
        if (!this.isAuthenticated()) return;
        const gapi = (window as any).gapi;
        
        try {
            const folderId = await this.getAppFolderId();
            const fileName = `${item.id}.json`;

            // Check if file exists to update or create
            const listResp = await gapi.client.drive.files.list({
                q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
                fields: 'files(id)',
            });

            const fileContent = JSON.stringify(item);
            const contentType = 'application/json';
            const metadata = {
                name: fileName,
                mimeType: contentType,
                parents: listResp.result.files.length === 0 ? [folderId] : undefined // Only set parent on create
            };

            const multipartRequestBody =
                `\r\n--foo_bar_baz\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n` +
                `--foo_bar_baz\r\nContent-Type: ${contentType}\r\n\r\n${fileContent}\r\n` +
                `--foo_bar_baz--`;

            const method = listResp.result.files.length > 0 ? 'PATCH' : 'POST';
            const path = listResp.result.files.length > 0 
                ? `/upload/drive/v3/files/${listResp.result.files[0].id}`
                : '/upload/drive/v3/files';

            await gapi.client.request({
                path: path,
                method: method,
                params: { uploadType: 'multipart' },
                headers: { 'Content-Type': 'multipart/related; boundary=foo_bar_baz' },
                body: multipartRequestBody,
            });

            console.log(`[Drive] Synced item ${item.id}`);

        } catch (e) {
            console.error(`[Drive] Upload failed for ${item.id}`, e);
            // Optionally handle token expiry by calling login() again?
        }
    }

    /**
     * Download all JSON files from the app folder
     */
    public async fetchAllItems(): Promise<any[]> {
        if (!this.isAuthenticated()) throw new Error("Not authenticated");
        const gapi = (window as any).gapi;
        const folderId = await this.getAppFolderId();
        
        const items: any[] = [];
        let pageToken = null;

        try {
            do {
                const response: any = await gapi.client.drive.files.list({
                    q: `'${folderId}' in parents and mimeType = 'application/json' and trashed = false`,
                    fields: 'nextPageToken, files(id, name)',
                    pageToken: pageToken
                });

                const files = response.result.files;
                
                // Fetch content in parallel chunks to be faster
                const batchSize = 10;
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
        } catch (e) {
            console.error("Fetch all failed", e);
            throw e;
        }
    }

    /**
     * Delete file from Drive
     */
    public async deleteItem(id: string): Promise<void> {
        if (!this.isAuthenticated()) return;
        const gapi = (window as any).gapi;
        try {
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
