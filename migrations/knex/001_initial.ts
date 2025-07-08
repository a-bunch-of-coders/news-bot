import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('feeds', table => {
    table.increments('id').notNullable();
    table.integer('guild_id').notNullable();
    table.integer('channel_id').notNullable();
    table.text('url').notNullable();
    table.text('title');
    table.text('webhook_url');
    table.text('last_updated').notNullable();
    table.text('last_item_date');
    table.unique(['guild_id', 'url']);
  });

  await knex.schema.createTable('guild_settings', table => {
    table.integer('guild_id').primary().notNullable();
    table.integer('rss_channel_id').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('guild_settings');
  await knex.schema.dropTableIfExists('feeds');
}
