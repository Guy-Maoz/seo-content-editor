# AI-Powered SEO Content Editor

An AI-powered content editor built with Next.js that helps users create SEO-optimized content based on search keywords. The tool integrates OpenAI Assistants API for content generation and keyword suggestions, and Similarweb API for keyword metrics.

## Features

- **Seed Topic Input**: Enter a seed topic to get started
- **Keyword Suggestions**: AI generates high-search-volume related keywords
- **Keyword Selection**: Select/deselect keywords using checkboxes
- **Keyword Metrics**: View volume, difficulty, and CPC metrics from Similarweb
- **Content Generation**: Generate SEO-optimized content using selected keywords
- **Keyword Highlighting**: Highlights used keywords in the editor
- **Dynamic Keyword Syncing**: Automatically unchecks keywords when removed from text
- **Content Regeneration**: Refine text further with updated keyword selection
- **Simplified Editor Toolbar**: Streamlined formatting options (H1, H2, H3, Text, Bold, Italic)
- **Responsive Layout**: Spacious design that works well on various screen sizes

## Tech Stack

- **Frontend**: Next.js 14 with React and TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: 
  - OpenAI Assistants API for content generation
  - OpenAI API for keyword suggestions
- **Keyword Data**: Similarweb API for keyword metrics
- **Text Editor**: TipTap (React-based rich text editor)
- **Icons**: React Icons
- **Deployment**: Netlify with continuous deployment

## Live Demo

Visit the live application: [https://similarweb-content-seo.netlify.app](https://similarweb-content-seo.netlify.app)

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm or yarn
- OpenAI API key
- Similarweb API key

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
   SIMILARWEB_API_KEY=your SMWB REST API key
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
- `/src/app/api/similarweb` - API routes for Similarweb keyword metrics
- `/src/components` - React components
  - `topic-input.tsx` - Component for entering the seed topic
  - `keyword-selector.tsx` - Component for selecting keywords
  - `generate-button.tsx` - Component for generating content
  - `content-editor.tsx` - TipTap-based rich text editor component

## Deployment

The application is deployed to Netlify with continuous deployment from GitHub.

### Manual Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Deploy to Netlify:
   ```bash
   netlify deploy --prod
   ```

### Continuous Deployment

The application is set up for continuous deployment from GitHub:
1. Any push to the main branch triggers a new build and deployment
2. The custom domain is configured at Netlify: [similarweb-content-seo.netlify.app](https://similarweb-content-seo.netlify.app)

## Recent Updates

- **Layout Improvements**: More spacious design with better responsive behavior
- **Simplified Toolbar**: Reduced to essential formatting options (H1, H2, H3, Text, Bold, Italic)
- **Keyword List Enhancement**: Vertical space optimization to reduce unnecessary scrolling
- **Content Generation**: Enhanced with OpenAI Assistants API for improved HTML structure and proper heading hierarchy
- **Similarweb Integration**: Added keyword metrics (volume, difficulty, CPC) from Similarweb API
- **Netlify Deployment**: Set up continuous deployment from GitHub

## AI Assistant

The application includes an interactive AI Assistant that helps with SEO tasks. The assistant can:

- Generate keyword suggestions for your content
- Create SEO-optimized content using your selected keywords
- Analyze content for SEO improvements
- Answer questions about SEO best practices

The AI Assistant uses the assistant-ui library to provide a conversational interface where you can ask questions and request actions related to SEO.

### How to Use the AI Assistant

1. Click on the AI panel icon in the top-right corner of the application
2. Type your question or request in the chat input
3. The assistant will respond and may offer to perform actions like generating keywords or content
4. You can continue the conversation to refine your requests or ask follow-up questions

### Technical Implementation

The AI Assistant is built using:

- [assistant-ui](https://github.com/assistant-ui/assistant-ui) - A React library for AI chat interfaces
- OpenAI's GPT-4o model for natural language understanding and generation
- Custom tool implementations that connect to the application's existing API endpoints

## License

This project is licensed under the MIT License - see the LICENSE file for details.
