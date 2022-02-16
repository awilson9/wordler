import { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } from 'discord.js';
import { token } from './config.json';

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

const runMeta = {
  wordleMessagesByAuthor: {},
};

const findWordleChannel = () => {
  runMeta.wordleChannel = client.channels.cache.find((channel) => channel.name.includes('wordle'));
  runMeta.oldChannel = client.channels.cache.find((channel) => channel.name.includes('games'));

  console.log('found wordle channel', runMeta.wordleChannel.name);
};

// When the client is ready, run this code (only once)
client.once('ready', async () => {
  console.log('Ready!');
  findWordleChannel();
  await getAllWordleMessagesByAuthor(runMeta.oldChannel);
  await getAllWordleMessagesByAuthor(runMeta.wordleChannel);
});

const getAllWordleMessagesByAuthor = async (channel) => {
  let wordleMessages = [];
  let hasMore = true;
  let beforeMessage;
  while (hasMore) {
    console.log(channel.name);
    const messages = await channel.messages.fetch({ limit: 100, before: beforeMessage });
    const withWordle = messages.filter((message) =>
      message.content.toLowerCase().includes('wordle'),
    );
    wordleMessages = [...wordleMessages, ...withWordle];
    if (messages.size !== 100) {
      hasMore = false;
      continue;
    }
    beforeMessage = messages.last().id;
  }
  const byAuthor = runMeta.wordleMessagesByAuthor || {};

  [...wordleMessages.values()].forEach(([_, message]) => {
    const { author, content } = message;
    if (byAuthor[author.id] === undefined) {
      byAuthor[author.id] = { messages: [], author };
    }

    const parsedMessage = content.split('\n');
    const scorePiece = parsedMessage.find((message) => message.startsWith('Wordle'));
    if (!scorePiece) return;
    const wordleId = scorePiece.split(' ')[1];
    const boardPieces = parsedMessage.filter(
      (message) =>
        message.includes('⬛') ||
        message.includes('⬜') ||
        message.includes('🟨') ||
        message.includes('🟩'),
    );
    if (
      scorePiece !== undefined &&
      boardPieces !== undefined &&
      boardPieces.length > 0 &&
      wordleId &&
      !byAuthor[author.id].messages[wordleId]
    ) {
      byAuthor[author.id].messages[wordleId] = {
        author: author,
        scorePiece,
        boardPieces,
        created: message.createdAt.getTime(),
      };
    }
  });
  runMeta.wordleMessagesByAuthor = byAuthor;
};

const COMMANDS = {
  Ping: 'ping',
  Leaderboard: 'leaderboard',
};

const BUTTONS = {
  AllTime: 'allTime',
  Weekly: 'weekly',
};

const computeWordleStats = (buttonId) => {
  const computed = Object.values(runMeta.wordleMessagesByAuthor)
    .filter((wordleInfo) => wordleInfo.messages.length > 0)
    .map((wordleInfo) => {
      let messages = Object.values(wordleInfo.messages);
      if (buttonId === BUTTONS.Weekly) {
        messages = messages.filter(
          (message) => message.created > new Date().getTime() - 7 * 24 * 60 * 60 * 1000, // 1 week in ms
        );
      }
      wordleInfo.total = messages.length;

      const totalNumGuesses = messages.reduce((acc, message) => {
        const guessInfo = message.scorePiece.split(' ').find((piece) => piece.includes('/6'));
        if (!guessInfo) console.log(message);

        const guessesForWordleInstance = Number(guessInfo.split('/')[0]);
        if (guessesForWordleInstance > 0) {
          return guessesForWordleInstance + acc;
        } else {
          wordleInfo.total--;
          return acc;
        }
      }, 0);

      wordleInfo.average = (totalNumGuesses / wordleInfo.total).toFixed(2);
      console.log(wordleInfo.author.username, wordleInfo.total, wordleInfo.average);
      return wordleInfo;
    });
  console.log('\n');
  return computed.sort((a, b) => (a.average < b.average ? -1 : 1));
};

const fetchLeaderboard = async (interaction, buttonId) => {
  const computed = computeWordleStats(buttonId);
  interaction.reply({
    embeds: [
      new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Current Leaderboard: ${buttonId}`)
        .addFields(
          computed.map((scoreForUser) => ({
            name: scoreForUser.author.username,
            value: scoreForUser.average,
          })),
        ),
    ],
  });
};

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const { commandName } = interaction;
    switch (commandName) {
      case COMMANDS.Ping:
        await interaction.reply('Pong!');
        break;
      case COMMANDS.Leaderboard: {
        const allTime = new MessageActionRow().addComponents(
          new MessageButton().setCustomId(BUTTONS.AllTime).setLabel('All Time').setStyle('PRIMARY'),
        );
        const weekly = new MessageActionRow().addComponents(
          new MessageButton().setCustomId(BUTTONS.Weekly).setLabel('Weekly').setStyle('PRIMARY'),
        );
        await interaction.reply({
          content: 'All time or weekly?',
          ephemeral: true,
          components: [allTime, weekly],
        });
        break;
      }

      default:
        return;
    }
  }
  if (interaction.isButton()) {
    const { customId: buttonId } = interaction;
    await fetchLeaderboard(interaction, buttonId);
  }
});

// Login to Discord with your client's token
client.login(token);
