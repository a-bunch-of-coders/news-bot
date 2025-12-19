// src/commands/setupfeeds.command.ts
import type {
  ButtonInteraction,
  CommandInteraction,
  Guild,
  NonThreadGuildBasedChannel,
  StringSelectMenuInteraction,
} from "discord.js";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import {
  ButtonComponent,
  Discord,
  SelectMenuComponent,
  Slash,
  SlashOption,
} from "discordx";

import { loadCollection,topics as getTopics } from "../impl/opinionated.js";

export interface SetupState {
  guildId: string;
  userId: string;
  categoryId: string | "new_category"; // store as string for discord.js ids
  topics: string[];
};

const STATES = new Map<string, SetupState>();

function key(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function slugifyChannel(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 100);
}

async function createCategory(guild: Guild, name: string) {
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: [],
  });
  return channel.id;
}

async function createTextChannel(
  guild: Guild,
  name: string,
  parentId: string,
): Promise<string> {
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: parentId,
    permissionOverwrites: [],
  });
  return channel.id;
}

function assertStateOwner(
  interaction:
    | CommandInteraction
    | StringSelectMenuInteraction
    | ButtonInteraction,
): SetupState | null {
  const guildId = interaction.guild?.id;
  const userId = interaction.user.id;
  if (!guildId) return null;

  const st = STATES.get(key(guildId, userId));
  return st ?? null;
}

@Discord()
export class SetupFeedsCommand {
  constructor() {}

