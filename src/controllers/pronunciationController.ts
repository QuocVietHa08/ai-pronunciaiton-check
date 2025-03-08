import { Request, Response, NextFunction } from 'express';
import { speechToText } from '../services/speechService';
import { analyzePronunciationAccuracy } from '../services/analysisService';
import { logger } from '../utils/logger';

// List of audio formats supported by OpenAI Whisper API
const SUPPORTED_FORMATS = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];

export const analyzePronunciation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Received pronunciation analysis request');
    
    // Check if file is provided
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }
    
    // expected_text is now optional
    
    // Get file details
    const { buffer, mimetype, originalname } = req.file;
    logger.info(`Received file: ${originalname}, type: ${mimetype}`);
    
    // Check if the file format is supported by OpenAI
    const fileExtension = originalname.split('.').pop()?.toLowerCase();
    if (!fileExtension || !SUPPORTED_FORMATS.includes(fileExtension)) {
      logger.warn(`Unsupported file format: ${fileExtension}`);
      res.status(400).json({ 
        error: `Unsupported file format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}` 
      });
      return;
    }
    
    const expectedText = req.body.expected_text || null;
    
    // Convert speech to text
    logger.info('Converting speech to text');
    const { transcription, words } = await speechToText(buffer, fileExtension);
    
    // Analyze pronunciation
    logger.info(`Analyzing pronunciation accuracy for transcribed text: ${transcription}`);
    const analysisResult = await analyzePronunciationAccuracy(transcription, expectedText);
    
    // Format response
    let response;
    if (analysisResult.result === 'Correct pronunciation') {
      response = {
        result: 'Correct pronunciation'
      };
    } else {
      response = {
        result: 'Incorrect pronunciation.',
        correct_pronunciation: analysisResult.correct_pronunciation,
        feedback: analysisResult.feedback
      };
    }
    
    res.json(response);
  } catch (error) {
    logger.error('Error in pronunciation analysis controller:', error);
    next(error);
  }
};