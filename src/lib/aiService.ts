import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || 'demo-key-for-development',
  dangerouslyAllowBrowser: true // Only for demo - in production, use server-side API routes
})

// AI Response Cache - prevents duplicate API calls and saves tokens
interface CacheEntry {
  data: unknown
  timestamp: number
  type: string
}

class AICache {
  private cache = new Map<string, CacheEntry>()
  private readonly TTL = 30 * 60 * 1000 // 30 minutes
  private readonly MAX_SIZE = 200 // Prevent memory bloat

  private createKey(type: string, params: unknown): string {
    const paramStr = JSON.stringify(params).toLowerCase()
    return `${type}:${paramStr.slice(0, 100)}` // Limit key length
  }

  get(type: string, params: unknown): unknown | null {
    const key = this.createKey(type, params)
    const entry = this.cache.get(key)
    
    if (entry && Date.now() - entry.timestamp < this.TTL) {
      console.log(`🎯 Cache hit for ${type}`)
      return entry.data
    }
    
    if (entry) {
      this.cache.delete(key) // Remove expired entry
    }
    
    return null
  }

  set(type: string, params: unknown, data: unknown): void {
    const key = this.createKey(type, params)
    
    // Prevent cache from growing too large
    if (this.cache.size >= this.MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      type
    })
    
    console.log(`💾 Cached ${type} response (cache size: ${this.cache.size})`)
  }

  clear(type?: string): void {
    if (type) {
      // Clear only specific type
      for (const [key, entry] of this.cache.entries()) {
        if (entry.type === type) {
          this.cache.delete(key)
        }
      }
    } else {
      // Clear all cache
      this.cache.clear()
    }
  }

  getStats(): { size: number; types: Record<string, number> } {
    const types: Record<string, number> = {}
    for (const entry of this.cache.values()) {
      types[entry.type] = (types[entry.type] || 0) + 1
    }
    return { size: this.cache.size, types }
  }
}

export interface LessonPlan {
  subject: string
  lessons: Lesson[]
  currentLessonIndex: number
}

export interface Lesson {
  id: string
  title: string
  description: string
  content: LessonContent
  completed: boolean
}

export interface LessonContent {
  type: 'multiple-choice' | 'concept-card' | 'step-solver' | 'fill-blank'
  data: unknown
}

export interface LearningProgress {
  correctAnswers: number
  totalAttempts: number
  needsReview: boolean
  readyForNext: boolean
}

class AITutorService {
  private lessonPlans: Map<string, LessonPlan> = new Map()
  private progress: Map<string, LearningProgress> = new Map()
  private generatedContent: Map<string, Array<{
    type: string,
    question?: string,
    topic?: string,
    difficulty?: string,
    timestamp: number
  }>> = new Map()
  private lastApiCallTime: number = 0 // Track last API call to prevent rate limiting
  private aiCache = new AICache() // Add AI response cache

  // Helper function to prevent rate limiting by adding delays between API calls
  private async throttleApiCall(): Promise<void> {
    const minDelay = 1000 // Minimum 1 second between API calls
    const timeSinceLastCall = Date.now() - this.lastApiCallTime
    
    if (timeSinceLastCall < minDelay) {
      const waitTime = minDelay - timeSinceLastCall
      console.log(`⏳ Throttling API call, waiting ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    this.lastApiCallTime = Date.now()
  }

  // Cached API call wrapper
  private async cachedApiCall(
    type: string, 
    params: unknown, 
    apiCallFunction: () => Promise<unknown>
  ): Promise<unknown> {
    // Check cache first
    const cached = this.aiCache.get(type, params)
    if (cached) {
      return cached
    }

    // Apply throttling for actual API calls
    await this.throttleApiCall()
    
    // Make API call
    const result = await apiCallFunction()
    
    // Cache the result
    this.aiCache.set(type, params, result)
    
    return result
  }

  // Helper function to clean AI responses that might have markdown formatting
  private cleanJsonResponse(content: string): string {
    // Remove markdown code blocks if present
    let cleaned = content.trim()
    
    // Remove ```json and ``` markers
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '')
    }
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '')
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/\s*```$/, '')
    }
    
    return cleaned.trim()
  }

