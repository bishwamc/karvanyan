/**
 * story.js — the story spine of v4, as data plus a few small pure helpers.
 *
 * It owns: the six chapters, Daulat Beg's letters, the once-only margin notes, the party-gap lines for the start
 * screen, the day-3 lame-camel crisis, and the chapter-end lessons. Nothing here touches the page, so Node can load it
 * for tests and bots. To add a letter, note or storylet, edit the lists below (see docs/V4-CONTENT-GUIDE.md).
 *
 * Content rules (checked by tools/lint-content.mjs): paragraphs of 45 words or fewer, plain words, no game jargon.
 * Uncertain history is hedged. Mirza Nadir and his house are fictional.
 */
(function (namespace) {
  'use strict';

  const World = namespace.World;

  /**
   * @typedef {Object} Chapter
   * @property {number} number
   * @property {string} title
   * @property {string} endNodeId   the stop where the chapter-end screen is shown
   * @property {string[]} learned   three things the road taught, shown on the chapter-end screen
   */

  /** @type {ReadonlyArray<Chapter>} */
  const CHAPTERS = Object.freeze([
    { number: 1, title: 'Kabul to the Indus', endNodeId: 'attock', learned: [
      'A camel carries about as much as two mules, but it feels the cold more.',
      'Food for people and feed for animals run out at different speeds. Count both.',
      'Tolls in the Khyber were often more custom than law. Men with swords set the price.'] },
    { number: 2, title: 'The Salt Range', endNodeId: 'lahore', learned: [
      'The Indus was crossed by ferry and boat bridge. Nobody forded it with loaded animals.',
      'Rohtas, a great fort of the 1540s, guarded the road long after its builder was gone.',
      'Lahore was one of the largest cities in the empire. Prices there set prices elsewhere.'] },
    { number: 3, title: 'Five Rivers to the Capital', endNodeId: 'delhi', learned: [
      'The Grand Trunk Road ran past kos minars, small towers that marked the distance.',
      'Ferries on the Beas and Sutlej charged more when the water was high.',
      'Delhi, rebuilt by Shah Jahan as Shahjahanabad, was the seat of the court.'] },
    { number: 4, title: 'The Imperial Plain', endNodeId: 'allahabad', learned: [
      'Winter fog on the plain slowed caravans. Many merchants waited for spring.',
      'Agra held the Taj Mahal, finished a few years before this journey.',
      'Allahabad, at the meeting of two rivers, drew pilgrims and boatmen alike.'] },
    { number: 5, title: 'The Holy River', endNodeId: 'patna', learned: [
      'Crowds at pilgrim cities spread sickness. A clean water supply mattered.',
      'Varanasi was a centre of learning and of silk brocade weaving.',
      'Patna was a river port where saltpetre and rice were shipped east and south.'] },
    { number: 6, title: 'Into Bengal', endNodeId: 'dhaka', learned: [
      'Bengal was rich in rice, silk and cotton, and its fevers were feared by travellers.',
      'Rivers, not roads, carried most goods across the delta.',
      'Dhaka was a provincial capital and a busy port, known for its fine muslin.'] },
  ]);

  /**
   * @typedef {Object} Letter
   * @property {string} id
   * @property {number} chapterNumber  the chapter this letter opens
   * @property {string} stopId         where the sealed letter waits
   * @property {string[]} paragraphs
   */

  /** @type {ReadonlyArray<Letter>} */
  const LETTERS = Object.freeze([
    { id: 'letter_1', chapterNumber: 1, stopId: 'kabul', paragraphs: [
      'My friend\'s child,',
      'Your uncle trusted me with your road, so hear me. The road to Dhaka is long: four months if God is kind, six if He is testing you.',
      'Carry what you can sell, but never so much that your camels cannot carry bread. A merchant who starves beside full bales is a fool, not a merchant.',
      'First, reach Jalalabad. Buy oranges. Trust nobody who smiles too much at the Khyber.',
      'Daulat Beg'] },
    { id: 'letter_2', chapterNumber: 2, stopId: 'attock', paragraphs: [
      'You crossed the mountains. Good. Now the bad news.',
      'Mirza Nadir\'s house has sent a caravan east with goods like yours. Whoever reaches Dhaka first sells high. Whoever comes second sells to what is left.',
      'Do not race him into the river. The Indus has buried faster men than you.',
      'Daulat Beg'] },
    { id: 'letter_3', chapterNumber: 3, stopId: 'lahore', paragraphs: [
      'Lahore will tempt you to sell everything. Sell a little. The further east you carry silk and carpets, the more they are worth.',
      'Five rivers lie between you and Delhi. Ask every ferryman about the water before you ask his price.',
      'Daulat Beg'] },
    { id: 'letter_4', chapterNumber: 4, stopId: 'delhi', paragraphs: [
      'The emperor\'s city. Be polite to every official, even the rude ones. Especially the rude ones.',
      'Winter fog lies on the plain until spring. Some merchants wait here. Waiting costs rent; hurrying can cost lives. That choice I leave to you.',
      'Daulat Beg'] },
    { id: 'letter_5', chapterNumber: 5, stopId: 'allahabad', paragraphs: [
      'Here two rivers meet, and so do a hundred thousand pilgrims. Where crowds drink, sickness follows. Boil your water. Keep your hakim close.',
      'Patna\'s buyers pay in silver and remember faces. Be someone they want to see again.',
      'Daulat Beg'] },
    { id: 'letter_6', chapterNumber: 6, stopId: 'patna', paragraphs: [
      'I have not told you why I know this road so well.',
      'Thirty years ago your grandfather and I took it together. At Rajmahal the fever took him in three days. I carried his goods to Dhaka and his name home.',
      'Do better than I did. Reach Dhaka with everyone you love.',
      'Daulat Beg'] },
  ]);

  /**
   * One-time margin notes from Daulat Beg. Their text is in the copy deck (Content.COPY, keys `coach.<id>`).
   * Each is shown once, at the moment it matters, and remembered in state.story.coachNotesSeen.
   */
  const COACH_NOTE_IDS = Object.freeze(['firstBuy', 'firstLoad', 'firstSick', 'firstNight', 'firstRiver', 'firstToll']);

  /** The live line under the party grid when a role is missing. */
  const GAP_LINES = Object.freeze({
    healer: 'No healer. Fevers will last longer, and Peshawar is fever country.',
    cook: 'No cook. You will eat more and trust kitchens less.',
    interpreter: 'No interpreter. Toll-takers will see you coming.',
    handler: 'No animal handler. Lame animals will stay lame.',
    accountant: 'No accountant. You will sell surplus at a loss.',
    hunter: 'No hunter. Rest days will find less food.',
  });

  /** The six roles in the order the start screen shows them, with the curated candidate offered for each. */
  const START_ROLE_ORDER = Object.freeze(['healer', 'cook', 'interpreter', 'handler', 'accountant', 'hunter']);
  const CURATED_CANDIDATE_BY_ROLE = Object.freeze({
    healer: 'hakim_jafar', cook: 'bibi_gulnar', interpreter: 'naseer', handler: 'sher_dil', accountant: 'munshi_kishan', hunter: 'gul_zaman',
  });

  // ---------------------------------------------------------------------------
  // The day-3 crisis (spec 6.6): the first real stake, and the lesson in how the load works.
  // Effects use the storylet vocabulary in events.js; `lines` are spoken only if that role walks with the caravan.
  // ---------------------------------------------------------------------------

  const CRISIS_ID = 'crisis_lame_camel';

  const CRISIS_STORYLET = Object.freeze({
    id: CRISIS_ID, kind: 'crisis', icon: '🐪', title: 'The lame camel', once: true, imageId: 'ev_lame_camel',
    text: ['Snow came early to the gorges. In the grey light Zard, your strongest camel, slips on the ice and comes up limping.'],
    lines: [
      { role: 'handler', text: '{name}: "She can walk, but not with that load. Something comes off her back tonight."', fallback: 'The camel can walk, but not with that load.' },
      { role: 'accountant', text: '{name}: "Leave the bales and we reach Dhaka with nothing to sell."' },
      { role: 'cook', text: '{name}: "Leave the flour and we don\'t reach Dhaka at all."' },
    ],
    choices: [
      { id: 'leave_lots', label: 'Leave two lots of cargo', tone: 'safe', effects: [{ cargoLots: -2 }, { flag: 'crisis_done' }], result: 'Two bales sit in the snow. Your profit is lighter; so is Zard.' },
      { id: 'spread', label: 'Spread her load over the others', tone: 'risky', effects: [{ allAnimalHp: -10 }, { slowDays: 3 }, { flag: 'crisis_done' }], result: 'The others groan under it, but nothing is lost. Yet.' },
      { id: 'leave_rations', label: 'Leave 20 rations', tone: 'risky', effects: [{ rations: -20 }, { flag: 'crisis_done' }], result: 'Flour on the snow. The cook says nothing, loudly.' },
      { id: 'put_down', label: 'Put her down and take everything', tone: 'danger', effects: [{ loseStrongestAnimal: true }, { flag: 'crisis_done' }], result: 'It is done quickly. Nobody speaks for a while.' },
    ],
  });

  /** Storylets this module adds to the shared pool in events.js. */
  const STORYLETS = Object.freeze([CRISIS_STORYLET]);

  // ---------------------------------------------------------------------------
  // Pure helpers
  // ---------------------------------------------------------------------------

  /**
   * The chapter a stop belongs to. A chapter's last stop belongs to that chapter, so Attock is still chapter 1
   * and the player becomes chapter 2 when they set out from it.
   * @param {string} nodeId
   * @returns {number} 1-6
   */
  function getChapterNumberForNode(nodeId) {
    const nodeIndex = World.getNodeIndex(nodeId);
    if (nodeIndex < 0) return 1;
    const finishedBefore = CHAPTERS.filter((chapter) => World.getNodeIndex(chapter.endNodeId) < nodeIndex).length;
    return Math.min(CHAPTERS.length, finishedBefore + 1);
  }

  /** @param {number} number @returns {Chapter|null} */
  function getChapter(number) {
    return CHAPTERS.find((chapter) => chapter.number === number) || null;
  }

  /** @param {string} nodeId @returns {Chapter|null} the chapter that ends here, if any */
  function getChapterEndingAt(nodeId) {
    return CHAPTERS.find((chapter) => chapter.endNodeId === nodeId) || null;
  }

  /** @param {string} stopId @returns {Letter|null} the sealed letter that waits at this stop, if any */
  function findLetterForStop(stopId) {
    return LETTERS.find((letter) => letter.stopId === stopId) || null;
  }

  /** @param {string} letterId @returns {Letter|null} */
  function findLetter(letterId) {
    return LETTERS.find((letter) => letter.id === letterId) || null;
  }

  /**
   * Story state for a new or migrated game (save schema 3).
   * @param {{nodeId:string, party?:Array<{candidateId:string|null, isAlive?:boolean}>}} basis
   * @returns {Object}
   */
  function createStoryState(basis) {
    const moods = {};
    (basis.party || []).forEach((member) => {
      if (member.candidateId && member.isAlive !== false) moods[member.candidateId] = 60;
    });
    return {
      chapterNumber: getChapterNumberForNode(basis.nodeId),
      lettersOpened: [],
      companionMoodById: moods,
      arcBeatsDoneById: {},
      rivalKosOnRoute: World.getKosBefore ? World.getKosBefore(basis.nodeId) : 0,
      rumoursHeard: [],
      coachNotesSeen: {},
      strangerFavour: {},
    };
  }


  /** @param {Object} state @returns {boolean} true if some living member is ill */
  const hasIllMember = (state) => state.party.some((member) => member.isAlive && member.illness);

  /**
   * Which margin note, if any, fits this moment and has not been shown yet (v4 N3). One at a time.
   * @param {Object} state
   * @returns {string|null} a note id from COACH_NOTE_IDS
   */
  function pickMarginNoteId(state) {
    if (!state || !state.story || state.phase === 'ended') return null;
    const seen = state.story.coachNotesSeen || {};
    const wanted = [];
    const pending = state.pending;
    if (pending) {
      if (pending.kind === 'night') wanted.push('firstNight');
      if (pending.kind === 'crossing') wanted.push('firstRiver');
      if (pending.kind === 'checkpoint') wanted.push('firstToll');
      if (pending.id === CRISIS_ID) wanted.push('firstLoad');
    } else if (state.phase === 'stop') {
      if (state.nodeId === World.FIRST_NODE_ID && state.dayIndex === 0) wanted.push('firstBuy');
      if (state.flags && state.flags.crisis_done) wanted.push('firstLoad');
      if (hasIllMember(state)) wanted.push('firstSick');
    } else if (hasIllMember(state)) wanted.push('firstSick');
    return wanted.find((id) => !seen[id]) || null;
  }

  /** @returns {Object} a new state with the margin note remembered, so it never shows again */
  function markCoachNoteSeen(state, noteId) {
    if (!state.story || !COACH_NOTE_IDS.includes(noteId)) return state;
    return { ...state, story: { ...state.story, coachNotesSeen: { ...state.story.coachNotesSeen, [noteId]: true } } };
  }

  /** The sealed letter waiting at this stop, if the player has not opened it yet. */
  function getUnopenedLetter(state) {
    if (!state.story || state.phase !== 'stop') return null;
    const letter = findLetterForStop(state.nodeId);
    return letter && !state.story.lettersOpened.includes(letter.id) ? letter : null;
  }

  /** @returns {Object} a new state with this letter marked as opened */
  function markLetterOpened(state, letterId) {
    if (!state.story || !findLetter(letterId) || state.story.lettersOpened.includes(letterId)) return state;
    return { ...state, story: { ...state.story, lettersOpened: [...state.story.lettersOpened, letterId] } };
  }

  /**
   * A chapter-end screen is due when the caravan has just arrived at a chapter's last stop for the first time.
   * The last chapter is not included: Dhaka has the full ending screen.
   * @returns {Chapter|null}
   */
  function getChapterEndDue(previousState, nextState) {
    if (!previousState || !nextState || nextState.phase !== 'stop' || previousState.nodeId === nextState.nodeId) return null;
    const chapter = getChapterEndingAt(nextState.nodeId);
    if (!chapter || chapter.number >= CHAPTERS.length) return null;
    return nextState.flags && nextState.flags[`chapter_done_${chapter.number}`] ? null : chapter;
  }

  /** A short word for how the cargo looks, from its condition (0-1). */
  function describeCargoCondition(condition) {
    if (condition >= 0.9) return 'fine';
    if (condition >= 0.7) return 'fair';
    return 'poor';
  }

  namespace.Story = Object.freeze({
    CHAPTERS, LETTERS, COACH_NOTE_IDS, GAP_LINES, START_ROLE_ORDER, CURATED_CANDIDATE_BY_ROLE, CRISIS_ID, STORYLETS,
    getChapterNumberForNode, getChapter, getChapterEndingAt, pickMarginNoteId, markCoachNoteSeen, getUnopenedLetter, markLetterOpened, getChapterEndDue, describeCargoCondition, findLetterForStop, findLetter, createStoryState,
  });
})(window.Karvanyan);
