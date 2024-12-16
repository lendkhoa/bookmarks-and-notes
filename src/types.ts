export interface Bookmark {
  id: string;
  filePath: string;
  line: number;
  lineText: string;
  note: string;
  created: string;
}

export interface BookmarkNode {
  id: string;
  type: "bookmarkNode";
  position: { x: number; y: number };
  data: {
    filePath: string;
    bookmarks: Bookmark[];
  };
}

export interface BookmarkConnection {
  id: string;
  source: string;
  target: string;
  label?: string;
}
