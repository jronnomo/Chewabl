/**
 * Full database reset + comprehensive seed data for Chewabl.
 *
 * Run with:  cd backend && npx ts-node src/seed-reset.ts
 *
 * This script DROPS all users, friendships, and plans, then recreates
 * everything from scratch with comprehensive test data covering all
 * important edge cases.
 *
 * ─── Sign-in credentials ─────────────────────────────────────────
 *   alice@chewabl.dev / seed1234   ← primary test account
 *   (all users share password: seed1234)
 *
 * ─── Users (8) ───────────────────────────────────────────────────
 *   Alice Chen       → main user (sign in as this user)
 *   Maya Johnson     → accepted friend
 *   Liam Rodriguez   → accepted friend
 *   Sofia Kim        → pending incoming request (Sofia → Alice)
 *   Noah Williams    → pending outgoing request (Alice → Noah)
 *   Zara Patel       → findable via Scan Contacts (Anna Haro's phone)
 *   Marcus Lee       → findable via Scan Contacts (Daniel Higgins' phone)
 *   Olivia Brown     → no connection, not findable via contacts
 *
 * ─── Friendships ─────────────────────────────────────────────────
 *   Alice ↔ Maya       (accepted)
 *   Alice ↔ Liam       (accepted)
 *   Sofia → Alice      (pending — shows on Alice's Requests tab as incoming)
 *   Alice → Noah       (pending — shows on Alice's Requests tab as sent)
 *   Maya  ↔ Liam       (accepted — they're friends with each other too)
 *
 * ─── Plans (9) ───────────────────────────────────────────────────
 *   1. Taco Tuesday       │ voting    │ upcoming │ Alice owns │ Maya voted, Liam partial, Alice not yet
 *   2. Weekend Brunch      │ voting    │ upcoming │ Alice owns │ Maya+Liam voted, Alice not yet
 *   3. Friday Night Out    │ voting    │ upcoming │ Alice owns │ Alice voted, Maya+Liam not yet
 *   4. Team Lunch          │ voting    │ upcoming │ Maya owns  │ Alice accepted, Liam pending invite
 *   5. Sushi Saturday      │ confirmed │ upcoming │ Alice owns │ all voted, plan confirmed
 *   6. Birthday Dinner     │ completed │ past     │ Liam owns  │ all voted, completed
 *   7. Cancelled Meetup    │ cancelled │ past     │ Alice owns │ Maya declined, Liam accepted
 *   8. Group Pick: Thai Garden  │ group-swipe │ confirmed │ Alice owns │ no date/time, Maya+Liam
 *   9. Group Pick: Burger Barn  │ group-swipe │ confirmed │ Liam owns  │ no date/time, Alice+Maya
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import User from './models/User';
import Friendship from './models/Friendship';
import Plan from './models/Plan';

dotenv.config();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date to "YYYY-MM-DD" */
const fmt = (d: Date) => d.toISOString().split('T')[0];

/** Return a date N days from today */
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

/** Return a date N days in the past */
function daysAgo(n: number): Date {
  return daysFromNow(-n);
}

// ── Restaurant mock IDs (used as plan options & vote targets) ────────────────
const RESTAURANT_OPTIONS = [
  'rest_tacos_supreme',
  'rest_sushi_heaven',
  'rest_pizza_palace',
  'rest_thai_garden',
  'rest_burger_barn',
];


// ── Main seed ────────────────────────────────────────────────────────────────

