'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function RedirectsPage() {
  const [siteId, setSiteId] = useState('');
  const [data, setData] = useState<any>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('301');

  async function load() {
    if (!siteId) return;
    const res = await api.get(`/admin/redirects?siteId=${siteId}&size=100`);
    setData(res.data);
  }

  async function create() {
    await api.post('/admin/redirects', { siteId, fromPath: from, toPath: to, statusCode: +status });
    setFrom(''); setTo('');
    load();
  }

  async function remove(id: string) {
    await api.delete(`/admin/redirects/${id}`);
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-semibold text-gray-900">Redirects</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-3 mb-6">
          <input value={siteId} onChange={e => setSiteId(e.target.value)}
            placeholder="Site ID" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72" />
          <button onClick={load} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Load</button>
        </div>

        {siteId && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <h2 className="font-semibold mb-3 text-sm">Add Redirect</h2>
            <div className="flex gap-2 flex-wrap">
              <input value={from} onChange={e => setFrom(e.target.value)} placeholder="/old-path"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-40" />
              <input value={to} onChange={e => setTo(e.target.value)} placeholder="/new-path"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-40" />
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="301">301</option>
                <option value="302">302</option>
                <option value="307">307</option>
                <option value="308">308</option>
              </select>
              <button onClick={create} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Add</button>
            </div>
          </div>
        )}

        {data && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  {['From', 'To', 'Code', 'Active', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{r.fromPath}</td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{r.toPath}</td>
                    <td className="px-4 py-3">{r.statusCode}</td>
                    <td className="px-4 py-3">{r.isActive ? '✓' : '✗'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => remove(r.id)} className="text-red-600 text-xs hover:underline">Delete</button>
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
