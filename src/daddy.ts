import { Client, GuildMember, Role } from 'discord.js';
import { Channels } from './channels.js';
import { DiscordBase } from './discordBase.js';

export class Daddy extends DiscordBase {
  private daddyRole?: Role;
  private currentDaddy?: GuildMember;
  private channelManager?: Channels;

  constructor(client: Client, guildId: string, channelManager: Channels) {
    super(client, guildId);
    this.channelManager = channelManager;
    this.daddyRole = this.getWordleDaddyRole();
  }

  public async setup() {
    this.currentDaddy = await this.getCurrentWordleDaddy();
  }

  public async reassignWordleDaddy(leader: GuildMember) {
    return;
    if (!this.daddyRole || !this.currentDaddy) {
      return;
    }
    // const users = await this.getUsers();
    // const leaderUser = users?.find((user) => user.user.id === leader.id);
    // if (leader.id === this.currentDaddy?.user.id || !leaderUser) {
    //   return;
    // }
    // console.log('a new wordle daddy appears: ', leader.user.username);
    // leaderUser?.roles.add(this.daddyRole);
    // this.currentDaddy.roles.remove(this.daddyRole);
    // this.channelManager?.sendDaddy(leaderUser, this.currentDaddy);
    // this.currentDaddy = leaderUser;
  }

  private getWordleDaddyRole() {
    const wordleDaddy = this.getRoles()?.find((role) => role.name === 'wordledaddy');
    console.log('wordle daddy role found: ', wordleDaddy?.name);
    return wordleDaddy;
  }

  private async getCurrentWordleDaddy() {
    const users = await this.getUsers();
    const wordleDaddy = users?.find(
      (user) => !!user.roles.cache.find((role) => role.id === this.daddyRole?.id),
    );
    console.log('wordle daddy is: ', wordleDaddy?.user.username);
    return wordleDaddy;
  }

  private getRoles() {
    const guild = this.getGuild();
    return guild?.roles.cache;
  }

  private async getUsers() {
    const users = await this.getGuild()?.members.fetch();
    return users;
  }
}
