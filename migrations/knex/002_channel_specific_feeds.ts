import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('guild_settings');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.createTable('guild_settings', table => {
    table.integer('guild_id').primary().notNullable();
    table.integer('rss_channel_id').notNullable();
  });
}