async function seedReset() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. FULL WIPE — drop every document in users, friendships, plans
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const userCount = await User.countDocuments();
  const friendCount = await Friendship.countDocuments();
  const planCount = await Plan.countDocuments();

  await User.deleteMany({});
  await Friendship.deleteMany({});
  await Plan.deleteMany({});

  console.log(`Cleared: ${userCount} users, ${friendCount} friendships, ${planCount} plans\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. CREATE USERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const passwordHash = await bcrypt.hash('seed1234', 10);

  const users = await User.insertMany([
    {
      name: 'Alice Chen',
      email: 'alice@chewabl.dev',
      phone: '+14155550101',
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
      preferences: {
        name: 'Alice',
        cuisines: ['Japanese', 'Mexican', 'Italian'],
        budget: '$$$',
        dietary: [],
        atmosphere: 'Casual',
        groupSize: '2-4',
        distance: '10',
        isDarkMode: true,
        notificationsEnabled: true,
      },
    },
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
      // Pending incoming request to Alice
      name: 'Sofia Kim',
      email: 'sofia@chewabl.dev',
      phone: '+15555648583', // iOS Sim: Kate Bell (555) 564-8583
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
    },
    {
      // Alice will send outgoing request to Noah
      name: 'Noah Williams',
      email: 'noah@chewabl.dev',
      phone: '+18885555512', // iOS Sim: John Appleseed (888) 555-5512
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
    },
    {
      // Findable via Scan Contacts, no friendship
      name: 'Zara Patel',
      email: 'zara@chewabl.dev',
      phone: '+15555228243', // iOS Sim: Anna Haro (555) 522-8243
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
    },
    {
      // Findable via Scan Contacts, no friendship
      name: 'Marcus Lee',
      email: 'marcus@chewabl.dev',
      phone: '+14085555270', // iOS Sim: Daniel Higgins Jr. (408) 555-5270
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
    },
    {
      // No connection at all, not findable via contacts
      name: 'Olivia Brown',
      email: 'olivia@chewabl.dev',
      phone: '+15550000000',
      passwordHash,
      inviteCode: nanoid(8).toUpperCase(),
      favorites: [],
    },
  ]);

  const [alice, maya, liam, sofia, noah, zara, marcus, olivia] = users;
  console.log('Created 8 users:');
  users.forEach(u => console.log(`  ${u.name.padEnd(18)} ${u.email}`));
  console.log();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. CREATE FRIENDSHIPS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  await Friendship.insertMany([
    // Alice's accepted friends
    { requester: alice._id, recipient: maya._id, status: 'accepted' },
    { requester: liam._id, recipient: alice._id, status: 'accepted' },
    // Maya and Liam are also friends with each other
    { requester: maya._id, recipient: liam._id, status: 'accepted' },
    // Pending incoming: Sofia sent request to Alice (Alice sees this in Requests)
    { requester: sofia._id, recipient: alice._id, status: 'pending' },
    // Pending outgoing: Alice sent request to Noah (Alice sees "Pending" in Requests)
    { requester: alice._id, recipient: noah._id, status: 'pending' },
  ]);

  console.log('Created 5 friendships:');
  console.log('  Alice ↔ Maya       (accepted)');
  console.log('  Alice ↔ Liam       (accepted)');
  console.log('  Maya  ↔ Liam       (accepted)');
  console.log('  Sofia → Alice      (pending incoming)');
  console.log('  Alice → Noah       (pending outgoing)');
  console.log();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. CREATE PLANS — covering all statuses and edge cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const aliceId = alice._id.toString();
  const mayaId = maya._id.toString();
  const liamId = liam._id.toString();

  // ── Plan 1: Taco Tuesday ──────────────────────────────────────────────────
  // Status: voting │ Upcoming │ Alice owns
  // Maya: completed voting (3/5 yes) │ Liam: partial (1/5 yes) │ Alice: hasn't voted
  // Has RSVP deadline (future)
  const plan1Votes = new Map<string, string[]>();
  plan1Votes.set(mayaId, ['rest_tacos_supreme', 'rest_sushi_heaven', 'rest_thai_garden']);
  plan1Votes.set(liamId, ['rest_pizza_palace']);

  // ── Plan 2: Weekend Brunch ────────────────────────────────────────────────
  // Status: voting │ Upcoming │ Alice owns
  // Maya + Liam: both finished voting │ Alice: hasn't voted
  const plan2Votes = new Map<string, string[]>();
  plan2Votes.set(mayaId, ['rest_sushi_heaven', 'rest_thai_garden', 'rest_pizza_palace']);
  plan2Votes.set(liamId, ['rest_tacos_supreme', 'rest_thai_garden', 'rest_burger_barn']);

  // ── Plan 3: Friday Night Out ──────────────────────────────────────────────
  // Status: voting │ Upcoming │ Alice owns
  // Alice: finished voting │ Maya + Liam: haven't voted
  const plan3Votes = new Map<string, string[]>();
  plan3Votes.set(aliceId, ['rest_sushi_heaven', 'rest_thai_garden']);

  // ── Plan 5: Sushi Saturday ────────────────────────────────────────────────
  // Status: confirmed │ Upcoming │ Alice owns │ All voted, plan confirmed
  const plan5Votes = new Map<string, string[]>();
  plan5Votes.set(aliceId, ['rest_sushi_heaven', 'rest_thai_garden']);
  plan5Votes.set(mayaId, ['rest_sushi_heaven', 'rest_pizza_palace']);
  plan5Votes.set(liamId, ['rest_sushi_heaven', 'rest_burger_barn']);

  // ── Plan 6: Birthday Dinner ───────────────────────────────────────────────
  // Status: completed │ Past │ Liam owns │ All voted
  const plan6Votes = new Map<string, string[]>();
  plan6Votes.set(aliceId, ['rest_tacos_supreme', 'rest_sushi_heaven']);
  plan6Votes.set(mayaId, ['rest_sushi_heaven', 'rest_thai_garden']);
  plan6Votes.set(liamId, ['rest_sushi_heaven', 'rest_pizza_palace']);

  await Plan.insertMany([
    // 1. Taco Tuesday — voting, upcoming, Alice owns, mixed votes
    {
      title: 'Taco Tuesday',
      date: fmt(daysFromNow(5)),
      time: '7:00 PM',
      ownerId: alice._id,
      status: 'voting',
      cuisine: 'Mexican',
      budget: '$$',
      invites: [
        { userId: maya._id, name: maya.name, status: 'accepted', respondedAt: daysAgo(2) },
        { userId: liam._id, name: liam.name, status: 'accepted', respondedAt: daysAgo(1) },
      ],
      rsvpDeadline: daysFromNow(3),
      options: RESTAURANT_OPTIONS,
      votes: plan1Votes,
    },
    // 2. Weekend Brunch — voting, upcoming, Alice owns, friends voted, Alice hasn't
    {
      title: 'Weekend Brunch',
      date: fmt(daysFromNow(10)),
      time: '11:00 AM',
      ownerId: alice._id,
      status: 'voting',
      cuisine: 'American',
      budget: '$$$',
      invites: [
        { userId: maya._id, name: maya.name, status: 'accepted', respondedAt: daysAgo(3) },
        { userId: liam._id, name: liam.name, status: 'accepted', respondedAt: daysAgo(2) },
      ],
      options: RESTAURANT_OPTIONS,
      votes: plan2Votes,
    },
    // 3. Friday Night Out — voting, upcoming, Alice owns, Alice voted, friends haven't
    {
      title: 'Friday Night Out',
      date: fmt(daysFromNow(15)),
      time: '8:00 PM',
      ownerId: alice._id,
      status: 'voting',
      cuisine: 'Japanese',
      budget: '$$$',
      invites: [
        { userId: maya._id, name: maya.name, status: 'accepted', respondedAt: daysAgo(1) },
        { userId: liam._id, name: liam.name, status: 'accepted', respondedAt: daysAgo(1) },
      ],
      options: RESTAURANT_OPTIONS,
      votes: plan3Votes,
    },
    // 4. Team Lunch — voting, upcoming, Maya owns (Alice is a guest), Liam pending invite
    {
      title: 'Team Lunch',
      date: fmt(daysFromNow(8)),
      time: '12:30 PM',
      ownerId: maya._id,
      status: 'voting',
      cuisine: 'Korean',
      budget: '$$',
      invites: [
        { userId: alice._id, name: alice.name, status: 'accepted', respondedAt: daysAgo(1) },
        { userId: liam._id, name: liam.name, status: 'pending' },
      ],
      rsvpDeadline: daysFromNow(6),
      options: RESTAURANT_OPTIONS,
      votes: new Map(),
    },
    // 5. Sushi Saturday — confirmed, upcoming, Alice owns, all voted
    {
      title: 'Sushi Saturday',
      date: fmt(daysFromNow(12)),
      time: '6:30 PM',
      ownerId: alice._id,
      status: 'confirmed',
      cuisine: 'Japanese',
      budget: '$$$$',
      invites: [
        { userId: maya._id, name: maya.name, status: 'accepted', respondedAt: daysAgo(5) },
        { userId: liam._id, name: liam.name, status: 'accepted', respondedAt: daysAgo(4) },
      ],
      options: RESTAURANT_OPTIONS,
      votes: plan5Votes,
    },
    // 6. Birthday Dinner — completed, past, Liam owns (Alice invited)
    {
      title: 'Birthday Dinner',
      date: fmt(daysAgo(14)),
      time: '7:00 PM',
      ownerId: liam._id,
      status: 'completed',
      cuisine: 'French',
      budget: '$$$$',
      invites: [
        { userId: alice._id, name: alice.name, status: 'accepted', respondedAt: daysAgo(20) },
        { userId: maya._id, name: maya.name, status: 'accepted', respondedAt: daysAgo(18) },
      ],
      options: RESTAURANT_OPTIONS,
      votes: plan6Votes,
    },
    // 7. Cancelled Meetup — cancelled, past, Alice owns, mixed invite responses
    {
      title: 'Cancelled Meetup',
      date: fmt(daysAgo(7)),
      time: '5:00 PM',
      ownerId: alice._id,
      status: 'cancelled',
      cuisine: 'Thai',
      budget: '$$',
      invites: [
        { userId: maya._id, name: maya.name, status: 'declined', respondedAt: daysAgo(10) },
        { userId: liam._id, name: liam.name, status: 'accepted', respondedAt: daysAgo(9) },
      ],
      options: [],
      votes: new Map(),
    },
    // 8. Group Pick: Thai Garden — group-swipe, confirmed, Alice owns, group result with friends
    {
      type: 'group-swipe',
      title: 'Group Pick: Thai Garden',
      ownerId: alice._id,
      status: 'confirmed',
      cuisine: 'Thai',
      budget: '$$',
      invites: [
        { userId: maya._id, name: maya.name, status: 'accepted', respondedAt: daysAgo(1) },
        { userId: liam._id, name: liam.name, status: 'accepted', respondedAt: daysAgo(1) },
      ],
      options: [],
      votes: new Map(),
    },
    // 9. Group Pick: Burger Barn — group-swipe, confirmed, Liam owns (Alice is invited)
    {
      type: 'group-swipe',
      title: 'Group Pick: Burger Barn',
      ownerId: liam._id,
      status: 'confirmed',
      cuisine: 'American',
      budget: '$',
      invites: [
        { userId: alice._id, name: alice.name, status: 'accepted', respondedAt: daysAgo(1) },
        { userId: maya._id, name: maya.name, status: 'accepted', respondedAt: daysAgo(1) },
      ],
      options: [],
      votes: new Map(),
    },
  ]);

  console.log('Created 9 plans:');
  console.log('  UPCOMING (voting):');
  console.log('    1. Taco Tuesday       — Maya voted, Liam partial, Alice not yet');
  console.log('    2. Weekend Brunch     — Maya+Liam voted, Alice not yet');
  console.log('    3. Friday Night Out   — Alice voted, Maya+Liam not yet');
  console.log('    4. Team Lunch         — Maya owns, Alice guest, Liam pending RSVP');
  console.log('  UPCOMING (confirmed):');
  console.log('    5. Sushi Saturday     — All voted, plan confirmed');
  console.log('  PAST:');
  console.log('    6. Birthday Dinner    — Completed, Liam owns');
  console.log('    7. Cancelled Meetup   — Cancelled, Alice owns');
  console.log('  GROUP SWIPE (confirmed, no date/time):');
  console.log('    8. Group Pick: Thai Garden — group swipe, Alice owns, Maya+Liam');
  console.log('    9. Group Pick: Burger Barn — group swipe, Liam owns, Alice+Maya');
  console.log();

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('━'.repeat(50));
  console.log('  SEED RESET COMPLETE');
  console.log('━'.repeat(50));
  console.log();
  console.log('  Sign in: alice@chewabl.dev / seed1234');
  console.log();
  console.log('  Friends tab:');
  console.log('    Friends:  Maya Johnson, Liam Rodriguez');
  console.log('    Requests: Sofia Kim (incoming), Noah Williams (sent)');
  console.log('    Add:      Zara Patel, Marcus Lee (via Scan Contacts)');
  console.log();
  console.log('  Plans tab:');
  console.log('    Upcoming: Taco Tuesday, Weekend Brunch, Friday Night Out,');
  console.log('              Team Lunch (guest), Sushi Saturday (confirmed),');
  console.log('              Group Pick: Thai Garden (group-swipe),');
  console.log('              Group Pick: Burger Barn (group-swipe, Liam owns)');
  console.log('    Past:     Birthday Dinner (completed), Cancelled Meetup');
  console.log();
  console.log('  Scan Contacts matches (iOS Simulator):');
  console.log('    Sofia Kim    → Kate Bell\'s phone');
  console.log('    Noah Williams → John Appleseed\'s phone');
  console.log('    Zara Patel   → Anna Haro\'s phone');
  console.log('    Marcus Lee   → Daniel Higgins\' phone');
  console.log();

  await mongoose.disconnect();
}

seedReset().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
