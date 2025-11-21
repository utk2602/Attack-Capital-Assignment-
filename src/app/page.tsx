"use client";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            ScribeAI
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Real-time Audio Transcription & Meeting Intelligence
          </p>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Start Recording</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Capture audio from your microphone or meeting tabs
            </p>
            
            <div className="flex flex-col gap-4 max-w-md mx-auto">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition">
                🎤 Record from Microphone
              </button>
              <button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition">
                🖥️ Record from Tab
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="font-semibold text-lg mb-2">Real-time Transcription</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Live streaming to Gemini API for instant transcription
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="font-semibold text-lg mb-2">AI Summaries</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatic key points, action items, and decisions
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="font-semibold text-lg mb-2">Long Sessions</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Handle 1+ hour recordings with chunked streaming
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
