// A recursive function to convert non-serializable types to serializable ones.
// We avoid importing the client Firestore SDK here to prevent server code
// from accidentally pulling in client-only modules. Instead use duck-typing
// to detect objects that behave like Firestore Timestamps (have a toDate()).
export function makeSerializable<T>(obj: T): any {
    if (obj === null || obj === undefined) return obj;

    // Detect Firestore Timestamp-like objects (admin or client) by duck-typing
    if (typeof obj === 'object' && obj !== null && typeof (obj as any).toDate === 'function') {
        try {
            const d = (obj as any).toDate();
            if (d instanceof Date) return d.toISOString();
        } catch (_) {
            // Fall through if toDate throws for some unexpected shape
        }
    }

    if (obj instanceof Date) return obj.toISOString();

    if (Array.isArray(obj)) return obj.map(makeSerializable);

    if (typeof obj === 'object') {
        const serializableObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                serializableObj[key] = makeSerializable((obj as any)[key]);
            }
        }
        return serializableObj;
    }

    return obj;
}
