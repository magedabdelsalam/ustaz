# AI StudyMate

An AI-powered educational tool that helps users master complex subjects through personalized content generation and interactive chat-based learning.

## Features

- 🤖 **AI-Powered Content Generation**: Dynamic lessons, explanations, and practice problems
- 💬 **Interactive AI Tutor**: Chat with AI to clarify concepts and get help
- 📊 **Progress Tracking**: Visual progress indicators and mastery stats
- 🎯 **Subject-Based Learning**: Organized learning by mathematical and technical subjects
- 🔐 **User Authentication**: Secure login and personalized experience
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI Integration**: OpenAI API - Ready for integration
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key (optional for full AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ustaz
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```bash
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   # Optional (server-only, do NOT prefix with NEXT_PUBLIC)
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

   # OpenAI Configuration (optional)
   OPENAI_API_KEY=your_openai_api_key_here

   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   After creating or changing `.env.local`, restart the dev server so Next.js picks up the new variables.

4. **Set up Supabase Database**
   
   Run the following SQL in your Supabase SQL editor to create the required tables:

   ```sql
   -- Enable RLS
   ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

   -- Create profiles table
   CREATE TABLE profiles (
     id UUID REFERENCES auth.users(id) PRIMARY KEY,
     email TEXT NOT NULL,
     full_name TEXT,
     avatar_url TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Create subjects table
   CREATE TABLE subjects (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) NOT NULL,
     name TEXT NOT NULL,
     progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
     color TEXT DEFAULT 'bg-blue-500',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Create chat_sessions table
   CREATE TABLE chat_sessions (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) NOT NULL,
     subject_id UUID REFERENCES subjects(id),
     title TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Create chat_messages table
   CREATE TABLE chat_messages (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     session_id UUID REFERENCES chat_sessions(id) NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
     content TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Create learning_content table
   CREATE TABLE learning_content (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) NOT NULL,
     subject_id UUID REFERENCES subjects(id) NOT NULL,
     title TEXT NOT NULL,
     content TEXT NOT NULL,
     content_type TEXT DEFAULT 'lesson' CHECK (content_type IN ('lesson', 'explanation', 'practice')),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Row Level Security Policies
   
   -- Profiles policies
   CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
   CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
   CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

   -- Subjects policies
   CREATE POLICY "Users can view own subjects" ON subjects FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own subjects" ON subjects FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update own subjects" ON subjects FOR UPDATE USING (auth.uid() = user_id);
   CREATE POLICY "Users can delete own subjects" ON subjects FOR DELETE USING (auth.uid() = user_id);

   -- Chat sessions policies
   CREATE POLICY "Users can view own chat sessions" ON chat_sessions FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own chat sessions" ON chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update own chat sessions" ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);
   CREATE POLICY "Users can delete own chat sessions" ON chat_sessions FOR DELETE USING (auth.uid() = user_id);

   -- Chat messages policies
   CREATE POLICY "Users can view messages from own sessions" ON chat_messages FOR SELECT 
     USING (session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid()));
   CREATE POLICY "Users can insert messages to own sessions" ON chat_messages FOR INSERT 
     WITH CHECK (session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid()));

   -- Learning content policies
   CREATE POLICY "Users can view own learning content" ON learning_content FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own learning content" ON learning_content FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update own learning content" ON learning_content FOR UPDATE USING (auth.uid() = user_id);
   CREATE POLICY "Users can delete own learning content" ON learning_content FOR DELETE USING (auth.uid() = user_id);

   -- Enable RLS on all tables
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
   ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
   ALTER TABLE learning_content ENABLE ROW LEVEL SECURITY;
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works - Intelligent Subject Generation

### 🤖 **Smart Topic Detection**
The AI automatically detects what you're learning about and creates subjects dynamically:

```
User: "Can you help me solve quadratic equations?"
→ Creates: "Quadratic Equations" subject

User: "Now I want to learn about derivatives"  
→ Creates: "Derivatives" subject (calculus detected)

User: "Let's move on to geometry basics"
→ Creates: "Geometry Concepts" subject
```

### 📊 **Progress Tracking**
- **5%** - Started learning (first message)
- **25%** - Active engagement (5+ messages)
- **50%** - Good understanding (10+ messages)
- **85%** - Strong comprehension (15+ messages)  
- **100%** - Subject mastery (20+ messages or completion markers)

