import { ButtonInteraction, CommandInteraction, ModalSubmitInteraction, SelectMenuInteraction } from "discord.js";
export declare class ListCommand {
    constructor();
    list(interaction: CommandInteraction): Promise<void>;
    handleButton(interaction: ButtonInteraction): Promise<void>;
    handleSelect(interaction: SelectMenuInteraction): Promise<void>;
    handleModal(interaction: ModalSubmitInteraction): Promise<void>;
    private buildPage;
    private extractDomain;
}
