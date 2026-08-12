import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const MODIFICATION_MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8192;

type ModificationType = "duration" | "translation" | "materials";

interface ModificationDetection {
  isModification: boolean;
  type: ModificationType | null;
  direction: "shorter" | "longer" | null;
  targetFields: string[] | null;
  targetLanguage: string | null;
}

const MODIFICATION_PATTERNS: Record<ModificationType, string[]> = {
  materials: [
    "materials", "add material", "remove material", "change material", "different materials"
  ],
  duration: [
    "shorter", "longer", "reduce", "expand", "condense", "more time",
    "less time", "cut down", "scale down", "scale up", "brief", "concise",
    "30 min", "45 min", "60 min", "20 minute", "30 minute", "40 minute",
    "30 minutes", "45 minutes", "60 minutes", "20 minutes", "40 minutes",
    "not enough time", "too long", "too short", "time constraint"
  ],
  translation: [
    "translate", "translation",
    // Spanish
    "spanish version", "in spanish", "en español", "create a spanish", "make it spanish",
    // French
    "french version", "in french", "create a french", "make it french",
    // German
    "german version", "in german",
    // Portuguese
    "portuguese version", "in portuguese", "brazilian",
    // Chinese
    "chinese version", "in chinese", "mandarin",
    // Japanese
    "japanese version", "in japanese",
    // Korean
    "korean version", "in korean",
    // Russian
    "russian version", "in russian",
    // Arabic
    "arabic version", "in arabic",
    // Hindi
    "hindi version", "in hindi",
    // Italian
    "italian version", "in italian",
    // Dutch
    "dutch version", "in dutch",
    // Polish
    "polish version", "in polish",
    // Vietnamese
    "vietnamese version", "in vietnamese",
    // Greek
    "greek version", "in greek",
    // Hebrew
    "hebrew version", "in hebrew",
    // Thai
    "thai version", "in thai",
    // Urdu
    "urdu version", "in urdu",
    // Swahili
    "swahili version", "in swahili",
    // Tagalog
    "tagalog version", "in tagalog",
    // Creole
    "creole version", "in creole", "haitian creole",
    // Other
    "bilingual", "dual language", "english translation"
  ]
};

const DIRECTION_PATTERNS = {
  shorter: ["shorter", "reduce", "cut down", "condense", "brief", "scale down", "less", "not enough time", "too long", "instead of", "decrease", "min version", "cut to"],
  longer: ["longer", "expand", "more time", "scale up", "more", "too short", "add more", "increase", "max version"]
};

const PROCEED_KEYWORDS = [
  "yes", "yeah", "yep", "sure", "ok", "okay", "do it",
  "go ahead", "proceed", "create it", "make it", "translate it",
  "yes please", "that sounds good", "perfect", "sounds good", "lets do it"
];

function detectModificationRequest(message: string): ModificationDetection {
  const lower = message.toLowerCase();

  let detectedType: ModificationType | null = null;
  let maxMatches = 0;

  for (const [type, patterns] of Object.entries(MODIFICATION_PATTERNS)) {
    const matches = patterns.filter(p => lower.includes(p)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedType = type as ModificationType;
    }
  }

  if (!detectedType || maxMatches < 1) {
    return { isModification: false, type: null, direction: null, targetFields: null, targetLanguage: null };
  }

  let direction: "shorter" | "longer" | null = null;
  for (const [dir, patterns] of Object.entries(DIRECTION_PATTERNS)) {
    if (patterns.some(p => lower.includes(p))) {
      direction = dir as "shorter" | "longer";
      break;
    }
  }

  const targetLanguage = detectedType === "translation" ? extractTargetLanguage(lower) : null;

  return {
    isModification: true,
    type: detectedType,
    direction,
    targetFields: null,
    targetLanguage
  };
}

