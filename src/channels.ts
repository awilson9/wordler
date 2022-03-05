import { Client, TextChannel, GuildMember } from 'discord.js';
import { DiscordBase } from './discordBase.js';

export class Channels extends DiscordBase {
  private wordleChannels?: TextChannel[];
  private activeChannel?: TextChannel;
  private readonly wordleChannelNames = ['wordle', 'games'] as const;

  constructor(client: Client, guildId: string) {
    super(client, guildId);
    this.findWordleChannel();
  }

  public sendDaddy(newDaddy: GuildMember, oldDaddy: GuildMember) {
    this.activeChannel?.send(
      `a new wordle daddy appears: ${newDaddy}. better luck next time ${oldDaddy}`,
    );
  }

  public getWordleChannels() {
    return this.wordleChannels || [];
  }

  public fetchMessages(channelId: string) {}

  private findWordleChannel() {
    const channels = this.getChannels()
      ?.filter(
        (channel) =>
          !!this.wordleChannelNames.find((entry) => channel.name.includes(entry)) &&
          channel.isText(),
      )
      ?.values();

    this.wordleChannels = Array.from(channels || []).filter((channel) =>
      channel.isText(),
    ) as TextChannel[];

    this.activeChannel = this.wordleChannels.find(
      (channel) => 'name' in channel && channel.name.includes(this.wordleChannelNames[0]),
    );

    console.log(
      'found wordle channels: ',
      this.wordleChannels.map((channel) => channel?.name).join(', '),
    );
  }

  private getChannels() {
    return this.getGuild()?.channels.cache;
  }

  // const createSpoilerThread = () => {
  //   const minutesUntilMidnight = (new Date().setHours(24, 0, 0, 0) - Date.now()) / 60 / 1000;
  //   runMeta.wordleChannel.threads.create({
  //     name: 'Wordle Spoilers',
  //     autoArchiveDuration: 1440,
  //     reason: 'Spoilers for todays worlde puzzle',
  //   });
  // };
}
