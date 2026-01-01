# IntelligentRepair - Project Structure Documentation

## Overview
This is a Next.js 14 application for an intelligent vehicle repair consultation system. The app provides AI-powered vehicle diagnostics for users and a management interface for garages.

---

## Root Directory Structure

```
client/
├── app/                    # Next.js 14 App Router directory
├── lib/                    # Shared libraries and utilities
├── components/             # Reusable React components (if exists)
├── public/                 # Static assets
└── node_modules/           # Dependencies
```

---

## 📁 app/ - Main Application Directory

### Core Files
- **`layout.tsx`** - Root layout component for the entire application
- **`page.tsx`** - Home/landing page
- **`globals.css`** - Global CSS styles
- **`not-found.tsx`** - 404 error page
- **`favicon.ico`** - Site favicon

### 📁 api/ - API Routes (Backend Endpoints)

#### 📁 api/ai/ - AI-Powered Endpoints
- **`aiUtils.ts`** - Shared utility functions for AI operations
- **`diagnose/route.ts`** - Endpoint for final vehicle diagnosis
- **`questions/route.ts`** - Endpoint for generating follow-up diagnostic questions
  - Handles question generation and final diagnosis
  - Uses Gemini AI to create adaptive questions
  - Returns either next question or final diagnosis
- **`research/route.ts`** - Endpoint for initial vehicle problem research
  - Performs initial analysis of vehicle issues
  - Uses Gemini AI to identify potential causes
  - Returns research data with top causes and differentiating factors

#### 📁 api/auth/ - Authentication Endpoints
- **`login/route.ts`** - User login endpoint
- **`logout/route.ts`** - User logout endpoint
- **`register/route.ts`** - User registration endpoint

#### 📁 api/cars/ - Vehicle Management Endpoints
- **`get/route.ts`** - Get single vehicle by ID
- **`list/route.ts`** - List all vehicles for a user

#### 📁 api/requests/ - Repair Request Endpoints
- **`by-user/route.ts`** - Get all repair requests for a user
- **`create/route.ts`** - Create a new repair request
- **`start/route.ts`** - Start a new consultation/request

#### 📁 api/research/ - Alternative Research Endpoint
- **`route.ts`** - Alternative research endpoint (may be legacy)

#### 📁 api/template/ - Template Endpoint
- **`route.ts`** - Template/placeholder endpoint

---

### 📁 auth/ - Authentication Pages
- **`layout.tsx`** - Layout wrapper for auth pages
- **`login/page.tsx`** - User login page
- **`register/page.tsx`** - User registration page

---

### 📁 user/ - User-Facing Pages

#### 📁 user/consult/ - AI Consultation Flow
- **`layout.tsx`** - Layout for consultation pages
- **`page.tsx`** - Consultation landing/start page
- **`form/page.tsx`** - Initial consultation form (vehicle selection, problem description)
- **`new/page.tsx`** - New consultation entry point
- **`VehicleSelectPopup.tsx`** - Component for selecting a vehicle

#### 📁 user/consult/questions/ - Interactive Q&A Flow
- **`page.tsx`** - Main questions page with AI conversation interface
  - Manages the interactive diagnostic flow
  - Handles research → questions → diagnosis pipeline
  - State management for conversation flow

