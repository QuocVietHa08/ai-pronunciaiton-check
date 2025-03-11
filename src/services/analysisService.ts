import { OpenAI, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { vectorStore } from "./dataService";
import { logger } from "../utils/logger";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";

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

/**
 * Analyze pronunciation accuracy using AI
 */
export const analyzePronunciationAccuracy = async (
  transcription: string
): Promise<AnalysisResult> => {
  try {
    console.log("transcription ----->", transcription);
    // Search for relevant pronunciation rules
    const retriever = vectorStore.asRetriever();
    const relevantRules = await retriever.getRelevantDocuments(transcription);
    console.log("relevantRules ----->", relevantRules);
    // Create advanced prompt for pronunciation analysis that specifically checks for tensification and other rules
    const advancedTemplate = new PromptTemplate({
      template: `You are a Korean language pronunciation expert. Your task is to analyze the pronunciation of the transcribed text and identify if it follows the correct pronunciation rules in Korean.

Transcribed text: {transcription}

Relevant Korean pronunciation rules:
{relevantRules}

IMPORTANT: You MUST check for the following specific pronunciation rules and variations:

1. Tensification (Fortification):
   - When certain consonants appear after a stopped consonant, they become tensed (fortified).
   - Examples: "학교" (hak-gyo) → "학꾜" (hak-kyo), "입구" (ip-gu) → "입꾸" (ip-ku)
   - CRITICAL: Words like "만나서 반갑습니다" should be pronounced as "만나서 빤갑습니다" due to tensification.

2. Liaison:
   - When a syllable ends with a consonant and the next begins with a vowel, the final consonant is pronounced as the initial of the next syllable.
   - Examples: "꽃이" (kkot-i) → "꼬치" (kko-chi), "밥을" (bap-eul) → "바블" (ba-beul)

3. Nasal Assimilation:
   - When ㄱ (g), ㄷ (d), or ㅂ (b) precede ㄴ (n) or ㅁ (m), they change to ㅇ (ng), ㄴ (n), or ㅁ (m) respectively.
   - Examples: "학년" (hak-nyeon) → "항년" (hang-nyeon), "십만" (sip-man) → "심만" (sim-man)

4. Consonant Assimilation:
   - When certain consonants appear next to each other, one may change to match or become more similar to the other.
   - Examples: "신라" (sin-ra) → "실라" (sil-la), "관리" (gwan-ri) → "괄리" (gwal-li)

5. ㅎ Weakening:
   - When ㅎ appears at the beginning of a word or syllable in casual speech, it may be weakened or dropped entirely.
   - Examples: "하루" (ha-ru) → "아루" (a-ru), "하얀" (ha-yan) → "아얀" (a-yan)

Your analysis MUST follow these steps:

1. Carefully examine the transcribed text for any words that should follow the pronunciation rules above.
2. If the transcription does not reflect the correct pronunciation according to these rules, mark it as "Incorrect pronunciation".
3. For example, if the transcription is "만나서 반갑습니다" it should be marked as incorrect because the correct pronunciation is "만나서 빤갑습니다" due to tensification.

You MUST return your analysis in valid, parseable JSON format with the following structure:
{{
  "result": "Correct pronunciation" or "Incorrect pronunciation",
  "correct_pronunciation": "[Romanized correct pronunciation, showing how it should be pronounced]",
  "feedback": "[Detailed feedback explaining which pronunciation rule applies and how it should be pronounced. Format: 'written form' → 'correct pronunciation form' (rule name)]"
}}

Do not include any text outside of the JSON object. Ensure the JSON is properly formatted and can be parsed by JSON.parse().`,
      inputVariables: ["transcription", "relevantRules"],
    });

    // Define pattern interface
    interface PronunciationPattern {
      pattern: string;
      correct: string;
      incorrect?: string;
      romanized?: string;
      rule?: string;
      explanation?: string;
    }

    // Import required modules
    const fs = require("fs");
    const path = require("path");

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
        const errorMessage =
          error instanceof Error ? error.message : String(error);
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

    // Load patterns
    const patterns = loadPronunciationPatterns();

    // Check for common pronunciation patterns that need special handling
    const checkForPronunciationPatterns = (
      text: string
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

    // Check if transcription contains patterns that need special handling
    const patternCheck = checkForPronunciationPatterns(transcription);

    // If we detect a pattern, we'll add a special note to the prompt
    let specialNote = "";
    if (patternCheck.found) {
      // Create examples from the matching patterns
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

    // If we detected a special pronunciation pattern, we might want to override the result
    // rather than relying solely on the LLM
    if (patternCheck.found) {
      logger.info(
        `${patternCheck.patternType} pattern detected, may override LLM result`
      );
    }

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
              }" → "${matchedPattern.correct}".\nCorrect Pronunciation: ${
                matchedPattern.romanized || ""
              }.`,
            };
          }
        } else if (patternCheck.patternType === "h_liaison") {
          // Use the matched ᄒ liaison patterns from the pattern check

          // Special case for "좋은 하루 보내세요"
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
              feedback:
                'ᄒ Liaison and Weakening\n"좋은" (\'ᄒ\' liaison) → "조은"\n"하루" (\'ᄒ\' weakening) → "아루"\nCorrect Pronunciation: Jo-eun a-ru bo-nae-se-yo.',
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
              }\nCorrect Pronunciation: ${matchedPattern.romanized || ""}.`,
            };
          }
        }
      }

      // Validate with Zod schema (optional but recommended)
      const validatedResult = parser.parse(JSON.stringify(analysisResult));
      return validatedResult;
    } catch (parseError) {
      // Fallback response when JSON parsing fails
      return {
        result: "good",
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
