export type UserRole = 'admin' | 'developer' | 'publisher' | 'editor' | 'viewer';
export type ContentStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface SiteTheme {
  primary?: string;
  accent?: string;
  background?: string;
  foreground?: string;
  radius?: string;
}

export interface SiteBranding {
  logoUrl?: string;
  faviconUrl?: string;
  tagline?: string;
}

export interface Site {
  id: string;
  name: string;
  slug: string;
  hostname?: string;
  domain?: string;
  description?: string | null;
  locales: string[];
  defaultLocale: string;
  isActive?: boolean;
  theme?: SiteTheme | null;
  branding?: SiteBranding | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentEntry {
  id: string;
  siteId: string;
  contentType: string;
  slug: string;
  locale: string;
  status: ContentStatus;
  publishedAt?: string;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
  currentVersion?: ContentVersion;
}

export interface ContentVersion {
  id: string;
  versionNumber: number;
  title: string;
  fields: Record<string, unknown>;
  cacheTags: string[];
}

export interface PurgeLog {
  id: string;
  status: string;
  scope: string;
  objectCount: number;
  latencyMs?: number;
  submittedAt: string;
  completedAt?: string;
  triggerType: string;
}

export interface MediaAsset {
  id: string;
  siteId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  cdnUrl?: string;
  altText?: string;
  tags: string[];
  uploadedAt: string;
}

export interface Paginated<T> {
  total: number;
  page: number;
  size: number;
  items: T[];
}
