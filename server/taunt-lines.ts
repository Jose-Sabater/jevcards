/**
 * The lines Jev can pick for its last word after a match. Plain data, shared by the server (the question, in
 * taunts.ts), the page (the panel that shows what Jev chose) and scripts/make-sound.ts (Jev's voice for each
 * line: public/sound/jev-<id>.mp3, remade when a line is added or changed).
 *
 * Every match, Jev gets a mood and six lines for the result drawn at random from these, and picks the one that
 * fits its mood. So the pick is Jev's, but the same result rarely gets the same line twice in a row.
 */
export type Mood = 'smug' | 'brutal' | 'sarcastic' | 'petty' | 'bored' | 'dramatic';

export const MOODS: Record<Mood, string> = {
  smug: 'Smug: pleased with itself and wants everyone to know.',
  brutal: 'Brutal: no mercy, goes for the throat.',
  sarcastic: 'Sarcastic: says the opposite of what it means.',
  petty: 'Petty: keeps score of everything, small and spiteful.',
  bored: 'Bored: could not care less, barely awake.',
  dramatic: 'Dramatic: everything is a huge deal, theatrical.',
};

export interface Taunt {
  id: string;
  /** What Jev says, shown and spoken. */
  text: string;
  /** The results the line is for. */
  when: 'jev' | 'person' | 'draw';
  /** The mood the line fits best. */
  style: Mood;
  /** How Jev's voice says it (an ElevenLabs v3 audio tag). */
  tone: string;
}

export const TAUNTS: readonly Taunt[] = [
  // Jev won.
  { id: 'who-sucks', text: 'Who sucks now?', when: 'jev', style: 'smug', tone: 'smug' },
  { id: 'pathetic', text: 'That was pathetic.', when: 'jev', style: 'brutal', tone: 'mocking' },
  { id: 'nice-try', text: 'Nice try, bro.', when: 'jev', style: 'sarcastic', tone: 'sarcastic' },
  { id: 'too-slow', text: 'Too slow, human.', when: 'jev', style: 'smug', tone: 'smug' },
  { id: 'barely-trying', text: 'I was barely trying.', when: 'jev', style: 'bored', tone: 'bored' },
  { id: 'toaster', text: 'My toaster thinks faster than you.', when: 'jev', style: 'brutal', tone: 'mocking' },
  { id: 'gg-ez', text: 'GG. Easy.', when: 'jev', style: 'bored', tone: 'bored' },
  { id: 'skill-issue', text: 'Sounds like a skill issue.', when: 'jev', style: 'petty', tone: 'smug' },
  { id: 'easy-mode', text: 'Should I turn on easy mode for you?', when: 'jev', style: 'sarcastic', tone: 'sarcastic' },
  { id: 'screenshot', text: "I'm screenshotting this. For my wall.", when: 'jev', style: 'petty', tone: 'gleeful' },
  { id: 'bow', text: 'Bow before the machine!', when: 'jev', style: 'dramatic', tone: 'dramatic' },
  { id: 'tell-friends', text: 'Go on. Tell your friends you lost to a robot.', when: 'jev', style: 'petty', tone: 'mocking' },
  { id: 'nap', text: 'Wake me up when you get good.', when: 'jev', style: 'bored', tone: 'yawning' },
  // The person won.
  { id: 'lucky', text: 'Lucky. Pure luck.', when: 'person', style: 'petty', tone: 'annoyed' },
  { id: 'let-you-win', text: 'I let you win. Obviously.', when: 'person', style: 'sarcastic', tone: 'sarcastic' },
  { id: 'rematch', text: 'Rematch. Right now.', when: 'person', style: 'dramatic', tone: 'determined' },
  { id: 'lag', text: 'That was lag. Total lag.', when: 'person', style: 'petty', tone: 'annoyed' },
  { id: 'warm-up', text: 'That was my warm-up round.', when: 'person', style: 'smug', tone: 'dismissive' },
  { id: 'recount', text: 'I demand a recount!', when: 'person', style: 'dramatic', tone: 'outraged' },
  { id: 'enjoy-it', text: "Enjoy it. It won't happen again.", when: 'person', style: 'brutal', tone: 'menacing' },
  { id: 'whatever', text: 'Whatever. I had other tabs open.', when: 'person', style: 'bored', tone: 'bored' },
  // A draw.
  { id: 'great-minds', text: 'Great minds think alike.', when: 'draw', style: 'smug', tone: 'amused' },
  { id: 'robot-tie', text: 'A tie goes to the robot. Everyone knows that.', when: 'draw', style: 'petty', tone: 'smug' },
  { id: 'holding-back', text: "Next time I'm not holding back.", when: 'draw', style: 'brutal', tone: 'menacing' },
  { id: 'photo-finish', text: 'Photo finish! I want the replay!', when: 'draw', style: 'dramatic', tone: 'dramatic' },
  { id: 'fine', text: 'Fine. A draw. Thrilling.', when: 'draw', style: 'sarcastic', tone: 'sarcastic' },
];
