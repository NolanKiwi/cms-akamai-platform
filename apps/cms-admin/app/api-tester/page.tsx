'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Send,
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  Server,
  Cloud,
  ExternalLink,
  Search,
  ShieldAlert,
  Copy,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { AxiosResponse } from 'axios';
import { api, getToken } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { CMS_PRESETS } from './cms-catalog';
import { AKAMAI_PRESETS } from './akamai-catalog';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Target = 'cms' | 'akamai';

interface HistoryEntry {
  id: string;
  target: Target;
  method: Method;
  path: string;
  status: number | 'ERR';
  duration: number;
  bytes: number;
  at: string;
}

interface ResultState {
  ok: boolean;
  status: number | string;
  statusText?: string;
  duration: number;
  headers?: Record<string, string>;
  data?: unknown;
  error?: string;
  dryRun?: boolean;
  // Pre-stringified payload + size, to avoid re-serializing on every render.
  raw?: string;
  bytes?: number;
  itemCount?: number;
}

const LARGE_THRESHOLD = 200_000; // bytes — above this, default to truncated preview
const PREVIEW_BYTES = 50_000; //  initial preview size when full payload is held back

function safeParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!text.trim()) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

const METHOD_COLORS: Record<Method, string> = {
  GET: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  POST: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  PUT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PATCH: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  DELETE: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

function humanBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function buildResult(
  base: Omit<ResultState, 'raw' | 'bytes' | 'itemCount'>,
): ResultState {
  let raw = '';
  let itemCount: number | undefined;
  try {
    if (base.data === undefined) raw = '';
    else if (typeof base.data === 'string') raw = base.data;
    else raw = JSON.stringify(base.data);
  } catch (e) {
    raw = String(base.data);
  }
  if (Array.isArray(base.data)) itemCount = base.data.length;
  else if (base.data && typeof base.data === 'object') {
    // detect common Akamai envelopes with an array body
    for (const k of ['items', 'cpcodes', 'properties', 'groups', 'contracts', 'reports', 'networkLists', 'enrollments', 'streams', 'data']) {
      const v = (base.data as any)[k];
      if (Array.isArray(v)) {
        itemCount = v.length;
        break;
      }
    }
  }
  return { ...base, raw, bytes: raw.length, itemCount };
}

function ResponseBody({ result }: { result: ResultState }) {
  const [showFull, setShowFull] = useState(false);
  const [pretty, setPretty] = useState(true);

  // Reset toggles when response changes
  useEffect(() => {
    setShowFull(false);
    setPretty(true);
  }, [result]);

  const raw = result.raw ?? '';
  const bytes = result.bytes ?? 0;
  const isLarge = bytes > LARGE_THRESHOLD;

  // Lazily compute pretty-printed text, capped to what we will actually render
  // so we don't pay the cost of indenting megabytes of JSON.
  const rendered = useMemo(() => {
    if (!raw) return '';
    if (typeof result.data === 'string') return raw;
    if (isLarge && !showFull) {
      // preview is always plain — truncate the compact form to keep it cheap
      return raw.slice(0, PREVIEW_BYTES);
    }
    if (!pretty) return raw;
    try {
      // re-stringify with indent only for the chunk we'll show
      return JSON.stringify(result.data, null, 2);
    } catch {
      return raw;
    }
  }, [raw, result.data, isLarge, showFull, pretty]);

  function download() {
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(raw);
    } catch {
      /* ignore */
    }
  }

  if (result.data === undefined && !result.error) {
    return <div className="text-xs text-muted-foreground">(empty)</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          Size: <code className="rounded bg-muted px-1 py-0.5">{humanBytes(bytes)}</code>
        </span>
        {typeof result.itemCount === 'number' && (
          <span>
            Items: <code className="rounded bg-muted px-1 py-0.5">{result.itemCount.toLocaleString()}</code>
          </span>
        )}
        {isLarge && (
          <Badge variant="warning" className="gap-1">
            <ShieldAlert className="h-3 w-3" />
            large payload — preview only
          </Badge>
        )}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="outline" onClick={copy}>
            <Copy className="h-3 w-3" />
            Copy
          </Button>
          <Button size="sm" variant="outline" onClick={download}>
            <Download className="h-3 w-3" />
            .json
          </Button>
          {typeof result.data !== 'string' && (
            <Button size="sm" variant="outline" onClick={() => setPretty((p) => !p)} disabled={isLarge && !showFull}>
              {pretty ? 'Compact' : 'Pretty'}
            </Button>
          )}
          {isLarge && (
            <Button size="sm" variant={showFull ? 'destructive' : 'outline'} onClick={() => setShowFull((s) => !s)}>
              {showFull ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showFull ? 'Hide full' : 'Render full (slow)'}
            </Button>
          )}
        </div>
      </div>

      <pre className="max-h-[480px] overflow-auto rounded-md bg-muted/50 p-3 text-xs text-foreground/90">
        {rendered}
        {isLarge && !showFull && rendered.length >= PREVIEW_BYTES && (
          <span className="mt-2 block text-muted-foreground">
            … truncated · {humanBytes(bytes - PREVIEW_BYTES)} remaining. Use Download or Render full.
          </span>
        )}
      </pre>
    </div>
  );
}

