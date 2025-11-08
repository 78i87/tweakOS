'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppComponentProps } from '@/lib/types';
import { Cookie, Sparkles } from 'lucide-react';

interface Upgrade {
  id: string;
  name: string;
  cost: number;
  cookiesPerSecond: number;
  count: number;
  description: string;
}

const INITIAL_UPGRADES: Upgrade[] = [
  { id: 'cursor', name: 'Cursor', cost: 15, cookiesPerSecond: 0.1, count: 0, description: 'Autoclicks once every 10 seconds' },
  { id: 'grandma', name: 'Grandma', cost: 100, cookiesPerSecond: 1, count: 0, description: 'A nice grandma to bake cookies' },
  { id: 'farm', name: 'Farm', cost: 1100, cookiesPerSecond: 8, count: 0, description: 'Grows cookie plants' },
  { id: 'mine', name: 'Mine', cost: 12000, cookiesPerSecond: 47, count: 0, description: 'Mines cookie dough and chocolate chips' },
  { id: 'factory', name: 'Factory', cost: 130000, cookiesPerSecond: 260, count: 0, description: 'Produces cookies at an industrial rate' },
  { id: 'bank', name: 'Bank', cost: 1400000, cookiesPerSecond: 1400, count: 0, description: 'Generates cookies from interest' },
  { id: 'temple', name: 'Temple', cost: 20000000, cookiesPerSecond: 7800, count: 0, description: 'Full of cookie prayers' },
];

interface FloatingNumber {
  id: number;
  value: number;
  x: number;
  y: number;
}

