import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense
from tensorflow.keras.optimizers import Adam
from prettytable import PrettyTable
import openai
import matplotlib
matplotlib.use('Agg')  # Use Agg for headless environments (no GUI)
import matplotlib.pyplot as plt
import sys
import os
from dotenv import load_dotenv

os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

# Load OpenAI API Key from .env file
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize the list to store initial recommendations
initial_recommendations = []

def build_autoencoder(input_dim):
    model = Sequential()
    model.add(Dense(32, input_dim=input_dim, activation='relu'))
    model.add(Dense(16, activation='relu'))
    model.add(Dense(8, activation='relu'))
    model.add(Dense(16, activation='relu'))
    model.add(Dense(32, activation='relu'))
    model.add(Dense(input_dim, activation='linear'))
    model.compile(optimizer=Adam(), loss='mean_squared_error')
    return model

def get_recommendation(fraud_info, prompt, temperature, max_tokens, model):
    full_prompt = f"""
    {prompt}
    Here are the details:
    {fraud_info}
    Please provide recommendations to mitigate the fraudulent activity.
    """
    response = openai.ChatCompletion.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": full_prompt}
        ],
        max_tokens=max_tokens,
        temperature=temperature
    )
    recommendation_text = response['choices'][0]['message']['content'].strip()
    initial_recommendations.append(recommendation_text)  # Store the initial recommendations
    return f"Recommendation:\n{recommendation_text}"  # Add a clear label

def handle_follow_up(prompt, temperature, max_tokens, message_history, fraudulent_data, model):
    # Break fraudulent data into context-specific chunks
    fraud_info_summary = fraudulent_data.describe(include='all').to_dict()

    # Update message history with the new prompt and context
    message_history.append({"role": "user", "content": prompt})
    message_history.append({"role": "system", "content": f"Here is a summary of the fraudulent data: {fraud_info_summary}"})

    # Format the messages as required by the chat model
    messages = message_history

    # Make the OpenAI API call using the chat-based endpoint
    response = openai.ChatCompletion.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature
    )

    # Capture the assistant's reply and append to message history
    assistant_reply = response['choices'][0]['message']['content'].strip()
    message_history.append({"role": "assistant", "content": assistant_reply})

    return assistant_reply

# Main logic to handle arguments and decide whether to process CSV or handle follow-up
if __name__ == "__main__":
    csv_file_path = sys.argv[1]
    message_history = []  # Initialize the message history

    if csv_file_path == "follow-up":
        prompt = sys.argv[2]
        temperature = float(sys.argv[3])
        max_tokens = int(sys.argv[4])
        model = sys.argv[5]

        # Load the fraudulent data from the saved CSV file
        fraudulent_data = pd.read_csv("fraudulent_data.csv")

        # Generate the follow-up response dynamically
        result = handle_follow_up(prompt, temperature, max_tokens, message_history, fraudulent_data, model)
        
        print(result)
    else:
        prompt = sys.argv[2]
        temperature = float(sys.argv[3])
        max_tokens = int(sys.argv[4])
        model = sys.argv[5]
        
        # Existing logic for processing CSV and generating initial recommendations
        data = pd.read_csv(csv_file_path)

        # Feature engineering - converting categorical features into numeric ones
        data['device_type'] = data['device_type'].map({'mobile': 0, 'desktop': 1})
        data['geolocation'] = data['geolocation'].map({'US': 0, 'IN': 1, 'DE': 2, 'BR': 3, 'CN': 4})

        # Normalize numerical features for better training performance
        features = data[['clicks', 'impressions', 'device_type', 'geolocation', 'interaction_duration']].values
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)

        # Split data into training and test sets (using 80% for training and 20% for testing)
        X_train, X_test, y_train, y_test = train_test_split(features_scaled, features_scaled, test_size=0.2, random_state=42)

        # Create a DataFrame to retain the indices for original data
        data['original_index'] = data.index

        # Get the indices of the test set based on the train-test split
        test_indices = data.iloc[X_train.shape[0]:].index

        # Train the autoencoder model
        input_dim = X_train.shape[1]
        autoencoder = build_autoencoder(input_dim)
        autoencoder.fit(X_train, X_train, epochs=50, batch_size=32, validation_split=0.2, verbose=0)

        # Predict on the test set
        X_pred = autoencoder.predict(X_test)

        # Calculate the reconstruction error (Mean Squared Error)
        mse = np.mean(np.power(X_test - X_pred, 2), axis=1)

        # Set an anomaly threshold (high reconstruction error indicates an anomaly)
        threshold = np.percentile(mse, 95)  # Adjust percentile based on data and needs

        # Flag the anomalies (fraudulent clicks/impressions)
        anomalies = mse > threshold
        print("\n")
        print(f"Number of anomalies detected: {np.sum(anomalies)}")

        # Get the indices of anomalies in the original data based on the test set
        anomalies_indices = test_indices[anomalies]
        fraudulent_data = data.loc[anomalies_indices]

        # Save the fraudulent data for follow-up questions
        fraudulent_data.to_csv("fraudulent_data.csv", index=False)

        def truncate(value, length=10):
            if isinstance(value, str) and len(value) > length:
                return value[:length] + '...'
            return value

        anomaly_table = PrettyTable()
        anomaly_table.field_names = ["Index", "User ID", "Timestamp", "Clicks", "Impressions", "Device Type", "Geolocation", "Interaction Duration"]
        for i, row in fraudulent_data.iterrows():
            anomaly_table.add_row([
                i, 
                row['user_id'], 
                row['timestamp'], 
                row['clicks'], 
                row['impressions'], 
                row['device_type'], 
                truncate(row['geolocation']), 
                truncate(row['interaction_duration'])
            ])
        print("\nAnomaly Detection Data:")
        print(anomaly_table)

        source_data_table = PrettyTable()
        source_data_table.field_names = ["Index", "User ID", "Timestamp", "Clicks", "Impressions", "Device Type", "Geolocation", "Interaction Duration"]
        for i, row in data.head(10).iterrows():
            source_data_table.add_row([
                i, 
                row['user_id'], 
                row['timestamp'], 
                row['clicks'], 
                row['impressions'], 
                row['device_type'], 
                truncate(row['geolocation']), 
                truncate(row['interaction_duration'])
            ])
        print("\nFirst 10 Records of Source Data:")
        print(source_data_table)

        fraud_info = {
            'campaign_name': 'Retail Campaign',
            'detected_anomaly': 'Unusually high number of clicks in a session',
            'current_action': 'Reviewing clicks'
        }

        recommendation = get_recommendation(fraud_info, prompt, temperature, max_tokens, model)
        print("\n")
        print("OpenAI Recommendations:")
        print("\n")
        print(recommendation)
