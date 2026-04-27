'use client';
import Link from 'next/link';
export default function UsersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <p className="text-gray-500">User management — use <code className="bg-gray-100 px-1 rounded">/auth/register</code> API or connect your IdP.</p>
      </main>
    </div>
  );
}
