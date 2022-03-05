import { GuildMember, Message, Collection } from 'discord.js';
import { Channels } from './channels.js';
import { BUTTONS } from './constants.js';

type WordleMessage = {
  scorePiece: string;
  boardPieces: string[];
  created: Date;
  hardMode: boolean;
};

type WordleScore = {
  score: number;
  date: Date;
};

type AuthorWordleMessages = {
  author: GuildMember;
  messages: Record<string, WordleMessage>;
  total: number;
  scores: WordleScore[];
  average?: string;
};

export class Leaderboard {
  private wordleMessagesByAuthor: Record<string, AuthorWordleMessages>;
  private channelManager: Channels;
  private static readonly daysInWeek: number = 7;
  private static readonly week: number = Leaderboard.daysInWeek * 24 * 60 * 60 * 1000; // 1 week in ms
  private static readonly minPlaysForWeekly: number = 4;
  private static readonly allTimeMinPlays: number = 3;

  constructor(channelManager: Channels) {
    this.wordleMessagesByAuthor = {};
    this.channelManager = channelManager;
  }

  public static isInLastWeek(message: WordleMessage) {
    return message.created.getTime() > new Date().getTime() - Leaderboard.week;
  }

  public async getAllWordleMessagesByAuthor() {
    const wordleChannels = this.channelManager.getWordleChannels();
    for (const channel of wordleChannels) {
      let wordleMessages: Collection<string, Message<boolean>> = new Collection();
      let hasMore = true;
      let beforeMessage;
      while (hasMore) {
        const messages: Collection<string, Message<boolean>> = await channel.messages.fetch({
          limit: 100,
          before: beforeMessage,
        });
        const withWordle = messages.filter((message) =>
          message.content.toLowerCase().includes('wordle'),
        );
        wordleMessages = new Collection([...wordleMessages, ...withWordle]);
        if (messages.size !== 100) {
          hasMore = false;
          continue;
        }
        beforeMessage = messages?.last()?.id;
      }
      const byAuthor = this.wordleMessagesByAuthor || {};

      [...wordleMessages.values()].forEach((message) => {
        this.processMessage(message);
      });
      this.wordleMessagesByAuthor = byAuthor;
    }
  }

  public processMessage(message: Message) {
    const { member: author, content } = message;
    if (!author) {
      console.log('processed message with no author');
      return;
    }
    const byAuthor = this.wordleMessagesByAuthor;
    if (byAuthor[author.id] === undefined) {
      byAuthor[author.id] = { messages: {}, author, scores: [], total: 0 };
    }

    const parsedMessage = content.split('\n');

    const scorePiece = parsedMessage.find(
      (message) => message.includes('Wordle') && message.includes('/6'),
    );
    if (!scorePiece) return;
    const scorePieceChunks = scorePiece.split(' ');
    const wordleStartIndex = scorePieceChunks.findIndex((piece) => piece === 'Wordle');
    const wordleId = scorePiece.split(' ')[wordleStartIndex + 1];
    console.log('wordleid', author.user.username, wordleId);
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
      wordleId
    ) {
      byAuthor[author.id].messages[wordleId] = {
        scorePiece,
        boardPieces,
        created: message.createdAt,
        hardMode: scorePiece.includes('*'),
      };
      return true;
    }
  }

  public computeWordleStats(buttonId: BUTTONS) {
    let computed = Object.values(this.wordleMessagesByAuthor)
      .filter((wordleInfo) => {
        const numMessages = Object.values(wordleInfo.messages).length;
        return numMessages > 0;
      })
      .map((wordleInfo) => {
        let messages = Object.values(wordleInfo.messages).sort(
          (a, b) => b.created.getTime() - a.created.getTime(),
        );
        if (
          buttonId === BUTTONS.Weekly ||
          buttonId === BUTTONS.FuckTheNonePlayers ||
          buttonId === BUTTONS.HardMode
        ) {
          messages = messages.filter(
            (message) =>
              Leaderboard.isInLastWeek(message) &&
              (buttonId === BUTTONS.HardMode ? message.hardMode === true : true),
          );
          if (messages.length > Leaderboard.daysInWeek) {
            messages.pop();
          }
        }
        wordleInfo.total = messages.length;
        wordleInfo.scores = [];
        if (
          buttonId === BUTTONS.Weekly || buttonId === BUTTONS.HardMode
            ? messages.length >= Leaderboard.minPlaysForWeekly
            : true
        ) {
          const totalNumGuesses = messages.reduce((acc, message) => {
            const guessInfo = message.scorePiece.split(' ').find((piece) => piece.includes('/6'));
            if (!guessInfo) console.log('no guess info', message);
            let guessesForWordleInstance;
            const guesses = guessInfo?.split('/')[0];
            if (!guesses) {
              return acc;
            }
            const stringGuess = guesses.toString().toLowerCase();
            if (stringGuess === 'x') {
              guessesForWordleInstance = Leaderboard.daysInWeek;
            } else {
              guessesForWordleInstance = Number(guesses);
            }
            if (Number.isFinite(guessesForWordleInstance) && guessesForWordleInstance > 0) {
              wordleInfo.scores.push({ score: guessesForWordleInstance, date: message.created });
              return guessesForWordleInstance + acc;
            } else {
              wordleInfo.total--;
              return acc;
            }
          }, 0);

          wordleInfo.average = (totalNumGuesses / wordleInfo.total).toFixed(2);
          console.log(wordleInfo.author.user.username, wordleInfo.total, wordleInfo.average);
          return wordleInfo;
        }
      });

    if (buttonId === BUTTONS.FuckTheNonePlayers) {
      computed = computed.map((wordleInfo) => {
        if (!wordleInfo) {
          return;
        }
        if (wordleInfo.total < Leaderboard.daysInWeek) {
          const applyFuckYou = Leaderboard.daysInWeek - wordleInfo.total;
          wordleInfo.average = (
            (Number(wordleInfo.average) * Number(wordleInfo.total) +
              Leaderboard.daysInWeek * applyFuckYou) /
            Leaderboard.daysInWeek
          ).toFixed(2);
          wordleInfo.total = Leaderboard.daysInWeek;
        }
        return wordleInfo;
      });
    }
    if (buttonId === BUTTONS.AllTime) {
      // only show in all time if you've played 3 of the last 7 days
      computed = computed?.filter(
        (byAuthor) =>
          Object.values(byAuthor?.messages || {}).filter((message) =>
            Leaderboard.isInLastWeek(message),
          ).length > Leaderboard.allTimeMinPlays,
      );
    }

    return computed
      .filter((item) => !!item)
      .sort((a, b) => (Number(a?.average) < Number(b?.average) ? -1 : 1));
  }
}
