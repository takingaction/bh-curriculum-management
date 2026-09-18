-- Track previous public_urls for assets so replaced files can have their
-- old URLs identified and rewritten in lesson HTML. Going forward, PUT
-- /api/assets/[id] appends the old public_url to this array before
-- overwriting it. Combined with the lesson view click handler that resolves
-- resource links by data-asset-id (added in the same release), this makes
-- file replacement globally visible without manual re-linking.

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS previous_public_urls TEXT[] NOT NULL DEFAULT '{}';
