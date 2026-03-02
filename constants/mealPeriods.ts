export interface MealPeriod {
  name: string;
  icon: 'coffee' | 'sun' | 'sunset' | 'moon';
  times: string[];
}

export const MEAL_PERIODS: MealPeriod[] = [
  {
    name: 'Morning',
    icon: 'coffee',
    times: [
      '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM',
      '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
    ],
  },
  {
    name: 'Midday',
    icon: 'sun',
    times: [
      '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
      '1:00 PM', '1:30 PM',
    ],
  },
  {
    name: 'Afternoon',
    icon: 'sunset',
    times: [
      '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
      '4:00 PM', '4:30 PM', '5:00 PM',
    ],
  },
  {
    name: 'Evening',
    icon: 'moon',
    times: [
      '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM',
      '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM',
      '9:30 PM', '10:00 PM', '10:30 PM', '11:00 PM',
    ],
  },
];

/**
 * Parses a time string like "7:00 AM" or "12:30 PM" into minutes since midnight.
 * "7:00 AM" -> 420
 * "12:00 PM" -> 720
 * "12:30 PM" -> 750
 * "1:00 PM" -> 780
 */
export function parseTimeToMinutes(time: string): number {
  const match = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hours !== 12) {
    hours += 12;
  } else if (meridiem === 'AM' && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
}