  private fixIncompleteJson(jsonString: string): string {
    try {
      // First try to parse as-is
      JSON.parse(jsonString)
      return jsonString
    } catch {
      console.log('🔧 Attempting to fix incomplete JSON')
      
      // Try to fix common truncation issues
      let fixed = jsonString.trim()
      
      // If it ends with incomplete lesson object
      if (fixed.endsWith('"lesson-')) {
        // Remove the incomplete lesson reference
        fixed = fixed.replace(/,\s*\{\s*"id":\s*"lesson-[^"]*"?$/, '')
      }
      
      // If it ends with incomplete property or value
      if (fixed.endsWith(',')) {
        fixed = fixed.slice(0, -1)
      }
      
      // Fix incomplete string literals
      if (fixed.endsWith('"')) {
        // String is likely complete
      } else if (fixed.includes('"') && !fixed.endsWith('"')) {
        // Find the last opening quote and close it
        const lastQuoteIndex = fixed.lastIndexOf('"')
        if (lastQuoteIndex > 0) {
          const beforeQuote = fixed.substring(0, lastQuoteIndex + 1)
          const afterQuote = fixed.substring(lastQuoteIndex + 1)
          // If there's content after the quote, add closing quote
          if (afterQuote.trim() && !afterQuote.includes('"')) {
            fixed = beforeQuote + afterQuote.replace(/[,\s]*$/, '') + '"'
          }
        }
      }
      
      // Count open and close braces to balance them
      const openBraces = (fixed.match(/\{/g) || []).length
      const closeBraces = (fixed.match(/\}/g) || []).length
      const openBrackets = (fixed.match(/\[/g) || []).length
      const closeBrackets = (fixed.match(/\]/g) || []).length
      
      // Add missing closing brackets
      if (openBrackets > closeBrackets) {
        const missingBrackets = openBrackets - closeBrackets
        fixed += ']'.repeat(missingBrackets)
      }
      
      // Add missing closing braces
      if (openBraces > closeBraces) {
        const missingBraces = openBraces - closeBraces
        fixed += '}'.repeat(missingBraces)
      }
      
      // Try to parse the fixed version
      try {
        JSON.parse(fixed)
        console.log('✅ Successfully fixed incomplete JSON')
        return fixed
      } catch {
        console.log('❌ Could not fix JSON, will use fallback')
        throw new Error('Unable to fix incomplete JSON response')
      }
    }
  }

  async createLearningPlan(subject: string): Promise<LessonPlan> {
    try {
      console.log('🤖 AI Service creating lesson plan for:', subject)
      
      // Determine appropriate lesson count based on subject complexity
      const getExpectedLessonCount = (subject: string): number => {
        const complexSubjects = [
          'history', 'war', 'wwii', 'ww2', 'world war', 'economics', 'biology', 'chemistry', 
          'physics', 'literature', 'philosophy', 'psychology', 'sociology', 'political science',
          'computer science', 'programming', 'calculus', 'advanced', 'university', 'college'
        ]
        
        const isComplex = complexSubjects.some(keyword => 
          subject.toLowerCase().includes(keyword.toLowerCase())
        )
        
        return isComplex ? 12 : 8 // Complex subjects get 12 lessons, others get 8
      }
      
      const expectedLessons = getExpectedLessonCount(subject)
      console.log(`📚 Planning ${expectedLessons} lessons for "${subject}" (complexity-based)`)
      
      // Use higher token limit for complex subjects
      const maxTokens = expectedLessons >= 12 ? 2500 : 1500 // Reduced from 3000/2000
      console.log(`🎯 Using ${maxTokens} tokens for ${expectedLessons} lessons`)
      
      // Create cache parameters for this lesson plan request
      const cacheParams = { subject, expectedLessons, maxTokens }
      
      // Use cached API call with retry logic
      const planData = await this.cachedApiCall(
        'lesson-plan',
        cacheParams,
        async () => {
          // Retry logic for API calls
          let lastError: Error | null = null
          const maxRetries = 2
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              console.log(`🔄 Attempt ${attempt}/${maxRetries} for lesson plan generation`)
              
              const response = await openai.chat.completions.create({
                model: "gpt-4o-mini", // Using cheaper model
                messages: [
                  {
                    role: "system",
                    content: `Create a learning plan for "${subject}" with exactly ${expectedLessons} lessons. Return JSON: {"subject": "${subject}", "lessons": [{"id": "lesson-1", "title": "...", "description": "...", "completed": false}]}`
                  }
                ],
                temperature: 0.3, // Lower temperature for more consistent results
                max_tokens: maxTokens
              })

              const content = response.choices[0].message.content
              if (!content) throw new Error('No content received from AI')

              const cleanedContent = this.cleanJsonResponse(content)
              const fixedContent = this.fixIncompleteJson(cleanedContent)
              const parsedData = JSON.parse(fixedContent)
              
              // Validate the response structure
              if (!parsedData.subject || !parsedData.lessons || !Array.isArray(parsedData.lessons)) {
                throw new Error('Invalid lesson plan structure from AI')
              }
              
              // Ensure we have a reasonable number of lessons
              if (parsedData.lessons.length < 3) {
                throw new Error(`Too few lessons generated: ${parsedData.lessons.length}`)
              }
              
              console.log(`✅ Successfully generated lesson plan with ${parsedData.lessons.length} lessons on attempt ${attempt}`)
              return parsedData
              
            } catch (error) {
              lastError = error as Error
              console.error(`❌ Attempt ${attempt} failed:`, error)
              
              // If it's the last attempt, don't retry
              if (attempt === maxRetries) {
                throw lastError
              }
              
              // Wait before retrying (exponential backoff)
              const delay = Math.pow(2, attempt) * 1000 // 2s, 4s...
              console.log(`⏳ Waiting ${delay}ms before retry...`)
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          }
          
          throw lastError || new Error('All retry attempts failed')
        }
      )
      
      // Create the lesson plan object
      // Type guard for planData
      interface PlanDataStructure {
        subject: string
        lessons: Array<{
          id?: string
          title?: string
          description?: string
        }>
      }
      
      const isPlanDataValid = (data: unknown): data is PlanDataStructure => {
        return typeof data === 'object' && data !== null &&
               'subject' in data && 'lessons' in data &&
               Array.isArray((data as PlanDataStructure).lessons)
      }
      
      if (!isPlanDataValid(planData)) {
        throw new Error('Invalid plan data structure from AI')
      }
      
      const lessonPlan: LessonPlan = {
        subject: planData.subject,
        lessons: planData.lessons.map((lesson, index: number) => ({
          id: lesson.id || `lesson-${index + 1}`,
          title: lesson.title || `Lesson ${index + 1}`,
          description: lesson.description || 'Learn the fundamentals of this topic.',
          completed: false,
          content: { type: 'concept-card', data: {} } // Will be generated when accessed
        })),
        currentLessonIndex: 0
      }

      this.lessonPlans.set(subject, lessonPlan)
      this.progress.set(subject, {
        correctAnswers: 0,
        totalAttempts: 0,
        needsReview: false,
        readyForNext: false
      })

      console.log(`✅ Lesson plan created and cached for "${subject}"`)
      console.log(`📚 Cache stats:`, this.aiCache.getStats())
      return lessonPlan
      
    } catch (error) {
      console.error('🚨 Error creating learning plan after all retries:', error)
      console.error('Error details:', {
        message: (error as Error).message,
        subject,
        timestamp: new Date().toISOString()
      })
      
      // Fallback plan if AI fails
      console.log('⚠️ Using fallback plan for subject:', subject)
      return this.createFallbackPlan(subject)
    }
  }

