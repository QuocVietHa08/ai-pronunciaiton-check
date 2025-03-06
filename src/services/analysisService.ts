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
  transcription: string,
  expectedText: string
): Promise<AnalysisResult> => {
  try {
    // Search for relevant pronunciation rules
    const retriever = vectorStore.asRetriever();
    const relevantRules = await retriever.getRelevantDocuments(transcription);

    // Create prompt for LLM
    const promptTemplate = new PromptTemplate({
      template: `You are a Korean language pronunciation expert. Analyze the pronunciation accuracy between the expected text and the transcribed text from audio.

Expected text: {expectedText}
Transcribed text: {transcription}

Relevant pronunciation rules:
{relevantRules}

Is the pronunciation correct? If not, identify specifically what was mispronounced and explain the relevant pronunciation rules that apply.

You MUST return your analysis in valid, parseable JSON format with the following structure:
{{
  "result": "Correct pronunciation" or "Incorrect pronunciation",
  "correct_pronunciation": "[Romanized correct pronunciation or null if correct]",
  "feedback": "[Detailed explanation of pronunciation errors and applicable rules or null if correct]"
    }}

Do not include any text outside of the JSON object. Ensure the JSON is properly formatted and can be parsed by JSON.parse().`,
      inputVariables: ["expectedText", "transcription", "relevantRules"],
    });

    const prompt = await promptTemplate.format({
      expectedText,
      transcription,
      relevantRules: relevantRules.map((doc) => doc.pageContent).join("\n\n"),
    });

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
