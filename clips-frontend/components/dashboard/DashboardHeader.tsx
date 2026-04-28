"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, Bell, Menu, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/components/AuthProvider";
import WalletConnectButton from "@/components/WalletConnectButton";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function DashboardHeader({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRead, setNotifRead] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const firstName = user?.name?.split(' ')[0] || user?.profile?.username || "Guest";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBellClick = () => {
    setNotifOpen((prev) => !prev);
    setNotifRead(true);
  };

  const handleQuickUpload = async () => {
    if (isUploading) return;
    
    setIsUploading(true);
    
    try {
      // Create file input element
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'video/*,.mp4,.mov,.avi,.mkv';
      fileInput.multiple = true;
      
      fileInput.onchange = async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          // Validate files client-side
          const validFiles: File[] = [];
          const errors: string[] = [];
          const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
          const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
          const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv'];

          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check file size
            if (file.size > MAX_FILE_SIZE) {
              errors.push(`File "${file.name}" exceeds maximum size of 500MB`);
              continue;
            }

            // Check file type
            const extension = '.' + file.name.split('.').pop()?.toLowerCase();
            if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(extension)) {
              errors.push(`File "${file.name}" has unsupported format. Allowed: MP4, MOV, AVI, MKV`);
              continue;
            }

            validFiles.push(file);
          }

          // Show errors if any
          if (errors.length > 0) {
            showErrorNotification(errors.join('; '));
            setIsUploading(false);
            return;
          }

          if (validFiles.length === 0) {
            setIsUploading(false);
            return;
          }

          // Show upload started notification
          showUploadNotification(validFiles.length);
          
          // Create FormData and upload
          const formData = new FormData();
          validFiles.forEach((file) => {
            formData.append('files', file);
          });

          try {
            const response = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Upload failed');
            }

            const result = await response.json();
            
            // Start processing in the store
            if (result.jobId) {
              const { startProcess } = useProcessStore.getState();
              startProcess(result.jobId, validFiles[0].name);
            }

            setIsUploading(false);
            showUploadCompleteNotification(validFiles.length);

            // Request notification permission if not already granted
            if ('Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission();
            }
          } catch (uploadError) {
            console.error('Upload error:', uploadError);
            setIsUploading(false);
            showErrorNotification(uploadError instanceof Error ? uploadError.message : 'Upload failed. Please try again.');
          }
        } else {
          setIsUploading(false);
        }
      };
      
      fileInput.oncancel = () => {
        setIsUploading(false);
      };
      
      // Trigger file picker
      fileInput.click();
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
      showErrorNotification(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    }
  };

  const showUploadNotification = (fileCount: number) => {
    // Create toast notification for upload start
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-brand text-black px-6 py-3 rounded-xl font-bold shadow-lg z-50 animate-in slide-in-from-right duration-300';
    toast.textContent = `Uploading ${fileCount} file${fileCount > 1 ? 's' : ''}...`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  const showUploadCompleteNotification = (fileCount: number) => {
    // Create toast notification for upload completion
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg z-50 animate-in slide-in-from-right duration-300';
    toast.textContent = `Successfully uploaded ${fileCount} file${fileCount > 1 ? 's' : ''}!`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  const showErrorNotification = () => {
    // Create toast notification for errors
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg z-50 animate-in slide-in-from-right duration-300';
    toast.textContent = 'Upload failed. Please try again.';
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  return (
    <header className="flex justify-between items-center py-6 lg:py-8 px-4 sm:px-6 lg:px-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-muted hover:text-white transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="space-y-0.5 sm:space-y-1">
          <h1 className="text-[24px] sm:text-[32px] font-extrabold tracking-tight text-white leading-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-muted text-[13px] sm:text-[15px] hidden sm:block">
            Your AI is currently processing <span className="text-white font-medium">3 new viral clips</span> from your last stream.
          </p>
        </div>
      </div>

        <div className="hidden sm:block">
          <WalletConnectButton compact />
        </div>

        <button 
          onClick={toggleTheme}
          className="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center text-muted hover:text-white transition-colors"
          aria-label={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="relative" ref={notifRef}>
          <button className="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center text-muted hover:text-white transition-colors relative"
            onClick={handleBellClick}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {!notifRead && (
              <div className="absolute top-3 right-3 w-2 h-2 bg-brand rounded-full border-2 border-surface" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[#0C120F] border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <p className="text-[14px] font-bold text-white">Notifications</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                <div className="px-5 py-4 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                  <div className="w-2 h-2 rounded-full bg-brand mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold text-white leading-snug">3 new clips are ready</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Your AI finished processing your last stream.</p>
                    <p className="text-[10px] text-subtle mt-1">2 minutes ago</p>
                  </div>
                </div>
                <div className="px-5 py-4 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                  <div className="w-2 h-2 rounded-full bg-muted mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold text-white leading-snug">TikTok earnings updated</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Your latest payout has been recorded.</p>
                    <p className="text-[10px] text-subtle mt-1">1 hour ago</p>
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-white/[0.06]">
                <p className="text-[11px] text-muted-foreground text-center">No more notifications</p>
              </div>
            </div>
          )}
        </div>
        
        <button 
          onClick={handleQuickUpload}
          disabled={isUploading}
          className={`bg-brand hover:bg-brand-hover text-black px-6 py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2.5 transition-all shadow-[0_0_20px_rgba(0,229,143,0.15)] hover:shadow-[0_0_30px_rgba(0,229,143,0.25)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
        >
          <Upload className={`w-4.5 h-4.5 ${isUploading ? 'animate-spin' : ''}`} />
          {isUploading ? 'Uploading...' : 'Quick Upload'}
        </button>
      </div>
    </header>
  );
}
