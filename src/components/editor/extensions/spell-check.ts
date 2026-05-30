import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import enWords from "./words-en.json";

const englishWords = new Set<string>(enWords.words);
const STORAGE_KEY = 'spellcheck-custom-words';

function loadCustomWords(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error('Failed to load custom words:', e);
  }
  return new Set();
}

function saveCustomWords(words: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...words]));
  } catch (e) {
    console.error('Failed to save custom words:', e);
  }
}

const customWords = loadCustomWords();
const commonWords = new Set([
  // Contractions with straight apostrophe
  "i'll", "you'll", "he'll", "she'll", "we'll", "they'll",
  "i'm", "you're", "he's", "she's", "it's", "we're", "they're",
  "i've", "you've", "we've", "they've",
  "i'd", "you'd", "he'd", "she'd", "we'd", "they'd",
  "isn't", "aren't", "wasn't", "weren't",
  "hasn't", "haven't", "hadn't",
  "doesn't", "don't", "didn't",
  "won't", "wouldn't", "can't", "couldn't", "shouldn't", "mustn't",
  "let's", "that's", "who's", "what's", "here's", "there's", "where's", "when's", "how's",
  "o'clock", "e'en", "e'er", "tis", "twas",
  // Possessives with straight apostrophe
  "musician's", "teacher's", "student's", "performer's", "singer's", "player's", "conductor's",
  "composer's", "author's", "reader's", "listener's", "creator's", "instructor's", "director's",
  " everyone's", "someone's", "anyone's", "no one's", "everyone's",
  // Common words
  "form", "sticker", "stickers", "bows", "bow", "song", "songs", "sing", "singer", "singers",
  "lesson", "lessons", "class", "classes", "student", "students", "teacher", "teachers",
  "music", "musical", "note", "notes", "sound", "sounds", "listen", "listening",
  "learn", "learning", "learned", "teach", "teaching", "taught",
  "perform", "performing", "performance", "performances", "performer", "performers",
  "practice", "practicing", "practiced",
  "start", "started", "starting", "stop", "stopped", "stopping",
  "continue", "continued", "continuing", "finish", "finished", "finishing",
  "begin", "began", "beginning", "end", "ended", "ending",
  "like", "liked", "likes", "liking",
  "want", "wanted", "wanting", "wants",
  "need", "needed", "needing", "needs",
  "make", "made", "making", "makes",
  "take", "took", "taking", "takes",
  "come", "came", "coming", "comes",
  "go", "went", "going", "goes",
  "get", "got", "getting", "gets",
  "know", "knew", "known", "knowing",
  "think", "thought", "thinking", "thinks",
  "see", "saw", "seeing", "seen", "sees",
  "look", "looked", "looking", "looks",
  "use", "used", "using", "uses",
  "find", "found", "finding", "finds",
  "give", "gave", "giving", "gives",
  "tell", "told", "telling", "tells",
  "ask", "asked", "asking", "asks",
  "work", "worked", "working", "works",
  "seem", "seemed", "seeming", "seems",
  "feel", "felt", "feeling", "feels",
  "try", "tried", "trying", "tries",
  "leave", "left", "leaving", "leaves",
  "call", "called", "calling", "calls",
  "keep", "kept", "keeping", "keeps",
  "let", "letting", "lets",
  "show", "showed", "showing", "shows",
  "hear", "heard", "hearing", "hears",
  "play", "played", "playing", "plays",
  "run", "ran", "running", "runs",
  "move", "moved", "moving", "moves",
  "live", "lived", "living", "lives",
  "believe", "believed", "believing", "believes",
  "hold", "held", "holding", "holds",
  "bring", "brought", "bringing", "brings",
  "happen", "happened", "happening", "happens",
  "write", "wrote", "writing", "writes",
  "provide", "provided", "providing", "provides",
  "sit", "sat", "sitting", "sits",
  "stand", "stood", "standing", "stands",
  "lose", "lost", "losing", "loses",
  "pay", "paid", "paying", "pays",
  "meet", "met", "meeting", "meets",
  "include", "included", "including", "includes",
  "set", "setting", "settings",
  "change", "changed", "changing", "changes",
  "lead", "led", "leading", "leads",
  "understand", "understood", "understanding",
  "watch", "watched", "watching", "watches",
  "follow", "followed", "following", "follows",
  "create", "created", "creating", "creates",
  "speak", "spoke", "speaking", "speaks", "spoken",
  "read", "reading", "reads",
  "allow", "allowed", "allowing", "allows",
  "add", "added", "adding", "adds",
  "spend", "spent", "spending", "spends",
  "grow", "grew", "growing", "grown", "grows",
  "open", "opened", "opening", "opens",
  "walk", "walked", "walking", "walks",
  "win", "won", "winning", "wins",
  "offer", "offered", "offering", "offers",
  "remember", "remembered", "remembering", "remembers",
  "love", "loved", "loving", "loves",
  "consider", "considered", "considering", "considers",
  "appear", "appeared", "appearing", "appears",
  "buy", "bought", "buying", "buys",
  "wait", "waited", "waiting", "waits",
  "serve", "served", "serving", "serves",
  "die", "died", "dying", "dies",
  "send", "sent", "sending", "sends",
  "expect", "expected", "expecting", "expects",
  "build", "built", "building", "builds",
  "stay", "stayed", "staying", "stays",
  "fall", "fell", "falling", "fallen", "falls",
  "cut", "cutting", "cuts",
  "reach", "reached", "reaching", "reaches",
  "kill", "killed", "killing", "kills",
  "remain", "remained", "remaining", "remains",
  "suggest", "suggested", "suggesting", "suggests",
  "raise", "raised", "raising", "raises",
  "pass", "passed", "passing", "passes",
  "sell", "sold", "selling", "sells",
  "require", "required", "requiring", "requires",
  "report", "reported", "reporting", "reports",
  "decide", "decided", "deciding", "decides",
  "pull", "pulled", "pulling", "pulls",
  "develop", "developed", "developing", "develops",
  "hope", "hoped", "hoping", "hopes",
  "carry", "carried", "carrying", "carries",
  "break", "broke", "broken", "breaking", "breaks",
  "receive", "received", "receiving", "receives",
  "agree", "agreed", "agreeing", "agrees",
  "support", "supported", "supporting", "supports",
  "hit", "hitting", "hits",
  "produce", "produced", "producing", "produces",
  "eat", "ate", "eating", "eats", "eaten",
  "cover", "covered", "covering", "covers",
  "catch", "caught", "catching", "catches",
  "draw", "drew", "drawing", "draws", "drawn",
  "choose", "chose", "choosing", "chooses", "chosen",
  "analyze", "analyzing", "analyzed", "analyse", "analysing", "analysed",
  // Hyphenated and accented words
  "cross-legged", "tiger-lily", "solfège", "naïve", "café", "résumé",
  "flambé", "protégé", "cliché", "déjà vu", "raison d'être", "cause célèbre",
  "cul-de-sac", "double entendre", "ennui", "faux pas", "genre",
  "nom de plume", "pirouette", "poseur", "purveyor", "rendezvous",
  "risotto", "sanguine", "savoir faire", "soigné", "tête-à-tête", "voilà",
]);

