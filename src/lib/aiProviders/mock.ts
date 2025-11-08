import { AIProvider, AIProviderResponse } from './base';
import { AppGenerationRequest } from '../aiAgent';

/**
 * Mock AI Provider for development and testing
 * Generates simple HTML apps based on keywords in the prompt
 */
export class MockAIProvider implements AIProvider {
  async generateApp(request: AppGenerationRequest): Promise<AIProviderResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const prompt = request.prompt.toLowerCase();
    
    // Extract title from prompt (first few words or generate based on content)
    const title = this.extractTitle(prompt);
    
    // Generate HTML based on prompt keywords
    const html = this.generateHTML(prompt);

    return {
      title,
      html,
      description: `Generated app for: ${request.prompt}`,
    };
  }

  private extractTitle(prompt: string): string {
    // Try to extract a meaningful title
    const words = prompt.split(/\s+/).filter(w => w.length > 0);
    
    // If prompt starts with "create" or "make", skip those words
    const skipWords = ['create', 'make', 'build', 'generate', 'a', 'an', 'the'];
    const meaningfulWords = words.filter(w => !skipWords.includes(w));
    
    if (meaningfulWords.length > 0) {
      // Capitalize first letter of each word
      const title = meaningfulWords
        .slice(0, 4) // Take first 4 words max
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return title || 'Custom App';
    }
    
    return 'Custom App';
  }

  private generateHTML(prompt: string): string {
    // Generate HTML based on common keywords
    if (prompt.includes('calculator') || prompt.includes('calc')) {
      return `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h1 style="text-align: center; margin-bottom: 20px;">Calculator</h1>
          <div style="max-width: 300px; margin: 0 auto;">
            <input type="text" id="display" readonly style="width: 100%; padding: 15px; font-size: 24px; text-align: right; border: 2px solid #ccc; border-radius: 8px; margin-bottom: 10px;" value="0">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
              <button onclick="clearDisplay()" style="grid-column: span 2; padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #ff6b6b; color: white; cursor: pointer;">Clear</button>
              <button onclick="appendOperator('/')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #4ecdc4; color: white; cursor: pointer;">/</button>
              <button onclick="appendOperator('*')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #4ecdc4; color: white; cursor: pointer;">×</button>
              <button onclick="appendNumber('7')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #f0f0f0; cursor: pointer;">7</button>
              <button onclick="appendNumber('8')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #f0f0f0; cursor: pointer;">8</button>
              <button onclick="appendNumber('9')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #f0f0f0; cursor: pointer;">9</button>
              <button onclick="appendOperator('-')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #4ecdc4; color: white; cursor: pointer;">-</button>
              <button onclick="appendNumber('4')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #f0f0f0; cursor: pointer;">4</button>
              <button onclick="appendNumber('5')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #f0f0f0; cursor: pointer;">5</button>
              <button onclick="appendNumber('6')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #f0f0f0; cursor: pointer;">6</button>
              <button onclick="appendOperator('+')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #4ecdc4; color: white; cursor: pointer;">+</button>
              <button onclick="appendNumber('1')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #f0f0f0; cursor: pointer;">1</button>
              <button onclick="appendNumber('2')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #f0f0f0; cursor: pointer;">2</button>
              <button onclick="appendNumber('3')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #f0f0f0; cursor: pointer;">3</button>
              <button onclick="calculate()" style="grid-row: span 2; padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #95e1d3; color: white; cursor: pointer;">=</button>
              <button onclick="appendNumber('0')" style="grid-column: span 2; padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #f0f0f0; cursor: pointer;">0</button>
              <button onclick="appendNumber('.')" style="padding: 15px; font-size: 18px; border: none; border-radius: 8px; background: #f0f0f0; cursor: pointer;">.</button>
            </div>
          </div>
          <script>
            let display = document.getElementById('display');
            let currentValue = '0';
            let operator = null;
            let previousValue = null;
            
            function updateDisplay() {
              display.value = currentValue;
            }
            
            function appendNumber(num) {
              if (currentValue === '0') {
                currentValue = num;
              } else {
                currentValue += num;
              }
              updateDisplay();
            }
            
            function appendOperator(op) {
              if (previousValue !== null) {
                calculate();
              }
              previousValue = currentValue;
              operator = op;
              currentValue = '0';
            }
            
            function calculate() {
              if (previousValue === null || operator === null) return;
              const prev = parseFloat(previousValue);
              const curr = parseFloat(currentValue);
              let result;
              
              switch(operator) {
                case '+': result = prev + curr; break;
                case '-': result = prev - curr; break;
                case '*': result = prev * curr; break;
                case '/': result = prev / curr; break;
                default: return;
              }
              
              currentValue = result.toString();
              previousValue = null;
              operator = null;
              updateDisplay();
            }
            
            function clearDisplay() {
              currentValue = '0';
              previousValue = null;
              operator = null;
              updateDisplay();
            }
          </script>
        </div>
      `;
    }
    
    if (prompt.includes('todo') || prompt.includes('task')) {
      return `
        <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="text-align: center; margin-bottom: 20px;">Todo List</h1>
          <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <input type="text" id="todoInput" placeholder="Add a new task..." style="flex: 1; padding: 10px; border: 2px solid #ccc; border-radius: 8px; font-size: 16px;">
            <button onclick="addTodo()" style="padding: 10px 20px; background: #4ecdc4; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">Add</button>
          </div>
          <ul id="todoList" style="list-style: none; padding: 0;">
          </ul>
          <script>
            let todos = [];
            
            function addTodo() {
              const input = document.getElementById('todoInput');
              const text = input.value.trim();
              if (text) {
                todos.push({ id: Date.now(), text, completed: false });
                input.value = '';
                renderTodos();
              }
            }
            
            function toggleTodo(id) {
              const todo = todos.find(t => t.id === id);
              if (todo) {
                todo.completed = !todo.completed;
                renderTodos();
              }
            }
            
            function deleteTodo(id) {
              todos = todos.filter(t => t.id !== id);
              renderTodos();
            }
            
            function renderTodos() {
              const list = document.getElementById('todoList');
              list.innerHTML = todos.map(todo => \`
                <li style="display: flex; align-items: center; gap: 10px; padding: 10px; margin-bottom: 10px; background: #f0f0f0; border-radius: 8px;">
                  <input type="checkbox" \${todo.completed ? 'checked' : ''} onchange="toggleTodo(\${todo.id})" style="width: 20px; height: 20px;">
                  <span style="flex: 1; text-decoration: \${todo.completed ? 'line-through' : 'none'}; color: \${todo.completed ? '#999' : '#000'};">\${todo.text}</span>
                  <button onclick="deleteTodo(\${todo.id})" style="padding: 5px 10px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
                </li>
              \`).join('');
            }
            
            document.getElementById('todoInput').addEventListener('keypress', function(e) {
              if (e.key === 'Enter') {
                addTodo();
              }
            });
          </script>
        </div>
      `;
    }
    
    if (prompt.includes('counter') || prompt.includes('count')) {
      return `
        <div style="padding: 40px; font-family: Arial, sans-serif; text-align: center;">
          <h1 style="margin-bottom: 30px;">Counter</h1>
          <div style="font-size: 72px; font-weight: bold; margin-bottom: 30px; color: #4ecdc4;" id="count">0</div>
          <div style="display: flex; gap: 20px; justify-content: center;">
            <button onclick="decrement()" style="padding: 15px 30px; font-size: 24px; background: #ff6b6b; color: white; border: none; border-radius: 8px; cursor: pointer;">-</button>
            <button onclick="reset()" style="padding: 15px 30px; font-size: 24px; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer;">Reset</button>
            <button onclick="increment()" style="padding: 15px 30px; font-size: 24px; background: #4ecdc4; color: white; border: none; border-radius: 8px; cursor: pointer;">+</button>
          </div>
          <script>
            let count = 0;
            function updateDisplay() {
              document.getElementById('count').textContent = count;
            }
            function increment() {
              count++;
              updateDisplay();
            }
            function decrement() {
              count--;
              updateDisplay();
            }
            function reset() {
              count = 0;
              updateDisplay();
            }
          </script>
        </div>
      `;
    }
    
    // Default HTML app
    return `
      <div style="padding: 40px; font-family: Arial, sans-serif; text-align: center;">
        <h1 style="margin-bottom: 20px; color: #4ecdc4;">Welcome to Your Custom App</h1>
        <p style="font-size: 18px; color: #666; margin-bottom: 30px;">
          This app was generated from your prompt: "${prompt}"
        </p>
        <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
          <p style="color: #333;">This is a basic HTML app template. You can customize it further!</p>
        </div>
      </div>
    `;
  }
}

