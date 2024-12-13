import React from "react";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import { styled } from "@mui/material/styles";
import FolderIcon from "@mui/icons-material/Folder";
import { Handle, Position } from "reactflow";

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

interface BookmarkCardProps {
  data: BookmarkNodeData;
  handleNoteEdit: (bookmarkId: string, note: string) => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  minWidth: 150,
  maxWidth: 300,
  position: "relative",
  cursor: "grab",
  userSelect: "none",
  "&:active": {
    cursor: "grabbing",
  },
}));

const NodeWrapper = styled("div")({
  ".react-flow__handle": {
    opacity: 0,
  },
  padding: 0,
  margin: 0,
  width: "fit-content",
  height: "fit-content",
});

const ClickableHeader = styled(Typography)({
  cursor: "pointer",
  "&:hover": {
    textDecoration: "underline",
    color: "#0366d6", // GitHub-style link color
  },
});

const HighlightedText = styled(Typography)({
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
  background: "#fff9c4", // Light yellow highlight
  padding: "2px 4px",
  borderRadius: "2px",
  display: "inline",
});

const BookmarkCard: React.FC<BookmarkCardProps> = ({
  data,
  handleNoteEdit,
}) => {
  return (
    <NodeWrapper>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <StyledCard elevation={3}>
        <CardHeader
          avatar={<FolderIcon color="action" />}
          subheader={
            <Typography variant="body2" color="text.secondary">
              {data.filePath.split("/").pop()}
            </Typography>
          }
          title={
            <Tooltip title={data.filePath} placement="top">
              <ClickableHeader
                variant="subtitle2"
                noWrap
                onClick={(e) => {
                  e.stopPropagation(); // Prevent drag when clicking header
                }}
              >
                {data.filePath}
              </ClickableHeader>
            </Tooltip>
          }
          sx={{
            pb: 1,
            "& .MuiCardHeader-content": {
              overflow: "hidden",
            },
          }}
        />
        <CardContent sx={{ pt: 0 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {data.bookmarks.map((bookmark: Bookmark) => (
              <Paper
                key={bookmark.id}
                variant="outlined"
                sx={{
                  p: 1.5,
                  backgroundColor: "grey.50",
                  pointerEvents: "all",
                }}
              >
                <Box
                  sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                >
                  <Typography
                    variant="caption"
                    fontWeight="medium"
                    color="text.secondary"
                  >
                    Line {bookmark.line}:
                  </Typography>
                  <HighlightedText variant="caption">
                    {bookmark.lineText}
                  </HighlightedText>
                </Box>
                <TextField
                  multiline
                  fullWidth
                  minRows={2}
                  maxRows={4}
                  size="small"
                  variant="outlined"
                  defaultValue={bookmark.note}
                  placeholder="Add a note..."
                  onBlur={(e) => handleNoteEdit(bookmark.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    mt: 1,
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: "white",
                    },
                    "& .MuiInputBase-input": {
                      cursor: "text",
                      fontSize: "0.75rem",
                      lineHeight: 1.5,
                    },
                  }}
                />
              </Paper>
            ))}
          </Box>
        </CardContent>
      </StyledCard>
    </NodeWrapper>
  );
};

export default BookmarkCard;
