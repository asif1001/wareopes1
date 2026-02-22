"use client";

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";

export const uploadFiles = (
    files: File[],
    collection: string,
    onProgress: (progress: number) => void,
    onComplete: (urls: string[]) => void,
    onError: (error: Error) => void
) => {
    const urls: string[] = [];
    let completed = 0;
    let totalProgress = 0;

    files.forEach((file) => {
        const storageRef = ref(storage, `${collection}/${Date.now()}-${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
            "state_changed",
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                totalProgress += progress;
                onProgress(totalProgress / files.length);
            },
            (error) => {
                onError(error);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                urls.push(downloadURL);
                completed++;
                if (completed === files.length) {
                    onComplete(urls);
                }
            }
        );
    });
};

export const uploadProfileImage = (file: File, userId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, `profile_images/${userId}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
            "state_changed",
            null,
            (error) => reject(error),
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
            }
        );
    });
};

export const deleteProfileImage = (imageUrl: string): Promise<void> => {
    const imageRef = ref(storage, imageUrl);
    return deleteObject(imageRef);
};

export const validateImageFile = (file: File): { isValid: boolean, error?: string } => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        return { isValid: false, error: 'Invalid file type. Please upload a JPG, PNG, or GIF.' };
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        return { isValid: false, error: 'File size exceeds 5MB.' };
    }
    return { isValid: true };
};

export const uploadProductionFile = (file: File, shipmentId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, `production_files/${shipmentId}/${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
            "state_changed",
            null,
            (error) => reject(error),
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
            }
        );
    });
};
