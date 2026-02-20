import { DiningPlan } from '../types';
import { restaurants } from './restaurants';

const avatars = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
];

export const samplePlans: DiningPlan[] = [
  {
    id: 'p1',
    title: 'Friday Night Dinner',
    date: '2026-02-27',
    time: '7:30 PM',
    restaurant: restaurants[0],
    status: 'confirmed',
    cuisine: 'Italian',
    budget: '$$$',
    invitees: [
      { id: 'u1', name: 'Sarah M.', avatar: avatars[0], hasVoted: true },
      { id: 'u2', name: 'Jake R.', avatar: avatars[1], hasVoted: true },
      { id: 'u3', name: 'Emily K.', avatar: avatars[2], hasVoted: true },
    ],
    options: [restaurants[0], restaurants[4], restaurants[9]],
    votes: { '1': ['u1', 'u2', 'u3'], '5': ['u2'], '10': ['u1'] },
    createdAt: '2026-02-20',
  },
  {
    id: 'p2',
    title: 'Team Lunch',
    date: '2026-02-25',
    time: '12:00 PM',
    status: 'voting',
    cuisine: 'Korean',
    budget: '$$',
    invitees: [
      { id: 'u2', name: 'Jake R.', avatar: avatars[1], hasVoted: true },
      { id: 'u4', name: 'Alex T.', avatar: avatars[3], hasVoted: false },
    ],
    options: [restaurants[5], restaurants[1], restaurants[8]],
    votes: { '6': ['u2'], '2': [], '9': [] },
    createdAt: '2026-02-19',
  },
  {
    id: 'p3',
    title: 'Birthday Dinner',
    date: '2026-02-15',
    time: '8:00 PM',
    restaurant: restaurants[4],
    status: 'completed',
    cuisine: 'French',
    budget: '$$$$',
    invitees: [
      { id: 'u1', name: 'Sarah M.', avatar: avatars[0], hasVoted: true },
      { id: 'u2', name: 'Jake R.', avatar: avatars[1], hasVoted: true },
      { id: 'u3', name: 'Emily K.', avatar: avatars[2], hasVoted: true },
      { id: 'u4', name: 'Alex T.', avatar: avatars[3], hasVoted: true },
    ],
    options: [restaurants[4], restaurants[0], restaurants[9]],
    votes: { '5': ['u1', 'u2', 'u3', 'u4'] },
    createdAt: '2026-02-10',
  },
];
