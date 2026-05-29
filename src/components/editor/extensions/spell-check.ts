import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const commonWords = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
  "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
  "is", "are", "was", "were", "been", "has", "had", "does", "did", "should",
  "lesson", "students", "music", "song", "learn", "teacher", "class", "sing", "singers",
  "perform", "performance", "art", "dance", "moving", "movement", "rhythm", "beat",
  "melody", "harmony", "note", "sound", "listen", "voice", "vocal", "instrument",
  "piano", "guitar", "drum", "violin", "orchestra", "band", "choral", "chord",
  "scale", "tempo", "dynamics", "loud", "soft", "fast", "slow", "high", "low",
  "warm", "up", "down", "body", "hands", "feet", "feel", "feelings", "expression",
  "creative", "create", "create", "imagine", "explore", "discover", "share", "together",
  "practice", "prepare", "ready", "begin", "start", "continue", "finish", "end",
  "different", "same", "together", "alone", "group", "partner", "individual",
  "teacher", "student", "friend", "family", "everyone", "each", "every", "all",
  "some", "many", "few", "most", "much", "little", "big", "small", "large", "tiny",
  "short", "long", "tall", "thick", "thin", "light", "dark", "bright", "dull",
  "happy", "sad", "excited", "calm", "angry", "peaceful", "energetic", "gentle", "strong",
  "weak", "smooth", "rough", "hard", "soft", "wet", "dry", "hot", "cold", "warm",
  "cool", "nice", "kind", "mean", "fair", "unfair", "right", "wrong", "good", "bad",
  "best", "worst", "great", "terrible", "wonderful", "amazing", "fantastic", "super",
  "okay", "fine", "alright", "yes", "no", "maybe", "perhaps", "probably", "certainly",
  "absolutely", "definitely", "exactly", "really", "very", "quite", "rather", "somewhat",
  "too", "enough", "much", "many", "few", "little", "lots", "bunch", "plenty",
  "walk", "run", "jump", "skip", "hop", "stand", "sit", "lie", "sleep", "wake",
  "eat", "drink", "play", "work", "rest", "dance", "move", "stop", "go", "come",
  "laugh", "cry", "smile", "frown", "scream", "whisper", "shout", "call", "respond",
  "answer", "ask", "question", "wonder", "think", "feel", "believe", "know", "understand",
  "remember", "forget", "learn", "teach", "show", "tell", "explain", "describe",
  "hear", "see", "watch", "look", "smell", "taste", "touch", "feel", "sense",
  "hold", "grab", "reach", "stretch", "bend", "twist", "turn", "spin", "sway",
  "rock", "roll", "slide", "glide", "float", "fly", "jump", "land", "fall", "rise",
  "grow", "shrink", "increase", "decrease", "change", "transform", "become", "appear",
  "seem", "look", "sound", "smell", "taste", "feel", "seem", "become", "remain",
  "stay", "keep", "leave", "leave", "exit", "enter", "arrive", "depart", "reach",
  "achieve", "accomplish", "complete", "finish", "end", "stop", "halt", "pause",
  "continue", "resume", "repeat", "again", "once", "twice", "first", "second", "third",
  "next", "last", "final", "initial", "beginning", "middle", "center", "outside", "inside",
  "in", "out", "on", "off", "up", "down", "over", "under", "above", "below",
  "between", "among", "through", "across", "around", "behind", "front", "beside", "next",
  "near", "far", "close", "away", "distant", "local", "global", "world", "earth",
  "sky", "sun", "moon", "star", "planet", "space", "nature", "animal", "plant", "tree",
  "flower", "grass", "leaf", "root", "branch", "seed", "fruit", "vegetable", "food",
  "water", "air", "fire", "earth", "element", "weather", "rain", "snow", "sun", "wind",
  "cloud", "storm", "thunder", "lightning", "rainbow", "season", "spring", "summer",
  "fall", "autumn", "winter", "day", "night", "morning", "evening", "afternoon", "midnight",
  "today", "tomorrow", "yesterday", "now", "later", "soon", "before", "after", "during",
  "while", "when", "where", "why", "how", "who", "whom", "whose", "which", "that",
  "this", "these", "those", "here", "there", "everywhere", "somewhere", "nowhere",
  "always", "never", "sometimes", "often", "rarely", "usually", "normally", "generally",
  "usually", "perhaps", "maybe", "possibly", "probably", "certainly", "definitely",
  "absolutely", "exactly", "precisely", "just", "still", "already", "yet", "already",
  "still", "yet", "soon", "just", "only", "even", "also", "too", "very", "really",
  "quite", "rather", "somewhat", "pretty", "fairly", "rather", "quite", "pretty",
  "much", "many", "lots", "bunch", "plenty", "lots", "several", "various", "different",
  "various", "multiple", "single", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "hundred", "thousand", "million", "billion",
  "number", "count", "count", "number", "amount", "quantity", "total", "sum", "plus",
  "minus", "add", "subtract", "multiply", "divide", "equal", "same", "different",
  "like", "unlike", "similar", "same", "equal", "equivalent", "compare", "contrast",
  "more", "less", "most", "least", "greater", "smaller", "bigger", "larger", "smaller",
  "higher", "lower", "taller", "shorter", "longer", "wider", "narrower", "thicker",
  "thinner", "heavier", "lighter", "darker", "lighter", "brighter", "duller", "stronger",
  "weaker", "faster", "slower", "quieter", "louder", "softer", "harder", "easier",
  "harder", "simple", "complex", "complicated", "difficult", "easy", "simple", "basic",
  "advanced", "beginner", "intermediate", "advanced", "expert", "professional", "amateur",
  "trained", "untrained", "skilled", "unskilled", "experienced", "inexperienced", "new",
  "old", "young", "ancient", "modern", "classic", "traditional", "contemporary", "current",
  "present", "past", "future", "history", "future", "present", "past", "old", "new",
  "recent", "latest", "recent", "modern", "ancient", "historical", "traditional", "classic",
]);

export const SpellCheckExtension = Extension.create({
  name: "spellCheck",

  addStorage() {
    return {
      enabled: true,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        props: {
          decorations(state) {
            if (!extension.storage.enabled) return null;

            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const words = node.text.split(/(\s+)/);
                let offset = 0;

                words.forEach((word) => {
                  if (/^\s+$/.test(word)) {
                    offset += word.length;
                    return;
                  }

                  const cleanWord = word.replace(/[.,!?;:'"()[\]{}]/g, "").toLowerCase();
                  if (cleanWord.length > 2 && !commonWords.has(cleanWord)) {
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
});
