import {
  GRAB_SLOP,
  LIFT_CARRY,
  LIFT_PRESS,
  SHADE,
  SHADE_BLUR,
  SHADE_INSET,
  SPRING,
  Spring,
  armed,
  drawnTravel,
  leaves,
  projected,
  rubber,
  smooth,
  stiffened,
  threshold,
  throwSpeed,
  veilStops,
} from '../carry';

/** The writing card on a common handset: 3:4 at 0.64 of a 411pt screen. */
const CARD = 351;

/** And the reading card at its shortest: a two-line thought and its margins. */
const SHORT = 92;

/** Critical damping, written out here rather than imported, so the two agree by
 *  arithmetic rather than by pointing at the same expression. */
const critical = (spring: Spring) => 2 * Math.sqrt(spring.stiffness * spring.mass);

describe('resistance', () => {
  it('is odd, and always gives back less than it was asked for', () => {
    expect(rubber(0)).toBe(0);
    for (const pull of [0.5, 7, 30, 120, 400, 3000]) {
      expect(rubber(-pull)).toBeCloseTo(-rubber(pull), 12);
      expect(Math.abs(rubber(pull))).toBeLessThan(pull);
    }
  });

  /**
   * The edge felt rather than announced: pulling further always moves the card
   * further, and every further point of pull moves it less than the last one
   * did. Both halves are the point — a curve that only satisfied the first
   * would be a straight line, and one that only satisfied the second could
   * come back on itself.
   */
  it('gives more the further it is pulled, and less for each further point', () => {
    let last = rubber(0);
    let lastGain = Infinity;
    for (let pull = 1; pull <= 600; pull++) {
      const now = rubber(pull);
      expect(now).toBeGreaterThan(last);
      expect(now - last).toBeLessThan(lastGain);
      lastGain = now - last;
      last = now;
    }
  });

  /**
   * And it is bounded by its own dimension, which is what makes the upward pull
   * safe with nothing clamping it: no pull however hard takes the card off the
   * top of the screen.
   */
  it('cannot be pulled past its own dimension however hard it is pulled', () => {
    for (const pull of [1e4, 1e6, 1e9]) {
      expect(rubber(pull, 260)).toBeLessThan(260);
      expect(rubber(pull, CARD)).toBeLessThan(CARD);
    }
  });
});

describe('how far the card is drawn', () => {
  /**
   * Down is exactly free, and "exactly" is the load-bearing word. A carried
   * card that lags the finger by even a little reads as latency rather than as
   * mass, and once it stops being where you put it you stop believing you are
   * holding it.
   */
  it('follows the finger down, point for point', () => {
    for (const dy of [0, 1, 40, 200, 900]) expect(drawnTravel(dy, CARD)).toBe(dy);
  });

  it('resists going up, and never further up than the card is tall', () => {
    for (const dy of [-1, -40, -200, -900, -1e6]) {
      const drawn = drawnTravel(dy, CARD);
      expect(drawn).toBeLessThan(0);
      expect(drawn).toBeGreaterThan(dy);
      expect(Math.abs(drawn)).toBeLessThan(CARD);
    }
  });
});

