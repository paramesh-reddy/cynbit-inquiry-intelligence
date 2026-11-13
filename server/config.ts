import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  openaiApiKey: (process.env.OPENAI_API_KEY || '').trim(),
  openaiModel: (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
  dbPath: process.env.DB_PATH
    ? path.resolve(process.cwd(), process.env.DB_PATH)
    : path.resolve(process.cwd(), 'data', 'cynbit_inquiries.db'),
  kbPath: path.resolve(process.cwd(), 'sample_data', 'cynbit_knowledge_base.json'),
  sampleInquiriesPath: path.resolve(process.cwd(), 'sample_data', 'sample_inquiries.json'),
};

export function isOpenAIConfigured(): boolean {
  return Boolean(config.openaiApiKey && config.openaiApiKey !== 'MY_OPENAI_API_KEY');
}
