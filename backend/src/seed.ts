/**
 * Seed script — populates the chewabl database with test users, friendships, and plans.
 * Run with:  npm run seed
 *
 * Idempotent: clears existing seed users (identified by @chewabl.dev emails) before inserting.
 *
 * Test credentials after seeding:
 *   alice@chewabl.dev   / seed1234
 *   bob@chewabl.dev     / seed1234
 *   carol@chewabl.dev   / seed1234
 *   dan@chewabl.dev     / seed1234
 *   eve@chewabl.dev     / seed1234
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import User from './models/User';
import Friendship from './models/Friendship';
import Plan from './models/Plan';

dotenv.config();

const SEED_EMAILS = [
  'alice@chewabl.dev',
  'bob@chewabl.dev',
  'carol@chewabl.dev',
  'dan@chewabl.dev',
  'eve@chewabl.dev',
];

const SEED_PASSWORD = 'seed1234';

const SEED_USERS = [
  { name: 'Alice Chen',   email: 'alice@chewabl.dev', phone: '+14155550101' },
  { name: 'Bob Nguyen',   email: 'bob@chewabl.dev',   phone: '+14155550102' },
  { name: 'Carol Davis',  email: 'carol@chewabl.dev', phone: '+14155550103' },
  { name: 'Dan Park',     email: 'dan@chewabl.dev',   phone: '+14155550104' },
  { name: 'Eve Torres',   email: 'eve@chewabl.dev',   phone: '+14155550105' },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // ── 1. Clear previous seed data ─────────────────────────────────────────
  const oldUsers = await User.find({ email: { $in: SEED_EMAILS } }).select('_id');
  const oldIds = oldUsers.map(u => u._id);

  await User.deleteMany({ email: { $in: SEED_EMAILS } });
  await Friendship.deleteMany({
    $or: [{ requester: { $in: oldIds } }, { recipient: { $in: oldIds } }],
  });
  await Plan.deleteMany({ ownerId: { $in: oldIds } });

  console.log('Cleared previous seed data');

  // ── 2. Create users ──────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const createdUsers = await User.insertMany(
    SEED_USERS.map(u => ({
      ...u,
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
    }))
  );

  const [alice, bob, carol, dan, eve] = createdUsers;
  console.log('Created users:', createdUsers.map(u => u.email).join(', '));

  // ── 3. Create friendships (all accepted) ─────────────────────────────────
  const pairs: [mongoose.Document, mongoose.Document][] = [
    [alice, bob],
    [alice, carol],
    [alice, dan],
    [alice, eve],
    [bob, carol],
    [bob, dan],
    [carol, eve],
    [dan, eve],
  ];

  await Friendship.insertMany(
    pairs.map(([a, b]) => ({
      requester: a._id,
      recipient: b._id,
      status: 'accepted',
    }))
  );

  console.log(`Created ${pairs.length} friendships`);

  // ── 4. Create plans ──────────────────────────────────────────────────────
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  await Plan.insertMany([
    {
      title: 'Friday Night Dinner',
      date: fmt(tomorrow),
      time: '7:30 PM',
      ownerId: alice._id,
      status: 'voting',
      cuisine: 'Italian',
      budget: '$$$',
      invites: [
        { userId: bob._id,   name: bob.name,   status: 'accepted' },
        { userId: carol._id, name: carol.name, status: 'pending' },
        { userId: dan._id,   name: dan.name,   status: 'declined' },
      ],
      options: [],
      votes: {},
    },
    {
      title: 'Team Lunch',
      date: fmt(nextWeek),
      time: '12:00 PM',
      ownerId: bob._id,
      status: 'voting',
      cuisine: 'Korean',
      budget: '$$',
      invites: [
        { userId: alice._id, name: alice.name, status: 'accepted' },
        { userId: eve._id,   name: eve.name,   status: 'pending' },
      ],
      options: [],
      votes: {},
    },
    {
      title: 'Birthday Dinner',
      date: fmt(lastWeek),
      time: '8:00 PM',
      ownerId: carol._id,
      status: 'completed',
      cuisine: 'French',
      budget: '$$$$',
      invites: [
        { userId: alice._id, name: alice.name, status: 'accepted' },
        { userId: bob._id,   name: bob.name,   status: 'accepted' },
        { userId: dan._id,   name: dan.name,   status: 'accepted' },
        { userId: eve._id,   name: eve.name,   status: 'accepted' },
      ],
      options: [],
      votes: {},
    },
  ]);

  console.log('Created 3 plans');

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n✓ Seed complete\n');
  console.log('Test credentials (all use password: seed1234)');
  console.log('─'.repeat(40));
  createdUsers.forEach(u => console.log(`  ${u.email}`));
  console.log('─'.repeat(40));
  console.log('Sign in as alice@chewabl.dev to see friends Bob, Carol, Dan, Eve');
  console.log('and plans: Friday Night Dinner, Team Lunch (invited), Birthday Dinner (invited)\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