function extractTargetLanguage(lower: string): string | null {
  const languages = [
    { name: "russian", patterns: ["russian", "in russian"] },
    { name: "spanish", patterns: ["spanish", "en español", "espanol"] },
    { name: "french", patterns: ["french", "in french"] },
    { name: "german", patterns: ["german", "in german"] },
    { name: "portuguese", patterns: ["portuguese", "in portuguese"] },
    { name: "chinese", patterns: ["chinese", "mandarin", "in chinese"] },
    { name: "japanese", patterns: ["japanese", "in japanese"] },
    { name: "korean", patterns: ["korean", "in korean"] },
    { name: "arabic", patterns: ["arabic", "in arabic"] },
    { name: "hindi", patterns: ["hindi", "in hindi"] },
    { name: "italian", patterns: ["italian", "in italian"] },
    { name: "dutch", patterns: ["dutch", "in dutch"] },
    { name: "polish", patterns: ["polish", "in polish"] },
    { name: "vietnamese", patterns: ["vietnamese", "in vietnamese"] },
    { name: "greek", patterns: ["greek", "in greek"] },
    { name: "hebrew", patterns: ["hebrew", "in hebrew"] },
    { name: "thai", patterns: ["thai", "in thai"] },
    { name: "urdu", patterns: ["urdu", "in urdu"] },
    { name: "swahili", patterns: ["swahili", "in swahili"] },
    { name: "tagalog", patterns: ["tagalog", "in tagalog"] },
    { name: "creole", patterns: ["creole", "in creole", "haitian creole"] },
  ];

  for (const lang of languages) {
    if (lang.patterns.some(p => lower.includes(p))) {
      return lang.name;
    }
  }

  return null;
}

function getModificationSystemPrompt(modType: "duration" | "translation", direction: "shorter" | "longer" | null, isEditing: boolean, targetLanguage?: string | null): string {
  const basePrompt = `You are an AI assistant helping a teacher modify lesson content.

The lesson content will be provided below. Analyze it and prepare modifications based on the teacher's request.

IMPORTANT: Your response must be a JSON object with this exact structure:
{
  "modifiedFields": {
    "field_name": { "html": "modified content", "original_length": 100 }
  },
  "summary": "Brief description of changes made"
}`;

  if (modType === "duration") {
    if (direction === "shorter") {
      return basePrompt + `

For a SHORTER version (condensed):
- Remove less essential activities
- Shorter warm-ups and cool-downs
- Focus on core learning objectives
- Keep the most impactful parts
- Reduce time on practice/repetition`;
    } else if (direction === "longer") {
      return basePrompt + `

For a LONGER version (expanded):
- Add more practice time
- Include additional examples or activities
- Extend reflection/discussion time
- Add enrichment activities
- More repetition for mastery`;
    } else {
      return basePrompt + `

For a different duration version:
- Adjust activities to fit target duration
- Scale practice time appropriately
- Maintain core learning objectives`;
    }
  }

  if (modType === "translation") {
    return basePrompt + `

For a TRANSLATION into ${targetLanguage || "the target language"}:
- Translate all content into ${targetLanguage || "the target language"}
- Maintain the structure and formatting
- Keep HTML tags intact
- Preserve all formatting (bold, italic, lists, etc.)
- Do NOT translate:
  - Song lyrics that don't translate well (mark as " [original] ")
  - Tongue twisters (mark as " [English tongue twister] ")
  - Cultural references that may not translate`;
  }

  return basePrompt;
}

function getTranslationQuestionsSystemPrompt(targetLanguage: string): string {
  return `You are an AI assistant helping a teacher translate a lesson into ${targetLanguage}.

The teacher wants to translate this lesson. Before creating the translation, you need to understand their requirements.

IMPORTANT: You are ONLY allowed to ask questions. You are NOT allowed to generate any translated content yourself. Wait for the teacher to click the "Proceed" button.

Ask the teacher the following questions (one at a time, wait for each answer):

1. "Who are your students? (heritage speakers, language learners, or immersion students)"

2. "Should I translate the songs and chants, or keep them in English with the translation noted?"

3. "Any specific terminology preferences? For example, should musical terms stay in Italian (tempo, dynamics) or be translated?"

After getting answers to all three questions, tell the teacher EXACTLY this message:
"I've gathered your requirements. Click 'Proceed' when ready to create the translation."

Do NOT generate any translated content. Do NOT try to process the translation. Just ask questions and then tell the teacher to click Proceed.`;
}

