export interface PostTestQuestion {
  id: string;
  text: string;
  type: 'likert' | 'multiple-choice';
  options: string[];
  category?: 'expectations' | 'avatar-qualities' | 'realism' | 'trust' | 'engagement' | 'satisfaction' | 'knowledge';
}

export const postTestQuestions: PostTestQuestion[] = [
  // === EXPECTATIONS TOWARD LEARNING WITH AN AVATAR ===
  {
    id: "expectation-main",
    text: "What is your main expectation from a teaching avatar? (Select the TWO most important)",
    type: 'multiple-choice',
    category: 'expectations',
    options: [
      "Clear and easy-to-understand explanations",
      "Personalized feedback based on my learning needs",
      "Guidance through exercises and problem-solving",
      "Motivation and encouragement during learning",
      "Availability to answer questions anytime",
      "Providing structure and helping me stay on track",
      "Simplifying complex topics",
      "A friendly and supportive learning experience"
    ]
  },
  {
    id: "learning-tasks",
    text: "For which learning tasks would you use an avatar? (Select all that apply)",
    type: 'multiple-choice',
    category: 'expectations',
    options: [
      "Explanations of concepts",
      "Guided exercises",
      "Q&A sessions",
      "Exam preparation",
      "Motivation and coaching",
      "Other"
    ]
  },
  
  // === AVATAR QUALITIES RATINGS (1-5) ===
  {
    id: "quality-clear-language",
    text: "How important is CLEAR LANGUAGE for an avatar?",
    type: 'likert',
    category: 'avatar-qualities',
    options: ["1 - Not important", "2", "3", "4", "5 - Very important"]
  },
  {
    id: "quality-patience",
    text: "How important is PATIENCE / ABILITY TO REPEAT for an avatar?",
    type: 'likert',
    category: 'avatar-qualities',
    options: ["1 - Not important", "2", "3", "4", "5 - Very important"]
  },
  {
    id: "quality-emotional-support",
    text: "How important is EMOTIONAL SUPPORT for an avatar?",
    type: 'likert',
    category: 'avatar-qualities',
    options: ["1 - Not important", "2", "3", "4", "5 - Very important"]
  },
  {
    id: "quality-personalized-feedback",
    text: "How important is PERSONALIZED FEEDBACK for an avatar?",
    type: 'likert',
    category: 'avatar-qualities',
    options: ["1 - Not important", "2", "3", "4", "5 - Very important"]
  },
  
  // === AVATAR REALISM & PERCEPTION ===
  {
    id: "visual-style",
    text: "What visual style do you prefer for a teaching avatar?",
    type: 'likert',
    category: 'realism',
    options: [
      "1 - Highly stylized/cartoon-like",
      "2",
      "3 - Balanced",
      "4",
      "5 - Highly realistic/photo-like"
    ]
  },
  {
    id: "human-likeness",
    text: "What level of human-likeness do you prefer?",
    type: 'likert',
    category: 'realism',
    options: [
      "1 - Not human-like at all",
      "2",
      "3 - Somewhat human-like",
      "4",
      "5 - Very human-like"
    ]
  },
  
  // === TRUST & ENGAGEMENT (updated for AI image generation) ===
  {
    id: "trust-1",
    text: "I trust the AI system to provide accurate information about AI image generation",
    type: 'likert',
    category: 'trust',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "trust-2",
    text: "I would rely on this AI system for learning complex technical topics",
    type: 'likert',
    category: 'trust',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "trust-3",
    text: "The AI system's explanations were credible and trustworthy",
    type: 'likert',
    category: 'trust',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "trust-builds",
    text: "What builds trust in an avatar? (Select all that apply)",
    type: 'multiple-choice',
    category: 'trust',
    options: [
      "Competence in the subject matter",
      "Transparency about limitations",
      "Calm voice and demeanor",
      "Consistency in responses",
      "Likeability and friendliness"
    ]
  },
  {
    id: "trust-willingness",
    text: "How willing are you to trust an avatar with complex learning tasks?",
    type: 'likert',
    category: 'trust',
    options: ["1 - Not willing", "2", "3 - Neutral", "4", "5 - Very willing"]
  },
  {
    id: "trust-lost",
    text: "When is trust in an avatar LOST? (Select all that apply)",
    type: 'multiple-choice',
    category: 'trust',
    options: [
      "Over-realistic appearance (uncanny valley)",
      "Monotone voice",
      "Errors in answers",
      "Slow response time",
      "Lack of empathy"
    ]
  },
  
  // === ENGAGEMENT ===
  {
    id: "engagement-1",
    text: "The learning experience kept me engaged throughout",
    type: 'likert',
    category: 'engagement',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "engagement-2",
    text: "I felt motivated to complete all the scenarios",
    type: 'likert',
    category: 'engagement',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "engagement-3",
    text: "The interactive format was more engaging than traditional reading",
    type: 'likert',
    category: 'engagement',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "interaction-preference",
    text: "What is your preferred interaction type for learning?",
    type: 'multiple-choice',
    category: 'engagement',
    options: ["Video-based", "Audio-based", "Chat-based (text)", "Mixed (combination)"]
  },
  
  // === SATISFACTION ===
  {
    id: "satisfaction-1",
    text: "Overall, I am satisfied with this learning experience",
    type: 'likert',
    category: 'satisfaction',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "satisfaction-2",
    text: "I would recommend this learning format to other students",
    type: 'likert',
    category: 'satisfaction',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "satisfaction-3",
    text: "The learning mode I used was effective for understanding AI image generation concepts",
    type: 'likert',
    category: 'satisfaction',
    options: [
      "Strongly disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly agree"
    ]
  },
  
  // === KNOWLEDGE CHECK (AI Image Generation) ===
  {
    id: "knowledge-1",
    text: "What is a 'prompt' in AI image generation?",
    type: 'multiple-choice',
    category: 'knowledge',
    options: [
      "A button to start generation",
      "A text description guiding the AI",
      "An image file format",
      "A payment method"
    ]
  },
  {
    id: "knowledge-2",
    text: "What does 'negative prompt' do?",
    type: 'multiple-choice',
    category: 'knowledge',
    options: [
      "Creates dark images",
      "Deletes previous images",
      "Tells AI what NOT to include",
      "Reduces quality"
    ]
  },
  {
    id: "knowledge-3",
    text: "What does 'CFG Scale' control?",
    type: 'multiple-choice',
    category: 'knowledge',
    options: [
      "Image resolution",
      "How strictly the AI follows your prompt",
      "Generation speed",
      "File size"
    ]
  },
  {
    id: "knowledge-4",
    text: "What is an ethical concern with AI image generation?",
    type: 'multiple-choice',
    category: 'knowledge',
    options: [
      "It's too slow",
      "Potential for deepfakes and copyright violations",
      "Limited to English only",
      "Expensive for students"
    ]
  },
  {
    id: "knowledge-5",
    text: "Which prompt would produce BETTER results?",
    type: 'multiple-choice',
    category: 'knowledge',
    options: [
      "dog",
      "a golden retriever puppy playing in a sunny garden, photorealistic, detailed fur",
      "DOG DOG DOG",
      "make dog"
    ]
  }
];
