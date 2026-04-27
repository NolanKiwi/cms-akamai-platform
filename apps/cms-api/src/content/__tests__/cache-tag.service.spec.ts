import { CacheTagService } from '../cache-tag.service';
import { ContentEntry, ContentStatus } from '../entities/content-entry.entity';

describe('CacheTagService', () => {
  let service: CacheTagService;
  const mockEntry = (): ContentEntry => ({
    id: 'entry-uuid-123',
    siteId: 'site-uuid-456',
    contentType: 'article',
    slug: 'my-article',
    locale: 'en',
    status: ContentStatus.PUBLISHED,
    version: 1,
    publishedAt: new Date(),
    scheduledAt: null,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => { service = new CacheTagService(); });

  it('항상 기본 태그 4개 포함', () => {
    const tags = service.generate(mockEntry(), {});
    expect(tags).toContain('article:entry-uuid-123');
    expect(tags).toContain('page:my-article');
    expect(tags).toContain('listing:article');
    expect(tags).toContain('site:site-uuid-456');
    expect(tags).toContain('sitemap');
  });

  it('author 참조 시 author 태그 추가', () => {
    const tags = service.generate(mockEntry(), { author: { id: 'author-1' } });
    expect(tags).toContain('author:author-1');
  });

  it('categories 배열 시 각 category 태그 추가', () => {
    const tags = service.generate(mockEntry(), { categories: ['tech', 'news'] });
    expect(tags).toContain('category:tech');
    expect(tags).toContain('category:news');
  });

  it('heroImage 참조 시 asset 태그 추가', () => {
    const tags = service.generate(mockEntry(), { heroImage: { id: 'img-1' } });
    expect(tags).toContain('asset:img-1');
  });

  it('중복 태그 제거', () => {
    const tags = service.generate(mockEntry(), {
      author: { id: 'author-1' },
      categories: ['tech', 'tech'],
    });
    const techCount = tags.filter(t => t === 'category:tech').length;
    expect(techCount).toBe(1);
  });

  it('Surrogate-Key 헤더 형식 검증', () => {
    const tags = ['article:1', 'listing:articles'];
    const key = service.formatSurrogateKey(tags);
    expect(key).toBe('article:1 listing:articles');
  });

  it('buildDependencyGraph - listing 태그 시 sitemap 포함', () => {
    const result = service.buildDependencyGraph(['article:1', 'listing:articles']);
    expect(result).toContain('sitemap');
  });
});
