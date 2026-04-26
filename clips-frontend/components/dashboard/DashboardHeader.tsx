"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, Bell, Menu } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import WalletConnectButton from "@/components/WalletConnectButton";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function DashboardHeader({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
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
          // Show upload notification
          showUploadNotification(files.length);
          
          // TODO: Implement actual upload logic here
          console.log('Files selected for upload:', files);
          
          // Simulate upload process
          setTimeout(() => {
            setIsUploading(false);
            showUploadCompleteNotification(files.length);
          }, 2000);
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
      showErrorNotification();
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

      <div className="flex items-center gap-4">
        <div className="hidden sm:block">
          <WalletConnectButton compact />
        </div>

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
