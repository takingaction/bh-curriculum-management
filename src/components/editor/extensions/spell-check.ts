import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import Typo from "typo-js";

let dictionary: Typo | null = null;

try {
  dictionary = new Typo("en_US", null, null, {
    dictionaryPath: "typo",
  });
} catch (e) {
  console.warn("SpellCheck: Could not load dictionary", e);
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
            if (!extension.storage.enabled || !dictionary) return null;

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
                  if (cleanWord.length > 1 && !dictionary.check(cleanWord)) {
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
