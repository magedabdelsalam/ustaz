import { chatCompletion } from '@/lib/openaiClient'
import { logger } from '@/lib/logger'

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
      logger.debug(`🎯 Cache hit for ${type}`)
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
    
    logger.debug(`💾 Cached ${type} response (cache size: ${this.cache.size})`)
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
  type: 'multiple-choice' | 'concept-card' | 'step-solver' | 'fill-blank' | 'explainer' | 'interactive-example' | 'text-highlighter' | 'drag-drop' | 'graph-visualizer' | 'formula-explorer'
  data: unknown
}

export interface LearningProgress {
  correctAnswers: number
  totalAttempts: number
  needsReview: boolean
  readyForNext: boolean
}

export interface ProgressCriteria {
  minCorrectAnswers: number
  minTotalAttempts: number
  minAccuracy: number
  adaptiveFactors: {
    difficultyAdjustment: number
    engagementWeight: number
    retentionFactor: number
  }
  reasoning?: string
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
      logger.debug(`⏳ Throttling API call, waiting ${waitTime}ms...`)
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
      logger.debug('🔧 Attempting to fix incomplete JSON')
      
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
        logger.debug('✅ Successfully fixed incomplete JSON')
        return fixed
      } catch {
        logger.debug('❌ Could not fix JSON, will use fallback')
        throw new Error('Unable to fix incomplete JSON response')
      }
    }
  }

  async createLearningPlan(subject: string): Promise<LessonPlan> {
    try {
      logger.debug('🤖 AI Service creating lesson plan for:', subject)
      
      // Define interface for plan structure data
      interface PlanStructureData {
        recommendedLessons: number
        complexity: 'beginner' | 'intermediate' | 'advanced'
        focusAreas: string[]
        learningObjectives: string[]
        estimatedHoursPerLesson: number
        prerequisites: string[]
        reasoning: string
      }
      
      // Use AI to determine appropriate lesson count and structure based on subject
      const planStructureData = await this.cachedApiCall(
        'lesson-structure',
        { subject },
        async () => {
          const response = await chatCompletion({
            messages: [
              {
                role: "system",
                content: `You are an expert curriculum designer. Analyze the subject "${subject}" and determine the optimal learning structure.`
              },
              {
                role: "user", 
                content: `Analyze "${subject}" and return JSON with:
{
  "recommendedLessons": number (6-15 based on complexity),
  "complexity": "beginner|intermediate|advanced",
  "focusAreas": ["area1", "area2", "area3"],
  "learningObjectives": ["objective1", "objective2"],
  "estimatedHoursPerLesson": number (0.5-3),
  "prerequisites": ["prereq1", "prereq2"] or [],
  "reasoning": "Why this structure works for this subject"
}

Consider:
- Subject complexity and depth
- Typical learning progression
- Practical vs theoretical balance
- Student engagement factors`
              }
            ],
            temperature: 0.4,
            max_tokens: 800
          })

          const content = response.choices[0].message.content
          if (!content) throw new Error('No structure analysis received')
          
          const cleanedContent = this.cleanJsonResponse(content)
          return JSON.parse(cleanedContent)
        }
      ) as PlanStructureData

      const expectedLessons = planStructureData.recommendedLessons || 8
      const complexity = planStructureData.complexity || 'intermediate'
      
      logger.debug(`📚 AI recommended ${expectedLessons} lessons for "${subject}" (complexity: ${complexity})`)
      
      // Determine token limit based on AI analysis rather than hardcoded rules
      const maxTokens = expectedLessons >= 12 ? 2500 : 
                        complexity === 'advanced' ? 2200 : 
                        complexity === 'beginner' ? 1200 : 1600
      
      logger.debug(`🎯 Using ${maxTokens} tokens for ${expectedLessons} lessons`)
      
      // Create cache parameters for this lesson plan request
      const cacheParams = { subject, expectedLessons, maxTokens, complexity, focusAreas: planStructureData.focusAreas }
      
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
              logger.debug(`🔄 Attempt ${attempt}/${maxRetries} for lesson plan generation`)
              
              const response = await chatCompletion({
                messages: [
                  {
                    role: "system",
                    content: `You are an expert curriculum designer creating a comprehensive learning plan. Create exactly ${expectedLessons} progressive lessons that build upon each other logically.`
                  },
                  {
                    role: "user",
                    content: `Create a learning plan for "${subject}" with exactly ${expectedLessons} lessons.

Subject Analysis:
- Complexity: ${complexity}
- Focus Areas: ${planStructureData.focusAreas?.join(', ') || 'General'}
- Learning Objectives: ${planStructureData.learningObjectives?.join(', ') || 'Comprehensive understanding'}

Return JSON:
{
  "subject": "${subject}",
  "lessons": [
    {
      "id": "lesson-1",
      "title": "Descriptive, engaging lesson title",
      "description": "What students will learn and why it matters",
      "completed": false
    }
  ]
}

Requirements:
- Each lesson should build naturally on previous ones
- Titles should be specific and engaging, not generic
- Descriptions should explain practical value
- Progress from foundational to advanced concepts
- Include real-world applications where relevant`
                  }
                ],
                temperature: 0.3,
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
              
              logger.debug(`✅ Successfully generated lesson plan with ${parsedData.lessons.length} lessons on attempt ${attempt}`)
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
              logger.debug(`⏳ Waiting ${delay}ms before retry...`)
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
      
      // Initialize dynamic progress criteria based on AI analysis
      const initialProgress = await this.initializeDynamicProgress(subject, complexity)
      this.progress.set(subject, initialProgress)

      logger.debug(`✅ Lesson plan created and cached for "${subject}"`)
      logger.debug(`📚 Cache stats:`, this.aiCache.getStats())
      return lessonPlan
      
    } catch (error) {
      console.error('🚨 Error creating learning plan after all retries:', error)
      console.error('Error details:', {
        message: (error as Error).message,
        subject,
        timestamp: new Date().toISOString()
      })
      
      // Generate dynamic fallback plan if AI fails
      logger.debug('⚠️ Generating dynamic fallback plan for subject:', subject)
      return await this.generateDynamicFallbackPlan(subject)
    }
  }

  // Store dynamic criteria for each subject
  private subjectCriteria: Map<string, ProgressCriteria> = new Map()

  // Initialize progress with dynamic criteria based on subject analysis
  private async initializeDynamicProgress(subject: string, complexity: string): Promise<LearningProgress> {
    try {
      const progressCriteria = await this.cachedApiCall(
        'progress-criteria',
        { subject, complexity },
        async () => {
          const response = await chatCompletion({
            messages: [
              {
                role: "system",
                content: `You are an expert in learning analytics. Determine optimal progress criteria for "${subject}".`
              },
              {
                role: "user",
                content: `Analyze "${subject}" (complexity: ${complexity}) and determine optimal learning progress criteria.

Return JSON:
{
  "minCorrectAnswers": number (2-5),
  "minTotalAttempts": number (3-6), 
  "minAccuracy": number (0.6-0.8),
  "adaptiveFactors": {
    "difficultyAdjustment": number (0.8-1.2),
    "engagementWeight": number (0.1-0.3),
    "retentionFactor": number (0.7-0.9)
  },
  "reasoning": "Why these criteria work for this subject"
}

Consider:
- Subject difficulty and abstract nature
- Typical learning curves
- Importance of accuracy vs exploration
- Student motivation factors`
              }
            ],
            temperature: 0.3,
            max_tokens: 400
          })

          const content = response.choices[0].message.content
          if (!content) throw new Error('No criteria received')
          
          const cleanedContent = this.cleanJsonResponse(content)
          return JSON.parse(cleanedContent)
        }
      )

      // Store dynamic criteria for this subject
      this.subjectCriteria.set(subject, progressCriteria as ProgressCriteria)
      
      return {
        correctAnswers: 0,
        totalAttempts: 0,
        needsReview: false,
        readyForNext: false
      }
    } catch (error) {
      logger.error('Failed to initialize dynamic progress, using adaptive defaults:', error)
      return {
        correctAnswers: 0,
        totalAttempts: 0,
        needsReview: false,
        readyForNext: false
      }
    }
  }

  // Get intelligent default criteria when dynamic criteria aren't available
  private getAdaptiveDefaults(subject: string): ProgressCriteria {
    // Analyze subject name for hints about difficulty and learning style
    const subjectLower = subject.toLowerCase()
    
    // Math/Science subjects might need more precision
    const isMathScience = ['math', 'physics', 'chemistry', 'calculus', 'algebra', 'geometry', 'statistics'].some(term => 
      subjectLower.includes(term)
    )
    
    // Language/Literature subjects might benefit from more exploration
    const isLanguageArts = ['language', 'literature', 'writing', 'english', 'spanish', 'french', 'poetry'].some(term => 
      subjectLower.includes(term)
    )
    
    // Creative subjects might need different success metrics
    const isCreative = ['art', 'music', 'design', 'creative', 'drawing', 'painting'].some(term => 
      subjectLower.includes(term)
    )
    
    // History/Social studies might benefit from broader exploration
    const isSocial = ['history', 'geography', 'social', 'politics', 'economics', 'culture'].some(term => 
      subjectLower.includes(term)
    )
    
    if (isMathScience) {
      return {
        minCorrectAnswers: 4,
        minTotalAttempts: 5,
        minAccuracy: 0.75,
        adaptiveFactors: {
          difficultyAdjustment: 1.1,
          engagementWeight: 0.15,
          retentionFactor: 0.85
        }
      }
    } else if (isLanguageArts) {
      return {
        minCorrectAnswers: 3,
        minTotalAttempts: 4,
        minAccuracy: 0.6,
        adaptiveFactors: {
          difficultyAdjustment: 0.9,
          engagementWeight: 0.25,
          retentionFactor: 0.75
        }
      }
    } else if (isCreative) {
      return {
        minCorrectAnswers: 2,
        minTotalAttempts: 3,
        minAccuracy: 0.55,
        adaptiveFactors: {
          difficultyAdjustment: 0.8,
          engagementWeight: 0.3,
          retentionFactor: 0.7
        }
      }
    } else if (isSocial) {
      return {
        minCorrectAnswers: 3,
        minTotalAttempts: 4,
        minAccuracy: 0.65,
        adaptiveFactors: {
          difficultyAdjustment: 0.95,
          engagementWeight: 0.2,
          retentionFactor: 0.8
        }
      }
    } else {
      // General subjects
      return {
        minCorrectAnswers: 3,
        minTotalAttempts: 4,
        minAccuracy: 0.65,
        adaptiveFactors: {
          difficultyAdjustment: 1.0,
          engagementWeight: 0.2,
          retentionFactor: 0.75
        }
      }
    }
  }

  // Evaluate content variety dynamically based on subject and performance
  private evaluateDynamicContentVariety(subject: string, lessonId: string, progress: LearningProgress): boolean {
    const history = this.getGeneratedContentHistory(subject, lessonId)
    const accuracy = progress.correctAnswers / progress.totalAttempts
    
    // High performers need less variety, struggling students might benefit from more
    if (accuracy >= 0.8) {
      // High accuracy - less variety needed
      return history.length >= 2
    } else if (accuracy >= 0.6) {
      // Medium accuracy - moderate variety
      return history.length >= 3 && new Set(history.map(h => h.type)).size >= 2
    } else {
      // Lower accuracy - more variety to find what works
      return history.length >= 4 && new Set(history.map(h => h.type)).size >= 3
    }
  }

  // Calculate engagement score based on recent interaction patterns
  private calculateEngagementScore(subject: string, lessonId?: string): number {
    if (!lessonId) return 0.5 // Default neutral engagement
    
    const history = this.getGeneratedContentHistory(subject, lessonId)
    if (history.length === 0) return 0.5
    
    // Look at recent activity (last 5 interactions)
    const recentHistory = history.slice(-5)
    const timeNow = Date.now()
    
    // Calculate recency score (more recent = higher engagement)
    const recencyScore = recentHistory.reduce((score, item) => {
      const hoursSince = (timeNow - item.timestamp) / (1000 * 60 * 60)
      const recencyWeight = Math.max(0, 1 - (hoursSince / 24)) // Decay over 24 hours
      return score + recencyWeight
    }, 0) / recentHistory.length
    
    // Calculate variety score (more variety = higher engagement)
    const uniqueTypes = new Set(recentHistory.map(h => h.type)).size
    const varietyScore = Math.min(1, uniqueTypes / 3) // Cap at 3 types
    
    // Calculate consistency score (steady progress = higher engagement)
    const consistencyScore = recentHistory.length >= 3 ? 1 : recentHistory.length / 3
    
    // Combine scores with weights
    return (recencyScore * 0.4) + (varietyScore * 0.3) + (consistencyScore * 0.3)
  }

  getLessonPlan(subject: string): LessonPlan | null {
    return this.lessonPlans.get(subject) || null
  }

  getProgress(subject: string): LearningProgress | null {
    return this.progress.get(subject) || null
  }

  // Update progress for a subject
  updateProgress(subject: string, isCorrect: boolean, lessonId?: string): LearningProgress | null {
    const currentProgress = this.progress.get(subject)
    if (!currentProgress) {
      logger.debug('❌ No progress found for subject:', subject)
      return null
    }

    // Update basic stats
    currentProgress.totalAttempts += 1
    if (isCorrect) {
      currentProgress.correctAnswers += 1
    }

    const accuracy = currentProgress.correctAnswers / currentProgress.totalAttempts

    // Get dynamic criteria for this subject
    const criteria = this.subjectCriteria.get(subject) || this.getAdaptiveDefaults(subject)
    
    // Calculate engagement score if lesson ID provided
    let engagementScore = 0.5 // Default neutral
    if (lessonId) {
      engagementScore = this.calculateEngagementScore(subject, lessonId)
    }

    // Apply adaptive factors to criteria
    const adjustedMinCorrect = Math.ceil(criteria.minCorrectAnswers * criteria.adaptiveFactors.difficultyAdjustment)
    const adjustedMinAccuracy = criteria.minAccuracy * (1 + (engagementScore - 0.5) * criteria.adaptiveFactors.engagementWeight)
    const adjustedMinAttempts = Math.max(criteria.minTotalAttempts, adjustedMinCorrect + 1)

    // Determine if student is ready for next lesson
    const meetsMinimumCorrect = currentProgress.correctAnswers >= adjustedMinCorrect
    const meetsMinimumAttempts = currentProgress.totalAttempts >= adjustedMinAttempts
    const meetsAccuracy = accuracy >= adjustedMinAccuracy
    
    // Content variety check if lesson ID provided
    let hasContentVariety = true
    if (lessonId) {
      hasContentVariety = this.evaluateDynamicContentVariety(subject, lessonId, currentProgress)
    }

    currentProgress.readyForNext = meetsMinimumCorrect && meetsMinimumAttempts && meetsAccuracy && hasContentVariety
    currentProgress.needsReview = accuracy < (adjustedMinAccuracy * 0.8) // Needs review if accuracy is significantly below target

    logger.debug('📊 Progress updated:', {
      subject,
      correctAnswers: currentProgress.correctAnswers,
      totalAttempts: currentProgress.totalAttempts,
      accuracy: Math.round(accuracy * 100),
      readyForNext: currentProgress.readyForNext,
      needsReview: currentProgress.needsReview,
      criteria: {
        adjustedMinCorrect,
        adjustedMinAccuracy: Math.round(adjustedMinAccuracy * 100),
        adjustedMinAttempts,
        engagementScore: Math.round(engagementScore * 100),
        hasContentVariety
      }
    })

    // Update in-memory progress
    this.progress.set(subject, currentProgress)
    
    return currentProgress
  }

  // Load lesson plan from database (for resuming progress)
  loadLessonPlan(subject: string, lessonPlan: LessonPlan): void {
    logger.debug('📥 Loading lesson plan from database for:', subject)
    this.lessonPlans.set(subject, lessonPlan)
    logger.debug('✅ Lesson plan loaded into cache:', lessonPlan.lessons.length, 'lessons')
  }

  // Load progress from database (for resuming progress)
  loadProgress(subject: string, progress: LearningProgress): void {
    logger.debug('📥 Loading progress from database for:', subject)
    this.progress.set(subject, progress)
    logger.debug('✅ Progress loaded into cache:', progress.correctAnswers, '/', progress.totalAttempts, 'correct')
  }

  // Clear cached data for a specific subject
  clearSubjectData(subject: string): void {
    logger.debug('🗑️ Clearing cached data for subject:', subject)
    this.lessonPlans.delete(subject)
    this.progress.delete(subject)
    
    // Clear generated content for this subject
    const keysToDelete = Array.from(this.generatedContent.keys()).filter(key => 
      key.startsWith(`${subject}-`)
    )
    keysToDelete.forEach(key => this.generatedContent.delete(key))
    
    logger.debug('✅ Cleared lesson plan, progress, and generated content for:', subject)
  }

  // Clear all cached data (useful when logging out or resetting)
  clearAllData(): void {
    logger.debug('🗑️ Clearing all cached AI tutor data')
    this.lessonPlans.clear()
    this.progress.clear()
    this.generatedContent.clear()
    this.lastApiCallTime = 0
    logger.debug('✅ All AI tutor data cleared')
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
    
    logger.debug('📝 Tracked generated content:', contentItem)
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
    logger.debug('🗑️ Cleared content history for:', key)
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
    
    // Use dynamic variety evaluation instead of hardcoded requirements
    const hasMinimumVariety = this.evaluateDynamicContentVariety(subject, lessonId, { correctAnswers: 1, totalAttempts: 1, needsReview: false, readyForNext: false })
    
    return {
      totalItems: history.length,
      byType,
      uniqueTopics: Array.from(topics),
      recentQuestions: history.slice(-3).map(item => item.question || 'N/A'),
      hasMinimumVariety
    }
  }

  advanceToNextLesson(subject: string): boolean {
    logger.debug('🚀 advanceToNextLesson called for subject:', subject)
    
    const plan = this.lessonPlans.get(subject)
    if (!plan) {
      logger.debug('❌ No lesson plan found for subject:', subject)
      logger.debug('📚 Available subjects:', Array.from(this.lessonPlans.keys()))
      return false
    }

    logger.debug('📋 Current lesson plan state before advancement:', {
      currentLessonIndex: plan.currentLessonIndex,
      totalLessons: plan.lessons.length,
      canAdvance: plan.currentLessonIndex < plan.lessons.length - 1
    })

    if (plan.currentLessonIndex < plan.lessons.length - 1) {
      const completedLesson = plan.lessons[plan.currentLessonIndex]
      logger.debug('✅ Marking lesson as completed:', completedLesson.title)
      plan.lessons[plan.currentLessonIndex].completed = true
      
      // Clear content history for completed lesson
      this.clearContentHistory(subject, completedLesson.id)
      
      // Advance to next lesson
      const oldIndex = plan.currentLessonIndex
      plan.currentLessonIndex++
      logger.debug(`📈 Advanced from lesson ${oldIndex + 1} to lesson ${plan.currentLessonIndex + 1}`)
      
      // Reset progress for new lesson
      this.progress.set(subject, {
        correctAnswers: 0,
        totalAttempts: 0,
        needsReview: false,
        readyForNext: false
      })
      
      logger.debug('🔄 Reset progress for new lesson')
      logger.debug('🎯 New current lesson:', plan.lessons[plan.currentLessonIndex].title)
      
      return true
    } else {
      logger.debug('🏁 Already at the last lesson, course completed')
      return false
    }
  }

  private createFallbackContent(lesson: Lesson, contentType: string): LessonContent {
    // Generate dynamic fallback content using AI
    return this.generateDynamicFallbackContent(lesson, contentType)
  }

  // Generate dynamic fallback content using AI when main content generation fails
  private generateDynamicFallbackContent(lesson: Lesson, contentType: string): LessonContent {
    try {
      // Use a simplified AI call for fallback content
      const fallbackPrompt = this.createFallbackPrompt(lesson, contentType)
      
      // Try to generate with AI, but with shorter timeout and simpler prompts
      chatCompletion({
        messages: [
          {
            role: "system",
            content: "You are a tutor creating simple educational content. Keep responses concise and practical."
          },
          {
            role: "user",
            content: fallbackPrompt
          }
        ],
        temperature: 0.5,
        max_tokens: 800
      }).then(response => {
        const content = response.choices[0].message.content
        if (content) {
          try {
            const cleanedContent = this.cleanJsonResponse(content)
            return JSON.parse(cleanedContent)
          } catch (error) {
            logger.debug('Fallback AI parse failed, using template fallback:', error)
          }
        }
      }).catch(error => {
        logger.debug('Fallback AI generation failed:', error)
      })
    } catch (error) {
      logger.debug('Dynamic fallback content generation failed:', error)
    }

    // Ultimate template fallback if AI is completely unavailable
    return this.createTemplateFallback(lesson, contentType)
  }

  private createFallbackPrompt(lesson: Lesson, contentType: string): string {
    switch (contentType) {
      case 'quiz':
      case 'multiple-choice':
        return `Create a simple multiple choice question about "${lesson.title}".
Return JSON: {"type": "multiple-choice", "data": {"question": "Simple question", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "Brief explanation"}}`

      case 'fill-blank':
        return `Create a fill-in-the-blank exercise about "${lesson.title}".
Return JSON: {"type": "fill-blank", "data": {"question": "Complete this about ${lesson.title}", "template": "Text with ___ blanks ___", "answers": ["answer1", "answer2"], "hints": ["hint1", "hint2"], "explanation": "Why these answers work"}}`

      case 'concept-card':
        return `Create a concept card explaining "${lesson.title}".
Return JSON: {"type": "concept-card", "data": {"title": "${lesson.title}", "summary": "One sentence summary", "details": "Brief explanation", "examples": ["example1", "example2"], "keyPoints": ["point1", "point2"], "difficulty": "beginner"}}`

      case 'step-solver':
        return `Create a step-by-step problem for "${lesson.title}".
Return JSON: {"type": "step-solver", "data": {"problem": "Simple problem", "steps": [{"id": "1", "description": "Step", "calculation": "Work", "result": "Result", "explanation": "Why"}], "finalAnswer": "Answer", "difficulty": "beginner"}}`

      default:
        return `Create educational content about "${lesson.title}" in format "${contentType}".
Return valid JSON with type "${contentType}" and appropriate data structure.`
    }
  }

  private createTemplateFallback(lesson: Lesson, contentType: string): LessonContent {
    if (contentType === 'quiz' || contentType === 'multiple-choice') {
      return {
        type: 'multiple-choice',
        data: {
          question: `What is an important aspect of ${lesson.title}?`,
          options: ['Understanding the concept', 'Memorizing facts', 'Skipping practice', 'Avoiding questions'],
          correctAnswer: 0,
          explanation: 'Understanding concepts is always better than just memorizing facts.',
          difficulty: 'beginner'
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

    if (contentType === 'step-solver') {
      return {
        type: 'step-solver',
        data: {
          problem: `Apply the principles of ${lesson.title} to solve this practice problem`,
          problemType: lesson.title,
          steps: [
            {
              id: "1",
              description: "Identify the key concepts",
              calculation: "Review what you know about " + lesson.title,
              result: "Clear understanding of fundamentals",
              explanation: "Starting with basics ensures solid foundation"
            },
            {
              id: "2", 
              description: "Apply the concepts",
              calculation: "Use your knowledge to work through the problem",
              result: "Solution using " + lesson.title + " principles",
              explanation: "Practical application reinforces learning"
            }
          ],
          finalAnswer: `Successful application of ${lesson.title} concepts`,
          difficulty: 'beginner',
          learningObjective: `Practice applying ${lesson.title} in real scenarios`
        }
      }
    }
    
    // Default to concept card for any other content type
    return {
      type: 'concept-card',
      data: {
        title: lesson.title,
        summary: `${lesson.title} is an important topic that builds foundational understanding.`,
        details: `This lesson introduces key concepts that will help you develop a deeper understanding of the subject. The material covers essential principles that connect to broader topics and practical applications.`,
        examples: [
          'Real-world applications of these concepts',
          'How this topic connects to other areas of study',
          'Practical situations where this knowledge is useful'
        ],
        keyPoints: [
          'Understanding the fundamental principles',
          'Connecting concepts to practical applications',
          'Building skills for advanced topics',
          'Developing critical thinking abilities'
        ],
        difficulty: 'beginner'
      }
    }
  }

  private generateFallbackResponse(action: string, data: unknown): string {
    // Try to generate AI fallback response first
    try {
      // Create a simple prompt for fallback responses
      const prompt = this.createFallbackResponsePrompt(action)
      
      // Attempt quick AI generation with reduced complexity
      chatCompletion({
        messages: [
          {
            role: "system",
            content: "You are a direct tutor. Give brief, clear responses (1 sentence max). Be specific to the action."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 50
      }).then(response => {
        const content = response.choices[0].message.content
        if (content && content.length > 0) {
          return content.trim()
        }
      }).catch(() => {
        // Silent fail to ultimate fallback
      })
    } catch {
      // Silent fail to ultimate fallback
    }

    // Ultimate simple fallbacks only if AI completely fails
    return this.getUltimateFallbackResponse(action, data)
  }

  private createFallbackResponsePrompt(action: string): string {
    switch (action) {
      // Answer submission actions
      case 'answer_submitted':
        return "Student submitted an answer. Give brief feedback (1 sentence max)."

      case 'fill_blank_submitted':
        return "Student completed a fill-in-the-blank exercise. Give brief feedback (1 sentence max)."

      case 'drag_drop_submitted':
        return "Student completed a drag and drop exercise. Give brief feedback (1 sentence max)."

      case 'quiz_submitted':
        return "Student completed a quiz. Give brief feedback (1 sentence max)."

      case 'highlights_checked':
        return "Student completed a text highlighting exercise. Give brief feedback (1 sentence max)."

      // Help and explanation requests
      case 'explain_more':
        return "Student wants more explanation. Briefly acknowledge (1 sentence max)."

      case 'question_requested':
        return "Student wants to ask a question. Brief acknowledgment (1 sentence max)."

      case 'detail_expanded':
        return "Student expanded a detail section. Brief acknowledgment (1 sentence max)."

      case 'concept_expanded':
        return "Student wants deeper explanation of a concept. Brief acknowledgment (1 sentence max)."

      case 'examples_requested':
        return "Student wants more examples. Brief acknowledgment (1 sentence max)."

      // Next content requests
      case 'next_question':
        return "Student wants another question. Give brief acknowledgment (1 sentence max)."

      case 'next_exercise':
        return "Student wants another exercise. Give brief acknowledgment (1 sentence max)."

      case 'next_problem':
        return "Student wants another problem. Give brief acknowledgment (1 sentence max)."

      // Reset actions from various components
      case 'reset_question':
      case 'fill_blank_reset':
      case 'drag_drop_reset':
      case 'solver_reset':
      case 'quiz_reset':
      case 'graph_reset':
        return "Student reset an exercise. Acknowledge the reset (1 sentence max)."

      // Quiz progression
      case 'quiz_started':
        return "Student started a quiz. Brief acknowledgment (1 sentence max)."

      // Ready for practice
      case 'ready_for_next':
      case 'ready_for_practice':
        return "Student is ready to practice. Brief acknowledgment (1 sentence max)."

      // Graph interaction
      case 'graph_control_changed':
        return "Student adjusted graph controls. Brief acknowledgment (1 sentence max)."

      // Progress tracking actions (from ChatPane)
      case 'needs_more_practice':
        return "Student needs more practice. Give direct feedback about next steps (1 sentence max)."
        
      case 'continue_practicing':
        return "Student is practicing but not ready to advance. Give brief guidance (1 sentence max)."

      case 'contextual_content_request':
        return "Student asked a question. Briefly acknowledge and mention creating content (1 sentence max)."
        
      default:
        return `Student performed action "${action}". Give a brief, direct response (1 sentence max).`
    }
  }

  private getUltimateFallbackResponse(action: string, data: unknown): string {
    // Minimal, generic responses only when AI is completely unavailable
    switch (action) {
      // Practice and progression
      case 'needs_more_practice':
      case 'continue_practicing':
        return "Keep practicing - you're making progress!"
        
      case 'ready_for_practice':
      case 'ready_for_next':
        return "Great! Let's continue."
        
      // Help and explanation requests
      case 'concept_expanded':
      case 'examples_requested':
      case 'explain_more':
      case 'question_requested':
      case 'detail_expanded':
      case 'contextual_content_request':
        return "I'll help you understand this better."

      // Answer submissions
      case 'answer_submitted':
      case 'fill_blank_submitted':
      case 'drag_drop_submitted':
      case 'quiz_submitted':
        if (data && typeof data === 'object' && 'correct' in data) {
          return data.correct ? "Correct! Well done." : "Not quite - keep trying!"
        }
        return "Thanks for your response!"

      // Reset actions
      case 'reset_question':
      case 'fill_blank_reset':
      case 'drag_drop_reset':
      case 'solver_reset':
      case 'quiz_reset':
      case 'graph_reset':
        return "Reset complete. Try again!"

      // Next content requests
      case 'next_question':
      case 'next_exercise':
      case 'next_problem':
        return "Ready for more practice!"

      // Other interactions
      case 'quiz_started':
        return "Good luck on your quiz!"

      case 'highlights_checked':
        return "Good work analyzing the text!"

      case 'graph_control_changed':
        return "Great exploration!"
        
      default:
        return "Keep exploring!"
    }
  }

  // Generate dynamic fallback plan using AI
  private async generateDynamicFallbackPlan(subject: string): Promise<LessonPlan> {
    try {
      const response = await chatCompletion({
        messages: [
          {
            role: "system",
            content: `You are an expert tutor creating a simple but effective learning plan as a fallback. Keep it practical and engaging.`
          },
          {
            role: "user",
            content: `Create a simple 6-lesson learning plan for "${subject}" that covers the most essential concepts.

Return JSON:
{
  "subject": "${subject}",
  "lessons": [
    {
      "id": "lesson-1",
      "title": "Engaging title for essential concept",
      "description": "What students will learn",
      "completed": false
    }
  ]
}

Focus on:
- Most fundamental concepts students need to know
- Practical, real-world applications
- Clear progression from basic to more advanced
- Engaging, specific lesson titles (not generic)`
          }
        ],
        temperature: 0.4,
        max_tokens: 1000
      })

      const content = response.choices[0].message.content
      if (!content) throw new Error('No fallback plan content received')

      const cleanedContent = this.cleanJsonResponse(content)
      const parsedData = JSON.parse(cleanedContent)

      if (!parsedData.lessons || !Array.isArray(parsedData.lessons)) {
        throw new Error('Invalid fallback plan structure')
      }

      return {
        subject: parsedData.subject || subject,
        lessons: parsedData.lessons.map((lesson: { id?: string; title?: string; description?: string }, index: number) => ({
          id: lesson.id || `lesson-${index + 1}`,
          title: lesson.title || `Essential ${subject} Concepts ${index + 1}`,
          description: lesson.description || `Learn fundamental concepts of ${subject}`,
          completed: false,
          content: { type: 'concept-card', data: {} }
        })),
        currentLessonIndex: 0
      }
    } catch (error) {
      logger.error('Failed to generate dynamic fallback plan:', error)
      // Ultimate fallback with minimal structure
      return {
        subject,
        lessons: [
          {
            id: 'lesson-1',
            title: `Introduction to ${subject}`,
            description: `Learn the fundamentals of ${subject}`,
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
  }

  // Generate lesson content for a specific lesson
  async generateLessonContent(
    subjectName: string, 
    lesson: Lesson, 
    contentType: string
  ): Promise<LessonContent> {
    try {
      logger.debug(`🎨 Generating ${contentType} content for lesson: ${lesson.title}`)
      
      // Track content generation for variety
      this.trackGeneratedContent(subjectName, lesson.id, contentType, { data: { title: lesson.title } })
      
      const response = await this.cachedApiCall(
        'lesson-content',
        { subjectName, lessonId: lesson.id, contentType, lessonTitle: lesson.title },
        async () => {
          const contentPrompt = this.createContentPrompt(lesson, contentType, subjectName)
          
          const result = await chatCompletion({
            messages: [
              {
                role: "system",
                content: `You are an expert educational content creator. Create engaging, interactive content that helps students learn effectively.`
              },
              {
                role: "user",
                content: contentPrompt
              }
            ],
            temperature: 0.6,
            max_tokens: 1500
          })

          const content = result.choices[0].message.content
          if (!content) throw new Error('No content generated')
          
          const cleanedContent = this.cleanJsonResponse(content)
          const fixedContent = this.fixIncompleteJson(cleanedContent)
          return JSON.parse(fixedContent)
        }
      )
      
      // Validate and return the lesson content
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid lesson content structure')
      }
      
      return response as LessonContent
      
    } catch (error) {
      logger.error('Failed to generate lesson content:', error)
      // Fall back to dynamic content generation
      return this.generateDynamicFallbackContent(lesson, contentType)
    }
  }

  // Generate tutor responses for user interactions
  async generateTutorResponse(
    subjectName: string,
    action: string,
    data: unknown,
    context?: unknown
  ): Promise<string> {
    try {
      logger.debug(`🤖 Generating tutor response for action: ${action}`)
      
      const response = await this.cachedApiCall(
        'tutor-response',
        { subjectName, action, data, context },
        async () => {
          const responsePrompt = this.createTutorResponsePrompt(action, data, context, subjectName)
          
          const result = await chatCompletion({
            messages: [
              {
                role: "system",
                content: `You are a direct, helpful tutor. Give clear, concise feedback without excessive encouragement. Keep responses under 2 sentences and focus on next steps or specific guidance.`
              },
              {
                role: "user",
                content: responsePrompt
              }
            ],
            temperature: 0.3,
            max_tokens: 100
          })

          const content = result.choices[0].message.content
          if (!content) throw new Error('No response generated')
          
          return content.trim()
        }
      )
      
      return response as string
      
    } catch (error) {
      logger.error('Failed to generate tutor response:', error)
      // Fall back to generated fallback response
      return this.generateFallbackResponse(action, data)
    }
  }

  // Generate direct educational responses for user questions
  async generateDirectEducationalResponse(
    question: string,
    subjectName?: string,
    context?: { currentLesson?: string; difficulty?: string }
  ): Promise<string> {
    try {
      logger.debug(`📚 Generating direct educational response for question: ${question.substring(0, 50)}...`)
      
      const response = await this.cachedApiCall(
        'direct-educational-response',
        { question, subjectName, context },
        async () => {
          const educationalPrompt = this.createDirectEducationalPrompt(question, subjectName, context)
          
          const result = await chatCompletion({
            messages: [
              {
                role: "system",
                content: `You are an expert educator. Provide direct, specific answers to educational questions. Focus on giving practical, actionable information rather than generic responses. Be comprehensive but concise.`
              },
              {
                role: "user",
                content: educationalPrompt
              }
            ],
            temperature: 0.4,
            max_tokens: 400
          })

          const content = result.choices[0].message.content
          if (!content) throw new Error('No educational response generated')
          
          return content.trim()
        }
      )
      
      return response as string
      
    } catch (error) {
      logger.error('Failed to generate direct educational response:', error)
      // Fallback to a helpful generic response
      if (subjectName) {
        return `Let me help you with ${subjectName}. I'll create some interactive content to explore this topic together.`
      }
      return `That's a great question! Let me create some interactive content to help you explore this topic.`
    }
  }

  private createDirectEducationalPrompt(
    question: string,
    subjectName?: string,
    context?: { currentLesson?: string; difficulty?: string }
  ): string {
    const baseContext = subjectName ? `The student is learning ${subjectName}` : 'General educational question'
    const lessonContext = context?.currentLesson ? ` and is currently on the lesson: "${context.currentLesson}"` : ''
    const difficultyContext = context?.difficulty ? ` at ${context.difficulty} level` : ''
    
    return `${baseContext}${lessonContext}${difficultyContext}.

Question: "${question}"

Provide a direct, specific, and helpful answer to this question. If it's asking for concepts or learning requirements:
- List specific topics, skills, or concepts needed
- Organize from fundamental to advanced
- Include practical learning tips
- Mention real-world applications where relevant

If it's asking for explanations:
- Give clear, direct explanations
- Use examples where helpful
- Connect to broader understanding

Avoid generic responses like "great question" or "let me help you learn." Instead, dive directly into answering the question with specific, educational content.`
  }

  // Create prompts for tutor responses
  private createTutorResponsePrompt(action: string, data: unknown, context: unknown, subjectName: string): string {
    const baseContext = `You are tutoring a student in ${subjectName}.`
    
    // Type guards for different data structures
    const isContextWithLesson = (c: unknown): c is { lesson?: { title?: string } } => {
      return typeof c === 'object' && c !== null
    }

    switch (action) {
      // From ChatPane.tsx - tutor response actions
      case 'needs_more_practice':
        return `Student working on ${subjectName} needs more practice. Give specific guidance on what to focus on (1-2 sentences max).`
        
      case 'continue_practicing':
        return `Student is practicing ${subjectName} but not ready to advance. Give brief, specific guidance on improvement (1-2 sentences max).`
        
      case 'ready_for_practice':
      case 'ready_for_next':
        return `Student is ready to practice ${subjectName}. Give brief acknowledgment and mention creating practice content (1-2 sentences max).`

      // Answer submission actions from components
      case 'answer_submitted':
        if (data && typeof data === 'object' && 'correct' in data) {
          return data.correct 
            ? `${baseContext} The student got an answer correct. Give brief confirmation and mention continuing (1-2 sentences max).`
            : `${baseContext} The student got an answer wrong. Give brief feedback on trying again (1-2 sentences max).`
        }
        return `${baseContext} The student submitted an answer. Give brief acknowledgment (1-2 sentences max).`

      case 'fill_blank_submitted':
        if (data && typeof data === 'object' && 'isCorrect' in data) {
          return data.isCorrect
            ? `${baseContext} The student correctly filled in the blanks. Give brief confirmation (1-2 sentences max).`
            : `${baseContext} The student's fill-in-the-blank attempt needs work. Give brief encouragement (1-2 sentences max).`
        }
        return `${baseContext} The student completed a fill-in-the-blank exercise. Give brief feedback (1-2 sentences max).`

      case 'drag_drop_submitted':
        if (data && typeof data === 'object' && 'isCorrect' in data) {
          return data.isCorrect
            ? `${baseContext} The student correctly arranged the drag-and-drop items. Give brief confirmation (1-2 sentences max).`
            : `${baseContext} The student's drag-and-drop arrangement needs adjustment. Give brief guidance (1-2 sentences max).`
        }
        return `${baseContext} The student completed a drag-and-drop exercise. Give brief feedback (1-2 sentences max).`

      case 'quiz_submitted':
        if (data && typeof data === 'object' && 'score' in data) {
          const score = data.score as number
          if (score >= 80) {
            return `${baseContext} The student scored ${score}% on the quiz. Give brief congratulations (1-2 sentences max).`
          } else {
            return `${baseContext} The student scored ${score}% on the quiz. Give brief encouragement to review and try again (1-2 sentences max).`
          }
        }
        return `${baseContext} The student completed a quiz. Give brief feedback (1-2 sentences max).`

      case 'highlights_checked':
        if (data && typeof data === 'object' && 'correctHighlights' in data) {
          const correctCount = data.correctHighlights as number
          return `${baseContext} The student highlighted ${correctCount} key points correctly. Give brief feedback on their text analysis (1-2 sentences max).`
        }
        return `${baseContext} The student completed a text highlighting exercise. Give brief feedback on their analysis (1-2 sentences max).`

      // Help and explanation requests
      case 'concept_expanded':
        return `${baseContext} The student wants a deeper explanation. Briefly acknowledge and mention providing more detail (1-2 sentences max).`
        
      case 'examples_requested':
        return `${baseContext} The student wants more examples. Briefly acknowledge and mention providing examples (1-2 sentences max).`

      case 'explain_more':
        return `${baseContext} The student wants more explanation. Briefly acknowledge and mention providing additional details (1-2 sentences max).`

      case 'question_requested':
        return `${baseContext} The student wants to ask a question. Give brief acknowledgment and encourage them to ask (1-2 sentences max).`

      case 'detail_expanded':
        return `${baseContext} The student expanded a detail section for more information. Give brief acknowledgment (1-2 sentences max).`

      // Next content requests
      case 'next_question':
        return `${baseContext} The student wants another question. Give brief acknowledgment about providing more practice (1-2 sentences max).`

      case 'next_exercise':
        return `${baseContext} The student wants another exercise. Give brief acknowledgment about providing more practice (1-2 sentences max).`

      case 'next_problem':
        return `${baseContext} The student wants another problem. Give brief acknowledgment about providing more practice (1-2 sentences max).`

      // Reset actions - NOW FULLY SUPPORTED
      case 'reset_question':
      case 'fill_blank_reset':
      case 'drag_drop_reset':
      case 'solver_reset':
      case 'quiz_reset':
      case 'graph_reset':
        return `${baseContext} The student reset their exercise. Give brief encouragement to try again (1 sentence max).`

      // Quiz progression - NOW FULLY SUPPORTED
      case 'quiz_started':
        return `${baseContext} The student started a quiz. Give brief encouragement (1 sentence max).`

      // Graph interaction - NOW FULLY SUPPORTED
      case 'graph_control_changed':
        if (data && typeof data === 'object' && 'parameter' in data) {
          const parameter = data.parameter as string
          return `${baseContext} The student adjusted the ${parameter} on the graph. Give brief acknowledgment of their exploration (1-2 sentences max).`
        }
        return `${baseContext} The student adjusted graph controls. Give brief acknowledgment of their exploration (1-2 sentences max).`

      // Contextual content (from ChatPane)
      case 'contextual_content_request':
        if (isContextWithLesson(context)) {
          const lessonTitle = context.lesson?.title || 'this topic'
          return `${baseContext} The student asked about ${lessonTitle}. Briefly acknowledge and mention creating relevant content (1-2 sentences max).`
        }
        return `${baseContext} The student asked a question. Briefly acknowledge and mention creating relevant content (1-2 sentences max).`

      default:
        return `${baseContext} The student performed action "${action}". Give a brief, direct response (1-2 sentences max).`
    }
  }

  // Create content prompts for different lesson content types
  private createContentPrompt(lesson: Lesson, contentType: string, subjectName: string): string {
    const baseContext = `Subject: ${subjectName}\nLesson: ${lesson.title}\nDescription: ${lesson.description}`
    
    switch (contentType) {
      case 'quiz':
      case 'multiple-choice':
        return `${baseContext}

Create a multiple-choice question that tests understanding of this lesson.

Return JSON:
{
  "type": "multiple-choice",
  "data": {
    "question": "Clear, specific question about the lesson topic",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Why this answer is correct and others are wrong",
    "difficulty": "beginner|intermediate|advanced",
    "category": "${lesson.title}"
  }
}

Make the question practical and test real understanding, not just memorization.`

      case 'fill-blank':
        return `${baseContext}

Create a fill-in-the-blank exercise for this lesson.

Return JSON:
{
  "type": "fill-blank",
  "data": {
    "question": "Complete this statement about ${lesson.title}",
    "template": "Text with ___ blanks ___ to fill in ___",
    "answers": ["answer1", "answer2", "answer3"],
    "hints": ["Hint for blank 1", "Hint for blank 2", "Hint for blank 3"],
    "explanation": "Why these answers are correct",
    "category": "${lesson.title}",
    "difficulty": "beginner|intermediate|advanced"
  }
}

Create meaningful blanks that test key concepts.`

      case 'concept-card':
        return `${baseContext}

Create a concept card that explains the key ideas in this lesson.

Return JSON:
{
  "type": "concept-card",
  "data": {
    "title": "${lesson.title}",
    "summary": "One clear sentence explaining the main concept",
    "details": "2-3 sentences with deeper explanation",
    "examples": ["Real-world example 1", "Real-world example 2"],
    "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
    "difficulty": "beginner|intermediate|advanced"
  }
}

Focus on clarity and practical understanding.`

      case 'step-solver':
      case 'practice':
        return `${baseContext}

Create a step-by-step problem that applies the lesson concepts.

Return JSON:
{
  "type": "step-solver",
  "data": {
    "problem": "A practical problem that uses ${lesson.title} concepts",
    "problemType": "${lesson.title}",
    "steps": [
      {
        "id": "1",
        "description": "What to do in this step",
        "calculation": "The work or reasoning",
        "result": "Result of this step",
        "explanation": "Why this step is needed"
      }
    ],
    "finalAnswer": "The complete solution",
    "difficulty": "beginner|intermediate|advanced",
    "learningObjective": "What students learn from solving this"
  }
}

Create a meaningful problem that builds understanding.`

      case 'explainer':
        return `${baseContext}

Create an interactive explanation for this lesson.

Return JSON:
{
  "type": "explainer",
  "data": {
    "title": "${lesson.title}",
    "overview": "Clear, engaging overview of the concept (1-2 sentences)",
    "sections": [
      {
        "heading": "What is ${lesson.title}?",
        "paragraphs": [
          "First paragraph explaining the basic concept clearly.",
          "Second paragraph building on the explanation with examples.",
          "Third paragraph connecting to practical applications."
        ]
      },
      {
        "heading": "Key Components",
        "paragraphs": [
          "Paragraph explaining the main components or parts.",
          "Paragraph showing how these components work together."
        ]
      },
      {
        "heading": "Real-World Applications",
        "paragraphs": [
          "Paragraph with concrete examples and applications.",
          "Paragraph showing relevance to student's life or studies."
        ]
      }
    ],
    "conclusion": "Brief summary that reinforces key learning points",
    "difficulty": "beginner",
    "estimatedReadTime": 3
  }
}

Make it educational, well-structured, and engaging. Each section should have 2-4 meaningful paragraphs.`

      default:
        return `${baseContext}

Create educational content of type "${contentType}" for this lesson.
Return valid JSON with type "${contentType}" and appropriate data structure.
Focus on student engagement and practical understanding.`
    }
  }

  async generateWelcomeMessage(
    subjectName: string,
    currentLesson: { title: string; index: number },
    progress: { correctAnswers: number; totalAttempts: number },
    isReturningUser: boolean = true
  ): Promise<string> {
    try {
      logger.debug(`🎯 Generating ${isReturningUser ? 'welcome back' : 'welcome'} message for ${subjectName}`)
      
      const response = await this.cachedApiCall(
        'welcome-message',
        { subjectName, currentLesson, progress, isReturningUser },
        async () => {
          const welcomePrompt = this.createWelcomeMessagePrompt(
            subjectName,
            currentLesson,
            progress,
            isReturningUser
          )
          
          const result = await chatCompletion({
            messages: [
              {
                role: "system",
                content: `You are a direct tutor. Create brief, informative welcome messages. Focus on current lesson and progress without excessive enthusiasm. Keep messages under 2 sentences.`
              },
              {
                role: "user",
                content: welcomePrompt
              }
            ],
            temperature: 0.3,
            max_tokens: 80
          })

          const content = result.choices[0].message.content
          if (!content) throw new Error('No welcome message generated')
          
          return content.trim()
        }
      )
      
      return response as string
      
    } catch (error) {
      logger.error('Failed to generate welcome message:', error)
      // Fallback to a basic template if AI fails
      if (isReturningUser) {
        return `Back to ${subjectName}. Current lesson: "${currentLesson.title}".`
      } else {
        return `Starting ${subjectName}. First lesson: "${currentLesson.title}".`
      }
    }
  }

  private createWelcomeMessagePrompt(
    subjectName: string,
    currentLesson: { title: string; index: number },
    progress: { correctAnswers: number; totalAttempts: number },
    isReturningUser: boolean
  ): string {
    const accuracyRate = progress.totalAttempts > 0 
      ? Math.round((progress.correctAnswers / progress.totalAttempts) * 100)
      : 0
    
    const lessonNumber = currentLesson.index + 1
    
    if (isReturningUser) {
      return `Create a brief welcome back message for a student returning to ${subjectName}.

Context:
- Subject: ${subjectName}
- Current lesson: ${lessonNumber} - "${currentLesson.title}"
- Progress: ${progress.correctAnswers}/${progress.totalAttempts} correct answers (${accuracyRate}% accuracy)
- Student is returning to continue learning

Create a direct message that:
1. States they're back to the subject
2. Mentions their current lesson
3. Optionally notes their progress if relevant

Keep it under 2 sentences. Be informative, not enthusiastic.`
    } else {
      return `Create a welcome message for a student starting ${subjectName}.

Context:
- Subject: ${subjectName}
- Starting lesson: "${currentLesson.title}"
- New student beginning learning

Create a direct message that:
1. States they're starting the subject
2. Mentions the first lesson
3. Is informative but brief

Keep it under 2 sentences. Be clear and direct.`
    }
  }
}

export const aiTutor = new AITutorService() 

