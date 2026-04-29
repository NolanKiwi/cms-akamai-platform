import { UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="Users"
        description="Identity & access. Local accounts plus future IdP federation."
        breadcrumbs={[
          { label: 'dimi-cms', href: '/dashboard' },
          { label: 'Identity & Access' },
          { label: 'Users' },
        ]}
        actions={
          <Button size="sm" disabled>
            <UserPlus className="h-4 w-4" />
            Invite user
          </Button>
        }
      />

      <div className="px-6 py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              User listing UI is not yet wired. For now, create accounts via{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POST /auth/register</code> or connect your IdP.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
