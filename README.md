# Ustaz - AI-Powered Education Platform

Ustaz is a multi-tenant education software platform designed for schools, teachers, students, and parents. It combines AI tutoring with course management to create personalized, interactive learning experiences.

## 🎓 Core Roles

- **School Admin**: Create and manage schools, approve students
- **Teacher**: Create courses, lessons, assignments; manage sections and enrollments
- **Student**: Join courses via code, view lessons, submit assignments, get AI hints
- **Parent** *(future)*: View student progress and course information

## 🚀 Key Features

### Multi-Tenant Architecture
- Schools operate independently with isolated data
- Role-based access control via Row-Level Security (RLS)
- One user can belong to multiple schools

### For Teachers
- Create courses with subject, grade level, and join codes
- Organize courses into sections (classes/periods)
- Build lessons with slide-based content using interactive blocks
- Create assignments (worksheets, quizzes, tests)
- Track student submissions and provide grades/feedback

### For Students
- Join courses using teacher-provided codes
- View course lessons and slides
- Get AI hints at 3 levels (subtle, moderate, detailed)
- Submit assignments in JSON format
- View grades and feedback from teachers

### AI Tutor Integration
- Course-aware hints contextualized by course, lesson, and slide
- Leverages existing interactive components (explainers, multiple choice, fill-in-the-blank, etc.)
- System prompts enriched with learning objectives and current content

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: Supabase (PostgreSQL) with Row-Level Security
- **Authentication**: Supabase Auth
- **AI Integration**: OpenAI API (GPT-4o-mini for hints, GPT-4 for content generation)
- **Deployment**: Vercel (recommended)

## 📁 Project Structure

```
src/
├── app/
│   ├── (teacher)/
│   │   └── teacher/
│   │       ├── page.tsx                               # Teacher dashboard
│   │       └── courses/
│   │           ├── new/page.tsx                       # Create course
│   │           └── [courseId]/
│   │               ├── page.tsx                       # Course overview (tabs)
│   │               ├── lessons/[lessonId]/editor/page.tsx  # Slide editor
│   │               └── assignments/new/page.tsx       # Create assignment
│   ├── (student)/
│   │   └── student/
│   │       ├── page.tsx                               # Student dashboard
│   │       ├── courses/[courseId]/
│   │       │   ├── page.tsx                           # Course overview
│   │       │   └── lessons/[lessonId]/page.tsx        # Lesson viewer + AI hints
│   │       └── assignments/[assignmentId]/page.tsx    # Submit assignment
│   ├── api/
│   │   └── openai/route.ts                            # AI API with course context
│   ├── layout.tsx
│   ├── page.tsx                                       # Home (legacy tutor UI)
│   └── globals.css
├── components/
│   ├── ui/                                            # shadcn/ui components
│   ├── interactive/                                   # Interactive learning blocks
│   │   ├── Explainer.tsx
│   │   ├── MultipleChoice.tsx
│   │   ├── FillInTheBlank.tsx
│   │   └── ...
│   ├── history/                                       # Subject history sidebar
│   ├── AuthPage.tsx
│   ├── Dashboard.tsx                                  # Legacy main dashboard
│   └── StreamPane.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useSubjects.ts
│   └── useAITutor.ts
├── lib/
│   ├── supabase.ts                                    # Supabase client + types
│   ├── persistenceService.ts                          # CRUD helpers
│   ├── ai-tutor-service.ts                            # AI service with tool calling
│   └── utils.ts
└── types/
    ├── index.ts                                       # App types
    └── supabase.ts                                    # Generated Supabase types
```

## 🗄 Database Schema

### Multi-Tenant Tables
- **schools**: Tenant boundary (id, name, slug, created_by)
- **school_members**: User membership (school_id, user_id, role: teacher|student)
- **courses**: Courses within a school (school_id, title, subject, grade_level, join_code, state: draft|live)
- **sections**: Class periods under a course (course_id, name, schedule_json)
- **enrollments**: Student enrollment in sections (section_id, student_user_id, status: active|removed)
- **lessons**: Lessons under a course (course_id, title, position)
- **slides**: Slide content in a lesson (lesson_id, position, blocks_json)
- **assignments**: Assignments for a course (course_id, lesson_id, title, due_at, type: worksheet|quiz|test)
- **submissions**: Student assignment submissions (assignment_id, student_user_id, answers_json, grade, feedback, submitted_at)
- **attendance** *(optional)*: Attendance records (section_id, date, student_user_id, status)

### Legacy Tables (Single-User Tutor)
- **profiles**: User profile information
- **subjects**: Personal learning subjects (user_id, name, lesson_plan, progress)
- **chat_messages**: AI tutor chat history
- **content_feed**: Interactive learning components
- **ai_assistant_settings**: Per-subject AI assistant configuration

## 🔒 Row-Level Security (RLS)

All tables enforce RLS policies:

