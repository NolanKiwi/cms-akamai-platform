import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoAsset, VideoStatus } from './entities/video-asset.entity';

@Injectable()
export class VideoService {
  constructor(@InjectRepository(VideoAsset) private repo: Repository<VideoAsset>) {}

  async create(data: Partial<VideoAsset>): Promise<VideoAsset> {
    return this.repo.save(this.repo.create(data));
  }

  async findById(id: string): Promise<VideoAsset> {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('비디오를 찾을 수 없습니다.');
    return v;
  }

  async findBySite(siteId: string) {
    return this.repo.find({ where: { siteId }, order: { createdAt: 'DESC' } });
  }

  async update(id: string, data: Partial<VideoAsset>): Promise<VideoAsset> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async markReady(id: string, hlsUrl: string, dashUrl?: string, durationMs?: number) {
    return this.update(id, { status: VideoStatus.READY, hlsUrl, dashUrl, durationMs });
  }

  async generateToken(id: string, userId: string): Promise<{ token: string; expiresAt: Date; hlsUrl: string }> {
    const video = await this.findById(id);
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4시간
    const token = `dev-token-${id}-${Date.now()}`; // 개발: 실제는 HMAC
    return { token, expiresAt, hlsUrl: `${video.hlsUrl}?hdntl=${token}` };
  }
}
