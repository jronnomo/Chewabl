import request from 'supertest';
import app from '../app';
import { connectTestDB, disconnectTestDB, clearDB } from './helpers/db';

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearDB(); });

describe('POST /auth/register', () => {
  it('creates a user and returns token + user with defined id', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.user.id).toBe('string');
    expect(res.body.user.id).toBeTruthy();
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('never exposes passwordHash', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('new user has empty favorites', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.favorites).toEqual([]);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate email', async () => {
    const payload = { name: 'Alice', email: 'alice@example.com', password: 'password123' };
    await request(app).post('/auth/register').send(payload);
    const res = await request(app).post('/auth/register').send(payload);
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
  });

  it('returns 200 with token and defined user.id on valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.user.id).toBe('string');
    expect(res.body.user.id).toBeTruthy();
  });

  it('never exposes passwordHash', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown email', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'nobody@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(401);
  });
});
