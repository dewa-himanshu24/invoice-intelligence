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
        // Some PDFs have bad XRef but can still be parsed if we are lucky
        // or we could try a different approach.
        // For now, let's wrap it in a more descriptive error.
        throw new Error(`The PDF file is corrupted (bad XRef entry). Please try a different file or repair the PDF.`);
      }
      throw pdfError;
    }
    const rawText = pdfData.text;

    const promptPath = path.join(__dirname, '../prompts', `${promptVersion}.txt`);
    let promptTemplate = '';
    try {
      promptTemplate = fs.readFileSync(promptPath, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read prompt version ${promptVersion}: ${err.message}`);
    }

    const finalPrompt = promptTemplate.replace('{{INVOICE_TEXT}}', rawText);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const result = await model.generateContent(finalPrompt);
    let responseText = result.response.text();

    // Strip markdown fences if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsedObject;
    try {
      parsedObject = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error('Gemini returned invalid JSON: ' + responseText.slice(0, 200));
    }

    return { extractedData: parsedObject, promptVersion };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  extract
};