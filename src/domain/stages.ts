/**
 * The ten stages of shamatha, after B. Alan Wallace's *The Attention Revolution*.
 *
 * The tips below are original paraphrase — the practice instructions restated in
 * this app's voice — not quotation from the book. They are deliberately plain:
 * Wallace is precise and faintly clinical, and the app should sound the same
 * rather than mystical.
 *
 * Depth is uneven on purpose. Stages 1-4 carry full tip sets because that is
 * where a beginner spends months; 5-10 carry enough to be honest and no more.
 * Writing fifteen tips for stage nine would be inventing depth we have not
 * earned, and the practice-to-stage boundaries in the later stages deserve a
 * careful pass against the book before they are shipped as instruction.
 */

export type Tip = {
  /** Stable across releases — `seenTipIds` in the store references these. */
  id: string;
  body: string;
};

export type Stage = {
  number: number;
  name: string;
  /** The practice this stage works with. Shown above the tip. */
  practice: string;
  /**
   * What this stage actually feels like from the inside. Shown on the
   * advancement card and answered yes/no — the criterion is the state of your
   * mind, not your attendance.
   */
  felt: string;
  /** Pre-selected on the dial. Every other option stays tappable. */
  suggestedMs: number;
  tips: Tip[];
};

const MIN = 60_000;

/**
 * The dial is the same at every stage. Only the pre-selection moves.
 *
 * It starts at two minutes because that is where a beginner actually is, and
 * the steps at the bottom are small because that is where the practice is won
 * or lost — Wallace is explicit that people fail by sitting too long too early.
 * It ends at 24, a ghatika: a sixtieth of a day, and long enough that the top
 * of the dial is a real destination rather than a round number.
 */
export const DURATION_OPTIONS_MS = [2, 3, 5, 10, 15, 24].map((m) => m * MIN);

const BREATH = 'Mindfulness of breathing';
const SETTLING = 'Settling the mind in its natural state';
const AWARENESS = 'Awareness of awareness';

