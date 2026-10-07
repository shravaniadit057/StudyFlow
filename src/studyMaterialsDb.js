// IndexedDB Utility for StudyFlow Study Materials Storage
// Stores raw file Blobs efficiently without bloating localStorage with base64 strings.

const DB_NAME = "StudyFlowDB";
const DB_VERSION = 1;
const STORE_NAME = "study_materials";

/**
 * Opens or initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function openMaterialsDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("folderId", "folderId", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open StudyFlowDB"));
    };
  });
}

/**
 * Saves a study material file blob to IndexedDB.
 * @param {string} id - Unique file identifier
 * @param {string|number} folderId - Associated folder/subject ID
 * @param {Blob|File} blob - The raw file blob
 * @param {Object} metadata - Metadata such as name, type, size, uploadedAt
 * @returns {Promise<boolean>}
 */
export async function saveMaterialBlob(id, folderId, blob, metadata = {}) {
  try {
    const db = await openMaterialsDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const record = {
        id,
        folderId,
        blob,
        name: metadata.name || "untitled",
        type: metadata.type || blob.type || "application/octet-stream",
        size: metadata.size || blob.size || 0,
        uploadedAt: metadata.uploadedAt || new Date().toISOString(),
      };

      const request = store.put(record);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error || new Error("Failed to save material blob"));
    });
  } catch (error) {
    console.error("IndexedDB save error:", error);
    throw error;
  }
}

/**
 * Retrieves a study material record (including the Blob) by its ID.
 * @param {string} id - The material ID
 * @returns {Promise<{id: string, folderId: any, blob: Blob, name: string, type: string, size: number}|null>}
 */
export async function getMaterialBlob(id) {
  try {
    const db = await openMaterialsDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(request.error || new Error("Failed to get material blob"));
      };
    });
  } catch (error) {
    console.error("IndexedDB read error:", error);
    return null;
  }
}

/**
 * Deletes a study material from IndexedDB by its ID.
 * @param {string} id - The material ID
 * @returns {Promise<boolean>}
 */
export async function deleteMaterialBlob(id) {
  try {
    const db = await openMaterialsDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error || new Error("Failed to delete material blob"));
    });
  } catch (error) {
    console.error("IndexedDB delete error:", error);
    return false;
  }
}

/**
 * Deletes all study materials associated with a specific folder ID.
 * @param {string|number} folderId - The folder ID
 * @returns {Promise<boolean>}
 */
export async function deleteMaterialsByFolder(folderId) {
  try {
    const db = await openMaterialsDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("folderId");
      const request = index.openKeyCursor(IDBKeyRange.only(folderId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve(true);
        }
      };

      request.onerror = () => reject(request.error || new Error("Failed to delete folder materials"));
    });
  } catch (error) {
    console.error("IndexedDB delete folder error:", error);
    return false;
  }
}

/**
 * Clears all study materials from IndexedDB (e.g., when deleting account).
 * @returns {Promise<boolean>}
 */
export async function clearAllMaterials() {
  try {
    const db = await openMaterialsDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error || new Error("Failed to clear materials store"));
    });
  } catch (error) {
    console.error("IndexedDB clear error:", error);
    return false;
  }
}
