'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function WebhooksPage() {
  const [siteId, setSiteId] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');

  async function load() {
    if (!siteId) return;
    const res = await api.get(`/admin/webhooks?siteId=${siteId}`);
    setData(res.data);
  }

  async function create() {
    await api.post('/admin/webhooks', {
      siteId, url, secret,
      events: ['content.published', 'content.unpublished'],
    });
    setUrl(''); setSecret('');
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-semibold text-gray-900">Webhooks</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-3 mb-6">
          <input value={siteId} onChange={e => setSiteId(e.target.value)} placeholder="Site ID"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72" />
          <button onClick={load} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Load</button>
        </div>
        {siteId && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <h2 className="font-semibold mb-3 text-sm">Add Webhook</h2>
            <div className="flex gap-2 flex-wrap">
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/webhook"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-64" />
              <input value={secret} onChange={e => setSecret(e.target.value)} placeholder="Signing secret"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48" />
              <button onClick={create} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Create</button>
            </div>
          </div>
        )}
        {data.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  {['URL', 'Events', 'Active', 'Failures'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((w: any) => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-xs">{w.url}</td>
                    <td className="px-4 py-3 text-xs">{w.events?.join(', ')}</td>
                    <td className="px-4 py-3">{w.isActive ? '✓' : '✗'}</td>
                    <td className="px-4 py-3">{w.failureCount}</td>
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