### 🎯 **Auto-Completion**
Subjects automatically complete when:
- High engagement threshold reached (20+ messages)
- User explicitly says "I understand this now"
- User requests to move to next topic
- Progress indicators show mastery

### 🔄 **Topic Transitions**
Smart cutoffs happen when:
- **Topic keywords change**: "algebra" → "calculus" → "geometry"
- **Explicit transitions**: "Let's start a new topic", "Move on to..."
- **Subject completion**: Previous topic reaches 100%

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   │   └── loading-spinner.tsx  # Loading components
│   ├── AuthPage.tsx      # Authentication page
│   ├── Dashboard.tsx     # Main dashboard
│   ├── DashboardHeader.tsx
│   ├── HistoryPane.tsx   # Subject history sidebar
│   ├── ContentPane.tsx   # AI content display
│   └── ChatPane.tsx      # AI chat interface
├── hooks/                # Custom React hooks
│   └── useAuth.ts        # Authentication hook
└── lib/                  # Utility libraries
    ├── supabase.ts       # Supabase client
    └── utils.ts          # Utility functions
```

## Current Features

### Authentication
- ✅ Email/password signup and login
- ✅ Secure session management with Supabase
- ✅ User profile display
- ✅ Logout functionality

### Dashboard Layout
- ✅ Three-pane layout (History, Content, Chat)
- ✅ Responsive design
- ✅ Modern UI with shadcn/ui components

### Subject Management
- ✅ Subject list with progress indicators
- ✅ Subject selection and highlighting
- ✅ Mock data for 15 mathematical subjects

### Content Generation
- ✅ AI content generation buttons (Lesson, Explanation, Practice)
- ✅ Simulated content generation with loading states
- ✅ Content display in formatted cards

### AI Chat
- ✅ Interactive chat interface
- ✅ Simulated AI responses based on keywords
- ✅ Message history and timestamps
- ✅ Typing indicators
- ✅ Auto-scroll functionality

### Intelligent Subject Generation
- ✅ **Auto-detect topics** from chat messages and content requests
- ✅ **Smart subject creation** when topics change (algebra → calculus → geometry)
- ✅ **Progress tracking** based on engagement and message count
- ✅ **Subject completion** detection when mastery is achieved
- ✅ **Topic keywords** for better context understanding
- ✅ **Visual indicators** for active subjects and completion status

## Upcoming Features

### Database Integration
- [ ] Real subject data from Supabase
- [ ] User progress tracking
- [ ] Chat history persistence
- [ ] Learning content storage

### AI Integration
- [ ] OpenAI API integration for content generation
- [ ] Real-time AI chat responses
- [ ] Personalized content based on user progress
- [ ] Advanced AI tutoring capabilities

### Enhanced Features
- [ ] Progress analytics dashboard
- [ ] Subject recommendations
- [ ] Learning streaks and achievements
- [ ] Export/share learning content
- [ ] Dark mode support
- [ ] Mobile app optimization

## Deployment

### Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Connect your GitHub repository to Vercel
   - Add environment variables in Vercel dashboard
   - Deploy automatically on push

### Other Platforms
- **Netlify**: Works with Next.js
- **Railway**: Good for full-stack apps
- **Digital Ocean**: App Platform supports Next.js

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support, email support@aistudymate.com or open an issue in the repository.

## Components

### Loading Components

The application uses standardized loading components for consistent UX:

#### LoadingSpinner
Main loading component with multiple variants and sizes:

```jsx
import { LoadingSpinner } from '@/components/ui/loading-spinner'

// Basic spinner
<LoadingSpinner />

// Large spinner with custom text
<LoadingSpinner size="lg" text="Loading content..." />

// Skeleton loading for content areas
<LoadingSpinner variant="skeleton" skeletonRows={5} />

// Full screen loading
<LoadingSpinner fullScreen size="xl" text="Loading Ustaz..." />
```

#### SpinnerIcon
Standalone spinner icon for buttons and inline use:

```jsx
import { SpinnerIcon } from '@/components/ui/loading-spinner'

// Small spinner for buttons
<SpinnerIcon size="sm" />

