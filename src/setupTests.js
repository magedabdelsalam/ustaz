// Jest setup file for test environment
import '@testing-library/jest-dom';

// Mock scrollIntoView (not available in JSDOM)
Element.prototype.scrollIntoView = jest.fn();

// Mock IntersectionObserver (not available in JSDOM)
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver (not available in JSDOM)
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window.matchMedia (not available in JSDOM)
global.matchMedia = jest.fn((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(), // deprecated
  removeListener: jest.fn(), // deprecated
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

// Mock HTMLCanvasElement.getContext (for charts/graphs if any)
HTMLCanvasElement.prototype.getContext = jest.fn();

// Mock window.alert, confirm, prompt
global.alert = jest.fn();
global.confirm = jest.fn(() => true);
global.prompt = jest.fn(() => 'mocked response');

// Mock clipboard API
global.navigator.clipboard = {
  writeText: jest.fn(() => Promise.resolve()),
  readText: jest.fn(() => Promise.resolve('mocked clipboard text')),
};

// Mock fetch if not already mocked
if (!global.fetch) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })
  );
}

// Mock crypto.randomUUID
if (!global.crypto) {
  global.crypto = {};
}
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = jest.fn(() => 'mocked-uuid-1234-5678-9012');
}

// Mock Analytics Service
jest.mock('@/lib/analyticsService', () => ({
  AnalyticsService: {
    getInstance: jest.fn(() => ({
      trackInteractiveComponentUsage: jest.fn(),
      getIterationInsights: jest.fn(() => ({
        componentUsageRate: 75,
        averageFeedbackScores: { clarity: 4, engagement: 4, learningOutcome: 4 },
        commonIssues: [],
        topSuggestions: [],
        performanceMetrics: { averageCompletionTime: 300, successRate: 0.8 }
      })),
      generateImprovementSuggestions: jest.fn(() => [])
    }))
  }
}));

// Mock Interactive Components
jest.mock('@/lib/interactive-components', () => ({
  renderInteractiveComponent: jest.fn(() => null)
}));

// Mock Feedback Trigger
jest.mock('@/components/feedback/FeedbackTrigger', () => ({
  FeedbackTrigger: jest.fn(() => null)
}));

// Mock toast notifications
jest.mock('@/components/ui/use-toast', () => ({
  useToast: jest.fn(() => ({
    toast: jest.fn(),
    dismiss: jest.fn(),
    toasts: []
  }))
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  }
}));

// Mock framer-motion for tests (can cause issues in JSDOM)
jest.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    span: 'span', 
    button: 'button',
  },
  AnimatePresence: jest.fn(({ children }) => children),
}));

// Mock @tanstack/react-virtual
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(() => ({
    getTotalSize: jest.fn(() => 1000),
    getVirtualItems: jest.fn(() => []),
    scrollToIndex: jest.fn(),
  }))
}));

// Console error handler for cleaner test output
const originalError = console.error;
console.error = (...args) => {
  // Filter out known React warnings/errors that are expected in tests
  const message = args.join(' ');
  if (
    message.includes('Warning: ReactDOM.render is no longer supported') ||
    message.includes('Warning: validateDOMNesting') ||
    message.includes('Consider adding an error boundary') ||
    message.includes('Warning: Each child in a list should have a unique "key" prop')
  ) {
    return;
  }
  originalError.call(console, ...args);
};

 