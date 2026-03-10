"use client";

import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage, secondaryStorage } from "./firebase";

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

export const uploadDispatchContainerPhotos = async (
    files: File[],
    dispatchId: string,
    containerId: string,
    onProgress: (progress: number) => void
): Promise<{ fileName: string; storagePath: string; downloadURL: string; uploadedAt: string }[]> => {
    if (files.length === 0) return [];
    const results: { fileName: string; storagePath: string; downloadURL: string; uploadedAt: string }[] = [];
    let completed = 0;

    for (const file of files) {
        let responseError: string | null = null;
        try {
            const formData = new FormData();
            formData.append("dispatchId", dispatchId);
            formData.append("containerId", containerId);
            formData.append("file", file);

            const res = await fetch("/api/dispatches/photos", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                if (data?.photo) {
                    results.push(data.photo);
                    completed += 1;
                    onProgress((completed / files.length) * 100);
                    continue;
                }
            }

            const error = await res.json().catch(() => ({}));
            responseError = error?.error || "Photo upload failed";
        } catch (error: any) {
            responseError = error?.message || "Photo upload failed";
        }

        try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const storagePath = `dispatches/${dispatchId}/containers/${containerId}/${Date.now()}-${safeName}`;
            
            // Prefer secondary storage if available (since primary has billing issues)
            const targetStorage = secondaryStorage || storage;
            if (secondaryStorage) {
                console.log('Using secondary storage for upload:', storagePath);
            }
            
            const uploadSnap = await uploadBytes(ref(targetStorage, storagePath), file);
            const downloadURL = await getDownloadURL(uploadSnap.ref);
            results.push({
                fileName: file.name,
                storagePath,
                downloadURL,
                uploadedAt: new Date().toISOString()
            });
        } catch (clientError: any) {
            throw new Error(responseError || clientError?.message || "Photo upload failed");
        }

        completed += 1;
        onProgress((completed / files.length) * 100);
    }

    return results;
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
