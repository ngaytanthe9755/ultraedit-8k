
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

/**
 * LƯU MỤC:
 * Nếu đã liên kết Cloud -> Chỉ lưu Cloud.
 * Nếu chưa liên kết -> Chỉ lưu Local.
 */
export const saveItem = async (item: LibraryItem): Promise<void> => {
  if (driveService.isLinked()) {
      await driveService.syncItem(item.id, item);
      notifyLibraryChange();
      return;
  }

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_LIBRARY], 'readwrite');
    const store = transaction.objectStore(STORE_LIBRARY);
    store.put(item);

    transaction.oncomplete = () => {
        notifyLibraryChange();
        resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

/**
 * LẤY TOÀN BỘ:
 * Nếu đã liên kết -> Lấy từ Cloud.
 * Nếu chưa -> Lấy từ Local.
 */
export const getAllItems = async (): Promise<LibraryItem[]> => {
  if (driveService.isLinked()) {
      try {
          const cloudItems = await driveService.fetchAllFromCloud();
          // Lọc ra các LibraryItem hợp lệ
          return cloudItems.filter(i => i.id && i.type);
      } catch (e) {
          console.warn("[DB] Cloud fetch failed, falling back to local for viewing only.");
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

/**
 * XÓA MỤC:
 * Dựa trên trạng thái liên kết hiện tại.
 */
export const deleteItem = async (id: string): Promise<void> => {
  if (driveService.isLinked()) {
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
        notifyLibraryChange();
        resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteItems = async (ids: string[]): Promise<void> => {
    for (const id of ids) {
        await deleteItem(id);
    }
};

/**
 * LƯU NHÂN VẬT:
 * Tuân thủ quy tắc Cloud vs Local.
 */
export const saveCharacter = async (char: SavedCharacter): Promise<void> => {
  if (driveService.isLinked()) {
      await driveService.syncItem(`char_${char.id}`, char);
      notifyLibraryChange();
      return;
  }

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_CHARACTERS], 'readwrite');
    const store = transaction.objectStore(STORE_CHARACTERS);
    store.put(char);
    transaction.oncomplete = () => {
        notifyLibraryChange();
        resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export const getAllCharacters = async (): Promise<SavedCharacter[]> => {
  if (driveService.isLinked()) {
      try {
          const allCloud = await driveService.fetchAllFromCloud();
          // Nhận diện nhân vật qua ID prefix hoặc cấu trúc
          return allCloud.filter(i => i.name && i.base64Data);
      } catch (e) {
          return [];
      }
  }

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
    const data = JSON.parse(jsonString);
    let itemsCount = 0, charsCount = 0;

    if (driveService.isLinked()) {
        // Import thẳng lên Cloud
        if (Array.isArray(data.items)) {
            for (const item of data.items) { await driveService.syncItem(item.id, item); itemsCount++; }
        }
        if (Array.isArray(data.characters)) {
            for (const char of data.characters) { await driveService.syncItem(`char_${char.id}`, char); charsCount++; }
        }
        notifyLibraryChange();
        return { itemsCount, charsCount };
    }

    const db = await initDB();
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction([STORE_LIBRARY, STORE_CHARACTERS], 'readwrite');
            const itemStore = transaction.objectStore(STORE_LIBRARY);
            const charStore = transaction.objectStore(STORE_CHARACTERS);
            if (Array.isArray(data.items)) data.items.forEach((item: any) => { itemStore.put(item); itemsCount++; });
            if (Array.isArray(data.characters)) data.characters.forEach((char: any) => { charStore.put(char); charsCount++; });
            transaction.oncomplete = () => {
                notifyLibraryChange();
                resolve({ itemsCount, charsCount });
            };
            transaction.onerror = () => reject(transaction.error);
        } catch (error) { reject(error); }
    });
};
