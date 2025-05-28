const fs = require('fs');
const path = require('path');

const componentsDir = './src/components/interactive';
const componentFiles = [
  'FillInTheBlank.tsx',
  'DragAndDrop.tsx', 
  'ProgressQuiz.tsx',
  'ConceptCard.tsx',
  'FormulaExplorer.tsx',
  'GraphVisualizer.tsx',
  'TextHighlighter.tsx',
  'InteractiveExample.tsx'
];

function updateComponent(filePath) {
  console.log(`Updating ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Add Loader2 import
  if (!content.includes('Loader2')) {
    content = content.replace(
      /from 'lucide-react'/,
      `from 'lucide-react'`
    ).replace(
      /} from 'lucide-react'/,
      `, Loader2 } from 'lucide-react'`
    );
  }
  
  // 2. Replace interface import
  content = content.replace(
    /interface InteractiveComponentProps \{[\s\S]*?\}/,
    ''
  ).replace(
    /'react'/,
    `'react'\nimport { InteractiveComponentProps } from './index'`
  );
  
  // 3. Add isLoading prop and buttonLoadingStates
  content = content.replace(
    /export const (\w+) = memo\(function \1\(\{ onInteraction, content, id \}: InteractiveComponentProps\) => \{/,
    `export const $1 = memo(function $1({ onInteraction, content, id, isLoading = false }: InteractiveComponentProps) => {`
  );
  
  // Add buttonLoadingStates after the component starts
  if (!content.includes('buttonLoadingStates')) {
    content = content.replace(
      /(export const \w+ = memo\(function \w+[^{]+\{[^}]*?)\n/,
      `$1
  const [buttonLoadingStates, setButtonLoadingStates] = useState({
    submit: false,
    reset: false,
    explainMore: false,
    nextQuestion: false,
    nextProblem: false,
    autoPlay: false
  })
`
    );
  }
  
  // 4. Update handler functions to be async and include loading states
  const handlerPatterns = [
    'handleSubmit',
    'handleReset', 
    'handleExplainMore',
    'handleNextQuestion',
    'handleNextProblem',
    'handleAutoPlay'
  ];
  
  handlerPatterns.forEach(handler => {
    const asyncPattern = new RegExp(`const ${handler} = \\(([^)]*)\\) => \\{`, 'g');
    content = content.replace(asyncPattern, `const ${handler} = async ($1) => {`);
    
    const stateKey = handler.replace('handle', '').replace(/([A-Z])/g, (match, offset) => 
      offset === 0 ? match.toLowerCase() : match.toLowerCase()
    );
    
    // Add loading state logic
    const functionBodyPattern = new RegExp(`(const ${handler} = async[^{]+\\{)([\\s\\S]*?)(\n  \\})`, 'g');
    content = content.replace(functionBodyPattern, (match, start, body, end) => {
      if (body.includes('setButtonLoadingStates')) return match;
      
      return `${start}
    setButtonLoadingStates(prev => ({ ...prev, ${stateKey}: true }))
    try {${body}
    } finally {
      setTimeout(() => {
        setButtonLoadingStates(prev => ({ ...prev, ${stateKey}: false }))
      }, 1000)
    }${end}`;
    });
  });
  
  // 5. Update button elements to include loading states and disabled props
  content = content.replace(
    /<Button[^>]*onClick=\{([^}]+)\}([^>]*?)>/g,
    (match, handler, attrs) => {
      const handlerName = handler.trim();
      const stateKey = handlerName.replace('handle', '').replace(/([A-Z])/g, (match, offset) => 
        offset === 0 ? match.toLowerCase() : match.toLowerCase()
      );
      
      if (!attrs.includes('disabled')) {
        attrs += ` disabled={buttonLoadingStates.${stateKey} || isLoading}`;
      }
      
      return `<Button onClick={${handler}}${attrs}>`;
    }
  );
  
  // 6. Add loading spinner logic to button content
  content = content.replace(
    /(<Button[^>]*onClick=\{handle(\w+)\}[^>]*>)\s*(?:<(\w+)[^>]*\/>)?\s*([^<]+)/g,
    (match, buttonTag, handlerName, iconName, text) => {
      const stateKey = handlerName.replace(/([A-Z])/g, (match, offset) => 
        offset === 0 ? match.toLowerCase() : match.toLowerCase()
      );
      
      const loadingText = text.includes('Submit') ? 'Submitting...' :
                         text.includes('Reset') ? 'Resetting...' :
                         text.includes('Next') ? 'Processing...' :
                         text.includes('Auto') ? 'Starting...' :
                         'Loading...';
      
      return `${buttonTag}
              {buttonLoadingStates.${stateKey} ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <${iconName} className="h-4 w-4 mr-2" />
              )}
              {buttonLoadingStates.${stateKey} ? '${loadingText}' : '${text.trim()}'}`;
    }
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated ${filePath}`);
}

// Update all components
componentFiles.forEach(filename => {
  const filePath = path.join(componentsDir, filename);
  if (fs.existsSync(filePath)) {
    try {
      updateComponent(filePath);
    } catch (error) {
      console.error(`❌ Error updating ${filename}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log('🎉 Loading states update complete!'); 