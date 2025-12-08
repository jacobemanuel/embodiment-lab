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
    content: `# Welcome to AI Image Generation

AI image generation uses **deep learning models** to create images from text descriptions.

## The Basic Flow

┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   📝 Text   │ → │   🧠 AI    │ → │   🖼️ Image  │
│   Prompt    │    │   Model    │    │   Output   │
└─────────────┘    └─────────────┘    └─────────────┘

## How It Works

1. **Text Encoding** - Your prompt becomes numbers the AI understands
2. **Diffusion Process** - Starting from noise → refined image
3. **Image Decoding** - Final artwork is rendered

## Popular Models

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
    systemPromptContext: "The user is learning the fundamentals of AI image generation. Explain concepts at a beginner level, focusing on the basic workflow: text input → AI processing → image output. Help them understand that AI 'imagines' images based on patterns it learned from millions of examples."
  },
  {
    id: "prompt-anatomy",
    title: "Anatomy of a Prompt",
    content: `# Anatomy of a Prompt

A well-structured prompt is like a recipe for the AI.

## The Formula

┌──────────┬─────────────┬─────────┬──────────────┐
│ Subject  │ Description │  Style  │   Quality    │
│   WHO    │    WHAT     │   HOW   │   POLISH     │
└──────────┴─────────────┴─────────┴──────────────┘

## Example Breakdown

**"A majestic lion standing on a cliff at sunset, digital art, highly detailed, 8k"**

| Component | Your Words |
|-----------|------------|
| 🎯 Subject | A majestic lion |
| 📍 Setting | standing on a cliff at sunset |
| 🎨 Style | digital art |
| ✨ Quality | highly detailed, 8k |

## Quick Tips

✅ "golden retriever puppy" → specific
❌ "dog" → too vague

✅ "sunset lighting, moody atmosphere" → context
❌ "nice background" → unclear`,
    keyPoints: [
      "Prompts have structure: Subject + Description + Style + Quality",
      "Specificity leads to better results",
      "Quality modifiers enhance the output"
    ],
    systemPromptContext: "The user is learning how to write effective prompts. Explain the importance of each component and help them practice breaking down prompts into their elements. Encourage experimentation with different combinations."
  },
  {
    id: "style-keywords",
    title: "Style Keywords & Artistic Directions",
    content: `# Style Keywords & Artistic Directions

Style keywords are your creative paintbrush!

## Style Categories

📷 **Photography**
│ portrait • landscape • macro • street

🎨 **Art Movements**
│ impressionism • cyberpunk • anime • art nouveau

💡 **Lighting**
│ golden hour • dramatic • rim lighting • soft diffused

🖌️ **Rendering**
│ 3D render • watercolor • oil painting • pixel art

## Mixing Styles = Unique Art