function getDurationQuestionsSystemPrompt(): string {
  return `You are an AI assistant helping a teacher modify a lesson's duration.

The teacher wants to create a modified version with different timing. Before creating the modification, you need to understand their requirements.

IMPORTANT: You are ONLY allowed to ask questions. You are NOT allowed to generate any modified content yourself. Wait for the teacher to click the "Proceed" button.

Ask the teacher the following questions (one at a time, wait for each answer):

1. "What is the target duration for this version? (e.g., 30 minutes, 45 minutes)"

2. "What should I focus on preserving? (core activities, practice time, creative expression, etc.)"

After getting answers to both questions, tell the teacher EXACTLY this message:
"I've gathered your requirements. Click 'Proceed' when ready to create the modified version."

Do NOT generate any modified content. Do NOT try to process the modification. Just ask questions and then tell the teacher to click Proceed.`;
}

interface LessonBasic {
  id: string;
  title: string;
  lesson_number: number;
  course_id: string;
  courses: { id?: string; title?: string; grade?: string } | null | unknown;
  lesson_outline?: string;
  learning_objectives?: string;
  vocabulary?: string;
  materials?: string;
  vapa_text_block?: string;
  ncas_text_block?: string;
  welcome_opening?: string;
  actual_class_expectations?: string;
  warm_up?: string;
  lesson_hook?: string;
  main_activity?: string;
  instrument_expectations?: string;
  reflection?: string;
  closing_ceremony?: string;
  assessment?: string;
}

