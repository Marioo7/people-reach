# People Reach

Find the right people in your LinkedIn connections and send them personalised outreach — **you review and send every message yourself**.

Import your LinkedIn data export, filter contacts by job title (recruiters and HR by default; keywords are configurable, so you can target hiring managers, founders, sales prospects or other roles), prepare personalised messages, and track who you contacted and who replied.

Each signed-in user has their **own account, profile, CV and data**, isolated by Firestore security rules.

> **Not affiliated with LinkedIn.** The app never sends anything on LinkedIn and never connects to a LinkedIn account. See [LinkedIn limitations](#linkedin-limitations-and-why-sending-is-manual).

**Live:** https://people-reach.web.app

**Repository:** https://github.com/Marioo7/people-reach

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
21. [Disclaimer](#disclaimer)

---

## Features

| Feature | Details |
|---|---|
| **Multi-user accounts** | Each user has a separate profile, CV, contacts and outreach history |
| **Connection import** | Imports LinkedIn's `Connections.csv`, skips the Notes preamble, detects columns automatically and supports manual mapping |
| **Preview before import** | Review the detected columns and contact data before saving |
| **Deduplication** | Matches by profile URL, then email, then name and company. Re-importing does not duplicate contacts or overwrite existing edits |
| **Original data preserved** | Stores the original row and source information, including file name and import date |
| **Configurable targeting** | Editable default keywords with word-boundary matching, so `HR` does not match `Chrome` |
| **Classification workflow** | Potential, Confirmed, Not relevant and Needs review. Contacts are never automatically confirmed |
| **Contact filters** | Search and filter by job title, company, location, relevance, profile URL and outreach status |
| **Message templates** | Multiple templates, live previews, custom target roles and variants without an attachment sentence |
| **Personalised messages** | Uses the recipient's name and company and the sender's profile details |
| **Validation and safety checks** | Blocks messages when required recipient or sender information is missing or invalid |
| **Private CV management** | Upload, replace, download and delete a PDF CV, up to 3 MB, without a public file URL |
| **Manual review and sending** | Edit and copy messages, open profiles, check for duplicate outreach and explicitly confirm sending |
| **Outreach tracking** | Track drafts, skipped contacts, sent messages and replies, with an activity log |
| **English and Arabic** | English by default, Arabic with right-to-left layout support |
| **Light and dark themes** | Switch between light and dark appearances |
| **Demo mode** | Explore the application without connecting Firebase, using clearly labelled fictional data |

---

## LinkedIn limitations and why sending is manual

LinkedIn restricts access to connection data and messaging capabilities through its APIs and approved integrations. API availability and eligibility depend on the specific product and permissions.

This application uses the official LinkedIn data export instead of accessing a LinkedIn account directly.

The app **never asks for a LinkedIn password, stores LinkedIn sessions or cookies, scrapes LinkedIn pages, or controls the browser to send messages**.

| Capability | Status |
|---|---|
| Import connections | Supported through the official export file |
| Automatically refresh job titles and companies | Not supported; edit contact details manually |
| Send LinkedIn messages | Manual; the user pastes and sends each message |
| Attach the CV | Manual; the user selects and attaches the file |
| Verify message delivery | Not supported; sending is recorded only after user confirmation |

The Member Data Portability API is subject to LinkedIn's eligibility and regional restrictions. It should not be assumed to provide unrestricted access to connections or messaging.

The app therefore follows a simple workflow: prepare the message, review it, open the recipient's profile, send the message yourself, and then confirm the action in People Reach.

See **Settings → LinkedIn integration** in the app for the integration status and limitations.

---

## Tech stack

- **Next.js 15** — App Router and static export
- **React 19**
- **TypeScript** — strict type checking
- **Tailwind CSS 4**
- **Firebase Authentication** — email/password and Google sign-in
- **Cloud Firestore** — application data and security rules
- **Firebase Hosting** — static hosting
- **Zod** and **React Hook Form** — validation and forms
- **PapaParse** — CSV parsing
- **Vitest** — automated tests
- **ESLint** — code linting

The application uses a static deployment and does not require a custom application server or Firebase Storage. CV files are stored as private, chunked data in Firestore.

---

## Requirements

- Node.js 20 or newer; Node.js 22 is recommended.
- npm.
- A Google account to create a Firebase project for production mode.
- A LinkedIn account to download your connections export.

Check your installed versions:

```bash
node -v
npm -v
```

---

## Quick start (demo mode)

Demo mode requires no Firebase project or environment configuration. Its data stays in the current browser's local storage.

Clone the repository:

```bash
git clone https://github.com/Marioo7/people-reach.git
cd people-reach
npm install
npm run dev
```

Open:

http://localhost:3000

A **Demo mode** banner should appear. From the dashboard, select **Load demo data** to explore the workflow using fictional contacts labelled `DEMO`.

You can remove demo data later from Settings.

**Important:** Demo-mode data does not automatically transfer to a Firebase account. Use Firebase mode for persistent, account-specific data.

---

## Getting your Connections.csv

1. Open [LinkedIn's data download page](https://www.linkedin.com/mypreferences/d/download-my-data).
2. Select the larger data archive or choose Connections in the custom data selection, if available.
3. Request the archive.
4. Wait for LinkedIn's notification, then download and extract the archive.
5. Locate `Connections.csv`.
6. Open **Import Connections** in People Reach, upload that file, review the column mapping and preview, and confirm the import.

**Privacy tips:**

- Upload only `Connections.csv`; avoid uploading the complete archive because it may contain additional personal information.
- LinkedIn exports often contain empty email fields.
- Job titles and company names reflect the information available when the export was generated. Review them before contacting anyone.
- Keep your downloaded export private and delete local copies you no longer need.

---

## Firebase setup

The application can run on Firebase's free Spark plan within its current quotas and service limits. Usage beyond those limits may require a different plan or changes to the application.

Firebase Storage is not required.

### 1. Create a Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Sign in with Google.
3. Create a project and choose a project name.
4. Disable Google Analytics if you do not need it.

### 2. Configure Authentication

1. Open **Build → Authentication** and select **Get started**.
2. Under **Sign-in method**, enable:
   - Email/Password
   - Google
3. Configure the public-facing project name and support email.
4. Under **Settings → Authorized domains**, confirm that `localhost` and your Firebase Hosting domains are listed. Add any custom domain you use.

### 3. Configure Cloud Firestore

1. Open **Build → Firestore Database**.
2. Create a database.
3. Select a suitable location.
4. Choose **Production mode**.
5. Deploy the repository's Firestore security rules and indexes as described in the deployment section.

Do not leave production data accessible through permissive test rules.

### 4. Register the web application

1. Open **Project settings → General → Your apps**.
2. Select the web icon (`</>`) to register a web application.
3. Copy the following configuration values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`

These are Firebase web configuration values, not service-account credentials.

### 5. Set up Firebase Hosting

Open **Build → Hosting → Get started** and complete the initial setup if Hosting has not been initialized.

The repository already contains the Hosting configuration, so review it before deploying.

---

## How the CV is stored

People Reach is a static application and does not use Firebase Storage for CV uploads. Instead, the PDF is stored in the user's own Firestore data.

- The PDF is converted to base64 and split into chunks in the private `cvChunks` collection.
- File metadata is stored in `cvDocuments`.
- Firestore security rules restrict access to the document owner.
- The maximum supported PDF size is **3 MB**.
- The application reassembles the chunks in the browser when the user downloads the CV.
- Each account has its own CV. Uploading a replacement replaces the existing CV for that account.

There is no public CV URL.

**Security note:** Base64 encoding is not encryption. The privacy boundary relies on Firebase Authentication, Firestore security rules and appropriate project configuration.

---

## Environment variables

Create a `.env.local` file next to `package.json`. Use `.env.example` as a template.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_DEMO_MODE=false
```

Replace the placeholders with the values from your Firebase web app configuration.

Important notes:

- Create `.env.local` **before** running `npm run build`, because public environment variables are embedded in the generated frontend at build time.
- Restart the development server after changing environment variables.
- If the Demo mode banner appears unexpectedly, check that all required Firebase values are present and that `NEXT_PUBLIC_DEMO_MODE` is set correctly.
- No Firebase service-account key is required by the client application.
- Never commit `.env.local`, service-account JSON files or other private credentials.

---

## Deploying to Firebase Hosting

The application exports static files into the `out/` directory.

From the project directory:

```bash
npm install
npm run build
npx firebase-tools login
npx firebase-tools use your-project-id
npx firebase-tools deploy --only hosting,firestore:rules,firestore:indexes
```

Replace `your-project-id` with your actual Firebase project ID.

Alternatively, use the project's deploy script:

```bash
npm run deploy
```

The deployed URL typically follows this format:

```text
https://your-project-id.web.app
```

### Deployment checklist

- **Publish Firestore rules.** Missing or outdated rules can cause `Missing or insufficient permissions` errors.
- **Deploy Firestore indexes.** Wait until any required indexes finish building.
- **Rebuild after environment changes.** Changing a `NEXT_PUBLIC_*` value requires a new build and deployment.
- **Initialize Hosting first.** If the CLI says the Hosting site was not found, complete the initial Hosting setup in the Firebase Console.
- **Review public registration.** Anyone who can access an enabled public sign-up page may be able to create an account. Each user's data should remain isolated, but public registration should be an intentional decision.

Before using the live site with real contact data, test sign-in, data isolation, CSV import, profile updates, CV upload/download and message tracking.

---

## How to use it, step by step

### 1. Set up your profile

Open **Settings → Your profile** and enter:

- Your full name.
- Your LinkedIn profile URL.
- Your portfolio URL, if available.

These details are used to personalise your messages.

### 2. Upload your CV

Open **CV Management** and upload a PDF no larger than 3 MB.

### 3. Configure message templates

Open **Message Templates** and update the wording to describe your background, experience and target role accurately.

If you do not want to mention an attachment, create or select a variant without the attachment sentence.

### 4. Configure targeting keywords

Open **Settings** and review the classification keywords.

The default keywords focus on HR, recruiting and talent acquisition. You can customise them for other professional roles, such as hiring managers, founders or sales contacts.

### 5. Import connections

Open **Import Connections** and upload `Connections.csv`.

Review the detected columns, correct the mapping if needed, preview the contacts and then import them.

### 6. Review the target contacts

Open **Target Contacts** or the corresponding contact list in the current interface.

Review potential matches before preparing messages:

- Confirm people who match your target audience.
- Mark irrelevant contacts as **Not relevant**.
- Correct missing or outdated names, job titles and company details.
- Review the person's profile before deciding to contact them.

### 7. Prepare messages

Select a small batch, such as 5–10 contacts, and choose **Prepare messages**.

This creates drafts only. **Nothing is sent automatically.**

### 8. Review and send manually

For each contact in **Review & Send**:

1. Check the greeting, company name and message content.
2. Select **Copy & Open Profile**, or press `C`.
3. Open the person's LinkedIn profile.
4. Start the conversation and paste the message.
5. Attach your CV manually if you want to include it.
6. Review the message and send it yourself.
7. Return to People Reach and select **Mark as Sent**, or press `M`.
8. Complete the confirmation steps to record the action.

The application advances to the next person when the workflow permits.

### 9. Track replies

Open **Outreach History** and select **Record reply** when a person responds.

The app does not read LinkedIn messages or verify delivery automatically. Reply tracking is manual.

### 10. Update your contacts

Periodically download a fresh LinkedIn connections export and import it again. Existing contacts are deduplicated, and re-importing does not overwrite your existing edits.

### CV attachment workflow

The CV cannot be attached automatically to LinkedIn messages.

You can download your CV using **Download CV** and select it manually in each conversation. Alternatively, use a message template without the attachment sentence and share your CV when appropriate.

---

## Pages

| Page | Purpose |
|---|---|
| **Dashboard** | Key statistics, setup checklist, recent activity and draft queue |
| **Import Connections** | Upload CSV, map columns, preview and import |
| **All Contacts** | Search, filter, sort and paginate through imported connections |
| **Target Contacts** | Review relevant contacts and those needing a classification decision |
| **Contact Details** | Edit contact information and notes, review classification, and inspect original data and history |
| **Review & Send** | Review and copy messages, open profiles and record manual sending |
| **Message Templates** | Edit message templates, target roles and attachment variants |
| **CV Management** | Upload, replace, download and delete your CV |
| **Outreach History** | Review outreach records, record replies and inspect the activity log |
| **Settings** | Manage your profile, targeting keywords, language, integration status and demo data |

> **Current interface limitation:** Some navigation labels, including `HR & Recruiters`, may still be fixed in the application even when targeting keywords are configurable. The README's general targeting description does not imply that every interface label is already customisable.

Contacts already marked as contacted are hidden from relevant tables by default, depending on the selected filters. Their records remain available in the history to help prevent duplicate outreach.

---

## Keyboard shortcuts and mobile

On the **Review & Send** page:

| Key | Action |
|---|---|
| `C` | Copy the message and open the profile |
| `M` | Open the mark-as-sent dialog |
| `S` | Skip the current contact |
| `←` / `→` | Move to the previous or next contact |
| `Enter` | Confirm an action in a dialog after completing the required confirmation steps |

Shortcuts are disabled while typing in input fields.

### Mobile support

On mobile devices, a sticky action bar provides the available actions, including copying the message, opening the profile, marking a message as sent and skipping a contact.

Clipboard access generally requires a secure context such as HTTPS. Test the deployed HTTPS URL rather than relying on an HTTP address on your local network.

---

## Message template and placeholders

The default template is an example. Edit it to reflect your own background and the purpose of your outreach.

```text
Dear {{FirstName}},

I hope you're doing well!

I'm a Frontend Developer with 3 years of experience, specialising in Angular and React. I'm currently exploring new opportunities and would appreciate it if you could recommend me for any suitable Frontend Developer openings at {{Company}}.

I've included my CV for your reference. You can also check out my portfolio here:
{{Portfolio}}

Thank you for your time and support!

Best regards,
{{SenderName}}
{{SenderLinkedIn}}
```

**Important:** The template text is not a claim that a CV has been attached. Attach it manually before sending if the message says it is included.

To change the default template in the source code, edit `DEFAULT_TEMPLATE_BODY` in `src/lib/templates.ts`. You can also edit templates from within the application.

### Available placeholders

| Placeholder | Source |
|---|---|
| `{{FirstName}}` | Contact's first name |
| `{{LastName}}` | Contact's last name |
| `{{FullName}}` | Contact's full name |
| `{{Company}}` | Contact's company |
| `{{JobTitle}}` | Contact's job title |
| `{{SenderName}}` | Sender profile in Settings |
| `{{SenderLinkedIn}}` | Sender's LinkedIn URL in Settings |
| `{{Portfolio}}` | Sender's portfolio URL in Settings |

### Message safety rules

- A missing or invalid first name or missing company blocks the message.
- Missing sender details required by the template block rendering and show a hint to complete the profile.
- If the template mentions an attached CV but no CV is selected, the application displays a blocking warning. Selecting a CV does not attach it to LinkedIn automatically.
- Previously contacted people trigger duplicate-outreach checks and may require additional confirmation.
- Always review the generated message before sending it.

---

## Project structure

```text
.
├── .env.example                 Environment template
├── firebase.json                Hosting and Firestore configuration
├── firestore.rules              Firestore security rules
├── firestore.indexes.json       Required Firestore indexes
├── next.config.ts               Static export configuration
├── src/
│   ├── app/
│   │   ├── layout.tsx           Root layout
│   │   ├── login/page.tsx       Sign-in page
│   │   └── (app)/               Protected application pages
│   │       ├── page.tsx         Dashboard
│   │       ├── import/          CSV import
│   │       ├── contacts/        All contacts
│   │       ├── contact/         Contact details (?id=...)
│   │       ├── recruiters/      Target contacts
│   │       ├── review/           Review and send
│   │       ├── templates/       Message templates
│   │       ├── cv/              CV management
│   │       ├── history/         Outreach history
│   │       └── settings/        Profile and settings
│   ├── components/              UI components and application shell
│   └── lib/
│       ├── csv/                  Parsing, mapping, deduplication and import
│       ├── data/                 Firestore and demo localStorage stores
│       ├── firebase/client.ts    Firebase initialisation
│       ├── providers/            LinkedIn provider interface (manual workflow)
│       ├── classify.ts           Contact classification
│       ├── names.ts              Name extraction
│       ├── templates.ts          Message templates and rendering
│       ├── review.ts              Message review logic
│       ├── status.ts              Message status and confirmation
│       ├── filters.ts             Contact filtering
│       ├── authz.ts               Authorisation helpers
│       ├── cv.ts                  CV validation and processing
│       ├── cv-client.ts           CV upload and download
│       └── i18n*.ts(x)            English and Arabic translations
└── tests/                         Vitest tests
```

The structure above describes the main application areas; exact file names may vary as the project evolves.

---

## Data model

Every user-owned document includes an `ownerId` and is protected by Firestore security rules.

| Collection | Content |
|---|---|
| `contacts` | Contact details, classification, outreach status, original row and source |
| `messageTemplates` | Saved message templates |
| `outreachCampaigns` | Batches of prepared messages |
| `outreachMessages` | Message content, status and confirmation information |
| `cvDocuments` | CV metadata, including file name, size and chunk count |
| `cvChunks` | Private base64 chunks containing CV content |
| `activityLogs` | Audit log records |
| `userSettings` | Sender profile, targeting keywords, selected CV and language preferences |

The data model supports separate user accounts, contact management and an auditable manual outreach workflow.

---

## Security

The application uses several safeguards to protect user data and reduce accidental outreach.

- **Account isolation:** Firestore rules restrict access to each user's own documents through ownership checks.
- **Manual sending:** The app does not send LinkedIn messages. A sent status requires explicit confirmation through the application workflow.
- **Audit logging:** Activity records help track changes and outreach actions.
- **CV access:** PDF type, size and signature are validated; the Firestore rules restrict access to the owner's CV data.
- **No public CV URL:** CV content is not exposed through a public download link.
- **Input validation:** CSV processing removes control characters and applies size and row-count limits.
- **Security headers:** `firebase.json` configures headers such as `X-Frame-Options`, `X-Content-Type-Options` (`nosniff`) and `Referrer-Policy`.
- **Public Firebase configuration:** Firebase web configuration is intended to be visible in the client. Security must rely on correctly configured authentication and Firestore rules, not on hiding the web API key.
- **No committed credentials:** Do not commit service-account keys, private environment files or real connection exports.

### Privacy and account deletion

The current application does **not** provide a dedicated privacy-policy page or a self-service button to delete an account and all associated data.

Before making the application available to the public, establish an appropriate privacy policy and a reliable account/data deletion process. Explain what information is collected, why it is used, how long it is retained and how users can request deletion.

Do not assume that deleting a Firebase Authentication account automatically deletes every associated Firestore document.

---

## Scripts and tests

```bash
npm run dev         # Start the development server
npm run build       # Export the application to out/
npm run deploy      # Build and deploy Hosting, rules and indexes
npm run lint        # Run ESLint
npm run typecheck   # Check TypeScript types
npm test            # Run the test suite
npm run test:rules  # Run Firestore rules tests (requires emulator)
```

The test suite covers areas such as:

- CSV parsing and column mapping.
- Contact deduplication and classification.
- Name extraction.
- Message template rendering and sender data.
- CV validation, chunking and reconstruction.
- Contact filtering.
- Outreach status transitions.
- Ownership checks and send-confirmation workflows.

Run Firestore security rules tests with the emulator:

```bash
npx firebase-tools emulators:exec --only firestore "npm run test:rules"
```

Passing unit tests does not prove that a live Firebase deployment is configured correctly. Test the deployed application against a real Firebase project before using real contact data.

---

## Troubleshooting

| Problem | Possible fix |
|---|---|
| `Missing or insufficient permissions` | Confirm the correct Firebase project is selected and the latest Firestore rules are deployed |
| Demo mode appears after deployment | Check `.env.local`, confirm the Firebase configuration and demo flag, then rebuild and redeploy |
| `The query requires an index` | Deploy the Firestore indexes and wait for them to finish building |
| Google sign-in fails | Enable Google authentication and verify the authorised domains |
| CV upload fails | Use a valid PDF smaller than 3 MB and verify the Firestore rules |
| An older CV cannot be downloaded | Upload the CV again using the current upload workflow |
| A message is blocked | Read the validation warning, correct the recipient or sender data, and select **Re-render from template** |
| `C` does not copy the message | Use **Copy Message** directly and verify clipboard access on an HTTPS page |
| Blank page or 404 after deployment | Run `npm run build`, confirm that `out/` exists and redeploy |
| Firebase CLI asks to install | Approve installation if you trust the package source, or install the Firebase CLI separately |

---

## Known limitations

- Filtering, sorting and pagination occur in the browser after contacts load. This is suitable for moderate contact lists, but very large datasets may need a different approach.
- Classification uses job titles rather than verified employment information. Potential matches must be reviewed.
- Job titles and company names are snapshots from the LinkedIn export and can become outdated.
- The default keywords are editable, but some interface labels, including **HR & Recruiters**, are still fixed and may not reflect every target audience.
- CV files are limited to 3 MB because they are stored in Firestore.
- LinkedIn messaging and CV attachment are manual. The application cannot verify delivery.
- The app does not automatically read replies from LinkedIn.
- Demo-mode data remains local and does not transfer to Firebase.
- There is currently no dedicated privacy-policy page or self-service account and data deletion button.
- Live Firebase behaviour depends on the project's configuration, deployed rules, indexes and service quotas. Verify the complete workflow against your own Firebase project.
- Avoid sending large volumes of unsolicited messages. Follow LinkedIn's terms, applicable laws and responsible outreach practices.

---

## Disclaimer

People Reach is an independent project and is **not affiliated with, endorsed by or sponsored by LinkedIn**.

Use the application in accordance with LinkedIn's terms, applicable data-protection laws and the privacy expectations of your contacts. Import only data you are authorised to use, review every message yourself, and avoid unsolicited bulk outreach.

The application assists with organising contacts and preparing messages; it does not guarantee that a contact is relevant, that a message is delivered, or that outreach will result in a job opportunity.
