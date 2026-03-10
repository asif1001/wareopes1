import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Support multiple common env var names for the Gemini API key.
const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY;

const googlePlugin = apiKey ? googleAI({ apiKey }) : googleAI();

export const ai = genkit({
  plugins: [googlePlugin],
  model: 'googleai/gemini-2.5-flash',
});
