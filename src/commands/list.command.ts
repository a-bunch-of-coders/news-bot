import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  SelectMenuInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  ButtonComponent,
  Discord,
  ModalComponent,
  SelectMenuComponent,
  Slash,
} from "discordx";

import { Feed as FeedModel } from "../abstract/db";

const FEEDS_PER_PAGE = 10;

@Discord()
export class ListCommand {
  constructor() {}

  @Slash({
    name: "list",
    description: "List configured RSS feeds for this server",
  })
  async list(interaction: CommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const feeds = await interaction.client.db.guild(guildId);
    if (feeds.length === 0) {
      await interaction.reply({
        content: "No RSS feeds configured for this server.",
        ephemeral: true,
      });
      return;
    }

    const totalPages = Math.ceil(feeds.length / FEEDS_PER_PAGE);
    const page = 0;
    const { embed, components } = this.buildPage(feeds, page, totalPages);

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  @ButtonComponent({ id: /^list_(prev|next|jump)_[0-9]+$/ })
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const feeds = await interaction.client.db.guild(guildId);
    if (feeds.length === 0) {
      await interaction.reply({ content: "No feeds to page.", ephemeral: true });
      return;
    }

    const totalPages = Math.ceil(feeds.length / FEEDS_PER_PAGE);
    const [_, action, pageStr] = interaction.customId.split("_");
    if (pageStr === undefined) {
        await interaction.reply({
            content: "Invalid pagination action.",
            ephemeral: true,
            });
        return;
    }
    const currentPage = parseInt(pageStr, 10);

    if (action === "jump") {
      const modal = new ModalBuilder()
        .setCustomId("list_jump_modal")
        .setTitle("Jump to Page")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("page")
              .setLabel(`Enter a page number (1–${totalPages})`)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(3)
          )
        );

      await interaction.showModal(modal);
      return;
    }

    let newPage = currentPage;
    if (action === "prev") {
      newPage = Math.max(currentPage - 1, 0);
    } else if (action === "next") {
      newPage = Math.min(currentPage + 1, totalPages - 1);
    }

    const { embed, components } = this.buildPage(feeds, newPage, totalPages);
    await interaction.update({ embeds: [embed], components });
  }

  @SelectMenuComponent({ id: "list_select" })
  async handleSelect(interaction: SelectMenuInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const feeds = await interaction.client.db.guild(guildId);
    if (feeds.length === 0) {
      await interaction.reply({ content: "No feeds to page.", ephemeral: true });
      return;
    }

    const totalPages = Math.ceil(feeds.length / FEEDS_PER_PAGE);
    const selected = interaction.values[0];

    if (!selected || isNaN(parseInt(selected, 10))) {
      await interaction.reply({
        content: "Invalid page selection.",
        ephemeral: true,
      });
      return;
    }

    const requestedPage = parseInt(selected, 10) - 1;
    const page = Math.min(Math.max(requestedPage, 0), totalPages - 1);

    const { embed, components } = this.buildPage(feeds, page, totalPages);
    await interaction.update({ embeds: [embed], components });
  }

  @ModalComponent({ id: "list_jump_modal" })
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const feeds = await interaction.client.db.guild(guildId);
    if (feeds.length === 0) {
      await interaction.reply({ content: "No feeds to page.", ephemeral: true });
      return;
    }

    const totalPages = Math.ceil(feeds.length / FEEDS_PER_PAGE);
    const input = interaction.fields.getTextInputValue("page");
    const parsed = parseInt(input, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > totalPages) {
      await interaction.reply({
        content: `Invalid page. Please enter a number between 1 and ${totalPages}.`,
        ephemeral: true,
      });
      return;
    }

    const page = parsed - 1;
    const { embed, components } = this.buildPage(feeds, page, totalPages);
    await interaction.editReply({ embeds: [embed], components });
  }

  private buildPage(
    feeds: FeedModel[],
    page: number,
    totalPages: number
  ): {
    embed: EmbedBuilder;
    components: ActionRowBuilder<any>[];
  } {
    const start = page * FEEDS_PER_PAGE;
    const end = Math.min(start + FEEDS_PER_PAGE, feeds.length);
    const slice = feeds.slice(start, end);

    const description = slice
      .map((feed, i) => {
        const idx = start + i + 1;
        const domain = this.extractDomain(feed.url);
        const last = feed.last_item_date
          ? new Date(feed.last_item_date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Never";
        return `**${idx}.** \`${domain}\` → <#${feed.channel_id}> | Last updated: ${last}`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("RSS Feeds")
      .setDescription(description)
      .setColor(0x7289da)
      .setFooter({
        text: `Page ${page + 1} of ${totalPages} • ${feeds.length} total`,
      });

    const components: ActionRowBuilder<any>[] = [];

    if (totalPages > 1) {
      // Pagination buttons
      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`list_prev_${page}`)
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`list_jump_${page}`)
          .setLabel(`${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`list_next_${page}`)
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );
      components.push(buttons);

      // Dropdown for quick jump if many pages
      if (totalPages > 5) {
        const startPage = page < 5 ? 0 : page - 4;
        const endPage = Math.min(startPage + 10, totalPages);
        const options: StringSelectMenuOptionBuilder[] = [];

        for (let i = startPage; i < endPage; i++) {
          options.push(
            new StringSelectMenuOptionBuilder()
              .setLabel(`Page ${i + 1}`)
              .setValue((i + 1).toString())
              .setDefault(i === page)
          );
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId("list_select")
          .setPlaceholder("Jump to page…")
          .addOptions(options);

        components.push(
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)
        );
      }
    }

    return { embed, components };
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return "Unknown";
    }
  }
}
