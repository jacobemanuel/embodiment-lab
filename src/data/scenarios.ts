import { Scenario } from "@/types/study";

export const scenarios: Scenario[] = [
  {
    id: "bias",
    title: "Bias in Machine Learning",
    description: "Explore how bias enters AI through training data",
    duration: "~10 minutes",
    dialogue: [
      {
        id: "bias-1",
        aiMessage: "Welcome! Let's explore how machine learning models develop bias. Imagine a company is building an AI to screen job applications. What data do you think they'd use to train it?",
        expectedTopics: ["historical data", "past applications", "resume data"],
        nextTurnId: "bias-2"
      },
      {
        id: "bias-2",
        aiMessage: "Exactly! They'd use historical hiring data. Now here's the key question: What if that historical data reflects past discrimination? For example, what if the company mostly hired men for technical roles in the past?",
        expectedTopics: ["bias", "discrimination", "unfair patterns"],
        nextTurnId: "bias-3"
      },
      {
        id: "bias-3",
        aiMessage: "Right! The AI would learn those biased patterns. It might start rejecting qualified women simply because the historical data showed fewer women in those roles. Can you think of why this is particularly problematic?",
        expectedTopics: ["perpetuates discrimination", "unfair", "amplifies bias"],
        nextTurnId: "bias-4"
      },
      {
        id: "bias-4",
        aiMessage: "Precisely. It creates a cycle: past discrimination → biased training data → biased AI → continued discrimination. How do you think we could address this problem?",
        expectedTopics: ["diverse data", "audit", "fairness testing", "human oversight"],
      }
    ]
  },
  {
    id: "transparency",
    title: "Transparency & Interpretability",
    description: "Why AI needs to explain its decisions",
    duration: "~10 minutes",
    dialogue: [
      {
        id: "trans-1",
        aiMessage: "Let's talk about AI transparency. Imagine you apply for a loan and get rejected by an AI system. The bank tells you 'the AI said no,' but can't explain why. How would that make you feel?",
        expectedTopics: ["frustrated", "unfair", "want explanation"],
        nextTurnId: "trans-2"
      },
      {
        id: "trans-2",
        aiMessage: "That frustration is valid! Now think about this: Why might it be important to understand why the AI rejected your loan application?",
        expectedTopics: ["fix mistakes", "appeal", "accountability", "trust"],
        nextTurnId: "trans-3"
      },
      {
        id: "trans-3",
        aiMessage: "Exactly! Without explanation, you can't challenge errors or understand what to improve. This is called the 'black box' problem—when AI makes decisions we can't understand. What fields do you think need explainable AI the most?",
        expectedTopics: ["healthcare", "criminal justice", "finance", "hiring"],
        nextTurnId: "trans-4"
      },
      {
        id: "trans-4",
        aiMessage: "Absolutely. In life-changing decisions like medical diagnosis or parole decisions, we need to know why. What do you think companies should do to make their AI systems more transparent?",
        expectedTopics: ["explain decisions", "audit", "simple language", "human oversight"],
      }
    ]
  },
  {
    id: "hallucinations",
    title: "LLM Hallucinations & Limitations",
    description: "AI generates confident-sounding false information",
    duration: "~10 minutes",
    dialogue: [
      {
        id: "hall-1",
        aiMessage: "Let's explore a fascinating limitation of large language models like ChatGPT. Have you ever heard the term 'AI hallucination'? What do you think it means?",
        expectedTopics: ["making things up", "false information", "incorrect facts"],
        nextTurnId: "hall-2"
      },
      {
        id: "hall-2",
        aiMessage: "Good intuition! AI hallucination is when a language model generates information that sounds plausible and confident, but is completely made up. For example, it might invent fake research papers or cite nonexistent sources. Why do you think this happens?",
        expectedTopics: ["pattern matching", "no real knowledge", "prediction", "training data"],
        nextTurnId: "hall-3"
      },
      {
        id: "hall-3",
        aiMessage: "Exactly! Language models predict what words should come next based on patterns, but they don't truly 'know' facts. They can't verify if something is true—they just generate what seems likely based on their training. What situations do you think hallucinations could be especially dangerous?",
        expectedTopics: ["medical advice", "legal info", "news", "research", "important decisions"],
        nextTurnId: "hall-4"
      },
      {
        id: "hall-4",
        aiMessage: "Precisely. If someone makes medical decisions based on hallucinated information, that could be harmful. What do you think users should do to protect themselves from AI hallucinations?",
        expectedTopics: ["verify sources", "fact-check", "don't trust blindly", "use multiple sources"],
      }
    ]
  },
  {
    id: "impact",
    title: "Societal Impact & Responsibility",
    description: "AI systems have real consequences for real people",
    duration: "~10 minutes",
    dialogue: [
      {
        id: "impact-1",
        aiMessage: "Let's think about AI's real-world impact. Imagine a social media platform uses AI to automatically moderate content—removing posts it flags as 'harmful.' Sounds helpful, right? What could go wrong?",
        expectedTopics: ["false positives", "mistakes", "censorship", "important info removed"],
        nextTurnId: "impact-2"
      },
      {
        id: "impact-2",
        aiMessage: "Exactly! The AI might incorrectly flag and remove legitimate content. For instance, it might remove posts about cancer treatment because they mention 'illness,' or delete educational content about social issues. Who gets hurt when this happens?",
        expectedTopics: ["users", "marginalized groups", "people seeking help", "activists"],
        nextTurnId: "impact-3"
      },
      {
        id: "impact-3",
        aiMessage: "Right. Real people lose access to vital information or communities. Now here's the key question: Who should be responsible when an AI system causes harm like this?",
        expectedTopics: ["companies", "developers", "designers", "leadership", "regulators"],
        nextTurnId: "impact-4"
      },
      {
        id: "impact-4",
        aiMessage: "That's an important perspective. Many say responsibility lies with the organizations deploying AI, not just individual developers. What do you think companies should do before deploying AI systems that affect millions of people?",
        expectedTopics: ["testing", "diverse perspectives", "impact assessment", "oversight", "accountability"],
      }
    ]
  }
];
