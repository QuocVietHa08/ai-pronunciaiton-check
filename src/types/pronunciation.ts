export interface PronunciationExample {
  word: string;
  standard: string;
  actual: string;
}

export interface PronunciationRule {
  name: string;
  description: string;
  examples: PronunciationExample[];
}

export interface TranscriptionResult {
  transcription: string;
  words: {
    word: string;
    startTime: number;
    endTime: number;
  }[];
}

export interface AnalysisResult {
  result: string;
  correct_pronunciation: string | null;
  feedback: string | null;
}

export interface ApiResponse {
  result: string;
  correct_pronunciation?: string;
  feedback?: string;
}