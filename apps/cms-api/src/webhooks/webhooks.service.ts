import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { createHmac } from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { Webhook, WebhookEvent } from './entities/webhook.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('WebhooksService');

  constructor(
    @InjectRepository(Webhook) private webhookRepo: Repository<Webhook>,
    @InjectRepository(WebhookDelivery) private deliveryRepo: Repository<WebhookDelivery>,
  ) {}

  async createWebhook(siteId: string, url: string, events: WebhookEvent[], secret: string) {
    const webhook = this.webhookRepo.create({ siteId, url, events, secret });
    return this.webhookRepo.save(webhook);
  }

  async updateWebhook(id: string, data: Partial<{ url: string; events: WebhookEvent[]; isActive: boolean }>) {
    await this.webhookRepo.update(id, data);
    return this.webhookRepo.findOne({ where: { id } });
  }

  async deleteWebhook(id: string) {
    await this.webhookRepo.delete(id);
    return { deleted: true };
  }

  async listWebhooks(siteId: string) {
    return this.webhookRepo.find({ where: { siteId } });
  }

  async getDeliveries(webhookId: string, page = 1, size = 50) {
    const [items, total] = await this.deliveryRepo.findAndCount({
      where: { webhookId },
      order: { deliveredAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { total, page, size, items };
  }

  @OnEvent('content.published')
  async onContentPublished(event: any) {
    await this.dispatch(event.entry?.siteId, WebhookEvent.CONTENT_PUBLISHED, event);
  }

  @OnEvent('content.unpublished')
  async onContentUnpublished(event: any) {
    await this.dispatch(event.entry?.siteId, WebhookEvent.CONTENT_UNPUBLISHED, event);
  }

  @OnEvent('asset.uploaded')
  async onAssetUploaded(event: any) {
    await this.dispatch(event.siteId, WebhookEvent.ASSET_UPLOADED, event);
  }

  async dispatch(siteId: string, eventType: WebhookEvent, payload: object) {
    const webhooks = await this.webhookRepo
      .createQueryBuilder('w')
      .addSelect('w.secret')
      .where('w.siteId = :siteId', { siteId })
      .andWhere('w.isActive = true')
      .andWhere(':event = ANY(w.events)', { event: eventType })
      .getMany();

    for (const webhook of webhooks) {
      this.deliverWithRetry(webhook, eventType, payload).catch(() => {});
    }
  }

  private async deliverWithRetry(webhook: Webhook, event: string, payload: object, attempt = 1) {
    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    const sig = createHmac('sha256', webhook.secret).update(body).digest('hex');

    const delivery = this.deliveryRepo.create({
      webhookId: webhook.id, event, payload, attempt,
    });

    try {
      const result = await this.httpPost(webhook.url, body, sig);
      delivery.responseStatus = result.status;
      delivery.responseBody = result.body.slice(0, 1000);
      delivery.success = result.status >= 200 && result.status < 300;
      await this.deliveryRepo.save(delivery);

      if (!delivery.success) {
        await this.webhookRepo.increment({ id: webhook.id }, 'failureCount', 1);
      } else {
        await this.webhookRepo.update({ id: webhook.id }, { failureCount: 0 });
      }
    } catch (err) {
      delivery.responseBody = err.message;
      delivery.success = false;
      await this.deliveryRepo.save(delivery);
      await this.webhookRepo.increment({ id: webhook.id }, 'failureCount', 1);

      if (attempt < 3) {
        const delay = Math.pow(2, attempt) * 1000;
        setTimeout(() => this.deliverWithRetry(webhook, event, payload, attempt + 1), delay);
      }
    }
  }

  private httpPost(targetUrl: string, body: string, signature: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(targetUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-CMS-Signature': `sha256=${signature}`,
          'X-CMS-Event': 'cms-webhook',
        },
        timeout: 10000,
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode!, body: data }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.write(body);
      req.end();
    });
  }
}
