/**
 * Smoke floor — Events & Activities (public feed + admin CRUD).
 * Verifies the public route returns only published events, the admin routes are
 * RBAC-gated, CRUD round-trips against the DB, pasted video URLs are normalised
 * (YouTube → source+thumbnail), publish controls visibility, and P2025 → 404.
 */
import request from 'supertest';
import app from '../index';
import prisma from '../lib/prisma';
import { createFixtures, cleanupFixtures, SmokeFixtures, ADMIN_USERNAME, ADMIN_PASSWORD, RUN_ID } from './fixtures';

let fx: SmokeFixtures;
let adminToken: string;
let createdId: string;
const createdIds: string[] = [];
const TITLE = `Smoke Event ${RUN_ID}`;

beforeAll(async () => {
  fx = await createFixtures();
  const login = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  adminToken = login.body.token;
});

afterAll(async () => {
  await prisma.event.deleteMany({ where: { title: { contains: RUN_ID } } });
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('Events access control', () => {
  it('serves the public events feed (published only)', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('blocks admin events routes without a token', async () => {
    const res = await request(app).get('/api/admin/events');
    expect(res.status).toBe(401);
  });

  it('blocks admin events routes with a dealer-type token', async () => {
    const { generateDealerToken } = await import('../middleware/auth');
    const dealerToken = generateDealerToken('fake-dealer-id', '9000000003');
    const res = await request(app).get('/api/admin/events').set('Authorization', `Bearer ${dealerToken}`);
    expect(res.status).toBe(401);
  });
});

describe('Admin events CRUD', () => {
  it('rejects an event with no title (400)', async () => {
    const res = await request(app)
      .post('/api/admin/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ eventDate: '2026-06-01' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid eventDate (400)', async () => {
    const res = await request(app)
      .post('/api/admin/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: TITLE, eventDate: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  it('creates an event and normalises a YouTube video URL', async () => {
    const res = await request(app)
      .post('/api/admin/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: TITLE,
        description: 'Smoke test event',
        category: 'DEALER_MEETUP',
        eventDate: '2026-06-15',
        location: 'Bengaluru',
        images: ['https://example.com/a.jpg'],
        videos: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }],
        published: false,
        featured: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    createdId = res.body.data.id;
    createdIds.push(createdId);

    const videos = res.body.data.videos as Array<{ source: string; thumbnailUrl: string }>;
    expect(videos[0].source).toBe('youtube');
    expect(videos[0].thumbnailUrl).toContain('img.youtube.com');
  });

  it('hides unpublished events from the public feed', async () => {
    const res = await request(app).get('/api/events?limit=50');
    const found = res.body.data.find((e: { id: string }) => e.id === createdId);
    expect(found).toBeUndefined();
  });

  it('publishes the event (partial PUT) and shows it publicly', async () => {
    const upd = await request(app)
      .put(`/api/admin/events/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(upd.status).toBe(200);
    expect(upd.body.data.published).toBe(true);

    const pub = await request(app).get('/api/events?limit=50');
    const found = pub.body.data.find((e: { id: string }) => e.id === createdId);
    expect(found).toBeTruthy();
  });

  it('updates the title', async () => {
    const res = await request(app)
      .put(`/api/admin/events/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `${TITLE} (renamed)` });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toContain('(renamed)');
  });

  it('reorders via bulk endpoint', async () => {
    const res = await request(app)
      .put('/api/admin/events/reorder/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ id: createdId, displayOrder: 5 }] });
    expect(res.status).toBe(200);
    const inDb = await prisma.event.findUnique({ where: { id: createdId } });
    expect(inDb!.displayOrder).toBe(5);
  });

  it('public feed order follows displayOrder asc (admin reorder controls the homepage)', async () => {
    // Two published events; the one with the LOWER displayOrder must come first
    // in the public feed regardless of eventDate. Locks in the E-1/E-3 fix:
    // the public order matches the admin reorder controls.
    const mk = (order: number, date: string) =>
      request(app)
        .post('/api/admin/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `${TITLE} order-${order}`, eventDate: date, published: true, displayOrder: order });

    // Higher displayOrder but NEWER date — must still sort AFTER the low-order one.
    const first = await mk(1, '2026-01-01');
    const second = await mk(9, '2026-12-31');
    const firstId = first.body.data.id;
    const secondId = second.body.data.id;
    createdIds.push(firstId, secondId);

    const feed = await request(app).get('/api/events?limit=50');
    const ids: string[] = feed.body.data.map((e: { id: string }) => e.id);
    expect(ids.indexOf(firstId)).toBeLessThan(ids.indexOf(secondId));

    await prisma.event.deleteMany({ where: { id: { in: [firstId, secondId] } } });
  });

  it('deletes the event', async () => {
    const res = await request(app)
      .delete(`/api/admin/events/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('404s when updating a deleted event (P2025 → 404, not 500)', async () => {
    const res = await request(app)
      .put(`/api/admin/events/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'ghost' });
    expect(res.status).toBe(404);
  });

  it('404s when deleting a non-existent event', async () => {
    const res = await request(app)
      .delete(`/api/admin/events/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
