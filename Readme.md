# Korean Pronunciation Analysis API

An advanced AI-powered API for analyzing Korean language pronunciation accuracy using speech-to-text technology and language-specific pronunciation rules.

## Technical Overview

This application leverages state-of-the-art AI models to provide detailed feedback on Korean pronunciation, helping language learners improve their speaking skills.

### Key Features

- **Speech-to-Text Conversion**: Converts spoken Korean audio to text using OpenAI's Whisper API
- **Pronunciation Analysis**: Compares transcribed text with expected text to identify pronunciation errors
- **Rule-Based Feedback**: Provides detailed feedback based on Korean pronunciation rules
- **Multiple Audio Format Support**: Handles various audio file formats (WAV, MP3, etc.)

## AI Model Implementation

### Speech Recognition

The application uses OpenAI's Whisper model for speech-to-text conversion. Whisper is a robust, multilingual speech recognition model that performs exceptionally well with Korean language audio.

Key implementation details:
- Model: `gpt-4o` for analysis, Whisper for transcription
- Temperature: 0.1 (for consistent, deterministic outputs)
- Language Code: Optimized for Korean (ko-KR)

### Pronunciation Analysis

The analysis pipeline follows these steps:

1. **Audio Transcription**: Convert uploaded audio to text using Whisper API
2. **Vector Similarity Search**: Retrieve relevant Korean pronunciation rules from a vector database
3. **LLM Analysis**: Use GPT-4o to compare expected text with transcribed text and apply relevant rules
4. **Structured Feedback**: Generate detailed, actionable feedback on pronunciation errors

## Application of Korean Pronunciation Rules

The system incorporates a comprehensive database of Korean pronunciation rules, including:

- **Batchim (받침) Rules**: Proper pronunciation of final consonants
- **Assimilation Rules**: How sounds change when certain consonants meet
- **Tensification Rules**: When and how consonants become tensified
- **Aspiration Rules**: Proper aspiration of certain consonants
- **Vowel Length Distinctions**: Proper duration of vowel sounds

These rules are stored in a vector database for efficient retrieval based on the specific pronunciation challenges detected in the user's speech.

## API Architecture

### Tech Stack

- **Backend**: TypeScript, Express.js
- **AI Integration**: LangChain, OpenAI API
- **File Handling**: Multer for audio file uploads
- **Vector Storage**: FAISS for efficient similarity search

### API Endpoints

- `POST /api/analyze-pronunciation`: Main endpoint for pronunciation analysis
  - Accepts audio file and expected text
  - Returns pronunciation accuracy assessment and detailed feedback
- `GET /api/health`: Health check endpoint

### Data Flow

1. Client uploads audio file with expected Korean text
2. Server processes audio file and converts to text using Whisper API
3. System retrieves relevant pronunciation rules from vector store
4. LLM analyzes pronunciation accuracy and generates feedback
5. Structured response returned to client

## Getting Started

### Prerequisites

- Node.js (v20+)
- OpenAI API key

### Installation

1. Clone the repository: