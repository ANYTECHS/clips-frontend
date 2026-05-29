"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts } from "@/app/hooks/useKeyboardShortcuts";
import KeyboardShortcutsModal from "./KeyboardShortcutsModal";

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    // If our shortcuts modal is open, close it first
    if (isModalOpen) {
      setIsModalOpen(false);
      return;
    }

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
  }, [isModalOpen]);

  const handleOpenShortcuts = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  useKeyboardShortcuts({
    onOpenSearch: handleOpenSearch,
    onOpenUpload: handleOpenUpload,
    onNavigateEarnings: handleNavigateEarnings,
    onNavigateProjects: handleNavigateProjects,
    onNavigateVault: handleNavigateVault,
    onCloseModals: handleCloseModals,
    onOpenShortcuts: handleOpenShortcuts,
  });

  return (
    <KeyboardShortcutsModal 
      isOpen={isModalOpen} 
      onClose={() => setIsModalOpen(false)} 
    />
  );
}
