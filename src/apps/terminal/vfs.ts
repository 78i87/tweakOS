// Virtual filesystem with localStorage persistence

export type FileNode = {
  type: 'file';
  name: string;
  content: string;
};

export type DirectoryNode = {
  type: 'directory';
  name: string;
  children: Map<string, FSNode>;
};

export type FSNode = FileNode | DirectoryNode;

const STORAGE_KEY = 'terminal.vfs.v1';

class VirtualFS {
  private root: DirectoryNode;

  constructor() {
    this.root = {
      type: 'directory',
      name: '',
      children: new Map(),
    };
  }

  init(): void {
    const saved = this.load();
    if (saved) {
      this.root = saved;
    } else {
      // Initialize with /sandbox directory
      this.mkdir('/sandbox');
    }
  }

  private load(): DirectoryNode | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      return this.deserialize(parsed);
    } catch (e) {
      console.error('Failed to load VFS:', e);
      return null;
    }
  }

  save(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const serialized = this.serialize(this.root);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (e) {
      console.error('Failed to save VFS:', e);
    }
  }

  private serialize(node: FSNode): any {
    if (node.type === 'file') {
      return {
        type: 'file',
        name: node.name,
        content: node.content,
      };
    } else {
      return {
        type: 'directory',
        name: node.name,
        children: Array.from(node.children.entries()).map(([name, child]) => [
          name,
          this.serialize(child),
        ]),
      };
    }
  }

  private deserialize(data: any): DirectoryNode {
    if (data.type === 'file') {
      return {
        type: 'file',
        name: data.name,
        content: data.content || '',
      } as FileNode;
    } else {
      const children = new Map<string, FSNode>();
      if (data.children && Array.isArray(data.children)) {
        for (const [name, childData] of data.children) {
          children.set(name, this.deserialize(childData));
        }
      }
      return {
        type: 'directory',
        name: data.name || '',
        children,
      };
    }
  }

  private resolvePath(path: string, cwd: string = '/'): string[] {
    // Normalize path
    let parts = path.startsWith('/')
      ? path.split('/').filter(Boolean)
      : [...cwd.split('/').filter(Boolean), ...path.split('/').filter(Boolean)];

    // Resolve .. and .
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '..') {
        if (resolved.length > 0) resolved.pop();
      } else if (part !== '.') {
        resolved.push(part);
      }
    }

    return resolved;
  }

  private getNode(path: string, cwd: string = '/'): FSNode | null {
    const parts = this.resolvePath(path, cwd);
    let current: FSNode = this.root;

    for (const part of parts) {
      if (current.type !== 'directory') {
        return null;
      }
      const child = current.children.get(part);
      if (!child) {
        return null;
      }
      current = child;
    }

    return current;
  }

  private getParent(path: string, cwd: string = '/'): DirectoryNode | null {
    const parts = this.resolvePath(path, cwd);
    if (parts.length === 0) {
      return this.root;
    }

    const parentPath = parts.slice(0, -1);
    let current: FSNode = this.root;

    for (const part of parentPath) {
      if (current.type !== 'directory') {
        return null;
      }
      const child = current.children.get(part);
      if (!child) {
        return null;
      }
      current = child;
    }

    return current.type === 'directory' ? current : null;
  }

  list(path: string = '/', cwd: string = '/'): FSNode[] {
    const node = this.getNode(path, cwd);
    if (!node) {
      return [];
    }
    if (node.type === 'file') {
      return [node];
    }
    return Array.from(node.children.values());
  }

  read(path: string, cwd: string = '/'): string | null {
    const node = this.getNode(path, cwd);
    if (node?.type === 'file') {
      return node.content;
    }
    return null;
  }

  write(path: string, content: string, cwd: string = '/'): boolean {
    const parts = this.resolvePath(path, cwd);
    if (parts.length === 0) {
      return false;
    }

    const parent = this.getParent(path, cwd);
    if (!parent) {
      return false;
    }

    const name = parts[parts.length - 1];
    parent.children.set(name, {
      type: 'file',
      name,
      content,
    });

    this.save();
    return true;
  }

  mkdir(path: string, cwd: string = '/'): boolean {
    const parts = this.resolvePath(path, cwd);
    if (parts.length === 0) {
      return false;
    }

    let current: FSNode = this.root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (current.type !== 'directory') {
        return false;
      }

      const existing = current.children.get(part);
      if (existing) {
        if (existing.type === 'file') {
          return false; // Can't create dir where file exists
        }
        current = existing;
      } else {
        const newDir: DirectoryNode = {
          type: 'directory',
          name: part,
          children: new Map(),
        };
        current.children.set(part, newDir);
        current = newDir;
      }
    }

    this.save();
    return true;
  }

  rm(path: string, cwd: string = '/'): boolean {
    const parts = this.resolvePath(path, cwd);
    if (parts.length === 0) {
      return false; // Can't remove root
    }

    const parent = this.getParent(path, cwd);
    if (!parent) {
      return false;
    }

    const name = parts[parts.length - 1];
    const node = parent.children.get(name);
    if (!node) {
      return false;
    }

    if (node.type === 'directory' && node.children.size > 0) {
      return false; // Can't remove non-empty directory
    }

    parent.children.delete(name);
    this.save();
    return true;
  }

  rmdir(path: string, cwd: string = '/'): boolean {
    return this.rm(path, cwd);
  }

  mv(src: string, dst: string, cwd: string = '/'): boolean {
    const srcNode = this.getNode(src, cwd);
    if (!srcNode) {
      return false;
    }

    const dstParts = this.resolvePath(dst, cwd);
    if (dstParts.length === 0) {
      return false;
    }

    const dstParent = this.getParent(dst, cwd);
    if (!dstParent) {
      return false;
    }

    const dstName = dstParts[dstParts.length - 1];
    if (dstParent.children.has(dstName)) {
      return false; // Destination exists
    }

    // Remove from source
    const srcParts = this.resolvePath(src, cwd);
    const srcParent = this.getParent(src, cwd);
    if (!srcParent) {
      return false;
    }
    const srcName = srcParts[srcParts.length - 1];
    srcParent.children.delete(srcName);

    // Add to destination
    srcNode.name = dstName;
    dstParent.children.set(dstName, srcNode);

    this.save();
    return true;
  }

  cp(src: string, dst: string, cwd: string = '/'): boolean {
    const srcNode = this.getNode(src, cwd);
    if (!srcNode) {
      return false;
    }

    const dstParts = this.resolvePath(dst, cwd);
    if (dstParts.length === 0) {
      return false;
    }

    const dstParent = this.getParent(dst, cwd);
    if (!dstParent) {
      return false;
    }

    const dstName = dstParts[dstParts.length - 1];
    if (dstParent.children.has(dstName)) {
      return false; // Destination exists
    }

    // Deep copy
    const copy = this.deepCopy(srcNode);
    copy.name = dstName;
    dstParent.children.set(dstName, copy);

    this.save();
    return true;
  }

  private deepCopy(node: FSNode): FSNode {
    if (node.type === 'file') {
      return {
        type: 'file',
        name: node.name,
        content: node.content,
      };
    } else {
      const children = new Map<string, FSNode>();
      for (const [name, child] of node.children.entries()) {
        children.set(name, this.deepCopy(child));
      }
      return {
        type: 'directory',
        name: node.name,
        children,
      };
    }
  }

  getAbsolutePath(path: string, cwd: string): string {
    const parts = this.resolvePath(path, cwd);
    return '/' + parts.join('/');
  }

  exists(path: string, cwd: string = '/'): boolean {
    return this.getNode(path, cwd) !== null;
  }

  isDirectory(path: string, cwd: string = '/'): boolean {
    const node = this.getNode(path, cwd);
    return node?.type === 'directory' ?? false;
  }

  isFile(path: string, cwd: string = '/'): boolean {
    const node = this.getNode(path, cwd);
    return node?.type === 'file' ?? false;
  }

  // Get filesystem snapshot for AI agent
  getSnapshot(rootPath: string = '/sandbox', maxItems: number = 100, maxPreview: number = 120): Array<{
    path: string;
    type: 'file' | 'dir';
    size?: number;
    preview?: string;
  }> {
    const snapshot: Array<{ path: string; type: 'file' | 'dir'; size?: number; preview?: string }> = [];
    
    const collect = (node: FSNode, currentPath: string, depth: number = 0): void => {
      if (snapshot.length >= maxItems) return;
      if (depth > 10) return; // Prevent infinite recursion

      if (node.type === 'file') {
        snapshot.push({
          path: currentPath,
          type: 'file',
          size: node.content.length,
          preview: node.content.substring(0, maxPreview),
        });
      } else {
        snapshot.push({
          path: currentPath,
          type: 'dir',
        });
        
        for (const [name, child] of node.children.entries()) {
          const childPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
          collect(child, childPath, depth + 1);
        }
      }
    };

    const rootNode = this.getNode(rootPath);
    if (rootNode) {
      collect(rootNode, rootPath);
    }

    return snapshot;
  }
}

// Singleton instance
let vfsInstance: VirtualFS | null = null;

export function getVFS(): VirtualFS {
  if (!vfsInstance) {
    vfsInstance = new VirtualFS();
    vfsInstance.init();
  }
  return vfsInstance;
}

export function initVfs(): void {
  getVFS();
}

