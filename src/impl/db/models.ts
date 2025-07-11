// this theoretically should be moved to knex/sql/tables definition iirc.
export interface Feed {
  id: number;
  guild_id: string;
  channel_id: string;
  url: string;
  title: string | null;
  webhook_url: string | null;
  last_updated: Date;
  last_item_date: Date | null;
}

export interface GuildSettings {
  guild_id: string;
  rss_channel_id: string;
}