- **📁 components/** - Question page components
  - **`ChatBubble.tsx`** - Chat message bubble component
  - **`FinalDiagnosisCard.tsx`** - Card displaying final diagnosis results
  - **`MultiChoiceButtons.tsx`** - Multi-choice answer buttons
  - **`TypingBubble.tsx`** - Typing indicator bubble
  - **`TypingIndicator.tsx`** - Animated typing indicator
  - **`YesNoButtons.tsx`** - Yes/No answer buttons

- **📁 hooks/** - Custom React hooks
  - **`useAIStateMachine.ts`** - Hook for managing AI consultation state machine

- **`summary/page.tsx`** - Consultation summary page (shows final diagnosis)

#### 📁 user/dashboard/ - User Dashboard
- **`page.tsx`** - Main user dashboard

#### 📁 user/profile/ - User Profile
- **`page.tsx`** - User profile management page

#### 📁 user/repairs/ - Repair History
- **`page.tsx`** - User's repair history page

#### 📁 user/settings/ - User Settings
- **`page.tsx`** - User settings page

#### 📁 user/chat/ - Chat Interface
- **`[request_id]/page.tsx`** - Individual chat conversation page (dynamic route)

#### 📁 user/chats/ - Chat List
- **`page.tsx`** - List of all user chats
- **`[request_id]/page.tsx`** - Individual chat page (alternative route)

---

### 📁 garage/ - Garage/Franchise Pages

#### 📁 garage/dashboard/ - Garage Dashboard
- **`page.tsx`** - Main garage dashboard

#### 📁 garage/profile/ - Garage Profile
- **`page.tsx`** - Garage profile management

#### 📁 garage/repairs/ - Repair Management
- **`page.tsx`** - Garage repair management page

#### 📁 garage/requests/ - Request Management
- **`page.tsx`** - List of all repair requests
- **`[request_id]/page.tsx`** - Individual request details page

#### 📁 garage/settings/ - Garage Settings
- **`page.tsx`** - Garage settings page

#### 📁 garage/chats/ - Garage Chat
- **`page.tsx`** - List of all garage chats
- **`[request_id]/page.tsx`** - Individual chat conversation for garage

- **`page.tsx`** - Garage landing page

---

### 📁 maintenance/ - Maintenance Features
- **`page.tsx`** - Maintenance main page
- **`info/page.tsx`** - Maintenance information page
- **`reminders/page.tsx`** - Maintenance reminders page

---

### 📁 report/ - Reporting
- **`page.tsx`** - Report generation/viewing page

---

### 📁 signup/ - Signup
- **`page.tsx`** - User signup page

---

### 📁 _temp_consult_backup/ - Backup/Legacy Files
Temporary backup directory containing old consultation flow files:
- **`chat/[request_id]/page.tsx`** - Old chat implementation
- **`garage/[garage_id]/page.tsx`** - Old garage page
- **`send-to-garage/[request_id]/page.tsx`** - Old send-to-garage flow
- **`summary/[request_id]/page.tsx`** - Old summary page

---

## 📁 lib/ - Shared Libraries

### 📁 lib/ai/ - AI Utilities and Helpers

- **`types.ts`** - TypeScript type definitions for AI consultation flow
  - VehicleInfo, UserAnswer, ResearchData, DiagnosisData
  - AIState, AIAction, AIQuestion types
  - State machine types and interfaces

- **`state-machine.ts`** - State machine for AI consultation flow
  - Pure functions for state management
  - Handles: IDLE → ASKING → WAITING_FOR_ANSWER → PROCESSING → FINISHED
  - State reducer and helper functions

- **`client.ts`** - Gemini AI client wrapper
  - Creates and configures Google Generative AI client
  - Handles API key management
  - Model configuration (gemini-2.5-flash)

- **`json.ts`** - JSON parsing utilities
  - Safe JSON extraction from AI responses
  - Handles malformed JSON with fallbacks
  - Extracts JSON from markdown code blocks

- **`sanitize.ts`** - Data sanitization utilities
  - Sanitizes user descriptions
  - Normalizes vehicle information
  - Cleans input data before sending to AI

- **`prompt-builder.ts`** - AI prompt construction
  - Builds research prompts
  - Builds adaptive question prompts
  - Formats context for Gemini API

- **`cache.ts`** - Caching utilities
  - Caches research results
  - Generates cache keys
  - Manages research data caching

- **`retry.ts`** - Retry logic utilities
  - Handles API retries with exponential backoff
  - Timeout management
  - Error recovery

### 📁 lib/ - Other Utilities

- **`getAuthUser.ts`** - Authentication user retrieval
- **`supabaseAdmin.ts`** - Supabase admin client
- **`supabaseClient.ts`** - Supabase client-side client
- **`supabaseServer.ts`** - Supabase server-side client

---

## Key Features & Flow

### AI Consultation Flow
1. **User selects vehicle** → `user/consult/form/page.tsx`
2. **User enters problem description** → `user/consult/form/page.tsx`
3. **System performs research** → `api/ai/research/route.ts`
4. **System asks questions** → `api/ai/questions/route.ts`
5. **User answers questions** → `user/consult/questions/page.tsx`
6. **System provides diagnosis** → `user/consult/questions/page.tsx` → `user/consult/summary/page.tsx`

### State Management
- Uses React state machine pattern (`lib/ai/state-machine.ts`)
- Manages conversation state, questions, answers, and diagnosis
- Session storage for persistence across page refreshes

### AI Integration
- Uses Google Gemini 2.5 Flash model
- Two-phase approach: Research → Adaptive Questions
- Robust error handling with fallbacks
- Caching for research results

---

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **AI**: Google Gemini 2.5 Flash
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **State Management**: React Hooks + Custom State Machine

---

## Important Notes

1. **API Routes**: All API routes in `app/api/` are Next.js API route handlers
2. **Dynamic Routes**: Routes with `[param]` are dynamic (e.g., `[request_id]`)
3. **Client Components**: Files with `"use client"` are client-side React components
4. **Server Components**: Default Next.js components are server components
5. **Error Handling**: All AI endpoints return 200 with fallback data (never throw)
6. **Session Storage**: Consultation state is saved to sessionStorage for persistence

---

## File Naming Conventions

- **`page.tsx`** - Next.js page component (route)
- **`layout.tsx`** - Next.js layout component
- **`route.ts`** - Next.js API route handler
- **`*.tsx`** - React component files
- **`*.ts`** - TypeScript utility/type files

---

*Last Updated: Based on current codebase structure*
*Project: IntelligentRepair - AI-Powered Vehicle Diagnostic System*

