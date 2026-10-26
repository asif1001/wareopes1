import type { AttendanceRules } from "./config";
import { MAX_PHOTO_BYTES } from "./config";
import { canManageStaff, type Actor } from "./actor";
import { AttendanceError, badRequest, conflict, forbidden, notFound } from "./errors";
import { COL, getStaff, type Db } from "./store";
import type { Staff } from "./types";

/** Selfie storage. Files are never public; they are streamed through an authorised API route. */
export interface PhotoStore {
  save(path: string, bytes: Buffer, contentType: string): Promise<void>;
  read(path: string): Promise<Buffer | null>;
  remove(path: string): Promise<void>;
}

type PhotoDoc = {
  staffId: string;
  path: string;
  contentType: string;
  size: number;
  uploadedAt: string;
};

const PHOTO_ID = /^[A-Za-z0-9_-]{8,64}$/;

function detectImageType(bytes: Buffer): string | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  return null;
}

/** Idempotent upload keyed by the phone-generated photo id. */
export async function savePhoto(db: Db, store: PhotoStore, staff: Staff, photoId: string, bytes: Buffer, now: Date) {
  if (!PHOTO_ID.test(photoId)) throw badRequest("Invalid photo id");
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw badRequest("Photo is empty or too large");
  const contentType = detectImageType(bytes);
  if (!contentType) throw badRequest("Photo must be a JPEG or PNG image");

  const ref = db.collection(COL.photos).doc(photoId);
  const existing = await ref.get();
  if (existing.exists) {
    const doc = existing.data() as PhotoDoc;
    if (doc.staffId !== staff.id) throw conflict("Photo id already used");
    return { photoId, duplicate: true };
  }

  const month = now.toISOString().slice(0, 7);
  const path = `attendance/selfies/${staff.id}/${month}/${photoId}.${contentType === "image/png" ? "png" : "jpg"}`;
  await store.save(path, bytes, contentType);
  const doc: PhotoDoc = { staffId: staff.id, path, contentType, size: bytes.length, uploadedAt: now.toISOString() };
  await ref.set(doc);
  return { photoId, duplicate: false };
}

export async function readPhoto(db: Db, store: PhotoStore, actor: Actor, photoId: string) {
  if (!PHOTO_ID.test(photoId)) throw badRequest("Invalid photo id");
  const snap = await db.collection(COL.photos).doc(photoId).get();
  if (!snap.exists) throw new AttendanceError(410, "PHOTO_GONE", "Photo not available (not uploaded yet or deleted after the retention period)");
  const doc = snap.data() as PhotoDoc;
  const staff = await getStaff(db, doc.staffId);
  if (!canManageStaff(actor, staff)) throw forbidden();
  const bytes = await store.read(doc.path);
  if (!bytes) throw notFound("Photo file missing");
  return { bytes, contentType: doc.contentType };
}

/** Cron: delete selfies older than the retention period. */
export async function purgeExpiredPhotos(db: Db, store: PhotoStore, rules: AttendanceRules, now: Date) {
  const cutoff = new Date(now.getTime() - rules.selfieRetentionDays * 86400000).toISOString();
  const snap = await db.collection(COL.photos).where("uploadedAt", "<", cutoff).get();
  for (const doc of snap.docs) {
    await store.remove((doc.data() as PhotoDoc).path);
    await doc.ref.delete();
  }
  return snap.size;
}

/** Firebase Storage implementation (Admin SDK; bucket from env like the rest of WareOps). */
export async function firebasePhotoStore(): Promise<PhotoStore> {
  const { getAdminDb } = await import("@/lib/firebase/admin");
  await getAdminDb();
  const { getStorage } = await import("firebase-admin/storage");
  const storage = getStorage();
  const envBucket = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "").replace(/^gs:\/\//, "");
  const project = envBucket.split(".")[0] || process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
  const candidates = [envBucket, `${project}.firebasestorage.app`, `${project}.appspot.com`].filter((c) => c && !c.startsWith("."));
  let bucket = storage.bucket();
  for (const candidate of candidates) {
    try {
      const [exists] = await storage.bucket(candidate).exists();
      if (exists) {
        bucket = storage.bucket(candidate);
        break;
      }
    } catch {
      // try the next name
    }
  }
  return {
    async save(path, bytes, contentType) {
      await bucket.file(path).save(bytes, {
        contentType,
        resumable: false,
        metadata: { cacheControl: "private, max-age=0, no-store" },
      });
    },
    async read(path) {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (!exists) return null;
      const [bytes] = await file.download();
      return bytes;
    },
    async remove(path) {
      await bucket.file(path).delete({ ignoreNotFound: true });
    },
  };
}
