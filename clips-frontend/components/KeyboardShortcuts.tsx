"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useProcessStore } from "@/app/store/processStore";
import { useWallet } from "@/components/WalletProvider";

export default function KeyboardShortcuts() {
  const router = useRouter();
  const { user } = useAuth();
  const resetProcess = useProcessStore((s) => s.resetProcess);
  const { disconnect } = useWallet();

  const handleOpenSearch = useCallback(() => {
    const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]');
    if (searchInput) {
      (searchInput as HTMLInputElement).focus();
    }
  }, []);

  const handleOpenUpload = useCallback(() => {
    const uploadButton = document.querySelector('button[aria-label*="Upload"]');
    if (uploadButton) {
      (uploadButton as HTMLButtonElement).click();
    }
  }, []);

  const handleNavigateEarnings = useCallback(() => {
    router.push("/earnings");
  }, [router]);

  const handleNavigateProjects = useCallback(() => {
    router.push("/projects");
  }, [router]);

  const handleNavigateVault = useCallback(() => {
    router.push("/vault");
  }, [router]);

  const handleCloseModals = useCallback(() => {
    const modals = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    modals.forEach((modal) => {
      const closeButtons = modal.querySelectorAll('button[aria-label*="Close"], button[aria-label*="close"]');
      closeButtons.forEach((btn) => {
        if (btn instanceof HTMLButtonElement) {
          btn.click();
        }
      });
    });
    
    const modals2 = document.querySelectorAll('.modal, .Modal, [class*="modal"], [class*="Modal"]');
    modals2.forEach((el) => {
      const buttons = el.querySelectorAll('button');
      buttons.forEach((btn) => {
        if (btn instanceof HTMLButtonElement) {
          const ariaLabel = btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
          if (ariaLabel.toLowerCase().includes('close') || ariaLabel.toLowerCase().includes('cancel')) {
            btn.click();
          }
        }
      });
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      
      if (isMeta && e.key === "k") {
        e.preventDefault();
        handleOpenSearch();
      }
      
      if (isMeta && e.key === "u") {
        e.preventDefault();
        handleOpenUpload();
      }
      
      if (isMeta && e.key === "e") {
        e.preventDefault();
        handleNavigateEarnings();
      }
      
      if (isMeta && e.key === "p") {
        e.preventDefault();
        handleNavigateProjects();
      }
      
      if (isMeta && e.key === "v") {
        e.preventDefault();
        handleNavigateVault();
      }
      
      if (e.key === "Escape") {
        handleCloseModals();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenSearch, handleOpenUpload, handleNavigateEarnings, handleNavigateProjects, handleNavigateVault, handleCloseModals]);

  return null;
}
