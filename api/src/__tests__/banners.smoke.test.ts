/**
 * Smoke floor — image-only "Poster" hero banners: they need their image, keep an
 * empty tap link empty, and come back from the public list like any banner.
 */
import request from 'supertest';
import app from '../index';
import prisma from '../lib/prisma';
import { generateAdminToken } from '../middleware/auth';
import { createFixtures, cleanupFixtures, SmokeFixtures, RUN_ID } from './fixtures';

let fx: SmokeFixtures;
let token: string;
const NAME = `Smoke Poster ${RUN_ID}`;

beforeAll(async () => {
  fx = await createFixtures();
  token = generateAdminToken(fx.adminId, 'smoke_super');
});

afterAll(async () => {
  await prisma.banner.deleteMany({ where: { title: { startsWith: 'Smoke Poster' } } });
  await cleanupFixtures();
  await prisma.$disconnect();
});

const post = (body: Record<string, unknown>) =>
  request(app).post('/api/admin/banners').set('Authorization', `Bearer ${token}`).send(body);

describe('Poster banners', () => {
  let id = '';

  it('refuses a poster without its image', async () => {
    const res = await post({ bannerType: 'POSTER', title: NAME });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image/i);
  });

  it('refuses a poster without a name', async () => {
    const res = await post({ bannerType: 'POSTER', image: '/uploads/poster.webp' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('creates a poster with no link, keeping the link empty', async () => {
    const res = await post({ bannerType: 'POSTER', title: NAME, image: '/uploads/poster.webp', ctaLink: '' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ bannerType: 'POSTER', ctaLink: '', image: '/uploads/poster.webp' });
    id = res.body.data.id;
  });

  it('keeps a tap link when one is given, and refuses removing the image', async () => {
    const ok = await request(app)
      .put(`/api/admin/banners/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bannerType: 'POSTER', ctaLink: '/catalog?category=speakers' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.ctaLink).toBe('/catalog?category=speakers');

    const bad = await request(app)
      .put(`/api/admin/banners/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bannerType: 'POSTER', image: '' });
    expect(bad.status).toBe(400);
  });

  it('appears in the public banner list with its type', async () => {
    const res = await request(app).get('/api/banners');
    const mine = (res.body.data as Array<{ id: string; bannerType: string }>).find((b) => b.id === id);
    expect(mine?.bannerType).toBe('POSTER');
  });

  it('still requires a title for text banners and defaults their link', async () => {
    const res = await post({ bannerType: 'SIMPLE', title: `Smoke Poster text ${RUN_ID}` });
    expect(res.status).toBe(200);
    expect(res.body.data.ctaLink).toBe('/catalog');
  });
});
