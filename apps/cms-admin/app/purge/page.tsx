'use client';

import { useState } from 'react';
import { Tag, Link as LinkIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export default function PurgePage() {
  const [tags, setTags] = useState('');
  const [urls, setUrls] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<'tags' | 'urls' | null>(null);
  const toast = useToast();

  async function run(kind: 'tags' | 'urls') {
    setLoading(kind);
    setResult(null);
    try {
      const items = (kind === 'tags' ? tags : urls)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.post(`/admin/purge/${kind}`, { [kind]: items, reason: 'Manual purge' });
      setResult({ ok: true, data: res.data });
      toast.success(
        `Purge by ${kind} submitted`,
        `${items.length} ${kind === 'tags' ? 'tag(s)' : 'url(s)'} queued`,
      );
    } catch (e: any) {
      setResult({ ok: false, error: e.response?.data?.message || e.message });
      toast.error('Purge failed', e.response?.data?.message || e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Cache Purge"
        description="Invalidate edge cache by cache tag or URL. Submissions are queued for the purge worker."
        breadcrumbs={[
          { label: 'dimi-cms', href: '/dashboard' },
          { label: 'Operations' },
          { label: 'Purge' },
        ]}
      />

      <div className="grid max-w-4xl gap-4 px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Purge by cache tags
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              One tag per line. Examples: <code className="rounded bg-muted px-1 py-0.5">article:uuid</code>,{' '}
              <code className="rounded bg-muted px-1 py-0.5">site:default</code>
            </p>
          </CardHeader>
          <CardContent>
            <textarea
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={() => run('tags')} disabled={loading !== null || !tags.trim()} size="sm">
                {loading === 'tags' ? 'Submitting…' : 'Purge tags'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" />
              Purge by URLs
            </CardTitle>
            <p className="text-xs text-muted-foreground">One URL per line. Full path including scheme.</p>
          </CardHeader>
          <CardContent>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={() => run('urls')} disabled={loading !== null || !urls.trim()} size="sm">
                {loading === 'urls' ? 'Submitting…' : 'Purge URLs'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card
            className={cn(
              'border-l-4',
              result.ok ? 'border-l-success bg-success/5' : 'border-l-destructive bg-destructive/5',
            )}
          >
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                {result.ok ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Submitted
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    Failed
                  </>
                )}
              </div>
              <pre className="overflow-auto rounded-md bg-muted/50 p-3 text-xs text-foreground/80">
                {JSON.stringify(result.data ?? result.error, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
