import * as vscode from "vscode";
import { Bookmark } from "./types";
import * as path from "path";

type TreeNode = FileNode | BookmarkNode;

class FileNode extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly bookmarks: BookmarkNode[]
  ) {
    super(path.basename(filePath), vscode.TreeItemCollapsibleState.Expanded);

    this.tooltip = filePath;
    this.description = path.dirname(filePath);

    // Use VS Code's file icon theme
    this.resourceUri = vscode.Uri.file(filePath);
    this.iconPath = vscode.ThemeIcon.File;

    this.contextValue = "file";
  }
}

class BookmarkNode extends vscode.TreeItem {
  constructor(private readonly bookmark: Bookmark) {
    super(
      `Line ${bookmark.line + 1}: ${bookmark.lineText || ""}`,
      vscode.TreeItemCollapsibleState.None
    );

    this.description = bookmark.note || "";
    this.tooltip = new vscode.MarkdownString(
      `**${bookmark.lineText || ""}**\n\n${bookmark.note || ""}`
    );
    this.iconPath = new vscode.ThemeIcon("bookmark");

    this.command = {
      command: "vscode.open",
      title: "Open Bookmark",
      arguments: [
        vscode.Uri.file(bookmark.filePath),
        {
          selection: new vscode.Range(bookmark.line, 0, bookmark.line, 0),
          preview: true,
        },
      ],
    };
  }

  contextValue = "bookmark";

  getBookmark(): Bookmark {
    return this.bookmark;
  }
}

export class BookmarkProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeNode | undefined | null | void
  > = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TreeNode | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private bookmarks: Bookmark[];
  private filteredBookmarks: Bookmark[] | null = null;

  constructor(bookmarks: Bookmark[]) {
    this.bookmarks = bookmarks;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  filterBookmarks(filtered: Bookmark[]): void {
    this.filteredBookmarks = filtered;
    this.refresh();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (!element) {
      // Root level - return file nodes
      const bookmarksToShow = this.filteredBookmarks || this.bookmarks;
      const groupedBookmarks = this.groupBookmarksByFile(bookmarksToShow);
      return Promise.resolve(
        Array.from(groupedBookmarks.entries()).map(
          ([filePath, bookmarks]) => new FileNode(filePath, bookmarks)
        )
      );
    }

    if (element instanceof FileNode) {
      // File level - return bookmark nodes
      return Promise.resolve(element.bookmarks);
    }

    // Bookmark level - no children
    return Promise.resolve([]);
  }

  private groupBookmarksByFile(
    bookmarks: Bookmark[]
  ): Map<string, BookmarkNode[]> {
    const grouped = new Map<string, BookmarkNode[]>();

    // Sort bookmarks by file path and then by line number
    const sortedBookmarks = [...bookmarks].sort((a, b) => {
      const fileCompare = a.filePath.localeCompare(b.filePath);
      if (fileCompare !== 0) return fileCompare;
      return a.line - b.line;
    });

    for (const bookmark of sortedBookmarks) {
      const bookmarkNode = new BookmarkNode(bookmark);
      if (!grouped.has(bookmark.filePath)) {
        grouped.set(bookmark.filePath, []);
      }
      grouped.get(bookmark.filePath)!.push(bookmarkNode);
    }

    return grouped;
  }

  // Helper method to get parent file node
  getParent(element: TreeNode): vscode.ProviderResult<TreeNode> {
    if (element instanceof BookmarkNode) {
      const bookmark = element.getBookmark();
      return new FileNode(bookmark.filePath, [element]);
    }
    return null;
  }
}
