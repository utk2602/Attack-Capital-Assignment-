"use client";

import { useState, useRef } from "react";
import { Upload, File, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AudioUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("audio/")) {
      setFile(droppedFile);
      if (!title) {
        setTitle(droppedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadStatus({ type: null, message: "" });

    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("title", title || file.name);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadStatus({
        type: "success",
        message: "Upload successful! Redirecting...",
      });

      // Redirect to session page after 2 seconds
      setTimeout(() => {
        router.push(`/sessions/${data.sessionId}`);
      }, 2000);
    } catch (error: any) {
      setUploadStatus({
        type: "error",
        message: error.message || "Upload failed",
      });
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setTitle("");
    setUploadStatus({ type: null, message: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-retro-bg-light dark:bg-retro-bg-dark border-4 border-black dark:border-white p-8 shadow-retro">
        <h2 className="text-3xl font-bold mb-6">Upload Audio File</h2>

        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-4 border-dashed rounded-none p-12 text-center cursor-pointer
              transition-colors duration-200
              ${
                isDragging
                  ? "border-retro-primary bg-retro-primary/10"
                  : "border-black dark:border-white hover:border-retro-primary dark:hover:border-retro-primary"
              }
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-16 h-16 mx-auto mb-4 text-retro-primary" />
            <p className="text-xl font-bold mb-2">Drop audio file here</p>
            <p className="text-sm opacity-70 mb-4">or click to browse</p>
            <p className="text-xs opacity-50">
              Supported: MP3, WAV, OGG, WebM, M4A, MP4 (Max 100MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* File Info */}
            <div className="border-4 border-black dark:border-white p-6 bg-retro-accent/20">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <File className="w-12 h-12 text-retro-primary" />
                  <div>
                    <p className="font-bold text-lg">{file.name}</p>
                    <p className="text-sm opacity-70">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearFile}
                  disabled={uploading}
                  className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-none transition-colors disabled:opacity-50"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-sm font-bold mb-2">Session Title (Optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                placeholder="Enter a title for this recording..."
                className="w-full px-4 py-3 border-4 border-black dark:border-white bg-white dark:bg-gray-900 rounded-none font-mono focus:outline-none focus:border-retro-primary disabled:opacity-50"
              />
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full px-8 py-4 bg-retro-primary text-white font-bold text-lg border-4 border-black shadow-retro hover:shadow-retro-hover hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Uploading & Transcribing...
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6" />
                  Upload & Transcribe
                </>
              )}
            </button>

            {/* Status Message */}
            {uploadStatus.type && (
              <div
                className={`
                p-4 border-4 flex items-center gap-3
                ${
                  uploadStatus.type === "success"
                    ? "border-green-500 bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100"
                    : "border-red-500 bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100"
                }
              `}
              >
                {uploadStatus.type === "success" ? (
                  <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-6 h-6 flex-shrink-0" />
                )}
                <p className="font-bold">{uploadStatus.message}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="mt-6 bg-retro-secondary/20 border-4 border-black dark:border-white p-6 shadow-retro">
        <h3 className="font-bold text-lg mb-3">How it works</h3>
        <ol className="space-y-2 text-sm opacity-80">
          <li>1. Upload your audio file (MP3, WAV, etc.)</li>
          <li>2. AI transcribes your audio using Gemini</li>
          <li>3. Get a detailed summary with key points</li>
          <li>4. Download transcript in multiple formats</li>
        </ol>
      </div>
    </div>
  );
}
