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
