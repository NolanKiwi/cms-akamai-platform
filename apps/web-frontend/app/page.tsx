export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">CMS Web Frontend</h1>
        <p className="text-gray-500">Powered by Akamai CDN Platform</p>
        <p className="text-sm text-gray-400 mt-4">
          Serve content at <code>/sites/[siteId]/[...slug]</code>
        </p>
      </div>
    </main>
  );
}
