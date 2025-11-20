import { Scenario } from "@/types/study";

export const scenarios: Scenario[] = [
  {
    id: "ai-image-basics",
    title: "AI Image Generation Fundamentals",
    description: "Learn how to create stunning images with AI using effective prompts and parameters",
    duration: "~8 minutes",
    dialogue: [
      {
        id: "ai-1",
        aiMessage: "Welcome! Let's explore the fascinating world of AI image generation. Have you ever wondered how AI can turn words into images? Let's start simple: if you wanted to create an image of 'a sunset', what details would you add to make it more specific and vivid?",
        expectedTopics: ["colors", "location", "style", "mood", "composition"],
        nextTurnId: "ai-2"
      },
      {
        id: "ai-2",
        aiMessage: "Excellent thinking! Being specific is key to great results. Now, imagine you're creating a fantasy landscape with mountains. Just saying 'mountains' is quite vague. What descriptive words could you add to guide the AI better? Think about artistic style, time of day, atmosphere, or mood...",
        expectedTopics: ["adjectives", "style keywords", "artistic style", "lighting", "atmosphere"],
        nextTurnId: "ai-3"
      },
      {
        id: "ai-3",
        aiMessage: "Great! Now let's talk about parameters. You've written a perfect prompt, but the AI gives you unexpected results. There's something called 'CFG Scale' (Classifier-Free Guidance). What do you think happens if you increase it? Does the AI follow your prompt more strictly or become more creative and unpredictable?",
        expectedTopics: ["CFG scale", "prompt adherence", "creativity", "control", "parameters"],
        nextTurnId: "ai-4"
      },
      {
        id: "ai-4",
        aiMessage: "Exactly right! Higher CFG = stricter adherence to your prompt. Now, here's an important question: AI can generate incredibly realistic images of people, places, and things. What ethical concerns should we keep in mind when creating images with AI? Think about potential misuse and responsible creation...",
        expectedTopics: ["deepfakes", "copyright", "misinformation", "consent", "attribution", "ethics"],
      }
    ]
  }
];
