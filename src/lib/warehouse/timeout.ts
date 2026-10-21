/**
 * Firestore calls can keep retrying for minutes when the browser is offline or
 * when security rules reject anonymous reads. The warehouse page is usable
 * without Firestore (local fallback), so every cloud call is bounded.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export const CLOUD_TIMEOUT_MS = 8000;