- **Schools**: Members can read; creator can manage
- **School members**: Users see their own membership; teachers see all members in their schools
- **Courses/Lessons/Slides/Assignments**: School members can read; teachers can write
- **Enrollments**: Students and teachers can read; students can self-enroll if they're school members
- **Submissions**: Owner student and teachers can read; owner can insert/update; teachers can grade

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key

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
   Create a `.env.local` file:
   ```bash
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here

   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Set up Supabase Database**
   
   Run `ustaz-database-schema.sql` in your Supabase SQL editor. This will:
   - Create all multi-tenant and legacy tables
   - Enable Row-Level Security
   - Create all necessary policies and indexes
   - Set up triggers for profile creation and updated_at

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 User Flows

### Teacher Flow

1. **Sign up / Sign in** at `/` (Supabase Auth)
2. **Create or join a school** (first-time setup; manual SQL for MVP)
3. **Access teacher dashboard** at `/teacher`
4. **Create a course**:
   - Click "Create course"
   - Select school, enter title, subject, grade
   - System generates join code
5. **Add lessons**:
   - Open course → "Lessons" tab → "New lesson"
   - Open lesson editor
   - Add slides with interactive blocks (explainer, multiple choice, etc.)
6. **Add sections** (class periods):
   - "Sections" tab → "New section"
7. **Create assignments**:
   - "Assignments" tab → "New assignment"
   - Set title, type (worksheet/quiz/test), due date
8. **Manage enrollments**: View enrolled students (future: manually add/remove)

### Student Flow

1. **Sign up / Sign in** at `/`
2. **Join a school** (manual SQL for MVP; future: admin approval flow)
3. **Access student dashboard** at `/student`
4. **Join a course**:
   - Enter join code provided by teacher
   - System enrolls student in default section
5. **View lessons**:
   - Click course → "Lessons"
   - Navigate slides with Previous/Next
   - View interactive blocks (read-only for students)
6. **Get AI hints**:
   - Click "Show AI hints"
   - Choose Hint 1 (subtle), 2 (moderate), or 3 (detailed)
   - AI provides context-aware help based on current slide
7. **Submit assignments**:
   - Click assignment
   - Enter answers in JSON format
   - Click "Submit"
   - View grade and feedback once graded by teacher

## 🧪 Testing

### Manual Testing

1. **Set up test data**:
   ```sql
   -- Create a test school
   INSERT INTO schools (name, slug, created_by) VALUES ('Test School', 'test-school', '<teacher-user-id>');
   
   -- Add teacher membership
   INSERT INTO school_members (school_id, user_id, role) VALUES ('<school-id>', '<teacher-user-id>', 'teacher');
   
   -- Add student membership
   INSERT INTO school_members (school_id, user_id, role) VALUES ('<school-id>', '<student-user-id>', 'student');
   ```

2. **Test teacher flow**: Create course, add lesson, add section, create assignment
3. **Test student flow**: Join via code, view lesson, get AI hints, submit assignment

### E2E Testing

Playwright tests are available in `tests/e2e/teacher-student-flow.spec.ts` (currently skipped; requires seeded test database).

To run:
```bash
npm run test:e2e
```

## 🎨 Interactive Learning Components

Ustaz includes 11 types of interactive components that can be added to slides:

1. **explainer** – Detailed multi-section explanations
2. **multiple-choice** – Knowledge assessment quizzes
3. **fill-blank** – Practice exercises with hints
4. **concept-card** – Quick concept summaries
5. **step-solver** – Guided problem-solving
6. **interactive-example** – Hands-on demos with controls
7. **drag-drop** – Matching and categorization
8. **text-highlighter** – Reading comprehension
9. **graph-visualizer** – Data exploration
10. **formula-explorer** – Mathematical formulas
11. **progress-quiz** – Comprehensive assessments

Each component accepts a JSON `data` object defining its content. Teachers can add blocks via the slide editor; students view them in lesson viewer.

## 🤖 AI Tutor Integration

The OpenAI API route (`/api/openai`) supports two modes:

1. **Legacy tutor mode** (single-user subjects):
   - POST with `{ message, context, sessionId, userId }`
   - Uses `ai-tutor-service.ts` for tool calling and interactive component generation

2. **Course-aware hints** (multi-tenant):
   - POST with `{ messages, courseContext: { courseId, lessonId, slideId } }`
   - Enriches system prompt with course/lesson metadata
   - Returns contextual hints at 3 levels

## 🚢 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy (automatic on push)

### Database Migration

Run `ustaz-database-schema.sql` in Supabase SQL editor. For updates, run `fix-database-schema.sql` if needed.

## 📝 Future Enhancements

- **Admin approval flow**: Students request to join school; admin approves
- **Parent portal**: View student progress and grades
- **Teacher adds students**: Manually enroll students in sections
- **Rich slide editor**: Visual block editor instead of JSON prompts
- **Grading UI**: Inline grading interface for teachers
- **Analytics**: Course-level and student-level progress dashboards
- **Notifications**: Assignment due dates, new grades, etc.

## 📄 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Open a Pull Request

## 📧 Support

For support, open an issue in the repository or contact the maintainers.
