'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ContentEntry, Paginated } from '@/lib/types';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  archived: 'bg-red-100 text-red-600',
};

export default function ContentPage() {
  const [data, setData] = useState<Paginated<ContentEntry> | null>(null);
  const [siteId, setSiteId] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!siteId) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/content?siteId=${siteId}&size=50`);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-semibold text-gray-900">Content</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-3 mb-6">
          <input value={siteId} onChange={e => setSiteId(e.target.value)}
            placeholder="Site ID" className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs" />
          <button onClick={load} disabled={loading || !siteId}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            Load
          </button>
        </div>
        {data && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">{data.total} entries</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  {['Type', 'Slug', 'Locale', 'Status', 'Updated'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{entry.contentType}</td>
                    <td className="px-4 py-3">{entry.slug}</td>
                    <td className="px-4 py-3 text-gray-500">{entry.locale}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[entry.status] || ''}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(entry.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