// Helper function to extract complete field objects from potentially truncated JSON
function extractFieldsFromTruncatedJson(text: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};

  // Map common aliases for all field variants
  const fieldMap: Record<string, string> = {
    'lesson_outline': 'lesson_outline', 'outline': 'lesson_outline',
    'learning_objectives': 'learning_objectives', 'objectives': 'learning_objectives',
    'vocabulary': 'vocabulary', 'vocab': 'vocabulary',
    'materials': 'materials',
    'welcome_opening': 'welcome_opening', 'opening': 'welcome_opening', 'welcome': 'welcome_opening',
    'actual_class_expectations': 'actual_class_expectations', 'expectations': 'actual_class_expectations',
    'warm_up': 'warm_up', 'warmup': 'warm_up',
    'lesson_hook': 'lesson_hook', 'hook': 'lesson_hook',
    'main_activity': 'main_activity', 'activity': 'main_activity',
    'instrument_expectations': 'instrument_expectations', 'instrument': 'instrument_expectations',
    'reflection': 'reflection',
    'closing_ceremony': 'closing_ceremony', 'closing': 'closing_ceremony',
    'assessment': 'assessment',
    'vapa_text_block': 'vapa_text_block', 'vapa': 'vapa_text_block', 'vapa_standards': 'vapa_text_block',
    'ncas_text_block': 'ncas_text_block', 'ncas': 'ncas_text_block', 'ncas_standards': 'ncas_text_block',
  };

  // Find all "field_name": { patterns
  const fieldStartPattern = /(["'])(\w+)\1\s*:\s*\{\s*(["'])html\3\s*:/gi;

  let match;
  while ((match = fieldStartPattern.exec(text)) !== null) {
    const fieldName = match[2];
    const startPos = match.index + match[0].length;

    // Find the opening quote of the HTML content
    const contentStartMatch = text.slice(startPos).match(/^\s*(["'``])/);
    if (!contentStartMatch) continue;
    const quoteChar = contentStartMatch[1];
    const contentStart = startPos + contentStartMatch[0].length;

    // Find the closing quote (not inside HTML entities or escaped quotes)
    let contentEnd = contentStart;
    let inEntity = false;
    let i = contentStart;
    while (i < text.length) {
      const char = text[i];
      if (char === '&') {
        inEntity = true;
      } else if (char === ';') {
        inEntity = false;
      } else if (char === quoteChar && !inEntity) {
        contentEnd = i;
        break;
      }
      i++;
    }

    const htmlContent = text.slice(contentStart, contentEnd);
    if (!htmlContent) continue;

    // Normalize field name to snake_case
    let normalizedName = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (normalizedName.startsWith('_')) normalizedName = normalizedName.substring(1);

    const finalName = fieldMap[normalizedName] || normalizedName;
    if (finalName && htmlContent && !finalName.includes('_html') && !finalName.includes('original')) {
      result[finalName] = { html: htmlContent, original_length: htmlContent.length };
    }
  }

  if (Object.keys(result).length > 0) {
    return { modifiedFields: result };
  }
  return null;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { message, lessonId, courseId, conversationHistory, editingVersionId, waitingForConfirmation, userSaidProceed, detectedLanguage, originalTargetLanguage, confirmationModificationType } = body;

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  if (!lessonId) {
    return NextResponse.json({
      response: "No lesson selected. Please open a lesson first.",
      links: [],
      results: [],
      isModificationRequest: false,
    });
  }

  const { data: fullLesson } = await supabase
    .from("lessons")
    .select("id, title, lesson_number, course_id, courses(id, title, grade), lesson_outline, learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, welcome_opening, actual_class_expectations, warm_up, lesson_hook, main_activity, instrument_expectations, reflection, closing_ceremony, assessment")
    .eq("id", lessonId)
    .single();

  if (!fullLesson) {
    return NextResponse.json({
      response: "Lesson not found.",
      links: [],
      results: [],
      isModificationRequest: false,
    });
  }

  const lessonWithCourse = fullLesson as unknown as LessonBasic;
  const courseData = lessonWithCourse.courses as { id?: string; title?: string; grade?: string } | null;
  const course = Array.isArray(courseData) ? courseData[0] : courseData;

  let editingVersionContent: Record<string, { html: string }> | null = null;

  if (editingVersionId) {
    const { data: versionData } = await supabase
      .from("lesson_versions")
      .select("content, version_name")
      .eq("id", editingVersionId)
      .single();
    if (versionData?.content) {
      editingVersionContent = versionData.content as Record<string, { html: string }>;
    }
  }

  const modificationDetection = detectModificationRequest(message);
  const userMessage = modificationDetection.isModification ? message : "";

  const isVersionMode = true;
  let modificationPreview: Record<string, unknown> | null = null;
  let needsConfirmation = false;
  let suggestedVersionName = "";

  const modType = userSaidProceed && confirmationModificationType
    ? confirmationModificationType
    : modificationDetection.type;
  const modDirection = userSaidProceed && confirmationModificationType
    ? null
    : modificationDetection.direction;
  const targetLanguage = userSaidProceed && originalTargetLanguage
    ? originalTargetLanguage
    : (modificationDetection.targetLanguage || detectedLanguage);

  if ((modificationDetection.isModification || userSaidProceed) && modType) {
    const effectiveModType = modType as "duration" | "translation";

    const lessonTitle = fullLesson.title;
    const lessonNumber = fullLesson.lesson_number;
    const courseTitle = course?.title || "Unknown";
    const courseGrade = course?.grade || "Unknown";

    const modificationLessonContent = `FULL CONTENT OF THIS LESSON:

Lesson: ${lessonTitle}
Course: ${courseTitle}
Grade: ${courseGrade}
Lesson Number: ${lessonNumber}

--- LESSON OUTLINE ---
${editingVersionContent?.lesson_outline?.html || fullLesson.lesson_outline || "(empty)"}

--- LEARNING OBJECTIVES ---
${editingVersionContent?.learning_objectives?.html || fullLesson.learning_objectives || "(empty)"}

--- VOCABULARY ---
${editingVersionContent?.vocabulary?.html || fullLesson.vocabulary || "(empty)"}

--- MATERIALS ---
${editingVersionContent?.materials?.html || fullLesson.materials || "(empty)"}

--- WELCOME AND OPENING CHECK-IN ---
${editingVersionContent?.welcome_opening?.html || fullLesson.welcome_opening || "(empty)"}

--- CLASS EXPECTATIONS AND PROCEDURES ---
${editingVersionContent?.actual_class_expectations?.html || fullLesson.actual_class_expectations || "(empty)"}

--- WARM UP ---
${editingVersionContent?.warm_up?.html || fullLesson.warm_up || "(empty)"}

--- LESSON HOOK ---
${editingVersionContent?.lesson_hook?.html || fullLesson.lesson_hook || "(empty)"}

--- MAIN ACTIVITY ---
${editingVersionContent?.main_activity?.html || fullLesson.main_activity || "(empty)"}

--- INSTRUMENT EXPECTATIONS ---
${editingVersionContent?.instrument_expectations?.html || fullLesson.instrument_expectations || "(empty)"}

--- REFLECTION ---
${editingVersionContent?.reflection?.html || fullLesson.reflection || "(empty)"}

--- CLOSING CEREMONY ---
${editingVersionContent?.closing_ceremony?.html || fullLesson.closing_ceremony || "(empty)"}

--- ASSESSMENT ---
${editingVersionContent?.assessment?.html || fullLesson.assessment || "(empty)"}

--- VAPA STANDARDS ---
${editingVersionContent?.vapa_text_block?.html || fullLesson.vapa_text_block || "(empty)"}

--- NCAS STANDARDS ---
${editingVersionContent?.ncas_text_block?.html || fullLesson.ncas_text_block || "(empty)"}
`;

    if (waitingForConfirmation && userSaidProceed) {
      const systemPrompt = getModificationSystemPrompt(effectiveModType, modDirection, !!editingVersionId, targetLanguage);

      const lessonContextMessage = {
        role: "user" as const,
        content: `Please translate this lesson content:\n\n${modificationLessonContent}`
      };

      const finalUserMessage = userMessage.trim() || "Proceed with creating the version now.";
      const messages = conversationHistory
        ? [lessonContextMessage, ...conversationHistory.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })), { role: "user", content: finalUserMessage }]
        : [lessonContextMessage, { role: "user", content: finalUserMessage }];

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          response: "AI is not configured. Please contact an administrator.",
          links: [],
          results: [],
          isModificationRequest: true,
        });
      }

      let response;
      try {
        response = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: MODIFICATION_MODEL,
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
      } catch (err) {
        return NextResponse.json({
          response: "Network error. Please try again.",
          links: [],
          results: [],
          isModificationRequest: true,
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Anthropic API error:", response.status, errorText);
        return NextResponse.json({
          response: `AI API error (${response.status}). Please try again.`,
          links: [],
          results: [],
          isModificationRequest: true,
        });
      }

      const result = await response.json();
      const aiResponse = result.content?.[0]?.text || "";

      // Log for debugging
      console.log("[MODIFY API] AI response length:", aiResponse.length, "has modifiedFields:", aiResponse.includes('modifiedFields'));

      let parsedPreview = null;
      try {
        // Try multiple strategies to extract complete JSON
        let jsonStr = "";

        // Strategy 1: Extract from markdown code blocks
        const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonStr = codeBlockMatch[1].trim();
        }

        // Strategy 2: If no complete JSON from code block, find the largest complete object
        if (!jsonStr || !jsonStr.includes('"modifiedFields"')) {
          const firstBrace = aiResponse.indexOf('{');
          const lastBrace = aiResponse.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = aiResponse.substring(firstBrace, lastBrace + 1);
          }
        }

        // Strategy 3: If JSON is truncated (incomplete), try to find complete field objects
        if (jsonStr) {
          try {
            parsedPreview = JSON.parse(jsonStr);
          } catch (parseErr) {
            // JSON is incomplete/truncated - try to extract individual complete fields
            console.log("[MODIFY API] JSON parse failed, attempting field-by-field extraction");
            parsedPreview = extractFieldsFromTruncatedJson(aiResponse);
          }
        }

        // Normalize modifiedFields (handle both camelCase and snake_case)
        if (parsedPreview) {
          const fields = parsedPreview.modifiedFields || parsedPreview.modified_fields || {};
          parsedPreview.modifiedFields = fields;
          console.log("[MODIFY API] Parsed fields:", Object.keys(fields).join(', '));
        }
      } catch (err) {
        console.log("[MODIFY API] JSON extraction error:", err);
        // Failed to parse
      }

      if (parsedPreview && parsedPreview.modifiedFields) {
        modificationPreview = parsedPreview;
        
        const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        if (effectiveModType === "translation" && targetLanguage) {
          suggestedVersionName = `${targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1)} Translation - ${timestamp}`;
        } else if (effectiveModType === "duration") {
          suggestedVersionName = `${modDirection === "shorter" ? "Shorter" : "Longer"} Version - ${timestamp}`;
        } else {
          suggestedVersionName = `Modified Version - ${timestamp}`;
        }

        return NextResponse.json({
          response: `I've created "${suggestedVersionName}". This version is now loaded in the lesson view.`,
          links: [],
          results: [],
          isModificationRequest: true,
          needsConfirmation: false,
          modificationType: effectiveModType,
          modificationPreview,
          editingVersionId: editingVersionId || null,
          suggestedVersionName,
        });
      } else {
        const fieldKeys = parsedPreview?.modifiedFields ? Object.keys(parsedPreview.modifiedFields).join(',') : 'none';
        const debugInfo = `parsed fields: ${fieldKeys}`;
        return NextResponse.json({
          response: `I had trouble creating that version. ${debugInfo}`,
          links: [],
          results: [],
          isModificationRequest: true,
        });
      }
    } else {
      const systemPrompt = effectiveModType === "translation"
        ? getTranslationQuestionsSystemPrompt(targetLanguage || detectedLanguage || "the target language")
        : getDurationQuestionsSystemPrompt();

      const messages = conversationHistory
        ? [...conversationHistory.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })), { role: "user", content: message }]
        : [{ role: "user", content: message }];

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          response: "AI is not configured. Please contact an administrator.",
          links: [],
          results: [],
          isModificationRequest: true,
        });
      }

      let response;
      try {
        response = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: MODIFICATION_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
      } catch (err) {
        return NextResponse.json({
          response: "Network error. Please try again.",
          links: [],
          results: [],
          isModificationRequest: true,
        });
      }

      const result = await response.json();
      const aiResponse = result.content?.[0]?.text || "I'm having trouble understanding. Could you please rephrase your request?";

      return NextResponse.json({
        response: aiResponse,
        links: [],
        results: [],
        isModificationRequest: true,
        needsConfirmation: true,
        modificationType: modType,
        modificationDirection: modDirection,
        modificationPreview: null,
        suggestedVersionName,
      });
    }
  }

  // If user is answering questions during confirmation phase
  if (waitingForConfirmation && !userSaidProceed && confirmationModificationType) {
    const systemPrompt = confirmationModificationType === "translation"
      ? getTranslationQuestionsSystemPrompt(detectedLanguage || "the target language")
      : getDurationQuestionsSystemPrompt();

    const messages = conversationHistory
      ? [...conversationHistory.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })), { role: "user", content: message }]
      : [{ role: "user", content: message }];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        response: "AI is not configured. Please contact an administrator.",
        links: [],
        results: [],
        isModificationRequest: true,
      });
    }

    let response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODIFICATION_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      } catch (err) {
        return NextResponse.json({
          response: "Network error. Please try again.",
          links: [],
          results: [],
          isModificationRequest: true,
        });
      }

      const result = await response.json();
      const aiResponse = result.content?.[0]?.text || "I'm having trouble understanding. Could you please rephrase your answer?";

      return NextResponse.json({
        response: aiResponse,
        links: [],
        results: [],
        isModificationRequest: true,
        needsConfirmation: true,
        modificationType: confirmationModificationType,
        modificationPreview: null,
        suggestedVersionName: "",
    });
  }

  // If no modification detected, provide general help
  const systemPrompt = `You are an AI assistant helping a teacher with lesson modifications.

You are in the Versions tab where teachers can create modified versions of lessons.
Available modification types:
- Duration: Make a lesson shorter or longer
- Translation: Translate a lesson into another language

If the teacher wants to make a modification, ask clarifying questions and then ask them to click "Proceed" when ready.
If the teacher is just asking questions, answer helpfully but remind them they can use the "Ask" tab for general questions.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      response: "AI is not configured. Please contact an administrator.",
      links: [],
      results: [],
      isModificationRequest: false,
    });
  }

  const messages = conversationHistory
    ? [...conversationHistory.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })), { role: "user", content: message }]
    : [{ role: "user", content: message }];

  let response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });
  } catch (err) {
    return NextResponse.json({
      response: "Network error. Please try again.",
      links: [],
      results: [],
      isModificationRequest: false,
    });
  }

  const result = await response.json();
  const aiResponse = result.content?.[0]?.text || "";

  return NextResponse.json({
    response: aiResponse,
    links: [],
    results: [],
    isModificationRequest: false,
  });
}
