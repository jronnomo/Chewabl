import Plan from '../models/Plan';
import { createNotification, createNotificationForMany } from '../utils/createNotification';
import { tallyWinner } from '../utils/tallyVotes';

/**
 * Enforce RSVP deadlines for planned events.
 * Called by cron every 5 minutes. Also callable in tests with a fake `asOf` date.
 */
export async function enforceRsvpDeadlines(asOf?: Date): Promise<void> {
  const now = asOf ?? new Date();

  // Step 1: Find planned events past their RSVP deadline that still have pending invites
  const plansWithPending = await Plan.find({
    type: 'planned',
    status: 'voting',
    rsvpDeadline: { $lte: now },
    'invites.status': 'pending',
  });

  for (const plan of plansWithPending) {
    const pendingInvites = plan.invites.filter(i => i.status === 'pending');

    // Auto-decline each pending invite
    for (const invite of pendingInvites) {
      invite.status = 'declined';
      invite.respondedAt = now;

      // Notify the invitee
      await createNotification({
        userId: invite.userId.toString(),
        type: 'rsvp_deadline_passed',
        title: 'RSVP Deadline Passed',
        body: `You didn't respond to "${plan.title}" in time. You've been removed from the plan.`,
        data: { planId: plan.id },
      });

      // Notify the organizer
      await createNotification({
        userId: plan.ownerId.toString(),
        type: 'rsvp_deadline_missed_organizer',
        title: 'RSVP Deadline Missed',
        body: `${invite.name} didn't respond to "${plan.title}" before the deadline.`,
        data: { planId: plan.id },
      });
    }

    await plan.save();
  }

  // Step 2: Open voting for plans past their deadline where votingOpenedAt is not yet set
  const plansToOpenVoting = await Plan.find({
    type: 'planned',
    status: 'voting',
    rsvpDeadline: { $lte: now },
    votingOpenedAt: { $exists: false },
  });

  for (const plan of plansToOpenVoting) {
    plan.votingOpenedAt = now;
    await plan.save();

    // Notify accepted invitees that voting is now open
    const acceptedIds = plan.invites
      .filter(i => i.status === 'accepted')
      .map(i => i.userId.toString());

    // Include the owner
    const notifyIds = [plan.ownerId.toString(), ...acceptedIds];

    if (notifyIds.length > 0) {
      await createNotificationForMany(
        notifyIds,
        'voting_open',
        'Voting is Open!',
        `RSVP deadline passed for "${plan.title}". Time to vote on restaurants!`,
        { planId: plan.id },
      );
    }
  }

  // Also handle plans where votingOpenedAt is null (not just missing)
  const plansToOpenVotingNull = await Plan.find({
    type: 'planned',
    status: 'voting',
    rsvpDeadline: { $lte: now },
    votingOpenedAt: null,
  });

  for (const plan of plansToOpenVotingNull) {
    plan.votingOpenedAt = now;
    await plan.save();

    const acceptedIds = plan.invites
      .filter(i => i.status === 'accepted')
      .map(i => i.userId.toString());
    const notifyIds = [plan.ownerId.toString(), ...acceptedIds];

    if (notifyIds.length > 0) {
      await createNotificationForMany(
        notifyIds,
        'voting_open',
        'Voting is Open!',
        `RSVP deadline passed for "${plan.title}". Time to vote on restaurants!`,
        { planId: plan.id },
      );
    }
  }

  // Step 3: Auto-confirm plans where the event date+time has arrived
  const plansToAutoConfirm = await Plan.find({
    type: 'planned',
    status: 'voting',
    rsvpDeadline: { $lte: now },
  });

  for (const plan of plansToAutoConfirm) {
    if (!plan.date) continue;

    let eventTime: Date;
    if (plan.time) {
      const timeMatch = plan.time.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
      if (timeMatch) {
        let h = parseInt(timeMatch[1], 10);
        const m = parseInt(timeMatch[2], 10);
        const isPM = timeMatch[3].toUpperCase() === 'PM';
        if (isPM && h !== 12) h += 12;
        if (!isPM && h === 12) h = 0;
        const [year, month, day] = plan.date.split('-').map(Number);
        eventTime = new Date(year, month - 1, day, h, m);
      } else {
        eventTime = new Date(plan.date);
      }
    } else {
      eventTime = new Date(plan.date);
    }

    if (eventTime.getTime() <= now.getTime()) {
      const winner = tallyWinner(plan);
      if (winner) {
        plan.restaurant = {
          id: winner.id,
          name: winner.name,
          imageUrl: winner.imageUrl,
          address: winner.address,
          cuisine: winner.cuisine,
          priceLevel: winner.priceLevel,
          rating: winner.rating,
        };
      }
      plan.status = 'confirmed';
      await plan.save();

      // Notify all participants
      const allIds = [
        plan.ownerId.toString(),
        ...plan.invites.filter(i => i.status === 'accepted').map(i => i.userId.toString()),
      ];
      if (allIds.length > 0 && winner) {
        await createNotificationForMany(
          allIds,
          'group_swipe_result',
          'Restaurant Picked!',
          `The group picked ${winner.name} for "${plan.title}"`,
          { planId: plan.id },
        );
      }
    }
  }
}
