# Project Structure - Intelligent Repair Client

## Directory Tree

```
IntelligentRepair/client/
│
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── ai/                   # AI-related API endpoints
│   │   │   ├── aiUtils.ts
│   │   │   ├── diagnose/
│   │   │   │   └── route.ts      # Diagnosis API endpoint
│   │   │   ├── questions/
│   │   │   │   └── route.ts      # Questions API endpoint
│   │   │   └── research/
│   │   │       └── route.ts      # Research API endpoint
│   │   │
│   │   ├── auth/                 # Authentication API routes
│   │   │   ├── login/
│   │   │   │   └── route.ts
│   │   │   ├── logout/
│   │   │   │   └── route.ts
│   │   │   └── register/
│   │   │       └── route.ts
│   │   │
│   │   ├── cars/                 # Car-related API routes
│   │   │   ├── get/
│   │   │   │   └── route.ts      # Get car by ID
│   │   │   └── list/
│   │   │       └── route.ts      # List cars
│   │   │
│   │   ├── garage/               # Garage-related API routes
│   │   │   ├── dashboard/
│   │   │   │   ├── filters/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── pie/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── repairs/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── top-issues/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── top-models/
│   │   │   │   │   └── route.ts
│   │   │   │   └── top5/
│   │   │   │       └── route.ts
│   │   │   └── repairs/
│   │   │       └── list/
│   │   │           └── route.ts
│   │   │
│   │   ├── requests/             # Request-related API routes
│   │   │   ├── by-user/
│   │   │   │   └── route.ts      # Get requests by user
│   │   │   ├── create/
│   │   │   │   └── route.ts      # Create new request
│   │   │   └── start/
│   │   │       └── route.ts      # Start request
│   │   │
│   │   ├── research/
│   │   │   └── route.ts          # Research API endpoint
│   │   │
│   │   └── template/
│   │       └── route.ts          # Template API endpoint
│   │
│   ├── auth/                     # Authentication pages
│   │   ├── layout.tsx            # Auth layout component
│   │   ├── login/
│   │   │   └── page.tsx          # Login page
│   │   └── register/
│   │       └── page.tsx          # Registration page
│   │
│   ├── garage/                   # Garage user interface
│   │   ├── chats/                # Garage chat pages
│   │   │   ├── [request_id]/
│   │   │   │   └── page.tsx      # Individual chat view
│   │   │   └── page.tsx          # Chats list page
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Garage dashboard
│   │   │
│   │   ├── page.tsx              # Garage main page
│   │   │
│   │   ├── profile/
│   │   │   └── page.tsx          # Garage profile page
│   │   │
│   │   ├── repairs/
│   │   │   └── page.tsx          # Repairs management page
│   │   │
│   │   ├── requests/             # Request management
│   │   │   ├── [request_id]/
│   │   │   │   └── page.tsx      # Individual request view
│   │   │   └── page.tsx          # Requests list page
│   │   │
│   │   └── settings/
│   │       └── page.tsx          # Garage settings page
│   │
│   ├── maintenance/              # Vehicle maintenance pages
│   │   ├── info/
│   │   │   └── page.tsx          # Maintenance information
│   │   ├── page.tsx              # Main maintenance page
│   │   └── reminders/
│   │       └── page.tsx          # Maintenance reminders
│   │
│   ├── user/                     # Regular user interface
│   │   ├── chat/                 # User chat pages
│   │   │   └── [request_id]/
│   │   │       └── page.tsx      # Individual chat view
│   │   │
│   │   ├── chats/                # User chats list
│   │   │   ├── [request_id]/
│   │   │   │   └── page.tsx      # Individual chat view
│   │   │   └── page.tsx          # Chats list page
│   │   │
│   │   ├── consult/              # Consultation flow
│   │   │   ├── form/
│   │   │   │   └── page.tsx      # Consultation form
│   │   │   ├── layout.tsx        # Consultation layout
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # New consultation page
│   │   │   ├── page.tsx          # Main consultation page
│   │   │   ├── questions/        # Question flow components
│   │   │   │   ├── components/   # Question UI components
│   │   │   │   │   ├── ChatBubble.tsx
│   │   │   │   │   ├── FinalDiagnosisCard.tsx
│   │   │   │   │   ├── MultiChoiceButtons.tsx
│   │   │   │   │   ├── TypingBubble.tsx
│   │   │   │   │   ├── TypingIndicator.tsx
│   │   │   │   │   └── YesNoButtons.tsx
│   │   │   │   ├── hooks/
│   │   │   │   │   └── useAIStateMachine.ts
│   │   │   │   └── page.tsx      # Questions page
│   │   │   ├── summary/
│   │   │   │   └── page.tsx      # Consultation summary
│   │   │   └── VehicleSelectPopup.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx          # User dashboard
│   │   │
│   │   ├── layout.tsx            # User layout component
│   │   │
│   │   ├── page.tsx              # User main page
│   │   │
│   │   ├── profile/
│   │   │   └── page.tsx          # User profile page
│   │   │
│   │   ├── repairs/
│   │   │   └── page.tsx          # User repairs page
│   │   │
│   │   └── settings/
│   │       └── page.tsx          # User settings page
│   │
│   ├── _temp_consult_backup/     # Temporary backup directory
│   │   ├── chat/
│   │   │   └── [request_id]/
│   │   │       └── page.tsx
│   │   ├── garage/
│   │   │   └── [garage_id]/
│   │   │       └── page.tsx
│   │   ├── send-to-garage/
│   │   │   └── [request_id]/
│   │   │       └── page.tsx
│   │   └── summary/
│   │       └── [request_id]/
│   │           └── page.tsx
│   │
│   ├── favicon.ico               # Site favicon
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout component
│   ├── not-found.tsx             # 404 page component
│   ├── page.tsx                  # Home page
│   ├── signup/
│   │   └── page.tsx              # Signup page
│   └── report/
│       └── page.tsx              # Report page
│
├── components/                   # Shared React components
│   └── consult/
│       ├── CarSelectionModal.tsx
│       └── RequestForm.tsx
│
├── lib/                          # Utility libraries
│   ├── ai/                       # AI-related utilities
│   │   ├── cache.ts              # Caching utilities
│   │   ├── client.ts             # AI client configuration
│   │   ├── json.ts               # JSON utilities
│   │   ├── prompt-builder.ts     # Prompt building utilities
│   │   ├── retry.ts              # Retry logic
│   │   ├── sanitize.ts           # Sanitization utilities
│   │   ├── state-machine.ts      # State machine implementation
│   │   └── types.ts              # TypeScript type definitions
│   │
│   ├── getAuthUser.ts            # Authentication user helper
│   ├── supabaseAdmin.ts          # Supabase admin client
│   ├── supabaseClient.ts         # Supabase client (browser)
│   └── supabaseServer.ts         # Supabase server client
│
├── public/                       # Static assets
│   ├── 9a7a89af-43b5-4cf5-bbcb-d3f1f4468be7.png
│   ├── AppLogo.png
│   ├── AppLogo2.png
│   ├── file.svg
│   ├── globe.svg
│   ├── intelligentrepair-logo.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── .gitignore                    # Git ignore rules
├── AUDIT_REPORT.md               # Audit documentation
├── COMPREHENSIVE_AUDIT_REPORT.md # Comprehensive audit documentation
├── eslint.config.mjs             # ESLint configuration
├── ffc53cfd-5750-4bfc-8fcf-eeaa1b241560.png
├── GEMINI_API_FILES.md           # Gemini API documentation
├── next.config.ts                # Next.js configuration
├── package.json                  # Node.js dependencies
├── package-lock.json             # Dependency lock file
├── postcss.config.mjs            # PostCSS configuration
├── PROJECT_STRUCTURE.md          # This file
├── README.md                     # Project README
└── tsconfig.json                 # TypeScript configuration

```

## Key Directories

### `/app`
Next.js 13+ App Router directory containing all routes, pages, and API endpoints.

### `/app/api`
Backend API routes organized by feature domain:
- **ai/**: AI diagnosis, questions, and research endpoints
- **auth/**: Authentication endpoints (login, logout, register)
- **cars/**: Vehicle data endpoints
- **garage/**: Garage dashboard and management endpoints
- **requests/**: Service request endpoints

### `/app/user`
User-facing pages and features:
- Dashboard, profile, settings
- Consultation flow with question-based diagnosis
- Chat interface for service requests

### `/app/garage`
Garage/mechanic interface:
- Dashboard with analytics
- Request management
- Chat interface
- Repairs tracking

### `/lib`
Shared utilities and libraries:
- **ai/**: AI client, state machine, prompt builders
- Supabase clients (admin, browser, server)
- Authentication helpers

### `/components`
Reusable React components shared across the application.

### `/public`
Static assets (images, icons, logos).







