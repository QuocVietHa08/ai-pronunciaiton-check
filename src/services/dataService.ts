import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
// import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { OpenAIEmbeddings } from '@langchain/openai'
import { FaissStore} from '@langchain/community/vectorstores/faiss'
import { logger } from '../utils/logger';
import { PronunciationRule } from '../types/pronunciation';

// Define path to rules file
const rulesFilePath = path.join(__dirname, '../../data/korean_pronunciation_rules.json');

// Store pronunciation rules
let pronunciationRules: PronunciationRule[] = [];

// Export vector store to be used by other services
export let vectorStore: FaissStore;

/**
 * Initialize pronunciation rules database and vector store
 */
export const initializePronunciationRules = async (): Promise<void> => {
  try {
    // Load pronunciation rules from a JSON file
    logger.info(`Loading pronunciation rules from ${rulesFilePath}`);
    const rulesData = fs.readFileSync(rulesFilePath, 'utf8');
    const parsedData = JSON.parse(rulesData);
    
    if (!parsedData.rules || !Array.isArray(parsedData.rules)) {
      throw new Error('Invalid rules data format');
    }
    
    pronunciationRules = parsedData.rules;
    
    // Create text chunks for vector store
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    
    const ruleTexts = pronunciationRules.map(rule => {
      const examplesText = rule.examples
        .map(ex => `${ex.word} (standard: ${ex.standard}, actual: ${ex.actual})`)
        .join(', ');
      
      return `Rule: ${rule.name}\nDescription: ${rule.description}\nExamples: ${examplesText}`;
    });
    
    const docs = await textSplitter.createDocuments(ruleTexts);
    
    // Create vector store
    logger.info('Creating vector store from pronunciation rules');
    const embeddings = new OpenAIEmbeddings();
    vectorStore = await FaissStore.fromDocuments(docs, embeddings);
    
    logger.info('Pronunciation rules database and vector store initialized successfully');
  } catch (error) {
    logger.error('Error initializing rules database:', error);
    throw new Error(`Failed to initialize pronunciation rules: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Get all pronunciation rules
 */
export const getAllPronunciationRules = (): PronunciationRule[] => {
  return pronunciationRules;
};

/**
 * Get a specific pronunciation rule by name
 */
export const getPronunciationRuleByName = (name: string): PronunciationRule | undefined => {
  return pronunciationRules.find(rule => rule.name === name);
};