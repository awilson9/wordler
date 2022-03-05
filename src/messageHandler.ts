import {
  ButtonInteraction,
  Client,
  CommandInteraction,
  EmbedFieldData,
  Interaction,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
} from 'discord.js';
import { Channels } from './channels.js';
import { BUTTONS, COMMANDS } from './constants.js';
import { Daddy } from './daddy.js';
import { Leaderboard } from './leaderboard.js';

export class MessageHandler {
  private leaderboard: Leaderboard;
  private daddy: Daddy;

  constructor(client: Client, guildId: string) {
    const channelManager = new Channels(client, guildId);
    this.leaderboard = new Leaderboard(channelManager);
    this.daddy = new Daddy(client, guildId, channelManager);
  }

  public async setup() {
    await this.daddy.setup();
    await this.leaderboard.getAllWordleMessagesByAuthor();
  }

  public async handleNewMessage(message: Message) {
    console.log(`Message from ${message.author.username}: ${message.content}: processing`);
    const processResult = this.leaderboard.processMessage(message);
    if (processResult) {
      console.log('wordle result processed and recorded');
      this.fetchLeaderboard(BUTTONS.Weekly);
    } else {
      console.log('message amst not contain no wordlerdlers');
    }
  }

  private async fetchLeaderboard(
    buttonId: BUTTONS,
    interaction?: CommandInteraction | ButtonInteraction,
  ) {
    const computed = this.leaderboard.computeWordleStats(buttonId);
    if (buttonId === BUTTONS.Weekly) {
      if (!computed[0]?.author) {
        console.log('no leader found!!!');
        return;
      }
      this.daddy.reassignWordleDaddy(computed[0].author);
    }

    const embedTable: EmbedFieldData[] = [];
    computed.forEach((scoreForUser) => {
      if (scoreForUser && Number.isFinite(Number(scoreForUser.average))) {
        const best = scoreForUser.scores.reduce((a, b) =>
          Math.min(a.score, b.score) === a.score ? a : b,
        );
        const worst = scoreForUser.scores.reduce((a, b) =>
          Math.max(a.score, b.score) === a.score ? a : b,
        );
        embedTable.push({
          name: scoreForUser.author.user.username,
          value: `score: ${
            scoreForUser?.average
          }\ngames played: ${scoreForUser.total.toString()}\nbest: ${best.score.toString()}\nworst: ${worst.score.toString()}`,
        });
      }
    });
    if (interaction) {
      interaction.reply({
        embeds: [
          new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`Current Leaderboard: ${buttonId}`)
            .addFields(embedTable),
        ],
      });
    }
  }

  public async handleInteraction(interaction: Interaction) {
    if (interaction.isCommand()) {
      const { commandName } = interaction;
      switch (commandName) {
        case COMMANDS.Ping:
          await interaction.reply('Pong!');
          break;
        case COMMANDS.Leaderboard: {
          const allTime = new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId(BUTTONS.AllTime)
              .setLabel('all Time')
              .setStyle('PRIMARY'),
          );
          const fuckYou = new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId(BUTTONS.FuckTheNonePlayers)
              .setLabel('fuck the none players chaos mode')
              .setStyle('PRIMARY'),
          );
          const hardMode = new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId(BUTTONS.HardMode)
              .setLabel('Hard Mode Only scores')
              .setStyle('PRIMARY'),
          );
          const weekly = new MessageActionRow().addComponents(
            new MessageButton().setCustomId(BUTTONS.Weekly).setLabel('weekly').setStyle('PRIMARY'),
          );
          await interaction.reply({
            content: 'All time or chaos or weekly?',
            ephemeral: true,
            components: [allTime, fuckYou, weekly, hardMode],
          });
          break;
        }

        default:
          return;
      }
    }
    if (interaction.isButton()) {
      const { customId: buttonId } = interaction;
      await this.fetchLeaderboard(buttonId as BUTTONS, interaction);
    }
  }
}
