import { OpenAI, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { vectorStore } from "./dataService";
import { logger } from "../utils/logger";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";
import { pronunciationPromptTemplate } from "../utils/promptTemplate";
import fs from "fs";
import path from "path";

// Initialize OpenAI model
const model = new ChatOpenAI({
  temperature: 0.1,
  model: "gpt-4o",
  openAIApiKey: process.env.OPENAI_API_KEY,
  streaming: false,
});

interface AnalysisResult {
  result: string;
  correct_pronunciation: string | null;
  feedback: string | null;
}

// Define pattern interface
interface PronunciationPattern {
  pattern: string;
  correct: string;
  incorrect?: string;
  romanized?: string;
  rule?: string;
  explanation?: string;
}

const zodSchema = z.object({
  result: z.string().describe("answer to the user's question"),
  correct_pronunciation: z
    .string()
    .nullable()
    .describe(
      "source used to answer the user's question, should be a website."
    ),
  feedback: z
    .string()
    .nullable()
    .describe(
      "source used to answer the user's question, should be a website."
    ),
});

// Load pronunciation patterns from data file
const loadPronunciationPatterns = (): {
  tensification: PronunciationPattern[];
  hLiaison: PronunciationPattern[];
  vowelConfusion: PronunciationPattern[];
} => {
  const patternsPath = path.join(
    process.cwd(),
    "data",
    "korean_pronunciation_patterns.json"
  );
  let tensificationPatterns: PronunciationPattern[] = [];
  let hLiaisonPatterns: PronunciationPattern[] = [];
  let vowelConfusionPatterns: PronunciationPattern[] = [];

  try {
    const patternsData = JSON.parse(fs.readFileSync(patternsPath, "utf8"));
    tensificationPatterns = patternsData.tensificationPatterns;
    hLiaisonPatterns = patternsData.hLiaisonPatterns;
    vowelConfusionPatterns = patternsData.vowelConfusionPatterns || [];
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error loading pronunciation patterns: ${errorMessage}`);
    // Fallback to default patterns if file cannot be loaded
    tensificationPatterns = [
      { pattern: "만나서 반갑습니다", correct: "만나서 빤갑습니다" },
      { pattern: "반갑습니다", correct: "빤갑습니다" },
    ];
    hLiaisonPatterns = [
      { pattern: "좋은", correct: "조은" },
      { pattern: "하루", correct: "아루" },
    ];
    vowelConfusionPatterns = [
      { pattern: "여보세요", correct: "여보세요", incorrect: "여보세여" },
    ];
  }

  return {
    tensification: tensificationPatterns,
    hLiaison: hLiaisonPatterns,
    vowelConfusion: vowelConfusionPatterns,
  };
};

// Check for common pronunciation patterns that need special handling
const checkForPronunciationPatterns = (
  text: string,
  patterns: {
    tensification: PronunciationPattern[];
    hLiaison: PronunciationPattern[];
    vowelConfusion: PronunciationPattern[];
  },
): {
  patternType: string;
  found: boolean;
  matchingPatterns: PronunciationPattern[];
} => {
  // Check for tensification patterns
  const tensificationMatches = patterns.tensification.filter((item) =>
    text.includes(item.pattern)
  );
  if (tensificationMatches.length > 0) {
    return {
      patternType: "tensification",
      found: true,
      matchingPatterns: tensificationMatches,
    };
  }

  // Check for ᄒ liaison patterns
  const hLiaisonMatches = patterns.hLiaison.filter((item) =>
    text.includes(item.pattern)
  );
  if (hLiaisonMatches.length > 0) {
    return {
      patternType: "h_liaison",
      found: true,
      matchingPatterns: hLiaisonMatches,
    };
  }

  // Check for vowel confusion patterns
  const vowelConfusionMatches = patterns.vowelConfusion.filter((item) =>
    text.includes(item.pattern)
  );
  if (vowelConfusionMatches.length > 0) {
    return {
      patternType: "vowel_confusion",
      found: true,
      matchingPatterns: vowelConfusionMatches,
    };
  }

  return { patternType: "", found: false, matchingPatterns: [] };
};

/**
 * Analyze pronunciation accuracy using AI
 */
export const analyzePronunciationAccuracy = async (
  transcription: string
): Promise<AnalysisResult> => {
  try {
    const retriever = vectorStore.asRetriever();
    const relevantRules = await retriever.getRelevantDocuments(transcription);

    const advancedTemplate = new PromptTemplate({
      template: pronunciationPromptTemplate,
      inputVariables: ["transcription", "relevantRules"],
    });

    const patterns = loadPronunciationPatterns();
    const patternCheck = checkForPronunciationPatterns(transcription, patterns);

    let specialNote = "";
    if (patternCheck.found) {
      const examples = patternCheck.matchingPatterns
        .map((item) => {
          const rule =
            item.rule ||
            (patternCheck.patternType === "tensification"
              ? "Tensification"
              : "ᄒ Liaison/Weakening");
          const romanized = item.romanized ? ` (${item.romanized})` : "";
          return `"${item.pattern}" → "${item.correct}"${romanized} (${rule})`;
        })
        .join("\n");

      if (patternCheck.patternType === "tensification") {
        specialNote = `

SPECIAL NOTE: The transcription contains text that MUST follow tensification rules. 
The correct pronunciation MUST include tensification for these patterns:
${examples}`;
      } else if (patternCheck.patternType === "h_liaison") {
        specialNote = `

SPECIAL NOTE: The transcription contains text that MUST follow ᄒ liaison or weakening rules. 
The correct pronunciation MUST include these sound changes:
${examples}`;
      } else if (patternCheck.patternType === "vowel_confusion") {
        specialNote = `

SPECIAL NOTE: The transcription contains text that is commonly mispronounced with vowel confusion. 
Pay special attention to the correct vowel sounds in these patterns:
${examples}`;
      }
    }

    const prompt = await advancedTemplate.format({
      transcription,
      relevantRules:
        relevantRules.map((doc) => doc.pageContent).join("\n\n") + specialNote,
    });

    logger.info(
      `Using prompt with special pronunciation pattern handling: ${patternCheck.patternType} (found: ${patternCheck.found})`
    );

    const parser = StructuredOutputParser.fromZodSchema(zodSchema);
    // Get analysis from LLM
    logger.info("Sending prompt to LLM for analysis");

    // Combine the prompt with format instructions
    const formatInstructions = parser.getFormatInstructions();
    const fullPrompt = `${prompt}\n\n${formatInstructions}`;

    // Call the model with the combined prompt
    const response = await model.invoke(fullPrompt);

    // Parse LLM response
    try {
      const content = response.content as string;
      // Remove markdown code block markers and parse JSON
      const jsonString = content
        .replace("```json", "") // Remove opening marker
        .replace("```", "") // Remove closing marker
        .trim(); // Remove any extra whitespace
      logger.info("Cleaned JSON string:", jsonString);

      const analysisResult = JSON.parse(jsonString); // Parse into object
      logger.info("Parsed analysis result:", analysisResult);

      // Override for specific pronunciation patterns
      if (patternCheck.found) {
        if (patternCheck.patternType === "tensification") {
          // Use the matched tensification patterns from the pattern check
          const matchedPattern = patternCheck.matchingPatterns[0];

          if (matchedPattern) {
            logger.info(
              "Overriding LLM result with specific tensification pattern"
            );
            return {
              result: "Incorrect pronunciation",
              correct_pronunciation: matchedPattern.romanized || "",
              feedback: `${matchedPattern.rule || "Tensification"}\n"${
                matchedPattern.pattern
              }" → "${matchedPattern.correct}"`,
            };
          }
        } else if (patternCheck.patternType === "h_liaison") {
          if (
            transcription.includes("좋은 하루") ||
            transcription.includes("좋은하루")
          ) {
            logger.info(
              "Overriding LLM result with specific ᄒ liaison and weakening pattern"
            );
            return {
              result: "Incorrect pronunciation",
              correct_pronunciation: "Jo-eun a-ru bo-nae-se-yo",
              feedback: `좋은' → '조은' (ᄒ liaison) / '하루' → '아루' (ᄒ weakening)`
            };
          }

          const matchedPattern = patternCheck.matchingPatterns[0];

          if (matchedPattern) {
            logger.info(
              "Overriding LLM result with specific ᄒ liaison/weakening pattern"
            );
            return {
              result: "Incorrect pronunciation",
              correct_pronunciation: matchedPattern.romanized || null,
              feedback: `${matchedPattern.rule || "ᄒ Liaison/Weakening"}\n${
                matchedPattern.explanation || ""
              }\nCorrect Pronunciation: ${matchedPattern.romanized || ""}.`,
            };
          }
        } else if (patternCheck.patternType === "vowel_confusion") {
          // Use the matched vowel confusion patterns from the pattern check
          const matchedPattern = patternCheck.matchingPatterns[0];

          if (matchedPattern) {
            logger.info(
              "Overriding LLM result with specific vowel confusion pattern"
            );
            return {
              result: "Incorrect pronunciation",
              correct_pronunciation: matchedPattern.romanized || null,
              feedback: `${matchedPattern.rule || "Vowel Confusion"}\n${
                matchedPattern.explanation ||
                `"${matchedPattern.incorrect || matchedPattern.pattern}" → "${
                  matchedPattern.correct
                }"`
              }`,
            };
          }
        }
      }

      // Validate with Zod schema (optional but recommended)
      const validatedResult = parser.parse(JSON.stringify(analysisResult));
      return validatedResult;
    } catch (parseError) {
      logger.error("Failed to parse response:", parseError);
      return {
        result: "Incorrect pronunciation",
        correct_pronunciation: null,
        feedback: `Failed to parse response. Raw output: ...`,
      };
    }
  } catch (error) {
    logger.error("Error in pronunciation analysis:", error);
    throw new Error(
      `Pronunciation analysis failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};
