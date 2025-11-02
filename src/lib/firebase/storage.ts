import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from 'firebase/storage';
import { app } from './firebase';

const storage = getStorage(app);

/**
 * Upload a profile image to Firebase Storage
 * @param file - The image file to upload
 * @param userId - The user's ID to create a unique path
 * @returns Promise<string> - The download URL of the uploaded image
 */
export async function uploadProfileImage(file: File, userId: string): Promise<string> {
  try {
    // Create a unique filename with timestamp
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `profile-${userId}-${timestamp}.${fileExtension}`;
    
    // Create a reference to the file location
    const storageRef = ref(storage, `profile-images/${fileName}`);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile image:', error);
    throw new Error('Failed to upload profile image');
  }
}

/**
 * Upload a production data file to Firebase Storage under the shipment path
 * Path: shipments/<shipmentId>/production/<timestamp>-<sanitizedFileName>
 * Returns both a download URL and the storage object path for server-side deletion later.
 */
export async function uploadProductionFile(file: File, shipmentId: string, uploaderId?: string): Promise<{ downloadURL: string; storagePath: string; fileName: string }> {
  try {
    const timestamp = Date.now();
    const originalName = file.name || 'upload.xlsx';
    const sanitizedName = originalName.replace(/[^A-Za-z0-9_.-]/g, '_');
    const fileName = `${timestamp}-${sanitizedName}`;
    const storagePath = `shipments/${String(shipmentId)}/production/${fileName}`;

    const storageRef = ref(storage, storagePath);
    const metadata: any = {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        shipmentId: String(shipmentId),
        uploaderId: uploaderId ? String(uploaderId) : '',
      },
    };
    const snapshot = await uploadBytes(storageRef, file, metadata);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return { downloadURL, storagePath, fileName: originalName };
  } catch (error) {
    console.error('Error uploading production file:', error);
    throw new Error('Failed to upload production file');
  }
}

/**
 * Delete a storage object by path (client-side). Prefer server-side deletion for authoritative cleanup.
 */
export async function deleteStoragePath(storagePath: string): Promise<void> {
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting storage path:', error);
  }
}

/**
 * Delete a profile image from Firebase Storage
 * @param imageUrl - The URL of the image to delete
 */
export async function deleteProfileImage(imageUrl: string): Promise<void> {
  try {
    // Extract the file path from the URL
    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+)\?/);
    
    if (pathMatch) {
      const filePath = decodeURIComponent(pathMatch[1]);
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
    }
  } catch (error) {
    console.error('Error deleting profile image:', error);
    // Don't throw error for deletion failures as it's not critical
  }
}

/**
 * Validate image file before upload
 * @param file - The file to validate
 * @returns boolean - Whether the file is valid
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Please select a valid image file (JPEG, PNG, or WebP)'
    };
  }
  
  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Image size must be less than 5MB'
    };
  }
  
  return { isValid: true };
}

/**
 * Upload a production file with progress reporting.
 * Uses resumable upload to surface percentage updates to the caller.
 */
export async function uploadProductionFileWithProgress(
  file: File,
  shipmentId: string,
  uploaderId: string | undefined,
  onProgress: (percent: number) => void
): Promise<{ downloadURL: string; storagePath: string; fileName: string }> {
  const timestamp = Date.now();
  const originalName = file.name || 'upload.xlsx';
  const sanitizedName = originalName.replace(/[^A-Za-z0-9_.-]/g, '_');
  const fileName = `${timestamp}-${sanitizedName}`;
  const storagePath = `shipments/${String(shipmentId)}/production/${fileName}`;

  const storageRef = ref(storage, storagePath);
  const metadata: any = {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      shipmentId: String(shipmentId),
      uploaderId: uploaderId ? String(uploaderId) : '',
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const task = uploadBytesResumable(storageRef, file, metadata);
      task.on(
        'state_changed',
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          if (Number.isFinite(pct)) onProgress(Math.max(0, Math.min(100, pct)));
        },
        (err) => reject(err),
        async () => {
          try {
            const downloadURL = await getDownloadURL(task.snapshot.ref);
            resolve({ downloadURL, storagePath, fileName: originalName });
          } catch (e) {
            reject(e);
          }
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}