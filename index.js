const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.get('/', (req, res) => {
  res.send(`
    <html>
    <head>
        <title>Meeting Action Items AI</title>
        <style>
            body { font-family: Arial; padding: 30px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .webhook { background: #f0f0f0; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 10px 0; }
            button { background: #007cba; color: white; padding: 12px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
            button:hover { background: #005a8b; }
            .result { margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #007cba; }
            .error { background: #ffe6e6; border-left: 4px solid #dc3545; }
            .success { background: #e8f5e8; border-left: 4px solid #28a745; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎯 Meeting Action Items AI</h1>
            
            <div class="status">
                <h3>✅ Your Tool is Live!</h3>
                <p><strong>Status:</strong> Running on Vercel</p>
                <p><strong>AI:</strong> ${ANTHROPIC_API_KEY ? '✅ Connected to Claude' : '❌ Need to add API Key'}</p>
                <p><strong>URL:</strong> ${req.protocol}://${req.get('host')}</p>
            </div>

            <h2>🔗 Your Webhook URL</h2>
            <p>Use this URL in Zapier to connect your meeting tools:</p>
            <div class="webhook">${req.protocol}://${req.get('host')}/api/webhooks/transcript</div>
            
            <h2>🧪 Test Your Tool</h2>
            <button onclick="testTool()">Test with Sample Meeting</button>
            <div id="result"></div>
        </div>

        <script>
            async function testTool() {
                const resultDiv = document.getElementById('result');
                resultDiv.innerHTML = '<div class="result">🔄 Processing sample meeting...</div>';
                
                try {
                    const response = await fetch('/api/webhooks/transcript', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            transcript: "John said he will update the marketing presentation by Friday. Sarah agreed to review the budget proposal and send feedback by next Tuesday.",
                            meetingTitle: "1:1 - John & Sarah",
                            participants: ["John", "Sarah"],
                            source: "Test Meeting"
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        resultDiv.innerHTML = \`
                            <div class="result success">
                                <h3>✅ Test Successful!</h3>
                                <p><strong>Meeting:</strong> \${data.meetingTitle}</p>
                                <p><strong>Tasks Extracted:</strong> \${data.tasksExtracted}</p>
                                <div style="margin-top: 10px;">
                                    <strong>Tasks Found:</strong>
                                    <ul>
                                        \${data.tasks.map(task => \`
                                            <li><strong>\${task.title}</strong> - \${task.assignee} (Due: \${task.dueDate})</li>
                                        \`).join('')}
                                    </ul>
                                </div>
                            </div>
                        \`;
                    } else {
                        resultDiv.innerHTML = \`<div class="result error">❌ Test failed: \${data.error}</div>\`;
                    }
                } catch (error) {
                    resultDiv.innerHTML = \`<div class="result error">❌ Error: \${error.message}</div>\`;
                }
            }
        </script>
    </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    claudeConnected: !!ANTHROPIC_API_KEY
  });
});

app.post('/api/webhooks/transcript', async (req, res) => {
  try {
    const { transcript, meetingTitle, participants, source } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Claude API key not configured. Please add ANTHROPIC_API_KEY in Vercel environment variables.' });
    }

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Extract meaningful action items from this meeting transcript. Only include specific commitments with clear owners and deadlines.

Meeting: ${meetingTitle}
Participants: ${participants?.join(', ')}

Transcript:
${transcript}

Return JSON format:
{
  "tasks": [
    {
      "title": "specific actionable task",
      "assignee": "person name", 
      "dueDate": "YYYY-MM-DD",
      "priority": "High|Medium|Low",
      "confidence": 0.9,
      "context": "meeting quote"
    }
  ]
}`
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    const aiResponse = response.data.content[0].text;
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    const extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : { tasks: [] };

    res.json({
      success: true,
      meetingTitle,
      tasksExtracted: extractedData.tasks.length,
      tasks: extractedData.tasks,
      message: 'Tasks extracted successfully!'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
