# AppShule Report Cards — RC-2

Standalone, no-build SPA using HTML, CSS, and browser JavaScript.

## Run

Serve this directory with any static HTTP server (for example `python3 -m http.server 8080` from `services/reportcards-web`) and open the served URL. No package installation or build step is required. Font Awesome and DM Sans/Manrope are loaded from public CDNs; the interface remains usable without the icon font.

## API

The app calls `https://reportcards-api.apshule-migration.workers.dev`. School credentials are sent only to the API. A successful school token is stored in localStorage under `appshule_reportcards_school_jwt`; reload verifies it with `/api/auth/me`. Sign out removes the stored token and school state. Private requests use `Authorization: Bearer <token>`.

This frontend expects the API routes and request/response shapes described by the RC-2 API contract. Network, authorization, validation, and empty states are surfaced in the UI. Report card PDF generation is deliberately not implemented; it is scheduled for RC-3.

## CSV learner import

Select a class and a UTF-8 CSV file with `reg_no` and `full_name` headers. Quoted fields, escaped quotes, commas, and embedded line breaks are supported. Optional headers: `gender`, `age`, `parent_name`, `parent_phone`, `parent_email`. API row errors are shown without displaying or storing initial learner passwords.
