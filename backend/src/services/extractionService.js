const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../config/logger');

async function extract(filePath, promptVersion) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  try {
    // 1. Read and parse PDF locally using pdf-parse
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);
    const extractedText = pdfData.text;

    const promptPath = path.join(__dirname, '../prompts', `${promptVersion}.txt`);
    let promptTemplate = '';
    try {
      promptTemplate = fs.readFileSync(promptPath, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read prompt version ${promptVersion}: ${err.message}`);
    }

    // Replace placeholder with actual extracted text
    const finalPrompt = promptTemplate.replace('{{INVOICE_TEXT}}', extractedText);

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    // 2. Generate content using the text
    const result = await model.generateContent(finalPrompt);
    const responseText = result.response.text();

    let parsedObject;
    try {
      parsedObject = JSON.parse(responseText);
    } catch (parseError) {
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