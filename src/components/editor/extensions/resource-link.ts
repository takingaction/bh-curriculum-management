import Link from "@tiptap/extension-link";

/**
 * Link extension that supports a `data-asset-id` attribute so lesson HTML
 * can reference an asset by stable UUID instead of by mutable public_url.
 * This makes resource links resilient to file replacement: the lesson view
 * click handler resolves the asset by ID and reads the current public_url
 * fresh from the assets table.
 */
export const ResourceLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-asset-id": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-asset-id"),
        renderHTML: (attributes) => {
          if (!attributes["data-asset-id"]) return {};
          return { "data-asset-id": attributes["data-asset-id"] };
        },
      },
    };
  },
});
