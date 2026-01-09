// AI Response Formatting Utility
// Formats AI responses by removing quotes, asterisks, and converting markdown to HTML
const formatAIResponse = (text) => {
    // Remove leading/trailing quotes
    text = text.replace(/^["']|["']$/g, '');

    // Remove markdown bold asterisks and replace with HTML strong tags
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert numbered lists
    text = text.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Convert bullet points
    text = text.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');

    // Wrap consecutive list items in ul tags
    text = text.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
        return '<ul>' + match + '</ul>';
    });

    // Convert line breaks to paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    text = paragraphs.map(p => {
        // Don't wrap if already has HTML tags
        if (p.includes('<ul>') || p.includes('<ol>') || p.includes('<li>')) {
            return p;
        }
        return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('');

    return text;
};

// Save chat history to Firestore
const saveChatHistory = async (taskId, chatHistory) => {
    if (!currentUser || !taskId) return;

    try {
        await updateDoc(doc(db, "tasks", taskId), {
            chatHistory: chatHistory,
            lastChatUpdate: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error saving chat history:", error);
    }
};

// Load chat history from task
const loadChatHistory = (task) => {
    if (task.chatHistory && Array.isArray(task.chatHistory)) {
        return task.chatHistory;
    }
    return [];
};

export { formatAIResponse, saveChatHistory, loadChatHistory };
