# Attendance module

GPS geofence attendance for contract warehouse staff. Staff use an Android app
(separate repo/folder); supervisors and admins use WareOps. All data lives in
the WareOps Firestore project and is read and written only by the server
(Firebase Admin SDK). Browsers and phones never access Firestore directly.

```
Android staff app ──HTTPS (staff token)──► /api/attendance/mobile/*  ┐
WareOps (existing login) ──cookie──────► /api/attendance/*          ├─► src/lib/attendance ─► Firestore att* collections
Cloud Scheduler ──X-Cron-Secret────────► /api/attendance/cron       ┘                       └► Storage attendance/selfies/
```

## Setup

### 1. Secrets

Two server-only secrets (at least 32 characters each):

| Variable | Purpose |
|---|---|
| `ATTENDANCE_TOKEN_SECRET` | Signs staff phone sessions. Rotating it logs all phones out. |
| `ATTENDANCE_CRON_SECRET` | Shared secret for the scheduler endpoint. |

Generate a value:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Local development: add both to `.env.local`.

Firebase App Hosting: store them in Secret Manager and reference them from
`apphosting.yaml` (not added to the repo yet, because App Hosting fails the
build if a referenced secret does not exist):

```bash
firebase apphosting:secrets:set attendance-token-secret
firebase apphosting:secrets:set attendance-cron-secret
firebase apphosting:secrets:grantaccess attendance-token-secret --backend wareopes
firebase apphosting:secrets:grantaccess attendance-cron-secret --backend wareopes
```

```yaml
# apphosting.yaml → runConfig.env
    - variable: ATTENDANCE_TOKEN_SECRET
      secret: attendance-token-secret
    - variable: ATTENDANCE_CRON_SECRET
      secret: attendance-cron-secret
```

### 2. Scheduler (every 15 minutes)

```bash
gcloud scheduler jobs create http attendance-cron \
  --location=us-central1 \
  --schedule="*/15 * * * *" --time-zone="Asia/Bahrain" \
  --http-method=POST \
  --uri="https://wareopes--expotracker-6e353.us-central1.hosted.app/api/attendance/cron?job=all" \
  --headers="X-Cron-Secret=<ATTENDANCE_CRON_SECRET>"
```

Jobs (all idempotent, safe to run late or twice): close forgotten overtime,
mark 24 h reminders / 48 h escalations, write day records (absences, missing
IN/OUT) for yesterday and today, auto-lock months, delete expired selfies.

### 3. Permissions

A new page key `attendance` appears in **Settings → Roles**. Grant:

| Action | Allows |
|---|---|
| `view` | Exceptions, day records, overtime list, reports, selfies, staff list |
| `add` | Create contractors, shifts, geofences, holidays, staff accounts |
| `edit` | Edit setup and staff, set PIN, reset device, corrections, overtime decisions, settings, lock month |
| `delete` | Deactivate setup items and staff accounts |

Users with role `Admin` have every action and are the only ones who can unlock
a month or read the audit log. Non-admins only see staff where they are the
supervisor or backup approver.

### 4. Firestore and Storage rules

No change needed. The existing default rule (`match /{document=**} { allow read, write: if false; }`)
already denies client access to the `att*` collections and to `attendance/` in Storage.
All queries use equality filters or a single-field range, so no composite
indexes are required.

## Rules (one config file)

Defaults live in `src/lib/attendance/config.ts` (`DEFAULT_RULES`) and are
copied into `attSettings/rules` on the first save from the Settings page.
Every value below can be changed in the app; nothing else in the code
hard-codes them.

| Rule | Key | Default |
|---|---|---|
| Timezone | `timezone` | `Asia/Bahrain` |
| Weekly off-days (0 = Sun … 6 = Sat) | `weeklyOffDays` | `[5]` (Friday) |
| OT rate on each off-day | `offDayRateTypes` | Fri → `FRIDAY`, Sat → `FRIDAY` |
| OT rate on holidays / workdays | `holidayRateType` / `workdayRateType` | `HOLIDAY` / `WEEKDAY` |
| Work on an off-day or holiday counts as OT | `offDayWorkIsOvertime` | `true` |
| IN / OUT window around shift start / end | per shift `graceBeforeMin` / `graceAfterMin` | 15 / 15 min |
| Late after | `lateThreshold` | `AFTER_GRACE` (start + 15 min) |
| On-time IN paid from shift start | `payFromShiftStartWhenOnTime` | `true` |
| OUT in window paid to shift end | `payToShiftEndWhenInWindow` | `true` |
| Leaving before the OUT window | `earlyOutPolicy` | `FLAG_EARLY_OUT` |
| Unpaid break | per shift `breakMinutes` | 0 |
| Rounding step / mode | `roundingStepMin` / `roundingMode` | 15 min / `DOWN` |
| OT allowed from | `otStartAfterShiftEndMin` | shift end + 30 min |
| OT auto-close | `otAutoCloseAfterMin`, `otAutoCloseAtLocal` | 240 min after OT In or 23:59, whichever first |
| OT reminder / escalation | `otReminderAfterHours` / `otEscalateAfterHours` | 24 h / 48 h |
| Month lock | `monthLockDay` | day 5 of the next month |
| Selfie retention | `selfieRetentionDays` | 90 days |
| Clock drift flag | `clockDriftToleranceMin` | 5 min |
| Poor GPS accuracy flag | `poorAccuracyM` | 100 m |
| "No sync" device alert | `noSyncAlertHours` | 24 h |
| Contractor comparison tolerance | `compareToleranceMin` | 15 min |
| App update | `latestAppVersion`, `minAppVersion`, `apkUrl`, `apkSha256` | `1.0.0` |

