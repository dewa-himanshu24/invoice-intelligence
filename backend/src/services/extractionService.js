const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../config/logger');

async function extract(filePath, promptVersion) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    let pdfData;
    try {
      pdfData = await pdfParse(dataBuffer);
    } catch (pdfError) {
      logger.error(`PDF Parse Error for ${filePath}: ${pdfError.message}`);
      if (pdfError.message.includes('bad XRef entry')) {
        throw new Error(`The PDF file is corrupted (bad XRef entry). Please try a different file or repair the PDF.`);
      }
      throw pdfError;
    }

    // Token Optimization: Clean text by removing excessive whitespace and newlines
    const rawText = pdfData.text
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .replace(/[ \t]+/g, ' ')   // Collapse multiple spaces/tabs
      .trim();

    const promptPath = path.join(__dirname, '../prompts', `${promptVersion}.txt`);
    let promptTemplate = '';
    try {
      promptTemplate = fs.readFileSync(promptPath, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read prompt version ${promptVersion}: ${err.message}`);
    }

    const finalPrompt = promptTemplate.replace('{{INVOICE_TEXT}}', rawText);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Token Optimization: Use responseMimeType: 'application/json' 
    // This allows us to remove "No explanation, no markdown" instructions from the prompt later
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const result = await model.generateContent(finalPrompt);
    const responseText = result.response.text();

    let parsedObject;
    try {
      parsedObject = JSON.parse(responseText);
    } catch (parseError) {
      // Fallback for some older versions or if JSON is wrapped
      let cleaned = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      try {
        parsedObject = JSON.parse(cleaned);
      } catch (e) {
        throw new Error('Gemini returned invalid JSON: ' + responseText.slice(0, 200));
      }
    }

    return { extractedData: parsedObject, promptVersion };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  extract
};