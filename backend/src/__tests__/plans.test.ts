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

// ─── Group Swipe Tests ──────────────────────────────────────────────────────

const mockRestaurantOptions = [
  { id: 'r1', name: 'Pizza Place', imageUrl: 'http://img/1', address: '1 Main St', cuisine: 'Italian', priceLevel: 2, rating: 4.5, distance: '0.5mi', tags: [], isOpenNow: true, phone: '', hours: '', description: '', photos: [], reviewCount: 10, hasReservation: false, noiseLevel: 'moderate', seating: [], busyLevel: 'moderate' },
  { id: 'r2', name: 'Sushi Bar', imageUrl: 'http://img/2', address: '2 Main St', cuisine: 'Japanese', priceLevel: 3, rating: 4.8, distance: '1mi', tags: [], isOpenNow: true, phone: '', hours: '', description: '', photos: [], reviewCount: 20, hasReservation: false, noiseLevel: 'moderate', seating: [], busyLevel: 'moderate' },
  { id: 'r3', name: 'Taco Shop', imageUrl: 'http://img/3', address: '3 Main St', cuisine: 'Mexican', priceLevel: 1, rating: 4.2, distance: '0.3mi', tags: [], isOpenNow: true, phone: '', hours: '', description: '', photos: [], reviewCount: 5, hasReservation: false, noiseLevel: 'moderate', seating: [], busyLevel: 'moderate' },
];

const groupSwipePlan = {
  type: 'group-swipe' as const,
  title: 'Group Pick',
  cuisine: 'Any',
  budget: '$$',
  status: 'voting',
  restaurantOptions: mockRestaurantOptions,
};

describe('POST /plans/:id/swipe', () => {
  it('group-swipe invitees are auto-accepted', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });

    const createRes = await request(app)
      .post('/plans')
      .set(authHeader(alice.token))
      .send({ ...groupSwipePlan, inviteeIds: [bob.userId] });
    expect(createRes.status).toBe(201);
    expect(createRes.body.restaurantOptions.length).toBe(3);
    expect(createRes.body.invites[0].status).toBe('accepted');
  });

  it('group swipe — both members submit → plan confirmed with winner', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });

    const createRes = await request(app)
      .post('/plans')
      .set(authHeader(alice.token))
      .send({ ...groupSwipePlan, inviteeIds: [bob.userId] });
    const planId = createRes.body.id ?? createRes.body._id;

    // Bob is auto-accepted for group-swipe plans — no RSVP needed

    // Alice swipes — plan stays voting
    const aliceSwipe = await request(app)
      .post(`/plans/${planId}/swipe`)
      .set(authHeader(alice.token))
      .send({ votes: ['r1', 'r2'] });
    expect(aliceSwipe.status).toBe(200);
    expect(aliceSwipe.body.status).toBe('voting');
    expect(aliceSwipe.body.swipesCompleted).toContain(alice.userId);

    // Bob swipes — plan confirmed
    const bobSwipe = await request(app)
      .post(`/plans/${planId}/swipe`)
      .set(authHeader(bob.token))
      .send({ votes: ['r1', 'r3'] });
    expect(bobSwipe.status).toBe(200);
    expect(bobSwipe.body.status).toBe('confirmed');
    // r1 got 2 votes (both), r2 got 1 (alice), r3 got 1 (bob) → r1 wins
    expect(bobSwipe.body.restaurant.id).toBe('r1');
  });

  it('rejects duplicate swipe submission', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });

    // Create group plan with Bob (auto-accepted) so Alice's first swipe doesn't auto-confirm
    const createRes = await request(app)
      .post('/plans')
      .set(authHeader(alice.token))
      .send({ ...groupSwipePlan, inviteeIds: [bob.userId] });
    const planId = createRes.body.id ?? createRes.body._id;

    // First swipe succeeds (plan stays voting because Bob hasn't swiped)
    await request(app)
      .post(`/plans/${planId}/swipe`)
      .set(authHeader(alice.token))
      .send({ votes: ['r1'] });

    // Second swipe rejected
    const res = await request(app)
      .post(`/plans/${planId}/swipe`)
      .set(authHeader(alice.token))
      .send({ votes: ['r2'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already submitted/i);
  });

  it('rejects non-participant', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const carol = await createTestUser({ name: 'Carol' });

    const createRes = await request(app)
      .post('/plans')
      .set(authHeader(alice.token))
      .send(groupSwipePlan);
    const planId = createRes.body.id ?? createRes.body._id;

    const res = await request(app)
      .post(`/plans/${planId}/swipe`)
      .set(authHeader(carol.token))
      .send({ votes: ['r1'] });
    expect(res.status).toBe(403);
  });

  it('rejects invalid restaurant IDs in votes', async () => {
    const alice = await createTestUser({ name: 'Alice' });

    const createRes = await request(app)
      .post('/plans')
      .set(authHeader(alice.token))
      .send(groupSwipePlan);
    const planId = createRes.body.id ?? createRes.body._id;

    const res = await request(app)
      .post(`/plans/${planId}/swipe`)
      .set(authHeader(alice.token))
      .send({ votes: ['r1', 'nonexistent'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not in restaurantOptions/i);
  });

  it('3-person group — stays voting until all swipe', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });
    const carol = await createTestUser({ name: 'Carol' });

    const createRes = await request(app)
      .post('/plans')
      .set(authHeader(alice.token))
      .send({ ...groupSwipePlan, inviteeIds: [bob.userId, carol.userId] });
    const planId = createRes.body.id ?? createRes.body._id;

    // All three are auto-accepted participants
    expect(createRes.body.invites[0].status).toBe('accepted');
    expect(createRes.body.invites[1].status).toBe('accepted');

    // Alice and Bob swipe — plan stays voting (Carol hasn't swiped)
    await request(app).post(`/plans/${planId}/swipe`).set(authHeader(alice.token)).send({ votes: ['r1'] });
    const bobSwipe = await request(app).post(`/plans/${planId}/swipe`).set(authHeader(bob.token)).send({ votes: ['r2'] });
    expect(bobSwipe.body.status).toBe('voting');
    expect(bobSwipe.body.swipesCompleted.length).toBe(2);

    // Carol swipes → all done → confirmed
    const carolSwipe = await request(app).post(`/plans/${planId}/swipe`).set(authHeader(carol.token)).send({ votes: ['r1', 'r3'] });
    expect(carolSwipe.body.status).toBe('confirmed');
    // r1 got 2 votes (Alice + Carol), r2 got 1 (Bob), r3 got 1 (Carol) → r1 wins
    expect(carolSwipe.body.restaurant.id).toBe('r1');
  });
});
