import { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } from 'discord.js';
import { token, guildId } from './config.js';

// Create a new client instance
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
  partials: ['MESSAGE', 'USER', 'CHANNEL'],
});

const runMeta = {
  wordleMessagesByAuthor: {},
};

const findWordleChannel = () => {
  runMeta.wordleChannel = client.channels.cache.find((channel) => channel.name.includes('wordle'));
  runMeta.oldChannel = client.channels.cache.find((channel) => channel.name.includes('games'));

  console.log('found wordle channel', runMeta.wordleChannel.name);
};

const getWordleDaddyRole = () => {
  const wordleDaddy = client.guilds.cache
    .get(guildId)
    .roles.cache.find((role) => role.name === 'wordledaddy');
  console.log(wordleDaddy);
  runMeta.wordleDaddyRole = wordleDaddy;
};
// When the client is ready, run this code (only once)
client.once('ready', async () => {
  console.log('Ready!');
  findWordleChannel();
  getWordleDaddyRole();
  await getAllWordleMessagesByAuthor(runMeta.oldChannel);
  await getAllWordleMessagesByAuthor(runMeta.wordleChannel);
});

client.on('messageCreate', async (message) => {
  console.log(`Message from ${message.author.username}: ${message.content}: processing`);
  const processResult = processMessage(message);
  if (processResult) {
    console.log('wordle result processed and recorded');
  } else {
    console.log('message amst not contain no wordlerdlers');
  }
});

const processMessage = (message) => {
  const { author, content } = message;
  const byAuthor = runMeta.wordleMessagesByAuthor;
  if (byAuthor[author.id] === undefined) {
    byAuthor[author.id] = { messages: [], author };
  }
  const parsedMessage = content.split('\n');
  const scorePiece = parsedMessage.find((message) => message.startsWith('Wordle'));

  if (!scorePiece) return;
  const wordleId = scorePiece.split(' ')[1];
  console.log('wordleid', wordleId);
  const boardPieces = parsedMessage.filter(
    (message) =>
      message.includes('⬛') ||
      message.includes('⬜') ||
      message.includes('🟨') ||
      message.includes('🟩'),
  );
  if (scorePiece !== undefined && boardPieces !== undefined && boardPieces.length > 0 && wordleId) {
    byAuthor[author.id].messages[wordleId] = {
      author: author,
      scorePiece,
      boardPieces,
      created: message.createdAt.getTime(),
      hardMode: scorePiece.includes('*'),
    };
    return true;
  }
};

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
    processMessage(message);
  });
  runMeta.wordleMessagesByAuthor = byAuthor;
};

const COMMANDS = {
  Ping: 'ping',
  Leaderboard: 'leaderboard',
};

const BUTTONS = {
  AllTime: 'all time',
  FuckTheNonePlayers: 'fuck the none players (every day you dont play counts as 7)',
  Weekly: 'weekly',
  HardMode: 'hard mode only (weekly)',
};

const computeWordleStats = (buttonId) => {
  let computed = Object.values(runMeta.wordleMessagesByAuthor)
    .filter((wordleInfo) => wordleInfo.messages.length > 0)
    .map((wordleInfo) => {
      let messages = Object.values(wordleInfo.messages);
      if (
        buttonId === BUTTONS.Weekly ||
        buttonId === BUTTONS.FuckTheNonePlayers ||
        buttonId === BUTTONS.HardMode
      ) {
        messages = messages.filter(
          (message) =>
            message.created > new Date().getTime() - 7 * 24 * 60 * 60 * 1000 &&
            (buttonId === BUTTONS.HardMode ? message.hardMode === true : true), // 1 week in ms
        );
      }
      wordleInfo.total = messages.length;
      wordleInfo.scores = [];

      const totalNumGuesses = messages.reduce((acc, message) => {
        const guessInfo = message.scorePiece.split(' ').find((piece) => piece.includes('/6'));
        if (!guessInfo) console.log(message);
        let guessesForWordleInstance;
        const guesses = guessInfo.split('/')[0];
        if (!guesses) {
          return;
        }
        const stringGuess = guesses.toString().toLowerCase();
        if (stringGuess === 'x') {
          guessesForWordleInstance = 7;
        } else {
          guessesForWordleInstance = Number(guesses);
        }
        if (guessesForWordleInstance > 0) {
          wordleInfo.scores.push({ score: guessesForWordleInstance, date: message.created });
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

  if (buttonId === BUTTONS.FuckTheNonePlayers) {
    computed = computed.map((wordleInfo) => {
      if (wordleInfo.total < 7) {
        const applyFuckYou = 7 - wordleInfo.total;
        wordleInfo.average = (
          (Number(wordleInfo.average) * Number(wordleInfo.total) + 7 * applyFuckYou) /
          7
        ).toFixed();
        wordleInfo.total = 7;
      }
      return wordleInfo;
    });
  }
  console.log('\n');
  return computed.sort((a, b) => (a.average < b.average ? -1 : 1));
};

const fetchLeaderboard = async (interaction, buttonId) => {
  const computed = computeWordleStats(buttonId);

  const embedTable = [];
  computed.forEach((scoreForUser) => {
    if (!isNaN(scoreForUser.average)) {
      const best = scoreForUser.scores.reduce((a, b) =>
        Math.min(a.score, b.score) === a.score ? a : b,
      );
      const worst = scoreForUser.scores.reduce((a, b) =>
        Math.max(a.score, b.score) === a.score ? a : b,
      );
      embedTable.push({
        name: scoreForUser.author.username,
        value: `score: ${scoreForUser.average.toString()}\ngames played: ${scoreForUser.total.toString()}\nbest: ${best.score.toString()}\nworst: ${worst.score.toString()}`,
      });
    }
  });
  interaction.reply({
    embeds: [
      new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Current Leaderboard: ${buttonId}`)
        .addFields(embedTable),
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
          new MessageButton().setCustomId(BUTTONS.AllTime).setLabel('all Time').setStyle('PRIMARY'),
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
    await fetchLeaderboard(interaction, buttonId);
  }
});

// Login to Discord with your client's token
client.login(token);
