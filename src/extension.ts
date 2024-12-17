import * as fs from "fs";
import * as vscode from "vscode";
import { Bookmark, BookmarkNode } from "./types";
import { BookmarkProvider } from "./bookmarkProvider";
import path from "path";
import { BookmarkStorage } from "./storage";
import { getNonce } from "./utils";
import { Edge } from "reactflow";

interface CanvasLayout {
  nodes: BookmarkNode[];
  edges: Edge[];
}

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

      // Create quick pick for a native popup experience
      const quickPick = vscode.window.createQuickPick();
      quickPick.title = "Add Bookmark Note";
      quickPick.placeholder = "Type your note (Ctrl+Enter for new line)";
      quickPick.buttons = [
        {
          iconPath: new vscode.ThemeIcon("save"),
          tooltip: "Save Note",
        },
      ];

      let noteContent = "";

      return new Promise<void>((resolve) => {
        // Handle input changes
        quickPick.onDidChangeValue((value) => {
          noteContent = value;
        });

        quickPick.onDidTriggerButton(async () => {
          if (noteContent.trim()) {
            const bookmark: Bookmark = {
              id: Date.now().toString(),
              filePath: editor.document.uri.fsPath,
              line: line,
              lineText: lineText,
              note: noteContent.trim(),
              created: new Date().toISOString(),
            };

            bookmarks.push(bookmark);
            await context.globalState.update("bookmarks", bookmarks);
            bookmarkProvider.refresh();
            updateDecorations(editor);
          }
          quickPick.hide();
        });

        // Handle Enter key (save) and Escape (cancel)
        quickPick.onDidAccept(async () => {
          if (noteContent.trim()) {
            const bookmark: Bookmark = {
              id: Date.now().toString(),
              filePath: editor.document.uri.fsPath,
              line: line,
              lineText: lineText,
              note: noteContent.trim(),
              created: new Date().toISOString(),
            };

            bookmarks.push(bookmark);
            await context.globalState.update("bookmarks", bookmarks);
            bookmarkProvider.refresh();
            updateDecorations(editor);
          }
          quickPick.hide();
        });

        // Clean up on hide
        quickPick.onDidHide(() => {
          resolve();
        });

        quickPick.show();
      });
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

  let openCanvasCommand = vscode.commands.registerCommand(
    "code-bookmarker.canvas",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "bookmarkCanvas",
        "Bookmark Canvas",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "dist"),
          ],
        }
      );

      // Group bookmarks by file
      const bookmarksByFile = bookmarks.reduce((acc, bookmark) => {
        if (!acc[bookmark.filePath]) {
          acc[bookmark.filePath] = [];
        }
        acc[bookmark.filePath].push(bookmark);
        return acc;
      }, {} as Record<string, Bookmark[]>);

      // Create initial nodes
      const nodes: BookmarkNode[] = Object.entries(bookmarksByFile).map(
        ([filePath, fileBookmarks], index) => ({
          id: `file-${index}`,
          type: "bookmarkNode",
          position: {
            x: 100 + (index % 3) * 300, // Create a grid layout
            y: 100 + Math.floor(index / 3) * 200,
          },
          draggable: true,
          data: {
            filePath,
            bookmarks: fileBookmarks,
          },
        })
      );

      const scriptUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, "dist", "canvas.js")
      );

      // Get reactflow styles
      const styleUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, "dist", "style.css")
      );

      const nonce = getNonce();

      panel.webview.html = getWebviewContent(panel, scriptUri, context);

      // Initialize last saved layout
      const savedLayout = context.globalState.get("canvasLayout") as
        | CanvasLayout
        | undefined;

      if (savedLayout) {
        panel.webview.postMessage({
          command: "bookmarksData",
          nodes: savedLayout.nodes,
          edges: savedLayout.edges,
        });
      }

      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case "getBookmarks":
              panel.webview.postMessage({
                command: "bookmarksData",
                nodes,
                edges: [],
              });
              break;
            case "updateBookmark":
              const { bookmarkId, newNote } = message;
              const bookmark = bookmarks.find((b) => b.id === bookmarkId);
              if (bookmark) {
                bookmark.note = newNote;
                await context.globalState.update("bookmarks", bookmarks);
                bookmarkProvider.refresh();
              }
              break;
            case "openFile":
              const openPath = vscode.Uri.file(message.filePath);
              vscode.window.showTextDocument(openPath);
              return;
            case "saveLayout":
              await context.globalState.update("canvasLayout", {
                nodes: message.nodes,
                edges: message.edges,
              });
              break;
          }
        },
        undefined,
        context.subscriptions
      );
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
    recoverCommand,
    openCanvasCommand
  );
}

export function getWebviewContent(
  panel: vscode.WebviewPanel,
  scriptUri: vscode.Uri,
  context: vscode.ExtensionContext
): string {
  const nonce = getNonce();

  // Get the path to the extension's root directory (one level up from dist)
  const extensionPath = path.join(__dirname, "..");
  // Construct path to the HTML file in src/webview
  const templatePath = path.join(
    extensionPath,
    "src",
    "webview",
    "webview.html"
  );

  const webviewPath = path.join(
    context.extensionPath,
    "dist",
    "webview",
    "webview.html"
  );
  let htmlContent: string;

  try {
    htmlContent = fs.readFileSync(webviewPath, "utf-8");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Failed to read template file: ${webviewPath}`, error);
      throw new Error(`Could not load webview HTML template: ${error.message}`);
    } else {
      // Handle case where error is not an Error object
      console.error(`Failed to read template file: ${webviewPath}`, error);
      throw new Error("Could not load webview HTML template: Unknown error");
    }
  }

  htmlContent = htmlContent
    .replace(/{{cspSource}}/g, panel.webview.cspSource)
    .replace(/{{nonce}}/g, nonce)
    .replace(/{{scriptUri}}/g, scriptUri.toString());

  return htmlContent;
}

export function deactivate() {
  // Clean up decorator
}
