import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feeds', table => {
    table.text('guild_id').notNullable().alter();
    table.text('channel_id').notNullable().alter();
  });


}

export async function down(knex: Knex): Promise<void> {
  // revert feeds back to integer
  await knex.schema.alterTable('feeds', table => {
    table.integer('guild_id').notNullable().alter();
    table.integer('channel_id').notNullable().alter();
  });
}
