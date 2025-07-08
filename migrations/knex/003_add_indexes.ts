import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feeds', table => {
    table.index('guild_id', 'idx_feeds_guild_id');
    table.index('url',      'idx_feeds_url');
    table.index('last_updated', 'idx_feeds_last_updated');
    table.index(['guild_id','channel_id'], 'idx_feeds_guild_channel');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feeds', table => {
    table.dropIndex('guild_id', 'idx_feeds_guild_id');
    table.dropIndex('url',      'idx_feeds_url');
    table.dropIndex('last_updated', 'idx_feeds_last_updated');
    table.dropIndex(['guild_id','channel_id'], 'idx_feeds_guild_channel');
  });
}
