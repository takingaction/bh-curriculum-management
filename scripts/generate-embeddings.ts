/**
 * Embedding Generation Script
 *
 * Generates vector embeddings for all lesson content and stores them in Supabase.
 *
 * Usage:
 *   npx tsx scripts/generate-embeddings.ts
 *
 * Options:
 *   --regenerate   Clear existing embeddings and regenerate
 *   --dry-run      Show what would be processed without saving
 *
 * Environment variables required (in .env.local):
 *   OPENAI_API_KEY           - For OpenAI embeddings (~$0.03 total cost)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Note: You can also set USE_LOCAL_EMBEDDINGS=true to use the free local model
 *       (requires: npm install @xenova/transformers)
 */

import { createClient } from "@supabase/supabase-js";

const TEXT_FIELDS = [
  "lesson_outline",
  "learning_objectives",
  "vocabulary",
  "materials",
  "vapa_text_block",
  "ncas_text_block",
  "welcome_opening",
  "actual_class_expectations",
  "warm_up",
  "lesson_hook",
  "main_activity",
  "instrument_expectations",
  "reflection",
  "closing_ceremony",
  "assessment",
];

const FIELD_LABELS: Record<string, string> = {
  lesson_outline: "Lesson Outline",
  learning_objectives: "Learning Objectives",
  vocabulary: "Vocabulary",
  materials: "Materials",
  vapa_text_block: "VAPA Standards",
  ncas_text_block: "NCAS Standards",
  welcome_opening: "Welcome and Opening Check-In",
  actual_class_expectations: "Class Expectations and Procedures",
  warm_up: "Warm Up",
  lesson_hook: 'Lesson "Hook"',
  main_activity: "Main Activity",
  instrument_expectations: "Instrument Expectations",
  reflection: "Reflection",
  closing_ceremony: "Closing Ceremony",
  assessment: "Assessment",
};

const CHUNK_SIZE = 500; // characters per chunk
const EMBEDDING_MODEL = "text-embedding-3-small"; // OpenAI's smallest, cheapest model
const EMBEDDING_DIMENSIONS = 1536;

interface Chunk {
  lessonId: string;
  courseId: string;
  fieldName: string;
  fieldLabel: string;
  chunkText: string;
  chunkIndex: number;
}