export const STAGES: Stage[] = [
  {
    number: 1,
    name: 'Directed Attention',
    practice: BREATH,
    felt: 'You can place your attention on the breath on purpose, even if it slips away after a few seconds.',
    suggestedMs: 2 * MIN,
    tips: [
      {
        id: 's1-01',
        body: 'Sit so the spine is upright and everything else is loose. Wallace’s order is relaxation first, then stability, then clarity — never the other way round. If you tense up in order to concentrate, the thread is already lost.',
      },
      {
        id: 's1-02',
        body: 'Before you begin, take three slow breaths through the nose, letting each out-breath run longer than the in-breath. It is a signal to the body that nothing is required of it for a while.',
      },
      {
        id: 's1-03',
        body: 'For the first minutes, simply feel the whole body breathing. Don’t hunt for the breath in any one place — the belly, the chest, the shoulders are all the object.',
      },
      {
        id: 's1-04',
        body: 'You are not breathing. You are being breathed. Let the body set the rhythm and the depth entirely on its own; your only task is to notice what it does.',
      },
      {
        id: 's1-05',
        body: 'Losing the breath completely is not failure — at this stage it is simply what happens. The stage is called Directed Attention because you can direct attention, not yet hold it.',
      },
      {
        id: 's1-06',
        body: 'When you find you have been lost in thought, don’t grade yourself. The noticing is the practice working. The grading is just another thought.',
      },
      {
        id: 's1-07',
        body: 'Try counting: at the end of each out-breath, count one, up to ten, then begin again. If you lose the count, start at one without comment.',
      },
      {
        id: 's1-08',
        body: 'Short and frequent beats long and heroic. Two ten-minute sittings you actually do are worth more than one forty-minute sitting you dread.',
      },
      {
        id: 's1-09',
        body: 'Keep the eyes at least partly open, gaze soft and angled down. Closing them fully invites dullness, and dullness is much harder to notice than distraction.',
      },
      {
        id: 's1-10',
        body: 'If you are sleepy: sit taller, raise the gaze, let in more light. If you are agitated: lower the gaze, lengthen the out-breath, soften the belly.',
      },
      {
        id: 's1-11',
        body: 'Let thoughts arrive and leave without going with them. You are not trying to have no thoughts — that is not on offer. You are practising not following them.',
      },
      {
        id: 's1-12',
        body: 'Notice how the very start of an in-breath differs from its end. Curiosity about the object holds attention far better than force does.',
      },
      {
        id: 's1-13',
        body: 'End the session deliberately rather than drifting out of it. Sit for a moment after the bell before you get up.',
      },
      {
        id: 's1-14',
        body: 'If a sitting goes badly, sit again tomorrow anyway. In the early stages it is consistency, not quality, that moves you along.',
      },
      {
        id: 's1-15',
        body: 'The test of this stage is modest: can you put your attention on the breath at all, on purpose, for a few seconds? That is genuinely enough.',
      },
    ],
  },
  {
    number: 2,
    name: 'Continuous Attention',
    practice: BREATH,
    felt: 'You can sometimes stay with the breath for a minute or so before losing it. Wandering is still frequent, but there are now stretches of real continuity.',
    suggestedMs: 5 * MIN,
    tips: [
      {
        id: 's2-01',
        body: 'Narrow the object. Instead of the whole body, rest attention at the abdomen — the rise on the in-breath, the fall on the out-breath.',
      },
      {
        id: 's2-02',
        body: 'This stage means you can occasionally hold the breath in attention for a minute or so. Look for the lengthening, not for perfection.',
      },
      {
        id: 's2-03',
        body: 'Introspection is the faculty that notices you have wandered off. Let it run quietly in the background, like a sentry — not a supervisor.',
      },
      {
        id: 's2-04',
        body: 'Gross excitation is when the mind is pulled away entirely by something more interesting. It is the main obstacle now, and the antidote is not force.',
      },
      {
        id: 's2-05',
        body: 'When you notice the mind has gone, don’t yank it back. Return it the way you would return a sleeping cat to a cushion.',
      },
      {
        id: 's2-06',
        body: 'Keep the body still. Small adjustments — scratching, shifting, resettling — are usually the mind escaping through the body.',
      },
      {
        id: 's2-07',
        body: 'The breath grows subtler as you settle. Don’t deepen it to make it easier to find; follow it as it becomes quiet.',
      },
      {
        id: 's2-08',
        body: 'If counting still helps, keep counting. There is no prize for abandoning a support before you need to.',
      },
      {
        id: 's2-09',
        body: 'Notice the pauses — the small still points at the top of the in-breath and the bottom of the out-breath. Attention rests well there.',
      },
      {
        id: 's2-10',
        body: 'Set an intention at the start of each sitting: what you are here to do, and why. Wallace calls this the power of thinking, and it is what carries you into this stage.',
      },
      {
        id: 's2-11',
        body: 'Restlessness usually arrives disguised as a good reason to stop. Treat “this isn’t working” as one more thought passing through.',
      },
      {
        id: 's2-12',
        body: 'Don’t chase pleasant states. If a sitting feels good, note it and return to the breath — grasping at it is exactly what ends it.',
      },
      {
        id: 's2-13',
        body: 'You may seem to be having more thoughts than before. You are not thinking more. You are noticing more.',
      },
      {
        id: 's2-14',
        body: 'Lengthen your sittings by a few minutes only once the shorter ones feel unforced.',
      },
      {
        id: 's2-15',
        body: 'Ask at the end of a sitting: was the mind more excited today, or more dull? Knowing which tells you what to adjust tomorrow.',
      },
    ],
  },
  {
    number: 3,
    name: 'Resurgent Attention',
    practice: BREATH,
    felt: 'When your mind wanders you notice and return almost at once. Attention holds for most of a session, with only brief lapses.',
    suggestedMs: 10 * MIN,
    tips: [
      {
        id: 's3-01',
        body: 'Refine the object again: attention at the rim of the nostrils, or just above the upper lip, where the air is felt going in and out.',
      },
      {
        id: 's3-02',
        body: 'This stage means attention comes back quickly. You still get lost — the difference is that the return is almost immediate.',
      },
      {
        id: 's3-03',
        body: 'Mindfulness here means holding the object without forgetting it. It is not being present in general; it is remembering this one thing.',
      },
      {
        id: 's3-04',
        body: 'The sensation at the nostrils is faint. Resist the urge to breathe harder in order to make it obvious.',
      },
      {
        id: 's3-05',
        body: 'Subtle excitation begins to show itself: attention stays on the breath while a thought runs quietly underneath it. Notice the undercurrent.',
      },
      {
        id: 's3-06',
        body: 'Relaxation still comes first. Whenever you catch yourself straining, halve the effort and see whether anything is actually lost.',
      },
      {
        id: 's3-07',
        body: 'Keep the length of your sittings steady from day to day. An erratic practice keeps restarting at stage one.',
      },
      {
        id: 's3-08',
        body: 'If the mind is very busy, go back to the whole-body breath for a few minutes before narrowing again. Retreating is a skill, not a defeat.',
      },
      {
        id: 's3-09',
        body: 'Watch for the moment just before you get lost. There is usually a small tug — an invitation. Catching that is the work of this stage.',
      },
      {
        id: 's3-10',
        body: 'Don’t judge a sitting by how it felt. Judge it by whether you noticed and returned.',
      },
      {
        id: 's3-11',
        body: 'Sit at the same time each day if you can. The habit does half the work of concentration for you.',
      },
      {
        id: 's3-12',
        body: 'As the breath quietens you may fear you have lost it. Stay with the faintness rather than reaching for a stronger sensation.',
      },
      {
        id: 's3-13',
        body: 'Thoughts about the practice are still thoughts. “Am I doing this right?” belongs in the same category as “what’s for dinner”.',
      },
      {
        id: 's3-14',
        body: 'A settled sitting and a scattered one both count. Show up for the average, not the peak.',
      },
      {
        id: 's3-15',
        body: 'This is where practice starts to feel like something you do, rather than something you attempt.',
      },
    ],
  },
  {
    number: 4,
    name: 'Close Attention',
    practice: BREATH,
    felt: 'You no longer completely lose the breath during a session. Attention may thin out, but the thread does not break.',
    suggestedMs: 15 * MIN,
    tips: [
      {
        id: 's4-01',
        body: 'At this stage the breath is no longer entirely lost during a sitting. Attention may thin, but the thread holds.',
      },
      {
        id: 's4-02',
        body: 'The new danger is laxity — attention stays on the object but goes slack and dim. It feels peaceful, which is exactly why it is easy to miss.',
      },
      {
        id: 's4-03',
        body: 'Test for laxity by asking whether the object is vivid or merely present. Presence without vividness is the trap of this stage.',
      },
      {
        id: 's4-04',
        body: 'If the mind is dull: sit taller, raise the gaze, and take a real interest in the fine texture of the sensation.',
      },
      {
        id: 's4-05',
        body: 'Vividity is not tension. What you are after is a bright, quiet attention — not a hard one.',
      },
      {
        id: 's4-06',
        body: 'You may now safely lengthen your sittings. The container is strong enough to hold more time.',
      },
      {
        id: 's4-07',
        body: 'Introspection should now check in by itself, without being scheduled. Let it — but don’t let it become a running commentary.',
      },
      {
        id: 's4-08',
        body: 'The contentment of this stage is real, and it is also where people quietly stop. Enjoy it without settling into it.',
      },
      {
        id: 's4-09',
        body: 'Follow the whole arc of a single breath, beginning to end, without narrating it to yourself.',
      },
      {
        id: 's4-10',
        body: 'When effort is needed, apply it briefly and then let go. Continuous effort only produces continuous strain.',
      },
      {
        id: 's4-11',
        body: 'If you are drowsy at your usual hour, change the hour rather than fighting the body.',
      },
      {
        id: 's4-12',
        body: 'Keep the object simple. Elaborating the technique is usually restlessness wearing a disguise.',
      },
      {
        id: 's4-13',
        body: 'The mind will offer genuinely interesting insights mid-session. Note them and let them go — they will still be there afterwards.',
      },
      {
        id: 's4-14',
        body: 'Between sittings, notice how much of the day is spent somewhere other than here. That noticing feeds the practice.',
      },
      {
        id: 's4-15',
        body: 'This is the end of the beginning. What follows asks for subtlety rather than more force.',
      },
    ],
  },
  {
    number: 5,
    name: 'Tamed Attention',
    practice: SETTLING,
    felt: 'Your mind no longer sinks into dullness, and you find you actually look forward to sitting.',
    suggestedMs: 15 * MIN,
    tips: [
      {
        id: 's5-01',
        body: 'Gross laxity is behind you — the mind no longer sinks into fog. What remains is a subtler dimming, and a real satisfaction in the practice itself.',
      },
      {
        id: 's5-02',
        body: 'You can now try settling the mind in its natural state: instead of the breath, observe mental events themselves as they arise and pass.',
      },
      {
        id: 's5-03',
        body: 'In that practice, don’t follow thoughts and don’t push them away. Watch them the way you would watch weather from indoors.',
      },
      {
        id: 's5-04',
        body: 'Delight is the fuel of this stage. Wallace treats enjoyment of practice as something to cultivate deliberately, not a happy accident.',
      },
      {
        id: 's5-05',
        body: 'If observing the mind feels too slippery, go back to the breath for a while. Moving between the two is normal here.',
      },
    ],
  },
  {
    number: 6,
    name: 'Pacified Attention',
    practice: SETTLING,
    felt: 'There is no resistance left to practising. Any remaining dimness is subtle and takes real care to notice.',
    suggestedMs: 24 * MIN,
    tips: [
      {
        id: 's6-01',
        body: 'There is no longer any resistance to sitting. The reluctance that used to come before practice has simply gone.',
      },
      {
        id: 's6-02',
        body: 'Subtle laxity is the target now — a faint slackening of vividness that only careful introspection catches.',
      },
      {
        id: 's6-03',
        body: 'Check the brightness of attention rather than its steadiness. Steadiness is no longer in question.',
      },
      {
        id: 's6-04',
        body: 'Effort is still required, but less of it, and less often.',
      },
      {
        id: 's6-05',
        body: 'Watching the mind, notice that thoughts arise without an author. Don’t conclude anything from it — just keep watching.',
      },
    ],
  },
  {
    number: 7,
    name: 'Fully Pacified Attention',
    practice: AWARENESS,
    felt: 'Distraction and dullness arise only rarely, and you see them coming. Effort is needed mainly at the start of a session.',
    suggestedMs: 24 * MIN,
    tips: [
      {
        id: 's7-01',
        body: 'Subtle excitation and laxity now arise only occasionally, and you see them coming before they take hold.',
      },
      {
        id: 's7-02',
        body: 'Effort is still needed, but mostly at the beginning. Once established, attention largely keeps itself.',
      },
      {
        id: 's7-03',
        body: 'Awareness of awareness becomes possible here — attending not to the breath, and not to thoughts, but to the knowing itself.',
      },
      {
        id: 's7-04',
        body: 'Don’t try to find awareness as an object. Rest in the knowing rather than looking around for it.',
      },
      {
        id: 's7-05',
        body: 'The temptation at this stage is a subtle pride in the practice. Notice it as you would any other movement of mind.',
      },
    ],
  },
  {
    number: 8,
    name: 'Single-Pointed Attention',
    practice: AWARENESS,
    felt: 'Once a session is established it sustains itself, with no further effort needed.',
    suggestedMs: 24 * MIN,
    tips: [
      {
        id: 's8-01',
        body: 'After an initial effort, the whole sitting sustains itself without further intervention.',
      },
      {
        id: 's8-02',
        body: 'Sessions lengthen naturally. Let them, rather than deciding in advance how long to sit.',
      },
      {
        id: 's8-03',
        body: 'Introspection can be very light now. Constant checking would itself be a disturbance.',
      },
      {
        id: 's8-04',
        body: 'Resting in awareness, the sense of a separate observer begins to thin. Don’t force that, and don’t resist it.',
      },
      {
        id: 's8-05',
        body: 'Stability and vividity are both strong. What remains is for effort itself to fall away.',
      },
    ],
  },
  {
    number: 9,
    name: 'Balanced Attention',
    practice: AWARENESS,
    felt: 'Attention requires no effort at all, from the very beginning of a session.',
    suggestedMs: 24 * MIN,
    tips: [
      {
        id: 's9-01',
        body: 'Attention is effortless from the start. No initial application is needed at all.',
      },
      {
        id: 's9-02',
        body: 'The mind is supple — it goes where you place it, and stays without persuasion.',
      },
      {
        id: 's9-03',
        body: 'Long sittings become natural rather than ambitious.',
      },
      {
        id: 's9-04',
        body: 'There is nothing left to correct. The work now is simply familiarity.',
      },
      {
        id: 's9-05',
        body: 'Don’t turn this into a project. The stage completes itself through repetition, not effort.',
      },
    ],
  },
  {
    number: 10,
    name: 'Shamatha',
    practice: AWARENESS,
    felt: 'Attention is effortlessly sustained for hours, with physical and mental pliancy.',
    suggestedMs: 24 * MIN,
    tips: [
      {
        id: 's10-01',
        body: 'Shamatha is not a kind of session. It is a change in the resting state of the mind.',
      },
      {
        id: 's10-02',
        body: 'Attention can be sustained effortlessly for hours, accompanied by physical and mental pliancy.',
      },
      {
        id: 's10-03',
        body: 'Wallace is clear that this asks for sustained full-time practice. Reaching it is not the point of sitting today.',
      },
      {
        id: 's10-04',
        body: 'Whatever stage you are at, the instruction has not really changed: relax, be still, be clear.',
      },
      {
        id: 's10-05',
        body: 'From here shamatha is a foundation rather than a destination — the mind becomes a usable instrument.',
      },
    ],
  },
];

export const FIRST_STAGE = 1;
export const FINAL_STAGE = STAGES.length;

export function stageAt(number: number): Stage {
  const stage = STAGES.find((s) => s.number === number);
  if (!stage) throw new Error(`No stage ${number}`);
  return stage;
}