  @Slash({
    name: "setupfeeds",
    description: "Interactively set up curated RSS feeds (categories + topic channels)",
    defaultMemberPermissions: PermissionFlagsBits.ManageChannels,
  })
  async setupFeeds(
    @SlashOption({
      name: "category_name",
      description: "Name for the new category (used only if you choose 'Create New Category')",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    categoryName: string | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    // Explicit permission check (Discord may also hide command via defaultMemberPermissions)
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({
        content: "Missing required permission: Manage Channels",
        ephemeral: true,
      });
      return;
    }

    // Defer so we can fetch channels without racing the 3s window
    await interaction.deferReply({ ephemeral: true });

    // Gather categories
    const all = await guild.channels.fetch();
    const categories = [...all.values()].filter(
      (ch): ch is NonThreadGuildBasedChannel =>
        !!ch && ch.type === ChannelType.GuildCategory,
    );

    // Initialize state
    const st: SetupState = {
      guildId: guild.id,
      userId: interaction.user.id,
      categoryId: "new_category",
      topics: [],
    };
    STATES.set(key(guild.id, interaction.user.id), st);

    // Build select menu options
    const options: StringSelectMenuOptionBuilder[] = [
      new StringSelectMenuOptionBuilder()
        .setLabel("Create New Category")
        .setValue("new_category")
        .setDescription(
          `Create a new category${categoryName ? ` (“${categoryName}”)` : ""} for RSS feeds`,
        ),
    ];

    for (const ch of categories) {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(ch.name)
          .setValue(ch.id)
          .setDescription(`Use existing category: ${ch.name}`),
      );
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("setupfeeds_category_select")
      .setPlaceholder("Choose a category for your RSS feeds")
      .addOptions(options);

    const embed = new EmbedBuilder()
      .setTitle("RSS Feed Setup")
      .setDescription("Select where to organize your RSS feeds")
      .setColor(0x89b4fa);

    const row =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  }

  // CATEGORY SELECT HANDLER
  @SelectMenuComponent({ id: "setupfeeds_category_select" })
  async onCategorySelect(interaction: StringSelectMenuInteraction) {
    const guild = interaction.guild;
    if (!guild) return;

    // This interaction is only meant for the user who started it
    const st = assertStateOwner(interaction);
    if (!st) {
      await interaction.reply({
        content: "This setup session isn’t yours (or it expired). Run /setupfeeds again.",
        ephemeral: true,
      });
      return;
    }

    const selected = interaction.values[0]!;
    st.categoryId = (selected === "new_category" ? "new_category" : selected);
    STATES.set(key(st.guildId, st.userId), st);

    // Load available topics
    let t: string[];
    try {
      t = await getTopics();
    } catch (e: any) {
      await interaction.reply({
        content: `Failed to load available topics: ${e?.message ?? String(e)}`,
        ephemeral: true,
      });
      return;
    }

    if (!t.length) {
      await interaction.reply({
        content: "No curated feed collections available.",
        ephemeral: true,
      });
      return;
    }

    const topicOptions = t.slice(0, 25).map((topic) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(topic)
        .setValue(topic)
        .setDescription(`Add ${topic} RSS feeds`),
    );

    const topicMenu = new StringSelectMenuBuilder()
      .setCustomId("setupfeeds_topic_select")
      .setPlaceholder("Select RSS feed topics (multiple allowed)")
      .setMinValues(1)
      .setMaxValues(Math.min(t.length, 25))
      .addOptions(topicOptions);

    const categoryName =
      st.categoryId === "new_category"
        ? "New Category"
        : (guild.channels.cache.get(st.categoryId)?.name ?? "Selected Category");

    const embed = new EmbedBuilder()
      .setTitle("Select Topics")
      .setDescription("Choose the RSS feed topics you want to add")
      .addFields(
        { name: "Category", value: categoryName, inline: true },
        { name: "Available Topics", value: String(t.length), inline: true },
      )
      .setColor(0xb4befe);

    const row =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(topicMenu);

    // Update the original ephemeral message
    await interaction.update({
      embeds: [embed],
      components: [row],
    });
  }

  // TOPIC SELECT HANDLER
  @SelectMenuComponent({ id: "setupfeeds_topic_select" })
  async onTopicSelect(interaction: StringSelectMenuInteraction) {
    const guild = interaction.guild;
    if (!guild) return;

    const st = assertStateOwner(interaction);
    if (!st) {
      await interaction.reply({
        content: "This setup session isn’t yours (or it expired). Run /setupfeeds again.",
        ephemeral: true,
      });
      return;
    }

    st.topics = [...interaction.values];
    STATES.set(key(st.guildId, st.userId), st);

    if (!st.topics.length) {
      await interaction.reply({
        content: "Please select at least one topic.",
        ephemeral: true,
      });
      return;
    }

    // Summarize counts per topic (like your Rust confirmation screen)
    let totalFeeds = 0;
    const fields: { name: string; value: string; inline?: boolean }[] = [];

    for (const topic of st.topics) {
      try {
        const col = await loadCollection(topic);
        const cnt = col.feeds.length;
        totalFeeds += cnt;
        fields.push({ name: topic, value: `${cnt} feeds`, inline: true });
      } catch (e: any) {
        await interaction.reply({
          content: `Failed to load topic: ${topic}`,
          ephemeral: true,
        });
        return;
      }
    }

    const categoryName =
      st.categoryId === "new_category"
        ? "New Category"
        : (guild.channels.cache.get(st.categoryId)?.name ?? "Selected Category");

    const channelsList = st.topics.map(slugifyChannel).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("Setup Confirmation")
      .setDescription("Review your RSS feed setup configuration")
      .addFields(
        { name: "Category", value: categoryName, inline: true },
        { name: "Selected Topics", value: String(st.topics.length), inline: true },
        { name: "Total Feeds", value: String(totalFeeds), inline: true },
        { name: "Channels to Create", value: channelsList || "(none)", inline: false },
        ...fields,
      )
      .setFooter({ text: "Click Confirm to proceed or Cancel to abort" })
      .setColor(0xf9e2af);

    const confirm = new ButtonBuilder()
      .setCustomId("setupfeeds_confirm")
      .setLabel("Confirm Setup")
      .setStyle(ButtonStyle.Success);

    const cancel = new ButtonBuilder()
      .setCustomId("setupfeeds_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel);

    await interaction.update({
      embeds: [embed],
      components: [row],
    });
  }

  @ButtonComponent({ id: "setupfeeds_cancel" })
  async onCancel(interaction: ButtonInteraction) {
    const st = assertStateOwner(interaction);
    if (!st) {
      await interaction.reply({
        content: "This setup session isn’t yours (or it expired).",
        ephemeral: true,
      });
      return;
    }

    STATES.delete(key(st.guildId, st.userId));

    const embed = new EmbedBuilder()
      .setTitle("Setup Cancelled")
      .setDescription("No changes were made to your server")
      .setColor(0xf38ba8);

    await interaction.update({ embeds: [embed], components: [] });
  }

  @ButtonComponent({ id: "setupfeeds_confirm" })
  async onConfirm(interaction: ButtonInteraction) {
    const guild = interaction.guild;
    if (!guild) return;

    const st = assertStateOwner(interaction);
    if (!st) {
      await interaction.reply({
        content: "This setup session isn’t yours (or it expired). Run /setupfeeds again.",
        ephemeral: true,
      });
      return;
    }

    // Immediately update message to “working…”
    const working = new EmbedBuilder()
      .setTitle("Setting Up RSS Feeds")
      .setDescription("Creating channels and adding feeds...")
      .setColor(0x94e2d5);

    await interaction.update({ embeds: [working], components: [] });

    // Resolve category
    let actualCategoryId: string;
    try {
      if (st.categoryId === "new_category") {
        // you can pass category name via slash option if you want; keeping parity with Rust default
        actualCategoryId = await createCategory(guild, "RSS Feeds");
      } else {
        actualCategoryId = st.categoryId;
      }
    } catch (e: any) {
      STATES.delete(key(st.guildId, st.userId));
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription("Failed to create category")
            .setColor(0xf38ba8),
        ],
        components: [],
      });
      return;
    }

