import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
import joblib

def train():
    try:
        # Load the Kaggle dataset
        df = pd.read_csv('dataset.csv') 
        
        # Vectorize text (TF-IDF)
        vectorizer = TfidfVectorizer(stop_words='english', max_features=2000)
        X = vectorizer.fit_transform(df['text']) 
        y = df['label'] 

        # Train Random Forest Classifier
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X, y)

        # Save the trained artifacts
        joblib.dump(model, 'lumina_model.pkl')
        joblib.dump(vectorizer, 'lumina_vectorizer.pkl')
        print("✅ TRAINING SUCCESS: lumina_model.pkl & lumina_vectorizer.pkl are ready.")
    except Exception as e:
        print(f"❌ Training failed: {e}")

if __name__ == "__main__":
    train()