// src/storage.ts
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Bookmark } from "./types";

export class BookmarkStorage {
  private storageMap: Map<string, Bookmark[]> = new Map();
  private backupInterval: NodeJS.Timeout | undefined;

  constructor() {
    this.initializeStorage();
    this.setupAutoBackup();
  }

  private initializeStorage(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error("No workspace folder open");
    }

    // Initialize storage for each workspace folder
    workspaceFolders.forEach((folder) => {
      const vscodePath = this.ensureVSCodeFolder(folder.uri.fsPath);
      const bookmarksPath = path.join(vscodePath, "bookmarks.json");

      try {
        if (fs.existsSync(bookmarksPath)) {
          const data = fs.readFileSync(bookmarksPath, "utf8");
          this.storageMap.set(folder.uri.fsPath, JSON.parse(data));
        } else {
          this.storageMap.set(folder.uri.fsPath, []);
        }
      } catch (error) {
        console.error(`Error loading bookmarks for ${folder.name}:`, error);
        this.storageMap.set(folder.uri.fsPath, []);
      }
    });
  }

  private ensureVSCodeFolder(workspacePath: string): string {
    const vscodePath = path.join(workspacePath, ".vscode");
    if (!fs.existsSync(vscodePath)) {
      fs.mkdirSync(vscodePath);
    }
    return vscodePath;
  }

  private setupAutoBackup(): void {
    // Create backup every 5 minutes
    this.backupInterval = setInterval(() => {
      this.createBackup();
    }, 5 * 60 * 1000);
  }

  private getWorkspaceForFile(filePath: string): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return undefined;
    }

    // Find the workspace that contains this file
    return workspaceFolders
      .map((folder) => folder.uri.fsPath)
      .find((wsPath) => filePath.startsWith(wsPath));
  }

  private saveBookmarksToFile(workspacePath: string): void {
    try {
      const vscodePath = this.ensureVSCodeFolder(workspacePath);
      const bookmarksPath = path.join(vscodePath, "bookmarks.json");
      const bookmarks = this.storageMap.get(workspacePath) || [];

      fs.writeFileSync(bookmarksPath, JSON.stringify(bookmarks, null, 2));
    } catch (error) {
      console.error("Error saving bookmarks:", error);
      vscode.window.showErrorMessage("Failed to save bookmarks");
    }
  }

  private createBackup(): void {
    this.storageMap.forEach((bookmarks, workspacePath) => {
      try {
        const vscodePath = this.ensureVSCodeFolder(workspacePath);
        const backupPath = path.join(vscodePath, "bookmarks.backup.json");
        fs.writeFileSync(backupPath, JSON.stringify(bookmarks, null, 2));
      } catch (error) {
        console.error("Error creating backup:", error);
      }
    });
  }

  dispose(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
  }

  // Public methods for bookmark management
  getBookmarks(filePath?: string): Bookmark[] {
    if (!filePath) {
      // Return all bookmarks from all workspaces
      return Array.from(this.storageMap.values()).flat();
    }

    const workspacePath = this.getWorkspaceForFile(filePath);
    return workspacePath ? this.storageMap.get(workspacePath) || [] : [];
  }

  addBookmark(bookmark: Bookmark): void {
    const workspacePath = this.getWorkspaceForFile(bookmark.filePath);
    if (!workspacePath) {
      return;
    }

    const bookmarks = this.storageMap.get(workspacePath) || [];
    bookmarks.push(bookmark);
    this.storageMap.set(workspacePath, bookmarks);
    this.saveBookmarksToFile(workspacePath);
  }

  removeBookmark(bookmarkId: string): void {
    this.storageMap.forEach((bookmarks, workspacePath) => {
      const index = bookmarks.findIndex((b) => b.id === bookmarkId);
      if (index !== -1) {
        bookmarks.splice(index, 1);
        this.saveBookmarksToFile(workspacePath);
      }
    });
  }

  updateBookmark(bookmark: Bookmark): void {
    const workspacePath = this.getWorkspaceForFile(bookmark.filePath);
    if (!workspacePath) {
      return;
    }

    const bookmarks = this.storageMap.get(workspacePath) || [];
    const index = bookmarks.findIndex((b) => b.id === bookmark.id);
    if (index !== -1) {
      bookmarks[index] = bookmark;
      this.saveBookmarksToFile(workspacePath);
    }
  }

  // Import/Export functionality
  async exportBookmarks(workspacePath?: string): Promise<void> {
    try {
      const bookmarks = workspacePath
        ? this.storageMap.get(workspacePath)
        : Array.from(this.storageMap.values()).flat();

      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        bookmarks: bookmarks,
      };

      const uri = await vscode.window.showSaveDialog({
        filters: { "JSON files": ["json"] },
        defaultUri: vscode.Uri.file("bookmarks-export.json"),
      });

      if (uri) {
        fs.writeFileSync(uri.fsPath, JSON.stringify(exportData, null, 2));
        vscode.window.showInformationMessage("Bookmarks exported successfully");
      }
    } catch (error) {
      vscode.window.showErrorMessage("Failed to export bookmarks");
    }
  }

  async importBookmarks(workspacePath?: string): Promise<void> {
    try {
      const uri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        filters: { "JSON files": ["json"] },
      });

      if (uri && uri[0]) {
        const data = JSON.parse(fs.readFileSync(uri[0].fsPath, "utf8"));

        if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
          throw new Error("Invalid bookmark file format");
        }

        if (workspacePath) {
          // Import to specific workspace
          const existing = this.storageMap.get(workspacePath) || [];
          this.storageMap.set(workspacePath, [...existing, ...data.bookmarks]);
          this.saveBookmarksToFile(workspacePath);
        } else {
          // Import to all workspaces based on file paths
          data.bookmarks.forEach((bookmark: Bookmark) => {
            const wsPath = this.getWorkspaceForFile(bookmark.filePath);
            if (wsPath) {
              const existing = this.storageMap.get(wsPath) || [];
              existing.push(bookmark);
              this.storageMap.set(wsPath, existing);
              this.saveBookmarksToFile(wsPath);
            }
          });
        }

        vscode.window.showInformationMessage("Bookmarks imported successfully");
      }
    } catch (error) {
      vscode.window.showErrorMessage("Failed to import bookmarks");
    }
  }

  // Recovery functionality
  async recoverFromBackup(workspacePath: string): Promise<boolean> {
    try {
      const vscodePath = this.ensureVSCodeFolder(workspacePath);
      const backupPath = path.join(vscodePath, "bookmarks.backup.json");

      if (fs.existsSync(backupPath)) {
        const backupData = JSON.parse(fs.readFileSync(backupPath, "utf8"));
        this.storageMap.set(workspacePath, backupData);
        this.saveBookmarksToFile(workspacePath);
        return true;
      }
    } catch (error) {
      console.error("Error recovering from backup:", error);
    }
    return false;
  }
}
