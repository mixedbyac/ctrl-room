// What someone does, picked at sign-up. Helps the engineer put them on the right artist with the right role.
export const TITLES = ['Artist', 'Manager', 'Producer', 'Songwriter', 'A&R', 'Label', 'Creative director', 'Team member', 'Other'];
/** The artist-team role that fits a sign-up title. */
export const roleForTitle = (t) => (/^artist$/i.test(t || '') ? 'Artist' : /^manager$/i.test(t || '') ? 'Manager' : 'Team');