export default function ApiTesterPage() {
  const [target, setTarget] = useState<Target>('cms');
  const [method, setMethod] = useState<Method>('GET');
  const [path, setPath] = useState('/health');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('__all__');
  const [akamaiDryRun, setAkamaiDryRun] = useState<boolean | null>(null);

  const baseUrl = useMemo(() => api.defaults.baseURL ?? '', []);
  const tokenPresent = typeof window !== 'undefined' && Boolean(getToken());
  const tokenPreview = useMemo(() => {
    const t = getToken();
    if (!t) return '— no token —';
    return `${t.slice(0, 12)}…${t.slice(-6)} (${t.length} chars)`;
  }, [tokenPresent]);

  // Probe Akamai dry-run state once.
  useEffect(() => {
    let alive = true;
    api
      .get('/admin/akamai/status')
      .then((r) => alive && setAkamaiDryRun(Boolean(r.data?.dryRun)))
      .catch(() => alive && setAkamaiDryRun(null));
    return () => {
      alive = false;
    };
  }, []);

  const presets = target === 'cms' ? CMS_PRESETS : AKAMAI_PRESETS;
  const groups = useMemo(() => Array.from(new Set(presets.map((p) => p.group))), [presets]);

  useEffect(() => {
    setActiveGroup('__all__');
    setFilter('');
  }, [target]);

  const filteredPresets = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return presets.filter((p) => {
      if (activeGroup !== '__all__' && p.group !== activeGroup) return false;
      if (!q) return true;
      return (
        p.label.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q)
      );
    });
  }, [presets, filter, activeGroup]);

  function applyPreset(p: { method: Method; path: string; body?: string }) {
    setMethod(p.method);
    setPath(p.path);
    setBody(p.body ?? '');
    setResult(null);
  }

  function switchTarget(t: Target) {
    setTarget(t);
    setResult(null);
    if (t === 'cms') {
      setMethod('GET');
      setPath('/health');
      setBody('');
    } else {
      setMethod('GET');
      setPath('/papi/v1/contracts');
      setBody('');
    }
  }

  async function send() {
    setLoading(true);
    setResult(null);

    const parsed = safeParse(body);
    if (!parsed.ok) {
      setResult(
        buildResult({ ok: false, status: 'ERR', duration: 0, error: `Invalid JSON body: ${parsed.error}` }),
      );
      setLoading(false);
      return;
    }

    if (path.includes('{') && path.includes('}')) {
      setResult(
        buildResult({
          ok: false,
          status: 'ERR',
          duration: 0,
          error: `Path still contains placeholders: ${path}. Replace {…} segments with real values before sending.`,
        }),
      );
      setLoading(false);
      return;
    }

    const started = performance.now();
    let res: AxiosResponse | undefined;
    let errStatus: number | string = 'ERR';
    let errMsg: string | undefined;
    let errData: unknown;
    let errHeaders: Record<string, string> | undefined;

    try {
      if (target === 'cms') {
        res = await api.request({
          method,
          url: path.startsWith('/') ? path : `/${path}`,
          data: method === 'GET' || method === 'DELETE' ? undefined : parsed.value,
          validateStatus: () => true,
        });
      } else {
        res = await api.request({
          method: 'POST',
          url: '/admin/akamai/proxy',
          data: {
            method,
            path: path.startsWith('/') ? path : `/${path}`,
            body: parsed.value,
          },
          validateStatus: () => true,
        });
      }
    } catch (e: any) {
      errStatus = e.response?.status ?? 'ERR';
      errMsg = e.message;
      errData = e.response?.data;
      errHeaders = e.response?.headers as Record<string, string> | undefined;
    }

    const duration = Math.round(performance.now() - started);
    let next: ResultState;

    if (res) {
      if (target === 'akamai' && res.status === 201 && res.data && typeof res.data === 'object') {
        const env = res.data as {
          dryRun?: boolean;
          status?: number;
          statusText?: string;
          headers?: Record<string, string>;
          data?: unknown;
        };
        const eStatus = typeof env.status === 'number' ? env.status : res.status;
        const ok = eStatus >= 200 && eStatus < 400;
        next = buildResult({
          ok,
          status: eStatus,
          statusText: env.statusText,
          duration,
          headers: env.headers,
          data: env.data,
          dryRun: env.dryRun,
        });
      } else {
        const ok = res.status >= 200 && res.status < 400;
        next = buildResult({
          ok,
          status: res.status,
          statusText: res.statusText,
          duration,
          headers: res.headers as Record<string, string>,
          data: res.data,
        });
      }
    } else {
      next = buildResult({
        ok: false,
        status: errStatus,
        duration,
        error: errMsg,
        data: errData,
        headers: errHeaders,
      });
    }

    setResult(next);
    setHistory((h) =>
      [
        {
          id: crypto.randomUUID(),
          target,
          method,
          path,
          status: (typeof next.status === 'number' ? next.status : 'ERR') as number | 'ERR',
          duration,
          bytes: next.bytes ?? 0,
          at: new Date().toISOString(),
        },
        ...h,
      ].slice(0, 25),
    );

    setLoading(false);
  }

  const supportsBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const isAkamai = target === 'akamai';

  return (
    <>
      <PageHeader
        title="API Tester"
        description="Send authenticated requests to the local CMS API or to Akamai OPEN APIs (EdgeGrid-signed via the admin proxy)."
        breadcrumbs={[
          { label: 'dimi-cms', href: '/dashboard' },
          { label: 'System' },
          { label: 'API Tester' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {isAkamai && akamaiDryRun !== null && (
              <Badge variant={akamaiDryRun ? 'warning' : 'success'} className="gap-1.5">
                <ShieldAlert className="h-3 w-3" />
                Akamai: {akamaiDryRun ? 'dry-run' : 'live creds'}
              </Badge>
            )}
            <Badge variant={tokenPresent ? 'success' : 'destructive'} className="gap-1.5">
              <KeyRound className="h-3 w-3" />
              {tokenPresent ? 'Authenticated' : 'No token'}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm">Request</CardTitle>
                <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
                  <button
                    onClick={() => switchTarget('cms')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium',
                      target === 'cms' ? 'bg-background shadow-sm' : 'text-muted-foreground',
                    )}
                  >
                    <Server className="h-3.5 w-3.5" />
                    CMS
                  </button>
                  <button
                    onClick={() => switchTarget('akamai')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium',
                      target === 'akamai' ? 'bg-background shadow-sm' : 'text-muted-foreground',
                    )}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    Akamai
                  </button>
                </div>
              </div>
              {target === 'cms' ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Base URL: <code className="rounded bg-muted px-1 py-0.5">{baseUrl}</code>
                  {' · '}Bearer: <code className="rounded bg-muted px-1 py-0.5">{tokenPreview}</code>
                </p>
              ) : (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Routed through{' '}
                  <code className="rounded bg-muted px-1 py-0.5">POST {baseUrl}/admin/akamai/proxy</code> · server signs
                  with EdgeGrid v1.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="w-28">
                  <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  className="flex-1 font-mono"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder={isAkamai ? '/papi/v1/contracts' : '/admin/sites'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) send();
                  }}
                />
                <Button onClick={send} disabled={loading || !path.trim()}>
                  {loading ? (
                    'Sending…'
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send
                    </>
                  )}
                </Button>
              </div>

              {path.includes('{') && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  Path contains placeholders: replace {`{…}`} segments before sending.
                </div>
              )}

              {supportsBody && (
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Body (JSON)
                  </label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    placeholder={'{\n  "key": "value"\n}'}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {result && (
            <Card
              className={cn(
                'border-l-4',
                result.ok ? 'border-l-success bg-success/5' : 'border-l-destructive bg-destructive/5',
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                  {result.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  Response
                  <Badge variant={result.ok ? 'success' : 'destructive'}>
                    {String(result.status)}
                    {result.statusText ? ` ${result.statusText}` : ''}
                  </Badge>
                  {result.dryRun && (
                    <Badge variant="warning" className="gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      dry-run
                    </Badge>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {result.duration}ms
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                    {result.error}
                  </div>
                )}

                {result.headers && Object.keys(result.headers).length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer select-none text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Headers ({Object.keys(result.headers).length})
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                      {Object.entries(result.headers)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('\n')}
                    </pre>
                  </details>
                )}

                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Body
                  </div>
                  <ResponseBody result={result} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card className="flex max-h-[calc(100vh-9rem)] min-h-0 flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {target === 'cms' ? 'CMS endpoints' : 'Akamai OPEN API catalog'}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {target === 'cms'
                  ? 'Local routes — bearer token from current session.'
                  : `${AKAMAI_PRESETS.length} endpoints from akamai/akamai-apis. Click to load.`}
              </p>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="space-y-2">
                <Select value={activeGroup} onValueChange={setActiveGroup}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All groups ({groups.length})</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter…"
                    className="pl-8 text-xs"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <ul className="flex flex-col gap-1">
                  {filteredPresets.map((p, i) => (
                    <li key={`${p.method}-${p.path}-${i}`}>
                      <button
                        onClick={() => applyPreset(p)}
                        className="flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs hover:border-border hover:bg-muted"
                      >
                        <span
                          className={cn(
                            'mt-0.5 inline-block w-12 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold',
                            METHOD_COLORS[p.method],
                          )}
                        >
                          {p.method}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.label}</span>
                          <span className="block truncate font-mono text-[10px] text-muted-foreground">
                            {p.path}
                          </span>
                        </span>
                        {'doc' in p && (p as any).doc && (
                          <a
                            href={(p as any).doc}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 text-muted-foreground hover:text-foreground"
                            title="Open Akamai docs"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </button>
                    </li>
                  ))}
                  {filteredPresets.length === 0 && (
                    <li className="px-2 py-3 text-center text-xs text-muted-foreground">No presets match.</li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4" />
                Recent
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No requests yet.</p>
              ) : (
                <ul className="space-y-1">
                  {history.map((h) => (
                    <li key={h.id}>
                      <button
                        onClick={() => {
                          setTarget(h.target);
                          setMethod(h.method);
                          setPath(h.path);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                      >
                        <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
                          {h.target}
                        </Badge>
                        <span
                          className={cn(
                            'inline-block w-12 rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold',
                            METHOD_COLORS[h.method],
                          )}
                        >
                          {h.method}
                        </span>
                        <span className="flex-1 truncate font-mono">{h.path}</span>
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                            typeof h.status === 'number' && h.status >= 200 && h.status < 400
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400',
                          )}
                        >
                          {h.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {h.duration}ms · {humanBytes(h.bytes)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
