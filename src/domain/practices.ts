import { Session } from '../store/types';

const MINUTE = 60_000;

export type PracticeStep = {
  id: string;
  title: string;
  cue: string;
  body: string;
  durationMs: number;
  /** Number of completed sittings at this stage before this practice begins. */
  startsAfter: number;
};

export type PracticePath = {
  steps: readonly PracticeStep[];
  freeAfter: number;
};

/**
 * The opening path is deliberately finite and predictable. A new practice
 * arrives on sittings 1, 2, 4, 6, 8, 10, 12, 14, 16 and 18; the last one gets
 * three sittings so the whole foundation ends exactly at sitting twenty.
 */
export const STAGE_ONE_PATH: PracticePath = {
  freeAfter: 20,
  steps: [
    {
      id: 's1-practice-01',
      title: 'Arrive',
      cue: 'Three slow breaths. Release what can be released.',
      body:
        'Take three slow breaths through the nose, letting each out-breath run a little longer. With each one, soften the face, shoulders, hands and belly. Then leave the breath alone.',
      durationMs: 2 * MINUTE,
      startsAfter: 0,
    },
    {
      id: 's1-practice-02',
      title: 'The whole body',
      cue: 'Feel the whole body breathing.',
      body:
        'Let the belly, chest and shoulders be one field of sensation. Do not hunt for the breath in one precise place yet; notice the whole body being moved by it.',
      durationMs: 3 * MINUTE,
      startsAfter: 1,
    },
    {
      id: 's1-practice-03',
      title: 'Let it breathe',
      cue: 'Let the body set the rhythm and depth.',
      body:
        'The body already knows how to breathe. Let it choose the rhythm and depth while you notice what it does. When you catch yourself managing it, soften and listen again.',
      durationMs: 4 * MINUTE,
      startsAfter: 3,
    },
    {
      id: 's1-practice-04',
      title: 'Return',
      cue: 'Notice. Return without comment.',
      body:
        'When a thought carries attention away, notice that it happened and return to the body breathing. Do not grade how long you were gone. The return is the practice.',
      durationMs: 5 * MINUTE,
      startsAfter: 5,
    },
    {
      id: 's1-practice-05',
      title: 'Count',
      cue: 'Count each out-breath from one to ten.',
      body:
        'At the end of each out-breath, count one, then two, up to ten, and begin again. If the count is lost, return to one without comment.',
      durationMs: 6 * MINUTE,
      startsAfter: 7,
    },
    {
      id: 's1-practice-06',
      title: 'A soft gaze',
      cue: 'Eyes partly open. Gaze soft and lowered.',
      body:
        'Keep the eyes partly open, with the gaze soft and angled down. Let seeing remain in the background while attention stays with the whole body breathing.',
      durationMs: 8 * MINUTE,
      startsAfter: 9,
    },
    {
      id: 's1-practice-07',
      title: 'One breath',
      cue: 'Follow one breath from beginning to end.',
      body:
        'Notice the beginning, middle and end of each in-breath and out-breath, including the quiet turn between them. Curiosity holds attention more gently than force.',
      durationMs: 10 * MINUTE,
      startsAfter: 11,
    },
    {
      id: 's1-practice-08',
      title: 'Balance',
      cue: 'Brighten dullness. Soften agitation.',
      body:
        'If the mind is dull, sit taller and raise the gaze a little. If it is agitated, lower the gaze, soften the belly and let the out-breath lengthen. Make one adjustment, then return to the breath.',
      durationMs: 12 * MINUTE,
      startsAfter: 13,
    },
    {
      id: 's1-practice-09',
      title: 'Let it pass',
      cue: 'Let thoughts arrive and leave without following.',
      body:
        'Thoughts do not need to stop. Let them arrive and leave without going with them. Each time one carries attention away, return to the breath without turning the return into a judgment.',
      durationMs: 15 * MINUTE,
      startsAfter: 15,
    },
    {
      id: 's1-practice-10',
      title: 'Place attention',
      cue: 'Relax. Place attention. Return.',
      body:
        'Begin with relaxation, then let stability and clarity follow. Rest attention with the whole body breathing. When it slips, return; when it strains, soften.',
      durationMs: 20 * MINUTE,
      startsAfter: 17,
    },
  ],
};

export function practicePathForStage(stage: number): PracticePath | null {
  return stage === 1 ? STAGE_ONE_PATH : null;
}

export function sessionsAtStage(sessions: readonly Session[], stage: number): number {
  return sessions.filter((session) => session.stage === stage).length;
}

export function activePractice(
  path: PracticePath,
  completedAtStage: number
): PracticeStep {
  let current = path.steps[0];
  for (const step of path.steps) {
    if (completedAtStage >= step.startsAfter) current = step;
    else break;
  }
  return current;
}

export function isPracticeIntroduction(
  step: PracticeStep,
  completedAtStage: number,
  seenIds: readonly string[]
): boolean {
  return completedAtStage === step.startsAfter && !seenIds.includes(step.id);
}

export function practicePathComplete(path: PracticePath, completedAtStage: number): boolean {
  return completedAtStage >= path.freeAfter;
}

export function practiceById(id: string): PracticeStep | null {
  return STAGE_ONE_PATH.steps.find((step) => step.id === id) ?? null;
}

