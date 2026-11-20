"use client";

import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Settings, Lock, Trash2, Loader2, Camera, Upload } from "lucide-react";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/shared/ToastProvider";
import ConfirmModal from "@/components/shared/ConfirmModal";
import UserAvatar from "@/components/shared/UserAvatar";
import Button from "@/components/shared/Button";

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [username, setUsername] = useState(user?.username || user?.profile?.username || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [emailDigest, setEmailDigest] = useState(false);
  const DIGEST_SCHEDULE = "0 8 * * *";
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      if (user.fullName) setFullName(user.fullName);
      const u = user.username || user.profile?.username;
      if (u) setUsername(u);
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFullName = fullName.trim();
    const cleanUsername = username.trim();

    if (cleanFullName && cleanFullName.length < 2) {
      toast("Full name must be at least 2 characters", "error");
      return;
    }

    if (cleanUsername) {
      if (cleanUsername.length < 3) {
        toast("Username must be at least 3 characters", "error");
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        toast("Username can only contain letters, numbers, underscores, and dashes", "error");
        return;
      }
    }

    setProfileLoading(true);
    try {
      const { data } = await apiClient.patch("/users/me", {
        fullName: cleanFullName,
        username: cleanUsername,
      });

      const updatedUser: any = {
        ...user,
        ...(data && typeof data === "object" ? data : {}),
        fullName: cleanFullName,
        username: cleanUsername,
        profile: {
          ...(user?.profile || {}),
          ...((data && typeof data === "object" && data.profile) || {}),
          username: cleanUsername,
        },
      };

      setUser(updatedUser);
      toast("Profile updated successfully", "success");
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to update profile";
      toast(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg, "error");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast("Please select an image file", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast("Image must be less than 5MB", "error");
      return;
    }

    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await apiClient.post("/users/me/avatar", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (user && data && (data.id || data.picture)) {
        setUser({ ...user, ...(data.user || data) }, true);
      } else {
        const { data: updatedUser } = await apiClient.get("/users/me");
        setUser(updatedUser, true);
      }
      toast("Profile picture updated successfully", "success");
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to update profile picture";
      toast(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg, "error");
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      toast("Please enter your current password", "error");
      return;
    }
    if (newPassword.length < 8) {
      toast("New password must be at least 8 characters", "error");
      return;
    }
    if (newPassword === oldPassword) {
      toast("New password cannot be the same as your current password", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("New passwords do not match", "error");
      return;
    }

    setLoading(true);
    try {
      await apiClient.patch("/users/me/password", {
        oldPassword,
        newPassword,
      });
      toast("Password updated successfully", "success");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to update password";
      toast(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      await apiClient.delete("/users/me");
      toast("Account deleted. We're sad to see you go.", "info");
      logout();
    } catch (err) {
      console.error("Failed to delete account:", err);
      toast("Failed to delete account. Please try again later.", "error");
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-12 px-6 space-y-12">
        <div className="space-y-3">
          <h1 className="text-[44px] font-black tracking-tight text-[#F4F7EF] flex items-center gap-4">
            <Settings className="w-10 h-10 text-[#B6FF4A]" />
            Settings
          </h1>
          <p className="text-[#90A89C] text-lg font-medium">Manage your account preferences and security.</p>
        </div>

        {/* Profile Section */}
        <section className="bg-[#06351C] border border-[#0e4d2a] rounded-[32px] overflow-hidden">
          <div className="p-8 border-b border-[#0e4d2a] bg-[#042413]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#B6FF4A]">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#F4F7EF]">Profile</h2>
                <p className="text-sm text-[#90A89C]">Update your public information and profile picture.</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Profile Picture Upload */}
            <div className="mb-8 flex items-center gap-6">
              <div className="relative group">
                <UserAvatar user={user} size="lg" className="w-24 h-24" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarLoading}
                  className="absolute inset-0 w-24 h-24 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                >
                  {avatarLoading ? (
                    <Loader2 className="w-6 h-6 text-[#F4F7EF] animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-[#F4F7EF]" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-[#F4F7EF]">Profile Picture</h3>
                <p className="text-sm text-[#90A89C] max-w-xs">
                  Click on your avatar to upload a new image. Supports JPG, PNG, GIF up to 5MB.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarLoading}
                  className="flex items-center gap-2 text-sm font-bold text-[#B6FF4A] hover:text-[#c6ff6b] transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {avatarLoading ? "Uploading..." : "Upload New Picture"}
                </button>
              </div>
            </div>

            <form onSubmit={handleProfileUpdate} className="max-w-md space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-[#90A89C] uppercase tracking-wider mb-2">Full Name</label>
                  <input 
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#042413] border border-[#0e4d2a] focus:border-[#39FF14]/50 rounded-2xl px-5 py-3.5 text-[#F4F7EF] outline-none transition-all placeholder-[#90A89C]"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#90A89C] uppercase tracking-wider mb-2">Username</label>
                  <input 
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#042413] border border-[#0e4d2a] focus:border-[#39FF14]/50 rounded-2xl px-5 py-3.5 text-[#F4F7EF] outline-none transition-all placeholder-[#90A89C]"
                    placeholder="johndoe"
                  />
                </div>
              </div>

              <Button size="lg" type="submit"
                disabled={profileLoading}
              >
                {profileLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
              </Button>
            </form>
          </div>
        </section>

        {/* Password Section */}
        <section className="bg-[#06351C] border border-[#0e4d2a] rounded-[32px] overflow-hidden">
          <div className="p-8 border-b border-[#0e4d2a] bg-[#042413]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#B6FF4A]">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#F4F7EF]">Security</h2>
                <p className="text-sm text-[#90A89C]">Update your password to keep your account secure.</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <form onSubmit={handlePasswordChange} className="max-w-md space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-[#90A89C] uppercase tracking-wider mb-2">Current Password</label>
                  <input 
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-[#042413] border border-[#0e4d2a] focus:border-[#39FF14]/50 rounded-2xl px-5 py-3.5 text-[#F4F7EF] outline-none transition-all placeholder-[#90A89C]"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#90A89C] uppercase tracking-wider mb-2">New Password</label>
                  <input 
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#042413] border border-[#0e4d2a] focus:border-[#39FF14]/50 rounded-2xl px-5 py-3.5 text-[#F4F7EF] outline-none transition-all placeholder-[#90A89C]"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#90A89C] uppercase tracking-wider mb-2">Confirm New Password</label>
                  <input 
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#042413] border border-[#0e4d2a] focus:border-[#39FF14]/50 rounded-2xl px-5 py-3.5 text-[#F4F7EF] outline-none transition-all placeholder-[#90A89C]"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <Button size="lg" type="submit"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
              </Button>
            </form>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-red-500/5 border border-red-500/20 rounded-[32px] overflow-hidden">
          <div className="p-8 border-b border-red-500/20 bg-red-500/[0.03]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-500">Danger Zone</h2>
                <p className="text-sm text-red-500/70">Irreversible actions for your account.</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#F4F7EF]">Delete Account</h3>
                <p className="text-sm text-[#90A89C] max-w-md">Once you delete your account, there is no going back. Please be certain.</p>
              </div>
              <button 
                onClick={() => setShowDeleteModal(true)}
                disabled={loading}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-8 py-4 rounded-2xl font-bold text-[15px] transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Delete My Account
              </button>
            </div>
          </div>
        </section>

        <section aria-label="Notification preferences" data-preferences="notificationPreferences">
          <h2 className="text-xl font-semibold">Notification Preferences</h2>
        </section>

        <ConfirmModal 
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
          title="Delete Account"
          message="Are you absolutely sure? This will permanently delete your account and all your videos/clips. This action cannot be undone."
          confirmText="Delete Everything"
          variant="danger"
          loading={loading}
        />
      </div>
    </DashboardLayout>
  );
}
