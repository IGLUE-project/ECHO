import React, { useState } from "react";
import "./FilesApp.css";
import { useOS } from "../../contexts/OSProvider";
// Import translation hook for multi-language support
import { useTranslation } from "react-i18next";
// Import UI icons for file explorer interface
import { FaTimes, FaMinus, FaFolder, FaFolderOpen, FaLock, FaChevronRight, FaHome, FaArrowLeft } from "react-icons/fa";
// Import utility function to resolve asset paths
import { assetPath } from "../../utils/assetPath";

/**
 * Folder configuration array defining available folders in the file explorer
 * Each folder has:
 * - id: Unique identifier for the folder
 * - labelKey: Translation key for the folder label
 * - icon: Icon type ('folder' or 'locked')
 * - items: Number of items in the folder (null for locked folders)
 */
const FOLDERS = [
  { id: "documents", labelKey: "filesApp.folders.documents", icon: "folder", items: 0 },
  { id: "images",    labelKey: "filesApp.folders.images",    icon: "folder", items: 0 },
  { id: "echo",      labelKey: "filesApp.folders.echo",      icon: "locked", items: null },
];

/**
 * FilesApp Component
 * 
 * Renders a file explorer application interface that simulates a desktop file manager.
 * Features include:
 * - Folder navigation (documents, images)
 * - Locked folder (echo) with access restrictions
 * - Breadcrumb navigation
 * - Back button functionality
 *
 * @returns {JSX.Element} The complete file explorer window
 */
export const FilesApp = () => {
  // Get app management functions (close and minimize) from OS context
  const { closeApp, minimizeApp } = useOS();
  // Get translation function for localized strings
  const { t } = useTranslation();
  // State for tracking which folder is currently open (null = home/root)
  const [openFolder, setOpenFolder] = useState(null);

  /**
   * Handle app close button click
   * Closes the files app through OS context
   */
  const handleClose = () => closeApp("files");

  /**
   * Get current folder object from FOLDERS array based on openFolder state
   * Returns undefined if no folder is open (home directory)
   */
  const currentFolder = FOLDERS.find(f => f.id === openFolder);

  return (
    // Backdrop container - click to close the app
    <div className="files-app-backdrop" onClick={handleClose}>
      {/* Main app window - stop propagation to prevent closing when clicking inside */}
      <div className="files-app-window" onClick={e => e.stopPropagation()}>

        {/* Title bar with app name and window controls */}
        <div className="files-titlebar">
          {/* Window title with icon and app name */}
          <div className="files-window-title">
            <img src={assetPath("/assets/folder.png")} alt="" className="files-title-icon" />
            <span>{t("filesApp.title")}</span>
          </div>
          {/* Window control buttons (minimize, close) */}
          <div className="files-window-controls">
            {/* Minimize button */}
            <button className="files-window-btn minimize" onClick={minimizeApp} title={t("desktop.window.minimize")}>
              <FaMinus />
            </button>
            {/* Close button */}
            <button className="files-window-btn close" onClick={handleClose} title={t("desktop.window.close")}>
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Navigation toolbar with back button and breadcrumb */}
        <div className="files-toolbar">
          {/* Back button - navigates to parent folder (home) */}
          <button
            className="files-back-btn"
            onClick={() => setOpenFolder(null)}
            disabled={openFolder === null}
            title={t("filesApp.back")}
          >
            <FaArrowLeft />
          </button>
          {/* Breadcrumb navigation showing current location */}
          <nav className="files-breadcrumb">
            {/* Home/Root location clickable item */}
            <span
              className={`files-breadcrumb-item ${openFolder === null ? "active" : "clickable"}`}
              onClick={() => setOpenFolder(null)}
            >
              <FaHome className="files-breadcrumb-icon" />
              {t("filesApp.thisPC")}
            </span>
            {/* Current folder breadcrumb item - only shown if a folder is open */}
            {currentFolder && (
              <>
                <FaChevronRight className="files-breadcrumb-sep" />
                <span className="files-breadcrumb-item active">
                  {t(currentFolder.labelKey)}
                </span>
              </>
            )}
          </nav>
        </div>

        {/* Main content section with sidebar and file content area */}
        <div className="files-body">
          {/* Left sidebar with folder shortcuts */}
          <aside className="files-sidebar">
            {/* Sidebar section header */}
            <p className="files-sidebar-section">{t("filesApp.thisPC")}</p>
            {/* Render folder list items */}
            {FOLDERS.map(f => (
              <button
                key={f.id}
                className={`files-sidebar-item ${openFolder === f.id ? "active" : ""}`}
                onClick={() => setOpenFolder(f.id)}
              >
                {/* Locked icon for locked folders, folder icon for regular folders */}
                {f.icon === "locked"
                  ? <FaLock className="files-sidebar-icon locked" />
                  : <FaFolder className="files-sidebar-icon" />
                }
                <span>{t(f.labelKey)}</span>
              </button>
            ))}
          </aside>

          {/* Main content area displaying folder contents */}
          <main className="files-content">
            {/* Home directory view - show all available folders */}
            {openFolder === null && (
              <>
                <p className="files-section-label">{t("filesApp.thisPC")}</p>
                {/* Grid of folder cards */}
                <div className="files-grid">
                  {FOLDERS.map(f => (
                    <button
                      key={f.id}
                      className={`files-folder-card ${f.icon === "locked" ? "locked" : ""}`}
                      onDoubleClick={() => setOpenFolder(f.id)}
                      onClick={() => setOpenFolder(f.id)}
                    >
                      {/* Show locked folder icon for locked folders */}
                      {f.icon === "locked"
                        ? <FaFolderOpen className="files-folder-icon locked" />
                        : <FaFolder className="files-folder-icon" />
                      }
                      {/* Folder name */}
                      <span className="files-folder-name">{t(f.labelKey)}</span>
                      {/* Folder metadata - locked status or item count */}
                      {f.icon === "locked"
                        ? <span className="files-folder-meta"><FaLock size={9} /> {t("filesApp.locked")}</span>
                        : <span className="files-folder-meta">{t("filesApp.items", { count: f.items })}</span>
                      }
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Empty folder view - shown when opening unlocked empty folders */}
            {openFolder !== null && currentFolder?.icon !== "locked" && (
              <div className="files-empty-folder">
                <FaFolderOpen className="files-empty-icon" />
                <p>{t("filesApp.empty")}</p>
              </div>
            )}

            {/* Locked folder view - shown when trying to open the echo (locked) folder */}
            {openFolder === "echo" && (
              <div className="files-locked-folder">
                <FaLock className="files-locked-icon" />
                <p className="files-locked-title">{t("filesApp.lockedTitle")}</p>
                <p className="files-locked-message">{t("filesApp.lockedMessage")}</p>
              </div>
            )}
          </main>
        </div>

        {/* Status bar at bottom - displays folder count or locked status */}
        <div className="files-statusbar">
          {/* Show different status messages based on current view */}
          {openFolder === null
            ? t("filesApp.items", { count: FOLDERS.length })
            : currentFolder?.icon === "locked"
              ? t("filesApp.locked")
              : t("filesApp.items", { count: 0 })
          }
        </div>
      </div>
    </div>
  );
};
