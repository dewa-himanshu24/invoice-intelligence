const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function extract(filePath, promptVersion) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
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