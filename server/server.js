const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Enable CORS for all routes
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/execute_script', upload.single('file'), (req, res) => {
    const csvFilePath = req.file ? path.resolve(req.file.path) : null;
    const prompt = req.body.prompt;
    const temperature = req.body.temperature;
    const maxTokens = req.body.max_tokens;
    const provider = req.body.provider;
    const model = req.body.model;
    const scriptPath = path.resolve('process_anomalies.py'); // Ensure this is the correct path to your script

    let command;
    command = `python ${scriptPath} "${csvFilePath}" "${prompt}" ${temperature} ${maxTokens} ${model}`;

    exec(command, (error, stdout, stderr) => {
        if (csvFilePath) fs.unlinkSync(csvFilePath); // Remove the uploaded CSV file if it exists

        if (error) {
            console.error(`exec error: ${error}`);
            console.error(`stderr: ${stderr}`);
            res.status(500).json({ error: `exec error: ${error.message}` });
            return;
        }

        res.json({ stdout: stdout, stderr: stderr });
    });
});

app.post('/get_recommendations', upload.none(), (req, res) => {
    const prompt = req.body.prompt;
    const temperature = req.body.temperature;
    const maxTokens = req.body.max_tokens;
    const provider = req.body.provider;
    const model = req.body.model;
    const scriptPath = path.resolve('process_anomalies.py'); // Ensure this is the correct path to your script

    const command = `python ${scriptPath} "follow-up" "${prompt}" ${temperature} ${maxTokens} ${model}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            console.error(`stderr: ${stderr}`);
            res.status(500).json({ error: `exec error: ${error.message}` });
            return;
        }

        res.json({ stdout: stdout, stderr: stderr });
    });
});

app.listen(5000, () => {
    console.log('Server running on http://localhost:5000');
});
