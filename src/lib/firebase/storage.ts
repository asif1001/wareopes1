import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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