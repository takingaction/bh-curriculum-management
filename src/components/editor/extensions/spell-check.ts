import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import Typo from "typo-js";

let dictionary: Typo | null = null;
let dictionaryLoadAttempts = 0;

try {
  dictionary = new Typo("en_US", null, null, {
    dictionaryPath: "typo",
  });
  console.log("SpellCheck: Typo instance created, loaded:", dictionary.loaded);
} catch (e) {
  console.warn("SpellCheck: Could not create Typo instance", e);
}

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
            if (!dictionary) {
              console.log("SpellCheck: No dictionary available");
              return null;
            }
            if (!dictionary.loaded) {
              console.log("SpellCheck: Dictionary not yet loaded");
              return null;
            }

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

                  const cleanWord = word.replace(/[.,!?;:'"()[\]{}]/g, "");
                  if (cleanWord.length > 1) {
                    const isCorrect = dictionary.check(cleanWord);
                    if (!isCorrect) {
                      decorations.push(
                        Decoration.inline(pos + offset, pos + offset + word.length, {
                          class: "misspelled",
                        })
                      );
                    }
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
