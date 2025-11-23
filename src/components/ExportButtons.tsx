"use client";

import React from "react";
import { Download, FileText, FileJson, FileCode } from "lucide-react";

interface Props {
  sessionId: string;
}

export default function ExportButtons({ sessionId }: Props) {
  const handleExport = async (format: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/export?format=${format}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `transcript.${format}`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export transcript");
    }
  };

  const exportOptions = [
    {
      format: "txt",
      label: "Plain Text",
      icon: FileText,
      description: "Simple text file",
    },
    {
      format: "srt",
      label: "SRT Subtitles",
      icon: FileCode,
      description: "SubRip format",
    },
    {
      format: "vtt",
      label: "WebVTT",
      icon: FileCode,
      description: "Web video text tracks",
    },
    {
      format: "json",
      label: "JSON",
      icon: FileJson,
      description: "Structured data",
    },
    {
      format: "md",
      label: "Markdown",
      icon: FileText,
      description: "With summary",
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Export Transcript</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.format}
              onClick={() => handleExport(option.format)}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
            >
              <div className="flex-shrink-0 p-2 rounded-md bg-gray-100 dark:bg-gray-700">
                <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {option.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
              </div>
              <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
