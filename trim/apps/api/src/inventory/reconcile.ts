export type TagComparison = {
  matched: string[];
  extraTags: string[];
  missingTags: string[];
};

/** Compare local plant tags with tags from an imported inventory file. Neither side is modified. */
export function compareTags(localTags: string[], importedTags: string[]): TagComparison {
  const local = new Set(localTags);
  const imported = new Set(importedTags);
  return {
    matched: localTags.filter((tag) => imported.has(tag)),
    extraTags: [...imported].filter((tag) => !local.has(tag)).sort(),
    missingTags: localTags.filter((tag) => !imported.has(tag)),
  };
}
