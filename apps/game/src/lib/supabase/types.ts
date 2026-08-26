import type { Illness } from '$lib/game/items';

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
};

/** A private note on a cat. Only the cat's owner can read or write it. */
export type CatNoteRow = {
  cat_id: string;
  owner_user_id: string;
  body: string;
  updated_at: string;
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

export type BreedingPostRow = {
  id: string;
  breeding_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
};