  async generateLessonContent(subject: string, lesson: Lesson, contentType: 'quiz' | 'explanation' | 'practice' | 'fill-blank' = 'explanation'): Promise<LessonContent> {
    console.log('🤖 AI Service: Generating content for:', lesson.title, 'Type:', contentType)
    
    // Get history of previously generated content for this lesson
    const contentHistory = this.getGeneratedContentHistory(subject, lesson.id)
    const previousQuestions = contentHistory.filter(item => item.type === contentType).map(item => item.question)
    const previousTopics = contentHistory.filter(item => item.type === contentType).map(item => item.topic)
    
    console.log('📚 Previous content for this lesson:', {
      totalGenerated: contentHistory.length,
      previousQuestions: previousQuestions.slice(-3), // Show last 3
      previousTopics: [...new Set(previousTopics)] // Unique topics
    })
    
    try {
      let prompt = ''
      
      if (contentType === 'quiz') {
        const avoidanceText = previousQuestions.length > 0 
          ? `\n\nIMPORTANT - AVOID REPETITION:
- DO NOT ask about these topics already covered: ${[...new Set(previousTopics)].join(', ')}
- DO NOT repeat these questions: ${previousQuestions.slice(-2).join(' | ')}
- Focus on a DIFFERENT aspect or sub-topic of "${lesson.title}"
- Vary the question type (factual, conceptual, application, analysis)`
          : ''

        prompt = `Create a multiple choice question for "${lesson.title}" in ${subject}. 

This is question #${contentHistory.filter(item => item.type === 'quiz').length + 1} for this lesson.

Return JSON:
{
  "type": "multiple-choice",
  "data": {
    "question": "Clear, specific question",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": 0,
    "explanation": "Why this answer is correct and others are wrong",
    "learningObjective": "What specific skill/knowledge this tests",
    "difficulty": "beginner|intermediate|advanced"
  }
}

Make it appropriately challenging but fair.${avoidanceText}`
      } else if (contentType === 'explanation') {
        prompt = `Create an interactive explanation for "${lesson.title}" in ${subject}.

Return JSON:
{
  "type": "concept-card", 
  "data": {
    "title": "${lesson.title}",
    "summary": "One sentence summary",
    "details": "2-3 sentences explaining the concept clearly",
    "examples": ["example1", "example2", "example3"],
    "keyPoints": ["point1", "point2", "point3"],
    "difficulty": "beginner"
  }
}

Explain like you're talking to a student. Be clear and engaging.`
      } else if (contentType === 'fill-blank') {
        const avoidanceText = previousQuestions.length > 0 
          ? `\n\nIMPORTANT - AVOID REPETITION:
- DO NOT repeat these exercises: ${previousQuestions.slice(-2).join(' | ')}
- Focus on a DIFFERENT concept or formula within "${lesson.title}"
- Vary the exercise type (definitions, formulas, processes, examples)`
          : ''

        prompt = `Create a fill-in-the-blank exercise for "${lesson.title}" in ${subject}.

This is exercise #${contentHistory.filter(item => item.type === 'fill-blank').length + 1} for this lesson.

Return JSON:
{
  "type": "fill-blank",
  "data": {
    "question": "A specific, contextual question about the topic - NOT generic text like 'Complete the following statement'",
    "template": "Educational text with ___ where students fill in blanks ___",
    "answers": ["answer1", "answer2"],
    "hints": ["hint for blank 1", "hint for blank 2"],
    "explanation": "Why these answers are correct",
    "category": "${lesson.title}",
    "difficulty": "beginner|intermediate|advanced",
    "learningObjective": "What specific skill/knowledge this tests"
  }
}

IMPORTANT: 
- Make the question specific and educational, like "Fill in the missing parts of this quadratic formula:" or "Complete this definition of photosynthosis:"
- Use ___ to mark where students should fill in answers
- Template should be meaningful educational content, not generic phrases
- Make it clear what specific concept is being tested${avoidanceText}`
      } else {
        const avoidanceText = previousQuestions.length > 0 
          ? `\n\nIMPORTANT - AVOID REPETITION:
- DO NOT repeat these problem types: ${previousQuestions.slice(-2).join(' | ')}
- Create a DIFFERENT scenario or application within "${lesson.title}"
- Vary the complexity and context (real-world applications, different scenarios)`
          : ''

        prompt = `Create a step-by-step practice problem for "${lesson.title}" in ${subject}.

This is problem #${contentHistory.filter(item => item.type === 'step-solver').length + 1} for this lesson.

Return JSON:
{
  "type": "step-solver",
  "data": {
    "problem": "A specific problem to solve",
    "problemType": "${lesson.title}",
    "steps": [
      {
        "id": "1",
        "description": "What to do",
        "calculation": "The work shown",
        "result": "What you get",
        "explanation": "Why this step matters"
      }
    ],
    "finalAnswer": "The complete answer",
    "difficulty": "beginner|intermediate|advanced",
    "learningObjective": "What specific skill this develops"
  }
}

Make it practical and educational.${avoidanceText}`
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert tutor creating educational content. Always return valid JSON."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })

      const content = response.choices[0].message.content
      if (!content) throw new Error('No content received')

      const cleanedContent = this.cleanJsonResponse(content)
      console.log('🧹 Cleaned lesson content response:', cleanedContent)
      
      // Try to fix incomplete JSON before parsing
      const fixedContent = this.fixIncompleteJson(cleanedContent)
      const parsedContent = JSON.parse(fixedContent)
      
      // Validate the content structure
      if (!parsedContent.type || !parsedContent.data) {
        throw new Error('Invalid lesson content structure from AI')
      }
      
      console.log('🎯 AI Service: Successfully generated content:', parsedContent)
      
      // Track this generated content to avoid repetition
      this.trackGeneratedContent(subject, lesson.id, contentType, parsedContent)
      
      return parsedContent
    } catch (error) {
      console.error('❌ AI Service: Error generating lesson content:', error)
      const fallbackContent = this.createFallbackContent(lesson, contentType)
      console.log('⚠️ AI Service: Using fallback content:', fallbackContent)
      return fallbackContent
    }
  }

  async generateTutorResponse(
    subject: string, 
    userAction: string, 
    actionData: unknown,
    context: { lesson: Lesson; progress: LearningProgress }
  ): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", 
        messages: [
          {
            role: "system",
            content: `You are a concise, action-oriented tutor teaching ${subject}. The student is working on "${context.lesson.title}". 

IMPORTANT: Be brief and actionable. Don't ask questions - provide clear explanations or confirmations. Focus on teaching, not conversation.

For correct answers: Brief praise + key insight
For wrong answers: Brief correction + explanation  
For interactions: Direct, helpful response

Student's progress: ${context.progress.correctAnswers}/${context.progress.totalAttempts} correct so far.`
          },
          {
            role: "user",
            content: `Student action: ${userAction}. Data: ${JSON.stringify(actionData)}`
          }
        ],
        temperature: 0.6,
        max_tokens: 150
      })

      return response.choices[0].message.content || "Keep going! You're doing great."
    } catch (error) {
      console.error('Error generating tutor response:', error)
      return this.generateFallbackResponse(userAction, actionData)
    }
  }

  updateProgress(subject: string, correct: boolean, lessonId?: string): LearningProgress {
    const progress = this.progress.get(subject) || {
      correctAnswers: 0,
      totalAttempts: 0,
      needsReview: false,
      readyForNext: false
    }

    progress.totalAttempts++
    if (correct) progress.correctAnswers++

    // More reasonable advancement criteria for better UX
    const minCorrectAnswers = 3 // Need at least 3 correct answers
    const minTotalAttempts = 3 // Need at least 3 total attempts (reduced from 4)
    const minAccuracy = 0.65 // Need 65% accuracy or better
    
    // Check if student has enough practice and high enough accuracy
    const hasEnoughPractice = progress.totalAttempts >= minTotalAttempts && progress.correctAnswers >= minCorrectAnswers
    const hasGoodAccuracy = progress.correctAnswers / progress.totalAttempts >= minAccuracy
    
    // Simplified content variety check - just need some practice, not all types
    let hasContentVariety = true
    if (lessonId) {
      const varietyStats = this.getContentVarietyStats(subject, lessonId)
      // More lenient: just need 2+ total items OR good performance
      hasContentVariety = varietyStats.totalItems >= 2 || hasGoodAccuracy
      
      console.log(`📊 Content variety check for ${lessonId}:`, {
        totalItems: varietyStats.totalItems,
        byType: varietyStats.byType,
        uniqueTopics: varietyStats.uniqueTopics.length,
        hasContentVariety,
        originalVariety: varietyStats.hasMinimumVariety
      })
    }
    
    progress.readyForNext = hasEnoughPractice && hasGoodAccuracy && hasContentVariety
    progress.needsReview = progress.totalAttempts >= 3 && !progress.readyForNext // Reduced from 4

    console.log(`📊 Progress update for ${subject}:`, {
      correctAnswers: progress.correctAnswers,
      totalAttempts: progress.totalAttempts,
      accuracy: Math.round((progress.correctAnswers / progress.totalAttempts) * 100) + '%',
      readyForNext: progress.readyForNext,
      needsReview: progress.needsReview,
      hasContentVariety
    })

    this.progress.set(subject, progress)
    return progress
  }

  getLessonPlan(subject: string): LessonPlan | null {
    return this.lessonPlans.get(subject) || null
  }

  getProgress(subject: string): LearningProgress | null {
    return this.progress.get(subject) || null
  }

  // Load lesson plan from database (for resuming progress)
  loadLessonPlan(subject: string, lessonPlan: LessonPlan): void {
    console.log('📥 Loading lesson plan from database for:', subject)
    this.lessonPlans.set(subject, lessonPlan)
    console.log('✅ Lesson plan loaded into cache:', lessonPlan.lessons.length, 'lessons')
  }

  // Load progress from database (for resuming progress)
  loadProgress(subject: string, progress: LearningProgress): void {
    console.log('📥 Loading progress from database for:', subject)
    this.progress.set(subject, progress)
    console.log('✅ Progress loaded into cache:', progress.correctAnswers, '/', progress.totalAttempts, 'correct')
  }

  // Clear cached data for a specific subject
  clearSubjectData(subject: string): void {
    console.log('🗑️ Clearing cached data for subject:', subject)
    this.lessonPlans.delete(subject)
    this.progress.delete(subject)
    
    // Clear generated content for this subject
    const keysToDelete = Array.from(this.generatedContent.keys()).filter(key => 
      key.startsWith(`${subject}-`)
    )
    keysToDelete.forEach(key => this.generatedContent.delete(key))
    
    console.log('✅ Cleared lesson plan, progress, and generated content for:', subject)
  }

  // Clear all cached data (useful when logging out or resetting)
  clearAllData(): void {
    console.log('🗑️ Clearing all cached AI tutor data')
    this.lessonPlans.clear()
    this.progress.clear()
    this.generatedContent.clear()
    this.lastApiCallTime = 0
    console.log('✅ All AI tutor data cleared')
  }

  // Get all cached subjects (for debugging)
  getCachedSubjects(): string[] {
    return Array.from(this.lessonPlans.keys())
  }

  private trackGeneratedContent(subject: string, lessonId: string, contentType: string, content: { data?: { question?: string; problem?: string; title?: string; category?: string; problemType?: string; difficulty?: string } }) {
    const key = `${subject}-${lessonId}`
    const existing = this.generatedContent.get(key) || []
    
    const contentItem = {
      type: contentType,
      question: content.data?.question || content.data?.problem || content.data?.title,
      topic: content.data?.category || content.data?.problemType,
      difficulty: content.data?.difficulty || 'intermediate',
      timestamp: Date.now()
    }
    
    existing.push(contentItem)
    this.generatedContent.set(key, existing)
    
    console.log('📝 Tracked generated content:', contentItem)
  }

  private getGeneratedContentHistory(subject: string, lessonId: string): Array<{
    type: string
    question?: string
    topic?: string
    difficulty?: string
    timestamp: number
  }> {
    const key = `${subject}-${lessonId}`
    return this.generatedContent.get(key) || []
  }

  private clearContentHistory(subject: string, lessonId: string) {
    const key = `${subject}-${lessonId}`
    this.generatedContent.delete(key)
    console.log('🗑️ Cleared content history for:', key)
  }

  getContentVarietyStats(subject: string, lessonId: string): {
    totalItems: number,
    byType: Record<string, number>,
    uniqueTopics: string[],
    recentQuestions: string[],
    hasMinimumVariety: boolean
  } {
    const history = this.getGeneratedContentHistory(subject, lessonId)
    const byType: Record<string, number> = {}
    const topics = new Set<string>()
    
    history.forEach(item => {
      byType[item.type] = (byType[item.type] || 0) + 1
      if (item.topic) topics.add(item.topic)
    })
    
    // Check if lesson has minimum content variety
    const hasMinQuiz = (byType['quiz'] || 0) >= 2
    const hasMinFillBlank = (byType['fill-blank'] || 0) >= 1  
    const hasMinPractice = (byType['step-solver'] || 0) >= 1
    const hasMinTopics = topics.size >= 3
    
    const hasMinimumVariety = hasMinQuiz && hasMinFillBlank && hasMinPractice && hasMinTopics
    
    return {
      totalItems: history.length,
      byType,
      uniqueTopics: Array.from(topics),
      recentQuestions: history.slice(-3).map(item => item.question || 'N/A'),
      hasMinimumVariety
    }
  }

  advanceToNextLesson(subject: string): boolean {
    console.log('🚀 advanceToNextLesson called for subject:', subject)
    
    const plan = this.lessonPlans.get(subject)
    if (!plan) {
      console.log('❌ No lesson plan found for subject:', subject)
      console.log('📚 Available subjects:', Array.from(this.lessonPlans.keys()))
      return false
    }

    console.log('📋 Current lesson plan state before advancement:', {
      currentLessonIndex: plan.currentLessonIndex,
      totalLessons: plan.lessons.length,
      canAdvance: plan.currentLessonIndex < plan.lessons.length - 1
    })

    if (plan.currentLessonIndex < plan.lessons.length - 1) {
      const completedLesson = plan.lessons[plan.currentLessonIndex]
      console.log('✅ Marking lesson as completed:', completedLesson.title)
      plan.lessons[plan.currentLessonIndex].completed = true
      
      // Clear content history for completed lesson
      this.clearContentHistory(subject, completedLesson.id)
      
      // Advance to next lesson
      const oldIndex = plan.currentLessonIndex
      plan.currentLessonIndex++
      console.log(`📈 Advanced from lesson ${oldIndex + 1} to lesson ${plan.currentLessonIndex + 1}`)
      
      // Reset progress for new lesson
      this.progress.set(subject, {
        correctAnswers: 0,
        totalAttempts: 0,
        needsReview: false,
        readyForNext: false
      })
      
      console.log('🔄 Reset progress for new lesson')
      console.log('🎯 New current lesson:', plan.lessons[plan.currentLessonIndex].title)
      
      return true
    } else {
      console.log('🏁 Already at the last lesson, course completed')
      return false
    }
  }

  private createFallbackPlan(subject: string): LessonPlan {
    return {
      subject,
      lessons: [
        {
          id: 'lesson-1',
          title: `Introduction to ${subject}`,
          description: `Learn the basics of ${subject}`,
          content: { type: 'concept-card', data: {} },
          completed: false
        },
        {
          id: 'lesson-2', 
          title: `Core Concepts in ${subject}`,
          description: `Understand key principles`,
          content: { type: 'multiple-choice', data: {} },
          completed: false
        },
        {
          id: 'lesson-3',
          title: `Practice with ${subject}`,
          description: `Apply what you've learned`,
          content: { type: 'step-solver', data: {} },
          completed: false
        }
      ],
      currentLessonIndex: 0
    }
  }

  private createFallbackContent(lesson: Lesson, contentType: string): LessonContent {
    if (contentType === 'quiz') {
      return {
        type: 'multiple-choice',
        data: {
          question: `What is an important aspect of ${lesson.title}?`,
          options: ['Understanding the concept', 'Memorizing facts', 'Skipping practice', 'Avoiding questions'],
          correctAnswer: 0,
          explanation: 'Understanding concepts is always better than just memorizing facts.'
        }
      }
    }
    
    if (contentType === 'fill-blank') {
      return {
        type: 'fill-blank',
        data: {
          question: `Complete this statement about ${lesson.title}`,
          template: `The key to understanding ${lesson.title} is to ___ and then ___.`,
          answers: ['practice regularly', 'apply the concepts'],
          hints: ['What should you do consistently?', 'What should you do with what you learn?'],
          explanation: 'Regular practice and applying concepts are fundamental to mastering any subject.',
          category: lesson.title,
          difficulty: 'beginner'
        }
      }
    }
    
    return {
      type: 'concept-card',
      data: {
        title: lesson.title,
        summary: `Learn about ${lesson.title}`,
        details: `This lesson covers the important aspects of ${lesson.title} that will help you understand the subject better.`,
        examples: ['Example 1', 'Example 2', 'Example 3'],
        keyPoints: ['Key concept 1', 'Key concept 2', 'Key concept 3'],
        difficulty: 'intermediate'
      }
    }
  }

  private generateFallbackResponse(action: string, data: unknown): string {
    // Type guard for answer submission data
    const isAnswerData = (d: unknown): d is { correct: boolean } => {
      return typeof d === 'object' && d !== null && 'correct' in d
    }
    
    if (action === 'answer_submitted' && isAnswerData(data)) {
      return data.correct ? "That's right! Good job." : "Not quite, but keep trying!"
    }
    return "Keep exploring! You're doing great."
  }
}

export const aiTutor = new AITutorService() 