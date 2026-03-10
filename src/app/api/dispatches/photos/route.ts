export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getStorage } from "firebase-admin/storage";
import { getCurrentUserPermissions } from "@/lib/server-permissions";

async function resolveBucket() {
    const storage = getStorage();
    const envBucket = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "").replace(/^gs:\/\//, "");
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
    const appOptions = (storage.app?.options || {}) as { projectId?: string; storageBucket?: string };
    const appProjectId = appOptions.projectId || "";
    const appBucket = (appOptions.storageBucket || "").replace(/^gs:\/\//, "");
    const candidates: string[] = [];
    if (envBucket) {
        const proj = envBucket.split(".")[0];
        if (envBucket.endsWith(".appspot.com")) {
            candidates.push(envBucket);
            if (proj) candidates.push(`${proj}.firebasestorage.app`);
        } else if (envBucket.endsWith(".firebasestorage.app")) {
            candidates.push(envBucket);
            if (proj) candidates.push(`${proj}.appspot.com`);
        } else {
            candidates.push(`${envBucket}.appspot.com`, `${envBucket}.firebasestorage.app`);
        }
    } else if (projectId) {
        candidates.push(`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`);
    } else if (appBucket) {
        const proj = appBucket.split(".")[0];
        if (appBucket.endsWith(".appspot.com")) {
            candidates.push(appBucket);
            if (proj) candidates.push(`${proj}.firebasestorage.app`);
        } else if (appBucket.endsWith(".firebasestorage.app")) {
            candidates.push(appBucket);
            if (proj) candidates.push(`${proj}.appspot.com`);
        } else {
            candidates.push(`${appBucket}.appspot.com`, `${appBucket}.firebasestorage.app`);
        }
    } else if (appProjectId) {
        candidates.push(`${appProjectId}.appspot.com`, `${appProjectId}.firebasestorage.app`);
    }
    for (const cand of candidates) {
        try {
            const b = storage.bucket(cand);
            const [exists] = await b.exists();
            if (exists) return b;
        } catch {}
    }
    return storage.bucket();
}

export async function POST(request: NextRequest) {
    try {
        const { ok } = await getCurrentUserPermissions();
        if (!ok && process.env.NODE_ENV !== "development") {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const dispatchId = String(formData.get("dispatchId") || "");
        const containerId = String(formData.get("containerId") || "");
        const file = formData.get("file");

        if (!dispatchId || !containerId || !(file instanceof File)) {
            return NextResponse.json({ success: false, error: "Missing dispatchId, containerId, or file" }, { status: 400 });
        }

        const bucket = await resolveBucket();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `dispatches/${dispatchId}/containers/${containerId}/${Date.now()}-${nanoid()}-${safeName}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const downloadToken = nanoid();

        await bucket.file(storagePath).save(buffer, {
            metadata: {
                contentType: file.type || "application/octet-stream",
                metadata: { firebaseStorageDownloadTokens: downloadToken },
                cacheControl: "public, max-age=31536000",
            },
            public: false,
        });

        const encodedPath = encodeURIComponent(storagePath);
        const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

        return NextResponse.json({
            success: true,
            photo: {
                fileName: file.name,
                storagePath,
                downloadURL: fileUrl,
                uploadedAt: new Date().toISOString(),
            },
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Upload failed";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
