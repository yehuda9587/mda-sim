import medicalData from './medical_data.json';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function buildSystemPrompt(mode: 'א' | 'ב', messages: Message[]): string {
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
  
  // 1. Find matches but limit to the TOP 2 most relevant keys
  const relevantKeys = Object.keys(medicalData)
    .filter(key => lastUserMessage.toLowerCase().includes(key.toLowerCase()))
    .slice(0, 2); 

  // 2. Extract data and ensure it's not massive
  let contextData = relevantKeys.length > 0 
    ? relevantKeys.map(key => (medicalData as any)[key]).join('\n\n')
    : "Follow standard MDA BLS/ALS protocols.";

  // 3. HARD TRUNCATE: If the context is over 3000 characters, cut it off.
  // This ensures we stay well under the 6000 token limit.
  if (contextData.length > 3000) {
    contextData = contextData.substring(0, 3000) + "... [truncated]";
  }

  return `אתה סימולטור רפואי מקצועי של מד"א. עליך להשתמש אך ורק בטרמינולוגיה המקצועית המקובלת בישראל (לדוגמה: 'מדדים', 'סטורציה', 'לחץ דם', 'מנגנון פגיעה', 'סכימת PHTLS'). אל תתרגם מונחים מאנגלית באופן מילולי אם יש להם מונח מקצועי בעברית.`;
}
