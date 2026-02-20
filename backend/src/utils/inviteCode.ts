import { customAlphabet } from 'nanoid';

const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generate = customAlphabet(alphabet, 8);

export function generateInviteCode(): string {
  return generate();
}
