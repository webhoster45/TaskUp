require('dotenv').config();
const express = require('express');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'taskup-development-secret';
const DATA_DIR = path.join(__dirname, 'data');
const resendClient = process.env.resend_api_key ? new Resend(process.env.resend_api_key) : null;
let mongoConnection;

app.engine('ejs', ejs.__express);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function authmiddleware(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        req.user = decoded;
        next();
    });
}

function extractToken(req) {
    const authheader = req.headers.authorization || '';
    if (authheader.startsWith('Bearer ')) {
        return authheader.slice(7);
    }

    const cookieHeader = req.headers.cookie || '';
    const cookieParts = cookieHeader.split(';').map((part) => part.trim());
    const tokenCookie = cookieParts.find((part) => part.startsWith('TASKUP_TOKEN='));

    if (!tokenCookie) {
        return null;
    }

    return decodeURIComponent(tokenCookie.slice('TASKUP_TOKEN='.length));
}

function getUserFromToken(req) {
    const token = extractToken(req);
    if (!token) {
        return null;
    }

    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Just now';
    }

    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

async function readCollection(filename) {
    if (process.env.MONGODB_URI) {
        const collection = await getMongoCollection(filename);
        const documents = await collection.find({}).toArray();
        return documents.map(({ _id, ...document }) => document);
    }

    const filePath = path.join(DATA_DIR, filename);

    try {
        const raw = await fs.promises.readFile(filePath, 'utf8');
        if (!raw.trim()) {
            return [];
        }

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.promises.mkdir(DATA_DIR, { recursive: true });
            await fs.promises.writeFile(filePath, '[]', 'utf8');
            return [];
        }

        throw error;
    }
}

async function writeCollection(filename, collection) {
    if (process.env.MONGODB_URI) {
        const mongoCollection = await getMongoCollection(filename);
        await mongoCollection.deleteMany({});
        if (collection.length) {
            await mongoCollection.insertMany(collection);
        }
        return;
    }

    const filePath = path.join(DATA_DIR, filename);
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(collection, null, 2), 'utf8');
}

async function getMongoCollection(filename) {
    if (!mongoConnection) {
        mongoConnection = mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10
        });
    }

    const connection = await mongoConnection;
    const collectionName = path.basename(filename, path.extname(filename));
    return connection.connection.db.collection(collectionName);
}

function signToken(username) {
    return jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
}

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.get('/signin', (req, res) => {
    res.render('signin');
});

app.get('/dashboard', (req, res) => {
    const user = getUserFromToken(req);
    if (!user) {
        return res.render('dashboard', {
            username: null,
            tasks: [],
            authenticated: false,
            formatDate
        });
    }

    readCollection('task.json')
        .then((taskbox) => {
            const tasks = taskbox.filter((task) => task.username === user.username);
            res.render('dashboard', {
                username: user.username,
                tasks,
                authenticated: true,
                formatDate
            });
        })
        .catch(() => {
            res.render('dashboard', {
                username: user.username,
                tasks: [],
                authenticated: true,
                formatDate
            });
        });
});

app.post('/signup', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        if (!username || !password || !email) {
            return res.status(400).json({ message: 'Missing parameters' });
        }

        const users = await readCollection('users.json');
        const existinguser = users.find((user) => user.username === username || user.email === email);

        if (existinguser) {
            return res.status(409).json({ message: 'User already exists' });
        }

        const hashedpassword = await bcrypt.hash(password, 10);
        const payload = {
            username,
            password: hashedpassword,
            email,
            createdat: new Date().toISOString()
        };

        users.push(payload);
        await writeCollection('users.json', users);

        const token = signToken(username);
        return res.status(201).json({ message: `User ${username} created successfully`, token, username });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Error' });
    }
});

app.post('/signin', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Missing parameters' });
        }

        const users = await readCollection('users.json');
        const existinguser = users.find((user) => user.username === username);

        if (!existinguser) {
            return res.status(400).json({ message: "User doesn't exist" });
        }

        const match = await bcrypt.compare(password, existinguser.password);
        if (!match) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = signToken(username);
        return res.status(200).json({ message: `User ${username} logged in successfully`, token, username });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Error' });
    }
});

app.post('/addtask', authmiddleware, async (req, res) => {
    try {
        const { username } = req.user;
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({ message: 'Title and description are required' });
        }

        const taskbox = await readCollection('task.json');
        const payload = {
            username,
            title,
            description,
            id: uuidv4(),
            completed: false,
            createdat: new Date().toISOString()
        };

        taskbox.push(payload);
        await writeCollection('task.json', taskbox);

        return res.status(201).json({ message: 'Task created successfully', task: payload });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Error' });
    }
});

app.get('/gettask', authmiddleware, async (req, res) => {
    try {
        const { username } = req.user;
        const taskbox = await readCollection('task.json');
        const usertask = taskbox.filter((task) => username === task.username);
        return res.status(200).json({ message: 'Fetched tasks successfully', tasks: usertask });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Error' });
    }
});

app.post('/edit/:id', authmiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { username } = req.user;
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({ message: 'Title and description are required' });
        }

        const taskbox = await readCollection('task.json');
        const taskIndex = taskbox.findIndex((task) => task.id === id && task.username === username);

        if (taskIndex === -1) {
            return res.status(404).json({ message: 'Task not found' });
        }

        taskbox[taskIndex] = {
            ...taskbox[taskIndex],
            title,
            description
        };

        await writeCollection('task.json', taskbox);
        return res.status(200).json({ message: 'Task updated successfully', task: taskbox[taskIndex] });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Error' });
    }
});

app.post('/deletetask/:id', authmiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { username } = req.user;
        const taskbox = await readCollection('task.json');
        const updatedTasks = taskbox.filter((task) => !(task.id === id && task.username === username));

        if (updatedTasks.length === taskbox.length) {
            return res.status(404).json({ message: 'Task not found' });
        }

        await writeCollection('task.json', updatedTasks);
        return res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Error' });
    }
});

app.post('/mark/:id', authmiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { username } = req.user;
        const taskbox = await readCollection('task.json');
        const taskIndex = taskbox.findIndex((task) => task.id === id && task.username === username);

        if (taskIndex === -1) {
            return res.status(404).json({ message: 'Task not found' });
        }

        taskbox[taskIndex].completed = true;
        await writeCollection('task.json', taskbox);
        return res.status(200).json({ message: 'Task marked', task: taskbox[taskIndex] });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Error' });
    }
});

app.post('/email/:id', authmiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { username } = req.user;
        const { recipient } = req.body;

        if (!recipient) {
            return res.status(400).json({ message: 'Recipient email is required' });
        }

        if (!resendClient) {
            return res.status(503).json({ message: 'Email service is not configured' });
        }

        const taskbox = await readCollection('task.json');
        const confirmtask = taskbox.find((task) => task.id === id && task.username === username);

        if (!confirmtask) {
            return res.status(404).json({ message: 'Task not found' });
        }

        await resendClient.emails.send({
            from: 'onboarding@resend.dev',
            to: recipient,
            subject: `Task from ${username} - ${confirmtask.title}`,
            html: `<p>Task Description: ${confirmtask.description}</p><p>Created at: ${confirmtask.createdat}</p><p>Completed: ${confirmtask.completed}</p>`
        });

        return res.status(200).json({ message: 'Task email sent successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Error' });
    }
});

app.post('/health', (req, res) => {
    res.status(200).json({ message: 'Working' });
});

app.use((req, res) => {
    return res.status(404).json({ message: "Page doesn't exist" });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`App listening on PORT: ${PORT}`);
    });
}

module.exports = app;

