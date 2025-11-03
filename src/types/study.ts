export type StudyMode = 'text' | 'voice' | 'avatar';

export interface Message {
  role: 'ai' | 'user';
  content: string;
  timestamp: number;
}

export interface ScenarioData {
  scenarioId: string;
  messages: Message[];
  confidenceRating: number;
  trustRating: number;
  engagementRating: boolean;
  completedAt: number;
}

export interface PreTestResponse {
  questionId: string;
  answer: string;
}

export interface PostTestResponse {
  questionId: string;
  answer: string;
}

export interface StudySession {
  sessionId: string;
  mode: StudyMode;
  startedAt: number;
  preTest: PreTestResponse[];
  scenarios: ScenarioData[];
  postTest: PostTestResponse[];
  demographics: {
    age?: string;
    education?: string;
    aiExperience?: string;
  };
  completedAt?: number;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  duration: string;
  dialogue: DialogueTurn[];
}

export interface DialogueTurn {
  id: string;
  aiMessage: string;
  expectedTopics?: string[];
  nextTurnId?: string;
}
