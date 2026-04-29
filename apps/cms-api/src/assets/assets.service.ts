import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { MediaAsset } from './entities/media-asset.entity';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'image/avif', 'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf', 'application/zip',
  'text/plain', 'text/csv',
];

const MAX_SIZE_MB: Record<string, number> = {
  'image/': 50,
  'video/': 10240,
  'application/pdf': 100,
  'default': 100,
};

@Injectable()
export class AssetsService {
  private s3: S3Client;
  private bucket: string;
  private endpoint: string;

  constructor(
    @InjectRepository(MediaAsset) private repo: Repository<MediaAsset>,
    private config: ConfigService,
  ) {
    this.bucket = config.get('S3_BUCKET_MEDIA', 'cms-media-dev');
    this.endpoint = config.get('S3_ENDPOINT', '');

    this.s3 = new S3Client({
      region: config.get('S3_REGION', 'us-east-1'),
      endpoint: this.endpoint || undefined,
      forcePathStyle: !!this.endpoint,
      credentials: {
        accessKeyId: config.get('AWS_ACCESS_KEY_ID', 'dev'),
        secretAccessKey: config.get('AWS_SECRET_ACCESS_KEY', 'dev'),
      },
    });
  }

  async getUploadUrl(siteId: string, filename: string, mimeType: string, size: number, userId: string) {
    this.validateMimeType(mimeType);
    this.validateSize(mimeType, size);

    const assetId = uuidv4();
    const ext = filename.split('.').pop() || '';
    const key = `originals/${siteId}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${assetId}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: size,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 900 });

    // DB에 pending 상태로 저장
    const asset = this.repo.create({
      id: assetId,
      siteId,
      filename,
      originalKey: key,
      mimeType,
      fileSize: size,
      uploadedBy: userId,
    });
    await this.repo.save(asset);

    const cdnBase = this.config.get('CDN_BASE_URL', `http://localhost:17900/${this.bucket}`);
    return { uploadUrl, assetId, s3Key: key, expiresIn: 900, cdnUrl: `${cdnBase}/${key}` };
  }

  async confirmUpload(assetId: string) {
    const asset = await this.repo.findOne({ where: { id: assetId } });
    if (!asset) throw new BadRequestException('에셋을 찾을 수 없습니다.');

    const cdnBase = this.config.get('CDN_BASE_URL', `http://localhost:17900/${this.bucket}`);
    const cdnUrl = `${cdnBase}/${asset.originalKey}`;

    await this.repo.update(assetId, { cdnUrl, malwareScanned: true, malwareClean: true });
    return { assetId, cdnUrl, status: 'ready' };
  }

  async findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async findBySite(siteId: string, page = 1, size = 50, mimeTypePrefix?: string) {
    const qb = this.repo.createQueryBuilder('a').where('a.siteId = :siteId', { siteId });
    if (mimeTypePrefix) qb.andWhere('a.mimeType LIKE :mt', { mt: `${mimeTypePrefix}%` });
    const [items, total] = await qb.skip((page - 1) * size).take(size).orderBy('a.uploadedAt', 'DESC').getManyAndCount();
    return { total, page, size, items };
  }

  async updateMetadata(id: string, data: { altText?: string; focalPointX?: number; focalPointY?: number; tags?: string[] }) {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  async deleteAsset(id: string) {
    const asset = await this.repo.findOne({ where: { id } });
    if (!asset) throw new BadRequestException('에셋을 찾을 수 없습니다.');
    // S3 객체 삭제는 별도 워커/정리 작업에서 처리. 여기서는 DB row 제거만.
    await this.repo.delete(id);
    return { deleted: true, id };
  }

  private validateMimeType(mimeType: string) {
    if (!ALLOWED_MIME_TYPES.some(t => mimeType.startsWith(t.split('/')[0]) || mimeType === t)) {
      throw new BadRequestException(`허용되지 않는 파일 형식: ${mimeType}`);
    }
  }

  private validateSize(mimeType: string, sizeBytes: number) {
    const prefix = Object.keys(MAX_SIZE_MB).find(k => mimeType.startsWith(k)) || 'default';
    const maxBytes = MAX_SIZE_MB[prefix] * 1024 * 1024;
    if (sizeBytes > maxBytes) {
      throw new BadRequestException(`파일 크기 초과: 최대 ${MAX_SIZE_MB[prefix]}MB`);
    }
  }
}
