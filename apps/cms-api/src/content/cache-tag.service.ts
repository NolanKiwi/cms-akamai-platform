import { Injectable } from '@nestjs/common';
import { ContentEntry } from './entities/content-entry.entity';

@Injectable()
export class CacheTagService {
  generate(entry: ContentEntry, fields: Record<string, any> = {}): string[] {
    const tags = new Set<string>();

    // 항상 포함
    tags.add(`${entry.contentType}:${entry.id}`);
    tags.add(`page:${entry.slug}`);
    tags.add(`listing:${entry.contentType}`);
    tags.add(`site:${entry.siteId}`);
    tags.add('sitemap');

    // 참조 엔티티
    if (fields.author?.id) tags.add(`author:${fields.author.id}`);
    if (fields.authorId) tags.add(`author:${fields.authorId}`);

    if (Array.isArray(fields.categories)) {
      fields.categories.forEach((c: string) => tags.add(`category:${c}`));
    }
    if (fields.category) tags.add(`category:${fields.category}`);

    if (fields.template) tags.add(`template:${fields.template}`);

    if (fields.heroImage?.id) tags.add(`asset:${fields.heroImage.id}`);
    if (fields.heroImageId) tags.add(`asset:${fields.heroImageId}`);

    if (Array.isArray(fields.relatedArticles)) {
      fields.relatedArticles.forEach((id: string) => tags.add(`article:${id}`));
    }

    return [...tags];
  }

  buildDependencyGraph(tags: string[]): string[] {
    const allTags = new Set(tags);

    // listing 태그가 있으면 sitemap 추가
    if (tags.some(t => t.startsWith('listing:'))) {
      allTags.add('sitemap');
    }

    return [...allTags];
  }

  formatSurrogateKey(tags: string[]): string {
    return tags.join(' ');
  }

  setSurrogateHeaders(
    res: any,
    tags: string[],
    edgeTtl = 300,
    browserTtl = 0,
    staleIfError = 3600,
  ) {
    res.setHeader('Surrogate-Control',
      `max-age=${edgeTtl}, stale-if-error=${staleIfError}`,
    );
    res.setHeader('Surrogate-Key', this.formatSurrogateKey(tags));
    res.setHeader('Cache-Control',
      browserTtl > 0
        ? `public, max-age=${browserTtl}`
        : 'public, no-cache, must-revalidate',
    );
  }
}