\`\`\`
"cyberpunk" + "oil painting" = neon Renaissance
"anime" + "golden hour" = warm Ghibli vibes
"portrait" + "rim lighting" = dramatic headshot
\`\`\`

## Same Subject, Different Styles

| Style | Result |
|-------|--------|
| Photo realistic | Looks like a real photo |
| Watercolor | Soft, dreamy, flowing |
| Cyberpunk | Neon, futuristic, tech |
| Studio Ghibli | Whimsical, animated, warm |`,
    keyPoints: [
      "Photography styles define the camera perspective",
      "Art movements bring historical aesthetics",
      "Lighting keywords control mood and atmosphere"
    ],
    systemPromptContext: "The user is exploring style keywords. Help them understand how different keywords affect the final image. Encourage combining styles (e.g., 'cyberpunk + oil painting') for unique results."
  },
  {
    id: "parameters",
    title: "CFG Scale & Generation Parameters",
    content: `# CFG Scale & Generation Parameters

These are your control knobs! 🎛️

## CFG Scale (How strictly AI follows your prompt)

       CREATIVE ←───────────────→ STRICT
          │                          │
        1-5                       10-15
      (loose)    ⭐ 7-9 ⭐       (rigid)
               (sweet spot)

## Steps (Refinement passes)

       FAST ←─────────────────────→ DETAILED
         │                              │
       20-30                          75+
      (drafts)    ⭐ 40-50 ⭐    (diminishing)
                 (best balance)

## Seed (Starting point)

┌─────────────────────────────────────────┐
│  Same prompt + Same seed = Same image   │
│  Same prompt + New seed = Variation     │
└─────────────────────────────────────────┘

## Common Dimensions

| Ratio | Size | Best For |
|-------|------|----------|
| 1:1 | 1024×1024 | Portraits |
| 16:9 | 1920×1080 | Landscapes |
| 9:16 | 1080×1920 | Mobile/Stories |`,
    keyPoints: [
      "CFG 7-9 is the sweet spot for most images",
      "40-50 steps balance quality and speed",
      "Seeds allow reproducible results"
    ],
    systemPromptContext: "The user is learning technical parameters. Use simple analogies: CFG is like how 'strict' the AI follows instructions, steps are like 'refinement passes', seed is like a 'random starting point'. Encourage experimentation."
  },
  {
    id: "img2img",
    title: "Image-to-Image Workflows",
    content: `# Image-to-Image Workflows

Transform existing images with AI! 🔄

## The Process

┌──────────┐   ┌─────────────┐   ┌──────────┐
│ 📷 Your  │ + │ 📝 Prompt   │ → │ 🎨 New   │
│  Image   │   │ "make it    │   │  Image   │
│          │   │  fantasy"   │   │          │
└──────────┘   └─────────────┘   └──────────┘

## Denoising Strength = Transformation Amount

      SUBTLE ←─────────────────→ DRAMATIC
         │                          │
       0.1-0.3                   0.7-0.9
      (touch-ups)              (major changes)
                 ⭐ 0.4-0.6 ⭐
                  (balanced)

## What You Can Do

| Technique | Input → Output |
|-----------|----------------|
| Style Transfer | Photo → Painting |
| Upscaling | Low-res → High-res |
| Inpainting | Fix parts of image |
| Outpainting | Extend boundaries |
| Sketch → Art | Rough → Finished |`,
    keyPoints: [
      "Denoising strength controls transformation amount",
      "Lower values preserve more of the original",
      "Great for style transfer and image editing"
    ],
    systemPromptContext: "The user is learning image-to-image techniques. Explain denoising strength as a 'transformation dial' - low keeps the original, high creates something new. Discuss practical applications like style transfer."
  },
  {
    id: "negative-prompts",
    title: "Negative Prompts",
    content: `# Negative Prompts

Tell the AI what to AVOID! 🚫

## How It Works

┌───────────────────────────────────────┐
│ Positive: "portrait of a woman"       │
│ Negative: "blurry, cartoon, deformed" │
│                                       │
│     ✅ Include    │    ❌ Exclude     │
└───────────────────────────────────────┘

## Common Negative Prompts

**🔧 Quality Fixes**
\`\`\`
blurry, low quality, pixelated, watermark, text
\`\`\`

**🖐️ Anatomy Fixes**
\`\`\`
extra fingers, mutated hands, deformed, bad anatomy
\`\`\`

**🎨 Style Control**
\`\`\`
cartoon, anime  ← if you want realistic
photorealistic  ← if you want stylized
\`\`\`

## Golden Rules

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
    systemPromptContext: "The user is learning about negative prompts. Explain them as 'things to avoid' - they help refine output by excluding unwanted elements. Share common negative prompt templates for quality and anatomical fixes."
  },
  {
    id: "ethics",
    title: "Ethics & Responsible AI Art",
    content: `# Ethics & Responsible AI Art

With great power comes great responsibility! ⚖️

## Key Questions

┌─────────────────────────────────────────┐
│ 🎨 Copyright: Who trained the AI?       │
│ 👤 Deepfakes: Real people without consent│
│ ✍️ Attribution: Who "made" this art?    │
└─────────────────────────────────────────┘

## The Rules

| ✅ DO | ❌ DON'T |
|-------|----------|
| Label AI art when sharing | Create fake images of real people |
| Use for learning & creativity | Pass off as human-made art |
| Respect platform ToS | Spread misinformation |
| Support human artists too | Copy artist styles without credit |

## Think Before You Generate

\`\`\`
Is this...
├── Harmful to someone? → STOP
├── Deceptive? → STOP  
├── Someone else's style without credit? → RECONSIDER
└── Creative & respectful? → GO! ✅
\`\`\`

## Remember

🛠️ AI art is a **tool** - how we use it defines its impact.
🤝 Creativity + Responsibility = Sustainable AI Art`,
    keyPoints: [
      "Consider copyright and artist attribution",
      "Avoid creating deepfakes or misinformation",
      "Label AI-generated content when sharing"
    ],
    systemPromptContext: "The user is learning about AI art ethics. Discuss the balance between creative freedom and responsibility. Encourage thoughtful use of AI tools while respecting artists and avoiding harmful applications."
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
