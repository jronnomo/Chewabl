import request from 'supertest';
import app from '../../app';

export interface TestUser {
  token: string;
  userId: string;
  email: string;
}

let counter = 0;

export async function createTestUser(
  overrides: Partial<{ name: string; email: string; password: string }> = {}
): Promise<TestUser> {
  counter++;
  const email = overrides.email ?? `test${counter}@example.com`;
  const password = overrides.password ?? 'password123';
  const name = overrides.name ?? `Test User ${counter}`;
  const res = await request(app).post('/auth/register').send({ name, email, password });
  if (res.status !== 201) {
    throw new Error(`createTestUser failed: ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, userId: res.body.user.id, email };
}

export const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });
