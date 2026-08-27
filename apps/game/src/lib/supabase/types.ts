import type { Illness } from '$lib/game/items';
import type { Gender } from '$lib/game/mating';

export type CatRow = {
  id: string;
  owner_user_id: string;
  name: string;
  image_url: string;
  domestication_points: number;
  domesticated_at: string;
  /** Condition as of `state_at`; replay it with $lib/game/care. */
  satiety: number;
  happiness: number;
  state_at: string;
  illness: Illness | null;
  ill_since: string | null;
  /** Fixed palate — see tasteFor() in $lib/game/items. */
  taste_seed: number;
  last_petted_at: string | null;
  last_played_at: string | null;
  last_cuddled_at: string | null;
  gender: Gender;
  /** Set while she is expecting. */
  pregnant_since: string | null;
  due_at: string | null;
  last_mated_at: string | null;
  mother_cat_id: string | null;
  father_cat_id: string | null;
  /** When she was born — her age is real time since this. */
  birth_at: string;
  /** Days she is expected to live. */
  lifespan_days: number;
  origin: 'tamed' | 'born';
  /** Set once she has died of old age; the row stays for the family tree. */
  died_at: string | null;
  /** False for a newborn kitten until her owner names her. */
  named: boolean;
};

/** A private note on a cat. Only the cat's owner can read or write it. */
export type CatNoteRow = {
  cat_id: string;
  owner_user_id: string;
  body: string;
  updated_at: string;
};

/** A player's own name, shown instead of their email. */
export type ProfileRow = {
  user_id: string;
  username: string;
  created_at: string;
};

export type UserItemRow = {
  user_id: string;
  item_id: string;
  quantity: number;
};

export type CatGameRow = {
  id: string;
  challenger_cat_id: string;
  opponent_cat_id: string;
  winner_cat_id: string;
  kind: 'chase' | 'wrestle' | 'yarn';
  challenger_score: number;
  opponent_score: number;
  played_at: string;
};

/** Something waiting on the player, shown at the top of the dashboard. */
export type DashboardAlert = {
  kind: 'request' | 'invite';
  breeding_id: string;
  breeding_name: string;
  cat_name: string;
};

/** A played game, with both cats named for the results feed. */
export type GameFeedItem = Pick<
  CatGameRow,
  'id' | 'kind' | 'challenger_score' | 'opponent_score' | 'winner_cat_id' | 'played_at'
> & {
  challenger: { id: string; name: string } | null;
  opponent: { id: string; name: string } | null;
};

export type BreedingRow = {
  id: string;
  owner_user_id: string;
  name: string;
  description: string;
  created_at: string;
};

/** The breeding a cat lives in, reduced to what a cat card shows. */
export type CatBreeding = Pick<BreedingRow, 'id' | 'name'>;

/** A breeding as listed on the dashboard. */
export type DashboardBreeding = CatBreeding & {
  cat_count: number;
  /** You founded it, or one of your cats lives in it. */
  is_member: boolean;
};

export type BreedingCatRow = {
  breeding_id: string;
  cat_id: string;
  added_at: string;
};

export type BreedingRequestStatus = 'pending' | 'accepted' | 'rejected';

export type BreedingRequestRow = {
  id: string;
  breeding_id: string;
  cat_id: string;
  requester_user_id: string;
  status: BreedingRequestStatus;
  created_at: string;
  decided_at: string | null;
};

/** An invitation from a breeding's creator to a particular cat. */
export type BreedingInviteRow = {
  id: string;
  breeding_id: string;
  cat_id: string;
  invited_user_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  decided_at: string | null;
};

export type BreedingPostRow = {
  id: string;
  breeding_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
};
