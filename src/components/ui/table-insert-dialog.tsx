"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TableInsertDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (options: {
    cols: number;
    rows: number;
    width: string;
    alignment: string;
    withHeaderRow: boolean;
  }) => void;
}

export function TableInsertDialog({ open, onClose, onInsert }: TableInsertDialogProps) {
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  const [width, setWidth] = useState(100);
  const [alignment, setAlignment] = useState("left");
  const [withHeaderRow, setWithHeaderRow] = useState(true);

  const handleInsert = () => {
    onInsert({
      cols,
      rows,
      width: `${width}%`,
      alignment,
      withHeaderRow,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Insert Table</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="table-cols">Columns</Label>
              <Input
                id="table-cols"
                type="number"
                min={1}
                max={10}
                value={cols}
                onChange={(e) => setCols(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="table-rows">Rows</Label>
              <Input
                id="table-rows"
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => setRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="table-width">Width</Label>
            <div className="flex items-center gap-2">
              <Input
                id="table-width"
                type="number"
                min={1}
                max={100}
                value={width}
                onChange={(e) => setWidth(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                className="w-20"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Alignment</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="alignment"
                  value="left"
                  checked={alignment === "left"}
                  onChange={() => setAlignment("left")}
                />
                <span className="text-sm">Left</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="alignment"
                  value="center"
                  checked={alignment === "center"}
                  onChange={() => setAlignment("center")}
                />
                <span className="text-sm">Center</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="alignment"
                  value="right"
                  checked={alignment === "right"}
                  onChange={() => setAlignment("right")}
                />
                <span className="text-sm">Right</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="with-header"
              checked={withHeaderRow}
              onChange={(e) => setWithHeaderRow(e.target.checked)}
            />
            <Label htmlFor="with-header" className="cursor-pointer">Include header row</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            className="bg-[#0d7377] hover:bg-[#0a5c5f]"
          >
            Insert Table
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}