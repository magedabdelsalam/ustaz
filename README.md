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
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

   # OpenAI Configuration (optional)
   OPENAI_API_KEY=your_openai_api_key_here

   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

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
│   ├── AuthPage.tsx      # Authentication page
│   ├── Dashboard.tsx     # Main dashboard
│   ├── DashboardHeader.tsx
│   ├── HistoryPane.tsx   # Subject history sidebar
│   ├── ContentPane.tsx   # AI content display
│   ├── ChatPane.tsx      # AI chat interface
│   └── LoadingSpinner.tsx
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
