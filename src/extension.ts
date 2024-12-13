import * as vscode from "vscode";
import { Bookmark } from "./types";
import { BookmarkProvider } from "./bookmarkProvider";
import path from "path";
import { BookmarkStorage } from "./storage";

export function activate(context: vscode.ExtensionContext) {
  let storage: BookmarkStorage;
  try {
    storage = new BookmarkStorage();
    context.subscriptions.push({ dispose: () => storage.dispose() });
  } catch (error) {
    vscode.window.showErrorMessage(
      "Failed to initialize bookmark storage. Please open a workspace."
    );
    return;
  }

  const bookmarkDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(21, 126, 251, 0.1)",
    overviewRulerColor: "#157efb",
    overviewRulerLane: vscode.OverviewRulerLane.Left,
    isWholeLine: true,
    gutterIconPath: vscode.Uri.file(__dirname + "/media/bookmark.svg"),
    gutterIconSize: "contain",
  });

  let bookmarks: Bookmark[] = context.globalState.get("bookmarks", []);
  const bookmarkProvider = new BookmarkProvider(bookmarks);

  function updateDecorations(editor: vscode.TextEditor | undefined) {
    if (!editor) {
      return;
    }

    const currentFilePath = editor.document.uri.fsPath;
    const fileBookmarks = bookmarks.filter(
      (b) => b.filePath === currentFilePath
    );

    const decorations = fileBookmarks.map((bookmark) => ({
      range: new vscode.Range(bookmark.line, 0, bookmark.line, 0),
      hoverMessage: new vscode.MarkdownString(
        bookmark.note
          ? `**Bookmark Note**:\n\n${bookmark.note}`
          : `**Bookmark**`
      ),
    }));

    editor.setDecorations(bookmarkDecorationType, decorations);
  }

  // Update decorations when changing active editor
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      updateDecorations(editor);
    })
  );

  // Update decorations when document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        updateDecorations(editor);
      }
    })
  );

  // Initial decoration update
  updateDecorations(vscode.window.activeTextEditor);

  vscode.window.registerTreeDataProvider("bookmarksView", bookmarkProvider);

  // Add bookmark command
  let addBookmarkCommand = vscode.commands.registerCommand(
    "code-bookmarker.addBookmark",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor!");
        return;
      }

      const line = editor.selection.active.line;
      const lineText = editor.document.lineAt(line).text.trim();

      const note = await vscode.window.showInputBox({
        prompt: "Enter a note for this bookmark",
        placeHolder: "Note (optional)",
      });

      const bookmark: Bookmark = {
        id: Date.now().toString(),
        filePath: editor.document.uri.fsPath,
        line: line,
        lineText: lineText,
        note: note || "",
        created: new Date().toISOString(),
      };

      bookmarks.push(bookmark);
      await context.globalState.update("bookmarks", bookmarks);
      bookmarkProvider.refresh();
      updateDecorations(editor);
    }
  );

  // Edit note command
  let editNoteCommand = vscode.commands.registerCommand(
    "code-bookmarker.editNote",
    async (item: any) => {
      const bookmark = item.getBookmark ? item.getBookmark() : item;

      const newNote = await vscode.window.showInputBox({
        prompt: "Edit bookmark note",
        placeHolder: "Enter new note",
        value: bookmark.note,
      });

      if (newNote !== undefined) {
        const index = bookmarks.findIndex((b) => b.id === bookmark.id);
        if (index !== -1) {
          bookmarks[index] = { ...bookmarks[index], note: newNote };
          await context.globalState.update("bookmarks", bookmarks);
          bookmarkProvider.refresh();
          updateDecorations(vscode.window.activeTextEditor);
        }
      }
    }
  );

  // Remove bookmark command
  let removeBookmarkCommand = vscode.commands.registerCommand(
    "code-bookmarker.removeBookmark",
    async (item: any) => {
      const bookmark = item.getBookmark ? item.getBookmark() : item;

      const index = bookmarks.findIndex((b) => b.id === bookmark.id);
      if (index !== -1) {
        bookmarks.splice(index, 1);
        await context.globalState.update("bookmarks", bookmarks);
        bookmarkProvider.refresh();
        updateDecorations(vscode.window.activeTextEditor);
      }
    }
  );

  // Search bookmarks command
  let searchBookmarksCommand = vscode.commands.registerCommand(
    "code-bookmarker.searchBookmarks",
    async () => {
      const searchTerm = await vscode.window.showInputBox({
        prompt: "Search bookmarks",
        placeHolder: "Enter search term",
      });

      if (searchTerm) {
        const filteredBookmarks = bookmarks.filter(
          (b) => b.lineText.includes(searchTerm) || b.note.includes(searchTerm)
        );
        bookmarkProvider.filterBookmarks(filteredBookmarks);
      }
    }
  );

  let exportCommand = vscode.commands.registerCommand(
    "code-bookmarker.exportBookmarks",
    async () => {
      const workspaces = vscode.workspace.workspaceFolders;
      if (workspaces && workspaces.length > 1) {
        const selected = await vscode.window.showQuickPick(
          workspaces.map((ws) => ({
            label: ws.name,
            description: ws.uri.fsPath,
            workspace: ws,
          })),
          { placeHolder: "Select workspace to export (cancel for all)" }
        );

        await storage.exportBookmarks(selected?.workspace.uri.fsPath);
      } else {
        await storage.exportBookmarks();
      }
    }
  );

  let importCommand = vscode.commands.registerCommand(
    "code-bookmarker.importBookmarks",
    async () => {
      const workspaces = vscode.workspace.workspaceFolders;
      if (workspaces && workspaces.length > 1) {
        const selected = await vscode.window.showQuickPick(
          workspaces.map((ws) => ({
            label: ws.name,
            description: ws.uri.fsPath,
            workspace: ws,
          })),
          {
            placeHolder:
              "Select workspace to import to (cancel for auto-assign)",
          }
        );

        await storage.importBookmarks(selected?.workspace.uri.fsPath);
      } else {
        await storage.importBookmarks();
      }
    }
  );

  let recoverCommand = vscode.commands.registerCommand(
    "code-bookmarker.recoverBookmarks",
    async () => {
      const workspaces = vscode.workspace.workspaceFolders;
      if (!workspaces) {
        return;
      }

      const selected = await vscode.window.showQuickPick(
        workspaces.map((ws) => ({
          label: ws.name,
          description: ws.uri.fsPath,
          workspace: ws,
        })),
        { placeHolder: "Select workspace to recover" }
      );

      if (selected) {
        const recovered = await storage.recoverFromBackup(
          selected.workspace.uri.fsPath
        );
        if (recovered) {
          vscode.window.showInformationMessage(
            "Bookmarks recovered successfully"
          );
          bookmarkProvider.refresh();
          updateDecorations(vscode.window.activeTextEditor);
        } else {
          vscode.window.showWarningMessage("No backup found to recover");
        }
      }
    }
  );

  context.subscriptions.push(
    addBookmarkCommand,
    editNoteCommand,
    removeBookmarkCommand,
    searchBookmarksCommand,
    bookmarkDecorationType,
    exportCommand,
    importCommand,
    recoverCommand
  );
}

export function deactivate() {
  // Clean up decorator
}
