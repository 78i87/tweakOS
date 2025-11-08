import React from 'react';
import { AppDefinition } from './types';
import { useWindowStore } from './windowStore';
import CloudIcon from '@/components/icons/CloudIcon';

// Registry to store all available apps
const appRegistry = new Map<string, AppDefinition>();

// Listeners for app registry changes
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function registerApp(app: AppDefinition): void {
  appRegistry.set(app.appId, app);
  notifyListeners();
}

export function unregisterApp(appId: string): void {
  appRegistry.delete(appId);
  notifyListeners();
}

export function getApp(appId: string): AppDefinition | undefined {
  return appRegistry.get(appId);
}

export function getAllApps(): AppDefinition[] {
  return Array.from(appRegistry.values());
}

export function subscribeToApps(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function openAppWindow(appId: string, data?: any): void {
  const app = getApp(appId);
  if (!app) {
    console.warn(`App ${appId} not found in registry`);
    return;
  }
  const { openWindow } = useWindowStore.getState();
  openWindow(appId, app.title, data);
}

export function makeAppFromHTML(args: { title: string; html: string }): void {
  const appId = `html-${Date.now()}`;
  
  import('../apps/html/HTMLApp').then((module) => {
    const HTMLApp = module.default;
    registerApp({
      appId,
      title: args.title,
      icon: React.createElement(CloudIcon, { size: 20 }),
      component: HTMLApp,
    });
    
    openAppWindow(appId, { html: args.html });
  });
}

