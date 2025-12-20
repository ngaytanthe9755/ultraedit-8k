
import { LibraryItem, SavedCharacter } from '../types';
import { driveService } from './googleDriveService'; // Import Service

const DB_NAME = 'creative_studio_db';
const STORE_LIBRARY = 'library_items';
const STORE_CHARACTERS = 'saved_characters';
const DB_VERSION = 2;

// --- EVENT BUS HELPER ---
const notifyLibraryChange = () => {
    // console.log("[DB] Transaction committed. Dispatching 'library_updated' event.");
    window.dispatchEvent(new Event('library_updated'));
};

// Helper to check Cloud Only Mode preference
const isCloudOnlyMode = (): boolean => {
    return localStorage.getItem('ue_cloud_only_mode') === 'true';
};

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
        console.error("DB Open Error:", request.error);
        reject(request.error);
    };
    
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_LIBRARY)) {
        const store = db.createObjectStore(STORE_LIBRARY, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CHARACTERS)) {
        const charStore = db.createObjectStore(STORE_CHARACTERS, { keyPath: 'id' });
        charStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

// --- Library Operations ---

// NEW: Helper to check if item exists without loading everything
export const hasItem = async (id: string): Promise<boolean> => {
    const db = await initDB();
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_LIBRARY], 'readonly');
        const store = transaction.objectStore(STORE_LIBRARY);
        const request = store.count(id); // Lightweight check

        request.onsuccess = () => {
            resolve(request.result > 0);
        };
        request.onerror = () => resolve(false);
    });
};

// UPDATED: saveItem with Cloud-Only logic
export const saveItem = async (item: LibraryItem, skipDriveSync: boolean = false): Promise<void> => {
  // CLOUD ONLY MODE: Bypass Local DB
  if (driveService.isConfigured() && driveService.isAuthenticated() && isCloudOnlyMode() && !skipDriveSync) {
      console.log("[DB] Cloud-Only Mode: Uploading directly to Drive, skipping Local DB.");
      try {
          await driveService.uploadItem(item);
          notifyLibraryChange();
          return;
      } catch (e) {
          console.error("[DB] Cloud upload failed, falling back to local DB for safety.", e);
          // Fallthrough to local save if cloud fails
      }
  }

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_LIBRARY], 'readwrite');
    const store = transaction.objectStore(STORE_LIBRARY);
    const request = store.put(item);

    transaction.oncomplete = () => {
        // Fire event locally
        setTimeout(() => {
            notifyLibraryChange();
        }, 200);
        
        // --- GOOGLE DRIVE AUTO-SYNC HOOK (Standard Mode) ---
        // Only trigger upload if we are NOT in the middle of a download sync AND NOT in cloud-only mode (handled above)
        if (!skipDriveSync && driveService.isConfigured() && driveService.isAuthenticated() && !isCloudOnlyMode()) {
            console.log("[DB] Triggering background Drive Upload...");
            driveService.uploadItem(item).catch(err => console.warn("Background Drive Upload failed", err));
        }
        
        resolve();
    };

    transaction.onerror = (event) => {
        console.error("Save Item Transaction Error:", transaction.error);
        reject(transaction.error);
    };

    request.onerror = (event) => {
        console.error("Save Item Request Error:", request.error);
    };
  });
};

export const getAllItems = async (): Promise<LibraryItem[]> => {
  // CLOUD ONLY MODE: Fetch directly from Drive
  if (driveService.isConfigured() && driveService.isAuthenticated() && isCloudOnlyMode()) {
      console.log("[DB] Cloud-Only Mode: Fetching list from Drive...");
      try {
          const items = await driveService.fetchAllItems();
          // Sort manually since Drive fetch might not be sorted
          return items.sort((a, b) => b.createdAt - a.createdAt);
      } catch (e) {
          console.error("[DB] Failed to fetch from Drive in Cloud-Only mode.", e);
          return [];
      }
  }

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_LIBRARY], 'readonly');
    const store = transaction.objectStore(STORE_LIBRARY);
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev');
    const items: LibraryItem[] = [];
    
    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        items.push(cursor.value);
        cursor.continue();
      } else {
        resolve(items);
      }
    };
  });
};

