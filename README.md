# Outreach Agent — LinkedIn HR & Recruiter Outreach Assistant

A web app that helps **each signed-in user**:

1. Import their connections from LinkedIn's official data export (`Connections.csv`).
2. Identify which of them are **HR, recruiters or talent-acquisition** professionals, based on job title.
3. Prepare a personalised job-outreach message for each person, using **the recipient's first name and company** and **the sender's own name, LinkedIn link and portfolio**.
4. Review each message, copy it, open the person's profile, and record that it was sent.
5. Track who was contacted and who replied, and avoid messaging the same person twice.

Everyone who signs in has their **own account, profile, CV and data**, isolated by Firestore security rules.

> **You always send the message yourself.** The app never sends anything on LinkedIn and never connects to a LinkedIn account. See [LinkedIn limitations](#linkedin-limitations-and-why-sending-is-manual).

العربية: [README.ar.md](README.ar.md)

---

## Table of contents

1. [Features](#features)
2. [LinkedIn limitations and why sending is manual](#linkedin-limitations-and-why-sending-is-manual)
3. [Tech stack](#tech-stack)
4. [Requirements](#requirements)
5. [Quick start (demo mode)](#quick-start-demo-mode)
6. [Getting your Connections.csv](#getting-your-connectionscsv)
7. [Firebase setup](#firebase-setup)
8. [How the CV is stored](#how-the-cv-is-stored)
9. [Environment variables](#environment-variables)
10. [Deploying to Firebase Hosting](#deploying-to-firebase-hosting)
11. [How to use it, step by step](#how-to-use-it-step-by-step)
12. [Pages](#pages)
13. [Keyboard shortcuts and mobile](#keyboard-shortcuts-and-mobile)
14. [Message template and placeholders](#message-template-and-placeholders)
15. [Project structure](#project-structure)
16. [Data model](#data-model)
17. [Security](#security)
18. [Scripts and tests](#scripts-and-tests)
19. [Troubleshooting](#troubleshooting)
20. [Known limitations](#known-limitations)
21. [Publishing to GitHub safely](#publishing-to-github-safely)

---

## Features

| Feature | Details |
|---|---|
| **Multi-user** | Each person signs in with their own account and has their own profile (name, LinkedIn URL, portfolio), CV, contacts and history |
| **Connection import** | Parses `Connections.csv`, skips LinkedIn's "Notes" preamble, auto-detects columns with manual mapping, preview before saving |
| **Deduplication** | By profile URL, then email, then name + company. Re-importing never duplicates people or overwrites edits |
| **Original data kept** | The raw row and its source (file name, import date) are stored with every contact |
| **Classification** | 18 editable default keywords, word-boundary matching ("HR" never matches "Chrome"), visible reason for each match |
| **Classification status** | Potential · Confirmed · Not relevant · Needs review. The app **never auto-confirms** anyone |
| **Filters** | Job title, company, location, relevance, has profile URL, contacted or not |
| **Templates** | Multiple templates, preview, change the target role, variant without an attachment |
| **Blocking checks** | A missing/invalid recipient name or company, or a missing sender name/LinkedIn/portfolio, **blocks the message** instead of producing wrong text |
| **CV** | PDF (max 3 MB), private per user, replace, download, no public URL |
| **Review & Send** | Edit, copy, open profile, duplicate-outreach warning, explicit confirmation before anything is recorded as sent |
| **Tracking** | Draft, sent, skipped, replied, plus an audit log |
| **Languages / theme** | English (default) and Arabic with RTL; light and dark |
| **Demo mode** | Runs without Firebase; demo data is clearly labelled |

---

## LinkedIn limitations and why sending is manual

Checked against LinkedIn's official documentation:

- There is **no public API** for third-party apps to read connections, send direct messages, or attach files. Those capabilities are restricted to approved partners.
- The **Member Data Portability API** is read-only and limited to members in the EU, EEA and Switzerland.
- Every other way to send automatically (taking a password, using session cookies, browser automation) **violates LinkedIn's terms** and can get an account restricted.

So this app **never asks for a LinkedIn password, never stores sessions or cookies, never scrapes pages and never controls the browser**.

| Capability | Status |
|---|---|
| Import connections | ✅ From the official export file |
| Refresh job title / company automatically | ❌ Edit manually |
| Send the message | ❌ The user pastes and sends it |
| Attach the CV | ❌ The user attaches it manually (paperclip icon) |
| Delivery status | ❌ Not verifiable. A message is recorded as sent only after the user confirms |

> Visible in the app under **Settings → LinkedIn integration**.

---

## Tech stack

- **Next.js 15** (App Router, **static export**) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS 4**
- **Firebase Authentication**, **Cloud Firestore** and **Firebase Hosting** — all on the free Spark plan
- **Zod** and **React Hook Form** for validation · **PapaParse** for CSV
- **Vitest** for tests · **ESLint**

There is **no custom server, no Firebase Storage and no third-party storage**.

---

## Requirements

- **Node.js 20 or newer** (tested on 22) and **npm**
- A **Google** account to create a Firebase project (free)
- A LinkedIn account to download the connections export

```bash
node -v
npm -v
```

---

## Quick start (demo mode)

Demo mode needs no configuration. Data stays **in this browser only**.

```bash
git clone <your-repo-url>
cd <your-repo-folder>
npm install
npm run dev
```

Open `http://localhost:3000`. A **"Demo mode"** banner is shown. On the dashboard click **Load demo data** to try the flow on fictional people tagged `DEMO`; remove them later in **Settings**.

---

## Getting your Connections.csv

1. Open <https://www.linkedin.com/mypreferences/d/download-my-data>.
2. Choose **Download larger data archive** (it includes connections per the page description), or pick **Connections** in the custom list if offered.
3. Click **Request archive**. LinkedIn emails you when it is ready (up to 24 hours).
4. Download and unzip it, then find **`Connections.csv`**.
5. Upload **only this file** on **Import Connections**. Don't upload the other files; they contain personal data.

Notes: the first lines are LinkedIn notes (skipped automatically); many emails are empty; job title and company are a snapshot from **export time** and may be outdated, so check them before sending.

---

## Firebase setup

Everything runs on the free **Spark** plan. Firebase Storage is **not** used.

### 1) Create the project
1. Open <https://console.firebase.google.com> and sign in with Google.
2. **Create a project**, name it, and turn Google Analytics off.

### 2) Authentication
1. **Build → Authentication → Get started**.
2. **Sign-in method**: enable **Email/Password** and **Google** (set a public-facing name and support email; ignore the Android SHA-1 warning).
3. **Settings → Authorized domains**: `localhost` and your `*.web.app` / `*.firebaseapp.com` domains are included automatically. Add a custom domain later if you use one.

### 3) Firestore
**Build → Firestore Database → Create database**, pick a nearby location, choose **Production mode**.

### 4) Web app config (public values)
1. ⚙️ **Project settings → General → Your apps**.
2. Click the web icon `</>`, name the app, register it.
3. Copy `apiKey`, `authDomain`, `projectId` and `appId`.

### 5) Hosting (once)
**Build → Hosting → Get started** and finish the short wizard (you can skip the CLI steps it shows; this repo already contains `firebase.json`).

---

## How the CV is stored

Because the app is static (no server) and uses no Storage bucket, the CV is saved **inside your own Firestore account**:

- The PDF is converted to base64 and split into chunks in the private `cvChunks` collection, with its metadata in `cvDocuments`.
- Firestore rules allow **only the owner** to read, create or delete them. There is no public link.
- Maximum size: **3 MB** (rules enforce it). Compress larger PDFs.
- Download reassembles the file in your browser.
- Each user has their own CV. Uploading a new one replaces the old one.

---

## Environment variables

Create **`.env.local`** next to `package.json` (template: `.env.example`):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_DEMO_MODE=false
```

- These values are **public identifiers** (not secrets), but they are **baked in at build time**: create `.env.local` **before** `npm run build`.
- Restart `npm run dev` after editing.
- If the "Demo mode" banner shows, a `NEXT_PUBLIC_FIREBASE_*` value is missing.
- No service-account key or other secret is needed anymore.

---

## Deploying to Firebase Hosting

The app is exported as static files (`out/`) and served by Firebase Hosting. From the project folder:

```bash
npm install
npm run build                                   # creates out/ (uses .env.local)
npx firebase-tools login
npx firebase-tools use your-project-id
npx firebase-tools deploy --only hosting,firestore:rules,firestore:indexes
```

Or build and deploy in one command:

```bash
npm run deploy
```

Your site is then at `https://your-project-id.web.app`.

Notes:

- **Publish the rules.** Without them every page shows `Missing or insufficient permissions`. Without a terminal, paste `firestore.rules` into **Firestore → Rules** and click Publish.
- The `activityLogs` index appears under **Firestore → Indexes** as *Building* then *Enabled* (a few minutes).
- Rebuild and redeploy after changing any `NEXT_PUBLIC_*` value.
- If the CLI says the Hosting site wasn't found, finish **Build → Hosting → Get started** once.
- **Who can sign up?** The page is public, so anyone can create an account (each sees only their own data). To restrict it, after creating your accounts disable **Enable create (sign-up)** under **Authentication → Settings → User actions**, if your console offers it.

---

## How to use it, step by step

### One-time preparation
1. **Settings → Your profile**: enter your full name, **your LinkedIn profile URL** and (optionally) your portfolio. These fill every message.
2. **CV Management**: upload your CV (PDF, up to 3 MB).
3. **Message Templates**: review the text and edit it to describe *you* (role, experience). **New variant without attachment** creates a version without the CV sentence.
4. **Settings**: review the keywords.

### Import and triage
5. **Import Connections**: upload `Connections.csv`, check the mapping and preview, then Import.
6. **HR & Recruiters**: review the list. Mark non-HR as **Not relevant**, real recruiters as **Confirmed**; fill in missing names, titles or companies in the contact page.

### Prepare and send
7. Select a small batch (5–10) and click **Prepare messages** (drafts only; nothing is sent).
8. In **Review & Send**, for each person: check the greeting and company → **Copy & Open Profile** (`C`) → on LinkedIn: Message, paste, attach the CV if wanted, Send → back in the app **Mark as Sent** (`M`), tick the confirmation, Enter. The page moves to the next person.

### Follow up
9. **Outreach History**: click **Record reply** when someone answers.
10. Periodically import a fresh `Connections.csv`; only new people are added.

**About the CV:** it can't be attached automatically. Download it once with **Download CV** on the review page and pick it from your Downloads folder in each conversation, or use a template without an attachment and send the CV when the person replies.

---

## Pages

| Page | Purpose |
|---|---|
| **Dashboard** | Key numbers, getting-started checklist, recent activity, draft queue |
| **Import Connections** | Upload, map columns, preview, save |
| **All Contacts** | Every connection with search, filters, sorting, pagination |
| **HR & Recruiters** | Relevant contacts and those needing a decision; prepare messages here |
| **Contact Details** | Edit data and notes, confirm or reject the classification, see original row and history |
| **Review & Send** | Review, copy, open profiles, record sending |
| **Message Templates** | Edit templates, change the target role, no-attachment variant |
| **CV Management** | Upload, replace, download, delete the CV |
| **Outreach History** | Message history, record replies, activity log |
| **Settings** | Your profile, keywords, language, integration status, remove demo data |

> People you already contacted are hidden from the tables by default (the "Contacted" filter) and can't be prepared again. They are kept to prevent duplicates and appear in History.

---

## Keyboard shortcuts and mobile

On **Review & Send**:

| Key | Action |
|---|---|
| `C` | Copy the message and open the profile |
| `M` | Open the mark-as-sent dialog |
| `S` | Skip this person |
| `←` `→` | Previous / next |
| `Enter` | Confirm in the dialog (after ticking the boxes) |

Shortcuts are disabled while typing in a field.

**On a phone** there is no keyboard, so a sticky bar at the bottom of the page offers *Copy & Open Profile*, *Mark as Sent* and *Skip*. Copying needs **HTTPS**, so test on the deployed URL, not on `http://<computer-ip>:3000`.

---

## Message template and placeholders

Default template:

```text
Dear {{FirstName}},

I hope you're doing well!

I'm a Frontend Developer with 3 years of experience, specializing in Angular and React. I'm currently exploring new opportunities and would really appreciate it if you could recommend me for any suitable Frontend Developer openings at {{Company}}. I would love to be part of your team there.

I've attached my CV for your reference. You can also check out my portfolio here:
{{Portfolio}}

Thank you for your time and support!

Best regards,
{{SenderName}}
{{SenderLinkedIn}}
```

> The role and experience sentence is an example. **Edit it in Message Templates** (or change `DEFAULT_TEMPLATE_BODY` in `src/lib/templates.ts`) to describe yourself.

| Placeholder | Comes from |
|---|---|
| `{{FirstName}}` `{{LastName}}` `{{FullName}}` `{{Company}}` `{{JobTitle}}` | The contact |
| `{{SenderName}}` `{{SenderLinkedIn}}` `{{Portfolio}}` | **Settings → Your profile** |

Safety rules:

- Missing/invalid **first name** or missing **company** → message blocked.
- Missing sender **name**, **LinkedIn link** or **portfolio** (when the template uses them) → message blocked, with a hint to fill your profile. After fixing it, click **Re-render from template**.
- Text says "attached" but no CV is selected → blocking error; with a CV selected → reminder that attaching is manual.
- Person already contacted → warning plus extra confirmation.

---

## Project structure

```text
.
├── .env.example                 Environment template
├── firebase.json                Hosting + Firestore config
├── firestore.rules              Firestore security rules
├── firestore.indexes.json       Required index
├── next.config.ts               Static export config
├── src/
│   ├── app/
│   │   ├── layout.tsx           Root layout
│   │   ├── login/page.tsx       Sign in
│   │   └── (app)/               Protected pages
│   │       ├── page.tsx         Dashboard
│   │       ├── import/          CSV import
│   │       ├── contacts/        All contacts
│   │       ├── contact/         Contact details (?id=…)
│   │       ├── recruiters/      HR & Recruiters
│   │       ├── review/          Review & Send
│   │       ├── templates/       Templates
│   │       ├── cv/              CV management
│   │       ├── history/         History
│   │       └── settings/        Profile and settings
│   ├── components/              UI components and app shell
│   └── lib/
│       ├── csv/                 parse · columns · dedupe · import-plan
│       ├── data/                Store: Firestore and localStorage (demo)
│       ├── firebase/client.ts   Firebase init
│       ├── providers/           LinkedIn provider interface (manual)
│       ├── classify.ts · names.ts · templates.ts · review.ts
│       ├── status.ts            Message status machine and send confirmation
│       ├── filters.ts · authz.ts
│       ├── cv.ts · cv-client.ts CV validation, chunking, upload/download
│       └── i18n*.ts(x)          English / Arabic
└── tests/                       Vitest tests
```

---

## Data model

Every document carries an `ownerId` and is protected by Firestore rules:

| Collection | Content |
|---|---|
| `contacts` | Name, title, company, profile URL, classification, outreach status, original row, source |
| `messageTemplates` | Templates |
| `outreachCampaigns` | Batches of prepared messages |
| `outreachMessages` | Each message, its status (draft · skipped · sent · replied) and how it was confirmed |
| `cvDocuments` | CV metadata (file name, size, chunk count) |
| `cvChunks` | The CV content as base64 chunks (owner-only) |
| `activityLogs` | Append-only audit log |
| `userSettings` | Profile (name, LinkedIn, portfolio), keywords, selected CV, language |

---

## Security

- **Isolation:** each user can read and write only their own documents (`ownerId` checks in the rules).
- **No sending without confirmation:** rules reject turning a message into "sent" without a confirmation record and forbid editing the text of a sent message.
- **Audit log** is append-only.
- **CV:** type, size and `%PDF-` signature are validated in the browser; the rules cap size and chunk count; storage is owner-only with no public URL.
- **Secrets:** none are needed in the app. Don't commit service-account keys or real exports.
- **Input:** CSV is sanitised (control characters removed, length capped, 10 MB / 50,000-row limits).
- **Headers:** `X-Frame-Options`, `nosniff`, `Referrer-Policy` are set in `firebase.json`.
- Security rules are the real boundary: the Firebase web config is public by design.

---

## Scripts and tests

```bash
npm run dev         # development server
npm run build       # static export to out/
npm run deploy      # build + deploy hosting and Firestore rules/indexes
npm run lint        # ESLint
npm run typecheck   # TypeScript check
npm test            # all tests
npm run test:rules  # Firestore rules tests (needs the emulator)
```

Tests cover CSV parsing, column mapping, deduplication, classification, name extraction, template rendering (including per-user sender data), CV validation and chunk round-trip, filtering, status transitions, ownership checks and the send-confirmation flow.

Rules tests need the emulator:

```bash
npx firebase-tools emulators:exec --only firestore "npm run test:rules"
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing or insufficient permissions` on every page | Rules not published or outdated. Redeploy `firestore.rules`; check that the project id is correct |
| "Demo mode" shows after deploying | `.env.local` was missing or incomplete **at build time**. Fix it, rebuild, redeploy |
| `The query requires an index` | Deploy `firestore:indexes` (or click the console link) and wait a few minutes |
| Google sign-in fails | Enable Google in Authentication; add custom domains to Authorized domains |
| CV upload fails | Use a real PDF under 3 MB; check the rules are published and you are signed in |
| Old CV can't be downloaded ("saved with an older method") | Upload it again |
| A message is blocked | Read the red warning (missing name/company, no CV, or empty profile fields). Fix it, then **Re-render from template** |
| `C` doesn't copy | Some browsers restrict clipboard access; use **Copy Message**, and use HTTPS |
| Blank page or 404 after deploy | Run `npm run build` first so `out/` exists, then deploy |
| `npx firebase-tools` asks to install | Answer `y` |

---

## Known limitations

- Filtering, sorting and pagination happen **in the browser** after contacts load: fine for thousands of contacts, not hundreds of thousands.
- Classification uses the **job title only**, which LinkedIn doesn't verify, so every "Potential" match needs review.
- Job title and company are a snapshot from export time.
- CV size is limited to **3 MB** because it is stored in Firestore.
- **Not exercised against a real Firebase project** in the build environment: the Firestore rules and the Firebase CV upload/download were tested with unit tests and review only. After setup, upload and download a CV, save a profile and a contact, and run `npm run test:rules`.
- Demo-mode data does not move to Firebase.
- Don't send large bursts of messages. LinkedIn's exact limits are unknown and heavy sending can put an account at risk.

---

## Publishing to GitHub safely

1. Confirm `.env.local` is **not** tracked: `git status` must not list it (`.gitignore` excludes `.env*` except `.env.example`, key files and build output).
2. Never commit service-account JSON files or real LinkedIn exports (`Connections.csv`).
3. If a secret was ever committed or pasted publicly, rotate it.
4. Add a `LICENSE` file of your choice before making the repository public.

```bash
git init
git add .
git status              # no .env.local, no node_modules, no out/
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

---

## Disclaimer

Use it in line with LinkedIn's terms and the data-protection laws that apply where you live, and don't send unsolicited bulk messages.
