import React, { useState, useCallback, useEffect } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Connection,
  Edge,
  Node,
  useNodesState,
  useEdgesState,
} from "reactflow";
import BookmarkCard from "./BookmarkCard";

// Type declarations
declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  setState(state: any): void;
  getState(): any;
};

// Create a singleton instance
const vscode = acquireVsCodeApi();

interface Bookmark {
  id: string;
  filePath: string;
  line: number;
  lineText: string;
  note: string;
  created: string;
}

interface BookmarkNodeData {
  filePath: string;
  bookmarks: Bookmark[];
}

const BookmarkNode = ({ data }: { data: BookmarkNodeData }) => {
  const handleNoteEdit = (bookmarkId: string, note: string) => {
    vscode.postMessage({
      command: "updateBookmark",
      bookmarkId,
      newNote: note,
    });
  };

  return <BookmarkCard data={data} handleNoteEdit={handleNoteEdit} />;
};

const nodeTypes = {
  bookmarkNode: BookmarkNode,
};

const CanvasEditor = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "bookmarksData") {
        setNodes(message.nodes);
        setEdges(message.edges);
      }
    };

    window.addEventListener("message", handleMessage);
    vscode.postMessage({ command: "getBookmarks" });

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = { ...params, type: "smoothstep", animated: true };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onNodeDragEnd = () => {
    vscode.postMessage({
      command: "saveLayout",
      nodes,
      edges,
    });
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragEnd}
        nodeTypes={nodeTypes}
        fitView
        style={{
          backgroundColor: "#f5f5f5",
          width: "100%",
          height: "100%",
        }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        nodesDraggable={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        {/* <Controls /> */}
      </ReactFlow>
    </div>
  );
};

export default CanvasEditor;