export const deleteItem = async (id: string): Promise<void> => {
  // CLOUD ONLY MODE: Delete from Drive directly
  if (driveService.isConfigured() && driveService.isAuthenticated() && isCloudOnlyMode()) {
      console.log("[DB] Cloud-Only Mode: Deleting from Drive...");
      await driveService.deleteItem(id);
      notifyLibraryChange();
      return;
  }

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_LIBRARY], 'readwrite');
    const store = transaction.objectStore(STORE_LIBRARY);
    store.delete(id);
    
    transaction.oncomplete = () => {
        setTimeout(() => {
            notifyLibraryChange();
        }, 200);
        
        // --- GOOGLE DRIVE DELETE HOOK ---
        if (driveService.isConfigured() && driveService.isAuthenticated()) {
             driveService.deleteItem(id).catch(err => console.warn("Background Drive Delete failed", err));
        }

        resolve();
    };
    
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteItems = async (ids: string[]): Promise<void> => {
    // CLOUD ONLY MODE: Batch delete from Drive
    if (driveService.isConfigured() && driveService.isAuthenticated() && isCloudOnlyMode()) {
        console.log("[DB] Cloud-Only Mode: Batch deleting from Drive...");
        await Promise.all(ids.map(id => driveService.deleteItem(id)));
        notifyLibraryChange();
        return;
    }

    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_LIBRARY], 'readwrite');
        const store = transaction.objectStore(STORE_LIBRARY);
        
        ids.forEach(id => {
            store.delete(id);
        });
        
        transaction.oncomplete = () => {
            setTimeout(() => {
                notifyLibraryChange();
            }, 200);
            
            if (driveService.isConfigured() && driveService.isAuthenticated()) {
                ids.forEach(id => driveService.deleteItem(id).catch(err => console.warn("Background Drive Delete failed", err)));
            }

            resolve();
        };
        
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getItemsByType = async (type: string): Promise<LibraryItem[]> => {
    const all = await getAllItems(); // getAllItems handles Cloud-Only logic
    return all.filter(i => i.type === type);
}

// --- Character Operations ---
export const saveCharacter = async (char: SavedCharacter): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_CHARACTERS], 'readwrite');
    const store = transaction.objectStore(STORE_CHARACTERS);
    store.put(char);
    
    transaction.oncomplete = () => {
        setTimeout(() => {
            notifyLibraryChange();
        }, 200);
        resolve();
    };
    
    transaction.onerror = () => reject(transaction.error);
  });
}

export const getAllCharacters = async (): Promise<SavedCharacter[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_CHARACTERS)) {
       resolve([]);
       return;
    }
    const transaction = db.transaction([STORE_CHARACTERS], 'readonly');
    const store = transaction.objectStore(STORE_CHARACTERS);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// --- Backup & Restore Operations ---
export const exportDatabase = async (): Promise<string> => {
    try {
        const items = await getAllItems();
        const characters = await getAllCharacters();
        
        const backupData = {
            version: 1,
            timestamp: Date.now(),
            items,
            characters
        };
        
        return JSON.stringify(backupData);
    } catch (error) {
        throw new Error("Failed to export database");
    }
};

export const importDatabase = async (jsonString: string): Promise<{ itemsCount: number; charsCount: number }> => {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
        try {
            const data = JSON.parse(jsonString);
            const transaction = db.transaction([STORE_LIBRARY, STORE_CHARACTERS], 'readwrite');
            const itemStore = transaction.objectStore(STORE_LIBRARY);
            const charStore = transaction.objectStore(STORE_CHARACTERS);

            let itemsCount = 0;
            let charsCount = 0;

            if (Array.isArray(data.items)) {
                data.items.forEach((item: LibraryItem) => {
                    itemStore.put(item);
                    itemsCount++;
                });
            }

            if (Array.isArray(data.characters)) {
                data.characters.forEach((char: SavedCharacter) => {
                    charStore.put(char);
                    charsCount++;
                });
            }

            transaction.oncomplete = () => {
                setTimeout(() => {
                    notifyLibraryChange();
                }, 200);
                resolve({ itemsCount, charsCount });
            };

            transaction.onerror = () => reject(transaction.error);

        } catch (error) {
            reject(error);
        }
    });
};
