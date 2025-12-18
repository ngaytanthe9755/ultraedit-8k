
import { LibraryItem, SavedCharacter } from '../types';
import { driveService } from './googleDriveService';

const DB_NAME = 'creative_studio_db';
const STORE_LIBRARY = 'library_items';
const STORE_CHARACTERS = 'saved_characters';
const DB_VERSION = 2;

const notifyLibraryChange = () => {
    window.dispatchEvent(new Event('library_updated'));
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

export const saveItem = async (item: LibraryItem): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_LIBRARY], 'readwrite');
    const store = transaction.objectStore(STORE_LIBRARY);
    const request = store.put(item);

    transaction.oncomplete = () => {
        // Background sync to Drive if configured
        if (driveService.isConfigured()) {
            driveService.syncItem(item.id, item).catch(err => console.warn("Cloud sync deferred", err));
        }

        setTimeout(() => {
            notifyLibraryChange();
        }, 200);
        resolve();
    };

    transaction.onerror = () => reject(transaction.error);
  });
};

export const getAllItems = async (): Promise<LibraryItem[]> => {
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
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_LIBRARY], 'readwrite');
    const store = transaction.objectStore(STORE_LIBRARY);
    store.delete(id);
    
    transaction.oncomplete = () => {
        if (driveService.isConfigured()) {
            driveService.deleteItem(id).catch(err => console.warn("Cloud delete deferred", err));
        }
        setTimeout(() => {
            notifyLibraryChange();
        }, 200);
        resolve();
    };
    
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteItems = async (ids: string[]): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_LIBRARY], 'readwrite');
        const store = transaction.objectStore(STORE_LIBRARY);
        
        ids.forEach(id => {
            store.delete(id);
            if (driveService.isConfigured()) {
                driveService.deleteItem(id).catch(() => {});
            }
        });
        
        transaction.oncomplete = () => {
            setTimeout(() => {
                notifyLibraryChange();
            }, 200);
            resolve();
        };
        
        transaction.onerror = () => reject(transaction.error);
    });
};

export const saveCharacter = async (char: SavedCharacter): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_CHARACTERS], 'readwrite');
    const store = transaction.objectStore(STORE_CHARACTERS);
    store.put(char);
    
    transaction.oncomplete = () => {
        if (driveService.isConfigured()) {
            driveService.syncItem(`char_${char.id}`, char).catch(() => {});
        }
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

export const exportDatabase = async (): Promise<string> => {
    const items = await getAllItems();
    const characters = await getAllCharacters();
    return JSON.stringify({ version: 1, timestamp: Date.now(), items, characters });
};

export const importDatabase = async (jsonString: string): Promise<{ itemsCount: number; charsCount: number }> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        try {
            const data = JSON.parse(jsonString);
            const transaction = db.transaction([STORE_LIBRARY, STORE_CHARACTERS], 'readwrite');
            const itemStore = transaction.objectStore(STORE_LIBRARY);
            const charStore = transaction.objectStore(STORE_CHARACTERS);
            let itemsCount = 0, charsCount = 0;
            if (Array.isArray(data.items)) data.items.forEach((item: any) => { itemStore.put(item); itemsCount++; });
            if (Array.isArray(data.characters)) data.characters.forEach((char: any) => { charStore.put(char); charsCount++; });
            transaction.oncomplete = () => {
                setTimeout(() => notifyLibraryChange(), 200);
                resolve({ itemsCount, charsCount });
            };
            transaction.onerror = () => reject(transaction.error);
        } catch (error) { reject(error); }
    });
};
