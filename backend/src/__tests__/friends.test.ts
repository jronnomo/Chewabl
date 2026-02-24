import request from 'supertest';
import app from '../app';
import { connectTestDB, disconnectTestDB, clearDB } from './helpers/db';
import { createTestUser, authHeader } from './helpers/auth';

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearDB(); });

describe('Friend lifecycle', () => {
  it('full flow: send request → Bob sees it with correct requester id → accept → both see each other as friends → delete', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });

    // Alice sends request to Bob
    const sendRes = await request(app)
      .post('/friends/request')
      .set(authHeader(alice.token))
      .send({ userId: bob.userId });
    expect(sendRes.status).toBe(201);
    const friendshipId = sendRes.body._id ?? sendRes.body.id;
    expect(friendshipId).toBeTruthy();

    // Bob sees the request — requester.id must be Alice's id (not Bob's)
    // Regression: .toString() on a populated object returned '[object Object]'
    const requestsRes = await request(app)
      .get('/friends/requests')
      .set(authHeader(bob.token));
    expect(requestsRes.status).toBe(200);
    expect(requestsRes.body.length).toBe(1);
    const incomingRequest = requestsRes.body[0];
    expect(incomingRequest.from).toBeDefined();
    expect(incomingRequest.from.id).toBe(alice.userId);

    // Bob accepts
    const acceptRes = await request(app)
      .put(`/friends/request/${incomingRequest.id ?? incomingRequest._id}`)
      .set(authHeader(bob.token))
      .send({ action: 'accept' });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.status).toBe('accepted');

    // Alice's friend list: exactly 1 friend, id is Bob's id
    // Regression: Mongoose v8 id virtual not serialized → returned undefined
    const aliceFriends = await request(app)
      .get('/friends')
      .set(authHeader(alice.token));
    expect(aliceFriends.status).toBe(200);
    expect(aliceFriends.body.length).toBe(1);
    expect(aliceFriends.body[0].id).toBe(bob.userId);

    // Bob's friend list: exactly 1 friend, id is Alice's id
    const bobFriends = await request(app)
      .get('/friends')
      .set(authHeader(bob.token));
    expect(bobFriends.status).toBe(200);
    expect(bobFriends.body.length).toBe(1);
    expect(bobFriends.body[0].id).toBe(alice.userId);

    // Delete friendship
    const deleteRes = await request(app)
      .delete(`/friends/${friendshipId}`)
      .set(authHeader(alice.token));
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.ok).toBe(true);

    // Both should have empty friend lists
    const aliceFriendsAfter = await request(app)
      .get('/friends')
      .set(authHeader(alice.token));
    expect(aliceFriendsAfter.body.length).toBe(0);
  });

  it('returns 409 on duplicate friend request', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const bob = await createTestUser({ name: 'Bob' });

    await request(app)
      .post('/friends/request')
      .set(authHeader(alice.token))
      .send({ userId: bob.userId });

    const res = await request(app)
      .post('/friends/request')
      .set(authHeader(alice.token))
      .send({ userId: bob.userId });
    expect(res.status).toBe(409);
  });

  it('returns 400 on self-friend request', async () => {
    const alice = await createTestUser({ name: 'Alice' });
    const res = await request(app)
      .post('/friends/request')
      .set(authHeader(alice.token))
      .send({ userId: alice.userId });
    expect(res.status).toBe(400);
  });
});
