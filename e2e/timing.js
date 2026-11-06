// A time budget catches a change that makes the work much slower. The counts in each test, such as the
// number of row elements or renders, catch work that grows with the size of the data, so they stay exact.
//
// The production CI worker shares its machine with other jobs. On 2026-11-05 it ran the browser tests
// in 6.7 minutes, and `run-local` ran them in 1.2 minutes. A budget for a workstation failed there by 2x.
// The test job sets CI=1. ZEST_TIME_SCALE sets a different factor.
export const timeScale = Number(process.env.ZEST_TIME_SCALE) || (process.env.CI ? 4 : 1);

/** The most milliseconds that a step can take. */
export const budget = (milliseconds) => milliseconds * timeScale;

/** The smallest rate, for example events each second, that a step must reach. */
export const rate = (perSecond) => perSecond / timeScale;
