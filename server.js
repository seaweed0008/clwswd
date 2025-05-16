const express = require('express');
const fs = require('fs');
const app = express();

// Global emoji storage
let globalEmojis = new Set();

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
app.use(express.static('.'));

let typingUsers = new Map(); // Using Map consistently for typing users

app.post('/typing', (req, res) => {
    const { username, isTyping } = req.body;
    if (isTyping) {
        typingUsers.set(username, Date.now());
    } else {
        typingUsers.delete(username);
    }
    res.json({ success: true });
});

app.get('/typing', (req, res) => {
    const now = Date.now();
    // Clean up stale typing statuses (older than 5 seconds)
    for (const [username, timestamp] of typingUsers.entries()) {
        if (now - timestamp > 5000) {
            typingUsers.delete(username);
        }
    }
    res.json({ typing: Array.from(typingUsers.keys()) });
});

app.post('/messages.json', (req, res) => {
    fs.writeFileSync('messages.json', JSON.stringify(req.body));
    res.json({success: true});
});

app.get('/messages.json', (req, res) => {
    try {
        res.json(JSON.parse(fs.readFileSync('messages.json')));
    } catch(e) {
        res.json({messages: []});
    }
});

// Store reactions and whispers
let messageReactions = {};
let messageWhispers = {};
let messages = [];

// Load existing messages if any
try {
    const existingMessages = fs.readFileSync('messages.json');
    messages = JSON.parse(existingMessages).messages || [];
} catch (error) {
    console.log('No existing messages found');
}

app.post('/reactions', (req, res) => {
    try {
        const { messageId: rawMessageId, emoji, username } = req.body;
        if (!rawMessageId || !emoji || !username) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const messageId = rawMessageId.toString();
        if (!messageReactions[messageId]) {
            messageReactions[messageId] = {};
        }
        if (!messageReactions[messageId][emoji]) {
            messageReactions[messageId][emoji] = new Set();
        }

        // Toggle reaction
        if (messageReactions[messageId][emoji].has(username)) {
            messageReactions[messageId][emoji].delete(username);
        } else {
            messageReactions[messageId][emoji].add(username);
        }

        // Clean up empty reaction sets
        if (messageReactions[messageId][emoji].size === 0) {
            delete messageReactions[messageId][emoji];
        }
        if (Object.keys(messageReactions[messageId]).length === 0) {
            delete messageReactions[messageId];
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error handling reaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/reactions', (req, res) => {
    try {
        const serializedReactions = {};
        if (messageReactions) {
            for (const [msgId, reactions] of Object.entries(messageReactions)) {
                serializedReactions[msgId] = {};
                for (const [emoji, users] of Object.entries(reactions)) {
                    if (users instanceof Set) {
                        serializedReactions[msgId][emoji] = Array.from(users);
                    } else {
                        serializedReactions[msgId][emoji] = Array.isArray(users) ? users : [];
                    }
                }
            }
        }
        res.status(200).json({ reactions: serializedReactions });
    } catch (error) {
        console.error('Error serializing reactions:', error);
        res.status(200).json({ reactions: {} });
    }
});

// Cleanup inactive users every second
setInterval(() => {
    try {
        const now = Date.now();
        for (const [username, timestamp] of typingUsers.entries()) {
            if (now - timestamp > 3000) {
                typingUsers.delete(username);
            }
        }
    } catch (error) {
        console.error('Error cleaning up typing users:', error);
    }
}, 1000);

// Emoji endpoints
app.post('/emojis', (req, res) => {
    const { emoji } = req.body;
    if (emoji) {
        globalEmojis.add(emoji);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'No emoji provided' });
    }
});

app.get('/emojis', (req, res) => {
    res.json({ emojis: Array.from(globalEmojis) });
});

// Whisper endpoints
app.post('/whisper', (req, res) => {
    try {
        const { from, to, message, timestamp } = req.body;
        if (!from || !to || !message || !timestamp) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        messageWhispers[timestamp] = { from, to, message };
        res.json({ success: true });
    } catch (error) {
        console.error('Error handling whisper:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/whispers', (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res.json({ whispers: {} });
        }
        const userWhispers = Object.entries(messageWhispers)
            .filter(([_, whisper]) => whisper.from === username || whisper.to === username)
            .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
        res.json({ whispers: userWhispers });
    } catch (error) {
        console.error('Error fetching whispers:', error);
        res.json({ whispers: {} });
    }
});



app.listen(8000, '0.0.0.0', () => {
    console.log('Server running on port 8000');
});