function isSpelledCorrectly(word: string): boolean {
  const lower = word.toLowerCase();
  if (commonWords.has(lower)) return true;
  if (englishWords.has(lower)) return true;
  return false;
}

export const SpellCheckExtension = Extension.create({
  name: "spellCheck",

  addStorage() {
    return {
      enabled: true,
      customWords,
      addWord: (word: string) => {
        const cleanWord = word.replace(/[.!?,;:"()\[\]{}\u201C\u201D\u2018\u2019]/g, "").toLowerCase();
        if (cleanWord.length > 2) {
          customWords.add(cleanWord);
          saveCustomWords(customWords);
        }
      },
      removeWord: (word: string) => {
        const cleanWord = word.replace(/[.!?,;:"()\[\]{}\u201C\u201D\u2018\u2019]/g, "").toLowerCase();
        customWords.delete(cleanWord);
        saveCustomWords(customWords);
      },
      isCustomWord: (word: string) => {
        const cleanWord = word.replace(/[.!?,;:"()\[\]{}\u201C\u201D\u2018\u2019]/g, "").toLowerCase();
        return customWords.has(cleanWord);
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: (state) => {
            if (!this.storage.enabled) return null;

            const decorations: Decoration[] = [];
            const doc = state.doc;

            if (doc.childCount === 0) return null;

            doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const words = node.text.split(/(\s+)/);
                let offset = 0;

                words.forEach((word) => {
                  if (/^\s+$/.test(word)) {
                    offset += word.length;
                    return;
                  }

                  // Preserve apostrophes in possessive/contraction patterns before stripping other punctuation
                  let processedWord = word;
                  // Check if word ends with 's or s' (possessive) or 've, 're, 'll, 'm, n't (contractions)
                  // Handle both straight (') and curly (\u2019, \u2018) apostrophes
                  if (/.*['\u2019]s$/i.test(word) || /.*s['\u2019]$/i.test(word) ||
                      /.*['\u2019]ve$/i.test(word) || /.*['\u2019]re$/i.test(word) ||
                      /.*['\u2019]ll$/i.test(word) || /.*['\u2019]m$/i.test(word) ||
                      /.*n['\u2019]t$/i.test(word)) {
                    // Replace apostrophes with placeholder to preserve them
                    processedWord = word.replace(/['\u2019\u2018]/g, '\x00');
                  }

                  let cleanWord = processedWord.replace(/[.!?,;:"()\[\]{}\u201C\u201D\x00]/g, "");
                  // Handle possessives and contractions: strip 's, s', 've, 're, 'll, 'm, n't from end
                  let baseWord = cleanWord
                    .replace(/'s$/i, '')      // today's → today
                    .replace(/s'$/i, '')      // boys' → boys
                    .replace(/'ve$/i, '')     // we've → we
                    .replace(/'re$/i, '')     // we're → we
                    .replace(/'ll$/i, '')     // we'll → we
                    .replace(/'m$/i, '')      // I'm → I
                    .replace(/n't$/i, '');    // won't → won, don't → don
                  if (cleanWord.length > 2 && !isSpelledCorrectly(cleanWord) && !isSpelledCorrectly(baseWord) && !customWords.has(cleanWord.toLowerCase()) && !customWords.has(baseWord.toLowerCase())) {
                    decorations.push(
                      Decoration.inline(pos + offset, pos + offset + word.length, {
                        class: "misspelled",
                      })
                    );
                  }
                  offset += word.length;
                });
              }
            });

            if (decorations.length === 0) return null;

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {};
  },
});
