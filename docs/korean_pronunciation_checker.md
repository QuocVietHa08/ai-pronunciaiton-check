# Korean Pronunciation Checker System

## Table of Contents

1. [Introduction](#introduction)
2. [AI Model and Implementation](#ai-model-and-implementation)
3. [Application of Korean Pronunciation Rules](#application-of-korean-pronunciation-rules)
4. [API Architecture Overview](#api-architecture-overview)
5. [How to Use the System](#how-to-use-the-system)

## Introduction

The Korean Pronunciation Checker is an AI-powered system designed to help language learners identify and correct common pronunciation mistakes in Korean using AI.

## AI Model and Implementation

### LLM Integration

Our system uses a Large Language Model (LLM) to analyze Korean pronunciation. Here's how it works:

1. **Model Selection**: We use OpenAI's models with GPT-4.

2. **Prompt Engineering**: We've designed prompts that instruct the AI to analyze Korean pronunciation based on:
   - The original Korean text
   - The user's pronunciation attempt (transcription)
   - Specific Korean pronunciation rules

3. **Response Parsing**: The AI returns a structured JSON response containing:
   - Overall assessment (correct/incorrect)
   - Correct pronunciation (in romanized form)
   - Detailed feedback explaining any errors

### Pattern Recognition System

We've implemented a specialized pattern recognition system:

1. **Pattern Database**: is a JSON database of common pronunciation patterns categorized by rule type (tensification, ᄒ liaison, vowel confusion).

2. **Pattern Matching**: Before sending a request to the LLM, we check if the text contains any of these special patterns.

3. **Rule-Based Overrides**: For known patterns, we can override the LLM's response with more precise, pre-defined feedback.

## Application of Korean Pronunciation Rules

Our system focuses on three main categories of Korean pronunciation rules:

### 1. Tensification (Fortition)

In Korean, certain consonants become tensified (stronger) in specific contexts, especially after another consonant.

**Example:**
- Pattern: "반갑습니다" (Nice to meet you)
- Correct: "빤갑습니다" (with tensified ᄇ/b → ᄈ/bb)
- Romanized: "Bban-gap-seum-ni-da"

The system recognizes when a user fails to apply tensification and provides specific feedback on how to correct it.

### 2. ᄒ (h) Liaison and Weakening

The Korean consonant ᄒ (h) often undergoes changes in natural speech:

- **ᄒ Liaison**: When ᄒ appears between vowels or after certain consonants, it may be weakened or dropped.
  
  **Example:**
  - Pattern: "좋은" (good)
  - Correct: "조은" (the ᄒ is dropped)
  - Romanized: "Jo-eun"

- **ᄒ Weakening**: In certain positions, especially at the beginning of non-initial syllables, ᄒ may be weakened or dropped.
  
  **Example:**
  - Pattern: "하루" (day)
  - Correct: "아루" (with weakened ᄒ)
  - Romanized: "A-ru"

### 3. Vowel Confusion

Certain Korean vowels sound similar to non-native speakers and are often confused.

**Example:**
- Pattern: "여보세요" (hello, when answering the phone)
- Common incorrect pronunciation: "여보세여"
- Correct: "여보세요" (with the correct vowel ᅭ/yo at the end, not ᅨ/yeo)
- Romanized: "Yeo-bo-se-yo"

The system identifies these vowel confusion patterns and provides targeted feedback.

## API Architecture Overview

Our system follows a modern, modular architecture:

### 1. Core Components

- **Analysis Service**: The central component that coordinates the pronunciation analysis process.
- **LLM Service**: Handles communication with the OpenAI API.
- **Data Repository**: Stores pronunciation patterns and rules in JSON format.

### 2. Request Flow

1. **Client Request**: The client sends a request with the original Korean text and the user's pronunciation attempt.

2. **Pattern Detection**: The system first checks if the text contains any special pronunciation patterns from our database.

3. **LLM Analysis**: If no specific pattern is found (or as a supplement), the system sends the text to the LLM for analysis.

4. **Response Generation**: The system combines pattern-based and LLM-based analysis to generate a comprehensive response.

5. **Client Response**: The client receives a structured JSON response with the assessment and feedback.

### 3. Data Management

- **Pattern Database**: Stored in `korean_pronunciation_patterns.json`, this file contains categorized patterns for different pronunciation rules.

- **Dynamic Updates**: The system is designed to allow easy addition of new pronunciation patterns without changing the core code.

## How to Use the System

### API Endpoint

The system exposes a simple REST API endpoint:

```
POST /api/analyze-pronunciation
```

### Request Format

```json
{
  "originalText": "여보세요",
  "transcription": "여보세여"
}
```

### Response Format

```json
{
  "result": "Incorrect pronunciation",
  "correct_pronunciation": "Yeo-bo-se-yo",
  "feedback": "ᅦ vs. ᅢ Vowel Confusion\nSome speakers pronounce \"여보세요\" as \"여보세여\"\nCorrect Pronunciation: Yeo-bo-se-yo."
}
```

### Interpretation

- **result**: Overall assessment ("Correct pronunciation" or "Incorrect pronunciation")
- **correct_pronunciation**: The romanized correct pronunciation
- **feedback**: Detailed explanation of any errors and how to correct them

---

Thank you for checking this document