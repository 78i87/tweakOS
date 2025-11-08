// Terminal command interpreter

import { getVFS } from './vfs';

export type CommandResult = {
  output: string[];
  cwd: string;
  clear?: boolean;
};

function parseCommand(input: string): { command: string; args: string[] } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { command: '', args: [] };
  }

  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  return { command, args };
}

export function executeCommand(
  input: string,
  cwd: string
): CommandResult {
  const { command, args } = parseCommand(input);
  const vfs = getVFS();

  if (!command) {
    return { output: [], cwd };
  }

  switch (command) {
    case 'help':
      return {
        output: [
          'Available commands:',
          '  help          - Show this help message',
          '  pwd           - Print working directory',
          '  ls [path]     - List directory contents',
          '  cd [path]     - Change directory',
          '  mkdir <path>  - Create directory',
          '  rmdir <path>  - Remove directory',
          '  touch <file>  - Create empty file',
          '  cat <file>    - Display file contents',
          '  echo <text>   - Print text',
          '  write <file> <content> - Write content to file',
          '  read <file>   - Read file contents',
          '  rm <path>     - Remove file or directory',
          '  mv <src> <dst> - Move/rename file or directory',
          '  cp <src> <dst> - Copy file or directory',
          '  clear         - Clear terminal',
        ],
        cwd,
      };

    case 'pwd':
      return {
        output: [cwd === '/' ? '/' : cwd],
        cwd,
      };

    case 'ls': {
      const path = args[0] || '.';
      const nodes = vfs.list(path, cwd);
      
      if (nodes.length === 0) {
        return { output: [], cwd };
      }

      const entries = nodes.map((node) => {
        const prefix = node.type === 'directory' ? '📁' : '📄';
        const suffix = node.type === 'directory' ? '/' : '';
        return `${prefix} ${node.name}${suffix}`;
      });

      return { output: entries, cwd };
    }

    case 'cd': {
      const path = args[0] || '/sandbox';
      const absPath = vfs.getAbsolutePath(path, cwd);
      
      if (vfs.isDirectory(path, cwd)) {
        return { output: [], cwd: absPath };
      } else {
        return { output: [`cd: ${path}: No such directory`], cwd };
      }
    }

    case 'mkdir': {
      if (args.length === 0) {
        return { output: ['mkdir: missing operand'], cwd };
      }
      
      const path = args[0];
      if (vfs.mkdir(path, cwd)) {
        return { output: [], cwd };
      } else {
        return { output: [`mkdir: cannot create directory '${path}'`], cwd };
      }
    }

    case 'rmdir': {
      if (args.length === 0) {
        return { output: ['rmdir: missing operand'], cwd };
      }
      
      const path = args[0];
      if (vfs.rmdir(path, cwd)) {
        return { output: [], cwd };
      } else {
        return { output: [`rmdir: cannot remove '${path}'`], cwd };
      }
    }

    case 'touch': {
      if (args.length === 0) {
        return { output: ['touch: missing operand'], cwd };
      }
      
      const path = args[0];
      if (vfs.write(path, '', cwd)) {
        return { output: [], cwd };
      } else {
        return { output: [`touch: cannot create '${path}'`], cwd };
      }
    }

    case 'cat': {
      if (args.length === 0) {
        return { output: ['cat: missing operand'], cwd };
      }
      
      const path = args[0];
      const content = vfs.read(path, cwd);
      
      if (content !== null) {
        return { output: content.split('\n'), cwd };
      } else {
        return { output: [`cat: ${path}: No such file`], cwd };
      }
    }

    case 'echo': {
      const text = args.join(' ');
      return { output: [text], cwd };
    }

    case 'write': {
      if (args.length < 2) {
        return { output: ['write: usage: write <file> <content>'], cwd };
      }
      
      const path = args[0];
      const content = args.slice(1).join(' ');
      
      if (vfs.write(path, content, cwd)) {
        return { output: [], cwd };
      } else {
        return { output: [`write: cannot write to '${path}'`], cwd };
      }
    }

    case 'read': {
      if (args.length === 0) {
        return { output: ['read: missing operand'], cwd };
      }
      
      const path = args[0];
      const content = vfs.read(path, cwd);
      
      if (content !== null) {
        return { output: content.split('\n'), cwd };
      } else {
        return { output: [`read: ${path}: No such file`], cwd };
      }
    }

    case 'rm': {
      if (args.length === 0) {
        return { output: ['rm: missing operand'], cwd };
      }
      
      const path = args[0];
      if (vfs.rm(path, cwd)) {
        return { output: [], cwd };
      } else {
        return { output: [`rm: cannot remove '${path}'`], cwd };
      }
    }

    case 'mv': {
      if (args.length < 2) {
        return { output: ['mv: usage: mv <src> <dst>'], cwd };
      }
      
      const src = args[0];
      const dst = args[1];
      
      if (vfs.mv(src, dst, cwd)) {
        return { output: [], cwd };
      } else {
        return { output: [`mv: cannot move '${src}' to '${dst}'`], cwd };
      }
    }

    case 'cp': {
      if (args.length < 2) {
        return { output: ['cp: usage: cp <src> <dst>'], cwd };
      }
      
      const src = args[0];
      const dst = args[1];
      
      if (vfs.cp(src, dst, cwd)) {
        return { output: [], cwd };
      } else {
        return { output: [`cp: cannot copy '${src}' to '${dst}'`], cwd };
      }
    }

    case 'clear':
      return { output: [], cwd, clear: true };

    default:
      return { output: [`${command}: command not found`], cwd };
  }
}

