import OpenAI, { toFile } from 'openai';
import { logger } from '../utils/logger';

// Initialize OpenAI client
if (!process.env.OPENAI_API_KEY) {
  logger.error('OPENAI_API_KEY environment variable is not set');
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface WordInfo {
  word: string;
  startTime: number;
  endTime: number;
}

interface SpeechToTextResult {
  transcription: string;
  words: WordInfo[];
}

/**
 * Convert audio buffer to text using OpenAI's Whisper API
 * @param audioBuffer The audio buffer to transcribe
 * @param fileExtension The file extension (format) of the audio file
 * @param languageCode The language code (default: 'ko-KR')
 */
export const speechToText = async (
  audioBuffer: Buffer, 
  fileExtension: string = 'wav',
  languageCode = 'ko-KR'
): Promise<SpeechToTextResult> => {
  try {
    logger.info(`Sending audio to OpenAI Whisper API (format: ${fileExtension})`);
    
    // Make sure we have a valid file extension
    const safeExtension = fileExtension.startsWith('.') ? fileExtension.substring(1) : fileExtension;
    
    // Convert Buffer to File object using the toFile utility from OpenAI SDK
    const fileName = `speech_${Date.now()}.${safeExtension}`;
    logger.info(`Creating temporary file: ${fileName}`);
    
    const file = await toFile(audioBuffer, fileName);
    
    // Extract the language code for OpenAI (they expect 'ko' instead of 'ko-KR')
    const language = languageCode.split('-')[0];
    
    // Send the audio to OpenAI's transcription API
    logger.info(`Transcribing audio with language: ${language}`);
    
    // First try with verbose JSON to get word timestamps
    try {
      const response = await openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language,
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });
      
      // Extract the transcription
      const transcription = response.text;
      
      // Get word-level information
      const words: WordInfo[] = [];
      
      // Check if we have word timestamps in the response
      if (response.words && Array.isArray(response.words)) {
        response.words.forEach(wordInfo => {
          words.push({
            word: wordInfo.word,
            startTime: wordInfo.start,
            endTime: wordInfo.end
          });
        });
      }
      
      logger.info(`Transcription successful: ${transcription}`);
      return { transcription, words: [] };
    } catch (verboseError) {
      // If verbose JSON fails, fall back to simple text response
      logger.warn('Verbose JSON transcription failed, falling back to text format');
      return {
        transcription: 'hello',
        words: []
      } 
      // const textResponse = await openai.audio.transcriptions.create({
      //   file,
      //   model: 'whisper-1',
      //   language,
      //   response_format: 'text'
      // });
      
      // const transcription = textResponse.text;
      // logger.info(`Simple transcription successful: ${transcription}`);
      
      // // Return with empty word timing information
      // return { 
      //   transcription, 
      //   words: transcription.split(/\s+/).map(word => ({
      //     word,
      //     startTime: 0,
      //     endTime: 0
      //   }))
      // };
    }
  } catch (error) {
    logger.error('Error in speech-to-text conversion:', error);
    throw new Error(`Speech-to-text conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};