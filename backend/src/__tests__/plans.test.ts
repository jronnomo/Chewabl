import request from 'supertest';
import app from '../app';
import { connectTestDB, disconnectTestDB, clearDB } from './helpers/db';
import { createTestUser, authHeader } from './helpers/auth';

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearDB(); });

const basePlan = {
  title: 'Friday Dinner',
  date: '2026-03-01',
  time: '19:00',
  cuisine: 'Italian',
  budget: '$$',
};

describe('POST /plans', () => {
  it('creates plan with no invitees — regression: plan.id defined + saved without friends', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const res = await request(app)
      .post('/plans')
      .set(authHeader(alice.token))
      .send(basePlan);
    expect(res.status).toBe(201);
    // Regression: Mongoose v8 id virtual not serialized
    expect(typeof res.body.id).toBe('string');
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toBe('Friday Dinner');
    expect(Array.isArray(res.body.invites)).toBe(true);
    expect(res.body.invites.length).toBe(0);
  });

  it('creates plan with invitees — invites array has pending entry', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });

    const res = await request(app)
      .post('/plans')
      .set(authHeader(alice.token))
      .send({ ...basePlan, inviteeIds: [bob.userId] });
    expect(res.status).toBe(201);
    expect(res.body.invites.length).toBe(1);
    expect(res.body.invites[0].status).toBe('pending');
    expect(res.body.invites[0].userId).toBe(bob.userId);
  });
});

describe('GET /plans', () => {
  it('user only sees plans they own or are invited to', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });
    const carol = await createTestUser({ name: 'Carol' });

    // Alice creates plan and invites Bob
    await request(app)
      .post('/plans')
      .set(authHeader(alice.token))
      .send({ ...basePlan, inviteeIds: [bob.userId] });

    // Carol creates a private plan (no invites)
    await request(app)
      .post('/plans')
      .set(authHeader(carol.token))
      .send({ ...basePlan, title: 'Carol Private Plan' });

    // Alice sees 1 plan (hers)
    const alicePlans = await request(app)
      .get('/plans')
      .set(authHeader(alice.token));
    expect(alicePlans.status).toBe(200);
    expect(alicePlans.body.length).toBe(1);

    // Bob sees 1 plan (invited to Alice's)
    const bobPlans = await request(app)
      .get('/plans')
      .set(authHeader(bob.token));
    expect(bobPlans.status).toBe(200);
    expect(bobPlans.body.length).toBe(1);

    // Carol sees 1 plan (her own)
    const carolPlans = await request(app)
      .get('/plans')
      .set(authHeader(carol.token));
    expect(carolPlans.status).toBe(200);
    expect(carolPlans.body.length).toBe(1);
    expect(carolPlans.body[0].title).toBe('Carol Private Plan');
  });
});

describe('POST /plans/:id/rsvp', () => {
  it('accept RSVP updates invite status to accepted', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });

    const createRes = await request(app)
      .post('/plans')
      .set(authHeader(alice.token))
      .send({ ...basePlan, inviteeIds: [bob.userId] });
    const planId = createRes.body.id ?? createRes.body._id;

    const rsvpRes = await request(app)
      .post(`/plans/${planId}/rsvp`)
      .set(authHeader(bob.token))
      .send({ action: 'accept' });
    expect(rsvpRes.status).toBe(200);
    expect(rsvpRes.body.status).toBe('accepted');

    // Verify via GET /:id
    const getRes = await request(app)
      .get(`/plans/${planId}`)
      .set(authHeader(alice.token));
    expect(getRes.status).toBe(200);
    const bobInvite = getRes.body.invites.find((i: { userId: string }) => i.userId === bob.userId);
    expect(bobInvite).toBeDefined();
    expect(bobInvite.status).toBe('accepted');
  });

  it('returns 403 when non-invitee tries to RSVP', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });
    const carol = await createTestUser({ name: 'Carol' });

    const createRes = await request(app)
      .post('/plans')
      .set(authHeader(alice.token))
      .send({ ...basePlan, inviteeIds: [bob.userId] });
    const planId = createRes.body.id ?? createRes.body._id;

    const res = await request(app)
      .post(`/plans/${planId}/rsvp`)
      .set(authHeader(carol.token))
      .send({ action: 'accept' });
    expect(res.status).toBe(403);
  });
});
