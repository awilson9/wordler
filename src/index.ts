import { Client, Intents } from 'discord.js';
import { token, guildId } from './config.js';
import { MessageHandler } from './messageHandler.js';

// Create a new client instance
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MEMBERS],
  partials: ['MESSAGE', 'USER', 'CHANNEL', 'GUILD_MEMBER'],
});

class WordlerHandler {
  public messageHandler: MessageHandler;

  constructor(client: Client) {
    this.messageHandler = new MessageHandler(client, guildId);
  }

  public async setup() {
    await this.messageHandler.setup();
  }
}

let handler: WordlerHandler;

// When the client is ready, run this code (only once)
client.once('ready', async () => {
  console.log('Ready!');
  handler = new WordlerHandler(client);
  await handler.setup();

  // createSpoilerThread();
});

client.on('messageCreate', async (message) => {
  await handler?.messageHandler?.handleNewMessage(message);
});

client.on('interactionCreate', async (interaction) => {
  await handler?.messageHandler?.handleInteraction(interaction);
});

// Login to Discord with your client's token
client.login(token);
