export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer?: string;
}

export const preTestQuestions: Question[] = [
  {
    id: "pre-1",
    text: "What is machine learning bias?",
    options: [
      "When an AI system performs poorly",
      "When an AI system reflects unfair patterns from training data",
      "When an AI system is too slow",
      "When an AI system crashes frequently"
    ],
    correctAnswer: "When an AI system reflects unfair patterns from training data"
  },
  {
    id: "pre-2",
    text: "Why is AI transparency important?",
    options: [
      "To make AI faster",
      "To reduce computing costs",
      "To enable users to understand and challenge decisions",
      "To improve graphics"
    ],
    correctAnswer: "To enable users to understand and challenge decisions"
  },
  {
    id: "pre-3",
    text: "What is an AI hallucination?",
    options: [
      "When AI generates visual illusions",
      "When AI confidently produces false information",
      "When AI becomes self-aware",
      "When AI refuses to respond"
    ],
    correctAnswer: "When AI confidently produces false information"
  },
  {
    id: "pre-4",
    text: "Who should be responsible for harmful AI decisions?",
    options: [
      "Only the end users",
      "Only the AI itself",
      "The organizations deploying the AI",
      "No one—it's just technology"
    ],
    correctAnswer: "The organizations deploying the AI"
  },
  {
    id: "pre-5",
    text: "Historical hiring data that favored men would likely cause an AI to:",
    options: [
      "Hire more women to balance it out",
      "Continue favoring male candidates",
      "Ignore gender entirely",
      "Hire randomly"
    ],
    correctAnswer: "Continue favoring male candidates"
  },
  {
    id: "pre-6",
    text: "A 'black box' AI system is one that:",
    options: [
      "Is physically black in color",
      "Only works in darkness",
      "Makes decisions without explanation",
      "Is very simple to understand"
    ],
    correctAnswer: "Makes decisions without explanation"
  },
  {
    id: "pre-7",
    text: "Why can't large language models verify if information is true?",
    options: [
      "They're too slow",
      "They predict patterns, but don't have real knowledge",
      "They're not connected to the internet",
      "They don't want to"
    ],
    correctAnswer: "They predict patterns, but don't have real knowledge"
  },
  {
    id: "pre-8",
    text: "Which field needs explainable AI most urgently?",
    options: [
      "Video games",
      "Social media likes",
      "Medical diagnosis",
      "Weather prediction"
    ],
    correctAnswer: "Medical diagnosis"
  },
  {
    id: "pre-9",
    text: "What should you do if AI gives you medical advice?",
    options: [
      "Follow it immediately",
      "Verify with trusted sources and professionals",
      "Ignore it completely",
      "Share it widely"
    ],
    correctAnswer: "Verify with trusted sources and professionals"
  },
  {
    id: "pre-10",
    text: "When AI content moderation removes legitimate posts, this affects:",
    options: [
      "Only the platform, not users",
      "No one—it's just digital content",
      "Real people who lose access to information",
      "Only computer systems"
    ],
    correctAnswer: "Real people who lose access to information"
  }
];

export const postTestQuestions: Question[] = [...preTestQuestions];

export const demographicQuestions: Question[] = [
  {
    id: "demo-age",
    text: "What is your age range?",
    options: ["18-24", "25-34", "35-44", "45-54", "55+", "Prefer not to say"]
  },
  {
    id: "demo-education",
    text: "What is your highest level of education?",
    options: [
      "High school or less",
      "Some college",
      "Bachelor's degree",
      "Master's degree",
      "Doctoral degree",
      "Prefer not to say"
    ]
  },
  {
    id: "demo-ai-experience",
    text: "How much experience do you have with AI?",
    options: [
      "None—I'm completely new",
      "A little—I've used AI tools a few times",
      "Moderate—I use AI regularly",
      "Extensive—I work with AI professionally",
      "Prefer not to say"
    ]
  }
];
