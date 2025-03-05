# AI-Powered SEO Content Editor

An AI-powered content editor built with Next.js that helps users create SEO-optimized content based on search keywords. The tool integrates OpenAI for content generation and keyword suggestions.

## Features

- **Seed Topic Input**: Enter a seed topic to get started
- **Keyword Suggestions**: AI generates high-search-volume related keywords
- **Keyword Selection**: Select/deselect keywords using checkboxes
- **Content Generation**: Generate SEO-optimized content using selected keywords
- **Keyword Highlighting**: Highlights used keywords in the editor
- **Dynamic Keyword Syncing**: Automatically unchecks keywords when removed from text
- **Content Regeneration**: Refine text further with updated keyword selection

## Tech Stack

- **Frontend**: Next.js 14 with React and TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: OpenAI API (GPT)
- **Text Editor**: TipTap (React-based rich text editor)
- **Icons**: React Icons

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ai-seo-content-editor
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file in the root directory and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. Enter a seed topic in the input field and click "Get Keywords"
2. Select/deselect keywords from the generated list
3. Click "Generate Content" to create SEO-optimized content
4. Edit the generated content as needed
5. If you remove a keyword from the text, it will be automatically unchecked
6. Click "Regenerate Content" to refine the text with the updated keyword selection

## Project Structure

- `/src/app/api/keywords` - API route for keyword suggestions
- `/src/app/api/generate` - API route for content generation
- `/src/components` - React components
  - `topic-input.tsx` - Component for entering the seed topic
  - `keyword-selector.tsx` - Component for selecting keywords
  - `generate-button.tsx` - Component for generating content
  - `content-editor.tsx` - TipTap-based rich text editor component

## License

This project is licensed under the MIT License - see the LICENSE file for details.
