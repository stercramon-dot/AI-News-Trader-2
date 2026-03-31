import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed. Retrying...`, error);
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  timestamp: string;
  category: 'crypto' | 'stocks' | 'forex' | 'general';
  impact: 'high' | 'medium' | 'low';
  url?: string;
}

export async function fetchTraderNews(category: string): Promise<NewsItem[]> {
  const prompt = `Fetch the latest, most impactful news for ${category} traders from the last 24 hours. 
  For each news item, provide:
  1. A concise, punchy title.
  2. A brief 1-sentence summary of the market impact.
  3. The source name.
  4. An estimated impact level (high, medium, low).
  5. A URL if available.
  
  Return the data as a JSON array of objects with keys: title, summary, source, impact, url.
  Focus on speed and relevance for active traders.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
      },
    }));

    if (!response.text) {
      console.warn("Empty response from AI for category:", category);
      return [];
    }

    const newsData = JSON.parse(response.text);
    
    return newsData.map((item: any, index: number) => ({
      id: `${category}-${index}-${Date.now()}`,
      title: item.title,
      summary: item.summary,
      source: item.source,
      timestamp: new Date().toISOString(),
      category: category as any,
      impact: item.impact || 'medium',
      url: item.url
    }));
  } catch (error) {
    console.error("Error fetching news after retries:", error);
    return [];
  }
}

export async function translateNewsToKhmer(title: string, summary: string): Promise<{ title: string, summary: string }> {
  const prompt = `Translate the following news title and summary to Khmer language. 
  Title: "${title}"
  Summary: "${summary}"
  Return the result as a JSON object with keys "title" and "summary".`;
  
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    }));
    
    const result = JSON.parse(response.text || "{}");
    return {
      title: result.title || title,
      summary: result.summary || summary
    };
  } catch (error) {
    console.error("Error translating news to Khmer after retries:", error);
    return { title, summary };
  }
}
