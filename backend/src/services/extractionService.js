const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../config/logger');

async function extract(filePath, promptVersion) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  try {
    // 1. Read file as base64 for Gemini multimodal input
    const dataBuffer = fs.readFileSync(filePath);
    const base64Data = dataBuffer.toString('base64');

    const promptPath = path.join(__dirname, '../prompts', `${promptVersion}.txt`);
    let promptTemplate = '';
    try {
      promptTemplate = fs.readFileSync(promptPath, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read prompt version ${promptVersion}: ${err.message}`);
    }

    // Replace placeholder with a reference to the attached document
    const finalPrompt = promptTemplate.replace('{{INVOICE_TEXT}}', 'the attached document');

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: 'application/json' }
    });

    // 2. Generate content using the PDF directly
    const result = await model.generateContent([
      finalPrompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf'
        }
      }
    ]);
    
    const responseText = result.response.text();

    let parsedObject;
    try {
      parsedObject = JSON.parse(responseText);
    } catch (parseError) {
      // Fallback for markdown blocks
      let cleaned = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      try {
        parsedObject = JSON.parse(cleaned);
      } catch (e) {
        throw new Error('Gemini returned invalid JSON: ' + responseText.slice(0, 200));
      }
    }

    return { extractedData: parsedObject, promptVersion };
  } catch (error) {
    logger.error(`Extraction failed for ${filePath}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  extract
};