ALTER TABLE feeds
  ALTER COLUMN guild_id   TYPE TEXT USING guild_id::TEXT,
  ALTER COLUMN channel_id TYPE TEXT USING channel_id::TEXT;