Fixed security settings (`MOBILE_AUTH` in the same file): access token 1 h,
refresh token 30 days, PIN 4–8 digits, lockout 15 min after 5 wrong PINs.

## How a day is calculated

- The attendance day runs from the IN window opening (shift start − 15 min) to
  the next day's IN window opening, so night shifts and OT past midnight stay on
  the day the shift started.
- First IN between the IN window opening and shift end counts; the last OUT
  from the OUT window opening wins; exits in between are ignored.
- IN after `lateThreshold` → `LATE`, paid from the actual IN. Early arrival is
  never paid before shift start.
- No IN by start + 15 min → `MISSING_IN`; still nothing at end + 15 min → `ABSENT`.
  IN without OUT at end + 15 min → `MISSING_OUT`.
- Off-days and holidays → `OFF` (+ `OFF_DAY_WORK` flag if events exist); their
  hours come only from approved OT.
- Mock GPS, rooted phones, poor accuracy, outside-geofence, clock drift and
  manual (notification-tap) check-ins are **flagged, never rejected**.
- Corrections are stored separately; `attDays.computed` keeps the original
  values, the top-level fields are the effective ones, and every change is in
  `attAudit`.
- Locked months are never recomputed; late-synced events for a locked month
  are kept (status `REJECTED`, reason `MONTH_LOCKED`) for review.

## Collections

`attSettings`, `attContractors`, `attStaff`, `attStaffCodes` (unique staff ID
index), `attShifts`, `attGeofences`, `attHolidays` (id = date), `attEvents`
(id = staff + client event id, makes sync idempotent), `attDays`
(id = staff + date), `attOvertime`, `attCorrections`, `attMonthLocks`
(id = YYYY-MM), `attAudit`, `attDeviceHealth`, `attConsents`, `attPhotos`.

Staff accounts are **not** stored in WareOps `Users`; staff PINs are scrypt
hashes and never leave the server.

## API

All responses are JSON `{ success, …, error?, code? }`.

### Phone (`Authorization: Bearer <accessToken>` + `X-Device-Id`)

| Method | Path | Body / query |
|---|---|---|
| POST | `/api/attendance/mobile/login` | `{ staffCode, pin, deviceId }` → tokens. First login binds the device. |
| POST | `/api/attendance/mobile/refresh` | `{ refreshToken, deviceId }` |
| GET | `/api/attendance/mobile/me` | Profile, geofences, 14-day calendar with exact window instants, today, open OT, consent, app update |
| POST | `/api/attendance/mobile/events` | `{ sentAt, events: [{ clientEventId, type, source, trigger, deviceTime, lat, lng, accuracyM, mockLocation, rooted, photoRef?, reason? }] }` (max 100) → per-event `ACCEPTED` / `DUPLICATE` / `REJECTED` |
| POST | `/api/attendance/mobile/photos` | multipart `photoId` + `file` (JPEG/PNG, ≤ 2 MB) |
| POST | `/api/attendance/mobile/health` | Device health report |
| POST | `/api/attendance/mobile/consent` | `{ version, accepted: true }` |
| POST | `/api/attendance/mobile/comments` | `{ date, text }` |
| GET | `/api/attendance/mobile/history?month=YYYY-MM` | Own days and OT |
| GET | `/api/attendance/mobile/app-version` | Public update check |

### WareOps (existing session cookie + `attendance` permission)

| Method | Path | Notes |
|---|---|---|
| GET, POST | `/api/attendance/setup/{contractors\|shifts\|geofences\|holidays}` | |
| PATCH, DELETE | `/api/attendance/setup/{entity}/{id}` | DELETE deactivates (holidays are deleted) |
| GET, POST | `/api/attendance/staff` | List includes device health issues |
| GET, PATCH | `/api/attendance/staff/{id}` | PATCH `{ action: update\|setPin\|resetDevice\|activate\|deactivate }` |
| GET, PUT | `/api/attendance/settings` | Partial update, validated |
| GET | `/api/attendance/exceptions?date=` | Problems only |
| GET | `/api/attendance/days?date=` or `?month=&staffId=` | |
| GET, POST | `/api/attendance/corrections` | POST `{ staffId, date, field, newValue, reason }` |
| GET | `/api/attendance/overtime?status=&month=` | |
| POST | `/api/attendance/overtime/{id}` | `{ action: APPROVE\|REJECT\|EDIT, minutes?, note }` |
| GET | `/api/attendance/reports/month?month=&contractorId=` | Approved OT only |
| POST | `/api/attendance/reports/compare` | `{ month, rows: [{ staffCode, date, status?, hours?, otHours? }] }` |
| GET, POST | `/api/attendance/month-lock` | POST `{ month, action: lock\|unlock, reason }` |
| GET | `/api/attendance/photos/{id}` | Streams the selfie; supervisors of that staff and admins only |
| GET | `/api/attendance/pending-count` | Nav badge |
| GET | `/api/attendance/audit?entityId=` | Admins only |
| POST | `/api/attendance/cron?job=all` | `X-Cron-Secret` header |

## Tests

```bash
npx vitest run src/__tests__/attendance
```

`src/__tests__/helpers/fake-firestore.ts` is an in-memory stand-in for the
Admin Firestore API, so the services are tested end to end without Firebase.
