'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function PurgePage() {
  const [tags, setTags] = useState('');
  const [urls, setUrls] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function purgeTags() {
    setLoading(true);
    try {
      const tagList = tags.split('\n').map(t => t.trim()).filter(Boolean);
      const res = await api.post('/admin/purge/tags', { tags: tagList, reason: 'Manual purge' });
      setResult(res.data);
    } catch (e: any) {
      setResult({ error: e.response?.data?.message || e.message });
    } finally {
      setLoading(false);
    }
  }

  async function purgeUrls() {
    setLoading(true);
    try {
      const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
      const res = await api.post('/admin/purge/urls', { urls: urlList, reason: 'Manual purge' });
      setResult(res.data);
    } catch (e: any) {
      setResult({ error: e.response?.data?.message || e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-semibold text-gray-900">Cache Purge</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold mb-3">Purge by Cache Tags</h2>
          <textarea value={tags} onChange={e => setTags(e.target.value)}
            placeholder="One tag per line (e.g. article:uuid, site:default)"
            rows={5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
          <button onClick={purgeTags} disabled={loading || !tags.trim()}
            className="mt-3 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50">
            Purge Tags
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold mb-3">Purge by URLs</h2>
          <textarea value={urls} onChange={e => setUrls(e.target.value)}
            placeholder="One URL per line"
            rows={5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
          <button onClick={purgeUrls} disabled={loading || !urls.trim()}
            className="mt-3 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50">
            Purge URLs
          </button>
        </div>

        {result && (
          <div className={`rounded-lg border p-4 text-sm ${result.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}