interface EmbeddingResult {
  id: string;
  lesson_id: string;
  field_name: string;
  chunk_text: string;
  chunk_index: number;
  embedding: number[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text: string, chunkSize: number): string[] {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (currentChunk.length + trimmed.length + 1 <= chunkSize) {
      currentChunk += (currentChunk ? ". " : "") + trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = trimmed;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  return chunks;
}

async function generateOpenAIEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // OpenAI limit
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function generateLocalEmbedding(
  text: string
): Promise<number[]> {
  const { pipeline, env } = await import("@xenova/transformers");

  env.allowLocalModels = false;
  env.useBrowserCache = false;
  env.useCache = false;

  const embedder = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );

  const result = await embedder(text.slice(0, 500), {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(result.data);
}

async function generateEmbedding(
  text: string,
  useLocal: boolean,
  apiKey?: string
): Promise<number[]> {
  if (useLocal) {
    console.log("  Using local embedding model (first time may take a while to download)...");
    return generateLocalEmbedding(text);
  }
  return generateOpenAIEmbedding(text, apiKey!);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const regenerate = args.includes("--regenerate");
  const dryRun = args.includes("--dry-run");
  const useLocal = process.env.USE_LOCAL_EMBEDDINGS === "true";
  const openAiKey = process.env.OPENAI_API_KEY;

  if (!useLocal && !openAiKey) {
    console.error(
      "Error: OPENAI_API_KEY environment variable is required.\n" +
        "Set USE_LOCAL_EMBEDDINGS=true to use the free local model instead."
    );
    process.exit(1);
  }

  console.log("\n=== Embedding Generation Script ===\n");
  console.log(`Mode: ${useLocal ? "Local (free)" : "OpenAI (~$0.03)"}`);
  console.log(`Regenerate: ${regenerate}`);
  console.log(`Dry run: ${dryRun}\n`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (regenerate) {
    console.log("Clearing existing embeddings...");
    await supabase.from("lesson_embeddings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    console.log("Done.\n");
  }

  console.log("Fetching lessons...");
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select(
      "id, course_id, lesson_number, title, course: courses(id, title, discipline, grade), " +
        TEXT_FIELDS.join(", ")
    );

  if (lessonsError) {
    console.error("Error fetching lessons:", lessonsError);
    process.exit(1);
  }

  if (!lessons || lessons.length === 0) {
    console.log("No lessons found.");
    process.exit(0);
  }

  console.log(`Found ${lessons.length} lessons.\n`);

  const chunks: Chunk[] = [];

  for (const lesson of lessons) {
    const course = lesson.course as any;
    const courseTitle = course?.title || "Unknown Course";
    const grade = course?.grade || "";
    const lessonInfo = `${courseTitle} - Grade ${grade} | Lesson ${lesson.lesson_number}: ${lesson.title}`;

    console.log(`Processing: ${lessonInfo}`);

    for (const fieldName of TEXT_FIELDS) {
      const fieldValue = lesson[fieldName];
      if (!fieldValue || typeof fieldValue !== "string") continue;

      const plainText = stripHtml(fieldValue);
      if (plainText.trim().length < 30) continue;

      const fieldChunks = chunkText(plainText, CHUNK_SIZE);
      const fieldLabel = FIELD_LABELS[fieldName] || fieldName;

      fieldChunks.forEach((chunkText, index) => {
        chunks.push({
          lessonId: lesson.id,
          courseId: lesson.course_id,
          fieldName,
          fieldLabel,
          chunkText: `[${fieldLabel}] ${chunkText}`,
          chunkIndex: index,
        });
      });

      console.log(`  ${fieldLabel}: ${fieldChunks.length} chunks`);
    }
  }

  console.log(`\nTotal chunks: ${chunks.length}`);

  if (dryRun) {
    console.log("\n[Dry run - no embeddings saved]");
    console.log("Sample chunk:", chunks[0]?.chunkText.slice(0, 100) + "...");
    process.exit(0);
  }

  console.log("\nGenerating embeddings...");

  const embeddings: EmbeddingResult[] = [];
  let processed = 0;
  const rateLimitDelay = useLocal ? 0 : 50; // OpenAI rate limit

  for (const chunk of chunks) {
    try {
      const embedding = await generateEmbedding(
        chunk.chunkText,
        useLocal,
        openAiKey
      );

      embeddings.push({
        id: "", // Will be set by Supabase
        lesson_id: chunk.lessonId,
        field_name: chunk.fieldName,
        chunk_text: chunk.chunkText,
        chunk_index: chunk.chunkIndex,
        embedding,
      });

      processed++;
      if (processed % 50 === 0) {
        console.log(`  Processed ${processed}/${chunks.length}...`);
      }

      if (rateLimitDelay) await delay(rateLimitDelay);
    } catch (error) {
      console.error(`  Error processing chunk ${processed}:`, error);
    }
  }

  console.log(`\nGenerated ${embeddings.length} embeddings.\n`);

  console.log("Uploading to Supabase...");

  const batchSize = 100;
  let uploaded = 0;

  for (let i = 0; i < embeddings.length; i += batchSize) {
    const batch = embeddings.slice(i, i + batchSize);
    const { error } = await supabase
      .from("lesson_embeddings")
      .insert(batch.map((e) => ({
        lesson_id: e.lesson_id,
        field_name: e.field_name,
        chunk_text: e.chunk_text,
        chunk_index: e.chunk_index,
        embedding: e.embedding,
      })));

    if (error) {
      console.error(`Error uploading batch ${i / batchSize}:`, error);
    } else {
      uploaded += batch.length;
      console.log(`  Uploaded ${uploaded}/${embeddings.length}...`);
    }
  }

  console.log("\n=== Done! ===");
  console.log(`Total embeddings: ${embeddings.length}`);
  console.log(`Database records: ${uploaded}`);

  if (!useLocal) {
    console.log(
      "\nNote: OpenAI embedding costs were ~$" +
        (embeddings.length * 125 / 1000000 * 0.02).toFixed(4) +
        " (estimated)"
    );
  }
}

main().catch(console.error);
