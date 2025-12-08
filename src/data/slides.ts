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

AI image generation uses **deep learning models** to create images from text descriptions. These models have learned from millions of images and can generate entirely new, original artwork.

## How It Works

1. **Text Encoding** - Your prompt is converted into numerical representations
2. **Diffusion Process** - The model starts with noise and gradually refines it
3. **Image Decoding** - The final image is rendered from the refined data

## Popular Models

- **Stable Diffusion** - Open source, highly customizable
- **DALL-E** - OpenAI's powerful image generator
- **Midjourney** - Known for artistic, stylized outputs
- **Flux** - Fast and high-quality generation`,
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

A well-structured prompt is the key to getting great results. Think of it as giving detailed instructions to an artist.

## Basic Structure

\`\`\`
[Subject] + [Description] + [Style] + [Quality modifiers]
\`\`\`

## Example Breakdown

**"A majestic lion standing on a cliff at sunset, digital art, highly detailed, 8k resolution"**

| Component | Example |
|-----------|---------|
| Subject | A majestic lion |
| Action/Setting | standing on a cliff at sunset |
| Style | digital art |
| Quality | highly detailed, 8k resolution |

## Tips for Better Prompts

- **Be specific** - "golden retriever puppy" vs just "dog"
- **Add context** - environment, lighting, mood
- **Specify style** - photography, painting, 3D render
- **Use quality modifiers** - detailed, professional, award-winning`,
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

Style keywords dramatically change the look and feel of generated images. Learning these is like having an art history course at your fingertips!

## Photography Styles
- **Portrait photography** - focus on face/upper body
- **Landscape photography** - wide scenic views
- **Macro photography** - extreme close-ups
- **Street photography** - candid urban scenes

## Art Movements
- **Impressionism** - soft brushstrokes, light play
- **Art Nouveau** - organic curves, decorative
- **Cyberpunk** - neon, dystopian, high-tech
- **Studio Ghibli** - anime, whimsical, detailed backgrounds

## Lighting Keywords
- **Golden hour** - warm, soft sunset light
- **Dramatic lighting** - high contrast, moody
- **Rim lighting** - backlit edges, silhouettes
- **Soft diffused** - even, gentle illumination

## Rendering Styles
- **3D render** - CGI, Blender-style
- **Watercolor** - soft, flowing colors
- **Oil painting** - rich textures, classic look
- **Pixel art** - retro, 8-bit aesthetic`,
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

Parameters are the 'knobs and dials' that fine-tune your image generation. Understanding them gives you precise control.

## CFG Scale (Classifier-Free Guidance)

The CFG scale controls how closely the AI follows your prompt.

| Value | Effect |
|-------|--------|
| 1-5 | Creative, loose interpretation |
| 7-9 | Balanced (recommended for most cases) |
| 10-15 | Strict adherence to prompt |
| 15+ | May cause artifacts, oversaturation |

## Steps (Sampling Steps)

More steps = more refinement, but slower generation.

- **20-30 steps** - Quick drafts
- **40-50 steps** - Good quality (sweet spot)
- **75+ steps** - Diminishing returns

## Seed

A seed is a random number that determines the initial noise pattern.

- **Same seed + same prompt = same image**
- **Change seed = variation of the concept**
- **Random seed = completely different results**

## Image Dimensions

- **1:1 (1024x1024)** - Portraits, icons
- **16:9 (1920x1080)** - Landscapes, wallpapers
- **9:16 (1080x1920)** - Mobile, stories`,
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

Image-to-image (img2img) lets you use an existing image as a starting point, transforming it based on your prompt.

## How It Works

1. Upload a reference image
2. Set the **denoising strength** (how much to change)
3. Write a prompt describing the desired transformation
4. Generate!

## Denoising Strength

| Value | Effect |
|-------|--------|
| 0.1-0.3 | Subtle changes, keeps original structure |
| 0.4-0.6 | Moderate transformation |
| 0.7-0.9 | Major changes, loose interpretation |
| 1.0 | Completely new image (ignores input) |

## Use Cases

- **Style transfer** - Turn a photo into a painting
- **Upscaling** - Enhance resolution and detail
- **Inpainting** - Fix or replace parts of an image
- **Outpainting** - Extend image boundaries
- **Sketch to art** - Transform rough sketches into finished pieces

## Tips

- Start with lower denoising for subtle edits
- Use high-quality reference images
- Describe what you want, not what to remove`,
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

Negative prompts tell the AI what to **avoid** in your image. They're just as important as positive prompts!

## How They Work

Negative prompts reduce the probability of certain elements appearing. Think of them as an "exclusion list."

## Common Negative Prompts

### Quality Issues
\`\`\`
blurry, low quality, pixelated, noisy, jpeg artifacts, 
watermark, signature, text, logo
\`\`\`

### Anatomical Fixes
\`\`\`
extra fingers, mutated hands, deformed, bad anatomy,
extra limbs, missing limbs, floating limbs
\`\`\`

### Style Avoidance
\`\`\`
cartoon, anime (if you want realistic)
photorealistic (if you want stylized)
\`\`\`

## Pro Tips

1. **Don't overdo it** - Too many negatives can confuse the model
2. **Be specific** - "blurry background" vs just "blurry"
3. **Match your style** - Exclude what conflicts with your vision
4. **Iterate** - Add negatives based on unwanted results

## Example

**Prompt:** "Portrait of a woman, professional photography"
**Negative:** "cartoon, blurry, deformed, bad lighting, oversaturated"`,
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

With great power comes great responsibility. AI image generation raises important ethical considerations.

## Key Ethical Considerations

### 1. Copyright & Training Data
- AI models learn from existing artwork
- Debate: Is it fair to artists whose work was used?
- Some models now offer opt-out options

### 2. Deepfakes & Misinformation
- AI can create convincing fake images of real people
- Potential for spreading misinformation
- Many platforms ban non-consensual AI images of real people

### 3. Artistic Attribution
- Who owns AI-generated art?
- Should AI art be labeled as such?
- Impact on human artists' livelihoods

## Best Practices

✅ **Do:**
- Label AI-generated content when sharing
- Respect platform terms of service
- Use for creative expression and learning
- Support human artists alongside AI tools

❌ **Don't:**
- Create non-consensual images of real people
- Pass off AI art as human-created
- Use for deception or misinformation
- Replicate specific artists' styles without credit

## The Future

AI art is a tool - how we use it matters. It can democratize creativity while respecting ethics.`,
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
