import { useState } from "react";
import axios from "axios";

function App() {

  const [repoUrl, setRepoUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyzeRepo = async () => {

    try {

      setLoading(true);
      setResult(null);

      const response = await axios.post(
        "http://127.0.0.1:8000/analyze/",
        { repo_url: repoUrl }
      );

      setResult(response.data);

    } catch (error) {
      console.error(error);
      alert("Failed to analyze repository");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>

      <h1>RExplain</h1>

      <input
        type="text"
        placeholder="Enter GitHub repo URL"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
        style={{ width: "400px", padding: "10px" }}
      />

      <button
        onClick={analyzeRepo}
        style={{ marginLeft: "10px", padding: "10px" }}
      >
        Analyze
      </button>

      {loading && <p>Analyzing repository...</p>}

      {result && (
        <div style={{ marginTop: "30px" }}>

          <h2>AI Explanation</h2>
          <p>{result.ai_explanation}</p>

          <h2>Framework Detection</h2>
          <pre>{JSON.stringify(result.framework_detection, null, 2)}</pre>

          <h2>Architecture Diagram</h2>
          <img
            src={`http://127.0.0.1:8000/repos/${repoUrl.split("/").pop()}_architecture.png`}
            alt="Architecture Diagram"
            style={{ width: "500px", marginTop: "10px" }}
          />

        </div>
      )}
    </div>
  );
}

export default App;