export interface Slide {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  keyPoints: string[];
  systemPromptContext: string;
}

export const slides: Slide[] = [
  {
    id: "intro",
    title: "Introduction to AI Image Generation",
    content: `AI image generation uses deep learning models to create images from text descriptions.

The Basic Flow:

    Text Prompt  -->  AI Model  -->  Image Output

How It Works:

1. Text Encoding - Your prompt becomes numbers the AI understands
2. Diffusion Process - Starting from noise, refined into an image
3. Image Decoding - Final artwork is rendered

Popular Models:

| Model | Best For |
|-------|----------|
| Stable Diffusion | Open source, customizable |
| DALL-E | Ease of use |
| Midjourney | Artistic, stylized |
| Flux | Speed + quality |`,
    keyPoints: [
      "AI generates images from text descriptions",
      "Uses diffusion process to create images",
      "Multiple models available with different strengths"
    ],
    systemPromptContext: "The user is learning the fundamentals of AI image generation. Explain concepts at a beginner level, focusing on the basic workflow: text input, AI processing, image output."
  },
  {
    id: "prompt-anatomy",
    title: "Anatomy of a Prompt",
    content: `A well-structured prompt is like a recipe for the AI.

The Formula:

    Subject  +  Description  +  Style  +  Quality

Example Breakdown:

"A majestic lion standing on a cliff at sunset, digital art, highly detailed, 8k"

| Component | Your Words |
|-----------|------------|
| Subject | A majestic lion |
| Setting | standing on a cliff at sunset |
| Style | digital art |
| Quality | highly detailed, 8k |

Quick Tips:

- "golden retriever puppy" is better than just "dog" (be specific)
- "sunset lighting, moody atmosphere" is better than "nice background" (add context)`,
    keyPoints: [
      "Prompts have structure: Subject + Description + Style + Quality",
      "Specificity leads to better results",
      "Quality modifiers enhance the output"
    ],
    systemPromptContext: "The user is learning how to write effective prompts. Explain the importance of each component and help them practice breaking down prompts."
  },
  {
    id: "style-keywords",
    title: "Style Keywords",
    content: `Style keywords are your creative tools.

Photography:
portrait, landscape, macro, street photography

Art Movements:
impressionism, cyberpunk, anime, art nouveau

Lighting:
golden hour, dramatic lighting, rim lighting, soft diffused

Rendering:
3D render, watercolor, oil painting, pixel art

Mixing Styles:

| Combination | Result |
|-------------|--------|
| cyberpunk + oil painting | neon Renaissance |
| anime + golden hour | warm Ghibli vibes |
| portrait + rim lighting | dramatic headshot |`,
    keyPoints: [
      "Photography styles define the camera perspective",
      "Art movements bring historical aesthetics",
      "Lighting keywords control mood and atmosphere"
    ],
    systemPromptContext: "The user is exploring style keywords. Help them understand how different keywords affect the final image."
  },
  {
    id: "parameters",
    title: "CFG Scale & Parameters",
    content: `These are your control settings.

CFG Scale (how strictly AI follows your prompt):

    Low (1-5)     Medium (7-9)     High (10-15)
    Creative      Balanced         Strict
                  [best for most]

Steps (refinement passes):

    20-30 steps = quick drafts
    40-50 steps = good quality (recommended)
    75+ steps = diminishing returns

Seed:

    Same prompt + Same seed = Same image
    Same prompt + New seed = Variation

Common Dimensions:

| Ratio | Size | Best For |
|-------|------|----------|
| 1:1 | 1024x1024 | Portraits |
| 16:9 | 1920x1080 | Landscapes |
| 9:16 | 1080x1920 | Mobile |`,
    keyPoints: [
      "CFG 7-9 is the sweet spot for most images",
      "40-50 steps balance quality and speed",
      "Seeds allow reproducible results"
    ],
    systemPromptContext: "The user is learning technical parameters. Use simple analogies: CFG is like how strict the AI follows instructions, steps are like refinement passes."
  },
  {
    id: "img2img",
    title: "Image-to-Image",
    content: `Transform existing images with AI.

The Process:

    Your Image  +  Prompt  -->  New Image

Denoising Strength (transformation amount):

    Low (0.1-0.3)      Medium (0.4-0.6)      High (0.7-0.9)
    Subtle changes     Balanced              Major changes
    Keeps structure    [start here]          Loose interpretation

What You Can Do:

| Technique | Input to Output |
|-----------|-----------------|
| Style Transfer | Photo to Painting |
| Upscaling | Low-res to High-res |
| Inpainting | Fix parts of image |
| Outpainting | Extend boundaries |
| Sketch to Art | Rough to Finished |`,
    keyPoints: [
      "Denoising strength controls transformation amount",
      "Lower values preserve more of the original",
      "Great for style transfer and image editing"
    ],
    systemPromptContext: "The user is learning image-to-image techniques. Explain denoising strength as a transformation dial."
  },
  {
    id: "negative-prompts",
    title: "Negative Prompts",
    content: `Tell the AI what to avoid.

How It Works:

    Positive: "portrait of a woman"
    Negative: "blurry, cartoon, deformed"

Common Negative Prompts:

Quality Fixes:
blurry, low quality, pixelated, watermark, text

Anatomy Fixes:
extra fingers, mutated hands, deformed, bad anatomy

Style Control:
cartoon, anime (if you want realistic)
photorealistic (if you want stylized)

Guidelines:

| Do | Don't |
|----|-------|
| Be specific: "blurry background" | Too vague: "bad" |
| Add gradually based on results | Overload with 50+ negatives |
| Match your intended style | Contradict your positive prompt |`,
    keyPoints: [
      "Negative prompts exclude unwanted elements",
      "Use them to fix common issues like extra fingers",
      "Don't overload with too many negatives"
    ],
    systemPromptContext: "The user is learning about negative prompts. Explain them as things to avoid - they help refine output by excluding unwanted elements."
  },
  {
    id: "ethics",
    title: "Ethics & Responsibility",
    content: `With great power comes responsibility.

Key Questions:

    Copyright: Who trained the AI?
    Deepfakes: Real people without consent?
    Attribution: Who made this art?

Guidelines:

| Do | Don't |
|----|-------|
| Label AI art when sharing | Create fake images of real people |
| Use for learning and creativity | Pass off as human-made art |
| Respect platform rules | Spread misinformation |
| Support human artists too | Copy artist styles without credit |

Think Before You Generate:

    Is this harmful to someone? --> Stop
    Is this deceptive? --> Stop
    Is this creative and respectful? --> Go ahead

AI art is a tool. How we use it defines its impact.`,
    keyPoints: [
      "Consider copyright and artist attribution",
      "Avoid creating deepfakes or misinformation",
      "Label AI-generated content when sharing"
    ],
    systemPromptContext: "The user is learning about AI art ethics. Discuss the balance between creative freedom and responsibility."
  }
];

export const getSlideById = (id: string): Slide | undefined => {
  return slides.find(slide => slide.id === id);
};

export const getSlideIndex = (id: string): number => {
  return slides.findIndex(slide => slide.id === id);
};

export const getNextSlide = (currentId: string): Slide | undefined => {
  const currentIndex = getSlideIndex(currentId);
  if (currentIndex < slides.length - 1) {
    return slides[currentIndex + 1];
  }
  return undefined;
};

export const getPreviousSlide = (currentId: string): Slide | undefined => {
  const currentIndex = getSlideIndex(currentId);
  if (currentIndex > 0) {
    return slides[currentIndex - 1];
  }
  return undefined;
};
