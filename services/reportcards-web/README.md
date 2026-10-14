# AppShule Report Cards — RC-4

Standalone, no-build SPA using HTML, CSS, and browser JavaScript.

## Run

Serve this directory with any static HTTP server (for example `python3 -m http.server 8080` from `services/reportcards-web`) and open the served URL. No package installation or build step is required. Font Awesome and DM Sans/Manrope are loaded from public CDNs; the interface remains usable without the icon font.

## API

The app calls `https://reportcards-api.apshule-migration.workers.dev`. School administrator and staff credentials are sent only to the API. A successful token is stored in localStorage under `appshule_reportcards_school_jwt`; reload verifies it with `/api/auth/me`. Sign out removes the stored token and account state. Private requests use `Authorization: Bearer <token>`.

The finance workspace is available to school administrators and staff with bursar, head-teacher, or director roles. Directors have read-only access except for expense approvals and rejections. The finance API is mounted at `/api/fin`; it includes income, expenses, class fee structures, budgets, reports, role assignment, SchoolPay webhooks, and reconciliation.

SchoolPay support accepts inbound transaction webhooks and supports automatic or manual reconciliation. The webhook URL is `https://reportcards-api.apshule-migration.workers.dev/api/fin/schoolpay/webhook`. When a consumer secret is configured, send an HMAC-SHA256 signature of the raw request body in `X-SchoolPay-Signature`. Credentials are encrypted by the API and are never returned to the browser. Provider-specific outbound polling is not implemented without an official SchoolPay API specification.

The application also includes the existing report-card preview and PDF generation. Network, authorization, validation, and empty states are surfaced in the UI.

## CSV learner import

Select a class and a UTF-8 CSV file with `reg_no` and `full_name` headers. Quoted fields, escaped quotes, commas, and embedded line breaks are supported. Optional headers: `gender`, `age`, `parent_name`, `parent_phone`, `parent_email`. API row errors are shown without displaying or storing initial learner passwords.

## CSV income import

The finance income page accepts up to 200 rows with `reg_no`, `amount`, `payment_method`, `term`, and `year` headers. Optional headers: `purpose`, `notes`, and `schoolpay_reference`. Payment methods are `cash`, `momo`, `bank`, `schoolpay`, or `cheque`; purposes are `fees`, `uniform`, `lunch`, `transport`, or `other`.
