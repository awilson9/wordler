import { Client } from 'discord.js';

export class DiscordBase {
  private client: Client;
  private guildId: string;

  constructor(client: Client, guildId: string) {
    this.client = client;
    this.guildId = guildId;
  }

  getGuild() {
    return this.client.guilds.cache.get(this.guildId);
  }
}
