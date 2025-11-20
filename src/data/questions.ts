export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer?: string;
}

export const preTestQuestions: Question[] = [
  {
    id: "pre-1",
    text: "What is a 'prompt' in AI image generation?",
    options: [
      "A button to start the generation process",
      "A text description that guides the AI to create an image",
      "The image file format",
      "A payment method for AI services"
    ],
    correctAnswer: "A text description that guides the AI to create an image"
  },
  {
    id: "pre-2",
    text: "Which parameter controls how closely the AI follows your prompt?",
    options: [
      "Temperature",
      "CFG Scale (Classifier-Free Guidance)",
      "Resolution",
      "Seed number"
    ],
    correctAnswer: "CFG Scale (Classifier-Free Guidance)"
  },
  {
    id: "pre-3",
    text: "What does 'negative prompt' do?",
    options: [
      "Creates dark or scary images",
      "Deletes the previous image",
      "Tells the AI what NOT to include in the image",
      "Reduces the image quality"
    ],
    correctAnswer: "Tells the AI what NOT to include in the image"
  },
  {
    id: "pre-4",
    text: "What is 'Stable Diffusion'?",
    options: [
      "A photo editing app",
      "An AI model for generating images from text",
      "A color correction technique",
      "A camera stabilization feature"
    ],
    correctAnswer: "An AI model for generating images from text"
  },
  {
    id: "pre-5",
    text: "What does the 'seed' parameter control?",
    options: [
      "The cost of generation",
      "The randomness/reproducibility of results",
      "The color palette",
      "The generation speed"
    ],
    correctAnswer: "The randomness/reproducibility of results"
  },
  {
    id: "pre-6",
    text: "Which aspect ratio is best for portrait-oriented images?",
    options: [
      "16:9 (landscape)",
      "1:1 (square)",
      "9:16 (portrait)",
      "21:9 (ultra-wide)"
    ],
    correctAnswer: "9:16 (portrait)"
  },
  {
    id: "pre-7",
    text: "What is an ethical concern with AI image generation?",
    options: [
      "It uses too much electricity",
      "It can create deepfakes or copyright violations",
      "It's too expensive for students",
      "It only works in English"
    ],
    correctAnswer: "It can create deepfakes or copyright violations"
  },
  {
    id: "pre-8",
    text: "What does 'img2img' mean?",
    options: [
      "Converting images to different formats",
      "Using an existing image as a base for AI generation",
      "Copying images from the internet",
      "Compressing images"
    ],
    correctAnswer: "Using an existing image as a base for AI generation"
  },
  {
    id: "pre-9",
    text: "What is 'inpainting'?",
    options: [
      "Painting on a canvas",
      "Editing specific parts of an image while keeping the rest",
      "Printing images on paper",
      "Creating animations"
    ],
    correctAnswer: "Editing specific parts of an image while keeping the rest"
  },
  {
    id: "pre-10",
    text: "Which prompt would likely produce BETTER results?",
    options: [
      "cat",
      "a fluffy orange tabby cat sitting on a windowsill at sunset, detailed fur, photorealistic",
      "CAT CAT CAT",
      "give me a cat picture"
    ],
    correctAnswer: "a fluffy orange tabby cat sitting on a windowsill at sunset, detailed fur, photorealistic"
  }
];

export const postTestQuestions: Question[] = [...preTestQuestions];

export const demographicQuestions: Question[] = [
  {
    id: "demo-age",
    text: "What is your age range?",
    options: ["<18", "18-24", "25-34", "35-44", "45-60", "60+", "Prefer not to say"]
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
    id: "demo-digital-experience",
    text: "Experience with digital learning platforms",
    options: [
      "1 - No Experience",
      "2 - Limited Experience",
      "3 - Moderate Experience",
      "4 - Good Experience",
      "5 - Extensive Experience"
    ]
  }
];
