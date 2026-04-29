'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, CheckCircle2, Rocket, Archive } from 'lucide-react';
import { api } from '@/lib/api';
import type { ContentEntry } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

interface Props {
  entry: ContentEntry;
}

const ALLOW: Record<string, string[]> = {
  draft: ['submit', 'publish'],
  in_review: ['approve', 'publish'],
  scheduled: ['publish', 'archive'],
  published: ['archive'],
  archived: [],
};

export function ContentWorkflowBar({ entry }: Props) {
  const qc = useQueryClient();
  const toast = useToast();

  function makeAction(verb: 'POST' | 'DELETE', path: string, label: string) {
    return useMutation({
      mutationFn: async () => {
        const url = `/admin/content/${entry.contentType}/${entry.id}${path}`;
        const r = verb === 'POST' ? await api.post(url) : await api.delete(url);
        return r.data;
      },
      onSuccess: () => {
        toast.success(`${label} successful`, entry.slug);
        qc.invalidateQueries({ queryKey: ['content-entry', entry.id] });
        qc.invalidateQueries({ queryKey: ['content'] });
      },
      onError: (err: any) =>
        toast.error(`${label} failed`, err.response?.data?.message || err.message),
    });
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const submit = makeAction('POST', '/submit-review', 'Submit for review');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const approve = makeAction('POST', '/approve', 'Approve');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const publish = makeAction('POST', '/publish', 'Publish');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const archive = makeAction('DELETE', '', 'Archive');

  const allowed = ALLOW[entry.status] || [];
  const busy = submit.isPending || approve.isPending || publish.isPending || archive.isPending;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Workflow</span>
        {allowed.includes('submit') && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => submit.mutate()}>
            <Send className="h-3.5 w-3.5" />
            Submit for review
          </Button>
        )}
        {allowed.includes('approve') && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => approve.mutate()}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approve
          </Button>
        )}
        {allowed.includes('publish') && (
          <Button size="sm" disabled={busy} onClick={() => publish.mutate()}>
            <Rocket className="h-3.5 w-3.5" />
            Publish now
          </Button>
        )}
        {allowed.includes('archive') && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => archive.mutate()}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </Button>
        )}
        {allowed.length === 0 && (
          <span className="text-xs text-muted-foreground">No transitions available from {entry.status}.</span>
        )}
      </CardContent>
    </Card>
  );
}
