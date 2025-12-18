
/**
 * Service handling two-way interaction with Google Drive API
 */

const FOLDER_NAME = 'UltraEdit_8K_Cloud_Storage';
const MIME_TYPE_JSON = 'application/json';

interface DriveConfig {
    clientId: string;
    apiKey: string;
    accessToken?: string;
}

class GoogleDriveService {
    private config: DriveConfig | null = null;
    private folderId: string | null = null;
    private tokenClient: any = null;

    constructor() {
        this.loadConfig();
    }

    private loadConfig() {
        const saved = localStorage.getItem('ue_drive_config');
        if (saved) {
            this.config = JSON.parse(saved);
        }
    }

    public isConfigured(): boolean {
        return !!(this.config?.clientId && this.config?.apiKey);
    }

    public async initialize(): Promise<void> {
        if (!this.isConfigured()) return;

        return new Promise((resolve, reject) => {
            const gapi = (window as any).gapi;
            const google = (window as any).google;

            if (!gapi || !google) {
                console.warn("Google API scripts not loaded");
                return resolve();
            }

            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: this.config!.apiKey,
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                    });

                    this.tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: this.config!.clientId,
                        scope: 'https://www.googleapis.com/auth/drive.file',
                        callback: (resp: any) => {
                            if (resp.error !== undefined) {
                                reject(resp);
                            }
                            this.config!.accessToken = resp.access_token;
                            localStorage.setItem('ue_drive_config', JSON.stringify(this.config));
                            resolve();
                        },
                    });

                    if (this.config?.accessToken) {
                        gapi.client.setToken({ access_token: this.config.accessToken });
                    }
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    public async authenticate(): Promise<void> {
        if (!this.tokenClient) await this.initialize();
        return new Promise((resolve) => {
            const gapi = (window as any).gapi;
            this.tokenClient.requestAccessToken({ prompt: gapi.client.getToken() === null ? 'consent' : '' });
            resolve();
        });
    }

    private async getOrCreateFolder(): Promise<string | null> {
        if (this.folderId) return this.folderId;
        const gapi = (window as any).gapi;

        try {
            const response = await gapi.client.drive.files.list({
                q: `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id)',
            });

            if (response.result.files.length > 0) {
                this.folderId = response.result.files[0].id;
            } else {
                const folderMetadata = {
                    name: FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder',
                };
                const folder = await gapi.client.drive.files.create({
                    resource: folderMetadata,
                    fields: 'id',
                });
                this.folderId = folder.result.id;
            }
            return this.folderId;
        } catch (e) {
            console.error("Error managing folder on Drive", e);
            return null;
        }
    }

    // --- UPLOAD / SYNC TO CLOUD ---
    public async syncItem(id: string, data: any): Promise<void> {
        if (!this.isConfigured()) return;
        const gapi = (window as any).gapi;
        const folderId = await this.getOrCreateFolder();
        if (!folderId) return;

        try {
            const listResp = await gapi.client.drive.files.list({
                q: `name = '${id}.json' and '${folderId}' in parents and trashed = false`,
                fields: 'files(id)',
            });

            const fileContent = JSON.stringify(data);
            const metadata = {
                name: `${id}.json`,
                mimeType: MIME_TYPE_JSON,
                parents: [folderId],
            };

            if (listResp.result.files.length > 0) {
                const fileId = listResp.result.files[0].id;
                await gapi.client.request({
                    path: `/upload/drive/v3/files/${fileId}`,
                    method: 'PATCH',
                    params: { uploadType: 'media' },
                    body: fileContent,
                });
            } else {
                const boundary = '-------314159265358979323846';
                const delimiter = "\r\n--" + boundary + "\r\n";
                const close_delim = "\r\n--" + boundary + "--";
                const multipartRequestBody =
                    delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) +
                    delimiter + 'Content-Type: ' + MIME_TYPE_JSON + '\r\n\r\n' + fileContent + close_delim;

                await gapi.client.request({
                    path: '/upload/drive/v3/files',
                    method: 'POST',
                    params: { uploadType: 'multipart' },
                    headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
                    body: multipartRequestBody,
                });
            }
        } catch (e) {
            console.error("Cloud upload failed", e);
        }
    }

    // --- NEW: RETRIEVE / FETCH FROM CLOUD (Exchange Info) ---
    public async fetchAllFromCloud(): Promise<any[]> {
        if (!this.isConfigured()) return [];
        const gapi = (window as any).gapi;
        const folderId = await this.getOrCreateFolder();
        if (!folderId) return [];

        try {
            const response = await gapi.client.drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name)',
            });

            const files = response.result.files;
            const items: any[] = [];

            for (const file of files) {
                if (file.name.endsWith('.json')) {
                    const contentResp = await gapi.client.drive.files.get({
                        fileId: file.id,
                        alt: 'media',
                    });
                    items.push(contentResp.result);
                }
            }
            return items;
        } catch (e) {
            console.error("Cloud retrieval failed", e);
            throw e;
        }
    }

    public async deleteItem(id: string): Promise<void> {
        if (!this.isConfigured()) return;
        const gapi = (window as any).gapi;
        const folderId = await this.getOrCreateFolder();
        if (!folderId) return;

        try {
            const listResp = await gapi.client.drive.files.list({
                q: `name = '${id}.json' and '${folderId}' in parents and trashed = false`,
                fields: 'files(id)',
            });

            if (listResp.result.files.length > 0) {
                await gapi.client.drive.files.delete({ fileId: listResp.result.files[0].id });
            }
        } catch (e) {
            console.error("Delete failed on Drive", e);
        }
    }
}

export const driveService = new GoogleDriveService();
