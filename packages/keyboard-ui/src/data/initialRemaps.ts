import { profile0 } from './remaps/profile-0.js';
import { profile1 } from './remaps/profile-1.js';
import { profile2 } from './remaps/profile-2.js';
import { profile3 } from './remaps/profile-3.js';
/** Seed all original onboard tables before live hydration; no hardware writes occur here. */
export const initialRemaps = [profile0, profile1, profile2, profile3];
