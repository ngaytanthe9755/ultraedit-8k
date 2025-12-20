
import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, doc, setDoc, getDocs, collection, deleteDoc, getDoc } from "firebase/firestore";
import { getStorage, FirebaseStorage, ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { getAuth, signInAnonymously, Auth } from "firebase/auth";
import { LibraryItem } from "../types";
import { v4 as uuidv4 } from 'uuid';

const COLLECTION_NAME = "library_items";
const STORAGE_PATH = "assets";

class FirebaseService {
    private app: FirebaseApp | null = null;
    private db: Firestore | null = null;
    private storage: FirebaseStorage | null = null;
    private auth: Auth | null = null;
    private config: any = null;

    constructor() {
        this.loadConfig();
    }

    private loadConfig() {
        const saved = localStorage.getItem('ue_firebase_config');
        if (saved) {
            try {
                this.config = JSON.parse(saved);
                this.initialize();
            } catch (e) {
                console.error("Invalid Firebase Config stored");
            }
        }
    }

    public saveConfig(configStr: string) {
        try {
            const cleaned = configStr.replace(/const firebaseConfig =/g, '').replace(/;/g, '').trim();
            let configObj;
            try {
                configObj = JSON.parse(cleaned);
            } catch {
                configObj = new Function("return " + cleaned)();
            }
            
            this.config = configObj;
            localStorage.setItem('ue_firebase_config', JSON.stringify(this.config));
            this.initialize();
            return true;
        } catch (e) {
            console.error("Failed to parse Firebase config", e);
            return false;
        }
    }

    public getConfig() {
        return this.config;
    }

    public clearConfig() {
        this.config = null;
        this.app = null;
        this.db = null;
        this.storage = null;
        localStorage.removeItem('ue_firebase_config');
    }

    public isConfigured(): boolean {
        return !!this.app;
    }

    private async initialize() {
        if (!this.config) return;
        try {
            this.app = initializeApp(this.config);
            this.db = getFirestore(this.app);
            this.storage = getStorage(this.app);
            this.auth = getAuth(this.app);
            await signInAnonymously(this.auth);
            console.log("[Firebase] Initialized & Authenticated");
        } catch (e) {
            console.error("[Firebase] Init Error:", e);
        }
    }

    public async testConnection(): Promise<boolean> {
        if (!this.db) await this.initialize();
        if (!this.db) return false;
        try {
            await getDocs(collection(this.db, COLLECTION_NAME));
            return true;
        } catch (e) {
            console.error("[Firebase] Test Connection Failed:", e);
            return false;
        }
    }

    private async processStoryImages(storyId: string, jsonContent: string): Promise<string> {
        if (!this.storage) return jsonContent;
        try {
            const structure = JSON.parse(jsonContent);
            if (!structure.episodes) return jsonContent;

            let hasChanges = false;
            const uploadPromises: Promise<void>[] = [];

            const uploadToStorage = async (base64: string, path: string): Promise<string | null> => {
                try {
                    const finalB64 = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
                    const fileRef = ref(this.storage!, path);
                    await uploadString(fileRef, finalB64, 'data_url');
                    return await getDownloadURL(fileRef);
                } catch (e) {
                    console.warn(`[Firebase] Upload failed: ${path}`, e);
                    return null;
                }
            };

            const queueUpload = (base64: string, path: string, callback: (url: string) => void) => {
                if (base64 && base64.length > 500 && !base64.startsWith('http')) {
                    uploadPromises.push(
                        uploadToStorage(base64, path).then(url => {
                            if (url) {
                                callback(url);
                                hasChanges = true;
                            }
                        })
                    );
                }
            };

            structure.episodes.forEach((ep: any, epIdx: number) => {
                if (ep.thumbnail) queueUpload(ep.thumbnail, `stories/${storyId}/ep${epIdx}_thumb`, (url) => ep.thumbnail = url);
                
                if (ep.thumbnailVariants && Array.isArray(ep.thumbnailVariants)) {
                    ep.thumbnailVariants.forEach((variant: string, vIdx: number) => {
                        queueUpload(variant, `stories/${storyId}/ep${epIdx}_var${vIdx}`, (url) => ep.thumbnailVariants[vIdx] = url);
                    });
                }

                if (ep.scenes && Array.isArray(ep.scenes)) {
                    ep.scenes.forEach((scene: any, scIdx: number) => {
                        if (scene.generatedImage) {
                            queueUpload(
                                scene.generatedImage, 
                                `stories/${storyId}/ep${epIdx}_scene${scIdx}_${uuidv4().slice(0,4)}`, 
                                (url) => scene.generatedImage = url
                            );
                        }
                    });
                }

                if (ep.endingImage) queueUpload(ep.endingImage, `stories/${storyId}/ep${epIdx}_ending`, (url) => ep.endingImage = url);
            });

            if (uploadPromises.length > 0) {
                console.log(`[Firebase] Offloading ${uploadPromises.length} story images...`);
                await Promise.all(uploadPromises);
            }

            return hasChanges ? JSON.stringify(structure) : jsonContent;
        } catch (e) {
            console.error("Story processing error", e);
            return jsonContent;
        }
    }

    public async uploadItem(item: LibraryItem): Promise<void> {
        if (!this.db || !this.storage) await this.initialize();
        if (!this.db || !this.storage) throw new Error("Firebase not initialized");

        try {
            // Clone item
            const payloadItem = { ...item };
            let storagePath = "";

            // 1. Single Image
            if (payloadItem.type !== 'story' && payloadItem.base64Data && payloadItem.base64Data.length > 100 && !payloadItem.base64Data.startsWith('http')) {
                const base64Content = payloadItem.base64Data.startsWith('data:') 
                    ? payloadItem.base64Data 
                    : `data:image/png;base64,${payloadItem.base64Data}`;
                
                const fileRef = ref(this.storage, `${STORAGE_PATH}/${payloadItem.id}`);
                await uploadString(fileRef, base64Content, 'data_url');
                const downloadUrl = await getDownloadURL(fileRef);
                
                payloadItem.base64Data = downloadUrl;
                storagePath = fileRef.fullPath;
                console.log(`[Firebase] Asset uploaded: ${downloadUrl}`);
            }

            // 2. Story Structure (JSON with heavy images)
            if (payloadItem.type === 'story' && payloadItem.textContent) {
                payloadItem.textContent = await this.processStoryImages(payloadItem.id, payloadItem.textContent);
            }

            // Save Metadata to Firestore
            const docPayload = {
                ...payloadItem,
                firebaseStoragePath: storagePath, 
                syncedAt: Date.now()
            };

            await setDoc(doc(this.db, COLLECTION_NAME, item.id), docPayload);
            console.log(`[Firebase] Metadata synced: ${item.id}`);

        } catch (e) {
            console.error("[Firebase] Upload failed", e);
            throw e;
        }
    }

    public async fetchAllItems(): Promise<LibraryItem[]> {
        if (!this.db) await this.initialize();
        if (!this.db) return [];

        try {
            const querySnapshot = await getDocs(collection(this.db, COLLECTION_NAME));
            const items: LibraryItem[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                items.push(data as LibraryItem);
            });
            return items;
        } catch (e) {
            console.error("[Firebase] Fetch failed", e);
            return [];
        }
    }

    public async deleteItem(id: string): Promise<void> {
        if (!this.db || !this.storage) await this.initialize();
        if (!this.db) return;

        try {
            const docRef = doc(this.db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.firebaseStoragePath) {
                    const fileRef = ref(this.storage, data.firebaseStoragePath);
                    await deleteObject(fileRef).catch(err => console.warn("Storage delete warn:", err));
                }
            }
            await deleteDoc(docRef);
            console.log(`[Firebase] Deleted ${id}`);
        } catch (e) {
            console.error("[Firebase] Delete error", e);
        }
    }
}

export const firebaseService = new FirebaseService();
