'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { MediaAsset, Paginated } from '@/lib/types';
import Link from 'next/link';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetsPage() {
  const [data, setData] = useState<Paginated<MediaAsset> | null>(null);
  const [siteId, setSiteId] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!siteId) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/assets?siteId=${siteId}&size=50`);
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
          <h1 className="text-xl font-semibold text-gray-900">Assets</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-3 mb-6">
          <input value={siteId} onChange={e => setSiteId(e.target.value)}
            placeholder="Site ID" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72" />
          <button onClick={load} disabled={loading || !siteId}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            Load
          </button>
        </div>
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {data.items.map(asset => (
              <div key={asset.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {asset.mimeType.startsWith('image/') && asset.cdnUrl ? (
                  <img src={asset.cdnUrl} alt={asset.altText || asset.filename}
                    className="w-full h-28 object-cover bg-gray-100" />
                ) : (
                  <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-2xl">
                    {asset.mimeType.startsWith('video/') ? '🎬' : asset.mimeType === 'application/pdf' ? '📄' : '📁'}
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{asset.filename}</p>
                  <p className="text-xs text-gray-400">{formatBytes(asset.fileSize)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {data?.items.length === 0 && <p className="text-gray-500 text-sm">No assets found.</p>}
      </main>
    </div>
  );
}