// Custom styled spinner
<SpinnerIcon size="md" className="text-blue-500" />
```

#### LoadingText
Simple loading text component:

```jsx
import { LoadingText } from '@/components/ui/loading-spinner'

<LoadingText text="Saving..." size="sm" />
```

## Development

To run the development server:

```

# Ustaz - AI-Powered Learning Platform

Ustaz is an intelligent tutoring system that creates personalized, interactive learning experiences. It uses AI to generate contextually appropriate educational content and interactive components.

## Key Features

### 🎯 Context-Aware Learning
Ustaz now intelligently distinguishes between:
- **Context questions**: Questions about the current lesson that should generate interactive components
- **New subject requests**: Requests to start learning something completely different

**Example scenarios:**
- During a **Photosynthesis** lesson, asking "explain to me why it's green" will generate an **Explainer** component about chlorophyll and plant coloration within the photosynthesis context
- Asking "help me learn social media marketing" will create a new **Social Media Marketing** subject

### 🧩 Smart Component Selection
The AI automatically selects the most appropriate interactive component based on your question:

| Question Intent | Generated Component |
|---|---|
| "explain why...", "tell me about..." | **Explainer** - Detailed explanations |
| "quiz me", "test my knowledge" | **Multiple Choice** - Knowledge assessment |
| "show me examples", "demonstrate" | **Interactive Example** - Hands-on demos |
| "practice", "exercise" | **Fill-in-the-Blank** - Practice exercises |
| "step by step", "solve this" | **Step Solver** - Problem-solving guide |
| "match", "categorize" | **Drag & Drop** - Matching exercises |
| "highlight", "identify in text" | **Text Highlighter** - Text analysis |
| "graph", "visualize data" | **Graph Visualizer** - Data visualization |
| "formula", "equation" | **Formula Explorer** - Mathematical exploration |

### 📚 Interactive Learning Components

Ustaz provides 11 different types of interactive components:
- **Explainer**: Comprehensive explanations with multiple sections
- **Concept Card**: Quick concept summaries with examples
- **Multiple Choice**: Knowledge assessment quizzes
- **Fill-in-the-Blank**: Practice exercises with hints
- **Step-by-Step Solver**: Guided problem solving
- **Interactive Example**: Hands-on demonstrations with controls
- **Drag & Drop**: Matching and categorization exercises
- **Text Highlighter**: Reading comprehension and analysis
- **Graph Visualizer**: Data exploration and chart analysis
- **Formula Explorer**: Mathematical formula manipulation
- **Progress Quiz**: Comprehensive assessment with detailed feedback

### 🔍 Context Analysis Engine

The system uses advanced AI analysis to understand:
1. **Subject relevance**: Is the question about the current topic?
2. **Question intent**: What type of learning activity is most appropriate?
3. **Learning progression**: Where is the student in their learning journey?

**Context indicators the system recognizes:**
- Subject-specific keywords and terminology
- Question patterns ("why", "how", "explain", "show me")
- Contextual phrases ("about this", "more details", "clarify")
- Learning intent signals ("quiz", "practice", "examples")

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Run the development server: `npm run dev`

## How It Works

1. **Message Analysis**: When you send a message, the AI analyzes it for context and intent
2. **Component Selection**: Based on your current subject and question type, it selects the best interactive component
3. **Content Generation**: AI generates educational content specifically for that component type
4. **Interactive Learning**: You engage with the component to learn and practice

## Example Learning Flow

```
Student: "I want to learn about photosynthesis"
→ Creates new "Photosynthesis" subject
→ Generates lesson plan
→ Shows Concept Card introducing photosynthesis

Student: "explain to me why it's green"
→ Stays in Photosynthesis subject (context-aware!)
→ Generates Explainer component about chlorophyll and green coloration
→ Interactive content with detailed sections about plant pigments

Student: "quiz me on this"
→ Still in Photosynthesis context
→ Generates Multiple Choice quiz about chlorophyll and plant coloration

Student: "help me learn Spanish"
→ Recognizes new subject request
→ Creates new "Spanish" subject
→ Switches context and generates Spanish lesson plan
```

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **UI Components**: Radix UI, ShadCN/UI
- **Backend**: Supabase (PostgreSQL, Edge Functions)
- **AI**: OpenAI GPT-4 for content generation and analysis
- **Authentication**: Supabase Auth

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.