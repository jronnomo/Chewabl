import request from 'supertest';
import app from '../app';
import { connectTestDB, disconnectTestDB, clearDB } from './helpers/db';
import { createTestUser, authHeader } from './helpers/auth';
import Notification from '../models/Notification';

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearDB(); });

describe('Notifications', () => {
  it('GET /notifications returns empty list initially', async () => {
    const user = await createTestUser({ name: 'Alice' });
    const res = await request(app)
      .get('/notifications')
      .set(authHeader(user.token));
    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(0);
  });

  it('GET /notifications returns notifications for the authenticated user', async () => {
    const user = await createTestUser({ name: 'Alice' });
    await Notification.create([
      { userId: user.userId, type: 'friend_request', title: 'Test 1', body: 'Body 1', data: {} },
      { userId: user.userId, type: 'friend_accepted', title: 'Test 2', body: 'Body 2', data: {} },
    ]);

    const res = await request(app)
      .get('/notifications')
      .set(authHeader(user.token));
    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBe(2);
    expect(res.body.total).toBe(2);
  });

  it('GET /notifications does NOT return other users notifications', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });
    await Notification.create({ userId: bob.userId, type: 'friend_request', title: 'For Bob', body: 'Body', data: {} });

    const res = await request(app)
      .get('/notifications')
      .set(authHeader(alice.token));
    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBe(0);
  });

  it('GET /notifications?page=1&limit=2 pagination works', async () => {
    const user = await createTestUser({ name: 'Alice' });
    await Notification.create([
      { userId: user.userId, type: 'friend_request', title: 'N1', body: 'B1', data: {} },
      { userId: user.userId, type: 'friend_request', title: 'N2', body: 'B2', data: {} },
      { userId: user.userId, type: 'friend_request', title: 'N3', body: 'B3', data: {} },
    ]);

    const res = await request(app)
      .get('/notifications?page=1&limit=2')
      .set(authHeader(user.token));
    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBe(2);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(2);

    const res2 = await request(app)
      .get('/notifications?page=2&limit=2')
      .set(authHeader(user.token));
    expect(res2.status).toBe(200);
    expect(res2.body.notifications.length).toBe(1);
    expect(res2.body.page).toBe(2);
  });

  it('GET /notifications/unread-count returns correct count', async () => {
    const user = await createTestUser({ name: 'Alice' });
    await Notification.create([
      { userId: user.userId, type: 'friend_request', title: 'N1', body: 'B1', data: {}, read: false },
      { userId: user.userId, type: 'friend_request', title: 'N2', body: 'B2', data: {}, read: true },
      { userId: user.userId, type: 'friend_request', title: 'N3', body: 'B3', data: {}, read: false },
    ]);

    const res = await request(app)
      .get('/notifications/unread-count')
      .set(authHeader(user.token));
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it('PUT /notifications/:id/read marks as read', async () => {
    const user = await createTestUser({ name: 'Alice' });
    const notif = await Notification.create({ userId: user.userId, type: 'friend_request', title: 'Test', body: 'Body', data: {} });

    const res = await request(app)
      .put(`/notifications/${notif.id}/read`)
      .set(authHeader(user.token));
    expect(res.status).toBe(200);
    expect(res.body.read).toBe(true);
  });

  it('PUT /notifications/:id/read returns 404 for other users notification', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });
    const notif = await Notification.create({ userId: bob.userId, type: 'friend_request', title: 'Test', body: 'Body', data: {} });

    const res = await request(app)
      .put(`/notifications/${notif.id}/read`)
      .set(authHeader(alice.token));
    expect(res.status).toBe(404);
  });

  it('PUT /notifications/read-all marks all as read', async () => {
    const user = await createTestUser({ name: 'Alice' });
    await Notification.create([
      { userId: user.userId, type: 'friend_request', title: 'N1', body: 'B1', data: {} },
      { userId: user.userId, type: 'friend_request', title: 'N2', body: 'B2', data: {} },
    ]);

    const res = await request(app)
      .put('/notifications/read-all')
      .set(authHeader(user.token));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.modifiedCount).toBe(2);

    // Verify unread count is now 0
    const countRes = await request(app)
      .get('/notifications/unread-count')
      .set(authHeader(user.token));
    expect(countRes.body.count).toBe(0);
  });

  it('DELETE /notifications/:id deletes notification', async () => {
    const user = await createTestUser({ name: 'Alice' });
    const notif = await Notification.create({ userId: user.userId, type: 'friend_request', title: 'Test', body: 'Body', data: {} });

    const res = await request(app)
      .delete(`/notifications/${notif.id}`)
      .set(authHeader(user.token));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify it's gone
    const listRes = await request(app)
      .get('/notifications')
      .set(authHeader(user.token));
    expect(listRes.body.notifications.length).toBe(0);
  });

  it('DELETE /notifications/:id returns 404 for other users notification', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });
    const notif = await Notification.create({ userId: bob.userId, type: 'friend_request', title: 'Test', body: 'Body', data: {} });

    const res = await request(app)
      .delete(`/notifications/${notif.id}`)
      .set(authHeader(alice.token));
    expect(res.status).toBe(404);
  });
});
