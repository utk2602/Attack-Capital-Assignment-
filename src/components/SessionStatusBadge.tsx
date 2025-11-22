"use client";

import { Loader2, CheckCircle, Clock, Circle } from "lucide-react";

interface SessionStatusBadgeProps {
  status: "recording" | "paused" | "stopped" | "processing" | "completed";
  size?: "sm" | "md" | "lg";
}

export function SessionStatusBadge({ status, size = "md" }: SessionStatusBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const statusConfig = {
    recording: {
      label: "Recording",
      icon: <Circle className={`${iconSizes[size]} fill-red-500 text-red-500 animate-pulse`} />,
      bgColor: "bg-red-100 dark:bg-red-900/30",
      textColor: "text-red-700 dark:text-red-400",
    },
    paused: {
      label: "Paused",
      icon: <Clock className={`${iconSizes[size]} text-yellow-600`} />,
      bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
      textColor: "text-yellow-700 dark:text-yellow-400",
    },
    stopped: {
      label: "Stopped",
      icon: <Circle className={`${iconSizes[size]} text-gray-500`} />,
      bgColor: "bg-gray-100 dark:bg-gray-700",
      textColor: "text-gray-700 dark:text-gray-400",
    },
    processing: {
      label: "Processing",
      icon: <Loader2 className={`${iconSizes[size]} text-blue-600 animate-spin`} />,
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      textColor: "text-blue-700 dark:text-blue-400",
    },
    completed: {
      label: "Completed",
      icon: <CheckCircle className={`${iconSizes[size]} text-green-600`} />,
      bgColor: "bg-green-100 dark:bg-green-900/30",
      textColor: "text-green-700 dark:text-green-400",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full font-medium ${sizeClasses[size]} ${config.bgColor} ${config.textColor}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}