export default function CookieClickerApp({ windowId, initialData }: AppComponentProps) {
  const [cookies, setCookies] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`cookie-clicker-${windowId}`);
      return saved ? parseFloat(saved) : 0;
    }
    return 0;
  });
  
  const [upgrades, setUpgrades] = useState<Upgrade[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`cookie-upgrades-${windowId}`);
      return saved ? JSON.parse(saved) : INITIAL_UPGRADES;
    }
    return INITIAL_UPGRADES;
  });

  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
  const [cookieScale, setCookieScale] = useState(1);
  const [cookieRotation, setCookieRotation] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [totalCookies, setTotalCookies] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`cookie-total-${windowId}`);
      return saved ? parseFloat(saved) : 0;
    }
    return 0;
  });

  // Calculate cookies per second
  const cookiesPerSecond = upgrades.reduce((sum, upgrade) => 
    sum + upgrade.cookiesPerSecond * upgrade.count, 0
  );

  // Auto-generate cookies
  useEffect(() => {
    if (cookiesPerSecond <= 0) return;

    const interval = setInterval(() => {
      setCookies(prev => {
        const newCookies = prev + cookiesPerSecond / 10;
        if (typeof window !== 'undefined') {
          localStorage.setItem(`cookie-clicker-${windowId}`, newCookies.toString());
        }
        return newCookies;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [cookiesPerSecond, windowId]);

  // Save cookies to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`cookie-clicker-${windowId}`, cookies.toString());
      localStorage.setItem(`cookie-upgrades-${windowId}`, JSON.stringify(upgrades));
      localStorage.setItem(`cookie-total-${windowId}`, totalCookies.toString());
    }
  }, [cookies, upgrades, totalCookies, windowId]);

  const handleCookieClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const cookiesEarned = clickPower;
    setCookies(prev => prev + cookiesEarned);
    setTotalCookies(prev => prev + cookiesEarned);
    
    // Cookie animation - scale and rotate (heavy tweak)
    const randomRotation = (Math.random() - 0.5) * 60; // Random rotation between -30 and 30 degrees
    setCookieScale(1.15);
    setCookieRotation(randomRotation);
    setTimeout(() => {
      setCookieScale(1);
      setCookieRotation(0);
    }, 200);
    
    // Floating number
    const id = Date.now();
    setFloatingNumbers(prev => [...prev, { id, value: cookiesEarned, x, y }]);
    setTimeout(() => {
      setFloatingNumbers(prev => prev.filter(n => n.id !== id));
    }, 1000);
  }, [clickPower]);

  const buyUpgrade = (upgradeId: string) => {
    setUpgrades(prev => {
      const upgrade = prev.find(u => u.id === upgradeId);
      if (!upgrade || cookies < upgrade.cost) return prev;
      
      const newCookies = cookies - upgrade.cost;
      setCookies(newCookies);
      
      return prev.map(u => 
        u.id === upgradeId 
          ? { ...u, count: u.count + 1, cost: Math.floor(u.cost * 1.15) }
          : u
      );
    });
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return Math.floor(num).toString();
  };

  return (
    <div 
      className="w-full h-full overflow-auto"
      style={{ 
        background: 'linear-gradient(135deg, #F4EFE7 0%, #FFFDF9 100%)',
        color: 'var(--beige-text)'
      }}
    >
      <div className="flex flex-col items-center p-8 min-h-full">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--beige-text)' }}>
            Cookie Clicker
          </h1>
          <div className="text-2xl font-semibold mb-1" style={{ color: 'var(--beige-text)' }}>
            {formatNumber(cookies)} cookies
          </div>
          {cookiesPerSecond > 0 && (
            <div className="text-sm opacity-70">
              {formatNumber(cookiesPerSecond)} per second
            </div>
          )}
          <div className="text-xs opacity-60 mt-1">
            Total: {formatNumber(totalCookies)} cookies baked
          </div>
        </div>

        {/* Cookie */}
        <div className="relative mb-8">
          <button
            onClick={handleCookieClick}
            className="relative transition-transform duration-200 ease-out active:scale-95 cursor-pointer"
            style={{ transform: `scale(${cookieScale}) rotate(${cookieRotation}deg)` }}
            aria-label="Click cookie"
          >
            <div className="relative">
              <Cookie 
                size={200} 
                className="drop-shadow-lg"
                style={{ color: '#D4A574' }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Sparkles size={60} className="animate-pulse" style={{ color: '#FFD700', opacity: 0.6 }} />
              </div>
            </div>
          </button>
          
          {/* Floating numbers */}
          {floatingNumbers.map(num => (
            <div
              key={num.id}
              className="absolute pointer-events-none font-bold text-2xl animate-bounce"
              style={{
                left: `${num.x}px`,
                top: `${num.y}px`,
                color: '#FF6B6B',
                transform: 'translate(-50%, -50%)',
                animation: 'floatUp 1s ease-out forwards',
              }}
            >
              +{formatNumber(num.value)}
            </div>
          ))}
        </div>

        {/* Upgrades */}
        <div className="w-full max-w-2xl">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--beige-text)' }}>
            Upgrades
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upgrades.map(upgrade => {
              const canAfford = cookies >= upgrade.cost;
              const totalCps = upgrade.cookiesPerSecond * upgrade.count;
              
              return (
                <button
                  key={upgrade.id}
                  onClick={() => buyUpgrade(upgrade.id)}
                  disabled={!canAfford}
                  className={`
                    p-4 rounded-lg border-2 text-left transition-all
                    ${canAfford 
                      ? 'hover:scale-105 hover:shadow-lg cursor-pointer border-amber-300 bg-white/50' 
                      : 'opacity-50 cursor-not-allowed border-gray-300 bg-white/20'
                    }
                  `}
                  style={{
                    background: canAfford ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-lg" style={{ color: 'var(--beige-text)' }}>
                        {upgrade.name}
                      </div>
                      {upgrade.count > 0 && (
                        <div className="text-sm opacity-70">
                          {upgrade.count} owned
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold" style={{ color: canAfford ? '#D4A574' : '#999' }}>
                        {formatNumber(upgrade.cost)} cookies
                      </div>
                      {totalCps > 0 && (
                        <div className="text-xs opacity-70">
                          +{formatNumber(totalCps)}/s
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm opacity-80" style={{ color: 'var(--beige-text)' }}>
                    {upgrade.description}
                  </div>
                  {upgrade.count > 0 && (
                    <div className="mt-2 text-xs opacity-60">
                      Producing {formatNumber(upgrade.cookiesPerSecond)} cookies/sec each
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(0);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(-60px);
          }
        }
      `}} />
    </div>
  );
}

