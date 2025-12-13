import { deleteObject, getStorage, ref as storageRef } from 'firebase/storage';

// Helper to delete a Firebase Storage object by download URL, gs:// URL, or storage file path
export async function deleteImageFromStorageByUrl(url: string | null | undefined): Promise<boolean> {
    try {
        if (!url) return false;
        // Accepts a full download URL like https://firebasestorage.googleapis.com/v0/b/BUCKET/o/path%2Fto%2Ffile.jpg?alt=media...
        // gs://bucket/path or path like 'announcements/...'
        const m = (url || '').match(/\/o\/([^?]+)/);
        let path: string | null = null;
        if (m && m[1]) {
            path = decodeURIComponent(m[1]);
        } else if (url.startsWith('gs://')) {
            path = url.replace(/^[^/]+:\/\/[\w.-]+\//, '');
        } else if (url.startsWith('/')) {
            path = url.replace(/^\//, '');
        } else if (!url.startsWith('http')) {
            // assume it's already a storage path
            path = url;
        }
        if (!path) return false;
        const storage = getStorage();
        const ref = storageRef(storage, path);
        console.log('Attempting to delete storage object at path:', path);
        await deleteObject(ref);
        console.log('Storage object deleted:', path);
        return true;
    } catch (err) {
        console.warn('deleteImageFromStorageByUrl failed for url', url, err);
        return false;
    }
}