describe('the distance that lets go', () => {
  it('asks a taller card for more travel', () => {
    expect(threshold(360)).toBeGreaterThan(threshold(200));

    let last = -Infinity;
    for (let height = 0; height <= 1200; height += 4) {
      const now = threshold(height);
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
  });

  /**
   * The floor is the whole reason this is a function. A two-line reader card
   * scaling freely would ask for about eleven points, which is not a gesture —
   * it is a card that comes off in your hand.
   */
  it('still asks a very short card for a real distance', () => {
    expect(SHORT * 0.3).toBeLessThan(32);
    expect(threshold(SHORT)).toBeGreaterThan(40);
    expect(threshold(0)).toBeGreaterThan(40);
  });

  /** And the ceiling is the same argument from the other end, measured against
   *  the shortest screen the app is judged on. */
  it('does not ask a very tall card for a quarter of the shortest screen', () => {
    for (const height of [500, 900, 5000]) expect(threshold(height)).toBeLessThan(667 / 4);
  });
});

describe('the running velocity', () => {
  /**
   * The average has to do two opposite things: survive a flick and swallow a
   * spike. One jittery frame at the release must not throw the card off the
   * screen, and a real throw has to arrive close to intact.
   */
  it('keeps a flick', () => {
    let velocity = 0;
    for (let i = 0; i < 8; i++) velocity = smooth(velocity, 2);
    expect(velocity).toBeGreaterThan(2 * 0.9);
  });

  it('drops a spike, and forgets it as the finger goes still', () => {
    let velocity = smooth(0, 4000);
    expect(velocity).toBeLessThan(4000 * 0.4);
    for (let i = 0; i < 4; i++) velocity = smooth(velocity, 0);
    expect(velocity).toBeLessThan(4000 * 0.1);
  });
});

describe('the throw', () => {
  /**
   * Both halves of one fact, which is why they are one test. A finger that
   * stopped before it lifted has no throw in it whatever the average still
   * says; and what comes out is pixels per **second** from a `PanResponder`
   * velocity in pixels per **millisecond**, because that is the clock
   * `Animated.spring` integrates its `velocity` against. The factor of a
   * thousand is invisible and plausible in either direction.
   */
  it('is nothing from a finger that stopped, and is per second from per millisecond', () => {
    expect(throwSpeed(2, 200)).toBe(0);
    expect(throwSpeed(-3.5, 500)).toBe(0);

    expect(throwSpeed(2, 0)).toBe(2000);
    expect(throwSpeed(2, 60)).toBe(2000);
    expect(throwSpeed(-1.4, 30)).toBeCloseTo(-1400, 9);
  });
});

describe('leaving', () => {
  const far = threshold(CARD);

  it('is one decision made from distance and speed together', () => {
    // Barely moved, but flicked.
    expect(leaves(GRAB_SLOP + 1, 2400, CARD)).toBe(true);
    // Carried past the mark and set down.
    expect(leaves(far + 1, 0, CARD)).toBe(true);
    // Carried halfway and set down.
    expect(leaves(far / 2, 0, CARD)).toBe(false);
  });

  /**
   * The property worth having, and the reason distance and speed are added
   * rather than tested one after the other. Two rules with an `||` between them
   * can be made non-monotone by a tweak to either constant — so that a card
   * thrown *harder* stays — and they do it silently, because each half goes on
   * looking reasonable on its own.
   */
  it('never turns a leave into a stay when there is more of either', () => {
    for (const speed of [-2000, -400, 0, 300, 900, 2500]) {
      let gone = false;
      for (let travel = -300; travel <= 500; travel += 5) {
        const now = leaves(travel, speed, CARD);
        if (gone) expect(now).toBe(true);
        gone = now;
      }
    }

    for (const travel of [-80, 0, 20, 60, 140]) {
      let gone = false;
      for (let speed = -3000; speed <= 3000; speed += 25) {
        const now = leaves(travel, speed, CARD);
        if (gone) expect(now).toBe(true);
        gone = now;
      }
    }
  });

  /** The card is the thing you keep. Nothing here can be finished by pushing it
   *  away from you, however hard. */
  it('cannot be finished by a flick upward', () => {
    for (const dy of [-5, -60, -400, -5000]) {
      for (const speed of [-200, -2000, -20000]) {
        expect(leaves(drawnTravel(dy, CARD), speed, CARD)).toBe(false);
        expect(leaves(drawnTravel(dy, SHORT), speed, SHORT)).toBe(false);
      }
    }
  });

  it('reads a still card exactly where it stands', () => {
    for (const travel of [-40, 0, 33, 210]) expect(projected(travel, 0)).toBe(travel);
  });
});

describe('the latch', () => {
  const far = threshold(CARD);

  it('arms at the mark and lets go a little short of it', () => {
    expect(armed(far - 1, CARD, false)).toBe(false);
    expect(armed(far, CARD, false)).toBe(true);
    expect(armed(far - 1, CARD, true)).toBe(true);
    expect(armed(far / 2, CARD, true)).toBe(false);
  });

  /**
   * One crossing, one tick. A finger resting on the mark crosses it many times
   * a second, and without the gap between arming and disarming every one of
   * those is a tick under the thumb.
   */
  it('does not chatter under a finger held on the mark', () => {
    let was = false;
    let ticks = 0;
    for (const travel of [far - 2, far + 1, far - 2, far + 1, far - 2, far + 1]) {
      const now = armed(travel, CARD, was);
      if (now && !was) ticks++;
      was = now;
    }
    expect(ticks).toBe(1);
  });

  /**
   * The band has to be a real distance on *every* card, not just the tall one.
   *
   * It is a share of the threshold, and the threshold is itself floored — so on
   * a short docked reader, where the floor is doing the work, a share alone
   * leaves a band of about ten points. That is twice `GRAB_SLOP`, the distance
   * this app already calls a hand not meaning anything by it, where the 3:4
   * card gets nearly four times it. A thumb wavering under two millimetres
   * would tick again, and only on that one card — which is exactly the sort of
   * thing that is found in somebody's hand rather than here.
   */
  it('keeps a band worth having on every card, not just the tall one', () => {
    for (let height = 60; height <= 420; height += 10) {
      const mark = threshold(height);
      // The widest wander that must still count as one crossing.
      const wander = GRAB_SLOP * 3;
      let was = false;
      let ticks = 0;
      for (const travel of [mark + 1, mark - wander, mark + 1, mark - wander, mark + 1]) {
        const now = armed(travel, height, was);
        if (now && !was) ticks++;
        was = now;
      }
      expect(ticks).toBe(1);
    }
  });

  it('still lets go, however short the card', () => {
    for (const height of [60, 186, 351, 420]) {
      expect(armed(0, height, true)).toBe(false);
    }
  });
});

describe('the shade', () => {
  /**
   * The invariant that is invisible in a still screenshot and is the commonest
   * way a lifted object reads as a sticker on the picture: a shade that rises
   * gets **lighter** and wider, never darker.
   */
  it('lightens as it spreads and falls', () => {
    for (let i = 1; i < SHADE.length; i++) {
      expect(SHADE[i].at).toBeGreaterThan(SHADE[i - 1].at);
      expect(SHADE[i].opacity).toBeLessThan(SHADE[i - 1].opacity);
      expect(SHADE[i].scale).toBeGreaterThan(SHADE[i - 1].scale);
      expect(SHADE[i].rise).toBeGreaterThan(SHADE[i - 1].rise);
    }
  });

  it('covers the whole lift, and starts where the card is still on the page', () => {
    expect(SHADE[0].at).toBe(0);
    expect(SHADE[SHADE.length - 1].at).toBe(1);
    expect(SHADE[0].scale).toBe(1);
    expect(LIFT_PRESS).toBeGreaterThan(SHADE[0].at);
    expect(LIFT_PRESS).toBeLessThan(LIFT_CARRY);
    expect(LIFT_CARRY).toBe(SHADE[SHADE.length - 1].at);
  });

  /**
   * The resting card casts nothing, and it is the inset that guarantees it
   * rather than a small alpha. A box shadow reaches `blur` past the box drawing
   * it, so a box set further inside the card than that has every point of its
   * shadow under the card, at any ink and on any card. Raise the blur past the
   * inset and the app grows a permanent halo — which nothing else here would
   * catch, because it is correct at every other moment of the lift.
   */
  it('cannot reach past a resting card, whatever it is drawn in', () => {
    expect(SHADE_BLUR).toBeLessThan(SHADE_INSET);
    expect(SHADE[0].rise).toBe(0);
  });

  /**
   * And the lifted shade stays a shadow rather than becoming an outline. Both
   * channels of the lift move the box, and if either takes it past the card's
   * own edge the shadow is clipped away from underneath and reappears as a ring
   * standing off in the paper — see `SHADE_INSET`. The check runs down to a card
   * far shorter than the sheet can draw, because the inset shrinks the box
   * faster than a card loses height and the clearance is therefore worst on the
   * *tallest* card, which is the opposite of the obvious guess.
   */
  it('keeps its box under the card at every height the sheet can draw', () => {
    const last = SHADE[SHADE.length - 1];

    for (let height = 60; height <= 420; height += 4) {
      // Yoga floors a box the inset has eaten at nothing rather than inverting it.
      const half = Math.max(0, height / 2 - SHADE_INSET);
      expect(half * last.scale + last.rise).toBeLessThan(height / 2);
    }
  });
});

describe('the springs', () => {
  it('rings where it says it rings', () => {
    expect(SPRING.SETTLE.damping / critical(SPRING.SETTLE)).toBeLessThan(0.7);
  });

  /**
   * `SHUT` meets a frame and stops dead, so it sits at or past critical. `SNAP`
   * and `GLIDE` arrive without a visible ring and sit a whisker under it — 40
   * against a critical 40.99 for `SNAP`, which is why this is written as a
   * whisker rather than as "at or past".
   */
  it('arrives where it says it arrives', () => {
    expect(SPRING.SHUT.damping).toBeGreaterThanOrEqual(critical(SPRING.SHUT));

    for (const spring of [SPRING.SNAP, SPRING.GLIDE]) {
      const zeta = spring.damping / critical(spring);
      expect(zeta).toBeGreaterThan(0.9);
      expect(zeta).toBeLessThanOrEqual(1);
    }
  });

  /**
   * Reduced motion as a property rather than as a constant: no ringing, but
   * still movement. Every preset comes back stiffer and at or past critical,
   * whatever is added to the table later.
   */
  it('never leaves a reduced spring under critical', () => {
    for (const spring of Object.values(SPRING)) {
      const quiet = stiffened(spring);
      expect(quiet.damping).toBeGreaterThanOrEqual(critical(quiet));
      expect(quiet.stiffness).toBeGreaterThan(spring.stiffness);
      expect(quiet.mass).toBe(spring.mass);
    }
  });
});

describe('the veil', () => {
  /**
   * `Animated.interpolate` does not complain about a non-increasing input
   * range; it misbehaves quietly. This range is computed from measured layout,
   * so the degenerate cases are not hypothetical — a screen asked for its
   * height before it has been laid out answers zero.
   */
  it('is a strictly increasing range whatever the layout reports', () => {
    const cases = [
      [0.55, threshold(CARD), 911],
      [0.55, threshold(SHORT), 667],
      [0.55, threshold(CARD), 0],
      [0.55, threshold(CARD), threshold(CARD)],
      [0.55, 0, 0],
    ];

    for (const [veil, far, exit] of cases) {
      const { inputRange: input, outputRange: output } = veilStops(veil, far, exit);

      expect(input.length).toBe(output.length);
      expect(input[0]).toBe(0);
      for (let i = 1; i < input.length; i++) expect(input[i]).toBeGreaterThan(input[i - 1]);

      expect(output[0]).toBe(veil);
      for (let i = 1; i < output.length; i++) {
        expect(output[i]).toBeLessThanOrEqual(output[i - 1]);
      }
      expect(output[output.length - 1]).toBe(0);
    }
  });
});
