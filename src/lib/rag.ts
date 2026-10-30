import { prisma } from "./prisma";

export interface RetrievedChunk {
  documentId: string;
  documentTitle: string;
  category: string;
  isPastExam: boolean;
  textSnippet: string;
  score: number;
}

/**
 * Searches the parsed text of all indexed documents for a given module.
 * Uses term-frequency and semantic overlap to retrieve the most relevant sections.
 */
export async function searchModuleDocuments(
  moduleId: string,
  query: string,
  limit: number = 3
): Promise<RetrievedChunk[]> {
  const documents = await prisma.document.findMany({
    where: {
      moduleId,
      isIndexed: true,
      parsedText: { not: null },
    },
  });

  if (!documents.length) return [];

  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\säöüß]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const chunks: RetrievedChunk[] = [];

  for (const doc of documents) {
    if (!doc.parsedText) continue;

    // Split document into paragraphs/sections
    const paragraphs = doc.parsedText
      .split(/\n\s*\n|\n(?=[A-ZÄÖÜ0-9\s_-]+:)/)
      .map((p) => p.trim())
      .filter((p) => p.length > 30);

    for (const paragraph of paragraphs) {
      const lowerPara = paragraph.toLowerCase();
      let matchCount = 0;

      for (const term of queryTerms) {
        if (lowerPara.includes(term)) {
          matchCount += 1;
        }
      }

      // Bonus if it's a past exam and query is looking for exam style
      const isPastExam = doc.category === "EXAM_PAST";
      const score = matchCount / Math.max(queryTerms.length, 1) + (isPastExam ? 0.1 : 0);

      if (matchCount > 0) {
        chunks.push({
          documentId: doc.id,
          documentTitle: doc.title,
          category: doc.category,
          isPastExam,
          textSnippet: paragraph,
          score,
        });
      }
    }
  }

  // Sort descending by score
  chunks.sort((a, b) => b.score - a.score);
  return chunks.slice(0, limit);
}

/**
 * Extracts past exam style traits from past exams in this module
 */
export async function getPastExamStyleContext(moduleId: string): Promise<string> {
  const pastExams = await prisma.document.findMany({
    where: {
      moduleId,
      category: "EXAM_PAST",
      isIndexed: true,
    },
    take: 2,
  });

  if (!pastExams.length) {
    return "Keine Altklausuren hinterlegt. Standard-Prüfungsfragen anwenden.";
  }

  const excerpts = pastExams
    .map((e) => `[Altklausur: ${e.title}]\n${e.parsedText?.slice(0, 1000)}...`)
    .join("\n\n");

  return `Hinterlegte Altklausuren des Dozenten zur Stiladaption:\n${excerpts}`;
}
