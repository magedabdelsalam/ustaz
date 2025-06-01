import { chatCompletion } from '@/lib/openaiClient'
import { logger } from '@/lib/logger'
import { 
  LessonPlan, 
  Lesson, 
  LessonContent, 
  ConceptInfo, 
  LearningProgress,
  ProgressCriteria,
  CacheEntry,
  PlanStructureData,
  PlanDataStructure
} from '@/types'

// AI Response Cache - prevents duplicate API calls and saves tokens
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
      
      // Remove trailing commas before closing brackets or braces
      fixed = fixed.replace(/,(\s*[\]}])/g, '$1');
      
      // Fix property keys without quotes
      fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
      
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
        logger.debug('⚠️ Could not fix JSON with standard methods, attempting advanced recovery')
        
        try {
          // More aggressive fixing - extract the valid part of the JSON
          if (fixed.startsWith('{') && fixed.includes('}')) {
            // Find the last valid closing brace
            let validJson = fixed.substring(0, fixed.lastIndexOf('}') + 1);
            // Ensure we have balanced braces
            const vOpenBraces = (validJson.match(/\{/g) || []).length;
            const vCloseBraces = (validJson.match(/\}/g) || []).length;
            if (vOpenBraces > vCloseBraces) {
              validJson += '}'.repeat(vOpenBraces - vCloseBraces);
            }
            JSON.parse(validJson); // Verify it's valid
            logger.debug('✅ Successfully recovered partial JSON');
            return validJson;
          }
          
          // For subjects with simple names, create a minimal valid structure as fallback
          if (typeof jsonString === 'string' && jsonString.length < 100) {
            const subjectName = jsonString.replace(/[^a-zA-Z0-9\s]/g, '').trim();
            const fallbackJson = `{
              "subject": "${subjectName || 'General Subject'}",
              "lessons": [
                {
                  "id": "lesson-1",
                  "title": "Introduction to ${subjectName || 'the Subject'}",
                  "description": "An overview of key concepts",
                  "concepts": [
                    {
                      "id": "concept-1-1",
                      "name": "Core Concepts",
                      "description": "Understanding the fundamentals",
                      "difficulty": "beginner",
                      "estimatedPracticeItems": 3
                    }
                  ]
                },
                {
                  "id": "lesson-2",
                  "title": "Building Knowledge",
                  "description": "Developing deeper understanding",
                  "concepts": [
                    {
                      "id": "concept-2-1",
                      "name": "Advanced Applications",
                      "description": "Applying concepts in real scenarios",
                      "difficulty": "intermediate",
                      "estimatedPracticeItems": 4
                    }
                  ]
                }
              ]
            }`;
            
            JSON.parse(fallbackJson); // Verify it's valid
            logger.debug('✅ Created fallback JSON structure');
            return fallbackJson;
          }
        } catch (recoveryError) {
          logger.error('💥 Recovery attempts failed:', recoveryError);
        }
        
        logger.debug('❌ Could not fix JSON, will use fallback')
        throw new Error('Unable to fix incomplete JSON response')
      }
    }
  }

  // Standardized helper for sending prompts to OpenAI
  private async sendPrompt(
    system: string,
    user: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    try {
      const result = await chatCompletion({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature,
        max_tokens: maxTokens
      })

      const content = result.choices[0]?.message.content
      if (!content) {
        throw new Error('No content returned from AI')
      }
      return content.trim()
    } catch (error) {
      // Handle timeout errors specifically
      if (error instanceof Error && error.message.includes('timed out')) {
        logger.error('⏰ OpenAI API request timed out:', error.message)
        throw new Error('AI request timed out - please try again')
      }
      
      // Handle other network/API errors
      if (error instanceof Error && (error.message.includes('failed') || error.message.includes('network'))) {
        logger.error('🌐 OpenAI API network error:', error.message)
        throw new Error('Network error while connecting to AI - please try again')
      }
      
      // Re-throw other errors as-is
      throw error
    }
  }

  async createLearningPlan(subject: string): Promise<LessonPlan> {
    try {
      logger.debug('🤖 AI Service creating lesson plan for:', subject)
      
      // Analyze subject to determine optimal plan structure
      const planStructurePrompt = this.createPlanStructurePrompt(subject)
      const planStructureResponse = await this.sendPrompt(
        "You are an expert curriculum designer. Based on the user's request, create a structured learning plan tailored to their needs.",
        planStructurePrompt,
        0.2,
        800
      )
      
      const planStructureContent = this.cleanJsonResponse(planStructureResponse)
      
      // Add error handling for initial subject analysis
      let planStructure: PlanStructureData;
      try {
        planStructure = JSON.parse(planStructureContent) as PlanStructureData;
      } catch (error) {
        logger.error('❌ Failed to parse subject analysis JSON:', error);
        // Provide fallback defaults
        planStructure = {
          recommendedLessons: 5,
          complexity: 'intermediate',
          focusAreas: ['core concepts', 'practical applications'],
          learningObjectives: ['understand fundamentals', 'apply knowledge'],
          estimatedHoursPerLesson: 1,
          prerequisites: [],
          reasoning: 'Fallback plan for error recovery'
        };
        logger.debug('⚠️ Using fallback subject analysis:', planStructure)
      }

      const expectedLessons = planStructure.recommendedLessons || 8
      const complexity = planStructure.complexity || 'intermediate'
      
      logger.debug(`📚 AI recommended ${expectedLessons} lessons for "${subject}" (complexity: ${complexity})`)
      
      // Determine token limit based on AI analysis rather than hardcoded rules
      const maxTokens = expectedLessons >= 12 ? 2500 : 
                        complexity === 'advanced' ? 2200 : 
                        complexity === 'beginner' ? 1200 : 1600
      
      logger.debug(`🎯 Using ${maxTokens} tokens for ${expectedLessons} lessons`)
      
      // Create cache parameters for this lesson plan request
      const cacheParams = { subject, expectedLessons, maxTokens, complexity, focusAreas: planStructure.focusAreas }
      
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
              
              const planPrompt = `Create a learning plan for "${subject}" with exactly ${expectedLessons} lessons, including specific concepts for each lesson.

Subject Analysis:
- Complexity: ${complexity}
- Focus Areas: ${planStructure.focusAreas?.join(', ') || 'General'}
- Learning Objectives: ${planStructure.learningObjectives?.join(', ') || 'Comprehensive understanding'}

Return JSON:
{
  "subject": "${subject}",
  "lessons": [
    {
      "id": "lesson-1",
      "title": "Descriptive, engaging lesson title",
      "description": "What students will learn and why it matters",
      "completed": false,
      "concepts": [
        {
          "id": "concept-1-1",
          "name": "Specific concept name (e.g., 'User Research Methods', 'Market Analysis Techniques')",
          "description": "What this concept covers and why it's important",
          "difficulty": "beginner|intermediate|advanced",
          "estimatedPracticeItems": 3
        },
        {
          "id": "concept-1-2", 
          "name": "Another specific concept in this lesson",
          "description": "Clear description of this concept",
          "difficulty": "beginner|intermediate|advanced",
          "estimatedPracticeItems": 4
        }
      ]
    }
  ]
}

Requirements:
- Each lesson should have 3-5 specific, well-defined concepts
- Concepts should be practical and teachable through interactive exercises
- Each lesson should build naturally on previous ones
- Concept names should be specific, not generic (e.g., "User Persona Creation" not "Learning about Users")
- Concepts should progress logically within each lesson
- Include estimated practice items (2-5) needed to master each concept
- Vary difficulty appropriately within and across lessons`

              const content = await this.sendPrompt(
                `You are an expert curriculum designer creating a comprehensive learning plan with structured concepts. Create exactly ${expectedLessons} progressive lessons with specific, practical concepts.`,
                planPrompt,
                0.3,
                maxTokens
              )
              if (!content) throw new Error('No content received from AI')

              const cleanedContent = this.cleanJsonResponse(content)
              
              try {
                const fixedContent = this.fixIncompleteJson(cleanedContent)
                const parsedData = JSON.parse(fixedContent)
                
                // Validate the response structure
                if (!parsedData.subject || !parsedData.lessons || !Array.isArray(parsedData.lessons)) {
                  throw new Error('Invalid lesson plan structure from AI')
                }
                
                return parsedData
              } catch (parseError) {
                // If this isn't the last attempt, rethrow to trigger retry
                if (attempt < maxRetries) {
                  throw parseError
                }
                
                // On last attempt, create a minimal fallback structure
                logger.error('❌ Failed to parse lesson plan JSON after all attempts:', parseError)
                logger.debug('⚠️ Creating fallback lesson plan for:', subject)
                
                // Create a meaningful fallback lesson plan when all else fails
                const fallbackLessonPlan = this.createSubjectSpecificFallback(subject)
                
                // Save the fallback plan
                this.lessonPlans.set(subject, fallbackLessonPlan);
                
                // Create default progress
                const fallbackProgress: LearningProgress = {
                  correctAnswers: 0,
                  totalAttempts: 0,
                  readyForNext: false,
                  needsReview: false
                };
                this.progress.set(subject, fallbackProgress);
                
                logger.debug(`⚠️ Using dynamic fallback lesson plan for "${subject}" with ${fallbackLessonPlan.lessons.length} lessons`);
                return fallbackLessonPlan;
              }
            } catch (error) {
              lastError = error as Error
              logger.error(`❌ Attempt ${attempt} failed:`, error)
              if (attempt < maxRetries) {
                // Add some delay between retries
                await new Promise(resolve => setTimeout(resolve, 1000))
              } else {
                throw error
              }
            }
          }
          
          throw lastError || new Error('Failed to generate lesson plan after multiple attempts')
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
          concepts?: Array<{
            id?: string
            name?: string
            description?: string
            difficulty?: string
            estimatedPracticeItems?: number
          }>
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
          content: { type: 'concept-card', data: {} as Record<string, unknown> as Record<string, unknown> }, // Will be generated when accessed
          concepts: lesson.concepts?.map((concept, conceptIndex) => ({
            id: concept.id || `concept-${index + 1}-${conceptIndex + 1}`,
            name: concept.name || `Concept ${conceptIndex + 1}`,
            description: concept.description || 'Learn this important concept.',
            difficulty: (concept.difficulty as 'beginner' | 'intermediate' | 'advanced') || 'beginner',
            estimatedPracticeItems: concept.estimatedPracticeItems || 3
          })) || this.generateFallbackConcepts(lesson.title || `Lesson ${index + 1}`, index),
          currentConceptIndex: 0
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
      logger.error('❌ Failed to create lesson plan:', error)
      
      // Handle different types of errors with specific messaging
      if (error instanceof Error) {
        if (error.message.includes('timed out')) {
          logger.error('⏰ Lesson plan creation timed out')
          throw new Error(`The AI service is taking too long to respond. Please try again in a moment.`)
        }
        
        if (error.message.includes('network') || error.message.includes('failed')) {
          logger.error('🌐 Network error during lesson plan creation')
          throw new Error(`Network error while creating lesson plan. Please check your connection and try again.`)
        }
      }
      
      // Instead of templates, try a simplified AI generation one more time
      logger.debug('🔄 Attempting simplified AI generation for:', subject)
      
      try {
        // Use a much shorter timeout for the fallback attempt
        const simplePrompt = `Create a learning plan for "${subject}". Return only valid JSON:
{
  "subject": "${subject}",
  "lessons": [
    {
      "id": "lesson-1",
      "title": "Lesson title for ${subject}",
      "description": "What students will learn",
      "concepts": [
        {
          "id": "concept-1-1",
          "name": "Specific concept name",
          "description": "What this concept covers",
          "difficulty": "beginner",
          "estimatedPracticeItems": 3
        }
      ]
    }
  ]
}

Create 3-4 lessons with 2-3 concepts each. Focus on ${subject} specifically.`

        const fallbackContent = await this.sendPrompt(
          "You are an expert curriculum designer. Create a specific learning plan for the given subject.",
          simplePrompt,
          0.2,
          1200
        )
        
        const cleanedFallbackContent = this.cleanJsonResponse(fallbackContent)
        const fallbackData = JSON.parse(cleanedFallbackContent)
        
        if (!fallbackData.subject || !fallbackData.lessons || !Array.isArray(fallbackData.lessons)) {
          throw new Error('Invalid fallback lesson plan structure')
        }
        
        // Create the lesson plan object from AI-generated content
        const lessonPlan: LessonPlan = {
          subject: fallbackData.subject,
          lessons: fallbackData.lessons.map((lesson: unknown, index: number) => {
            const lessonObj = lesson as { 
              id?: string; 
              title?: string; 
              description?: string; 
              concepts?: unknown[] 
            }
            
            return {
              id: lessonObj.id || `lesson-${index + 1}`,
              title: lessonObj.title || `Lesson ${index + 1}`,
              description: lessonObj.description || 'Learn important concepts.',
              completed: false,
              content: { type: 'concept-card', data: {} as Record<string, unknown> as Record<string, unknown> },
              concepts: lessonObj.concepts?.map((concept: unknown, conceptIndex: number) => {
                const conceptObj = concept as {
                  id?: string;
                  name?: string;
                  description?: string;
                  difficulty?: string;
                  estimatedPracticeItems?: number;
                }
                
                return {
                  id: conceptObj.id || `concept-${index + 1}-${conceptIndex + 1}`,
                  name: conceptObj.name || `Concept ${conceptIndex + 1}`,
                  description: conceptObj.description || 'Learn this concept.',
                  difficulty: (conceptObj.difficulty as 'beginner' | 'intermediate' | 'advanced') || 'beginner',
                  estimatedPracticeItems: conceptObj.estimatedPracticeItems || 3
                }
              }) || [],
              currentConceptIndex: 0
            }
          }),
          currentLessonIndex: 0
        }

        this.lessonPlans.set(subject, lessonPlan)
        
        // Create default progress
        const fallbackProgress: LearningProgress = {
          correctAnswers: 0,
          totalAttempts: 0,
          readyForNext: false,
          needsReview: false
        }
        this.progress.set(subject, fallbackProgress)
        
        logger.debug(`✅ Simplified AI generation succeeded for "${subject}" with ${lessonPlan.lessons.length} lessons`)
        return lessonPlan
        
      } catch (fallbackError) {
        logger.error('❌ Even simplified AI generation failed:', fallbackError)
        
        // Provide specific error messages for different scenarios
        if (fallbackError instanceof Error) {
          if (fallbackError.message.includes('timed out')) {
            throw new Error(`AI service is currently slow. Please try again in a few minutes.`)
          }
          
          if (fallbackError.message.includes('network')) {
            throw new Error(`Connection issue. Please check your internet and try again.`)
          }
        }
        
        // Generic fallback message for other errors
        throw new Error(`Unable to create lesson plan for "${subject}" right now. Please try again.`)
      }
    }
  }

  private createPlanStructurePrompt(subject: string): string {
    return `Analyze "${subject}" and return JSON with:
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

  // Store dynamic criteria for each subject
  private subjectCriteria: Map<string, ProgressCriteria> = new Map()

  // Initialize progress with dynamic criteria based on subject analysis
  private async initializeDynamicProgress(subject: string, complexity: string): Promise<LearningProgress> {
    try {
      const progressCriteria = await this.cachedApiCall(
        'progress-criteria',
        { subject, complexity },
        async () => {
          const prompt = `Analyze "${subject}" (complexity: ${complexity}) and determine optimal learning progress criteria.\n\nReturn JSON:\n{\n  "minCorrectAnswers": number (2-5),\n  "minTotalAttempts": number (3-6),\n  "minAccuracy": number (0.6-0.8),\n  "adaptiveFactors": {\n    "difficultyAdjustment": number (0.8-1.2),\n    "engagementWeight": number (0.1-0.3),\n    "retentionFactor": number (0.7-0.9)\n  },\n  "reasoning": "Why these criteria work for this subject"\n}\n\nConsider:\n- Subject difficulty and abstract nature\n- Typical learning curves\n- Importance of accuracy vs exploration\n- Student motivation factors`

          const content = await this.sendPrompt(
            `You are an expert in learning analytics. Determine optimal progress criteria for "${subject}".`,
            prompt,
            0.3,
            400
          )
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

  private createPlaceholderContent(contentType: string): LessonContent {
    return {
      type: "placeholder",
      data: this.createRetryPrompt('generate_content', { contentType }, 'Unable to load content. Please try again.')
    }
  }

  // Unified retry prompt generator - replaces multiple fallback methods
  private createRetryPrompt(originalAction: string, originalData: unknown, message?: string): {
    type: 'retry_prompt'
    message: string
    action: 'retry'
    originalAction: string
    originalData: unknown
  } {
    return {
      type: 'retry_prompt',
      message: message || 'Unable to process request. Please try again.',
      action: 'retry',
      originalAction,
      originalData
    }
  }

  // Unified fallback generator - handles both string responses and structured fallbacks
  private generateUnifiedFallback<T>(
    action: string, 
    data: unknown, 
    fallbackType: 'response' | 'lesson-plan' | 'content',
    message?: string
  ): T {
    const retryPrompt = this.createRetryPrompt(action, data, message || 'AI service temporarily unavailable. Would you like to try again?')
    
    switch (fallbackType) {
      case 'response':
        return JSON.stringify(retryPrompt) as T
        
      case 'lesson-plan':
        const subject = typeof data === 'object' && data && 'subject' in data 
          ? (data as { subject: string }).subject 
          : 'Unknown Subject'
        return {
          subject,
          lessons: [{
            id: 'retry-lesson',
            title: 'Content Generation Failed',
            description: 'Unable to generate lesson plan. Please try again.',
            completed: false,
            content: {
              type: 'placeholder',
              data: retryPrompt
            },
            concepts: [{
              id: 'retry-concept',
              name: 'Retry Required',
              description: JSON.stringify(this.createRetryPrompt('generate_concepts', { subject }, `Unable to generate concepts for "${subject}". Please try again.`)),
              difficulty: 'beginner',
              estimatedPracticeItems: 0
            }],
            currentConceptIndex: 0
          }],
          currentLessonIndex: 0
        } as T
        
      case 'content':
        return {
          type: 'placeholder',
          data: retryPrompt
        } as T
        
      default:
        return JSON.stringify(retryPrompt) as T
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
      
      // Get the current concept for this lesson
      const currentConceptIndex = lesson.currentConceptIndex || 0
      const currentConcept = lesson.concepts && lesson.concepts.length > 0 
        ? lesson.concepts[currentConceptIndex] 
        : undefined
      
      if (currentConcept) {
        logger.debug(`🎯 Focusing on concept: ${currentConcept.name} (${currentConcept.difficulty})`)
      }
      
      // Track content generation for variety
      this.trackGeneratedContent(subjectName, lesson.id, contentType, { data: { title: lesson.title } })
      
      const response = await this.cachedApiCall(
        'lesson-content',
        { subjectName, lessonId: lesson.id, contentType, lessonTitle: lesson.title, conceptName: currentConcept?.name },
        async () => {
          const contentPrompt = this.createContentPrompt(lesson, contentType, subjectName, currentConcept)
          
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
      
      // Handle timeout errors specifically
      if (error instanceof Error && error.message.includes('timed out')) {
        logger.error('⏰ Lesson content generation timed out')
        // Return a retry prompt instead of placeholder content for timeouts
        return {
          type: 'placeholder',
          data: {
            type: 'retry_prompt',
            message: 'Content generation is taking too long. Please try again.',
            action: 'retry',
            originalAction: 'generate_lesson_content',
            originalData: { subjectName, lessonTitle: lesson.title, contentType }
          }
        }
      }
      
      // Handle network errors
      if (error instanceof Error && (error.message.includes('network') || error.message.includes('failed'))) {
        logger.error('🌐 Network error during content generation')
        return {
          type: 'placeholder',
          data: {
            type: 'retry_prompt',
            message: 'Network error while creating content. Please try again.',
            action: 'retry',
            originalAction: 'generate_lesson_content',
            originalData: { subjectName, lessonTitle: lesson.title, contentType }
          }
        }
      }
      
      // For other errors, return placeholder content as before
      return this.createPlaceholderContent(contentType)
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
          
          const content = await this.sendPrompt(
            `You are a direct, helpful tutor. Give clear, concise feedback without excessive encouragement. Keep responses under 2 sentences and focus on next steps or specific guidance.`,
            responsePrompt,
            0.3,
            100
          )

          return content
        }
      )
      
      return response as string
      
    } catch (error) {
      logger.error('Failed to generate tutor response:', error)
      return this.generateUnifiedFallback<string>(action, data, 'response')
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
          
          const content = await this.sendPrompt(
            `You are an expert educator. Provide direct, specific answers to educational questions. Focus on giving practical, actionable information rather than generic responses. Be comprehensive but concise.`,
            educationalPrompt,
            0.4,
            400
          )

          return content
        }
      )
      
      return response as string
      
    } catch (error) {
      logger.error('Failed to generate direct educational response:', error)
      return JSON.stringify(this.createRetryPrompt('generate_educational_response', { question, subjectName, context }, 'Unable to generate response to your question. Please try again.'))
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
  private createContentPrompt(lesson: Lesson, contentType: string, subjectName: string, currentConcept?: ConceptInfo): string {
    const baseContext = `Subject: ${subjectName}\nLesson: ${lesson.title}\nDescription: ${lesson.description}`
    const conceptContext = currentConcept 
      ? `\nCurrent Concept: ${currentConcept.name}\nConcept Description: ${currentConcept.description}\nDifficulty: ${currentConcept.difficulty}`
      : ''
    
    switch (contentType) {
      case 'quiz':
      case 'multiple-choice':
        return `${baseContext}${conceptContext}

Create a multiple-choice question that tests understanding of the specific concept${currentConcept ? ` "${currentConcept.name}"` : ' within this lesson'}.

Return JSON:
{
  "type": "multiple-choice",
  "data": {
    "question": "Clear, specific question about ${currentConcept?.name || 'a particular concept in the lesson'}",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Explanation of the key concepts and reasoning behind the correct answer",
    "difficulty": "${currentConcept?.difficulty || 'beginner'}",
    "category": "${currentConcept?.name || 'Concept'}",
    "title": "${currentConcept?.name ? `${currentConcept.name} Quiz` : 'Concept Quiz'}"
  }
}

Focus specifically on ${currentConcept?.name || 'the concept'} and make the question test understanding of this specific concept.`

      case 'fill-blank':
        return `${baseContext}${conceptContext}

Create a fill-in-the-blank exercise for the specific concept${currentConcept ? ` "${currentConcept.name}"` : ' within this lesson'}.

Return JSON:
{
  "type": "fill-blank",
  "data": {
    "question": "Complete this statement about ${currentConcept?.name || 'the concept'}",
    "template": "Text with ___ blanks ___ about ${currentConcept?.name || 'the concept'} ___",
    "answers": ["answer1", "answer2", "answer3"],
    "hints": ["Hint for blank 1", "Hint for blank 2", "Hint for blank 3"],
    "explanation": "Explanation of why these specific terms are important for understanding ${currentConcept?.name || 'the concept'}",
    "category": "${currentConcept?.name || 'Concept'}",
    "difficulty": "${currentConcept?.difficulty || 'beginner'}",
    "title": "${currentConcept?.name ? `${currentConcept.name} Exercise` : 'Concept Exercise'}"
  }
}

Focus specifically on ${currentConcept?.name || 'the concept'} and create blanks that test key aspects of this concept.`

      case 'concept-card':
        return `${baseContext}${conceptContext}

Create a concept card that explains the specific concept${currentConcept ? ` "${currentConcept.name}"` : ' within this lesson'}.

Return JSON:
{
  "type": "concept-card",
  "data": {
    "title": "${currentConcept?.name || 'Key Concept'}",
    "summary": "One clear sentence explaining ${currentConcept?.name || 'this concept'}",
    "details": "2-3 sentences with deeper explanation of ${currentConcept?.name || 'this concept'}",
    "examples": ["Real-world example 1 of ${currentConcept?.name || 'this concept'}", "Real-world example 2 of ${currentConcept?.name || 'this concept'}"],
    "keyPoints": ["Key point 1 about ${currentConcept?.name || 'this concept'}", "Key point 2 about ${currentConcept?.name || 'this concept'}", "Key point 3 about ${currentConcept?.name || 'this concept'}"],
    "difficulty": "${currentConcept?.difficulty || 'beginner'}",
    "category": "${lesson.title}"
  }
}

Focus specifically on explaining ${currentConcept?.name || 'the concept'} clearly and thoroughly.`

      case 'step-solver':
      case 'practice':
        return `${baseContext}${conceptContext}

Create a step-by-step problem that applies the specific concept${currentConcept ? ` "${currentConcept.name}"` : ' from this lesson'}.

Return JSON:
{
  "type": "step-solver",
  "data": {
    "problem": "A practical problem that uses ${currentConcept?.name || 'the concept'}",
    "problemType": "${currentConcept?.name || 'Concept Application'}",
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
    "difficulty": "${currentConcept?.difficulty || 'beginner'}",
    "learningObjective": "What students learn about ${currentConcept?.name || 'the concept'}",
    "title": "${currentConcept?.name ? `${currentConcept.name} Problem` : 'Concept Problem'}",
    "category": "${currentConcept?.name || 'Concept'}"
  }
}

Focus on applying ${currentConcept?.name || 'the concept'} specifically in a practical scenario.`

      case 'explainer':
        return `${baseContext}${conceptContext}

Create an interactive explanation for the specific concept${currentConcept ? ` "${currentConcept.name}"` : ' within this lesson'}.

Return JSON:
{
  "type": "explainer",
  "data": {
    "title": "${currentConcept?.name || 'Key Concept'}",
    "overview": "Clear, engaging overview of ${currentConcept?.name || 'this concept'} (1-2 sentences)",
    "sections": [
      {
        "heading": "What is ${currentConcept?.name || 'this concept'}?",
        "paragraphs": [
          "First paragraph explaining ${currentConcept?.name || 'this concept'} clearly.",
          "Second paragraph building on the explanation with examples.",
          "Third paragraph connecting to practical applications."
        ]
      },
      {
        "heading": "Key Components of ${currentConcept?.name || 'this concept'}",
        "paragraphs": [
          "Paragraph explaining the main components or parts.",
          "Paragraph showing how these components work together."
        ]
      },
      {
        "heading": "Applying ${currentConcept?.name || 'this concept'} in Practice",
        "paragraphs": [
          "Paragraph with concrete examples and applications.",
          "Paragraph showing relevance to student's life or studies."
        ]
      }
    ],
    "conclusion": "Brief summary that reinforces key learning points about ${currentConcept?.name || 'this concept'}",
    "difficulty": "${currentConcept?.difficulty || 'beginner'}",
    "estimatedReadTime": 3,
    "category": "${lesson.title}"
  }
}

Focus specifically on explaining ${currentConcept?.name || 'the concept'} and all content should focus on that concept.`

      default:
        return `${baseContext}${conceptContext}

Create educational content of type "${contentType}" for the specific concept${currentConcept ? ` "${currentConcept.name}"` : ' within this lesson'}.
Return valid JSON with type "${contentType}" and appropriate data structure.
Focus specifically on ${currentConcept?.name || 'the concept'}.
Include the concept name as the title and category in the data.`
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
      return JSON.stringify(this.createRetryPrompt('generate_welcome_message', { subjectName, currentLesson, progress, isReturningUser }, 'Unable to generate welcome message. Please try again.'))
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

  // Generate fallback concepts using unified retry approach
  private generateFallbackConcepts(lessonTitle: string, lessonIndex: number): ConceptInfo[] {
    return [{
      id: `retry-concept-${lessonIndex + 1}`,
      name: 'Content Generation Failed',
      description: JSON.stringify(this.createRetryPrompt('generate_concepts', { lessonTitle, lessonIndex }, `Unable to generate concepts for "${lessonTitle}". Please try again.`)),
      difficulty: 'beginner',
      estimatedPracticeItems: 0
    }]
  }

  private isPlanDataValid(data: unknown): data is PlanDataStructure {
    return typeof data === 'object' && data !== null &&
            'lessons' in data &&
            Array.isArray((data as PlanDataStructure).lessons)
  }

  private createSubjectSpecificFallback(subject: string): LessonPlan {
    const subjectLower = subject.toLowerCase()
    
    // Determine subject category for better lesson structure
    let lessons: Array<{
      id: string;
      title: string;
      description: string;
      completed: boolean;
      content: { type: 'concept-card'; data: Record<string, unknown> };
      concepts: ConceptInfo[];
      currentConceptIndex: number;
    }> = []
    
    if (subjectLower.includes('history')) {
      lessons = [
        {
          id: "lesson-1",
          title: `Introduction to ${subject}`,
          description: "Explore the foundational events and key periods that shaped this historical era",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-1-1",
              name: "Historical Context",
              description: `Understanding the background and setting of ${subject}`,
              difficulty: "beginner",
              estimatedPracticeItems: 3
            },
            {
              id: "concept-1-2", 
              name: "Key Time Periods",
              description: "Important dates and chronological framework",
              difficulty: "beginner",
              estimatedPracticeItems: 3
            }
          ],
          currentConceptIndex: 0
        },
        {
          id: "lesson-2", 
          title: `Major Events in ${subject}`,
          description: "Study the significant events and turning points",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-2-1",
              name: "Pivotal Moments",
              description: "Critical events that changed the course of history",
              difficulty: "intermediate",
              estimatedPracticeItems: 4
            },
            {
              id: "concept-2-2",
              name: "Cause and Effect",
              description: "Understanding how events influenced each other",
              difficulty: "intermediate", 
              estimatedPracticeItems: 4
            }
          ],
          currentConceptIndex: 0
        },
        {
          id: "lesson-3",
          title: `Legacy and Impact of ${subject}`,
          description: "Examine the lasting effects and modern relevance",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-3-1",
              name: "Historical Significance",
              description: "Why this period matters for understanding today",
              difficulty: "advanced",
              estimatedPracticeItems: 5
            },
            {
              id: "concept-3-2",
              name: "Modern Connections",
              description: "How this history influences contemporary events",
              difficulty: "advanced",
              estimatedPracticeItems: 5
            }
          ],
          currentConceptIndex: 0
        }
      ]
    } else if (subjectLower.includes('science') || subjectLower.includes('physics') || subjectLower.includes('chemistry') || subjectLower.includes('biology')) {
      lessons = [
        {
          id: "lesson-1",
          title: `Fundamentals of ${subject}`,
          description: "Master the basic principles and scientific foundations",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-1-1",
              name: "Core Principles",
              description: `Essential scientific concepts in ${subject}`,
              difficulty: "beginner",
              estimatedPracticeItems: 3
            },
            {
              id: "concept-1-2",
              name: "Scientific Method",
              description: "How research and discovery work in this field",
              difficulty: "beginner",
              estimatedPracticeItems: 3
            }
          ],
          currentConceptIndex: 0
        },
        {
          id: "lesson-2",
          title: `Applied ${subject}`,
          description: "Learn practical applications and problem-solving",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-2-1",
              name: "Real-World Applications",
              description: "How these concepts apply in everyday life",
              difficulty: "intermediate",
              estimatedPracticeItems: 4
            },
            {
              id: "concept-2-2",
              name: "Problem Solving",
              description: "Analytical thinking and scientific reasoning",
              difficulty: "intermediate",
              estimatedPracticeItems: 4
            }
          ],
          currentConceptIndex: 0
        },
        {
          id: "lesson-3",
          title: `Advanced ${subject}`,
          description: "Explore complex concepts and cutting-edge developments",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-3-1",
              name: "Advanced Theory",
              description: "Complex principles and relationships",
              difficulty: "advanced",
              estimatedPracticeItems: 5
            },
            {
              id: "concept-3-2",
              name: "Current Research",
              description: "Latest developments and future directions",
              difficulty: "advanced",
              estimatedPracticeItems: 5
            }
          ],
          currentConceptIndex: 0
        }
      ]
    } else if (subjectLower.includes('math') || subjectLower.includes('algebra') || subjectLower.includes('calculus') || subjectLower.includes('geometry')) {
      lessons = [
        {
          id: "lesson-1",
          title: `${subject} Foundations`,
          description: "Build essential mathematical understanding and skills",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-1-1",
              name: "Basic Concepts",
              description: `Fundamental ideas and terminology in ${subject}`,
              difficulty: "beginner",
              estimatedPracticeItems: 3
            },
            {
              id: "concept-1-2",
              name: "Problem-Solving Strategies",
              description: "Systematic approaches to mathematical thinking",
              difficulty: "beginner",
              estimatedPracticeItems: 4
            }
          ],
          currentConceptIndex: 0
        },
        {
          id: "lesson-2",
          title: `${subject} Applications`,
          description: "Practice solving problems and applying concepts",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-2-1",
              name: "Computational Skills",
              description: "Accurate calculation and formula application",
              difficulty: "intermediate",
              estimatedPracticeItems: 5
            },
            {
              id: "concept-2-2",
              name: "Word Problems",
              description: "Translating real situations into mathematical language",
              difficulty: "intermediate",
              estimatedPracticeItems: 4
            }
          ],
          currentConceptIndex: 0
        },
        {
          id: "lesson-3",
          title: `Mastering ${subject}`,
          description: "Develop advanced skills and mathematical reasoning",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-3-1",
              name: "Advanced Techniques",
              description: "Sophisticated mathematical methods and proofs",
              difficulty: "advanced",
              estimatedPracticeItems: 5
            },
            {
              id: "concept-3-2",
              name: "Mathematical Reasoning",
              description: "Logic, proof, and abstract thinking",
              difficulty: "advanced",
              estimatedPracticeItems: 5
            }
          ],
          currentConceptIndex: 0
        }
      ]
    } else if (subjectLower.includes('language') || subjectLower.includes('english') || subjectLower.includes('writing') || subjectLower.includes('literature')) {
      lessons = [
        {
          id: "lesson-1",
          title: `${subject} Basics`,
          description: "Develop core language skills and understanding",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-1-1",
              name: "Language Fundamentals",
              description: `Essential grammar, vocabulary, and structure in ${subject}`,
              difficulty: "beginner",
              estimatedPracticeItems: 3
            },
            {
              id: "concept-1-2",
              name: "Communication Skills",
              description: "Clear expression and comprehension",
              difficulty: "beginner",
              estimatedPracticeItems: 3
            }
          ],
          currentConceptIndex: 0
        },
        {
          id: "lesson-2",
          title: `${subject} in Practice`,
          description: "Apply language skills in real contexts",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-2-1",
              name: "Reading Comprehension",
              description: "Understanding and analyzing written texts",
              difficulty: "intermediate",
              estimatedPracticeItems: 4
            },
            {
              id: "concept-2-2",
              name: "Writing Skills",
              description: "Effective composition and expression",
              difficulty: "intermediate",
              estimatedPracticeItems: 4
            }
          ],
          currentConceptIndex: 0
        },
        {
          id: "lesson-3",
          title: `Advanced ${subject}`,
          description: "Master complex language use and critical analysis",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-3-1",
              name: "Critical Analysis",
              description: "Deep interpretation and evaluation of texts",
              difficulty: "advanced",
              estimatedPracticeItems: 5
            },
            {
              id: "concept-3-2",
              name: "Advanced Expression",
              description: "Sophisticated communication and style",
              difficulty: "advanced",
              estimatedPracticeItems: 5
            }
          ],
          currentConceptIndex: 0
        }
      ]
    } else {
      // Generic fallback for any other subject
      lessons = [
        {
          id: "lesson-1",
          title: `Introduction to ${subject}`,
          description: "Learn the fundamental concepts and principles",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-1-1",
              name: "Core Concepts",
              description: `Essential ideas and principles in ${subject}`,
              difficulty: "beginner",
              estimatedPracticeItems: 3
            },
            {
              id: "concept-1-2",
              name: "Basic Terminology",
              description: "Key terms and vocabulary for this field",
              difficulty: "beginner",
              estimatedPracticeItems: 3
            }
          ],
          currentConceptIndex: 0
        },
        {
          id: "lesson-2",
          title: `Exploring ${subject}`,
          description: "Develop deeper understanding through practice and application",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-2-1",
              name: "Practical Applications",
              description: "How to apply knowledge in real situations",
              difficulty: "intermediate",
              estimatedPracticeItems: 4
            },
            {
              id: "concept-2-2",
              name: "Skill Development",
              description: "Building competency through guided practice",
              difficulty: "intermediate",
              estimatedPracticeItems: 4
            }
          ],
          currentConceptIndex: 0
        },
        {
          id: "lesson-3",
          title: `Mastering ${subject}`,
          description: "Achieve expertise and develop advanced understanding",
          completed: false,
          content: { type: 'concept-card', data: {} as Record<string, unknown> },
          concepts: [
            {
              id: "concept-3-1",
              name: "Advanced Concepts",
              description: "Complex ideas and sophisticated understanding",
              difficulty: "advanced",
              estimatedPracticeItems: 5
            },
            {
              id: "concept-3-2",
              name: "Expert Application",
              description: "Professional-level skills and creative problem-solving",
              difficulty: "advanced",
              estimatedPracticeItems: 5
            }
          ],
          currentConceptIndex: 0
        }
      ]
    }
    
    return {
      subject: subject,
      lessons: lessons,
      currentLessonIndex: 0
    }
  }
}

export const aiTutor = new AITutorService()
export default AITutorService 

