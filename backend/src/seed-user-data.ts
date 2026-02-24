/**
 * Seed script — adds 5 new users, 2 friendships with Alice, and 3 plans with voting data.
 *
 * Run with:  cd backend && npx ts-node src/seed-user-data.ts
 *
 * Users created:
 *   Maya Johnson  (friend of Alice)
 *   Liam Rodriguez (friend of Alice)
 *   Sofia Kim      (findable via Scan Contacts — Kate Bell's phone)
 *   Noah Williams  (findable via Scan Contacts — John Appleseed's phone)
 *   Zara Patel     (findable via Scan Contacts — Anna Haro's phone)
 *
 * Plans:
 *   1. "Taco Tuesday Dinner"  — Maya voted (complete), Liam voted (partial), Alice hasn't voted
 *   2. "Weekend Brunch"       — Maya + Liam finished voting, Alice hasn't voted
 *   3. "Friday Night Out"     — Alice finished voting, Maya + Liam haven't voted
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import User from './models/User';
import Friendship from './models/Friendship';
import Plan from './models/Plan';

dotenv.config();

const NEW_EMAILS = [
  'maya@chewabl.dev',
  'liam@chewabl.dev',
  'sofia@chewabl.dev',
  'noah@chewabl.dev',
  'zara@chewabl.dev',
];

async function seedUserData() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // ── Find Alice (current user) ───────────────────────────────────────────
  const alice = await User.findOne({ email: 'alice@chewabl.dev' });
  if (!alice) throw new Error('Alice not found — run the base seed first (npm run seed)');
  console.log(`Found user: ${alice.name} (${alice._id})`);

  // ── Clean up any previous run of this script ────────────────────────────
  const oldUsers = await User.find({ email: { $in: NEW_EMAILS } }).select('_id');
  const oldIds = oldUsers.map(u => u._id);

  if (oldIds.length > 0) {
    await User.deleteMany({ email: { $in: NEW_EMAILS } });
    await Friendship.deleteMany({
      $or: [{ requester: { $in: oldIds } }, { recipient: { $in: oldIds } }],
    });
    // Delete plans owned by Alice that match our seeded titles
    await Plan.deleteMany({
      ownerId: alice._id,
      title: { $in: ['Taco Tuesday Dinner', 'Weekend Brunch', 'Friday Night Out'] },
    });
    console.log('Cleared previous seed-user-data run');
  }

  // ── Create 5 new users ─────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('seed1234', 10);

  const createdUsers = await User.insertMany([
    {
      name: 'Maya Johnson',
      email: 'maya@chewabl.dev',
      phone: '+15551234567',
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
    },
    {
      name: 'Liam Rodriguez',
      email: 'liam@chewabl.dev',
      phone: '+15559876543',
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
    },
    {
      // Phone matches iOS Simulator contact "Kate Bell" → (555) 564-8583
      name: 'Sofia Kim',
      email: 'sofia@chewabl.dev',
      phone: '+15555648583',
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
    },
    {
      // Phone matches iOS Simulator contact "John Appleseed" → (888) 555-5512
      name: 'Noah Williams',
      email: 'noah@chewabl.dev',
      phone: '+18885555512',
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
    },
    {
      // Phone matches iOS Simulator contact "Anna Haro" → (555) 522-8243
      name: 'Zara Patel',
      email: 'zara@chewabl.dev',
      phone: '+15555228243',
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
    },
  ]);

  const [maya, liam, sofia, noah, zara] = createdUsers;
  console.log('Created 5 users:', createdUsers.map(u => `${u.name} (${u.email})`).join(', '));

  // ── Create friendships: Alice ↔ Maya, Alice ↔ Liam (accepted) ──────────
  await Friendship.insertMany([
    { requester: alice._id, recipient: maya._id, status: 'accepted' },
    { requester: alice._id, recipient: liam._id, status: 'accepted' },
  ]);
  console.log('Created 2 accepted friendships (Alice ↔ Maya, Alice ↔ Liam)');

  // ── Create 3 plans with voting data ─────────────────────────────────────
  // Restaurant option IDs (mock — these represent restaurant choices in the plan)
  const options = ['rest_tacos_supreme', 'rest_sushi_heaven', 'rest_pizza_palace', 'rest_thai_garden', 'rest_burger_barn'];

  const aliceId = alice._id.toString();
  const mayaId = maya._id.toString();
  const liamId = liam._id.toString();

  // Plan 1: Maya completed voting, Liam partially voted, Alice hasn't voted
  const plan1Votes = new Map<string, string[]>();
  plan1Votes.set(mayaId, ['rest_tacos_supreme', 'rest_sushi_heaven', 'rest_thai_garden']); // completed: voted on all, liked 3
  plan1Votes.set(liamId, ['rest_pizza_palace']);                                            // partial: only voted on some

  // Plan 2: Both Maya and Liam finished voting, Alice hasn't
  const plan2Votes = new Map<string, string[]>();
  plan2Votes.set(mayaId, ['rest_sushi_heaven', 'rest_thai_garden', 'rest_pizza_palace']);
  plan2Votes.set(liamId, ['rest_tacos_supreme', 'rest_thai_garden', 'rest_burger_barn']);

  // Plan 3: Alice completed voting, Maya and Liam haven't
  const plan3Votes = new Map<string, string[]>();
  plan3Votes.set(aliceId, ['rest_sushi_heaven', 'rest_thai_garden']);

  await Plan.insertMany([
    {
      title: 'Taco Tuesday Dinner',
      date: '2026-03-03',
      time: '7:00 PM',
      ownerId: alice._id,
      status: 'voting',
      cuisine: 'Mexican',
      budget: '$$',
      invites: [
        { userId: maya._id, name: maya.name, status: 'accepted' },
        { userId: liam._id, name: liam.name, status: 'accepted' },
      ],
      options,
      votes: plan1Votes,
    },
    {
      title: 'Weekend Brunch',
      date: '2026-03-07',
      time: '11:00 AM',
      ownerId: alice._id,
      status: 'voting',
      cuisine: 'American',
      budget: '$$$',
      invites: [
        { userId: maya._id, name: maya.name, status: 'accepted' },
        { userId: liam._id, name: liam.name, status: 'accepted' },
      ],
      options,
      votes: plan2Votes,
    },
    {
      title: 'Friday Night Out',
      date: '2026-03-13',
      time: '8:00 PM',
      ownerId: alice._id,
      status: 'voting',
      cuisine: 'Japanese',
      budget: '$$$',
      invites: [
        { userId: maya._id, name: maya.name, status: 'accepted' },
        { userId: liam._id, name: liam.name, status: 'accepted' },
      ],
      options,
      votes: plan3Votes,
    },
  ]);

  console.log('Created 3 plans with voting data');

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n--- Seed Complete ---');
  console.log('Friends (visible on Friends tab):');
  console.log(`  - Maya Johnson (${maya.email})`);
  console.log(`  - Liam Rodriguez (${liam.email})`);
  console.log('Contacts (findable via Scan Contacts on Add tab):');
  console.log(`  - Sofia Kim (${sofia.email}) — matches Kate Bell's phone`);
  console.log(`  - Noah Williams (${noah.email}) — matches John Appleseed's phone`);
  console.log(`  - Zara Patel (${zara.email}) — matches Anna Haro's phone`);
  console.log('Plans (all upcoming, voting status):');
  console.log('  1. Taco Tuesday Dinner — Maya: voted, Liam: partial, Alice: not yet');
  console.log('  2. Weekend Brunch — Maya: voted, Liam: voted, Alice: not yet');
  console.log('  3. Friday Night Out — Alice: voted, Maya: not yet, Liam: not yet');
  console.log('');

  await mongoose.disconnect();
}

seedUserData().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
