from fastapi import FastAPI
import pandas as pd
import numpy as np
import os
import uvicorn

app = FastAPI(title="Analytics Service API", version="1.0.0")

@app.get("/health")
def health_check():
    return {"status": "Analytics Service is running"}

@app.get("/analytics/performance")
def get_performance_prediction():
    # Dummy ML logic with pandas/numpy
    data = {'employee_id': [1, 2, 3], 'years_experience': [2, 5, 10], 'projects_completed': [5, 12, 25]}
    df = pd.DataFrame(data)
    
    # Calculate dummy performance score
    df['performance_score'] = (df['years_experience'] * 0.4) + (df['projects_completed'] * 0.6)
    
    # Simulate a prediction result
    top_performer = df.loc[df['performance_score'].idxmax()]
    
    return {
        "predictions_ready": True,
        "top_performer_id": int(top_performer['employee_id']),
        "score": float(top_performer['performance_score'])
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8003))
    uvicorn.run(app, host="0.0.0.0", port=port)
