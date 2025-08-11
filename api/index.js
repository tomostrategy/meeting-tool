export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (req.method === 'GET') {
    // Homepage
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
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
          .result { margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
          .success { background: #e8f5e8; border-left: 4px solid #28a745; }
          .error { background: #ffe6e6; border-left: 4px solid #dc3545; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎯 Meeting Action Items AI</h1>
          
          <div class="status">
            <h3>✅ Your Tool is Live!</h3>
            <p><strong>Status:</strong> Running on Vercel</p>
            <p><strong>AI:</strong> ${ANTHROPIC_API_KEY ? '✅ Connected to Claude' : '❌ Need to add API Key'}</p>
            <p><strong>URL:</strong> https://${req.headers.host}</p>
          </div>
          
          <h2>🔗 Your Webhook URL</h2>
          <p>Use this URL in Zapier to connect your meeting tools:</p>
          <div class="webhook">https://${req.headers.host}/api</div>
          
          <h2>🧪 Test Your Tool</h2>
          <button onclick="testTool()">Test with Sample Meeting</button>
          <div id="result"></div>
        </div>
        
        <script>
          async function testTool() {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<div class="result">🔄 Processing sample meeting...</div>';
            
            try {
              const response = await fetch('/api', {
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
                    <ul>
                      \${data.tasks.map(task => \`
                        <li><strong>\${task.title}</strong> - \${task.assignee} (Due: \${task.dueDate})</li>
                      \`).join('')}
                    </ul>
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
  }

  if (req.method === 'POST') {
    // Webhook endpoint
    try {
      const { transcript, meetingTitle, participants, source } = req.body;

      const { transcript, meetingTitle, source } = req.body;
      let { participants } = req.body;
      
      // Handle participants - convert to array if needed
      if (typeof participants === 'string') {
        // If it's a comma-separated string, split it
        participants = participants.split(',').map(p => p.trim());
      } else if (!Array.isArray(participants)) {
        // If it's not an array and not a string, make it an array
        participants = participants ? [participants] : [];
      }

      if (!transcript) {
        return res.status(400).json({ error: 'Transcript is required' });
      }
      
      if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ 
          error: 'Claude API key not configured. Please add ANTHROPIC_API_KEY in Vercel environment variables.' 
        });
      }
      
      // Call Claude API
      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `Extract meaningful action items from this meeting transcript. Only include specific commitments with clear owners and deadlines.

Meeting: ${meetingTitle}
Participants: ${Array.isArray(participants) ? participants.join(', ') : participants || 'Unknown'}
Source: ${source || 'Unknown'}

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
      "context": "relevant quote from meeting"
    }
  ]
}`
          }]
        })
      });
      
      if (!claudeResponse.ok) {
        const errorData = await claudeResponse.json();
        throw new Error(errorData.error?.message || `Claude API error: ${claudeResponse.status}`);
      }
      
      const claudeData = await claudeResponse.json();
      const content = claudeData.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : { tasks: [] };
      
      return res.json({
        success: true,
        meetingTitle,
        tasksExtracted: extractedData.tasks.length,
        tasks: extractedData.tasks,
        message: 'Tasks extracted successfully!'
      });
      
    } catch (error) {
      console.error('Error processing request:', error);
      return res.status(500).json({ 
        error: error.message || 'Failed to process transcript'
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
