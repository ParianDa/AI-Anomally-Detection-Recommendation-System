import React, { useState, useEffect } from 'react';
import "./style_content.css";

const MainContentUI = () => {
    const [darkMode, setDarkMode] = useState(false);
    const [file, setFile] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [temperature, setTemperature] = useState(0.6); // Default value
    const [maxTokens, setMaxTokens] = useState(100); // Default value
    const [provider, setProvider] = useState('OpenAI');
    const [model, setModel] = useState('gpt-4');
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(false); // Loading state
    const [loadingDone, setLoadingDone] = useState(false);

    const handleFileChange = (event) => {
        setFile(event.target.files[0]);
    };

    const handleTemperatureChange = (event) => {
        setTemperature(event.target.value);
    };

    const handleMaxTokensChange = (event) => {
        setMaxTokens(event.target.value);
    };

    const handleProviderChange = (event) => {
        setProvider(event.target.value);
    };

    const handleModelChange = (event) => {
        setModel(event.target.value);
    };

    const handleConnect = async () => {
        if (!file) {
            alert("Please upload a CSV file.");
            return;
        }

        if (!prompt) {
            alert("Please enter a prompt.");
            return;
        }

        setLoading(true); // Set loading to true

        const formData = new FormData();
        formData.append("file", file);
        formData.append("prompt", prompt);
        formData.append("temperature", temperature);
        formData.append("max_tokens", maxTokens);
        formData.append("provider", provider);
        formData.append("model", model);

        try {
            const res = await fetch('http://localhost:5000/execute_script', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            setResponses(prev => [{ prompt, output: data.stdout }, ...prev]);
            setLoadingDone(true);
        } catch (error) {
            console.error("Error connecting to the server:", error);
        } finally {
            setLoading(false); // Set loading to false after request completes
        }
    };

    const handleAskMore = async () => {
        setLoading(true);

        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("temperature", temperature);
        formData.append("max_tokens", maxTokens);
        formData.append("provider", provider);
        formData.append("model", model);

        try {
            const res = await fetch('http://localhost:5000/get_recommendations', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            setResponses(prev => [{ prompt, output: data.stdout }, ...prev]);
            setLoadingDone(true);
        } catch (error) {
            console.error("Error connecting to the server:", error);
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = () => {
        if (responses.length === 0) return;

        const csvContent = "data:text/csv;charset=utf-8," +
            responses.map(res => `Prompt: ${res.prompt}\nResponse:\n${res.output}`).join("\n\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "responses.csv");
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link); // Clean up
    };

    return (
        <div>
            <div className={`container ${darkMode ? 'dark' : ''}`}>
                <button className='toggle-btn' onClick={() => setDarkMode(!darkMode)}>
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <div className="sidebar">
                    <img src='https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTDXhfcx0bKysMJRTDB6xBrbNn-cpO1TQ6zHQ&s' className='company-logo' alt='Company Logo'/>
                    <label>Provider</label>
                    <select value={provider} onChange={handleProviderChange}>
                        <option value='OpenAI'>OpenAI</option>
                    </select>
                    <label>Model</label>
                    <select value={model} onChange={handleModelChange}>
                        <option value='gpt-4'>GPT-4</option>
                        <option value='gpt-4o'>GPT-4o</option>
                        <option value='gpt-3.5-turbo'>GPT-3.5-turbo</option>
                    </select>

                    <label>Upload CSV</label>
                    <input type="file" accept=".csv" onChange={handleFileChange} />
                    <span>[Max Size : 2 GB]</span>
                    <br />
                    <br />
                    <label>Enter Prompt</label>
                    <input
                        type='text'
                        placeholder='Enter Anomaly Conditions'
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    <label>Temperature ({temperature}): 
                        <i className="info-icon" data-tooltip="parameter that controls the randomness or creativity of the model's responses. It determines how deterministic (predictable) or random (creative) the model will be when generating text.">ℹ️</i>
                    </label>
                    <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={temperature}
                        onChange={handleTemperatureChange}
                    />
                    <label>Number Of Tokens ({maxTokens}): 
                        <i className="info-icon" data-tooltip="Tokens are the basic units that the model processes when generating text. A token can represent a word, part of a word, or even a single character, depending on the language and context.">ℹ️</i>
                    </label>
                    <label>Max: 4000</label>
                    <input
                        type="range"
                        min="0"
                        max="4000"
                        step="100"
                        value={maxTokens}
                        onChange={handleMaxTokensChange}
                    />
                    {!loadingDone && (
                        <button
                            onClick={handleConnect}
                            className='bold-text'
                            disabled={loading}
                        >
                            Analyse & Recommend
                        </button>
                    )}
                </div>

                <div className="main-content">
                    <div className="card">
                        <h2><span className='light-text'>Smart <span className='ai'>Al</span>ert</span> - <span className='bold-text'>Anomaly Detection & Recommendation System</span></h2>
                    </div>
                    {loading ? (
                        <div className="loading">Loading...</div>
                    ) : (
                        responses.map((res, index) => (
                            <div key={index} className="response">
                                <h3>{res.prompt}</h3>
                                <pre className="script-output">{res.output}</pre>
                                <button onClick={downloadCSV} className='bold-text'>
                                    Download CSV
                                </button>
                            </div>
                        ))
                    )}
                    {responses.length > 0 && (
                        <div className="follow-up-prompt">
                            <input
                                type='text'
                                placeholder='Ask for more details here...'
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />
                            <button onClick={handleAskMore} className='bold-text'>Ask More</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MainContentUI;
