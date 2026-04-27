'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Stats {
  health?: { status: string };
}

export default function DashboardPage() {
  const [health, setHealth] = useState<string>('loading...');

  useEffect(() => {
    api.get('/health').then(r => setHealth(r.data.status)).catch(() => setHealth('error'));
  }, []);

  const navItems = [
    { href: '/content', label: 'Content', icon: '📄', desc: 'Manage pages, posts, and content entries' },
    { href: '/assets', label: 'Assets', icon: '🖼️', desc: 'Digital asset management' },
    { href: '/purge', label: 'Cache Purge', icon: '🗑️', desc: 'Akamai CDN cache purge' },
    { href: '/redirects', label: 'Redirects', icon: '↪️', desc: 'URL redirect rules' },
    { href: '/webhooks', label: 'Webhooks', icon: '🔗', desc: 'Outbound webhook management' },
    { href: '/users', label: 'Users', icon: '👥', desc: 'User and role management' },
    { href: '/sites', label: 'Sites', icon: '🌐', desc: 'Multi-site management' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-xl font-semibold text-gray-900">CMS Admin Console</h1>
          <span className={`text-xs px-2 py-1 rounded-full ${health === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            API: {health}
          </span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {navItems.map(item => (
            <Link key={item.href} href={item.href}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-400 hover:shadow-sm transition-all group">
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">{item.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
