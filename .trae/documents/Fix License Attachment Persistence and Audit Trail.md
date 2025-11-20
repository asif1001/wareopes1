## Findings
- Client saves licenses via `LicenseForm` using `FormData` with key `attachments` in `src/components/maintenance-client-page.tsx:2308–2316`. Create: `POST /api/licenses` at `2314–2326`; Edit: `PUT /api/licenses/[id]` at `2316–2322`.
- Server create route handles multipart, uploads to Firebase Storage, persists `attachments` array and `attachmentUrl`, returns the saved item: `src/app/api/licenses/route.ts:54–105`.
- Server update route handles multipart, appends to `attachments`, sets `attachmentUrl`, but does NOT append to audit `history`: `src/app/api/licenses/[id]/route.ts:28–78`.
- License Details modal builds items from `lic.attachments` or falls back to `lic.attachmentUrl`: `src/components/maintenance-client-page.tsx:3633–3640` and renders grid: `3677–3700`.

## Hypotheses
1. Upload succeeds but server-side upload errors are swallowed, leaving `attachments` empty (silent catch): `route.ts:99`, `[id]/route.ts:63`.
2. Update route lacks audit entries, failing “complete audit trail”.
3. Client receives a response before attachments are persisted (race) — unlikely since `route.ts:98–104` reads back doc after update.

## Verification Steps
1. Server-side storage:
   - Use Firebase Console to check `Storage` for `licenses/<docId>/attachments/*` after saving.
2. Database records:
   - Open Firestore `licenses/<docId>` to verify `attachments` (array of URLs) and `attachmentUrl` populated.
3. File type/size tests:
   - Save with `.jpg` (~200KB) and `.pdf` (~300KB); verify preview in Details modal.
4. Network requests:
   - In browser DevTools, confirm `POST /api/licenses` or `PUT /api/licenses/<id>` is `multipart/form-data` and contains `attachments` file; response `201/200` includes `item.attachments` and `item.attachmentUrl`.
5. Logs:
   - Inspect server logs for upload/save errors during the call (Next.js server console).

## Implementation Plan
1. Improve error visibility:
   - Remove silent catch and log upload errors with context in `src/app/api/licenses/route.ts:80–99` and `src/app/api/licenses/[id]/route.ts:42–63`.
   - Optionally return a `partialSuccess` flag if file upload fails to prevent misleading “saved” status.
2. Audit trail on update:
   - In `src/app/api/licenses/[id]/route.ts`, append to `history` with `{ id, timestamp, userId, action: 'Updated license' }` and, if files added, include a note like `'Added attachments (n)'`.
3. Client confirmation message:
   - Keep current toasts but ensure `created`/`saved` item from server replaces local state (already done at `maintenance-client-page.tsx:2318–2329`).

## Testing Plan
- Manual flows for Add and Edit with image/pdf.
- Reopen the license and confirm attachments visible in Details modal: `maintenance-client-page.tsx:3677–3700`.
- Verify Firestore history contains both “Created license” and “Updated license” entries.

## Rollback & Impact
- Changes are server-only (plus safer logging); low risk to UI.
- If unexpected, revert the update route history changes.

Please confirm, and I’ll implement the changes and run verification steps.