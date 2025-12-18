
/**
 * Dịch vụ xử lý tương tác hai chiều với Google Drive API (V3)
 * Tối ưu hóa cho Google Identity Services (GIS)
 * Sử dụng cơ chế nạp Script động để tránh lỗi chặn script.
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
    private initialized: boolean = false;
    private scriptsLoaded: boolean = false;

    constructor() {
        this.loadConfig();
    }

    private loadConfig() {
        const saved = localStorage.getItem('ue_drive_config');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.config = {
                    clientId: (parsed.clientId || '').trim(),
                    apiKey: (parsed.apiKey || '').trim(),
                    accessToken: parsed.accessToken
                };
            } catch (e) {
                console.error("[Drive] Lỗi đọc cấu hình local");
            }
        }
    }

    public isConfigured(): boolean {
        return !!(this.config?.clientId && this.config?.apiKey);
    }

    /**
     * Nạp một script động vào trang web
     */
    private injectScript(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                console.log(`[Drive] Đã nạp: ${src}`);
                resolve();
            };
            script.onerror = () => {
                console.error(`[Drive] Không thể tải: ${src}`);
                reject(new Error(`Lỗi nạp script: ${src}. Có thể do AdBlock hoặc ISP chặn Google APIs.`));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Nạp đồng thời cả 2 thư viện cần thiết của Google
     */
    private async loadGoogleScripts(): Promise<void> {
        if (this.scriptsLoaded) return;
        
        console.log("[Drive] Bắt đầu nạp thư viện Google API...");
        try {
            await Promise.all([
                this.injectScript('https://apis.google.com/js/api.js'),
                this.injectScript('https://accounts.google.com/gsi/client')
            ]);
            this.scriptsLoaded = true;
        } catch (e) {
            this.scriptsLoaded = false;
            throw e;
        }
    }

    public async initialize(): Promise<void> {
        this.loadConfig();
        if (!this.isConfigured()) return;

        // 1. Nạp script động
        try {
            await this.loadGoogleScripts();
        } catch (e) {
            throw e;
        }
        
        const gapi = (window as any).gapi;
        const google = (window as any).google;

        if (!gapi || !google) {
            throw new Error("Thư viện Google chưa sẵn sàng sau khi nạp.");
        }

        return new Promise((resolve, reject) => {
            console.log("[Drive] Đang khởi tạo GAPI...");
            
            const loadTimeout = setTimeout(() => {
                reject(new Error("GAPI initialization timeout. Hãy kiểm tra kết nối mạng."));
            }, 20000);

            gapi.load('client', {
                callback: async () => {
                    clearTimeout(loadTimeout);
                    try {
                        await gapi.client.init({
                            apiKey: this.config!.apiKey,
                            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                        });

                        console.log("[Drive] Khởi tạo Identity Client...");
                        this.tokenClient = google.accounts.oauth2.initTokenClient({
                            client_id: this.config!.clientId,
                            scope: 'https://www.googleapis.com/auth/drive.file',
                            callback: (resp: any) => {
                                if (resp.error !== undefined) {
                                    console.error("[Drive] Auth Callback Error:", resp);
                                    return;
                                }
                                console.log("[Drive] Đăng nhập Cloud thành công.");
                                // Lưu token và config
                                this.config = {
                                    ...this.config!,
                                    accessToken: resp.access_token
                                };
                                localStorage.setItem('ue_drive_config', JSON.stringify(this.config));
                                
                                // Set token vào gapi
                                (window as any).gapi.client.setToken({ access_token: resp.access_token });
                                
                                this.initialized = true;
                                window.dispatchEvent(new Event('drive_linked'));
                            },
                        });

                        if (this.config?.accessToken) {
                            gapi.client.setToken({ access_token: this.config.accessToken });
                        }
                        
                        this.initialized = true;
                        console.log("[Drive] Dịch vụ Cloud đã sẵn sàng.");
                        resolve();
                    } catch (e: any) {
                        console.error("[Drive] GAPI Init Error:", e);
                        reject(new Error(`Lỗi khởi tạo GAPI: ${e.message || e.error}`));
                    }
                },
                onerror: (e: any) => {
                    clearTimeout(loadTimeout);
                    reject(new Error("GAPI load module 'client' failed."));
                }
            });
        });
    }

    public async authenticate(): Promise<void> {
        console.log("[Drive] Yêu cầu xác thực người dùng...");
        await this.initialize();
        
        if (!this.tokenClient) {
            throw new Error("Hệ thống xác thực chưa được tạo. Kiểm tra Client ID.");
        }
        
        try {
            // Luôn yêu cầu consent để đảm bảo cấp mới token nếu cần
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (e: any) {
            console.error("[Drive] Popup Error:", e);
            throw new Error("Không thể mở cửa sổ đăng nhập. Kiểm tra chặn popup.");
        }
    }

    private async getOrCreateFolder(): Promise<string | null> {
        if (this.folderId) return this.folderId;
        const gapi = (window as any).gapi;
        
        if (!gapi?.client?.drive) {
            try {
                await this.initialize();
            } catch (e) {
                return null;
            }
        }

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
            console.error("[Drive] Folder Management Error:", e);
            return null;
        }
    }

    public async syncItem(id: string, data: any): Promise<void> {
        if (!this.isConfigured() || !this.initialized) return;
        const gapi = (window as any).gapi;
        
        try {
            const folderId = await this.getOrCreateFolder();
            if (!folderId) return;

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
        } catch (e: any) {
            console.warn("[Drive] Sync failed silently.");
        }
    }

    public async fetchAllFromCloud(): Promise<any[]> {
        if (!this.isConfigured()) return [];
        const gapi = (window as any).gapi;
        
        try {
            const folderId = await this.getOrCreateFolder();
            if (!folderId) return [];

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
                    const data = typeof contentResp.result === 'string' ? JSON.parse(contentResp.result) : contentResp.result;
                    items.push(data);
                }
            }
            return items;
        } catch (e) {
            console.error("[Drive] Fetch error:", e);
            throw e;
        }
    }

    public async deleteItem(id: string): Promise<void> {
        if (!this.isConfigured() || !this.initialized) return;
        const gapi = (window as any).gapi;
        
        try {
            const folderId = await this.getOrCreateFolder();
            if (!folderId) return;

            const listResp = await gapi.client.drive.files.list({
                q: `name = '${id}.json' and '${folderId}' in parents and trashed = false`,
                fields: 'files(id)',
            });

            if (listResp.result.files.length > 0) {
                await gapi.client.drive.files.delete({ fileId: listResp.result.files[0].id });
            }
        } catch (e) {
            console.error("[Drive] Cloud delete error:", e);
        }
    }
}

export const driveService = new GoogleDriveService();