    let totalAdded = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    const channelFields: { name: string; value: string; inline?: boolean }[] = [];

    for (const topic of st.topics) {
      let collection: { feeds: Array<{ url: string; name: string }> };
      try {
        collection = await loadCollection(topic);
      } catch {
        channelFields.push({
          name: `${topic} Channel`,
          value: "Failed to load collection",
          inline: false,
        });
        continue;
      }

      const channelName = slugifyChannel(topic);

      let channelId: string;
      try {
        channelId = await createTextChannel(guild, channelName, actualCategoryId);
      } catch {
        channelFields.push({
          name: `${topic} Channel`,
          value: "Failed to create channel",
          inline: false,
        });
        continue;
      }

      let added = 0;
      let skipped = 0;
      let failed = 0;

      for (const feed of collection.feeds) {
        try {
          if (await interaction.client.db.exists(guild.id, feed.url)) {
            skipped++;
            continue;
          }

          await interaction.client.db.add(
            guild.id,
            channelId,
            feed.url,
            feed.name ?? undefined,
            null,
          );
          added++;
        } catch {
          failed++;
        }
      }

      totalAdded += added;
      totalSkipped += skipped;
      totalFailed += failed;

      channelFields.push({
        name: `${topic} Channel`,
        value: `<#${channelId}>\n${added} added, ${skipped} skipped, ${failed} failed`,
        inline: false,
      });
    }

    const done = new EmbedBuilder()
      .setTitle("Setup Complete")
      .setDescription("Your RSS feeds have been successfully configured")
      .addFields(
        { name: "Channels Created", value: String(st.topics.length), inline: true },
        { name: "Total Feeds Added", value: String(totalAdded), inline: true },
        { name: "Total Feeds Skipped", value: String(totalSkipped), inline: true },
        { name: "Total Feeds Failed", value: String(totalFailed), inline: true },
        ...channelFields,
      )
      .setFooter({ text: "RSS feeds are now active" })
      .setColor(0xa6e3a1);

    // Clean up state
    STATES.delete(key(st.guildId, st.userId));

    await interaction.editReply({
      embeds: [done],
      components: [],
    });
  }
}
